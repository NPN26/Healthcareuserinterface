/**
 * Encrypted localStorage wrapper for PHI data.
 *
 * In production, sensitive health data (biomarkers, alerts, devices, goals)
 * is encrypted with AES-256-GCM using a key derived from the user's session ID.
 * In development, data is stored as plaintext for ease of debugging.
 *
 * Non-PHI keys (e.g. theme preferences) bypass encryption entirely.
 */

const PHI_KEYS = new Set([
  'healthApp_biomarkers',
  'healthApp_alerts',
  'healthApp_devices',
  'healthApp_users',
  'healthApp_goals',
  'healthApp_currentUser',
]);

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

let cachedKey: CryptoKey | null = null;

function isPHI(key: string): boolean {
  return PHI_KEYS.has(key);
}

/**
 * Derive an AES-256-GCM key from source material (e.g. session ID).
 * The key is cached in memory for the duration of the session.
 */
async function deriveKey(sessionId: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(sessionId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = ENCODER.encode('healthsync-phi-storage');

  cachedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedKey;
}

async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENCODER.encode(plaintext)
  );

  // Encode as base64: iv (12 bytes) + ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encoded: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return DECODER.decode(plaintext);
}

let sessionKeySource: string | null = null;

/**
 * Initialize secure storage with a session identifier.
 * Must be called after authentication, before reading/writing PHI.
 */
export function initSecureStorage(sessionId: string) {
  sessionKeySource = sessionId;
  cachedKey = null; // force re-derive on new session
}

/**
 * Clear the cached encryption key (call on logout).
 */
export function clearSecureStorage() {
  cachedKey = null;
  sessionKeySource = null;
}

/**
 * Write a value to storage. PHI keys are encrypted in production.
 */
export async function secureSetItem(key: string, value: string): Promise<void> {
  if (!import.meta.env.DEV && isPHI(key) && sessionKeySource) {
    const cryptoKey = await deriveKey(sessionKeySource);
    const encrypted = await encrypt(value, cryptoKey);
    localStorage.setItem(key, encrypted);
    return;
  }
  if (!import.meta.env.DEV && isPHI(key) && !sessionKeySource) {
    throw new Error('Cannot store PHI: secure storage not initialized. Call initSecureStorage() first.');
  }
  localStorage.setItem(key, value);
}

/**
 * Read a value from storage. PHI keys are decrypted in production.
 */
export async function secureGetItem(key: string): Promise<string | null> {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;

  if (!import.meta.env.DEV && isPHI(key) && sessionKeySource) {
    try {
      const cryptoKey = await deriveKey(sessionKeySource);
      return await decrypt(raw, cryptoKey);
    } catch {
      // Data may be from a previous session or unencrypted; clear stale data
      localStorage.removeItem(key);
      return null;
    }
  }
  return raw;
}

/**
 * Remove an item from storage.
 */
export function secureRemoveItem(key: string): void {
  localStorage.removeItem(key);
}
