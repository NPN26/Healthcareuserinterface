import { AlertCircle } from 'lucide-react';
import { SidebarFooter } from '../ui/sidebar';
import { Alert } from '../../utils/mockData';

interface SidebarFooterAlertsProps {
  alerts: Alert[];
}

export function SidebarFooterAlerts({ alerts }: SidebarFooterAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <SidebarFooter className="border-t p-4 flex-shrink-0">
      <div className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs text-amber-900 dark:text-amber-300 font-medium">
          {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>
    </SidebarFooter>
  );
}
