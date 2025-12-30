import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Server, HardDrive, Cpu, Activity, TrendingUp, CheckCircle } from 'lucide-react';
import { Biomarker, Device, User } from '../../utils/mockData';

interface SystemHealthProps {
  biomarkers: Biomarker[];
  devices: Device[];
  users: User[];
}

export function SystemHealth({ biomarkers, devices, users }: SystemHealthProps) {
  // Calculate system metrics
  const totalStorage = 1000; // GB
  const usedStorage = Math.min((biomarkers.length * 0.001), totalStorage);
  const storagePercent = (usedStorage / totalStorage) * 100;

  const cpuUsage = 35 + Math.random() * 20; // Simulated
  const memoryUsage = 45 + Math.random() * 15; // Simulated

  // Data throughput over time
  const getThroughputData = () => {
    const data = [];
    for (let i = 23; i >= 0; i--) {
      const hour = new Date();
      hour.setHours(hour.getHours() - i);
      const count = biomarkers.filter(b => {
        const date = new Date(b.timestamp);
        return date.getHours() === hour.getHours();
      }).length;
      
      data.push({
        time: hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        readings: count,
      });
    }
    return data;
  };

  // Device status distribution
  const getDeviceStats = () => {
    return [
      { name: 'Active', value: devices.filter(d => d.status === 'active').length },
      { name: 'Inactive', value: devices.filter(d => d.status === 'inactive').length },
      { name: 'Faulty', value: devices.filter(d => d.status === 'faulty').length },
    ];
  };

  // Data quality metrics
  const faultyReadings = biomarkers.filter(b => b.isFaulty).length;
  const dataQuality = ((biomarkers.length - faultyReadings) / biomarkers.length) * 100;

  const throughputData = getThroughputData();
  const deviceStats = getDeviceStats();

  return (
    <div className="space-y-6">
      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
              <Cpu className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">CPU Usage</p>
              <p className="text-2xl text-gray-900">{cpuUsage.toFixed(1)}%</p>
            </div>
          </div>
          <Progress value={cpuUsage} className="h-2" />
          <p className="text-xs text-gray-500 mt-2">
            {cpuUsage < 50 ? 'Optimal' : cpuUsage < 80 ? 'Moderate' : 'High'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Memory Usage</p>
              <p className="text-2xl text-gray-900">{memoryUsage.toFixed(1)}%</p>
            </div>
          </div>
          <Progress value={memoryUsage} className="h-2" />
          <p className="text-xs text-gray-500 mt-2">
            {memoryUsage < 50 ? 'Optimal' : memoryUsage < 80 ? 'Moderate' : 'High'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
              <HardDrive className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Storage Used</p>
              <p className="text-2xl text-gray-900">{usedStorage.toFixed(1)} GB</p>
            </div>
          </div>
          <Progress value={storagePercent} className="h-2" />
          <p className="text-xs text-gray-500 mt-2">
            {(totalStorage - usedStorage).toFixed(1)} GB available
          </p>
        </Card>
      </div>

      {/* Data Throughput */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-foreground">Data Throughput (24h)</h3>
            <p className="text-sm text-gray-600">Biomarker readings per hour</p>
          </div>
          <Badge variant="outline">
            <TrendingUp className="w-3 h-3 mr-1" />
            Real-time
          </Badge>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="readings" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Device Status & Data Quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-foreground mb-4">Device Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-foreground mb-4">Data Quality Metrics</h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Overall Data Quality</p>
                <p className="text-2xl text-gray-900">{dataQuality.toFixed(1)}%</p>
              </div>
              <Progress value={dataQuality} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-gray-600">Valid Readings</p>
                </div>
                <p className="text-2xl text-gray-900">
                  {(biomarkers.length - faultyReadings).toLocaleString()}
                </p>
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-gray-600">Faulty Readings</p>
                </div>
                <p className="text-2xl text-gray-900">{faultyReadings}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-2">System Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-sm text-gray-900">All systems operational</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* System Information */}
      <Card className="p-6">
        <h3 className="text-foreground mb-4">System Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Database Version</p>
            <p className="text-gray-900">PostgreSQL 15.2</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">API Version</p>
            <p className="text-gray-900">v2.1.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Last Backup</p>
            <p className="text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Uptime</p>
            <p className="text-gray-900">99.9%</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
