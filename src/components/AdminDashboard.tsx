import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPlus, Trash2, Megaphone, X, Mail, ShieldCheck, ShieldOff, UserX, UserCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Device, Biomarker, Alert } from '../utils/mockData';
import { toast } from 'sonner';
import { AdminHeader, AdminStatsCards, QuickActionsCard, SystemAlertsCard, SystemHealth, SecurityMonitor } from './admin';
import { checkRateLimit } from '../utils/rateLimiter';
import { HeartbeatLoader } from './ui/HeartbeatLoader';
import {
  validateText,
  validateEnum,
  sanitizeText,
  containsDangerousPatterns,
} from '../utils/inputValidation';
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
  Announcement,
  updateUserActiveStatus,
  updateProviderVerification,
} from '../utils/supabase';
import { AnnouncementBanner } from './user';
import { fetchAllEmailLogs, EmailLog } from '../utils/emailService';

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
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailFilter, setEmailFilter] = useState<string>('all');
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
      const [supabaseUsers, supabaseDevices, supabaseBiomarkers, supabaseAlerts, supabaseAnnouncements] = await Promise.all([
        fetchAllUsers(),
        fetchAllDevices(),
        fetchAllBiomarkers(),
        fetchAllAlerts(),
        fetchAllAnnouncements()
      ]);


      setUsers(supabaseUsers);
      setDevices(supabaseDevices);
      setBiomarkers(supabaseBiomarkers);
      setAlerts(supabaseAlerts);
      setAnnouncements(supabaseAnnouncements);

      // Load email logs from encrypted storage
      fetchAllEmailLogs().then(logs => setEmailLogs(logs));

      setSystemStatus(prev => ({
        ...prev,
        activeUsers: supabaseUsers.filter(u => u.role === 'END_USER').length,
        totalDevices: supabaseDevices.length,
        dataPoints: supabaseBiomarkers.length,
      }));
    } catch (error) {
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
      // Rate-limit admin bulk operations
      const rateCheck = checkRateLimit('adminBulk', user.user_id || user.id);
      if (!rateCheck.allowed) {
        toast.error(rateCheck.message);
        return;
      }

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
      toast.error('Failed to simulate device faults');
    }
  };

  const resetAllDevices = async () => {
    try {
      // Rate-limit admin bulk operations
      const rateCheck = checkRateLimit('adminBulk', user.user_id || user.id);
      if (!rateCheck.allowed) {
        toast.error(rateCheck.message);
        return;
      }

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
      // Rate-limit admin bulk operations
      const rateCheck = checkRateLimit('adminBulk', user.user_id || user.id);
      if (!rateCheck.allowed) {
        toast.error(rateCheck.message);
        return;
      }

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
      toast.error('Failed to clear alerts');
    }
  };

  const deleteUser = async (userId: string) => {
    if (users.find(u => u.id === userId)?.role === 'ADMIN') {
      toast.error('Cannot delete admin user');
      return;
    }

    try {
      // Rate-limit admin destructive operations
      const rateCheck = checkRateLimit('adminBulk', user.user_id || user.id);
      if (!rateCheck.allowed) {
        toast.error(rateCheck.message);
        return;
      }

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
      toast.error('Failed to update user role');
    }
  };

  const toggleUserActive = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser || targetUser.role === 'ADMIN') return;

    const newStatus = !targetUser.is_active;
    try {
      const result = await updateUserActiveStatus(userId, newStatus);
      if (result.success) {
        await logAuditEvent(
          user.user_id || user.id,
          'USER_STATUS_CHANGED',
          userId,
          'user',
          { is_active: newStatus, changedBy: user.name }
        );
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
        toast.success(newStatus ? 'User account enabled' : 'User account disabled');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleVerifyProvider = async (userId: string, verified: boolean) => {
    try {
      const result = await updateProviderVerification(userId, verified);
      if (result.success) {
        await logAuditEvent(
          user.user_id || user.id,
          'PROVIDER_VERIFICATION',
          userId,
          'user',
          { verified, changedBy: user.name }
        );
        setUsers(users.map(u => u.id === userId ? {
          ...u,
          is_verified: verified,
          verification_status: verified ? 'approved' as const : 'denied' as const,
        } : u));
        toast.success(verified ? 'Provider verified successfully' : 'Provider verification denied');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update verification status');
    }
  };

  const handleCreateAnnouncement = async () => {
    // Validate title
    const titleValidation = validateText(newAnnouncement.title, {
      minLength: 3,
      maxLength: 200,
      required: true,
    });
    if (!titleValidation.isValid) {
      toast.error(titleValidation.error || 'Please enter a valid title (3-200 characters)');
      return;
    }

    // Validate message
    const messageValidation = validateText(newAnnouncement.message, {
      minLength: 10,
      maxLength: 2000,
      required: true,
    });
    if (!messageValidation.isValid) {
      toast.error(messageValidation.error || 'Please enter a valid message (10-2000 characters)');
      return;
    }

    // Check for dangerous patterns
    const titleDangerCheck = containsDangerousPatterns(newAnnouncement.title);
    const messageDangerCheck = containsDangerousPatterns(newAnnouncement.message);
    if (titleDangerCheck.dangerous || messageDangerCheck.dangerous) {
      toast.error('Invalid content detected');
      return;
    }

    // Validate type
    const validTypes = ['info', 'warning', 'success', 'error'] as const;
    const typeValidation = validateEnum(newAnnouncement.type, validTypes);
    if (!typeValidation.isValid) {
      toast.error('Please select a valid announcement type');
      return;
    }

    // Validate expires_days if provided
    if (newAnnouncement.expires_days) {
      const validExpiresDays = ['1', '3', '7', '30', '90'] as const;
      const expiresValidation = validateEnum(newAnnouncement.expires_days, validExpiresDays);
      if (!expiresValidation.isValid) {
        toast.error('Please select a valid expiration period');
        return;
      }
    }

    // Sanitize inputs
    const sanitizedTitle = sanitizeText(newAnnouncement.title, { maxLength: 200 });
    const sanitizedMessage = sanitizeText(newAnnouncement.message, { maxLength: 2000 });

    const expiresAt = newAnnouncement.expires_days
      ? new Date(Date.now() + parseInt(newAnnouncement.expires_days) * 86400000).toISOString()
      : undefined;

    const result = await createAnnouncement({
      title: sanitizedTitle,
      message: sanitizedMessage,
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
        <HeartbeatLoader label="Loading admin data…" size="lg" />
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
          <TabsList className="w-full flex flex-nowrap overflow-x-auto scrollbar-hide justify-start h-auto p-1">
            <TabsTrigger value="users" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">Users</TabsTrigger>
            <TabsTrigger value="devices" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">Devices</TabsTrigger>
            <TabsTrigger value="verification" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">Verification</TabsTrigger>
            <TabsTrigger value="emails" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">Emails</TabsTrigger>
            <TabsTrigger value="announcements" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">Announcements</TabsTrigger>
            <TabsTrigger value="system" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">System Health</TabsTrigger>
            <TabsTrigger value="security" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">Security</TabsTrigger>
            <TabsTrigger value="settings" className="shrink-0 whitespace-nowrap text-xs sm:text-sm">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <div className="p-4 sm:p-6 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-foreground">User Management</h3>
                  <Button size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Age</TableHead>
                    <TableHead className="hidden md:table-cell">Devices</TableHead>
                    <TableHead className="hidden md:table-cell">Data Points</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} className={!u.is_active ? 'opacity-60 bg-red-50/50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium">
                        {u.name}
                        {u.role === 'PROVIDER' && u.is_verified && (
                          <ShieldCheck className="inline w-4 h-4 ml-1 text-emerald-500" />
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'ADMIN' ? 'destructive' : u.role === 'PROVIDER' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            <UserCheck className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <UserX className="w-3 h-3 mr-1" /> Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{u.age || 'N/A'}</TableCell>
                      <TableCell className="hidden md:table-cell">{devices.filter(d => d.userId === u.id).length}</TableCell>
                      <TableCell className="hidden md:table-cell">{biomarkers.filter(b => b.userId === u.id).length}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 sm:gap-2 flex-wrap">
                          {u.role !== 'ADMIN' && (
                            <>
                              <Button
                                size="sm"
                                variant={u.is_active ? 'outline' : 'default'}
                                onClick={() => toggleUserActive(u.id)}
                                title={u.is_active ? 'Disable account' : 'Enable account'}
                              >
                                {u.is_active ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                              </Button>
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
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="devices">
            <Card>
              <div className="p-4 sm:p-6 border-b">
                <h3 className="text-foreground">Device Management</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {devices.length} total devices • {devices.filter(d => d.status === 'active').length} active • {faultyDevices.length} faulty
                </p>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead className="hidden md:table-cell">Last Sync</TableHead>
                    <TableHead className="hidden lg:table-cell">Auto Mode</TableHead>
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
                        <TableCell className="hidden md:table-cell">{deviceUser?.name || 'Unknown'}</TableCell>
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
                        <TableCell className="hidden md:table-cell">
                          {new Date(device.lastSync).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant={device.autoMode ? 'default' : 'outline'}>
                            {device.autoMode ? 'On' : 'Off'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Provider Verification Tab */}
          <TabsContent value="verification">
            <Card>
              <div className="p-4 sm:p-6 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      Provider Verification
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Review and approve healthcare provider accounts
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="default" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      <Clock className="w-3 h-3 mr-1" />
                      {users.filter(u => u.role === 'PROVIDER' && u.verification_status === 'pending').length} Pending
                    </Badge>
                    <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {users.filter(u => u.role === 'PROVIDER' && u.is_verified).length} Verified
                    </Badge>
                  </div>
                </div>
              </div>
              {users.filter(u => u.role === 'PROVIDER').length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto opacity-30 mb-2" />
                  <p>No provider accounts to verify.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">Registered</TableHead>
                      <TableHead className="hidden md:table-cell">Last Login</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter(u => u.role === 'PROVIDER').map(provider => (
                      <TableRow key={provider.id} className={!provider.is_verified ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                        <TableCell className="font-medium">
                          {provider.name}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{provider.email}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {new Date(provider.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {provider.last_login ? new Date(provider.last_login).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          {provider.is_verified ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                            </Badge>
                          ) : provider.verification_status === 'denied' ? (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" /> Denied
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-400 text-amber-600">
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 sm:gap-2 flex-wrap">
                            {!provider.is_verified && (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleVerifyProvider(provider.id, true)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                              </Button>
                            )}
                            {provider.is_verified ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleVerifyProvider(provider.id, false)}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Revoke
                              </Button>
                            ) : provider.verification_status !== 'denied' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleVerifyProvider(provider.id, false)}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Deny
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleVerifyProvider(provider.id, true)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Email Logs Tab */}
          <TabsContent value="emails">
            <Card>
              <div className="p-4 sm:p-6 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-foreground flex items-center gap-2">
                      <Mail className="h-5 w-5 text-blue-600" />
                      Email Notification Log
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {emailLogs.length} total emails sent
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={emailFilter} onValueChange={setEmailFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="critical_alert">Critical Alert</SelectItem>
                        <SelectItem value="daily_digest">Daily Digest</SelectItem>
                        <SelectItem value="weekly_digest">Weekly Digest</SelectItem>
                        <SelectItem value="goal_completed">Goal Completed</SelectItem>
                        <SelectItem value="streak_milestone">Streak Milestone</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => fetchAllEmailLogs().then(logs => setEmailLogs(logs))}>
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
              {emailLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto opacity-30 mb-2" />
                  <p>No email notifications have been sent yet.</p>
                  <p className="text-xs mt-1">Emails are sent for critical alerts, digests, and goal completions.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden md:table-cell">Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs
                      .filter(log => emailFilter === 'all' || log.type === emailFilter)
                      .map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.recipientEmail}</TableCell>
                          <TableCell>
                            <Badge variant={
                              log.type === 'critical_alert' ? 'destructive' :
                              log.type.includes('digest') ? 'default' :
                              log.type === 'goal_completed' ? 'default' :
                              'secondary'
                            } className={
                              log.type === 'goal_completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
                              log.type.includes('digest') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                              ''
                            }>
                              {log.type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-xs truncate">{log.subject}</TableCell>
                          <TableCell>
                            <Badge variant={
                              log.status === 'delivered' ? 'default' :
                              log.status === 'sent' ? 'default' :
                              log.status === 'failed' || log.status === 'bounced' ? 'destructive' :
                              'outline'
                            } className={
                              (log.status === 'delivered' || log.status === 'sent') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : ''
                            }>
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                </div>
              )}
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
                          onValueChange={(v: Announcement['type']) => setNewAnnouncement((p) => ({ ...p, type: v }))}
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
                          onValueChange={(v: string) => setNewAnnouncement((p) => ({ ...p, expires_days: v }))}
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
                  <div className="overflow-x-auto">
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
                  </div>
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
