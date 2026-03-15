import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Trophy, Award, Target, Heart, Zap, Star, Crown, Sparkles, Lock } from 'lucide-react';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: 'health' | 'activity' | 'consistency' | 'milestone' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  requirement: number;
}

interface AchievementsPageProps {
  userId: string;
}

const achievementsList: Achievement[] = [
  // Health Achievements
  {
    id: 'first-reading',
    title: 'First Step',
    description: 'Record your first health reading',
    icon: Heart,
    category: 'health',
    rarity: 'common',
    unlocked: false,
    requirement: 1
  },
  {
    id: 'healthy-heart',
    title: 'Healthy Heart',
    description: 'Maintain healthy heart rate for 7 days',
    icon: Heart,
    category: 'health',
    rarity: 'rare',
    unlocked: false,
    requirement: 7
  },
  {
    id: 'perfect-vitals',
    title: 'Perfect Vitals',
    description: 'All readings in healthy range for 30 days',
    icon: Star,
    category: 'health',
    rarity: 'epic',
    unlocked: false,
    requirement: 30
  },
  
  // Activity Achievements
  {
    id: 'step-master',
    title: 'Step Master',
    description: 'Reach 10,000 steps in a single day',
    icon: Zap,
    category: 'activity',
    rarity: 'common',
    unlocked: false,
    requirement: 10000
  },
  {
    id: 'marathon-walker',
    title: 'Marathon Walker',
    description: 'Walk 100,000 steps total',
    icon: Trophy,
    category: 'activity',
    rarity: 'rare',
    unlocked: false,
    requirement: 100000
  },
  {
    id: 'million-steps',
    title: 'Million Steps',
    description: 'Reach 1 million total steps',
    icon: Crown,
    category: 'activity',
    rarity: 'legendary',
    unlocked: false,
    requirement: 1000000
  },

  // Consistency Achievements
  {
    id: 'week-streak',
    title: 'Week Warrior',
    description: 'Log readings for 7 consecutive days',
    icon: Target,
    category: 'consistency',
    rarity: 'common',
    unlocked: false,
    requirement: 7
  },
  {
    id: 'month-streak',
    title: 'Monthly Dedication',
    description: 'Log readings for 30 consecutive days',
    icon: Award,
    category: 'consistency',
    rarity: 'rare',
    unlocked: false,
    requirement: 30
  },
  {
    id: 'year-streak',
    title: 'Year Champion',
    description: 'Log readings for 365 consecutive days',
    icon: Crown,
    category: 'consistency',
    rarity: 'legendary',
    unlocked: false,
    requirement: 365
  },

  // Milestone Achievements
  {
    id: 'hundred-readings',
    title: 'Century Club',
    description: 'Record 100 total readings',
    icon: Trophy,
    category: 'milestone',
    rarity: 'rare',
    unlocked: false,
    requirement: 100
  },
  {
    id: 'thousand-readings',
    title: 'Data Collector',
    description: 'Record 1,000 total readings',
    icon: Star,
    category: 'milestone',
    rarity: 'epic',
    unlocked: false,
    requirement: 1000
  },

  // Special Achievements
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Log a reading before 6 AM',
    icon: Sparkles,
    category: 'special',
    rarity: 'rare',
    unlocked: false,
    requirement: 1
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Log a reading after midnight',
    icon: Sparkles,
    category: 'special',
    rarity: 'rare',
    unlocked: false,
    requirement: 1
  },
  {
    id: 'wellness-champion',
    title: 'Wellness Champion',
    description: 'Complete all achievements',
    icon: Crown,
    category: 'special',
    rarity: 'legendary',
    unlocked: false,
    requirement: 14
  },
];

export function AchievementsPage({ userId }: AchievementsPageProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [filter, setFilter] = useState<'all' | Achievement['category']>('all');
  const [selectedRarity, setSelectedRarity] = useState<'all' | Achievement['rarity']>('all');

  useEffect(() => {
    loadAchievements();
  }, [userId]);

  const loadAchievements = () => {
    // Load from localStorage or database
    const stored = localStorage.getItem(`achievements_${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setAchievements(parsed.map((a: any) => ({
        ...a,
        unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : undefined
      })));
    } else {
      setAchievements(achievementsList);
    }
  };

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

  const getCategoryIcon = (category: Achievement['category']) => {
    switch (category) {
      case 'health':
        return Heart;
      case 'activity':
        return Zap;
      case 'consistency':
        return Target;
      case 'milestone':
        return Trophy;
      case 'special':
        return Sparkles;
      default:
        return Award;
    }
  };

  const filteredAchievements = achievements
    .filter(a => filter === 'all' || a.category === filter)
    .filter(a => selectedRarity === 'all' || a.rarity === selectedRarity);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100);

  const categories: Array<{ id: 'all' | Achievement['category']; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'health', label: 'Health' },
    { id: 'activity', label: 'Activity' },
    { id: 'consistency', label: 'Consistency' },
    { id: 'milestone', label: 'Milestones' },
    { id: 'special', label: 'Special' },
  ];

  const rarities: Array<{ id: 'all' | Achievement['rarity']; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'common', label: 'Common' },
    { id: 'rare', label: 'Rare' },
    { id: 'epic', label: 'Epic' },
    { id: 'legendary', label: 'Legendary' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <Card className="p-6 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950 dark:via-yellow-950 dark:to-orange-950 border-2 border-amber-200 dark:border-amber-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 flex items-center justify-center shadow-lg shrink-0">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold">Achievements</h3>
              <p className="text-sm text-muted-foreground">Track your wellness milestones</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-3xl sm:text-4xl font-bold text-transparent text-center">
              {unlockedCount}/{totalCount}
            </div>
            <p className="text-sm text-muted-foreground">{completionPercentage}% Complete</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 transition-all duration-500 relative overflow-hidden"
            style={{ width: `${completionPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="flex-1 p-4">
          <label className="text-sm font-medium mb-2 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === cat.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex-1 p-4">
          <label className="text-sm font-medium mb-2 block">Rarity</label>
          <div className="flex flex-wrap gap-2">
            {rarities.map((rar) => (
              <button
                key={rar.id}
                onClick={() => setSelectedRarity(rar.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedRarity === rar.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {rar.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <Card
              key={achievement.id}
              className={`group relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${
                achievement.unlocked
                  ? 'border-2 shadow-lg hover:scale-105'
                  : 'opacity-60 hover:opacity-80'
              }`}
              style={{
                borderColor: achievement.unlocked ? 'currentColor' : undefined,
              }}
            >
              {/* Rarity Gradient Background */}
              {achievement.unlocked && (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(
                    achievement.rarity
                  )} opacity-5 group-hover:opacity-10 transition-opacity`}
                ></div>
              )}

              <div className="relative p-6">
                {/* Icon */}
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                      achievement.unlocked
                        ? `bg-gradient-to-br ${getRarityColor(achievement.rarity)} shadow-lg`
                        : 'bg-gray-300 dark:bg-gray-700'
                    } transition-transform group-hover:scale-110 group-hover:rotate-6`}
                  >
                    {achievement.unlocked ? (
                      <Icon className="w-8 h-8 text-white" />
                    ) : (
                      <Lock className="w-8 h-8 text-gray-500" />
                    )}
                  </div>

                  {/* Rarity Badge */}
                  <Badge
                    className={`${
                      achievement.unlocked
                        ? `bg-gradient-to-r ${getRarityColor(achievement.rarity)} text-white border-0`
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    {achievement.rarity}
                  </Badge>
                </div>

                {/* Title & Description */}
                <h4 className="font-bold text-lg mb-2">{achievement.title}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {achievement.description}
                </p>

                {/* Progress or Unlock Date */}
                {achievement.unlocked ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      Unlocked{' '}
                      {achievement.unlockedAt?.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {achievement.progress || 0}/{achievement.requirement}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                        style={{
                          width: `${
                            ((achievement.progress || 0) / achievement.requirement) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Shine Effect on Hover */}
              {achievement.unlocked && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-1000"></div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <Card className="p-12 text-center">
          <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No achievements found with these filters.</p>
        </Card>
      )}
    </div>
  );
}
