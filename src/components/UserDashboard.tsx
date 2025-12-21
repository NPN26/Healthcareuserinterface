import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  Activity, 
  Heart, 
  Droplet, 
  Wind, 
  Footprints, 
  Moon, 
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  Share2,
  Download,
  MessageCircle,
  LayoutDashboard,
  TrendingUpIcon,
  Smartphone,
  Bot,
  Settings,
  Flame,
  User,
  LogOut,
  Search,
  Sun,
  MoonIcon,
  Plus,
  Calendar,
  FileText,
  AlertCircle
} from 'lucide-react';
import { BiomarkerChart } from './BiomarkerChart';
import { DeviceCard } from './DeviceCard';
import { VirtualCompanion } from './VirtualCompanion';
import { AlertsPanel } from './AlertsPanel';
import { StatsComparison } from './StatsComparison';
import { DailySummary } from './DailySummary';
import { ProfilePage } from './ProfilePage';
import { 
  Biomarker, 
  Device, 
  Alert,
  generateBiomarkerData,
  getBiomarkerLabel,
  getBiomarkerUnit,
  isAbnormalReading
} from '../utils/mockData';
import { toast } from 'sonner@2.0.3';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
} from './ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { GoalsManager } from './GoalsManager';
import { ManualDataEntry } from './ManualDataEntry';
import { Target } from 'lucide-react';

interface UserDashboardProps {
  user: any;
  onLogout: () => void;
}

export function UserDashboard({ user, onLogout }: UserDashboardProps) {
  const [currentUser, setCurrentUser] = useState(user);
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showCompanion, setShowCompanion] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [activeView, setActiveView] = useState<'overview' | 'trends' | 'devices' | 'heartRate' | 'bloodPressure' | 'activities' | 'calories' | 'settings'>('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
    // Check for dark mode preference
    const darkMode = localStorage.getItem('healthApp_darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }

    // Simulate real-time updates
    const interval = setInterval(() => {
      simulateNewReading();
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const loadData = () => {
    const storedBiomarkers = JSON.parse(localStorage.getItem('healthApp_biomarkers') || '[]');
    const storedDevices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
    const storedAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');

    setBiomarkers(storedBiomarkers.filter((b: Biomarker) => b.userId === user.id));
    setDevices(storedDevices.filter((d: Device) => d.userId === user.id));
    setAlerts(storedAlerts.filter((a: Alert) => a.userId === user.id && !a.read));
  };

  const simulateNewReading = () => {
    if (devices.length === 0) return;

    const activeDevices = devices.filter(d => d.status === 'active');
    if (activeDevices.length === 0) return;

    const device = activeDevices[0];
    const types: Biomarker['type'][] = ['heartRate', 'oxygen'];
    const type = types[Math.floor(Math.random() * types.length)];

    const newReading = generateBiomarkerData(user.id, device.id, type, new Date());

    // Check for abnormal reading
    if (isAbnormalReading(type, newReading.value) || newReading.isFaulty) {
      const newAlert: Alert = {
        id: `alert-${Date.now()}`,
        userId: user.id,
        type: newReading.isFaulty ? 'fault' : 'warning',
        message: newReading.isFaulty 
          ? `Faulty reading detected: ${getBiomarkerLabel(type)} shows ${newReading.value} ${getBiomarkerUnit(type)}`
          : `${getBiomarkerLabel(type)} is ${newReading.value > 100 ? 'high' : 'low'}: ${newReading.value} ${getBiomarkerUnit(type)}`,
        timestamp: new Date().toISOString(),
        biomarkerType: type,
        read: false,
      };

      const updatedAlerts = [...alerts, newAlert];
      setAlerts(updatedAlerts);

      const allAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');
      localStorage.setItem('healthApp_alerts', JSON.stringify([...allAlerts, newAlert]));

      toast.error(newAlert.message);
    }

    const updatedBiomarkers = [...biomarkers, newReading];
    setBiomarkers(updatedBiomarkers);

    const allBiomarkers = JSON.parse(localStorage.getItem('healthApp_biomarkers') || '[]');
    localStorage.setItem('healthApp_biomarkers', JSON.stringify([...allBiomarkers, newReading]));
  };

  const getLatestBiomarker = (type: Biomarker['type']) => {
    const filtered = biomarkers.filter(b => b.type === type);
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  const getTrend = (type: Biomarker['type']): 'up' | 'down' | 'stable' => {
    const filtered = biomarkers.filter(b => b.type === type).slice(-10);
    if (filtered.length < 2) return 'stable';

    const recent = filtered.slice(-3).reduce((sum, b) => sum + b.value, 0) / 3;
    const previous = filtered.slice(-6, -3).reduce((sum, b) => sum + b.value, 0) / 3;

    if (recent > previous * 1.05) return 'up';
    if (recent < previous * 0.95) return 'down';
    return 'stable';
  };

  const shareStats = async () => {
    const latest = getLatestBiomarker('steps');
    const text = `Today I walked ${latest?.value || 0} steps! 🚶 #HealthTracking`;
    
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        toast.success('Stats copied to clipboard!');
      }
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Stats copied to clipboard!');
    }
  };

  const downloadReport = () => {
    toast.success('Daily report downloaded!');
  };

  const handleLogout = () => {
    onLogout();
    toast.success('Logged out successfully');
  };

  const handleUpdateUser = (updatedUser: any) => {
    setCurrentUser(updatedUser);
  };

  const biomarkerCards = [
    { type: 'heartRate' as const, icon: Heart, color: 'text-red-500' },
    { type: 'bloodPressure' as const, icon: Activity, color: 'text-purple-500' },
    { type: 'glucose' as const, icon: Droplet, color: 'text-blue-500' },
    { type: 'oxygen' as const, icon: Wind, color: 'text-cyan-500' },
    { type: 'steps' as const, icon: Footprints, color: 'text-green-500' },
    { type: 'sleep' as const, icon: Moon, color: 'text-indigo-500' },
  ];

  const mainMenuItems = [
    { id: 'overview' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trends' as const, label: 'Analytics', icon: TrendingUpIcon },
    { id: 'devices' as const, label: 'My Devices', icon: Smartphone },
  ];

  const healthStatusItems = [
    { id: 'heartRate' as const, label: 'Heart Rate', icon: Heart, color: 'text-red-500', unit: 'bpm' },
    { id: 'bloodPressure' as const, label: 'Blood Pressure', icon: Activity, color: 'text-purple-500', unit: 'mmHg' },
    { id: 'activities' as const, label: 'Activity', icon: Footprints, color: 'text-green-500', unit: 'steps' },
    { id: 'calories' as const, label: 'Calories', icon: Flame, color: 'text-orange-500', unit: 'kcal' },
  ];

  const quickActions = [
    { label: 'Log Reading', icon: Plus, action: () => setShowManualEntry(true) },
    { label: 'Set Goals', icon: Target, action: () => setShowGoals(true) },
    { label: 'Report', icon: FileText, action: downloadReport },
    { label: 'AI Assistant', icon: Bot, action: () => setShowCompanion(true) },
  ];

  const renderContent = () => {
    // Show profile page if showProfile is true
    if (showProfile) {
      return null; // Profile is rendered outside sidebar  
    }

    switch (activeView) {
      case 'overview':
        return (
          <div className="space-y-6">
            <DailySummary biomarkers={biomarkers} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {biomarkerCards.slice(0, 4).map(({ type }) => (
                <BiomarkerChart 
                  key={type}
                  biomarkers={biomarkers.filter(b => b.type === type)}
                  type={type}
                />
              ))}
            </div>
          </div>
        );
      
      case 'trends':
        return (
          <div className="space-y-6">
            {biomarkerCards.map(({ type }) => (
              <BiomarkerChart 
                key={type}
                biomarkers={biomarkers.filter(b => b.type === type)}
                type={type}
                showDetails
              />
            ))}
          </div>
        );
      
      case 'devices':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map(device => (
              <DeviceCard 
                key={device.id} 
                device={device}
                onUpdate={loadData}
              />
            ))}
          </div>
        );
      
      case 'heartRate':
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-foreground mb-4">Heart Rate Monitoring</h3>
              <BiomarkerChart 
                biomarkers={biomarkers.filter(b => b.type === 'heartRate')}
                type="heartRate"
                showDetails
              />
            </Card>
          </div>
        );
      
      case 'bloodPressure':
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-foreground mb-4">Blood Pressure Monitoring</h3>
              <BiomarkerChart 
                biomarkers={biomarkers.filter(b => b.type === 'bloodPressure')}
                type="bloodPressure"
                showDetails
              />
            </Card>
          </div>
        );
      
      case 'activities':
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-foreground mb-4">Activity Tracking</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BiomarkerChart 
                  biomarkers={biomarkers.filter(b => b.type === 'steps')}
                  type="steps"
                  showDetails
                />
                <BiomarkerChart 
                  biomarkers={biomarkers.filter(b => b.type === 'sleep')}
                  type="sleep"
                  showDetails
                />
              </div>
            </Card>
          </div>
        );
      
      case 'calories':
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-foreground mb-4">Calorie Tracking</h3>
              <p className="text-muted-foreground mb-6">Track your daily calorie intake and expenditure</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">Burned</p>
                  </div>
                  <p className="text-2xl font-semibold">2,340</p>
                  <p className="text-xs text-muted-foreground mt-1">kcal today</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Droplet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">Consumed</p>
                  </div>
                  <p className="text-2xl font-semibold">1,850</p>
                  <p className="text-xs text-muted-foreground mt-1">kcal today</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">Net Balance</p>
                  </div>
                  <p className="text-2xl font-semibold text-green-600 dark:text-green-400">-490</p>
                  <p className="text-xs text-muted-foreground mt-1">kcal deficit</p>
                </div>
              </div>
            </Card>
          </div>
        );
      
      case 'settings':
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-foreground mb-6">Settings</h3>
              <div className="space-y-3">
                <button onClick={() => setShowProfile(true)} className="w-full p-4 border border-border rounded-lg hover:bg-accent transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4>Profile Settings</h4>
                      <p className="text-sm text-muted-foreground">Manage your personal information</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-4 border border-border rounded-lg hover:bg-accent transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4>Notifications</h4>
                      <p className="text-sm text-muted-foreground">Configure alerts and reminders</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-4 border border-border rounded-lg hover:bg-accent transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4>Privacy & Security</h4>
                      <p className="text-sm text-muted-foreground">Control your data and privacy</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-4 border border-border rounded-lg hover:bg-accent transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h4>Device Sync</h4>
                      <p className="text-sm text-muted-foreground">Manage connected devices</p>
                    </div>
                  </div>
                </button>
              </div>
            </Card>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      {showProfile ? (
        <ProfilePage 
          user={currentUser} 
          onBack={() => setShowProfile(false)} 
          onUpdate={handleUpdateUser}
        />
      ) : (
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">HealthSync</p>
                <p className="text-xs text-muted-foreground">Health Monitoring</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainMenuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeView === item.id}
                        onClick={() => setActiveView(item.id)}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupLabel>Health Metrics</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {healthStatusItems.map((item) => {
                    const latest = item.id === 'heartRate' 
                      ? getLatestBiomarker('heartRate')
                      : item.id === 'bloodPressure' 
                      ? getLatestBiomarker('bloodPressure')
                      : item.id === 'activities'
                      ? getLatestBiomarker('steps')
                      : null;

                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activeView === item.id}
                          onClick={() => setActiveView(item.id)}
                        >
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                          <span>{item.label}</span>
                          {latest && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {item.id === 'bloodPressure' && latest.systolic
                                ? `${latest.systolic}/${latest.diastolic}`
                                : item.id === 'calories'
                                ? '2.3k'
                                : latest.value?.toFixed(0)}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeView === 'settings'}
                      onClick={() => setActiveView('settings')}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            {alerts.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-900 dark:text-amber-300 font-medium">{alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl px-4">
              <SidebarTrigger className="-ml-1" />
              
              {/* Search Bar */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search health metrics, devices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>

              {/* Right Side Actions */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDarkMode}
                  className="h-9 w-9"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 relative"
                >
                  <Bell className="w-4 h-4" />
                  {alerts.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </Button>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 px-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple text-white text-xs">
                          {user.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="ml-2 hidden md:inline">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowProfile(true)}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveView('settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <div className="p-4 md:p-8">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {quickActions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      onClick={action.action}
                      className="h-auto flex-col gap-2 p-4"
                    >
                      <action.icon className="w-5 h-5" />
                      <span className="text-xs">{action.label}</span>
                    </Button>
                  ))}
                </div>

                {/* Quick Stats Grid - Only on Overview */}
                {activeView === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {biomarkerCards.map(({ type, icon: Icon, color }) => {
                      const latest = getLatestBiomarker(type);
                      const trend = getTrend(type);
                      const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

                      return (
                        <Card key={type} className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                          onClick={() => {
                            if (type === 'heartRate') setActiveView('heartRate');
                            if (type === 'bloodPressure') setActiveView('bloodPressure');
                            if (type === 'steps') setActiveView('activities');
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-3 rounded-xl bg-gradient-to-br from-background to-accent ${color}`}>
                                <Icon className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">{getBiomarkerLabel(type)}</p>
                                <p className="mt-1">
                                  {type === 'bloodPressure' && latest 
                                    ? `${latest.systolic}/${latest.diastolic}`
                                    : type === 'steps' 
                                    ? Math.round(latest?.value || 0)
                                    : latest?.value.toFixed(1) || '--'}
                                  <span className="text-sm text-muted-foreground ml-1">
                                    {getBiomarkerUnit(type)}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1 text-sm ${
                              trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-muted-foreground'
                            }`}>
                              <TrendIcon className="w-4 h-4" />
                            </div>
                          </div>
                          {latest?.isFaulty && (
                            <Badge variant="destructive" className="mt-3">Faulty Reading</Badge>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Main Content */}
                {renderContent()}
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
      )}
      {/* Virtual Companion */}
      <VirtualCompanion 
        isOpen={showCompanion}
        onClose={() => setShowCompanion(false)}
        biomarkers={biomarkers}
        devices={devices}
        user={user}
      />

      {/* Goals Manager */}
      <GoalsManager
        isOpen={showGoals}
        onClose={() => setShowGoals(false)}
        userId={user.id}
        biomarkers={biomarkers}
      />

      {/* Manual Data Entry */}
      <ManualDataEntry
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        userId={user.id}
        deviceId={devices.find(d => d.status === 'active')?.id || devices[0]?.id || 'manual-entry'}
        onDataAdded={loadData}
      />
    </SidebarProvider>
  );
}