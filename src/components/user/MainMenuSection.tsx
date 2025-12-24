import { LayoutDashboard, TrendingUpIcon, Smartphone } from 'lucide-react';
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar';

interface MainMenuSectionProps {
  activeView: string;
  onViewChange: (view: 'overview' | 'trends' | 'devices') => void;
}

export function MainMenuSection({ activeView, onViewChange }: MainMenuSectionProps) {
  const mainMenuItems = [
    { id: 'overview' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trends' as const, label: 'Analytics', icon: TrendingUpIcon },
    { id: 'devices' as const, label: 'My Devices', icon: Smartphone },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {mainMenuItems.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                isActive={activeView === item.id}
                onClick={() => onViewChange(item.id)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
