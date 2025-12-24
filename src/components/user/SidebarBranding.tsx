import { Activity } from 'lucide-react';
import { SidebarHeader } from '../ui/sidebar';

export function SidebarBranding() {
  return (
    <SidebarHeader className="border-b p-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold">HealthSync</p>
          <p className="text-xs text-muted-foreground">Health Monitoring</p>
        </div>
      </div>
    </SidebarHeader>
  );
}
