import { Card } from '../ui/card';
import { AlertTriangle } from 'lucide-react';

interface SystemAlertsCardProps {
  faultyDevicesCount: number;
  criticalAlertsCount: number;
}

export function SystemAlertsCard({ faultyDevicesCount, criticalAlertsCount }: SystemAlertsCardProps) {
  if (faultyDevicesCount === 0 && criticalAlertsCount === 0) {
    return null;
  }

  return (
    <Card className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-950">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
        <div>
          <h3 className="text-foreground mb-2">System Alerts</h3>
          <ul className="space-y-1 text-sm text-red-700 dark:text-white">
            {faultyDevicesCount > 0 && (
              <li>
                • {faultyDevicesCount} device{faultyDevicesCount !== 1 ? 's' : ''} reporting faults
              </li>
            )}
            {criticalAlertsCount > 0 && (
              <li>
                • {criticalAlertsCount} critical alert{criticalAlertsCount !== 1 ? 's' : ''} requiring attention
              </li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}
