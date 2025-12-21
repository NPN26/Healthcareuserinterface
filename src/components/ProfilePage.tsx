import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  Bell,
  Target,
  Save,
  UserCircle2,
  Stethoscope,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner@2.0.3';

interface ProfilePageProps {
  user: any;
  onBack: () => void;
  onUpdate: (updatedUser: any) => void;
}

export function ProfilePage({ user, onBack, onUpdate }: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'goals' | 'security' | 'notifications'>('personal');
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

  const handleSavePersonalInfo = () => {
    const updatedUser = { ...user, ...formData };
    onUpdate(updatedUser);
    
    // Update in localStorage
    const users = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const updatedUsers = users.map((u: any) => u.id === user.id ? updatedUser : u);
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    localStorage.setItem('healthApp_currentUser', JSON.stringify(updatedUser));
    
    toast.success('Personal information updated successfully');
  };

  const handleSaveSecurity = () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (securityData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Update password
    const updatedUser = { ...user, password: securityData.newPassword };
    onUpdate(updatedUser);
    
    const users = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const updatedUsers = users.map((u: any) => u.id === user.id ? updatedUser : u);
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    localStorage.setItem('healthApp_currentUser', JSON.stringify(updatedUser));
    
    setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    toast.success('Password updated successfully');
  };

  const handleSaveNotifications = () => {
    const updatedUser = { ...user, ...notificationSettings };
    onUpdate(updatedUser);
    
    const users = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const updatedUsers = users.map((u: any) => u.id === user.id ? updatedUser : u);
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));
    localStorage.setItem('healthApp_currentUser', JSON.stringify(updatedUser));
    
    toast.success('Notification settings updated successfully');
  };

  const tabs = [
    { id: 'personal' as const, label: 'Personal Info', icon: UserIcon },
    { id: 'goals' as const, label: 'Health Goals', icon: Target },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
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
            <h1 className="text-2xl md:text-3xl mb-1">My Profile</h1>
            <p className="text-white/90 mb-3">{user.email}</p>
            <Badge className="bg-white/30 backdrop-blur-md text-white border-white/40 shadow-lg">
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content - Overlapping Cards */}
      <div className="w-full max-w-4xl mx-auto px-4 pb-8">
        {/* Tabs */}
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-2xl shadow-2xl mb-6 p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
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

        {/* Personal Info Tab */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            {/* Personal Information */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center">
                  <UserCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Personal Information</h3>
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
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
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
                <Button onClick={handleSavePersonalInfo} className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </Card>

            {/* Account Security Info */}
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
            </Card>
          </div>
        )}

        {/* Health Goals Tab */}
        {activeTab === 'goals' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Health Goals</h3>
                <p className="text-sm text-muted-foreground">Set and track your health objectives</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-muted-foreground">
                Your health goals help you stay on track. You can manage these from the dashboard goals manager.
              </p>
              <Button variant="outline" onClick={onBack}>
                Go to Goals Manager
              </Button>
            </div>
          </Card>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Security Settings</h3>
                <p className="text-sm text-muted-foreground">Manage your password and security preferences</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={securityData.currentPassword}
                  onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={securityData.newPassword}
                  onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={securityData.confirmPassword}
                  onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveSecurity} className="bg-gradient-to-r from-red-500 to-orange-600">
                  <Save className="w-4 h-4 mr-2" />
                  Update Password
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Notification Preferences</h3>
                <p className="text-sm text-muted-foreground">Configure how you receive alerts and updates</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive health alerts via email</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) =>
                    setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive alerts on your device</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.pushNotifications}
                  onChange={(e) =>
                    setNotificationSettings({ ...notificationSettings, pushNotifications: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">SMS Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive critical alerts via SMS</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.smsNotifications}
                  onChange={(e) =>
                    setNotificationSettings({ ...notificationSettings, smsNotifications: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="space-y-2">
                <Label>Alert Threshold</Label>
                <Select
                  value={notificationSettings.alertThreshold}
                  onValueChange={(value) => setNotificationSettings({ ...notificationSettings, alertThreshold: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - All notifications</SelectItem>
                    <SelectItem value="medium">Medium - Important only</SelectItem>
                    <SelectItem value="high">High - Critical only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveNotifications} className="bg-gradient-to-r from-purple-500 to-pink-600">
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}