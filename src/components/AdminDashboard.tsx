import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPlus, Trash2, Megaphone, X } from 'lucide-react';
import { Device, Biomarker, Alert } from '../utils/mockData';
import { toast } from 'sonner';
import { AdminHeader, AdminStatsCards, QuickActionsCard, SystemAlertsCard, SystemHealth, SecurityMonitor } from './admin';
import { 
  fetchAllUsers, 
  fetchAllDevices, 
  fetchAllBiomarkers, 
  fetchAllAlerts,
  updateUserRole as updateUserRoleInDB,
  deleteUserAndData,
  updateAllDevicesStatus,
  clearAllAlertsForAllUsers,
  logAuditEvent,
  AdminUser,
  fetchAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  Announcement
} from '../utils/supabase';
import { AnnouncementBanner } from './user';

interface AdminDashboardProps {
  user: any;
  onLogout: () => void;
}

export function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', type: 'info', expires_days: '' });
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log('Loading admin data from Supabase database');
      
      const [supabaseUsers, supabaseDevices, supabaseBiomarkers, supabaseAlerts, supabaseAnnouncements] = await Promise.all([
        fetchAllUsers(),
        fetchAllDevices(),
        fetchAllBiomarkers(),
        fetchAllAlerts(),
        fetchAllAnnouncements()
      ]);

      console.log(`Loaded from DB: ${supabaseUsers.length} users, ${supabaseDevices.length} devices, ${supabaseBiomarkers.length} biomarkers, ${supabaseAlerts.length} alerts`);

      setUsers(supabaseUsers);
      setDevices(supabaseDevices);
      setBiomarkers(supabaseBiomarkers);
      setAlerts(supabaseAlerts);
      setAnnouncements(supabaseAnnouncements);

      setSystemStatus(prev => ({
        ...prev,
        activeUsers: supabaseUsers.filter(u => u.role === 'END_USER').length,
        totalDevices: supabaseDevices.length,
        dataPoints: supabaseBiomarkers.length,
      }));
    } catch (error) {
      console.error('Error loading admin data from Supabase:', error);
      toast.error('Failed to load data from database');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const simulateFaultForAllDevices = async () => {
    try {
      const result = await updateAllDevicesStatus('faulty');
      
      if (result.success) {
        // Log the audit event
        await logAuditEvent(
          user.user_id || user.id,
          'SYSTEM_ACTION',
          undefined,
          'devices',
          { action: 'simulate_fault', deviceCount: result.count, performedBy: user.name }
        );
        
        // Reload devices to reflect changes
        const updatedDevices = await fetchAllDevices();
        setDevices(updatedDevices);
        toast.success(`Fault simulation activated for ${result.count} devices`);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error simulating faults:', error);
      toast.error('Failed to simulate device faults');
    }
  };

  const resetAllDevices = async () => {
    try {
      const result = await updateAllDevicesStatus('active');
      
      if (result.success) {
        // Log the audit event
        await logAuditEvent(
          user.user_id || user.id,
          'SYSTEM_ACTION',
          undefined,
          'devices',
          { action: 'reset_devices', deviceCount: result.count, performedBy: user.name }
        );
        
        // Reload devices to reflect changes
        const updatedDevices = await fetchAllDevices();
        setDevices(updatedDevices);
        toast.success(`All ${result.count} devices reset to active status`);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error resetting devices:', error);
      toast.error('Failed to reset devices');
    }
  };

  const generateBulkData = () => {
    // TODO: Implement bulk data generation with Supabase
    // This would require inserting into data_points and biomarker_data tables
    toast.info('Bulk data generation not yet implemented with Supabase');
  };

  const clearAllAlerts = async () => {
    try {
      const result = await clearAllAlertsForAllUsers();
      
      if (result.success) {
        // Reload alerts to reflect changes
        const updatedAlerts = await fetchAllAlerts();
        setAlerts(updatedAlerts);
        toast.success('All alerts cleared');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error clearing alerts:', error);
      toast.error('Failed to clear alerts');
    }
  };

  const deleteUser = async (userId: string) => {
    if (users.find(u => u.id === userId)?.role === 'ADMIN') {
      toast.error('Cannot delete admin user');
      return;
    }

    try {
      const result = await deleteUserAndData(userId);
      
      if (result.success) {
        // Log the audit event
        await logAuditEvent(
          user.user_id || user.id,
          'USER_DELETED',
          userId,
          'user',
          { deletedBy: user.name }
        );
        
        // Reload all data to reflect changes
        await loadData();
        toast.success('User and associated data deleted');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const toggleUserRole = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    
    const newRole: 'END_USER' | 'PROVIDER' = targetUser.role === 'PROVIDER' ? 'END_USER' : 'PROVIDER';
    
    try {
      const result = await updateUserRoleInDB(userId, newRole);
      
      if (result.success) {
        // Log the audit event
        await logAuditEvent(
          user.user_id || user.id,
          'ROLE_CHANGED',
          userId,
          'user',
          { oldRole: targetUser.role, newRole, changedBy: user.name }
        );
        
        // Update local state
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        toast.success('User role updated');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    const expiresAt = newAnnouncement.expires_days
      ? new Date(Date.now() + parseInt(newAnnouncement.expires_days) * 86400000).toISOString()
      : undefined;

    const result = await createAnnouncement({
      title: newAnnouncement.title,
      message: newAnnouncement.message,
      type: newAnnouncement.type,
      created_by: user.user_id || user.id,
      expires_at: expiresAt,
    });

    if (result) {
      setAnnouncements((prev) => [result, ...prev]);
      setNewAnnouncement({ title: '', message: '', type: 'info', expires_days: '' });
      toast.success('Announcement published');
    } else {
      toast.error('Failed to create announcement');
    }
  };

  const handleToggleAnnouncement = async (id: string, isActive: boolean) => {
    const ok = await updateAnnouncement(id, { is_active: !isActive });
    if (ok) {
      setAnnouncements((prev) => prev.map((a) => (a.announcement_id === id ? { ...a, is_active: !isActive } : a)));
      toast.success(isActive ? 'Announcement deactivated' : 'Announcement reactivated');
    } else {
      toast.error('Failed to update announcement');
    }
  };

  const faultyDevices = devices.filter(d => d.status === 'faulty');
  const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.read);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 dark:border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <AnnouncementBanner />
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
          <TabsList className="w-full">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
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
                        <Badge variant={u.role === 'ADMIN' ? 'destructive' : u.role === 'PROVIDER' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.age || 'N/A'}</TableCell>
                      <TableCell>{devices.filter(d => d.userId === u.id).length}</TableCell>
                      <TableCell>{biomarkers.filter(b => b.userId === u.id).length}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {u.role !== 'ADMIN' && (
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

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <div className="space-y-6">
              {/* Create New Announcement */}
              <Card className="p-6">
                <h3 className="text-foreground mb-4 flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Publish New Announcement
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Title</label>
                      <Input
                        placeholder="Announcement title"
                        value={newAnnouncement.title}
                        onChange={(e) => setNewAnnouncement((p) => ({ ...p, title: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-gray-600 mb-1 block">Type</label>
                        <Select
                          value={newAnnouncement.type}
                          onValueChange={(v) => setNewAnnouncement((p) => ({ ...p, type: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="success">Success</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 mb-1 block">Expires in</label>
                        <Select
                          value={newAnnouncement.expires_days}
                          onValueChange={(v) => setNewAnnouncement((p) => ({ ...p, expires_days: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Never" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 day</SelectItem>
                            <SelectItem value="3">3 days</SelectItem>
                            <SelectItem value="7">1 week</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Message</label>
                    <Input
                      placeholder="Announcement message shown to all users"
                      value={newAnnouncement.message}
                      onChange={(e) => setNewAnnouncement((p) => ({ ...p, message: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleCreateAnnouncement} disabled={!newAnnouncement.title.trim() || !newAnnouncement.message.trim()}>
                      <Megaphone className="h-4 w-4 mr-2" /> Publish
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Existing Announcements */}
              <Card>
                <div className="p-6 border-b">
                  <h3 className="text-foreground">All Announcements ({announcements.length})</h3>
                </div>
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Megaphone className="h-10 w-10 mx-auto opacity-30 mb-2" />
                    <p>No announcements yet. Create one above to broadcast to all users.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {announcements.map((a) => (
                        <TableRow key={a.announcement_id} className={!a.is_active ? 'opacity-50' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{a.title}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-xs">{a.message}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              a.type === 'urgent' ? 'destructive' :
                              a.type === 'warning' ? 'default' :
                              a.type === 'success' ? 'default' :
                              'secondary'
                            }>
                              {a.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.is_active ? 'default' : 'outline'}>
                              {a.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(a.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={a.is_active ? 'destructive' : 'outline'}
                              onClick={() => handleToggleAnnouncement(a.announcement_id, a.is_active)}
                            >
                              {a.is_active ? <><X className="h-3 w-3 mr-1" /> Deactivate</> : 'Reactivate'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
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
