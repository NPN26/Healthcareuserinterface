import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Trophy, Sparkles, Star } from 'lucide-react';
import { Achievement } from './AchievementsPage';

interface AchievementUnlockAnimationProps {
  achievement: Achievement;
  onClose: () => void;
}

export function AchievementUnlockAnimation({
  achievement,
  onClose,
}: AchievementUnlockAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [stage, setStage] = useState<'entrance' | 'display' | 'exit'>('entrance');

  useEffect(() => {
    // Entrance animation
    setTimeout(() => setIsVisible(true), 50);
    setTimeout(() => setStage('display'), 500);

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      setStage('exit');
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 500);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common':
        return 'from-gray-400 to-gray-600';
      case 'rare':
        return 'from-blue-400 to-blue-600';
      case 'epic':
        return 'from-purple-400 to-purple-600';
      case 'legendary':
        return 'from-yellow-400 via-orange-500 to-red-600';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityGlow = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common':
        return 'shadow-gray-500/50';
      case 'rare':
        return 'shadow-blue-500/50';
      case 'epic':
        return 'shadow-purple-500/50';
      case 'legendary':
        return 'shadow-yellow-500/50';
      default:
        return 'shadow-gray-500/50';
    }
  };

  const Icon = achievement.icon;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => {
        setStage('exit');
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }, 500);
      }}
    >
      {/* Backdrop with radial gradient */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-all duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Animated circles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`absolute rounded-full bg-gradient-to-r ${getRarityColor(
                achievement.rarity
              )} opacity-20 animate-float`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 100 + 50}px`,
                height: `${Math.random() * 100 + 50}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 3 + 3}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main card */}
      <Card
        className={`relative z-10 max-w-md w-full overflow-hidden transition-all duration-500 ${
          stage === 'entrance'
            ? 'scale-50 opacity-0 rotate-12'
            : stage === 'display'
            ? 'scale-100 opacity-100 rotate-0'
            : 'scale-110 opacity-0 -rotate-12'
        }`}
      >
        {/* Animated background gradient */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(
            achievement.rarity
          )} opacity-10 animate-gradient-shift`}
        />

        {/* Sparkle effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <Sparkles
              key={i}
              className="absolute text-yellow-400 animate-sparkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 20 + 10}px`,
                height: `${Math.random() * 20 + 10}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 2 + 1}s`,
              }}
            />
          ))}
        </div>

        <div className="relative p-8 text-center">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-400 animate-spin-slow" />
              <h3 className="text-lg font-semibold text-yellow-400 uppercase tracking-wider">
                Achievement Unlocked!
              </h3>
              <Star className="w-5 h-5 text-yellow-400 animate-spin-slow" />
            </div>
            <div
              className={`h-1 w-24 mx-auto bg-gradient-to-r ${getRarityColor(
                achievement.rarity
              )} rounded-full`}
            />
          </div>

          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div
              className={`relative w-32 h-32 rounded-2xl bg-gradient-to-br ${getRarityColor(
                achievement.rarity
              )} flex items-center justify-center shadow-2xl ${getRarityGlow(
                achievement.rarity
              )} animate-bounce-slow`}
            >
              {/* Rotating ring */}
              <div
                className={`absolute inset-0 rounded-2xl border-4 border-white/30 animate-spin-slow`}
              />
              <div
                className={`absolute inset-2 rounded-xl border-2 border-white/20 animate-spin-reverse`}
              />

              {/* Icon */}
              <Icon className="w-16 h-16 text-white relative z-10 drop-shadow-2xl" />

              {/* Pulse rings */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${getRarityColor(
                  achievement.rarity
                )} animate-ping opacity-75`}
              />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {achievement.title}
          </h2>

          {/* Rarity badge */}
          <div className="mb-4 flex justify-center">
            <span
              className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider bg-gradient-to-r ${getRarityColor(
                achievement.rarity
              )} text-white shadow-lg`}
            >
              {achievement.rarity}
            </span>
          </div>

          {/* Description */}
          <p className="text-muted-foreground mb-6">{achievement.description}</p>

          {/* Trophy footer */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span>Achievement added to your profile</span>
          </div>

          {/* Click to dismiss */}
          <p className="mt-4 text-xs text-muted-foreground opacity-60">
            Click anywhere to dismiss
          </p>
        </div>

        {/* Shine effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shine`}
          />
        </div>
      </Card>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-20px) scale(1.1);
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }

        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }

        .animate-gradient-shift {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }

        .animate-shine {
          animation: shine 3s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spin-slow 4s linear infinite;
        }

        .animate-spin-reverse {
          animation: spin-reverse 6s linear infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
