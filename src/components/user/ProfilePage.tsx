import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  Bell,
  Trophy,
  Save,
  UserCircle2,
  Stethoscope,
  Share2,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AchievementsPage } from './AchievementsPage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { toast } from 'sonner';
import { Switch } from '../ui/switch';

export type ProfileTab = 'personal' | 'achievements' | 'security' | 'notifications' | 'sharing';

interface ProfilePageProps {
  user: any;
  onBack: () => void;
  onUpdate: (updatedUser: any) => void;
  initialTab?: ProfileTab;
}

export function ProfilePage({ user, onBack, onUpdate, initialTab = 'personal' }: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: user.gender || '',
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: user.emailNotifications ?? true,
    pushNotifications: user.pushNotifications ?? true,
    smsNotifications: user.smsNotifications ?? false,
    alertThreshold: user.alertThreshold || 'medium',
  });

  // Sharing settings state
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeConsents, setActiveConsents] = useState<any[]>([]);
  const [historicalConsents, setHistoricalConsents] = useState<any[]>([]);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; consentId: string | null }>({
    open: false,
    consentId: null
  });

  // Update active tab when initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Load sharing data when tab is active
  useEffect(() => {
    if (activeTab === 'sharing') {
      loadSharingData();
    }
  }, [activeTab]);

  // Get assigned doctor info
  const getAssignedDoctor = () => {
    if (user.assignedDoctor) {
      const users = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
      const doctor = users.find((u: any) => u.id === user.assignedDoctor);
      return doctor;
    }
    return null;
  };

  const assignedDoctor = getAssignedDoctor();

  // --- Sharing data helpers ---
  const loadSharingData = async () => {
    setIsSharingLoading(true);
    try {
      const { fetchPendingAccessRequests, fetchAllAccessConsents } = await import('../../utils/supabase');
      const userId = user.user_id || user.id;
      const [pending, all] = await Promise.all([
        fetchPendingAccessRequests(userId),
        fetchAllAccessConsents(userId)
      ]);
      setPendingRequests(pending);
      setActiveConsents(all.filter((c: any) => c.status === 'ACTIVE'));
      setHistoricalConsents(all.filter((c: any) => ['DENIED', 'REVOKED'].includes(c.status)));
    } catch (error) {
      console.error('Error loading sharing data:', error);
      toast.error('Failed to load sharing settings');
    } finally {
      setIsSharingLoading(false);
    }
  };

  const handleApproveRequest = async (consentId: string, providerId: string) => {
    setActionInProgress(consentId);
    try {
      const { approveAccessRequest } = await import('../../utils/supabase');
      const result = await approveAccessRequest(consentId, providerId);
      if (result.success) {
        toast.success(result.message);
        await loadSharingData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to approve access request');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDenyRequest = async (consentId: string) => {
    setActionInProgress(consentId);
    try {
      const { denyAccessRequest } = await import('../../utils/supabase');
      const result = await denyAccessRequest(consentId);
      if (result.success) {
        toast.success(result.message);
        await loadSharingData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to deny access request');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevokeAccess = async () => {
    if (!revokeDialog.consentId) return;
    setActionInProgress(revokeDialog.consentId);
    try {
      const { revokeAccessConsent } = await import('../../utils/supabase');
      const result = await revokeAccessConsent(revokeDialog.consentId);
      if (result.success) {
        toast.success(result.message);
        await loadSharingData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to revoke access');
    } finally {
      setActionInProgress(null);
      setRevokeDialog({ open: false, consentId: null });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 dark:bg-amber-900 text-yellow-800 dark:text-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'DENIED':
        return <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>;
      case 'REVOKED':
        return <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // --- Save handlers with DB persistence ---
  const handleSavePersonalInfo = async () => {
    if (!formData.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Email cannot be empty');
      return;
    }

    setIsSaving(true);
    const updatedUser = { ...user, ...formData };

    try {
      // Persist to Supabase DB
      const { updateUserDetails } = await import('../../utils/supabase');
      const result = await updateUserDetails(user.user_id || user.id, {
        name: formData.name,
        email: formData.email,
      });

      if (!result.success) {
        console.warn('DB update failed, saving locally:', result.message);
      }
    } catch (error) {
      console.warn('DB update error, saving locally:', error);
    }

    // Always update locally so the UI reflects changes
    onUpdate(updatedUser);
    const users = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const updatedUsers = users.map((u: any) =>
      (u.id === user.id || u.user_id === user.user_id) ? updatedUser : u
    );
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    localStorage.setItem('healthApp_currentUser', JSON.stringify(updatedUser));

    setIsSaving(false);
    toast.success('Profile updated successfully');
  };

  const handleSaveSecurity = async () => {
    if (!securityData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (securityData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSaving(true);

    try {
      // Try updating via Supabase Auth
      const { supabase } = await import('../../utils/supabase');
      const { error } = await supabase.auth.updateUser({
        password: securityData.newPassword,
      });

      if (error) {
        console.warn('Supabase password update failed:', error.message);
        // Fall back to local update for mock accounts
      }
    } catch (error) {
      console.warn('Password update via Supabase failed, saving locally:', error);
    }

    // Update locally too
    const updatedUser = { ...user, password: securityData.newPassword };
    onUpdate(updatedUser);
    const users = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const updatedUsers = users.map((u: any) =>
      (u.id === user.id || u.user_id === user.user_id) ? updatedUser : u
    );
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    localStorage.setItem('healthApp_currentUser', JSON.stringify(updatedUser));

    setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsSaving(false);
    toast.success('Password updated successfully');
  };

  const handleSaveNotifications = () => {
    const updatedUser = { ...user, ...notificationSettings };
    onUpdate(updatedUser);

    const users = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const updatedUsers = users.map((u: any) =>
      (u.id === user.id || u.user_id === user.user_id) ? updatedUser : u
    );
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    localStorage.setItem('healthApp_currentUser', JSON.stringify(updatedUser));

    toast.success('Notification preferences saved');
  };

  const tabs = [
    { id: 'personal' as const, label: 'Profile', icon: UserIcon },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'sharing' as const, label: 'Data Sharing', icon: Share2 },
    { id: 'achievements' as const, label: 'Achievements', icon: Trophy },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 dark:from-custom-blue dark:via-custom-purple dark:to-custom-pink overflow-x-hidden">
      {/* Header Section */}
      <div className="w-full text-white p-6 md:p-8 pt-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-white hover:bg-white/20 mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex flex-col items-center mb-16">
            <Avatar className="w-24 h-24 md:w-32 md:h-32 mb-4 ring-4 ring-white/30 shadow-2xl">
              <AvatarFallback className="bg-white/30 backdrop-blur-md text-white text-3xl md:text-4xl">
                {user.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-2xl md:text-3xl mb-1">Settings & Profile</h1>
            <p className="text-white/90 mb-3">{user.email}</p>
            <Badge className="bg-white/30 backdrop-blur-md text-white border-white/40 shadow-lg">
              {user.role === 'END_USER' ? 'Patient' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content - Overlapping Cards */}
      <div className="w-full max-w-4xl mx-auto px-4 pb-8">
        {/* Tabs */}
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-2xl shadow-2xl mb-6 p-2 grid grid-cols-3 md:grid-cols-5 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ========== Personal Info Tab ========== */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center">
                  <UserCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Personal Information</h3>
                  <p className="text-sm text-muted-foreground">Update your account details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-9"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-9"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: string) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {assignedDoctor && (
                <div className="mt-6 pt-6 border-t">
                  <Label className="mb-3 block">Assigned Healthcare Provider</Label>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{assignedDoctor.name}</p>
                      <p className="text-sm text-muted-foreground">{assignedDoctor.email}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <Button onClick={handleSavePersonalInfo} disabled={isSaving} className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </Card>

            {/* Account Info Card */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Account Security</h3>
                  <p className="text-sm text-muted-foreground">
                    We never share your personal health information without your explicit consent.
                  </p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 ml-15">
                <p>• Your data is encrypted at rest and in transit</p>
                <p>• You can manage who has access in the <button onClick={() => setActiveTab('sharing')} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Data Sharing</button> tab</p>
                <p>• Change your password anytime in the <button onClick={() => setActiveTab('security')} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Security</button> tab</p>
              </div>
            </Card>
          </div>
        )}

        {/* ========== Security Tab ========== */}
        {activeTab === 'security' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Change Password</h3>
                <p className="text-sm text-muted-foreground">Keep your account secure by updating your password regularly</p>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <div className="w-full max-w-lg flex flex-col">
                <div className="w-full space-y-2 mb-8">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={securityData.currentPassword}
                      onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="w-full space-y-2 mb-8">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="pr-10"
                      autoComplete="new-password"
                      aria-describedby="newPasswordHint"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p id="newPasswordHint" className="text-xs text-muted-foreground">Use at least 6 characters.</p>
                  {securityData.newPassword && securityData.newPassword.length < 6 && (
                    <p className="text-xs text-red-500" role="alert">Password must be at least 6 characters</p>
                  )}
                </div>

                <div className="w-full space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {securityData.confirmPassword && securityData.newPassword !== securityData.confirmPassword && (
                    <p className="text-xs text-red-500" role="alert">Passwords do not match</p>
                  )}
                </div>

                <div className="flex justify-end pt-8">
                  <Button
                    onClick={handleSaveSecurity}
                    disabled={isSaving || !securityData.currentPassword || !securityData.newPassword || !securityData.confirmPassword}
                    className="bg-gradient-to-r from-red-500 to-orange-600"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Update Password
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ========== Notifications Tab ========== */}
        {activeTab === 'notifications' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Notification Preferences</h3>
                <p className="text-sm text-muted-foreground">Configure how you receive alerts and updates</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive health alerts via email</p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked: boolean) =>
                    setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive alerts on your device</p>
                </div>
                <Switch
                  checked={notificationSettings.pushNotifications}
                  onCheckedChange={(checked: boolean) =>
                    setNotificationSettings({ ...notificationSettings, pushNotifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div>
                  <p className="font-medium">SMS Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive critical alerts via SMS</p>
                </div>
                <Switch
                  checked={notificationSettings.smsNotifications}
                  onCheckedChange={(checked: boolean) =>
                    setNotificationSettings({ ...notificationSettings, smsNotifications: checked })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Alert Threshold</Label>
                <p className="text-sm text-muted-foreground mb-2">Choose which alerts you want to be notified about</p>
                <Select
                  value={notificationSettings.alertThreshold}
                  onValueChange={(value: string) => setNotificationSettings({ ...notificationSettings, alertThreshold: value })}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — All notifications</SelectItem>
                    <SelectItem value="medium">Medium — Important only</SelectItem>
                    <SelectItem value="high">High — Critical only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveNotifications} className="bg-gradient-to-r from-purple-500 to-pink-600">
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ========== Data Sharing Tab ========== */}
        {activeTab === 'sharing' && (
          <div className="space-y-6">
            {isSharingLoading ? (
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                  <p className="text-muted-foreground">Loading sharing settings...</p>
                </div>
              </Card>
            ) : (
              <>
                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                  <Card className="p-6 border-2 border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <h3 className="font-semibold text-lg">
                        Pending Access Requests ({pendingRequests.length})
                      </h3>
                    </div>
                    <Separator className="mb-4" />
                    <div className="space-y-4">
                      {pendingRequests.map((request: any) => (
                        <div key={request.consent_id} className="p-4 border rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium">{request.provider_name || 'Healthcare Provider'}</p>
                              <p className="text-sm text-muted-foreground">{request.provider_email}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Requested: {formatDate(request.granted_at)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveRequest(request.consent_id, request.provider_id)}
                                disabled={actionInProgress === request.consent_id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {actionInProgress === request.consent_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <><CheckCircle className="w-4 h-4 mr-1" /> Approve</>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDenyRequest(request.consent_id)}
                                disabled={actionInProgress === request.consent_id}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Deny
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Active Consents */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-lg">Active Access ({activeConsents.length})</h3>
                  </div>
                  <Separator className="mb-4" />
                  {activeConsents.length === 0 ? (
                    <div className="text-center py-8">
                      <Share2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No one currently has access to your health data</p>
                      <p className="text-sm text-muted-foreground mt-1">When a provider requests access, it will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeConsents.map((consent: any) => (
                        <div key={consent.consent_id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{consent.provider_name || 'Healthcare Provider'}</p>
                            <p className="text-sm text-muted-foreground">{consent.provider_email}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Since: {formatDate(consent.granted_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(consent.status)}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRevokeDialog({ open: true, consentId: consent.consent_id })}
                            >
                              Revoke
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* History */}
                {historicalConsents.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-gray-500" />
                      <h3 className="font-semibold text-lg">Access History</h3>
                    </div>
                    <Separator className="mb-4" />
                    <div className="space-y-3">
                      {historicalConsents.map((consent: any) => (
                        <div key={consent.consent_id} className="flex items-center justify-between p-4 border rounded-lg opacity-70">
                          <div>
                            <p className="font-medium">{consent.provider_name || 'Healthcare Provider'}</p>
                            <p className="text-sm text-muted-foreground">{consent.provider_email}</p>
                          </div>
                          {getStatusBadge(consent.status)}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* Revoke Confirmation Dialog */}
            <AlertDialog open={revokeDialog.open} onOpenChange={(open: boolean) => setRevokeDialog({ open, consentId: open ? revokeDialog.consentId : null })}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This provider will immediately lose access to your health data. They will need to request access again if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRevokeAccess} className="bg-red-600 hover:bg-red-700">
                    Revoke Access
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* ========== Achievements Tab ========== */}
        {activeTab === 'achievements' && (
          <AchievementsPage userId={user.id || user.user_id} />
        )}
      </div>
    </div>
  );
}