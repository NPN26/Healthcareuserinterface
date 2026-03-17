/**
 * Bot / Automation Detection — lightweight, heuristic-based analysis
 * of user interaction patterns to identify automated scripts.
 *
 * Attaches passive event listeners at startup and accumulates signals.
 * Call `getBotScore()` or `isLikelyBot()` before sensitive operations
 * (signup, bulk export, etc.) to screen for headless browsers and
 * scripted automation.
 */

// NOTE: This module must NOT import from securityLogger (which imports
// supabase — circular dependency risk). Bot detections are logged via
// console.warn here; callers should use securityLogger for persistence.

// ── Interaction signals ──

interface InteractionSignals {
  mouseMovements: number;
  keystrokes: number;
  touchEvents: number;
  firstInteractionAt: number | null;
  lastInteractionAt: number | null;
  clickTimings: number[];
}

const signals: InteractionSignals = {
  mouseMovements: 0,
  keystrokes: 0,
  touchEvents: 0,
  firstInteractionAt: null,
  lastInteractionAt: null,
  clickTimings: [],
};

const MAX_CLICK_TIMINGS = 20;
let listenersAttached = false;

/**
 * Attach passive event listeners to the document.
 * Call once at app startup (e.g. in main.tsx).
 */
export function initBotDetection(): void {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;

  const recordInteraction = () => {
    const now = Date.now();
    if (!signals.firstInteractionAt) signals.firstInteractionAt = now;
    signals.lastInteractionAt = now;
  };

  document.addEventListener('mousemove', () => {
    signals.mouseMovements++;
    recordInteraction();
  }, { passive: true });

  document.addEventListener('keydown', () => {
    signals.keystrokes++;
    recordInteraction();
  }, { passive: true });

  document.addEventListener('touchstart', () => {
    signals.touchEvents++;
    recordInteraction();
  }, { passive: true });

  document.addEventListener('click', () => {
    const now = Date.now();
    signals.clickTimings.push(now);
    if (signals.clickTimings.length > MAX_CLICK_TIMINGS) {
      signals.clickTimings.shift();
    }
    recordInteraction();
  }, { passive: true });
}

// ── Scoring ──

export interface BotScore {
  /** 0 (definitely human) to 100 (definitely bot) */
  score: number;
  reasons: string[];
  isLikelyBot: boolean;
}

/**
 * Compute a bot-likelihood score based on accumulated interaction signals.
 */
export function getBotScore(): BotScore {
  const reasons: string[] = [];
  let score = 0;

  // 1. No interaction signals at all → very likely headless
  const totalInteractions = signals.mouseMovements + signals.keystrokes + signals.touchEvents;
  if (totalInteractions === 0) {
    score += 40;
    reasons.push('No user interaction detected');
  } else if (signals.mouseMovements === 0 && signals.touchEvents === 0) {
    score += 15;
    reasons.push('No mouse or touch events detected');
  }

  // 2. Click timing regularity — bots click at very consistent intervals
  if (signals.clickTimings.length >= 5) {
    const intervals: number[] = [];
    for (let i = 1; i < signals.clickTimings.length; i++) {
      intervals.push(signals.clickTimings[i] - signals.clickTimings[i - 1]);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    if (cv < 0.1 && mean < 500) {
      score += 30;
      reasons.push('Click timing is suspiciously regular');
    } else if (cv < 0.2 && mean < 300) {
      score += 20;
      reasons.push('Click timing has low variance');
    }
  }

  // 3. Very fast first interaction after page load
  if (signals.firstInteractionAt) {
    const pageLoadTime = typeof performance !== 'undefined' && performance.timeOrigin
      ? performance.timeOrigin
      : Date.now();
    const timeToFirst = signals.firstInteractionAt - pageLoadTime;
    if (timeToFirst < 500 && timeToFirst >= 0) {
      score += 20;
      reasons.push('Interaction began suspiciously fast after page load');
    }
  }

  // 4. WebDriver / automation flags
  if (typeof navigator !== 'undefined' && (navigator as any).webdriver === true) {
    score += 30;
    reasons.push('WebDriver flag detected');
  }

  score = Math.min(score, 100);
  const isLikelyBot = score >= 70;

  if (isLikelyBot) {
    console.warn(`[BOT_DETECTED] Score: ${score}, reasons: ${reasons.join(', ')}`);
  }

  return { score, reasons, isLikelyBot };
}

/**
 * Quick boolean check for gating sensitive actions.
 */
export function isLikelyBot(): boolean {
  return getBotScore().isLikelyBot;
}
