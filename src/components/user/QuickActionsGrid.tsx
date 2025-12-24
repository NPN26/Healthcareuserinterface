import { Plus, FileText, Bot, Target } from 'lucide-react';
import { Button } from '../ui/button';

interface QuickActionsGridProps {
  onLogReading: () => void;
  onSetGoals: () => void;
  onReport: () => void;
  onAIAssistant: () => void;
}

export function QuickActionsGrid({ onLogReading, onSetGoals, onReport, onAIAssistant }: QuickActionsGridProps) {
  const quickActions = [
    { label: 'Log Reading', icon: Plus, action: onLogReading },
    { label: 'Set Goals', icon: Target, action: onSetGoals },
    { label: 'Report', icon: FileText, action: onReport },
    { label: 'AI Assistant', icon: Bot, action: onAIAssistant },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {quickActions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          onClick={action.action}
          className="h-auto flex-col gap-2 p-4"
        >
          <action.icon className="w-5 h-5" />
          <span className="text-xs">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
