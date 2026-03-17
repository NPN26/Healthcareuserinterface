/**
 * Central Rate Limiter — in-memory, sliding-window rate limiting
 * with configurable cooldown periods per action type.
 *
 * Used as the first line of defense against brute-force attacks,
 * credential stuffing, bot scraping, and API abuse.
 *
 * State is kept in a `Map` (not sessionStorage) so it cannot be
 * trivially bypassed by clearing browser storage.
 */

// NOTE: This module must NOT import from securityLogger (which imports
// supabase, which imports rateLimiter — creating a circular dependency).
// Violations are logged via console.warn here; callers should use
// securityLogger for structured persistence.

// ── Configuration ──

export interface RateLimitConfig {
  /** Maximum allowed actions within the time window */
  maxAttempts: number;
  /** Sliding window duration in milliseconds */
  windowMs: number;
  /** Cooldown period in ms after the limit is exceeded */
  cooldownMs: number;
}

export const RATE_LIMITS = {
  login:         { maxAttempts: 5,  windowMs: 15 * 60_000,  cooldownMs: 15 * 60_000 },
  signup:        { maxAttempts: 3,  windowMs: 60 * 60_000,  cooldownMs: 30 * 60_000 },
  apiCall:       { maxAttempts: 60, windowMs: 60_000,        cooldownMs: 30_000 },
  chatMessage:   { maxAttempts: 20, windowMs: 60_000,        cooldownMs: 15_000 },
  pdfGeneration: { maxAttempts: 3,  windowMs: 10 * 60_000,  cooldownMs: 5 * 60_000 },
  dataExport:    { maxAttempts: 5,  windowMs: 10 * 60_000,  cooldownMs: 5 * 60_000 },
  emailSend:     { maxAttempts: 10, windowMs: 60 * 60_000,  cooldownMs: 30 * 60_000 },
  adminBulk:     { maxAttempts: 3,  windowMs: 5 * 60_000,   cooldownMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

// ── Result ──

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  /** Human-readable message suitable for toast notifications */
  message: string;
}

// ── Internal state ──

interface BucketState {
  timestamps: number[];
  cooldownUntil: number | null;
}

const buckets = new Map<string, BucketState>();

// ── Periodic cleanup to prevent memory leaks ──

const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function maybeCleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, state] of buckets) {
    const action = key.split(':')[0] as RateLimitAction;
    const config = RATE_LIMITS[action];
    if (!config) {
      buckets.delete(key);
      continue;
    }
    const maxAge = config.windowMs + config.cooldownMs;
    const fresh = state.timestamps.filter(t => now - t < maxAge);
    if (fresh.length === 0 && (!state.cooldownUntil || now >= state.cooldownUntil)) {
      buckets.delete(key);
    }
  }
}

// ── Core API ──

/**
 * Check whether an action is allowed and record the attempt.
 *
 * @param action     - Rate limit bucket name (e.g. 'login', 'signup')
 * @param identifier - Per-entity key (e.g. email address, userId, 'global')
 */
export function checkRateLimit(
  action: RateLimitAction,
  identifier: string,
): RateLimitResult {
  maybeCleanup();

  const config = RATE_LIMITS[action];
  const key = `${action}:${identifier}`;
  const now = Date.now();

  let state = buckets.get(key);
  if (!state) {
    state = { timestamps: [], cooldownUntil: null };
    buckets.set(key, state);
  }

  // 1. If in cooldown, block immediately
  if (state.cooldownUntil && now < state.cooldownUntil) {
    const retryAfterMs = state.cooldownUntil - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
      message: `Rate limit exceeded. Please try again in ${formatDuration(retryAfterMs)}.`,
    };
  }

  // 2. If cooldown has expired, reset
  if (state.cooldownUntil && now >= state.cooldownUntil) {
    state.timestamps = [];
    state.cooldownUntil = null;
  }

  // 3. Prune timestamps outside the sliding window
  state.timestamps = state.timestamps.filter(t => now - t < config.windowMs);

  // 4. Check if the limit would be exceeded
  if (state.timestamps.length >= config.maxAttempts) {
    state.cooldownUntil = now + config.cooldownMs;

    console.warn(`[RATE_LIMIT] ${action} exceeded by ${identifier} (${state.timestamps.length} in ${config.windowMs / 1000}s)`);

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: config.cooldownMs,
      message: `Too many attempts. Please try again in ${formatDuration(config.cooldownMs)}.`,
    };
  }

  // 5. Record this attempt
  state.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.maxAttempts - state.timestamps.length,
    retryAfterMs: 0,
    message: '',
  };
}

/**
 * Read-only check — does NOT record an attempt.
 * Useful for disabling buttons in the UI before the user clicks.
 */
export function peekRateLimit(
  action: RateLimitAction,
  identifier: string,
): RateLimitResult {
  const config = RATE_LIMITS[action];
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const state = buckets.get(key);

  if (!state) {
    return { allowed: true, remaining: config.maxAttempts, retryAfterMs: 0, message: '' };
  }

  if (state.cooldownUntil && now < state.cooldownUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: state.cooldownUntil - now,
      message: `Rate limit exceeded. Please try again in ${formatDuration(state.cooldownUntil - now)}.`,
    };
  }

  const active = state.timestamps.filter(t => now - t < config.windowMs);
  const remaining = config.maxAttempts - active.length;

  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    retryAfterMs: remaining > 0 ? 0 : config.cooldownMs,
    message: remaining > 0 ? '' : 'Rate limit reached.',
  };
}

/**
 * Reset a specific rate limit bucket.
 * Call after a successful login to clear the failed-attempt counter.
 */
export function resetRateLimit(action: RateLimitAction, identifier: string): void {
  buckets.delete(`${action}:${identifier}`);
}

// ── Helpers ──

function formatDuration(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
