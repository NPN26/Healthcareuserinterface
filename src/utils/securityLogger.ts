/**
 * Security Logger — structured logging for authentication attempts,
 * API errors, and unusual traffic pattern detection.
 *
 * In production, security events are persisted to the Supabase `audit_logs`
 * table. A lightweight in-memory ring buffer captures recent events for
 * anomaly detection (burst auth failures, rapid-fire requests, etc.).
 *
 * All log entries are structured JSON so they can be ingested by any
 * external SIEM / log-aggregation service in the future.
 */

import { supabase } from './supabase';

// ── Types ──

export type SecurityEventLevel = 'info' | 'warn' | 'error' | 'critical';

export type SecurityEventCategory =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_SIGNUP'
  | 'AUTH_SIGNUP_FAILED'
  | 'AUTH_LOGOUT'
  | 'AUTH_LOCKOUT'
  | 'AUTH_SESSION_INVALID'
  | 'API_ERROR'
  | 'ADMIN_ACTION'
  | 'ANOMALY_BURST_AUTH_FAILURES'
  | 'ANOMALY_RAPID_REQUESTS'
  | 'ANOMALY_UNUSUAL_HOUR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'BOT_DETECTED'
  | 'HTTPS_REDIRECT';

export interface SecurityEvent {
  timestamp: string;
  level: SecurityEventLevel;
  category: SecurityEventCategory;
  message: string;
  userId?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

// ── In-memory ring buffer for anomaly detection ──

const MAX_BUFFER_SIZE = 500;
const eventBuffer: SecurityEvent[] = [];

function pushEvent(event: SecurityEvent): void {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }
}

// ── Core logging function ──

function buildEvent(
  level: SecurityEventLevel,
  category: SecurityEventCategory,
  message: string,
  extra?: { userId?: string; email?: string; metadata?: Record<string, unknown> }
): SecurityEvent {
  return {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...extra,
  };
}

/**
 * Log a security event. The event is:
 * 1. Stored in the in-memory ring buffer (for anomaly checks).
 * 2. Written to `console.warn` / `console.error` so it surfaces in
 *    Vercel / any log drain attached to the hosting platform.
 * 3. Persisted to the `audit_logs` table for critical/warn events.
 */
export function logSecurityEvent(
  level: SecurityEventLevel,
  category: SecurityEventCategory,
  message: string,
  extra?: { userId?: string; email?: string; metadata?: Record<string, unknown> }
): void {
  const event = buildEvent(level, category, message, extra);
  pushEvent(event);

  // Structured console output for log drains (Vercel, Datadog, etc.)
  const logPayload = JSON.stringify(event);
  if (level === 'critical' || level === 'error') {
    console.error(`[SECURITY] ${logPayload}`);
  } else if (level === 'warn') {
    console.warn(`[SECURITY] ${logPayload}`);
  }
  // 'info' events stay in the buffer only — avoids console noise.

  // Persist warn+ events to the database (fire-and-forget)
  if (level !== 'info') {
    persistToAuditLog(event).catch(() => {
      // Swallow — we already logged to console as a fallback.
    });
  }
}

// ── Persist to Supabase audit_logs ──

async function persistToAuditLog(event: SecurityEvent): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      admin_id: event.userId || null,
      action: event.category,
      target_entity_type: 'security_event',
      timestamp: event.timestamp,
      details: JSON.stringify({
        level: event.level,
        message: event.message,
        email: event.email,
        ...event.metadata,
      }),
    });
  } catch {
    // Best-effort — console is the fallback.
  }
}

// ── Convenience helpers ──

export function logAuthSuccess(userId: string, email: string): void {
  logSecurityEvent('info', 'AUTH_LOGIN', `Successful login for ${email}`, { userId, email });
  // After a successful login, run anomaly checks
  checkForAnomalies(email);
}

export function logAuthFailure(email: string, reason?: string): void {
  logSecurityEvent('warn', 'AUTH_LOGIN_FAILED', `Failed login for ${email}: ${reason || 'invalid credentials'}`, { email, metadata: { reason } });
  checkBurstAuthFailures(email);
}

export function logAuthLockout(email: string, durationMs: number): void {
  logSecurityEvent('warn', 'AUTH_LOCKOUT', `Account locked for ${email} — ${Math.ceil(durationMs / 60_000)}min`, {
    email,
    metadata: { durationMs },
  });
}

export function logSignup(userId: string, email: string): void {
  logSecurityEvent('info', 'AUTH_SIGNUP', `New signup: ${email}`, { userId, email });
}

export function logSignupFailure(email: string, reason: string): void {
  logSecurityEvent('warn', 'AUTH_SIGNUP_FAILED', `Signup failed for ${email}: ${reason}`, { email, metadata: { reason } });
}

export function logLogout(userId: string): void {
  logSecurityEvent('info', 'AUTH_LOGOUT', 'User logged out', { userId });
}

export function logSessionInvalid(reason: string): void {
  logSecurityEvent('warn', 'AUTH_SESSION_INVALID', `Invalid session detected: ${reason}`);
}

export function logApiError(fnName: string, error: unknown, userId?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  logSecurityEvent('error', 'API_ERROR', `API error in ${fnName}: ${message}`, {
    userId,
    metadata: { function: fnName },
  });
}

export function logAdminAction(
  adminId: string,
  action: string,
  targetId?: string,
  details?: Record<string, unknown>
): void {
  logSecurityEvent('info', 'ADMIN_ACTION', `Admin ${action} on ${targetId || 'n/a'}`, {
    userId: adminId,
    metadata: { action, targetId, ...details },
  });
}

export function logHttpsRedirect(): void {
  logSecurityEvent('warn', 'HTTPS_REDIRECT', 'Redirected insecure HTTP request to HTTPS');
}

// ── Anomaly Detection ──

/**
 * Check for burst authentication failures from the same email
 * within a short window (more than 3 failures in 60 seconds).
 */
function checkBurstAuthFailures(email: string): void {
  const windowMs = 60_000;
  const threshold = 3;
  const cutoff = new Date(Date.now() - windowMs).toISOString();

  const recentFailures = eventBuffer.filter(
    (e) =>
      e.category === 'AUTH_LOGIN_FAILED' &&
      e.email === email &&
      e.timestamp > cutoff
  );

  if (recentFailures.length >= threshold) {
    logSecurityEvent('critical', 'ANOMALY_BURST_AUTH_FAILURES', `Burst auth failures detected: ${recentFailures.length} failures for ${email} in 60s`, {
      email,
      metadata: { count: recentFailures.length, windowMs },
    });
  }
}

/**
 * Check for unusual login hour (between 1 AM and 5 AM local time).
 */
function checkForAnomalies(email: string): void {
  const hour = new Date().getHours();
  if (hour >= 1 && hour < 5) {
    logSecurityEvent('warn', 'ANOMALY_UNUSUAL_HOUR', `Login during unusual hour (${hour}:00) for ${email}`, {
      email,
      metadata: { hour },
    });
  }
}

/**
 * Track API request rate. Call this on every API function invocation.
 * If a single user exceeds `threshold` calls within `windowMs`,
 * flag it as anomalous rapid traffic.
 */
const requestTimestamps = new Map<string, number[]>();

export function trackApiRequest(userId: string): void {
  const windowMs = 10_000;
  const threshold = 50;
  const now = Date.now();

  const timestamps = (requestTimestamps.get(userId) || []).filter(
    (t) => now - t < windowMs
  );
  timestamps.push(now);
  requestTimestamps.set(userId, timestamps);

  if (timestamps.length >= threshold) {
    logSecurityEvent('critical', 'ANOMALY_RAPID_REQUESTS', `Rapid API traffic: ${timestamps.length} requests in ${windowMs / 1000}s from user ${userId}`, {
      userId,
      metadata: { count: timestamps.length, windowMs },
    });
    // Reset to avoid spamming the same alert
    requestTimestamps.set(userId, []);
  }
}

/**
 * Return recent security events from the in-memory buffer.
 * Useful for admin dashboard display without a DB round-trip.
 */
export function getRecentSecurityEvents(count: number = 50): SecurityEvent[] {
  return eventBuffer.slice(-count).reverse();
}
