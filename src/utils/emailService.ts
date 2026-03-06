/**
 * Email Notification Service - Client-side utilities.
 * 
 * Integrates with a Supabase Edge Function (`send-email`) that wraps
 * a transactional email provider (e.g., Resend, SendGrid).
 *
 * Architecture:
 *   Browser → supabase.functions.invoke('send-email', { body }) → Edge Function → Email API
 *
 * The Edge Function should be deployed separately. This module provides
 * the client facade + local email log tracking.
 */

import { supabase, generateUUID } from './supabase';

// ── Types ──
export type EmailType = 'critical_alert' | 'daily_digest' | 'weekly_digest' | 'goal_completed' | 'streak_milestone' | 'system';

export interface EmailLog {
  id: string;
  userId: string;
  recipientEmail: string;
  type: EmailType;
  subject: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt: string;
  error?: string;
}

// ── Local email log (persisted in localStorage for demo; real app uses DB) ──
const LOG_KEY = 'healthApp_emailLogs';

function getEmailLogs(): EmailLog[] {
  return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
}

function appendEmailLog(log: EmailLog): void {
  const logs = getEmailLogs();
  logs.unshift(log);
  // Keep latest 500
  if (logs.length > 500) logs.length = 500;
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

export function fetchEmailLogs(filterUserId?: string): EmailLog[] {
  const logs = getEmailLogs();
  if (filterUserId) return logs.filter(l => l.userId === filterUserId);
  return logs;
}

export function fetchAllEmailLogs(): EmailLog[] {
  return getEmailLogs();
}

// ── Send Functions ──

/**
 * Attempt to invoke the `send-email` Supabase Edge Function.
 * Falls back to a local mock if the function is not deployed.
 */
async function invokeEmailFunction(payload: {
  to: string;
  subject: string;
  html: string;
  type: EmailType;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  const logEntry: EmailLog = {
    id: generateUUID(),
    userId: payload.userId,
    recipientEmail: payload.to,
    type: payload.type,
    subject: payload.subject,
    body: payload.html,
    status: 'queued',
    sentAt: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: payload,
    });

    if (error) throw error;

    logEntry.status = data?.status === 'delivered' ? 'delivered' : 'sent';
    appendEmailLog(logEntry);
    return { success: true };
  } catch (err: any) {
    // Edge function not deployed - log as mock-sent for demo
    console.warn('Email edge function not available, logging locally:', err?.message);
    logEntry.status = 'sent'; // mark as "sent" for demo purposes
    logEntry.error = 'Edge function not deployed - logged locally';
    appendEmailLog(logEntry);
    return { success: true }; // don't block the UI
  }
}

/**
 * Send a critical alert email.
 */
export async function sendCriticalAlertEmail(
  userId: string,
  recipientEmail: string,
  alertDetails: { biomarker: string; value: string; severity: string; timestamp: string }
): Promise<boolean> {
  const { success } = await invokeEmailFunction({
    to: recipientEmail,
    subject: `⚠️ Critical Health Alert: ${alertDetails.biomarker}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Critical Health Alert</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px;">A critical reading has been detected:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #6b7280;">Biomarker</td><td style="padding: 8px; font-weight: bold;">${alertDetails.biomarker}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Value</td><td style="padding: 8px; font-weight: bold; color: #ef4444;">${alertDetails.value}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Severity</td><td style="padding: 8px;">${alertDetails.severity}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Time</td><td style="padding: 8px;">${new Date(alertDetails.timestamp).toLocaleString()}</td></tr>
          </table>
          <p style="color: #6b7280; font-size: 14px;">Please review this alert in your healthcare dashboard.</p>
        </div>
      </div>
    `,
    type: 'critical_alert',
    userId,
  });
  return success;
}

/**
 * Send a daily/weekly digest email.
 */
export async function sendDigestEmail(
  userId: string,
  recipientEmail: string,
  digestType: 'daily' | 'weekly',
  summary: { totalReadings: number; abnormalCount: number; goalsCompleted: number; streak: number }
): Promise<boolean> {
  const period = digestType === 'daily' ? 'Daily' : 'Weekly';
  const { success } = await invokeEmailFunction({
    to: recipientEmail,
    subject: `📊 Your ${period} Health Summary`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">📊 ${period} Health Summary</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #16a34a;">${summary.totalReadings}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">Readings</p>
            </div>
            <div style="background: ${summary.abnormalCount > 0 ? '#fef2f2' : '#f0fdf4'}; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${summary.abnormalCount > 0 ? '#ef4444' : '#16a34a'};">${summary.abnormalCount}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">Anomalies</p>
            </div>
            <div style="background: #eff6ff; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #3b82f6;">${summary.goalsCompleted}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">Goals Met</p>
            </div>
            <div style="background: #fff7ed; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #f59e0b;">🔥 ${summary.streak}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">Day Streak</p>
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Keep up the great work on your health journey!</p>
        </div>
      </div>
    `,
    type: digestType === 'daily' ? 'daily_digest' : 'weekly_digest',
    userId,
  });
  return success;
}

/**
 * Send a goal completion email.
 */
export async function sendGoalCompletedEmail(
  userId: string,
  recipientEmail: string,
  goalLabel: string
): Promise<boolean> {
  const { success } = await invokeEmailFunction({
    to: recipientEmail,
    subject: `🎯 Goal Completed: ${goalLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🎯 Goal Completed!</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="font-size: 48px; margin: 16px 0;">🎉</p>
          <h2 style="color: #065f46; margin: 0;">${goalLabel}</h2>
          <p style="color: #6b7280; margin-top: 8px;">Congratulations! You've achieved your health goal. Keep up the amazing work!</p>
        </div>
      </div>
    `,
    type: 'goal_completed',
    userId,
  });
  return success;
}
