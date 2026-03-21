import { Activity } from 'lucide-react';
import { SidebarHeader } from '../ui/sidebar';

export function SidebarBranding() {
  return (
    <SidebarHeader className="border-b p-4 flex-shrink-0">
      <div className="flex items-center w-full">
        <div className="flex-1 basis-1/3 flex justify-center items-center">
          <img src="/images/healthsync_logo.svg" alt="HealthSync Logo" className="w-16 h-16" />
        </div>
        <div className="flex-1 basis-2/3">
          <p className="font-semibold">HealthSync</p>
          <p className="text-xs text-muted-foreground">Health Monitoring</p>
        </div>
      </div>
    </SidebarHeader>
  );
}
