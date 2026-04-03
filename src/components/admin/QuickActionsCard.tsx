import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Activity, Trash2 } from 'lucide-react';

interface QuickActionsCardProps {
  onResetDevices: () => void;
  onClearAlerts: () => void;
}

export function QuickActionsCard({
  onResetDevices,
  onClearAlerts,
}: QuickActionsCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onResetDevices} variant="outline" className="truncate">
          <Activity className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">Reset Devices</span>
        </Button>
        <Button onClick={onClearAlerts} variant="outline" className="truncate">
          <Trash2 className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">Clear Alerts</span>
        </Button>
      </div>
    </Card>
  );
}
