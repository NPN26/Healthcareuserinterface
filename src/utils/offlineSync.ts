/**
 * Offline data queue using IndexedDB (via idb-keyval).
 * Queues biomarker entries made while offline and syncs on reconnect.
 */
import { get, set, del, keys } from 'idb-keyval';
import type { Biomarker } from './mockData';

const QUEUE_PREFIX = 'offline_entry_';

export interface OfflineEntry {
  id: string;
  biomarker: Biomarker;
  createdAt: string;
  synced: boolean;
}

/** Queue a new biomarker entry for later sync */
export async function queueOfflineEntry(biomarker: Biomarker): Promise<void> {
  const entry: OfflineEntry = {
    id: `${QUEUE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    biomarker,
    createdAt: new Date().toISOString(),
    synced: false,
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
      const { biomarker } = entry;

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
      if (dpError) { console.error('Sync data_points error:', dpError); continue; }

      const { error: bmError } = await supabase.from('biomarker_data').insert({
        data_point_id: dataPointId,
        type: typeMap[biomarker.type] || biomarker.type,
        value: biomarker.type === 'bloodPressure' ? biomarker.systolic : biomarker.value,
        secondary_value: biomarker.type === 'bloodPressure' ? biomarker.diastolic : null,
        unit: '',
      });
      if (bmError) { console.error('Sync biomarker_data error:', bmError); continue; }

      await markEntrySynced(entry.id);
      synced++;
    }
  } catch (err) {
    console.warn('Offline sync failed (likely still offline):', err);
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
      console.log('✅ Service Worker registered:', reg.scope);

      // Listen for SW messages (e.g. background sync trigger)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_OFFLINE_DATA') {
          syncOfflineEntries();
        }
      });
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  });

  // When connection restores, attempt to sync queued entries
  window.addEventListener('online', async () => {
    console.log('🌐 Back online - syncing queued entries…');
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
