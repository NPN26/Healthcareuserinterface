import { useState, useEffect, useRef } from 'react';
import { Card } from './ui/card';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Chart } from 'chart.js/auto';
import { Checkbox } from './ui/checkbox';
import { Activity, Flame, Droplet, Settings, User, Heart, Wind, Footprints, Moon, Plus, Scale, Zap, Target, Trophy, Star, Crown, Sparkles, Award, RefreshCw, Edit2, Check, X } from 'lucide-react';
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
import { checkRateLimit } from '../utils/rateLimiter';
import {
  validateText,
  validateEnum,
  sanitizeText,
  containsDangerousPatterns,
} from '../utils/inputValidation';
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
  const BIOMARKER_LOOKBACK_DAYS = 30;
  const AUTO_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
  const dashboardUserId = user.user_id || user.id;
  const [currentUser, setCurrentUser] = useState(user);
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showCompanion, setShowCompanion] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<ProfileTab>('personal');
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [activeView, setActiveView] = useState<'overview' | 'trends' | 'devices' | 'heartRate' | 'bloodPressure' | 'activities' | 'weight' | 'calories'>(() => {
    const saved = localStorage.getItem('healthApp_activeView');
    return (saved as any) || 'overview';
  });
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
  const [burnedCalories, setBurnedCalories] = useState<number>(() => {
    const saved = localStorage.getItem('healthApp_burnedCalories');
    return saved ? parseInt(saved) : 2340;
  });
  const [consumedCalories, setConsumedCalories] = useState<number>(() => {
    const saved = localStorage.getItem('healthApp_consumedCalories');
    return saved ? parseInt(saved) : 1850;
  });
  const [showCalorieEditor, setShowCalorieEditor] = useState<'burned' | 'consumed' | null>(null);
  const [editCalorieValue, setEditCalorieValue] = useState('');
  const loadedBiomarkerRangesRef = useRef<Set<string>>(new Set());
  const loadingBiomarkerRangesRef = useRef<Set<string>>(new Set());
  const lastAutoRefreshAtRef = useRef<number>(0);
  
  // Track last generation time for each biomarker type (ref avoids stale closure issues in interval)
  const lastGeneratedTimeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    lastAutoRefreshAtRef.current = Date.now();
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

  // Sync devices when tab becomes visible, but avoid repeated refreshes.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastAutoRefreshAtRef.current < AUTO_REFRESH_COOLDOWN_MS) {
          return;
        }
        lastAutoRefreshAtRef.current = now;
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Separate effect for simulating readings - depends on devices
  useEffect(() => {
    if (devices.length === 0) {
      return; // Don't set up interval if no devices yet
    }

    let timeoutId: NodeJS.Timeout;
    const scheduleNext = () => {
      // Random interval between 1 and 5 minutes (in ms)
      const randomMs = Math.floor(Math.random() * (300000 - 60000 + 1)) + 60000;
      timeoutId = setTimeout(async () => {
        await simulateNewReading();
        scheduleNext();
      }, randomMs);
    };
    scheduleNext();

    return () => clearTimeout(timeoutId);
  }, [devices]);

  // Persist active view to localStorage
  useEffect(() => {
    localStorage.setItem('healthApp_activeView', activeView);
  }, [activeView]);

  // Persist calorie data to localStorage
  useEffect(() => {
    localStorage.setItem('healthApp_burnedCalories', String(burnedCalories));
  }, [burnedCalories]);

  useEffect(() => {
    localStorage.setItem('healthApp_consumedCalories', String(consumedCalories));
  }, [consumedCalories]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const loadData = async () => {
    if (biomarkers.length === 0) {
      setIsDataLoading(true);
    }
    let supabaseBiomarkers: Biomarker[] = [];
    let supabaseDevices: Device[] = [];
    let supabaseAlerts: Alert[] = [];
    let supabaseNotifications: Notification[] = [];
    let dbLoadSuccess = false;

    try {
      // Always try to load from Supabase first
      const { fetchBiomarkers, fetchDevices, fetchAlerts, fetchNotifications } = await import('../utils/supabase');

      const now = new Date();
      const rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - BIOMARKER_LOOKBACK_DAYS);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeKey = `${rangeStart.toISOString()}|${now.toISOString()}`;

      [supabaseBiomarkers, supabaseDevices, supabaseAlerts, supabaseNotifications] = await Promise.all([
        fetchBiomarkers(user.user_id || user.id, {
          startDate: rangeStart.toISOString(),
          endDate: now.toISOString(),
        }),
        fetchDevices(user.user_id || user.id),
        fetchAlerts(user.user_id || user.id),
        fetchNotifications(user.user_id || user.id)
      ]);

      dbLoadSuccess = true;
      loadedBiomarkerRangesRef.current.clear();
      loadedBiomarkerRangesRef.current.add(rangeKey);
      loadingBiomarkerRangesRef.current.clear();
    } catch (error) {
    }

    // If database load was successful, use that data
    if (dbLoadSuccess) {
      setBiomarkers(prev => mergeBiomarkers(prev, supabaseBiomarkers));
      setDevices(supabaseDevices);
      setAlerts(supabaseAlerts);
      setNotifications(supabaseNotifications);
      setUnreadNotificationsCount(supabaseNotifications.filter(n => !n.is_read).length);
    } else {
      // Fallback to localStorage only if database fails completely
      const { secureGetItem } = await import('../utils/secureStorage');
      const rawBiomarkers = await secureGetItem('healthApp_biomarkers');
      const rawDevices = await secureGetItem('healthApp_devices');
      const rawAlerts = await secureGetItem('healthApp_alerts');

      const storedBiomarkers = JSON.parse(rawBiomarkers || '[]');
      const storedDevices = JSON.parse(rawDevices || '[]');
      const storedAlerts = JSON.parse(rawAlerts || '[]');

      setBiomarkers(storedBiomarkers.filter((b: Biomarker) => b.userId === user.id));
      setDevices(storedDevices.filter((d: Device) => d.userId === user.id));
      setAlerts(storedAlerts.filter((a: Alert) => a.userId === user.id && !a.read));
      setNotifications([]);
      setUnreadNotificationsCount(0);
      loadedBiomarkerRangesRef.current.clear();
      loadingBiomarkerRangesRef.current.clear();
    }

    setIsDataLoading(false);
  };

  const mergeBiomarkers = (existing: Biomarker[], incoming: Biomarker[]) => {
    const byId = new Map(existing.map(b => [b.id, b]));
    incoming.forEach(b => byId.set(b.id, b));
    return Array.from(byId.values());
  };

  const requestUserBiomarkerRange = async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
    const rangeKey = `${startDate}|${endDate}`;
    if (loadedBiomarkerRangesRef.current.has(rangeKey) || loadingBiomarkerRangesRef.current.has(rangeKey)) {
      return;
    }

    loadingBiomarkerRangesRef.current.add(rangeKey);
    setIsDataLoading(true);
    try {
      const { fetchBiomarkers } = await import('../utils/supabase');
      const fetched = await fetchBiomarkers(user.user_id || user.id, { startDate, endDate });
      setBiomarkers(prev => mergeBiomarkers(prev, fetched));
      loadedBiomarkerRangesRef.current.add(rangeKey);
    } catch (error) {
    } finally {
      loadingBiomarkerRangesRef.current.delete(rangeKey);
      if (loadingBiomarkerRangesRef.current.size === 0) {
        setIsDataLoading(false);
      }
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
    if (devices.length === 0) {
      return;
    }

    const activeDevices = devices.filter(d => d.status === 'active');

    if (activeDevices.length === 0) {
      return;
    }

    // Pick a random active device (gives all devices a chance)
    const device = activeDevices[Math.floor(Math.random() * activeDevices.length)];
    // Use device's supported biomarkers or fallback to default types
    const types: Biomarker['type'][] = device.supportedBiomarkers || ['heartRate', 'oxygen'];
    
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

    if (availableTypes.length === 0) {
      return;
    }
    
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    const newReading = generateBiomarkerData(user.id, device.id, type);
    
    // Update last generated time for this type
    lastGeneratedTimeRef.current = { ...lastGeneratedTimeRef.current, [type]: now };

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
      } else if (dataPoint) {
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
        } else {
        }
      }
    } catch (error) {
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
      }

      // Dual-write: Also save to encrypted localStorage for safety
      setAlerts(prev => [...prev, newAlert]);

      import('../utils/secureStorage').then(async ({ secureGetItem, secureSetItem }) => {
        const raw = await secureGetItem('healthApp_alerts');
        const allAlerts = JSON.parse(raw || '[]');
        await secureSetItem('healthApp_alerts', JSON.stringify([...allAlerts, newAlert]));
      });

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
        ).catch(() => {});

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

    import('../utils/secureStorage').then(async ({ secureGetItem, secureSetItem }) => {
      const raw = await secureGetItem('healthApp_biomarkers');
      const allBiomarkers = JSON.parse(raw || '[]');
      await secureSetItem('healthApp_biomarkers', JSON.stringify([...allBiomarkers, newReading]));
    });
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
      // Rate-limit PDF generation
      const rateCheck = checkRateLimit('pdfGeneration', currentUser?.id || 'anonymous');
      if (!rateCheck.allowed) {
        toast.error(rateCheck.message);
        return;
      }

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

  const handleManualDataAdded = async (newReading: Biomarker) => {
    setBiomarkers(prev => {
      const withoutSameId = prev.filter(b => b.id !== newReading.id);
      const updated = [...withoutSameId, newReading];
      const userBiomarkers = updated.filter(b => b.userId === dashboardUserId);
      checkAchievements(userBiomarkers.length, newReading.type === 'steps' ? newReading.value : undefined);
      return updated;
    });

    // If the logged data is calories, add to consumed calories total
    if (newReading.type === 'calories') {
      setConsumedCalories(prev => prev + Math.round(newReading.value));
      toast.success(`${Math.round(newReading.value)} kcal added to daily intake`);
    }

    // Refresh from source of truth after optimistic update.
    await loadData();
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
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const { deleteNotification, fetchNotifications } = await import('../utils/supabase');
      const success = await deleteNotification(notificationId);
      
      if (success) {
        // Re-fetch from DB to guarantee UI reflects persisted state.
        const freshNotifications = await fetchNotifications(user.user_id || user.id);
        const stillExists = freshNotifications.some(n => n.notification_id === notificationId);

        if (stillExists) {
          toast.error('Delete did not persist to database');
          return;
        }

        setNotifications(freshNotifications);
        setUnreadNotificationsCount(freshNotifications.filter(n => !n.is_read).length);
        toast.success('Notification deleted');
      } else {
        toast.error('Failed to delete notification');
      }
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      const { deleteAllNotifications, fetchNotifications } = await import('../utils/supabase');
      const success = await deleteAllNotifications(user.user_id || user.id);
      
      if (success) {
        const freshNotifications = await fetchNotifications(user.user_id || user.id);
        setNotifications(freshNotifications);
        setUnreadNotificationsCount(freshNotifications.filter(n => !n.is_read).length);

        if (freshNotifications.length === 0) {
          toast.success('All notifications deleted');
        } else {
          toast.error('Some notifications could not be deleted');
        }
      } else {
        toast.error('Failed to delete all notifications');
      }
    } catch (error) {
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
      toast.error('Failed to refresh notifications');
    }
  };

  const handleAddDevice = async (deviceData: { name: string; type: Device['type']; supportedBiomarkers: Biomarker['type'][] }) => {
    // Validate device name
    const nameValidation = validateText(deviceData.name, {
      minLength: 2,
      maxLength: 100,
      required: true,
    });
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error || 'Please enter a valid device name');
      return;
    }

    // Check for dangerous patterns in device name
    const nameDangerCheck = containsDangerousPatterns(deviceData.name);
    if (nameDangerCheck.dangerous) {
      toast.error('Invalid device name');
      return;
    }

    // Validate device type
    const validDeviceTypes = ['smartwatch', 'glucometer', 'bloodPressureMonitor', 'scale', 'thermometer', 'sleepTracker'] as const;
    const typeValidation = validateEnum(deviceData.type, validDeviceTypes);
    if (!typeValidation.isValid) {
      toast.error('Please select a valid device type');
      return;
    }

    // Validate supported biomarkers
    const validBiomarkers = ['heartRate', 'bloodPressure', 'glucose', 'oxygen', 'steps', 'sleep', 'temperature', 'weight'] as const;
    for (const biomarker of deviceData.supportedBiomarkers) {
      const biomarkerValidation = validateEnum(biomarker, validBiomarkers);
      if (!biomarkerValidation.isValid) {
        toast.error('Invalid biomarker selection');
        return;
      }
    }

    // Sanitize device name
    const sanitizedName = sanitizeText(deviceData.name, { maxLength: 100 });

    // Import UUID generator
    const { generateUUID } = await import('../utils/supabase');

    const newDevice: Device = {
      id: generateUUID(), // Generate proper UUID for database compatibility
      userId: user.id,
      name: sanitizedName,
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
      }
    } catch (error) {
    }

    // Dual-write: Also save to encrypted localStorage for safety
    import('../utils/secureStorage').then(async ({ secureGetItem, secureSetItem }) => {
      const raw = await secureGetItem('healthApp_devices');
      const allDevices = JSON.parse(raw || '[]');
      const updatedDevices = [...allDevices, newDevice];
      await secureSetItem('healthApp_devices', JSON.stringify(updatedDevices));
    });
    
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

  const handleSaveCalorieValue = (type: 'burned' | 'consumed') => {
    const value = parseInt(editCalorieValue);

    if (!editCalorieValue || isNaN(value) || value < 0 || value > 10000) {
      toast.error('Please enter a valid calorie value (0-10000)');
      return;
    }

    if (type === 'burned') {
      setBurnedCalories(value);
    } else {
      setConsumedCalories(value);
    }

    setShowCalorieEditor(null);
    setEditCalorieValue('');
    toast.success(`${type === 'burned' ? 'Burned' : 'Consumed'} calories updated`);
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
                  biomarkers={biomarkers.filter(b => b.type === type)}
                  type={type}
                  devices={devices}
                  isLoading={isDataLoading}
                  onRequestRange={requestUserBiomarkerRange}
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
                isLoading={isDataLoading}
                onRequestRange={requestUserBiomarkerRange}
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
            {devices.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <h3 className="text-lg font-semibold text-foreground mb-2">No devices connected yet</h3>
                <p className="text-muted-foreground mb-5">Add your first device to start tracking biometrics automatically.</p>
                <Button onClick={() => setShowAddDevice(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Device
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...devices].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map(device => (
                  <DeviceCard 
                    key={device.id} 
                    device={device}
                    onUpdate={loadData}
                  />
                ))}
              </div>
            )}
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
                isLoading={isDataLoading}
                onRequestRange={requestUserBiomarkerRange}
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
                isLoading={isDataLoading}
                onRequestRange={requestUserBiomarkerRange}
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
                  isLoading={isDataLoading}
                  onRequestRange={requestUserBiomarkerRange}
                />
                <BiomarkerChart 
                  biomarkers={biomarkers.filter(b => b.type === 'sleep')}
                  type="sleep"
                  showDetails
                  devices={devices}
                  isLoading={isDataLoading}
                  onRequestRange={requestUserBiomarkerRange}
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
                isLoading={isDataLoading}
                onRequestRange={requestUserBiomarkerRange}
              />
            </Card>
          </div>
        );
      
      case 'calories':
        const netBalance = burnedCalories - consumedCalories;
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-foreground mb-4">Calorie Tracking</h3>
              <p className="text-muted-foreground mb-6">Track your daily calorie intake and expenditure</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Burned Calories Card */}
                <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-lg relative">
                  <button
                    onClick={() => {
                      setEditCalorieValue(String(burnedCalories));
                      setShowCalorieEditor('burned');
                    }}
                    className="absolute top-3 right-3 p-2 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-md transition"
                    title="Edit burned calories"
                  >
                    <Edit2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </button>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">Burned</p>
                  </div>
                  <p className="text-2xl font-semibold">{burnedCalories.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">kcal today</p>
                </div>

                {/* Consumed Calories Card */}
                <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg relative">
                  <button
                    onClick={() => {
                      setEditCalorieValue(String(consumedCalories));
                      setShowCalorieEditor('consumed');
                    }}
                    className="absolute top-3 right-3 p-2 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-md transition"
                    title="Edit consumed calories"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Droplet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">Consumed</p>
                  </div>
                  <p className="text-2xl font-semibold">{consumedCalories.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">kcal today</p>
                </div>

                {/* Net Balance Card */}
                <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">Net Balance</p>
                  </div>
                  <p className={`text-2xl font-semibold ${netBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{netBalance >= 0 ? 'kcal surplus' : 'kcal deficit'}</p>
                </div>
              </div>
            </Card>

            {/* Calorie Editor Dialog */}
            <Dialog open={showCalorieEditor !== null} onOpenChange={(open) => !open && setShowCalorieEditor(null)}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>
                    Edit {showCalorieEditor === 'burned' ? 'Burned' : 'Consumed'} Calories
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="calorie-value">Value (kcal)</Label>
                    <Input
                      id="calorie-value"
                      type="number"
                      min="0"
                      max="10000"
                      placeholder="e.g., 2000"
                      value={editCalorieValue}
                      onChange={(e) => setEditCalorieValue(e.target.value)}
                      className="mt-1"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-1">Enter a value between 0 and 10,000</p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => handleSaveCalorieValue(showCalorieEditor!)}
                      className="flex-1"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCalorieEditor(null);
                        setEditCalorieValue('');
                      }}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
              consumedCalories={consumedCalories}
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
              user={currentUser}
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
        user={currentUser}
      />

      {/* Goals Manager */}
      <GoalsManager
        isOpen={showGoals}
        onClose={() => setShowGoals(false)}
        userId={dashboardUserId}
        biomarkers={biomarkers}
      />

      {/* Manual Data Entry */}
      <ManualDataEntry
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        userId={dashboardUserId}
        onDataAdded={handleManualDataAdded}
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
                maxLength={100}
                minLength={2}
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
