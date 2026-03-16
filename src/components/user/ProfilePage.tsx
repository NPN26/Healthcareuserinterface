import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
  Phone,
  Plus,
  Trash2,
  AlertTriangle,
  History,
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
import { secureGetItem } from '../../utils/secureStorage';

export type ProfileTab = 'personal' | 'achievements' | 'security' | 'notifications' | 'sharing' | 'emergency' | 'alertHistory';

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

  // Per-metric alert thresholds
  const defaultThresholds = {
    heartRate: { low: 60, high: 100 },
    bloodPressureSystolic: { low: 90, high: 140 },
    bloodPressureDiastolic: { low: 60, high: 90 },
    glucose: { low: 70, high: 130 },
  };
  const [alertThresholds, setAlertThresholds] = useState(
    user.alertThresholds || defaultThresholds
  );

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

  // Emergency contacts state
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [emergencyAlertHistory, setEmergencyAlertHistory] = useState<any[]>([]);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', relationship: '' });

  // Alert history state (FR8.2.4)
  const [alertHistory, setAlertHistory] = useState<any[]>([]);
  const [isAlertHistoryLoading, setIsAlertHistoryLoading] = useState(false);

  // Update active tab when initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Load sharing data when tab is active
  useEffect(() => {
    if (activeTab === 'sharing') {
      loadSharingData();
    }
    if (activeTab === 'emergency') {
      loadEmergencyData();
    }
    if (activeTab === 'alertHistory') {
      loadAlertHistory();
    }
  }, [activeTab]);

  // Assigned doctor state (loaded asynchronously from secure storage)
  const [assignedDoctor, setAssignedDoctor] = useState<any>(null);

  useEffect(() => {
    const loadAssignedDoctor = async () => {
      if (user.assignedDoctor) {
        const rawUsers = await secureGetItem('healthApp_users');
        const users = JSON.parse(rawUsers || '[]');
        const doctor = users.find((u: any) => u.id === user.assignedDoctor);
        setAssignedDoctor(doctor || null);
      }
    };
    loadAssignedDoctor();
  }, [user.assignedDoctor]);

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

  // --- Emergency contacts helpers ---
  const loadEmergencyData = async () => {
    setIsEmergencyLoading(true);
    try {
      const { fetchEmergencyContacts, fetchEmergencyAlertHistory } = await import('../../utils/supabase');
      const userId = user.user_id || user.id;
      const [contacts, history] = await Promise.all([
        fetchEmergencyContacts(userId),
        fetchEmergencyAlertHistory(userId),
      ]);
      setEmergencyContacts(contacts);
      setEmergencyAlertHistory(history);
    } catch (error) {
      toast.error('Failed to load emergency contacts');
    } finally {
      setIsEmergencyLoading(false);
    }
  };

  // --- Alert History helpers (FR8.2.4) ---
  const loadAlertHistory = async () => {
    setIsAlertHistoryLoading(true);
    try {
      const { fetchAlerts } = await import('../../utils/supabase');
      const userId = user.user_id || user.id;
      const alerts = await fetchAlerts(userId);
      // Sort most recent first
      const sorted = [...alerts].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setAlertHistory(sorted);
    } catch (error) {
      toast.error('Failed to load alert history');
    } finally {
      setIsAlertHistoryLoading(false);
    }
  };

  const handleAddEmergencyContact = async () => {
    if (!newContact.name.trim()) {
      toast.error('Contact name is required');
      return;
    }
    if (!newContact.phone.trim() && !newContact.email.trim()) {
      toast.error('At least a phone number or email is required');
      return;
    }
    try {
      const { addEmergencyContact } = await import('../../utils/supabase');
      const result = await addEmergencyContact(user.user_id || user.id, {
        name: newContact.name,
        phone: newContact.phone || undefined,
        email: newContact.email || undefined,
        relationship: newContact.relationship || undefined,
        is_primary: emergencyContacts.length === 0, // First contact is primary
      });
      if (result) {
        toast.success('Emergency contact added');
        setNewContact({ name: '', phone: '', email: '', relationship: '' });
        setShowAddContact(false);
        await loadEmergencyData();
      } else {
        toast.error('Failed to add emergency contact');
      }
    } catch (error) {
      toast.error('Failed to add emergency contact');
    }
  };

  const handleDeleteEmergencyContact = async (contactId: string) => {
    try {
      const { deleteEmergencyContact } = await import('../../utils/supabase');
      const success = await deleteEmergencyContact(contactId);
      if (success) {
        toast.success('Emergency contact removed');
        await loadEmergencyData();
      } else {
        toast.error('Failed to remove contact');
      }
    } catch (error) {
      toast.error('Failed to remove contact');
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
      }
    } catch (error) {
    }

    // Always update locally so the UI reflects changes
    onUpdate(updatedUser);
    const { secureGetItem, secureSetItem } = await import('../../utils/secureStorage');
    const rawUsers = await secureGetItem('healthApp_users');
    const users = JSON.parse(rawUsers || '[]');
    const updatedUsers = users.map((u: any) =>
      (u.id === user.id || u.user_id === user.user_id) ? updatedUser : u
    );
    await secureSetItem('healthApp_users', JSON.stringify(updatedUsers));
    await secureSetItem('healthApp_currentUser', JSON.stringify(updatedUser));

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
      const { supabase } = await import('../../utils/supabase');

      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: securityData.currentPassword,
      });

      if (signInError) {
        setIsSaving(false);
        toast.error('Current password is incorrect');
        return;
      }

      // Now update the password
      const { error } = await supabase.auth.updateUser({
        password: securityData.newPassword,
      });

      if (error) {
        setIsSaving(false);
        toast.error('Failed to update password: ' + error.message);
        return;
      }
    } catch (error) {
      setIsSaving(false);
      toast.error('Failed to update password');
      return;
    }

    // Do NOT store password in localStorage - only update non-sensitive user data
    const updatedUser = { ...user };
    onUpdate(updatedUser);
    const { secureGetItem, secureSetItem } = await import('../../utils/secureStorage');
    const rawUsers = await secureGetItem('healthApp_users');
    const users = JSON.parse(rawUsers || '[]');
    const updatedUsers = users.map((u: any) =>
      (u.id === user.id || u.user_id === user.user_id) ? updatedUser : u
    );
    await secureSetItem('healthApp_users', JSON.stringify(updatedUsers));
    await secureSetItem('healthApp_currentUser', JSON.stringify(updatedUser));

    setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsSaving(false);
    toast.success('Password updated successfully');
  };

  const handleSaveNotifications = async () => {
    const updatedUser = { ...user, ...notificationSettings, alertThresholds };
    onUpdate(updatedUser);

    // Persist thresholds to Supabase alert_thresholds table
    try {
      const { supabase } = await import('../../utils/supabase');
      const userId = user.user_id || user.id;

      // Upsert each metric threshold
      const thresholdRows = [
        { biomarker: 'HEART_RATE', low: alertThresholds.heartRate.low, high: alertThresholds.heartRate.high },
        { biomarker: 'BLOOD_PRESSURE_SYS', low: alertThresholds.bloodPressureSystolic.low, high: alertThresholds.bloodPressureSystolic.high },
        { biomarker: 'BLOOD_PRESSURE_DIA', low: alertThresholds.bloodPressureDiastolic.low, high: alertThresholds.bloodPressureDiastolic.high },
        { biomarker: 'BLOOD_GLUCOSE', low: alertThresholds.glucose.low, high: alertThresholds.glucose.high },
      ];

      for (const row of thresholdRows) {
        await supabase
          .from('alert_thresholds')
          .upsert(
            {
              user_id: userId,
              biomarker: row.biomarker,
              low_threshold: row.low,
              high_threshold: row.high,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,biomarker' }
          );
      }
    } catch (error) {
    }

    const { secureGetItem, secureSetItem } = await import('../../utils/secureStorage');
    const rawUsers = await secureGetItem('healthApp_users');
    const users = JSON.parse(rawUsers || '[]');
    const updatedUsers = users.map((u: any) =>
      (u.id === user.id || u.user_id === user.user_id) ? updatedUser : u
    );
    await secureSetItem('healthApp_users', JSON.stringify(updatedUsers));
    await secureSetItem('healthApp_currentUser', JSON.stringify(updatedUser));

    toast.success('Notification preferences saved');
  };

  const tabs = [
    { id: 'personal' as const, label: 'Profile', icon: UserIcon },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'sharing' as const, label: 'Data Sharing', icon: Share2 },
    { id: 'emergency' as const, label: 'Emergency', icon: Phone },
    { id: 'alertHistory' as const, label: 'Alert History', icon: History },
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
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-2xl shadow-2xl mb-6 p-2 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                  : 'hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
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

              {/* Per-Metric Alert Thresholds */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Per-Metric Alert Thresholds</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Customize the safe range for each vital sign. You'll be alerted when readings fall outside these bounds.
                  </p>
                </div>

                {/* Heart Rate */}
                <div className="p-4 border rounded-xl space-y-3 bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <span className="text-red-600 dark:text-red-300 text-sm">❤️</span>
                    </div>
                    <Label className="font-medium">Heart Rate (bpm)</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Low Threshold</Label>
                      <Input
                        type="number"
                        value={alertThresholds.heartRate.low}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          heartRate: { ...alertThresholds.heartRate, low: Number(e.target.value) }
                        })}
                        min={30} max={100} placeholder="60"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">High Threshold</Label>
                      <Input
                        type="number"
                        value={alertThresholds.heartRate.high}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          heartRate: { ...alertThresholds.heartRate, high: Number(e.target.value) }
                        })}
                        min={60} max={220} placeholder="100"
                      />
                    </div>
                  </div>
                </div>

                {/* Blood Pressure */}
                <div className="p-4 border rounded-xl space-y-3 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <span className="text-purple-600 dark:text-purple-300 text-sm">🩺</span>
                    </div>
                    <Label className="font-medium">Blood Pressure (mmHg)</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Systolic Low</Label>
                      <Input
                        type="number"
                        value={alertThresholds.bloodPressureSystolic.low}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          bloodPressureSystolic: { ...alertThresholds.bloodPressureSystolic, low: Number(e.target.value) }
                        })}
                        min={60} max={140} placeholder="90"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Systolic High</Label>
                      <Input
                        type="number"
                        value={alertThresholds.bloodPressureSystolic.high}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          bloodPressureSystolic: { ...alertThresholds.bloodPressureSystolic, high: Number(e.target.value) }
                        })}
                        min={100} max={250} placeholder="140"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Diastolic Low</Label>
                      <Input
                        type="number"
                        value={alertThresholds.bloodPressureDiastolic.low}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          bloodPressureDiastolic: { ...alertThresholds.bloodPressureDiastolic, low: Number(e.target.value) }
                        })}
                        min={40} max={90} placeholder="60"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Diastolic High</Label>
                      <Input
                        type="number"
                        value={alertThresholds.bloodPressureDiastolic.high}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          bloodPressureDiastolic: { ...alertThresholds.bloodPressureDiastolic, high: Number(e.target.value) }
                        })}
                        min={50} max={130} placeholder="90"
                      />
                    </div>
                  </div>
                </div>

                {/* Glucose */}
                <div className="p-4 border rounded-xl space-y-3 bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-300 text-sm">💧</span>
                    </div>
                    <Label className="font-medium">Blood Glucose (mg/dL)</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Low Threshold</Label>
                      <Input
                        type="number"
                        value={alertThresholds.glucose.low}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          glucose: { ...alertThresholds.glucose, low: Number(e.target.value) }
                        })}
                        min={30} max={100} placeholder="70"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">High Threshold</Label>
                      <Input
                        type="number"
                        value={alertThresholds.glucose.high}
                        onChange={(e) => setAlertThresholds({
                          ...alertThresholds,
                          glucose: { ...alertThresholds.glucose, high: Number(e.target.value) }
                        })}
                        min={80} max={500} placeholder="130"
                      />
                    </div>
                  </div>
                </div>

                {/* Reset to defaults */}
                <div className="flex justify-start">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAlertThresholds(defaultThresholds)}
                    className="text-muted-foreground"
                  >
                    Reset to defaults
                  </Button>
                </div>
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

        {/* ========== Emergency Contacts Tab ========== */}
        {activeTab === 'emergency' && (
          <div className="space-y-6">
            {/* Header */}
            <Card className="border-red-200 bg-red-200">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-800">Emergency Contacts</h3>
                  <p className="text-sm text-red-600 mt-0.5">
                    These contacts will be notified automatically when a critical health reading is detected.
                    Make sure contact information is accurate and up-to-date.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contact List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">Your Emergency Contacts</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowAddContact(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" /> Add Contact
                </Button>
              </CardHeader>
              <CardContent>
                {isEmergencyLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading contacts...</div>
                ) : emergencyContacts.length === 0 ? (
                  <div className="text-center py-8">
                    <Phone className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-muted-foreground">No emergency contacts added yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Add at least one contact so we can reach someone during a health emergency.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emergencyContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                            {contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{contact.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{contact.relationship}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm">{contact.phone}</p>
                            {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            {contact.is_primary && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                Primary
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteEmergencyContact(contact.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Contact Form */}
            {showAddContact && (
              <Card className="border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Add Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Full Name *</Label>
                      <Input
                        placeholder="Jane Doe"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone Number *</Label>
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email (optional)</Label>
                      <Input
                        type="email"
                        placeholder="jane@example.com"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Relationship *</Label>
                      <Select
                        value={newContact.relationship}
                        onValueChange={(v) => setNewContact({ ...newContact, relationship: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spouse">Spouse / Partner</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="sibling">Sibling</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="doctor">Doctor / Physician</SelectItem>
                          <SelectItem value="caregiver">Caregiver</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newContact.is_primary}
                      onCheckedChange={(v) => setNewContact({ ...newContact, is_primary: v })}
                    />
                    <Label className="text-sm">Mark as primary contact</Label>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setShowAddContact(false)}>Cancel</Button>
                    <Button
                      onClick={handleAddEmergencyContact}
                      disabled={!newContact.name.trim() || !newContact.phone.trim() || !newContact.relationship}
                    >
                      Save Contact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alert History */}
            {emergencyAlertHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Alert History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {emergencyAlertHistory.slice(0, 10).map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded border p-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span>{log.alert_type || 'Critical Reading'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            log.status === 'sent' ? 'bg-green-100 text-green-700' :
                            log.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ========== Alert History Tab (FR8.2.4) ========== */}
        {activeTab === 'alertHistory' && (
          <div className="space-y-4">
            <Card className="shadow-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  Alert History
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  All past critical and warning alerts with timestamps, values, and acknowledgement status.
                </p>
              </CardHeader>
              <CardContent>
                {isAlertHistoryLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : alertHistory.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    <AlertTriangle className="w-10 h-10 mx-auto opacity-30 mb-2" />
                    <p>No alerts recorded yet. Alerts will appear here when abnormal readings are detected.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {alertHistory.map((alert: any, idx: number) => (
                      <div
                        key={alert.alert_id || idx}
                        className={`flex items-center justify-between rounded-lg border p-3 text-sm transition-colors ${
                          alert.type === 'critical' || alert.alert_type === 'CRITICAL'
                            ? 'border-red-200 bg-red-50/50 dark:bg-red-950/30 dark:border-red-800'
                            : alert.type === 'warning'
                            ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            alert.type === 'critical' || alert.alert_type === 'CRITICAL' ? 'bg-red-500' :
                            alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{alert.message || alert.alert_type || 'Alert'}</p>
                            <p className="text-xs text-muted-foreground">
                              {alert.biomarkerType || alert.biomarker_type || ''}
                              {alert.value ? ` - Value: ${alert.value}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Badge variant={alert.read || alert.acknowledged ? 'secondary' : 'outline'} className="text-xs">
                            {alert.read || alert.acknowledged ? '✓ Acknowledged' : 'Unread'}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(alert.timestamp || alert.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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