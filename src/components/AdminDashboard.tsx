import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPlus, Trash2 } from 'lucide-react';
import { User, Device, Biomarker, Alert, generateBiomarkerData } from '../utils/mockData';
import { toast } from 'sonner';
import { AdminHeader, AdminStatsCards, QuickActionsCard, SystemAlertsCard, SystemHealth, SecurityMonitor } from './admin';

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
    // Check for dark mode preference
    const darkMode = localStorage.getItem('healthApp_darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
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
      activeUsers: storedUsers.filter((u: User) => u.role === 'END_USER').length,
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

  const simulateFaultForAllDevices = async () => {
    const updated = devices.map(d => ({ ...d, status: 'faulty' as const }));
    
    // Update all devices in database
    try {
      const { supabase } = await import('../utils/supabase');
      
      for (const device of devices) {
        // Get current metadata
        const { data: currentData } = await supabase
          .from('data_sources')
          .select('metadata')
          .eq('source_id', device.id)
          .single();

        const currentMetadata = currentData?.metadata || {};
        
        await supabase
          .from('data_sources')
          .update({
            status: 'ERROR',
            metadata: {
              ...currentMetadata,
              status: 'faulty'
            }
          })
          .eq('source_id', device.id);
      }
    } catch (error) {
      console.error('Database error:', error);
    }
    
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    setDevices(updated);
    toast.success('Fault simulation activated for all devices');
  };

  const resetAllDevices = async () => {
    const updated = devices.map(d => ({ ...d, status: 'active' as const }));
    
    // Update all devices in database
    try {
      const { supabase } = await import('../utils/supabase');
      
      for (const device of devices) {
        // Get current metadata
        const { data: currentData } = await supabase
          .from('data_sources')
          .select('metadata')
          .eq('source_id', device.id)
          .single();

        const currentMetadata = currentData?.metadata || {};
        
        await supabase
          .from('data_sources')
          .update({
            status: 'CONNECTED',
            metadata: {
              ...currentMetadata,
              status: 'active'
            }
          })
          .eq('source_id', device.id);
      }
    } catch (error) {
      console.error('Database error:', error);
    }
    
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    setDevices(updated);
    toast.success('All devices reset to active status');
  };

  const generateBulkData = () => {
    const newBiomarkers: Biomarker[] = [];
    const types: Biomarker['type'][] = ['heartRate', 'glucose', 'oxygen'];
    
    users.filter(u => u.role === 'END_USER').forEach(user => {
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
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        const newRole: 'END_USER' | 'PROVIDER' = u.role === 'PROVIDER' ? 'END_USER' : 'PROVIDER';
        return { ...u, role: newRole };
      }
      return u;
    });
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    toast.success('User role updated');
  };

  const faultyDevices = devices.filter(d => d.status === 'faulty');
  const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.read);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <AdminHeader
          userName={user.name}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onLogout={onLogout}
        />

        <AdminStatsCards
          totalUsers={users.length}
          systemStatus={systemStatus}
          criticalAlerts={criticalAlerts.length}
        />

        <QuickActionsCard
          onGenerateData={generateBulkData}
          onSimulateFaults={simulateFaultForAllDevices}
          onResetDevices={resetAllDevices}
          onClearAlerts={clearAllAlerts}
        />

        <SystemAlertsCard
          faultyDevicesCount={faultyDevices.length}
          criticalAlertsCount={criticalAlerts.length}
        />
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
                          {new Date(device.lastSync).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
