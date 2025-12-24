import { Heart, Activity, Footprints, Flame } from 'lucide-react';
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar';
import { Biomarker } from '../../utils/mockData';

interface HealthMetricsSectionProps {
  activeView: string;
  onViewChange: (view: 'heartRate' | 'bloodPressure' | 'activities' | 'calories') => void;
  getLatestBiomarker: (type: Biomarker['type']) => Biomarker | undefined;
}

export function HealthMetricsSection({ activeView, onViewChange, getLatestBiomarker }: HealthMetricsSectionProps) {
  const healthStatusItems = [
    { id: 'heartRate' as const, label: 'Heart Rate', icon: Heart, color: 'text-red-500', unit: 'bpm' },
    { id: 'bloodPressure' as const, label: 'Blood Pressure', icon: Activity, color: 'text-purple-500', unit: 'mmHg' },
    { id: 'activities' as const, label: 'Activity', icon: Footprints, color: 'text-green-500', unit: 'steps' },
    { id: 'calories' as const, label: 'Calories', icon: Flame, color: 'text-orange-500', unit: 'kcal' },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Health Metrics</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {healthStatusItems.map((item) => {
            const latest = item.id === 'heartRate' 
              ? getLatestBiomarker('heartRate')
              : item.id === 'bloodPressure' 
              ? getLatestBiomarker('bloodPressure')
              : item.id === 'activities'
              ? getLatestBiomarker('steps')
              : null;

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={activeView === item.id}
                  onClick={() => onViewChange(item.id)}
                >
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span>{item.label}</span>
                  {latest && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {item.id === 'bloodPressure' && latest.systolic
                        ? `${latest.systolic}/${latest.diastolic}`
                        : item.id === 'calories'
                        ? '2.3k'
                        : latest.value?.toFixed(0)}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
