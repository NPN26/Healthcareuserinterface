import { Activity } from 'lucide-react';
import { SidebarHeader } from '../ui/sidebar';

export function SidebarBranding() {
  return (
    <SidebarHeader className="border-b p-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <img src="/images/healthsync_logo.svg" alt="HealthSync Logo" className="w-16 h-16 mx-auto mb-4" />
        <div>
          <p className="font-semibold">HealthSync</p>
          <p className="text-xs text-muted-foreground">Health Monitoring</p>
        </div>
      </div>
    </SidebarHeader>
  );
}
