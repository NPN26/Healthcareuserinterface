import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Users, 
  Activity, 
  Server, 
  Shield, 
  AlertTriangle,
  RefreshCw,
  Trash2,
  UserPlus,
  Settings,
  Database,
  Lock,
  LogOut,
  Sun,
  MoonIcon
} from 'lucide-react';
import { User, Device, Biomarker, Alert, generateBiomarkerData } from '../utils/mockData';
import { toast } from 'sonner@2.0.3';
import { SystemHealth } from './SystemHealth';
import { SecurityMonitor } from './SecurityMonitor';

interface AdminDashboardProps {
  user: any;
  onLogout: () => void;
}

export function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    uptime: '99.9%',
    activeUsers: 0,
    totalDevices: 0,
    dataPoints: 0,
    lastBackup: new Date().toISOString(),
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const storedUsers = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const storedDevices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
    const storedBiomarkers = JSON.parse(localStorage.getItem('healthApp_biomarkers') || '[]');
    const storedAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');

    setUsers(storedUsers);
    setDevices(storedDevices);
    setBiomarkers(storedBiomarkers);
    setAlerts(storedAlerts);

    setSystemStatus(prev => ({
      ...prev,
      activeUsers: storedUsers.filter((u: User) => u.role === 'user').length,
      totalDevices: storedDevices.length,
      dataPoints: storedBiomarkers.length,
    }));
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const simulateFaultForAllDevices = () => {
    const updated = devices.map(d => ({ ...d, status: 'faulty' as const }));
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    setDevices(updated);
    toast.success('Fault simulation activated for all devices');
  };

  const resetAllDevices = () => {
    const updated = devices.map(d => ({ ...d, status: 'active' as const }));
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    setDevices(updated);
    toast.success('All devices reset to active status');
  };

  const generateBulkData = () => {
    const newBiomarkers: Biomarker[] = [];
    const types: Biomarker['type'][] = ['heartRate', 'glucose', 'oxygen'];
    
    users.filter(u => u.role === 'user').forEach(user => {
      const userDevices = devices.filter(d => d.userId === user.id);
      if (userDevices.length > 0) {
        types.forEach(type => {
          for (let i = 0; i < 10; i++) {
            const date = new Date();
            date.setHours(date.getHours() - i);
            newBiomarkers.push(
              generateBiomarkerData(user.id, userDevices[0].id, type, date)
            );
          }
        });
      }
    });

    const allBiomarkers = [...biomarkers, ...newBiomarkers];
    localStorage.setItem('healthApp_biomarkers', JSON.stringify(allBiomarkers));
    setBiomarkers(allBiomarkers);
    toast.success(`Generated ${newBiomarkers.length} new data points`);
  };

  const clearAllAlerts = () => {
    localStorage.setItem('healthApp_alerts', JSON.stringify([]));
    setAlerts([]);
    toast.success('All alerts cleared');
  };

  const deleteUser = (userId: string) => {
    if (users.find(u => u.id === userId)?.role === 'admin') {
      toast.error('Cannot delete admin user');
      return;
    }

    const updatedUsers = users.filter(u => u.id !== userId);
    const updatedDevices = devices.filter(d => d.userId !== userId);
    const updatedBiomarkers = biomarkers.filter(b => b.userId !== userId);
    const updatedAlerts = alerts.filter(a => a.userId !== userId);

    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    localStorage.setItem('healthApp_devices', JSON.stringify(updatedDevices));
    localStorage.setItem('healthApp_biomarkers', JSON.stringify(updatedBiomarkers));
    localStorage.setItem('healthApp_alerts', JSON.stringify(updatedAlerts));

    setUsers(updatedUsers);
    setDevices(updatedDevices);
    setBiomarkers(updatedBiomarkers);
    setAlerts(updatedAlerts);

    toast.success('User and associated data deleted');
  };

  const toggleUserRole = (userId: string) => {
    const updatedUsers = users.map(u => 
      u.id === userId 
        ? { ...u, role: u.role === 'provider' ? 'user' : 'provider' as const }
        : u
    );
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    toast.success('User role updated');
  };

  const faultyDevices = devices.filter(d => d.status === 'faulty');
  const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.read);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-900">System Administration</h1>
            <p className="text-gray-600">Welcome, {user.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="h-9 w-9"
            >
              {isDarkMode ? (<Sun className="w-4 h-4" />) : (<MoonIcon className="w-4 h-4" />)}
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl text-gray-900">{users.length}</p>
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
                <p className="text-2xl text-gray-900">{criticalAlerts.length}</p>
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

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button onClick={generateBulkData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Data
            </Button>
            <Button onClick={simulateFaultForAllDevices} variant="outline">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Simulate Faults
            </Button>
            <Button onClick={resetAllDevices} variant="outline">
              <Activity className="w-4 h-4 mr-2" />
              Reset Devices
            </Button>
            <Button onClick={clearAllAlerts} variant="outline">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Alerts
            </Button>
          </div>
        </Card>

        {/* System Alerts */}
        {(faultyDevices.length > 0 || criticalAlerts.length > 0) && (
          <Card className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-foreground mb-2">System Alerts</h3>
                <ul className="space-y-1 text-sm text-red-700 dark:text-white">
                  {faultyDevices.length > 0 && (
                    <li>• {faultyDevices.length} device{faultyDevices.length !== 1 ? 's' : ''} reporting faults</li>
                  )}
                  {criticalAlerts.length > 0 && (
                    <li>• {criticalAlerts.length} critical alert{criticalAlerts.length !== 1 ? 's' : ''} requiring attention</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="system">System Health</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-foreground">User Management</h3>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'provider' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.age}</TableCell>
                      <TableCell>{devices.filter(d => d.userId === u.id).length}</TableCell>
                      <TableCell>{biomarkers.filter(b => b.userId === u.id).length}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {u.role !== 'admin' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => toggleUserRole(u.id)}
                              >
                                Toggle Role
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => deleteUser(u.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="devices">
            <Card>
              <div className="p-6 border-b">
                <h3 className="text-foreground">Device Management</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {devices.length} total devices • {devices.filter(d => d.status === 'active').length} active • {faultyDevices.length} faulty
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Auto Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map(device => {
                    const deviceUser = users.find(u => u.id === device.userId);
                    return (
                      <TableRow key={device.id} className={device.status === 'faulty' ? 'bg-red-50 dark:bg-red-950' : ''}>
                        <TableCell>{device.name}</TableCell>
                        <TableCell className="capitalize">
                          {device.type.replace(/([A-Z])/g, ' $1').trim()}
                        </TableCell>
                        <TableCell>{deviceUser?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            device.status === 'active' ? 'default' : 
                            device.status === 'faulty' ? 'destructive' : 
                            'secondary'
                          }>
                            {device.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{device.batteryLevel}%</TableCell>
                        <TableCell>
                          {new Date(device.lastSync).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={device.autoMode ? 'default' : 'outline'}>
                            {device.autoMode ? 'On' : 'Off'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <SystemHealth 
              biomarkers={biomarkers}
              devices={devices}
              users={users}
            />
          </TabsContent>

          <TabsContent value="security">
            <SecurityMonitor 
              users={users}
              alerts={alerts}
            />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-foreground mb-4">System Configuration</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900">Enable Real-time Monitoring</p>
                      <p className="text-sm text-gray-600">Monitor biomarkers in real-time</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900">Automatic Backups</p>
                      <p className="text-sm text-gray-600">Daily automated data backups</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900">Alert Notifications</p>
                      <p className="text-sm text-gray-600">Send notifications for critical alerts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900">Data Encryption</p>
                      <p className="text-sm text-gray-600">Encrypt sensitive health data</p>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-foreground mb-4">Data Retention</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-2 block">Biomarker Data Retention</label>
                    <Select defaultValue="365">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-2 block">Alert History Retention</label>
                    <Select defaultValue="90">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
