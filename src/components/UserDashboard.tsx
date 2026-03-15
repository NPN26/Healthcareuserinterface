import { useState, useEffect, useRef } from 'react';
import { Card } from './ui/card';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Chart } from 'chart.js/auto';
import { Checkbox } from './ui/checkbox';
import { Activity, Flame, Droplet, Settings, User, Heart, Wind, Footprints, Moon, Plus, Scale, Zap, Target, Trophy, Star, Crown, Sparkles, Award, RefreshCw } from 'lucide-react';
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
  SidebarFooterAlerts,
  NotificationsPage,
  AchievementUnlockAnimation,
  CriticalAlertModal,
  isCriticalReading,
  AnnouncementBanner,
  type CriticalAlert,
  type Notification,
  type Achievement,
  type ProfileTab
} from './user';
import { StreakCelebration, calculateStreak, checkStreakMilestone, type StreakMilestone } from './user/StreakCelebration';
import { sendCriticalAlertEmail } from '../utils/emailService';
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
  const [profileInitialTab, setProfileInitialTab] = useState<ProfileTab>('personal');
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [activeView, setActiveView] = useState<'overview' | 'trends' | 'devices' | 'heartRate' | 'bloodPressure' | 'activities' | 'weight' | 'calories'>('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [achievementToShow, setAchievementToShow] = useState<Achievement | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedBiomarkers, setSelectedBiomarkers] = useState<Biomarker['type'][]>([]);
  const [reportDuration, setReportDuration] = useState<'6months' | '1year'>('6months');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [criticalAlert, setCriticalAlert] = useState<CriticalAlert | null>(null);
  const criticalAlertQueueRef = useRef<CriticalAlert[]>([]);
  const [streakMilestone, setStreakMilestone] = useState<StreakMilestone | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  
  // Track last generation time for each biomarker type (ref avoids stale closure issues in interval)
  const lastGeneratedTimeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    loadData();
    // Cleanup expired notifications on load
    import('../utils/supabase').then(({ cleanupExpiredNotifications }) => {
      cleanupExpiredNotifications();
    });
    // Check for dark mode preference
    const darkMode = localStorage.getItem('healthApp_darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Sync devices when page becomes visible (tab focus/refresh)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, syncing devices...');
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also sync on window focus
    const handleFocus = () => {
      console.log('Window focused, syncing devices...');
      loadData();
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Separate effect for simulating readings - depends on devices
  useEffect(() => {
    if (devices.length === 0) {
      return; // Don't set up interval if no devices yet
    }

    console.log('Setting up interval for', devices.length, 'devices');
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      simulateNewReading();
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [devices]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const loadData = async () => {
    let supabaseBiomarkers: Biomarker[] = [];
    let supabaseDevices: Device[] = [];
    let supabaseAlerts: Alert[] = [];
    let supabaseNotifications: Notification[] = [];
    let dbLoadSuccess = false;

    try {
      // Always try to load from Supabase first
      console.log('Loading data from Supabase database');
      const { fetchBiomarkers, fetchDevices, fetchAlerts, fetchNotifications } = await import('../utils/supabase');
      
      [supabaseBiomarkers, supabaseDevices, supabaseAlerts, supabaseNotifications] = await Promise.all([
        fetchBiomarkers(user.user_id || user.id),
        fetchDevices(user.user_id || user.id),
        fetchAlerts(user.user_id || user.id),
        fetchNotifications(user.user_id || user.id)
      ]);

      console.log(`Loaded from DB: ${supabaseBiomarkers.length} biomarkers, ${supabaseDevices.length} devices, ${supabaseNotifications.length} notifications`);
      dbLoadSuccess = true;
    } catch (error) {
      console.error('Error loading from Supabase, will try localStorage:', error);
    }

    // If database load was successful, use that data
    if (dbLoadSuccess) {
      setBiomarkers(supabaseBiomarkers);
      setDevices(supabaseDevices);
      setAlerts(supabaseAlerts);
      setNotifications(supabaseNotifications);
      setUnreadNotificationsCount(supabaseNotifications.filter(n => !n.is_read).length);
    } else {
      // Fallback to localStorage only if database fails completely
      console.log('Loading data from localStorage as fallback');
      const storedBiomarkers = JSON.parse(localStorage.getItem('healthApp_biomarkers') || '[]');
      const storedDevices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
      const storedAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');

      setBiomarkers(storedBiomarkers.filter((b: Biomarker) => b.userId === user.id));
      setDevices(storedDevices.filter((d: Device) => d.userId === user.id));
      setAlerts(storedAlerts.filter((a: Alert) => a.userId === user.id && !a.read));
      setNotifications([]);
      setUnreadNotificationsCount(0);
    }
  };

  // ── Streak tracking ──
  useEffect(() => {
    if (biomarkers.length === 0) return;
    const timestamps = biomarkers.map(b => b.timestamp);
    const streak = calculateStreak(timestamps);
    setCurrentStreak(streak);
    const milestone = checkStreakMilestone(user.user_id || user.id, streak);
    if (milestone) {
      setStreakMilestone(milestone);
    }
  }, [biomarkers]);

  // Sync all active devices - updates their last_sync timestamp
  const syncAllDevices = async () => {
    const activeDevices = devices.filter(d => d.status === 'active');
    
    if (activeDevices.length === 0) {
      toast.info('No active devices to sync');
      return;
    }

    toast.info(`Syncing ${activeDevices.length} device(s)...`);
    
    const syncTime = new Date().toISOString();
    
    try {
      const { supabase } = await import('../utils/supabase');
      
      // Update last_sync for all active devices
      const updatePromises = activeDevices.map(device => 
        supabase
          .from('data_sources')
          .update({ last_sync: syncTime })
          .eq('source_id', device.id)
      );
      
      await Promise.all(updatePromises);
      
      // Reload data to get updated timestamps
      await loadData();
      
      toast.success(`Successfully synced ${activeDevices.length} device(s)`);
    } catch (error) {
      console.error('Error syncing devices:', error);
      toast.error('Failed to sync devices');
    }
  };

  // Helper function to check and unlock achievements
  const checkAchievements = (biomarkerCount: number, stepCount?: number) => {
    const userId = user.id || user.user_id;
    const stored = localStorage.getItem(`achievements_${userId}`);
    let achievements = stored ? JSON.parse(stored) : [];

    // Initialize achievements if empty
    if (achievements.length === 0) {
      achievements = [
        { id: 'first-reading', title: 'First Step', description: 'Record your first health reading', icon: 'Heart', category: 'health', rarity: 'common', unlocked: false, requirement: 1, progress: 0 },
        { id: 'step-master', title: 'Step Master', description: 'Reach 10,000 steps in a single day', icon: 'Zap', category: 'activity', rarity: 'common', unlocked: false, requirement: 10000, progress: 0 },
        { id: 'week-streak', title: 'Week Warrior', description: 'Log readings for 7 consecutive days', icon: 'Target', category: 'consistency', rarity: 'common', unlocked: false, requirement: 7, progress: 0 },
      ];
    }

    // Check for first reading achievement
    const firstReading = achievements.find((a: any) => a.id === 'first-reading');
    if (firstReading && !firstReading.unlocked && biomarkerCount >= 1) {
      firstReading.unlocked = true;
      firstReading.unlockedAt = new Date().toISOString();
      firstReading.progress = biomarkerCount;
      
      // Show animation
      setAchievementToShow({
        ...firstReading,
        icon: Heart,
        unlockedAt: new Date(firstReading.unlockedAt)
      });
      
      toast.success('🏆 Achievement Unlocked: First Step!');
      localStorage.setItem(`achievements_${userId}`, JSON.stringify(achievements));

      // Create ACHIEVEMENT notification in database
      import('../utils/supabase').then(({ createNotification }) => {
        createNotification(
          user.user_id || user.id,
          'ACHIEVEMENT',
          '🏆 Achievement Unlocked: First Step - You recorded your first health reading!'
        );
      });
    }

    // Check for step master achievement
    if (stepCount && stepCount >= 10000) {
      const stepMaster = achievements.find((a: any) => a.id === 'step-master');
      if (stepMaster && !stepMaster.unlocked) {
        stepMaster.unlocked = true;
        stepMaster.unlockedAt = new Date().toISOString();
        stepMaster.progress = stepCount;
        
        setAchievementToShow({
          ...stepMaster,
          icon: Zap,
          unlockedAt: new Date(stepMaster.unlockedAt)
        });
        
        toast.success('🏆 Achievement Unlocked: Step Master!');
        localStorage.setItem(`achievements_${userId}`, JSON.stringify(achievements));

        // Create ACHIEVEMENT notification in database
        import('../utils/supabase').then(({ createNotification }) => {
          createNotification(
            user.user_id || user.id,
            'ACHIEVEMENT',
            '🏆 Achievement Unlocked: Step Master - You reached 10,000 steps in a single day!'
          );
        });
      }
    }
  };

  const simulateNewReading = async () => {
    console.log('simulateNewReading called - devices:', devices.length);
    
    if (devices.length === 0) {
      console.log('No devices found, skipping reading generation');
      return;
    }

    const activeDevices = devices.filter(d => d.status === 'active');
    console.log('Active devices:', activeDevices.length);
    
    if (activeDevices.length === 0) {
      console.log('No active devices found, skipping reading generation');
      return;
    }

    // Pick a random active device (gives all devices a chance)
    const device = activeDevices[Math.floor(Math.random() * activeDevices.length)];
    // Use device's supported biomarkers or fallback to default types
    const types: Biomarker['type'][] = device.supportedBiomarkers || ['heartRate', 'oxygen'];
    
    console.log(`Device "${device.name}" supported biomarkers:`, types);
    
    // Filter types based on frequency rules
    const now = Date.now();
    const availableTypes = types.filter(type => {
      const lastTime = lastGeneratedTimeRef.current[type] || 0;
      const timeSince = now - lastTime;
      
      // Steps: only generate every 10 minutes (600000 ms)
      if (type === 'steps') {
        return timeSince >= 600000; // 10 minutes
      }
      
      // Sleep: only generate twice per day (12 hours = 43200000 ms)
      if (type === 'sleep') {
        return timeSince >= 43200000; // 12 hours
      }
      
      // Other types can be generated on the normal interval
      return true;
    });
    
    console.log('Available types after frequency filter:', availableTypes);
    
    if (availableTypes.length === 0) {
      console.log('No biomarkers ready for generation based on frequency rules');
      return;
    }
    
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    const newReading = generateBiomarkerData(user.id, device.id, type);
    
    // Update last generated time for this type
    lastGeneratedTimeRef.current = { ...lastGeneratedTimeRef.current, [type]: now };
    console.log(`Generated new reading: ${type} for device "${device.name}":`, 
      type === 'bloodPressure' 
        ? `${newReading.systolic}/${newReading.diastolic} mmHg` 
        : `${newReading.value} ${getBiomarkerUnit(type)}`
    );

    // Dual-write: Save to Supabase database
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
        console.log('Data point created:', dataPoint.data_point_id);
        // Then, create biomarker_data
        // For blood pressure, use systolic as primary value and diastolic as secondary
        const { error: biomarkerError } = await supabase
          .from('biomarker_data')
          .insert({
            data_point_id: dataPoint.data_point_id,
            type: typeMapping[type] || 'HEART_RATE',
            value: type === 'bloodPressure' ? newReading.systolic : newReading.value,
            secondary_value: type === 'bloodPressure' ? newReading.diastolic : null,
            unit: getBiomarkerUnit(type)
          });

        if (biomarkerError) {
          console.error('Error inserting biomarker:', biomarkerError);
        } else {
          console.log('Biomarker data created successfully');
        }
      }
    } catch (error) {
      console.error('Database error:', error);
      // Continue with localStorage as fallback
    }

    // Check for abnormal reading (using user's custom thresholds if set)
    const userThresholds = currentUser.alertThresholds || undefined;
    if (isAbnormalReading(type, newReading.value, userThresholds) || newReading.isFaulty) {
      // Import UUID generator
      const { generateUUID } = await import('../utils/supabase');
      
      const newAlert: Alert = {
        id: generateUUID(), // Generate proper UUID for database compatibility
        userId: user.id,
        type: newReading.isFaulty ? 'fault' : 'warning',
        message: newReading.isFaulty 
          ? `Faulty reading detected: ${getBiomarkerLabel(type)} shows ${newReading.value} ${getBiomarkerUnit(type)}`
          : `${getBiomarkerLabel(type)} is ${newReading.value > 100 ? 'high' : 'low'}: ${newReading.value} ${getBiomarkerUnit(type)}`,
        timestamp: new Date().toISOString(),
        biomarkerType: type,
        read: false,
      };

      // Dual-write: Save to Supabase
      try {
        const { supabase } = await import('../utils/supabase');
        await supabase
          .from('notifications')
          .insert({
            notification_id: newAlert.id,
            user_id: user.user_id || user.id,
            type: 'ALERT',
            content: newAlert.message,
            is_read: false,
            timestamp: newAlert.timestamp
          });
      } catch (error) {
        console.error('Error saving alert to database:', error);
      }

      // Dual-write: Also save to localStorage for safety
      setAlerts(prev => [...prev, newAlert]);

      const allAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');
      localStorage.setItem('healthApp_alerts', JSON.stringify([...allAlerts, newAlert]));

      // Check if this reading is critically dangerous → show full-screen modal
      const readingValue = type === 'bloodPressure' ? (newReading.systolic || newReading.value) : newReading.value;
      if (isCriticalReading(type, readingValue)) {
        const critical: CriticalAlert = {
          id: newAlert.id,
          type: type as CriticalAlert['type'],
          value: readingValue,
          secondaryValue: type === 'bloodPressure' ? newReading.diastolic : undefined,
          message: newAlert.message,
          timestamp: newAlert.timestamp,
        };

        // Fire email notification for this critical reading
        sendCriticalAlertEmail(
          user.user_id || user.id,
          user.email || currentUser.email,
          {
            biomarker: getBiomarkerLabel(type),
            value: String(readingValue),
            severity: 'Critical',
            timestamp: newAlert.timestamp,
          }
        ).catch(console.error);

        // Queue it – if a modal is already open, add to queue
        if (criticalAlert) {
          criticalAlertQueueRef.current.push(critical);
        } else {
          setCriticalAlert(critical);
        }
      } else {
        toast.error(newAlert.message);
      }
    }

    // Dual-write: Update local state and localStorage
    // Use functional update to avoid stale closure overwriting fresh data from loadData()
    setBiomarkers(prev => {
      const updated = [...prev, newReading];
      const userBiomarkers = updated.filter(b => b.userId === user.id);
      checkAchievements(userBiomarkers.length, newReading.type === 'steps' ? newReading.value : undefined);
      return updated;
    });

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

  const downloadReport = async () => {
    setShowReportDialog(true);
  };

  const generateReport = async () => {
    try {
      setShowReportDialog(false);

      // Filter biomarkers by duration
      const cutoffDate = new Date();
      if (reportDuration === '6months') {
        cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      } else {
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      }

      // Filter biomarkers by selected types and duration
      const filteredBiomarkers = biomarkers.filter(b =>
        selectedBiomarkers.includes(b.type) &&
        new Date(b.timestamp) >= cutoffDate
      );

      if (filteredBiomarkers.length === 0) {
        toast.error('No data available for selected filters');
        return;
      }

      const doc = new jsPDF();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.text('Health Biomarkers Report', 14, yPosition);
      yPosition += 10;

      // User info
      doc.setFontSize(12);
      doc.text(`Patient: ${currentUser.name || 'User'}`, 14, yPosition);
      yPosition += 7;
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, yPosition);
      yPosition += 7;
      doc.text(`Duration: ${reportDuration === '6months' ? 'Last 6 Months' : 'Last 1 Year'}`, 14, yPosition);
      yPosition += 7;
      doc.text(`Total Readings: ${filteredBiomarkers.length}`, 14, yPosition);
      yPosition += 15;

      // Create chart images array first
      const chartImages = [];

      for (const type of selectedBiomarkers) {
        const typeBiomarkers = filteredBiomarkers
          .filter(b => b.type === type)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (typeBiomarkers.length === 0) continue;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 300;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const chart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: typeBiomarkers.map(b =>
                new Date(b.timestamp).toLocaleDateString()
              ),
              datasets: [{
                label: getBiomarkerLabel(type),
                data: typeBiomarkers.map(b => b.value),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
              }]
            },
            options: {
              responsive: false,
              animation: false,
              plugins: {
                title: {
                  display: true,
                  text: `${getBiomarkerLabel(type)} Trend`,
                  font: { size: 16 }
                },
                legend: {
                  display: true
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  title: {
                    display: true,
                    text: getBiomarkerUnit(type)
                  }
                }
              }
            }
          });

          await new Promise(resolve => setTimeout(resolve, 100));

          const imgData = canvas.toDataURL('image/png');
          chartImages.push(imgData);

          chart.destroy();
        }
      }

      // Now add all chart images to PDF
      for (const imgData of chartImages) {
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 20;
        }

        doc.addImage(imgData, 'PNG', 14, yPosition, 180, 67.5);
        yPosition += 75;
      }

      // Add new page for data table
      doc.addPage();
      yPosition = 20;

      // Summary Statistics
      doc.setFontSize(16);
      doc.text('Summary Statistics', 14, yPosition);
      yPosition += 10;

      selectedBiomarkers.forEach(type => {
        const typeData = filteredBiomarkers.filter(b => b.type === type);
        if (typeData.length === 0) return;

        const values = typeData.map(b => b.value);
        const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
        const min = Math.min(...values).toFixed(1);
        const max = Math.max(...values).toFixed(1);

        doc.setFontSize(12);
        doc.text(`${getBiomarkerLabel(type)}: Avg ${avg}, Min ${min}, Max ${max} ${getBiomarkerUnit(type)}`, 14, yPosition);
        yPosition += 7;
      });

      yPosition += 10;

      // Detailed data table
      const tableData = filteredBiomarkers
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50)
        .map(bio => [
          new Date(bio.timestamp).toLocaleString(),
          getBiomarkerLabel(bio.type),
          bio.value.toString(),
          getBiomarkerUnit(bio.type),
          devices.find(d => d.id === bio.deviceId)?.name || 'Unknown'
        ]);

      autoTable(doc, {
        head: [['Date & Time', 'Biomarker', 'Value', 'Unit', 'Device']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`health-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const handleLogout = () => {
    toast.success('Logged out successfully');
    onLogout();
  };

  // Critical alert acknowledgement handler
  const handleAcknowledgeCriticalAlert = (alertId: string) => {
    setCriticalAlert(null);
    // Show next queued critical alert if any
    if (criticalAlertQueueRef.current.length > 0) {
      const next = criticalAlertQueueRef.current.shift()!;
      setTimeout(() => setCriticalAlert(next), 300);
    }
  };

  // Date navigation handlers
  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      const today = new Date();
      return d > today ? today : d;
    });
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Filter biomarkers by selected date for QuickStatsGrid
  const selectedDateStr = selectedDate.toDateString();
  const filteredBiomarkers = biomarkers.filter(b =>
    new Date(b.timestamp).toDateString() === selectedDateStr
  );

  const getFilteredLatestBiomarker = (type: Biomarker['type']) => {
    const filtered = filteredBiomarkers.filter(b => b.type === type);
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  const getFilteredTrend = (type: Biomarker['type']): 'up' | 'down' | 'stable' => {
    const filtered = filteredBiomarkers.filter(b => b.type === type).slice(-10);
    if (filtered.length < 2) return 'stable';
    const recent = filtered.slice(-3).reduce((sum, b) => sum + b.value, 0) / 3;
    const previous = filtered.slice(-6, -3).reduce((sum, b) => sum + b.value, 0) / 3;
    if (recent > previous * 1.05) return 'up';
    if (recent < previous * 0.95) return 'down';
    return 'stable';
  };

  const handleUpdateUser = (updatedUser: any) => {
    setCurrentUser(updatedUser);
  };

  // Notification handlers
  const handleMarkNotificationAsRead = async (notificationId: string) => {
    try {
      const { markNotificationAsRead } = await import('../utils/supabase');
      const success = await markNotificationAsRead(notificationId);
      
      if (success) {
        setNotifications(prev => 
          prev.map(n => 
            n.notification_id === notificationId 
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
        toast.success('Notification marked as read');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    try {
      const { markAllNotificationsAsRead } = await import('../utils/supabase');
      const success = await markAllNotificationsAsRead(user.user_id || user.id);
      
      if (success) {
        const now = new Date().toISOString();
        setNotifications(prev => 
          prev.map(n => ({ ...n, is_read: true, read_at: now }))
        );
        setUnreadNotificationsCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const { deleteNotification } = await import('../utils/supabase');
      const success = await deleteNotification(notificationId);
      
      if (success) {
        const deletedNotification = notifications.find(n => n.notification_id === notificationId);
        setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
        if (deletedNotification && !deletedNotification.is_read) {
          setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
        }
        toast.success('Notification deleted');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      const { deleteAllNotifications } = await import('../utils/supabase');
      const success = await deleteAllNotifications(user.user_id || user.id);
      
      if (success) {
        setNotifications([]);
        setUnreadNotificationsCount(0);
        toast.success('All notifications deleted');
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      toast.error('Failed to delete all notifications');
    }
  };

  const handleRefreshNotifications = async () => {
    try {
      const { fetchNotifications } = await import('../utils/supabase');
      const freshNotifications = await fetchNotifications(user.user_id || user.id);
      setNotifications(freshNotifications);
      setUnreadNotificationsCount(freshNotifications.filter(n => !n.is_read).length);
      toast.success('Notifications refreshed');
    } catch (error) {
      console.error('Error refreshing notifications:', error);
      toast.error('Failed to refresh notifications');
    }
  };

  const handleAddDevice = async (deviceData: { name: string; type: Device['type']; supportedBiomarkers: Biomarker['type'][] }) => {
    // Import UUID generator
    const { generateUUID } = await import('../utils/supabase');
    
    const newDevice: Device = {
      id: generateUUID(), // Generate proper UUID for database compatibility
      userId: user.id,
      name: deviceData.name,
      type: deviceData.type,
      status: 'active',
      batteryLevel: 100,
      lastSync: new Date().toISOString(),
      autoMode: true,
      supportedBiomarkers: deviceData.supportedBiomarkers
    };

    // Dual-write: Save to Supabase database
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
            status: newDevice.status,
            supported_biomarkers: newDevice.supportedBiomarkers
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

    // Dual-write: Also save to localStorage for safety
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
    if (type === 'weight') setActiveView('weight');
  };

  const biomarkerCards = [
    { type: 'heartRate' as const, icon: Heart, color: 'text-red-500' },
    { type: 'bloodPressure' as const, icon: Activity, color: 'text-purple-500' },
    { type: 'glucose' as const, icon: Droplet, color: 'text-blue-500' },
    { type: 'oxygen' as const, icon: Wind, color: 'text-cyan-500' },
    { type: 'steps' as const, icon: Footprints, color: 'text-green-500' },
    { type: 'sleep' as const, icon: Moon, color: 'text-indigo-500' },
    { type: 'weight' as const, icon: Scale, color: 'text-orange-500' },
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
            <DailySummary biomarkers={biomarkers} selectedDate={selectedDate} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {biomarkerCards.slice(0, 4).map(({ type }) => (
                <BiomarkerChart 
                  key={type}
                  biomarkers={filteredBiomarkers.filter(b => b.type === type)}
                  type={type}
                  devices={devices}
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
                devices={devices}
              />
            ))}
          </div>
        );
      
      case 'devices':
        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">My Devices</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={syncAllDevices}>
                  <RefreshCw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sync Devices</span>
                </Button>
                <Button size="sm" onClick={() => setShowAddDevice(true)}>
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Device</span>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...devices].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map(device => (
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
                devices={devices}
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
                devices={devices}
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
                  devices={devices}
                />
                <BiomarkerChart 
                  biomarkers={biomarkers.filter(b => b.type === 'sleep')}
                  type="sleep"
                  showDetails
                  devices={devices}
                />
              </div>
            </Card>
          </div>
        );
      
      case 'weight':
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-foreground mb-4">Weight Tracking</h3>
              <BiomarkerChart 
                biomarkers={biomarkers.filter(b => b.type === 'weight')}
                type="weight"
                showDetails
                devices={devices}
              />
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
          initialTab={profileInitialTab}
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
                      onClick={() => { setProfileInitialTab('personal'); setShowProfile(true); }}
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
              onProfileClick={() => { setProfileInitialTab('personal'); setShowProfile(true); }}
              onSettingsClick={() => { setProfileInitialTab('personal'); setShowProfile(true); }}
              onLogout={handleLogout}
              selectedDate={selectedDate}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
              onToday={handleToday}
              notifications={notifications}
              unreadCount={unreadNotificationsCount}
              onMarkNotificationAsRead={handleMarkNotificationAsRead}
              onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
              onDeleteNotification={handleDeleteNotification}
              onViewAllNotifications={() => setShowNotifications(true)}
            />

            <div className="p-4 md:p-8">
              <div className="max-w-7xl mx-auto space-y-6">
                <AnnouncementBanner />
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
                    biomarkers={filteredBiomarkers}
                    getLatestBiomarker={getFilteredLatestBiomarker}
                    getTrend={getFilteredTrend}
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

      {/* Notifications Page */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 bg-background">
          <NotificationsPage
            userId={user.user_id || user.id}
            notifications={notifications}
            onBack={() => setShowNotifications(false)}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            onDelete={handleDeleteNotification}
            onDeleteAll={handleDeleteAllNotifications}
            onRefresh={handleRefreshNotifications}
          />
        </div>
      )}

      {/* Add Device Dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const selectedBiomarkers: Biomarker['type'][] = [];
            
            // Collect selected biomarkers from checkboxes
            const biomarkerTypes: Biomarker['type'][] = ['heartRate', 'bloodPressure', 'glucose', 'oxygen', 'steps', 'sleep', 'temperature', 'weight'];
            biomarkerTypes.forEach(type => {
              if (formData.get(type) === 'on') {
                selectedBiomarkers.push(type);
              }
            });
            
            if (selectedBiomarkers.length === 0) {
              toast.error('Please select at least one biomarker');
              return;
            }
            
            handleAddDevice({
              name: formData.get('name') as string,
              type: formData.get('type') as Device['type'],
              supportedBiomarkers: selectedBiomarkers
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
            <div className="space-y-3">
              <Label>Supported Biomarkers</Label>
              <p className="text-sm text-gray-500">Select the biomarkers this device can measure</p>
              <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="heartRate" name="heartRate" className="w-4 h-4" aria-label="Heart Rate" />
                  <Label htmlFor="heartRate" className="text-sm font-normal cursor-pointer">Heart Rate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="bloodPressure" name="bloodPressure" className="w-4 h-4" aria-label="Blood Pressure" />
                  <Label htmlFor="bloodPressure" className="text-sm font-normal cursor-pointer">Blood Pressure</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="glucose" name="glucose" className="w-4 h-4" aria-label="Glucose" />
                  <Label htmlFor="glucose" className="text-sm font-normal cursor-pointer">Glucose</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="oxygen" name="oxygen" className="w-4 h-4" aria-label="Blood Oxygen" />
                  <Label htmlFor="oxygen" className="text-sm font-normal cursor-pointer">Blood Oxygen</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="steps" name="steps" className="w-4 h-4" aria-label="Steps" />
                  <Label htmlFor="steps" className="text-sm font-normal cursor-pointer">Steps</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="sleep" name="sleep" className="w-4 h-4" aria-label="Sleep" />
                  <Label htmlFor="sleep" className="text-sm font-normal cursor-pointer">Sleep</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="temperature" name="temperature" className="w-4 h-4" aria-label="Temperature" />
                  <Label htmlFor="temperature" className="text-sm font-normal cursor-pointer">Temperature</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="weight" name="weight" className="w-4 h-4" aria-label="Weight" />
                  <Label htmlFor="weight" className="text-sm font-normal cursor-pointer">Weight</Label>
                </div>
              </div>
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

      {/* Report Configuration Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Health Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Duration Selection */}
            <div className="space-y-2">
              <Label htmlFor="duration">Report Duration</Label>
              <Select value={reportDuration} onValueChange={(value: '6months' | '1year') => setReportDuration(value)}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last 1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Biomarker Selection */}
            <div className="space-y-3">
              <Label>Select Biomarkers</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                {(['heartRate', 'bloodPressure', 'glucose', 'oxygen', 'steps', 'sleep', 'temperature', 'weight'] as Biomarker['type'][]).map((type) => (
                  <div key={type} className="flex items-center space-x-3 p-2 rounded-md hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    <Checkbox
                      id={`report-${type}`}
                      checked={selectedBiomarkers.includes(type)}
                      onCheckedChange={(checked: any) => {
                        if (checked) {
                          setSelectedBiomarkers([...selectedBiomarkers, type]);
                        } else {
                          setSelectedBiomarkers(selectedBiomarkers.filter(t => t !== type));
                        }
                      }}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label
                      htmlFor={`report-${type}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                    >
                      {getBiomarkerLabel(type)}
                    </label>
                  </div>
                ))}
              </div>
              {selectedBiomarkers.length === 0 && (
                <p className="text-sm text-red-500">Please select at least one biomarker</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowReportDialog(false)} size="sm">
                Cancel
              </Button>
              <Button
                onClick={generateReport}
                disabled={selectedBiomarkers.length === 0}
                size="sm"
              >
                Generate Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Critical Alert Modal - must-acknowledge overlay for dangerous readings */}
      <CriticalAlertModal
        alert={criticalAlert}
        onAcknowledge={handleAcknowledgeCriticalAlert}
      />

      {/* Achievement Unlock Animation */}
      {achievementToShow && (
        <AchievementUnlockAnimation
          achievement={achievementToShow}
          onClose={() => setAchievementToShow(null)}
        />
      )}

      {/* Streak Milestone Celebration */}
      <StreakCelebration
        milestone={streakMilestone}
        currentStreak={currentStreak}
        onDismiss={() => setStreakMilestone(null)}
      />
    </SidebarProvider>
  );
}