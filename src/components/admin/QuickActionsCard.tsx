import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { RefreshCw, AlertTriangle, Activity, Trash2 } from 'lucide-react';

interface QuickActionsCardProps {
  onGenerateData: () => void;
  onSimulateFaults: () => void;
  onResetDevices: () => void;
  onClearAlerts: () => void;
}

export function QuickActionsCard({
  onGenerateData,
  onSimulateFaults,
  onResetDevices,
  onClearAlerts,
}: QuickActionsCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button onClick={onGenerateData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Generate Data
        </Button>
        <Button onClick={onSimulateFaults} variant="outline">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Simulate Faults
        </Button>
        <Button onClick={onResetDevices} variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          Reset Devices
        </Button>
        <Button onClick={onClearAlerts} variant="outline">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear Alerts
        </Button>
      </div>
    </Card>
  );
}
