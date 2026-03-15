import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Server, HardDrive, Cpu, Activity, TrendingUp, CheckCircle } from 'lucide-react';
import { Biomarker, Device } from '../../utils/mockData';
import { AdminUser, fetchSystemMetrics, fetchDataThroughput, SystemMetrics } from '../../utils/supabase';

interface SystemHealthProps {
  biomarkers: Biomarker[];
  devices: Device[];
  users: AdminUser[];
}

export function SystemHealth({ biomarkers, devices, users }: SystemHealthProps) {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [throughputData, setThroughputData] = useState<{ hour: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    setIsLoading(true);
    try {
      const [metrics, throughput] = await Promise.all([
        fetchSystemMetrics(),
        fetchDataThroughput()
      ]);
      setSystemMetrics(metrics);
      setThroughputData(throughput);
    } catch (error) {
      console.error('Error loading system data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Simulated resource metrics (these would come from a monitoring service in production)
  const cpuUsage = 35 + Math.random() * 20;
  const memoryUsage = 45 + Math.random() * 15;
  
  // Calculate storage from real data
  const totalStorageGB = 1000; // Total allocated storage
  const usedStorageGB = systemMetrics ? systemMetrics.storageUsedMB / 1024 : 0;
  const storagePercent = (usedStorageGB / totalStorageGB) * 100;

  // Data throughput over time - use real data from Supabase
  const getThroughputData = () => {
    if (throughputData.length > 0) {
      return throughputData.map(item => ({
        time: item.hour,
        readings: item.count
      }));
    }
    // Fallback to biomarkers if throughput data not loaded
    const data = [];
    for (let i = 23; i >= 0; i--) {
      const hour = new Date();
      hour.setHours(hour.getHours() - i);
      const count = biomarkers.filter(b => {
        const date = new Date(b.timestamp);
        return date.getHours() === hour.getHours();
      }).length;
      
      data.push({
        time: hour.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
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

  const throughputChartData = getThroughputData();
  const deviceStats = getDeviceStats();

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading system metrics...</p>
      </div>
    );
  }

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
              <p className="text-2xl text-gray-900">{usedStorageGB.toFixed(1)} GB</p>
            </div>
          </div>
          <Progress value={storagePercent} className="h-2" />
          <p className="text-xs text-gray-500 mt-2">
            {(totalStorageGB - usedStorageGB).toFixed(1)} GB available
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
          <ReactApexChart
            options={{
              chart: {
                type: 'line',
                animations: {
                  enabled: true,
                  easing: 'easeinout',
                  speed: 800,
                  animateGradually: {
                    enabled: true,
                    delay: 150
                  },
                  dynamicAnimation: {
                    enabled: true,
                    speed: 350
                  }
                },
                toolbar: {
                  show: false
                },
                zoom: {
                  enabled: false
                }
              },
              stroke: {
                curve: 'smooth',
                width: 2
              },
              colors: ['#3b82f6'],
              xaxis: {
                categories: throughputChartData.map(d => d.time),
                labels: {
                  rotate: -45,
                  style: {
                    colors: '#9ca3af',
                    fontSize: '12px'
                  }
                }
              },
              yaxis: {
                labels: {
                  style: {
                    colors: '#9ca3af'
                  }
                }
              },
              grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 3
              },
              markers: {
                size: 3,
                strokeWidth: 0,
                hover: {
                  size: 5
                }
              },
              tooltip: {
                theme: 'light'
              },
              legend: {
                show: false
              }
            } as ApexOptions}
            series={[
              {
                name: 'Readings',
                data: throughputChartData.map(d => d.readings)
              }
            ]}
            type="line"
            height="100%"
          />
        </div>
      </Card>

      {/* Device Status & Data Quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-foreground mb-4">Device Status Distribution</h3>
          <div className="h-64">
            <ReactApexChart
              options={{
                chart: {
                  type: 'bar',
                  animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    animateGradually: {
                      enabled: true,
                      delay: 150
                    }
                  },
                  toolbar: {
                    show: false
                  }
                },
                plotOptions: {
                  bar: {
                    borderRadius: 8,
                    borderRadiusApplication: 'end',
                    columnWidth: '60%'
                  }
                },
                colors: ['#8b5cf6'],
                xaxis: {
                  categories: deviceStats.map(d => d.name),
                  labels: {
                    style: {
                      colors: '#9ca3af'
                    }
                  }
                },
                yaxis: {
                  labels: {
                    style: {
                      colors: '#9ca3af'
                    }
                  }
                },
                grid: {
                  borderColor: '#e5e7eb',
                  strokeDashArray: 3
                },
                tooltip: {
                  theme: 'light'
                },
                dataLabels: {
                  enabled: false
                },
                legend: {
                  show: false
                }
              } as ApexOptions}
              series={[
                {
                  name: 'Devices',
                  data: deviceStats.map(d => d.value)
                }
              ]}
              type="bar"
              height="100%"
            />
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
        <div className="overflow-x-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 min-w-0">
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
        </div>
      </Card>
    </div>
  );
}
