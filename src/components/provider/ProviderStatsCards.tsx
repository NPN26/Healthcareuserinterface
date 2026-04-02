import { Card } from '../ui/card';
import { Users, TrendingUp, AlertTriangle, Activity } from 'lucide-react';

interface ProviderStatsCardsProps {
  totalPatients: number;
  criticalPatients: number;
  criticalAlerts: number;
  activeMonitoring: number;
  totalReadings: number;
}

export function ProviderStatsCards({
  totalPatients,
  criticalPatients,
  criticalAlerts,
  activeMonitoring,
  totalReadings,
}: ProviderStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Patients</p>
            <p className="text-2xl text-gray-900">{totalPatients}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Critical Alerts</p>
            <p className="text-2xl text-gray-900">{criticalAlerts}</p>
            {criticalPatients > 0 && (
              <p className="text-xs text-red-600 mt-1">{criticalPatients} patient{criticalPatients > 1 ? 's' : ''} affected</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Active Monitoring</p>
            <p className="text-2xl text-gray-900">{activeMonitoring}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900">
            <Activity className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Readings</p>
            <p className="text-2xl text-gray-900">{totalReadings.toLocaleString()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
