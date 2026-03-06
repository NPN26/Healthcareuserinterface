import { useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Flame, Crown, Star, Sparkles, Zap, Award, CalendarCheck } from 'lucide-react';

export const STREAK_MILESTONES = [7, 30, 90, 365] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

const MILESTONE_CONFIG: Record<StreakMilestone, { title: string; emoji: string; color: string; description: string; icon: typeof Flame }> = {
  7:   { title: 'Week Warrior', emoji: '🔥', color: 'from-orange-500 to-red-500', description: '7 days of consistent health tracking!', icon: Flame },
  30:  { title: 'Monthly Champion', emoji: '🏆', color: 'from-amber-500 to-yellow-500', description: '30-day streak! An entire month of dedication.', icon: Crown },
  90:  { title: 'Quarterly Legend', emoji: '⭐', color: 'from-purple-500 to-indigo-500', description: '90 consecutive days! You\'re unstoppable.', icon: Star },
  365: { title: 'Year of Health', emoji: '👑', color: 'from-emerald-500 to-teal-500', description: 'A full year streak! Truly extraordinary commitment.', icon: Award },
};

interface StreakCelebrationProps {
  milestone: StreakMilestone | null;
  currentStreak: number;
  onDismiss: () => void;
}

export function StreakCelebration({ milestone, currentStreak, onDismiss }: StreakCelebrationProps) {
  const [show, setShow] = useState(false);

  const fireConfetti = useCallback((ms: StreakMilestone) => {
    const intensity = ms >= 90 ? 150 : ms >= 30 ? 100 : 60;
    confetti({
      particleCount: intensity,
      spread: 80,
      origin: { y: 0.5 },
      colors: ms >= 365 ? ['#10b981', '#34d399', '#fbbf24', '#f59e0b'] : ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'],
    });
    if (ms >= 30) {
      setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 45, origin: { x: 0, y: 0.65 } }), 500);
      setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 45, origin: { x: 1, y: 0.65 } }), 700);
    }
  }, []);

  useEffect(() => {
    if (milestone) {
      setShow(true);
      fireConfetti(milestone);
    }
  }, [milestone, fireConfetti]);

  const handleClose = () => {
    setShow(false);
    onDismiss();
  };

  if (!milestone) return null;
  const config = MILESTONE_CONFIG[milestone];
  const Icon = config.icon;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md text-center border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
        {/* Gradient background banner */}
        <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-br ${config.color} opacity-10`} />
        <div className="relative flex flex-col items-center gap-4 py-6">
          {/* Icon badge */}
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}>
            <Icon className="w-10 h-10 text-white" />
          </div>

          <Badge className="px-3 py-1 text-lg" variant="outline">
            {config.emoji} {config.title}
          </Badge>

          <h2 className="text-2xl font-bold">{milestone}-Day Streak!</h2>
          <p className="text-muted-foreground text-sm max-w-xs">{config.description}</p>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 dark:bg-orange-900 rounded-full">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">{currentStreak} days</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900 rounded-full">
              <Zap className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Keep going!</span>
            </div>
          </div>

          <Button className={`mt-3 bg-gradient-to-r ${config.color} text-white border-0`} onClick={handleClose}>
            Continue my streak!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Calculate the current streak from biomarker data.
 * A "streak day" = any day with at least one biomarker reading.
 */
export function calculateStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;

  const days = new Set<string>();
  timestamps.forEach(ts => {
    const d = new Date(ts);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });

  const sortedDays = Array.from(days)
    .map(d => {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m, day);
    })
    .sort((a, b) => b.getTime() - a.getTime()); // most recent first

  let streak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if most recent day is today or yesterday
  const latestDay = sortedDays[0];
  latestDay.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - latestDay.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 1) return 0; // streak broken

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = sortedDays[i - 1];
    const curr = sortedDays[i];
    prev.setHours(0, 0, 0, 0);
    curr.setHours(0, 0, 0, 0);
    const gap = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (gap <= 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Check if the current streak has just hit a milestone.
 * Uses localStorage to avoid re-celebrating the same milestone.
 */
export function checkStreakMilestone(userId: string, streak: number): StreakMilestone | null {
  const storageKey = `streakMilestones_${userId}`;
  const celebrated = JSON.parse(localStorage.getItem(storageKey) || '[]') as number[];

  for (const ms of STREAK_MILESTONES) {
    if (streak >= ms && !celebrated.includes(ms)) {
      celebrated.push(ms);
      localStorage.setItem(storageKey, JSON.stringify(celebrated));
      return ms;
    }
  }
  return null;
}
