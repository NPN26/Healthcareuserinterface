/**
 * Offline data queue using IndexedDB (via idb-keyval).
 * Queues biomarker entries made while offline and syncs on reconnect.
 * PHI (biomarker data) is encrypted at rest using AES-256-GCM via secureStorage.
 */
import { get, set, del, keys } from 'idb-keyval';
import type { Biomarker } from './mockData';

const QUEUE_PREFIX = 'offline_entry_';

export interface OfflineEntry {
  id: string;
  /** Encrypted JSON string of Biomarker in production, plaintext in dev */
  biomarker: Biomarker | string;
  createdAt: string;
  synced: boolean;
  encrypted?: boolean;
}

/** Encrypt a biomarker for at-rest storage (production only) */
async function encryptBiomarker(biomarker: Biomarker): Promise<{ data: Biomarker | string; encrypted: boolean }> {
  if (import.meta.env.DEV) {
    return { data: biomarker, encrypted: false };
  }
  try {
    const { secureSetItem, secureGetItem } = await import('./secureStorage');
    // Use secureSetItem to encrypt, then read back the encrypted value
    const tempKey = `_offline_encrypt_tmp_${Date.now()}`;
    await secureSetItem(tempKey, JSON.stringify(biomarker));
    const encrypted = localStorage.getItem(tempKey);
    localStorage.removeItem(tempKey);
    if (encrypted) {
      return { data: encrypted, encrypted: true };
    }
  } catch {
    // Fall through to plaintext if encryption unavailable (no session)
  }
  return { data: biomarker, encrypted: false };
}

/** Decrypt a biomarker from at-rest storage */
async function decryptBiomarker(entry: OfflineEntry): Promise<Biomarker> {
  if (!entry.encrypted || typeof entry.biomarker !== 'string') {
    return entry.biomarker as Biomarker;
  }
  try {
    const { secureGetItem } = await import('./secureStorage');
    // Temporarily put the encrypted data in localStorage for secureGetItem to decrypt
    const tempKey = `_offline_decrypt_tmp_${Date.now()}`;
    localStorage.setItem(tempKey, entry.biomarker);
    const decrypted = await secureGetItem(tempKey);
    localStorage.removeItem(tempKey);
    if (decrypted) {
      return JSON.parse(decrypted);
    }
  } catch {
    // If decryption fails (session changed), return null-ish so caller can skip
  }
  throw new Error('Failed to decrypt offline entry');
}

/** Queue a new biomarker entry for later sync */
export async function queueOfflineEntry(biomarker: Biomarker): Promise<void> {
  const { data, encrypted } = await encryptBiomarker(biomarker);
  const entry: OfflineEntry = {
    id: `${QUEUE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    biomarker: data,
    createdAt: new Date().toISOString(),
    synced: false,
    encrypted,
  };
  await set(entry.id, entry);
}

/** Get all pending (un-synced) entries */
export async function getPendingEntries(): Promise<OfflineEntry[]> {
  const allKeys = await keys();
  const pending: OfflineEntry[] = [];
  for (const key of allKeys) {
    if (String(key).startsWith(QUEUE_PREFIX)) {
      const entry = await get<OfflineEntry>(key);
      if (entry && !entry.synced) pending.push(entry);
    }
  }
  return pending;
}

/** Mark an entry as synced */
export async function markEntrySynced(id: string): Promise<void> {
  const entry = await get<OfflineEntry>(id);
  if (entry) {
    entry.synced = true;
    await set(id, entry);
  }
}

/** Remove synced entries */
export async function clearSyncedEntries(): Promise<void> {
  const allKeys = await keys();
  for (const key of allKeys) {
    if (String(key).startsWith(QUEUE_PREFIX)) {
      const entry = await get<OfflineEntry>(key);
      if (entry?.synced) await del(key);
    }
  }
}

/** Attempt to sync all pending entries to Supabase */
export async function syncOfflineEntries(): Promise<number> {
  const pending = await getPendingEntries();
  if (pending.length === 0) return 0;

  let synced = 0;
  try {
    const { supabase, generateUUID } = await import('./supabase');

    for (const entry of pending) {
      let biomarker: Biomarker;
      try {
        biomarker = await decryptBiomarker(entry);
      } catch {
        // Cannot decrypt (session changed) — skip, will retry next session
        continue;
      }

      // Map frontend type to DB enum
      const typeMap: Record<string, string> = {
        heartRate: 'HEART_RATE',
        bloodPressure: 'BLOOD_PRESSURE',
        glucose: 'BLOOD_GLUCOSE',
        oxygen: 'SPO2',
        steps: 'STEPS',
        sleep: 'SLEEP',
        temperature: 'RESPIRATORY_RATE',
        weight: 'WEIGHT',
      };

      const dataPointId = generateUUID();

      const { error: dpError } = await supabase.from('data_points').insert({
        data_point_id: dataPointId,
        user_id: biomarker.userId,
        source_id: biomarker.deviceId === 'manual-entry' ? null : biomarker.deviceId,
        data_type: 'BIOMARKER',
        timestamp: biomarker.timestamp,
      });
      if (dpError) { continue; }

      const { error: bmError } = await supabase.from('biomarker_data').insert({
        data_point_id: dataPointId,
        type: typeMap[biomarker.type] || biomarker.type,
        value: biomarker.type === 'bloodPressure' ? biomarker.systolic : biomarker.value,
        secondary_value: biomarker.type === 'bloodPressure' ? biomarker.diastolic : null,
        unit: '',
      });
      if (bmError) { continue; }

      await markEntrySynced(entry.id);
      synced++;
    }
  } catch (err) {
  }
  return synced;
}

/** Check if the browser is online */
export function isOnline(): boolean {
  return navigator.onLine;
}

/** Register service worker & set up auto-sync listeners */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      // Listen for SW messages (e.g. background sync trigger)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_OFFLINE_DATA') {
          syncOfflineEntries();
        }
      });
    } catch (err) {
    }
  });

  // When connection restores, attempt to sync queued entries
  window.addEventListener('online', async () => {
    const count = await syncOfflineEntries();
    if (count > 0) {
      // Dynamic import to avoid circular dep
      const { toast } = await import('sonner');
      toast.success(`Synced ${count} offline reading${count > 1 ? 's' : ''}`);
    }
    await clearSyncedEntries();
  });

  // Optionally register background sync
  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      try { await (reg as any).sync.register('sync-offline-entries'); } catch { /* ignored */ }
    }
  });
}
