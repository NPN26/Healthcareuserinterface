import { useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Trophy, Star, Sparkles, PartyPopper } from 'lucide-react';

interface GoalCelebrationProps {
  /** When set, the celebration triggers for this goal label */
  goalLabel: string | null;
  onDismiss: () => void;
}

export function GoalCelebration({ goalLabel, onDismiss }: GoalCelebrationProps) {
  const [show, setShow] = useState(false);

  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // Big burst in the middle
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.55 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
      });
    }, 300);
  }, []);

  useEffect(() => {
    if (goalLabel) {
      setShow(true);
      fireConfetti();
    }
  }, [goalLabel, fireConfetti]);

  const handleClose = () => {
    setShow(false);
    onDismiss();
  };

  if (!goalLabel) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md text-center border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-b from-white to-emerald-50 dark:from-gray-900 dark:to-emerald-950">
        <div className="flex flex-col items-center gap-4 py-6">
          {/* Animated trophy icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg animate-bounce">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-amber-400 animate-pulse" />
            <Star className="absolute -bottom-1 -left-1 w-5 h-5 text-emerald-500 animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            Congratulations! 🎉
          </h2>

          <p className="text-muted-foreground text-sm max-w-xs">
            You've achieved your <span className="font-semibold text-foreground">{goalLabel}</span> goal! 
            Keep up the amazing work on your health journey.
          </p>

          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900 rounded-full">
            <PartyPopper className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Goal Complete - 100%</span>
          </div>

          <Button className="mt-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleClose}>
            Awesome, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
