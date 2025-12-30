import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Activity, Flame, Droplet, Settings, Smartphone, Bell, User, Heart, Wind, Footprints, Moon, Plus } from 'lucide-react';
import { 
  BiomarkerChart, 
  DeviceCard, 
  VirtualCompanion, 
  DailySummary, 
  ProfilePage,
  GoalsManager,
  ManualDataEntry,
  SidebarBranding,
  MainMenuSection,
  HealthMetricsSection,
  QuickActionsGrid,
  QuickStatsGrid,
  DashboardHeader,
  SidebarFooterAlerts
} from './user';
import { 
  Biomarker, 
  Device, 
  Alert,
  generateBiomarkerData,
  isAbnormalReading,
  getBiomarkerLabel,
  getBiomarkerUnit
} from '../utils/mockData';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from './ui/sidebar';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  const [showAddDevice, setShowAddDevice] = useState(false);
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

  const simulateNewReading = async () => {
    if (devices.length === 0) return;

    const activeDevices = devices.filter(d => d.status === 'active');
    if (activeDevices.length === 0) return;

    const device = activeDevices[0];
    const types: Biomarker['type'][] = ['heartRate', 'oxygen'];
    const type = types[Math.floor(Math.random() * types.length)];

    const newReading = generateBiomarkerData(user.id, device.id, type, new Date());

    // Save to database
    try {
      const { supabase } = await import('../utils/supabase');
      
      // Map frontend type to database enum
      const typeMapping: Record<string, string> = {
        'heartRate': 'HEART_RATE',
        'bloodPressure': 'BLOOD_PRESSURE',
        'glucose': 'BLOOD_GLUCOSE',
        'oxygen': 'SPO2',
        'steps': 'STEPS',
        'sleep': 'SLEEP',
        'temperature': 'RESPIRATORY_RATE',
        'weight': 'WEIGHT'
      };

      // First, create data_point
      const { data: dataPoint, error: dataPointError } = await supabase
        .from('data_points')
        .insert({
          user_id: user.user_id || user.id,
          source_id: device.id,
          timestamp: newReading.timestamp,
          data_type: 'BIOMARKER'
        })
        .select()
        .single();

      if (dataPointError) {
        console.error('Error inserting data point:', dataPointError);
      } else if (dataPoint) {
        // Then, create biomarker_data
        const { error: biomarkerError } = await supabase
          .from('biomarker_data')
          .insert({
            data_point_id: dataPoint.data_point_id,
            type: typeMapping[type] || 'HEART_RATE',
            value: newReading.value,
            secondary_value: newReading.diastolic || null,
            unit: getBiomarkerUnit(type)
          });

        if (biomarkerError) {
          console.error('Error inserting biomarker:', biomarkerError);
        }
      }
    } catch (error) {
      console.error('Database error:', error);
      // Continue with localStorage as fallback
    }

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

  const handleAddDevice = async (deviceData: { name: string; type: Device['type'] }) => {
    const newDevice: Device = {
      id: `device-${Date.now()}`,
      userId: user.id,
      name: deviceData.name,
      type: deviceData.type,
      status: 'active',
      batteryLevel: 100,
      lastSync: new Date().toISOString(),
      autoMode: true
    };

    // Save to database
    try {
      const { supabase } = await import('../utils/supabase');
      
      const { data, error } = await supabase
        .from('data_sources')
        .insert({
          source_id: newDevice.id,
          user_id: user.user_id || user.id,
          name: newDevice.name,
          status: 'CONNECTED',
          last_sync: newDevice.lastSync,
          priority: 1,
          metadata: {
            device_type: newDevice.type,
            battery_level: newDevice.batteryLevel,
            auto_mode: newDevice.autoMode,
            status: newDevice.status
          }
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding device to database:', error);
      }
    } catch (error) {
      console.error('Database error:', error);
    }

    const allDevices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
    const updatedDevices = [...allDevices, newDevice];
    localStorage.setItem('healthApp_devices', JSON.stringify(updatedDevices));
    
    loadData();
    setShowAddDevice(false);
    toast.success(`${deviceData.name} added successfully!`);
  };

  const handleCardClick = (type: Biomarker['type']) => {
    if (type === 'heartRate') setActiveView('heartRate');
    if (type === 'bloodPressure') setActiveView('bloodPressure');
    if (type === 'steps') setActiveView('activities');
  };

  const biomarkerCards = [
    { type: 'heartRate' as const, icon: Heart, color: 'text-red-500' },
    { type: 'bloodPressure' as const, icon: Activity, color: 'text-purple-500' },
    { type: 'glucose' as const, icon: Droplet, color: 'text-blue-500' },
    { type: 'oxygen' as const, icon: Wind, color: 'text-cyan-500' },
    { type: 'steps' as const, icon: Footprints, color: 'text-green-500' },
    { type: 'sleep' as const, icon: Moon, color: 'text-indigo-500' },
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
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-foreground">My Devices</h2>
              <Button onClick={() => setShowAddDevice(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Device
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map(device => (
                <DeviceCard 
                  key={device.id} 
                  device={device}
                  onUpdate={loadData}
                />
              ))}
            </div>
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
        <Sidebar className="flex flex-col h-screen">
          <SidebarBranding />

          <SidebarContent className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <MainMenuSection 
              activeView={activeView}
              onViewChange={setActiveView}
            />

            <SidebarSeparator className="w-[90%] mx-auto" />

            <HealthMetricsSection
              activeView={activeView}
              onViewChange={setActiveView}
              getLatestBiomarker={getLatestBiomarker}
            />

            <SidebarSeparator className="w-[90%] mx-auto" />

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

          <SidebarFooterAlerts alerts={alerts} />
        </Sidebar>

        <SidebarInset>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <DashboardHeader
              user={user}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
              alertCount={alerts.length}
              onProfileClick={() => setShowProfile(true)}
              onSettingsClick={() => setActiveView('settings')}
              onLogout={handleLogout}
            />

            <div className="p-4 md:p-8">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Quick Actions */}
                <QuickActionsGrid
                  onLogReading={() => setShowManualEntry(true)}
                  onSetGoals={() => setShowGoals(true)}
                  onReport={downloadReport}
                  onAIAssistant={() => setShowCompanion(true)}
                />

                {/* Quick Stats Grid - Only on Overview */}
                {activeView === 'overview' && (
                  <QuickStatsGrid
                    biomarkers={biomarkers}
                    getLatestBiomarker={getLatestBiomarker}
                    getTrend={getTrend}
                    onCardClick={handleCardClick}
                  />
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

      {/* Add Device Dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleAddDevice({
              name: formData.get('name') as string,
              type: formData.get('type') as Device['type']
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Device Name</Label>
              <Input 
                id="name" 
                name="name" 
                placeholder="Enter device name" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Device Type</Label>
              <Select name="type" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smartwatch">Smart Watch</SelectItem>
                  <SelectItem value="glucometer">Glucometer</SelectItem>
                  <SelectItem value="bloodPressureMonitor">Blood Pressure Monitor</SelectItem>
                  <SelectItem value="scale">Scale</SelectItem>
                  <SelectItem value="thermometer">Thermometer</SelectItem>
                  <SelectItem value="sleepTracker">Sleep Tracker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddDevice(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Device</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}