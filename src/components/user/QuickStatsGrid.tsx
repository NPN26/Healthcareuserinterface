import { Heart, Activity, Droplet, Wind, Footprints, Moon, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Biomarker, getBiomarkerLabel, getBiomarkerUnit } from '../../utils/mockData';

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface QuickStatsGridProps {
  biomarkers: Biomarker[];
  getLatestBiomarker: (type: Biomarker['type']) => Biomarker | undefined;
  getTrend: (type: Biomarker['type']) => 'up' | 'down' | 'stable';
  onCardClick: (type: Biomarker['type']) => void;
}

export function QuickStatsGrid({ biomarkers, getLatestBiomarker, getTrend, onCardClick }: QuickStatsGridProps) {
  const biomarkerCards = [
    { type: 'heartRate' as const, icon: Heart, color: 'text-red-500' },
    { type: 'bloodPressure' as const, icon: Activity, color: 'text-purple-500' },
    { type: 'glucose' as const, icon: Droplet, color: 'text-blue-500' },
    { type: 'oxygen' as const, icon: Wind, color: 'text-cyan-500' },
    { type: 'steps' as const, icon: Footprints, color: 'text-green-500' },
    { type: 'sleep' as const, icon: Moon, color: 'text-indigo-500' },
  ];

  // Helper to get today's total steps
  function getTodaysTotalSteps(): number {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = today.getMonth();
    const dd = today.getDate();
    return biomarkers
      .filter(b => b.type === 'steps' && (() => {
        const d = new Date(b.timestamp);
        return d.getFullYear() === yyyy && d.getMonth() === mm && d.getDate() === dd;
      })())
      .reduce((sum, b) => sum + b.value, 0);
  }

  // Helper to get today's total sleep
  function getTodaysTotalSleep(): number {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = today.getMonth();
    const dd = today.getDate();
    return biomarkers
      .filter(b => b.type === 'sleep' && (() => {
        const d = new Date(b.timestamp);
        return d.getFullYear() === yyyy && d.getMonth() === mm && d.getDate() === dd;
      })())
      .reduce((sum, b) => sum + b.value, 0);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {biomarkerCards.map(({ type, icon: Icon, color }) => {
        const latest = getLatestBiomarker(type);
        const trend = getTrend(type);
        const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

        return (
          <Card 
            key={type} 
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onCardClick(type)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br from-background to-accent ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{getBiomarkerLabel(type)}</p>
                  <p className="mt-1">
                    {type === 'bloodPressure' && latest 
                      ? `${latest.systolic}/${latest.diastolic}`
                      : type === 'steps' 
                      ? Math.round(getTodaysTotalSteps())
                      : type === 'sleep'
                      ? Math.round(getTodaysTotalSleep()) + ' hrs'
                      : latest?.value.toFixed(1) || '--'}
                    <span className="text-sm text-muted-foreground ml-1">
                      {getBiomarkerUnit(type)}
                    </span>
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-muted-foreground'
              }`}>
                <TrendIcon className="w-4 h-4" />
              </div>
            </div>
            {latest?.isFaulty && (
              <Badge variant="destructive" className="mt-3">Faulty Reading</Badge>
            )}
            {latest && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Updated {formatTimeAgo(latest.timestamp)}</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
