import { Card } from '../ui/card';
import { Users, Activity, Database, AlertTriangle, Server } from 'lucide-react';

interface SystemStatus {
  uptime: string;
  activeUsers: number;
  totalDevices: number;
  dataPoints: number;
  lastBackup: string;
}

interface AdminStatsCardsProps {
  totalUsers: number;
  systemStatus: SystemStatus;
  criticalAlerts: number;
}

export function AdminStatsCards({ totalUsers, systemStatus, criticalAlerts }: AdminStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-2xl text-gray-900">{totalUsers}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
            <Activity className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Active Devices</p>
            <p className="text-2xl text-gray-900">{systemStatus.totalDevices}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900">
            <Database className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Data Points</p>
            <p className="text-2xl text-gray-900">{systemStatus.dataPoints.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Alerts</p>
            <p className="text-2xl text-gray-900">{criticalAlerts}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
            <Server className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Uptime</p>
            <p className="text-2xl text-gray-900">{systemStatus.uptime}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
