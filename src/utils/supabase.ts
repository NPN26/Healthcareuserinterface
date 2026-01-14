import { createClient } from '@supabase/supabase-js'
import { Biomarker, Device, Alert } from './mockData'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Fetch biomarkers for a user from Supabase
 */
export async function fetchBiomarkers(userId: string): Promise<Biomarker[]> {
  try {
    const { data, error } = await supabase
      .from('data_points')
      .select(`
        data_point_id,
        timestamp,
        source_id,
        biomarker_data (
          type,
          value,
          secondary_value,
          unit
        )
      `)
      .eq('user_id', userId)
      .eq('data_type', 'BIOMARKER')
      .order('timestamp', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Error fetching biomarkers:', error)
      return []
    }

    if (!data) return []

    // Map database format to frontend format
    const typeMapping: Record<string, Biomarker['type']> = {
      'HEART_RATE': 'heartRate',
      'BLOOD_PRESSURE': 'bloodPressure',
      'BLOOD_GLUCOSE': 'glucose',
      'SPO2': 'oxygen',
      'STEPS': 'steps',
      'SLEEP': 'sleep',
      'RESPIRATORY_RATE': 'temperature',
      'WEIGHT': 'weight'
    }

    return data
      .filter(item => item.biomarker_data)
      .map(item => {
        const biomarkerData = Array.isArray(item.biomarker_data) 
          ? item.biomarker_data[0] 
          : item.biomarker_data
        
        const frontendType = typeMapping[biomarkerData.type] || 'heartRate';
        
        // For blood pressure, value is systolic and secondary_value is diastolic
        const biomarker: Biomarker = {
          id: item.data_point_id,
          userId: userId,
          deviceId: item.source_id || 'deleted-device', // Handle null source_id for historical data
          type: frontendType,
          value: biomarkerData.value,
          timestamp: item.timestamp,
          isFaulty: false
        };
        
        // Add blood pressure specific fields
        if (frontendType === 'bloodPressure') {
          biomarker.systolic = biomarkerData.value; // Primary value is systolic
          biomarker.diastolic = biomarkerData.secondary_value; // Secondary value is diastolic
        } else if (biomarkerData.secondary_value) {
          biomarker.diastolic = biomarkerData.secondary_value;
        }
        
        return biomarker;
      })
  } catch (error) {
    console.error('Error in fetchBiomarkers:', error)
    return []
  }
}

/**
 * Fetch devices (data sources) for a user from Supabase
 */
export async function fetchDevices(userId: string): Promise<Device[]> {
  try {
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching devices:', error)
      return []
    }

    if (!data) return []

    // Map database format to frontend format
    return data.map(source => {
      const metadata = source.metadata || {}
      return {
        id: source.source_id,
        userId: userId,
        name: source.name,
        type: metadata.device_type || 'smartwatch',
        status: metadata.status || (source.status === 'CONNECTED' ? 'active' : 'inactive'),
        batteryLevel: metadata.battery_level || 100,
        lastSync: source.last_sync,
        autoMode: metadata.auto_mode !== false,
        supportedBiomarkers: metadata.supported_biomarkers || []
      } as Device
    })
  } catch (error) {
    console.error('Error in fetchDevices:', error)
    return []
  }
}

/**
 * Fetch unread alerts for a user from Supabase
 * Note: Alerts will be stored in notifications table
 */
export async function fetchAlerts(userId: string): Promise<Alert[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('timestamp', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching alerts:', error)
      return []
    }

    if (!data) return []

    // Map database format to frontend format
    return data.map(notification => {
      return {
        id: notification.notification_id,
        userId: userId,
        type: notification.type === 'ALERT' ? 'warning' : 'info',
        message: notification.content,
        timestamp: notification.timestamp,
        biomarkerType: undefined,
        read: notification.is_read
      } as Alert
    })
  } catch (error) {
    console.error('Error in fetchAlerts:', error)
    return []
  }
}

/**
 * Notification type as stored in the database
 */
export interface NotificationData {
  notification_id: string;
  user_id: string;
  type: 'ALERT' | 'ACHIEVEMENT' | 'GOAL' | 'REMINDER' | 'SYSTEM';
  content: string;
  timestamp: string;
  is_read: boolean;
  read_at: string | null;
}

/**
 * Fetch all notifications for a user from Supabase
 */
export async function fetchNotifications(userId: string): Promise<NotificationData[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching notifications:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in fetchNotifications:', error)
    return []
  }
}

/**
 * Fetch unread notifications count for a user
 */
export async function fetchUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('Error fetching unread count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Error in fetchUnreadNotificationsCount:', error)
    return 0
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('notification_id', notificationId)

    if (error) {
      console.error('Error marking notification as read:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error)
    return false
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in markAllNotificationsAsRead:', error)
    return false
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('notification_id', notificationId)

    if (error) {
      console.error('Error deleting notification:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deleteNotification:', error)
    return false
  }
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting all notifications:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deleteAllNotifications:', error)
    return false
  }
}

// =========================================
// GOALS FUNCTIONS
// =========================================

export interface HealthGoal {
  id: string;
  userId: string;
  type: 'steps' | 'heartRate' | 'bloodPressure' | 'glucose' | 'sleep' | 'weight';
  target: number;
  targetSystolic?: number;
  targetDiastolic?: number;
  period: 'daily' | 'weekly' | 'monthly';
  createdAt: string;
  deadline?: string;
}

// Map frontend goal types to database categories
const goalTypeToCategory: Record<string, string> = {
  'steps': 'STEPS',
  'sleep': 'SLEEP_DURATION',
  'weight': 'WEIGHT',
  'heartRate': 'HEART_RATE', // Not in DB enum, will need handling
  'bloodPressure': 'BLOOD_PRESSURE', // Not in DB enum
  'glucose': 'BLOOD_GLUCOSE' // Not in DB enum
};

const categoryToGoalType: Record<string, HealthGoal['type']> = {
  'STEPS': 'steps',
  'SLEEP_DURATION': 'sleep',
  'WEIGHT': 'weight',
  'HEART_RATE': 'heartRate',
  'BLOOD_PRESSURE': 'bloodPressure',
  'BLOOD_GLUCOSE': 'glucose'
};

/**
 * Fetch goals for a user from Supabase (with localStorage fallback)
 */
export async function fetchGoals(userId: string): Promise<HealthGoal[]> {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error fetching goals from database, using localStorage fallback:', error)
      // Fallback to localStorage
      const storedGoals = JSON.parse(localStorage.getItem('healthApp_goals') || '[]');
      return storedGoals.filter((g: HealthGoal) => g.userId === userId);
    }

    if (!data) {
      // Fallback to localStorage if no data
      const storedGoals = JSON.parse(localStorage.getItem('healthApp_goals') || '[]');
      return storedGoals.filter((g: HealthGoal) => g.userId === userId);
    }

    // Map database format to frontend format
    const goals = data.map(goal => {
      const frontendType = categoryToGoalType[goal.category] || 'steps';
      
      // Calculate period based on date range
      const startDate = new Date(goal.start_date);
      const endDate = new Date(goal.end_date);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let period: HealthGoal['period'] = 'daily';
      if (daysDiff > 20) period = 'monthly';
      else if (daysDiff > 5) period = 'weekly';

      return {
        id: goal.goal_id,
        userId: goal.user_id,
        type: frontendType,
        target: goal.target_value,
        period: period,
        createdAt: goal.created_at,
        deadline: goal.end_date
      } as HealthGoal;
    });

    // Sync to localStorage for offline access
    const allStoredGoals = JSON.parse(localStorage.getItem('healthApp_goals') || '[]');
    const otherUsersGoals = allStoredGoals.filter((g: HealthGoal) => g.userId !== userId);
    localStorage.setItem('healthApp_goals', JSON.stringify([...otherUsersGoals, ...goals]));

    return goals;
  } catch (error) {
    console.warn('Error in fetchGoals, using localStorage fallback:', error)
    // Fallback to localStorage
    const storedGoals = JSON.parse(localStorage.getItem('healthApp_goals') || '[]');
    return storedGoals.filter((g: HealthGoal) => g.userId === userId);
  }
}

/**
 * Create a new goal in Supabase (with localStorage sync)
 */
export async function createGoal(goal: Omit<HealthGoal, 'id' | 'createdAt'>): Promise<HealthGoal | null> {
  try {
    // Only allow goal types that exist in database enum
    const allowedTypes = ['steps', 'sleep', 'weight'];
    if (!allowedTypes.includes(goal.type)) {
      console.warn(`Goal type '${goal.type}' is not supported in database. Only steps, sleep, and weight are currently supported.`);
      return null;
    }

    const category = goalTypeToCategory[goal.type];
    
    // Calculate dates based on period
    const startDate = new Date();
    const endDate = new Date();
    
    if (goal.period === 'daily') {
      endDate.setDate(endDate.getDate() + 1);
    } else if (goal.period === 'weekly') {
      endDate.setDate(endDate.getDate() + 7);
    } else if (goal.period === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Use deadline if provided
    const finalEndDate = goal.deadline ? new Date(goal.deadline) : endDate;

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: goal.userId,
        category: category,
        target_value: goal.target,
        start_date: startDate.toISOString().split('T')[0],
        end_date: finalEndDate.toISOString().split('T')[0],
        progress: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating goal:', error)
      return null
    }

    if (!data) return null

    const createdGoal = {
      id: data.goal_id,
      userId: data.user_id,
      type: goal.type,
      target: data.target_value,
      period: goal.period,
      createdAt: data.created_at,
      deadline: data.end_date
    } as HealthGoal;

    // Sync to localStorage
    const allGoals = JSON.parse(localStorage.getItem('healthApp_goals') || '[]');
    allGoals.push(createdGoal);
    localStorage.setItem('healthApp_goals', JSON.stringify(allGoals));

    return createdGoal;
  } catch (error) {
    console.error('Error in createGoal:', error)
    return null
  }
}

/**
 * Update an existing goal in Supabase (with localStorage sync)
 */
export async function updateGoal(goalId: string, updates: Partial<HealthGoal>): Promise<boolean> {
  try {
    const dbUpdates: any = {};

    if (updates.target !== undefined) {
      dbUpdates.target_value = updates.target;
    }

    if (updates.deadline !== undefined) {
      dbUpdates.end_date = updates.deadline;
    }

    if (updates.period !== undefined) {
      // Recalculate end_date based on new period
      const { data: existingGoal } = await supabase
        .from('goals')
        .select('start_date')
        .eq('goal_id', goalId)
        .single();

      if (existingGoal) {
        const startDate = new Date(existingGoal.start_date);
        const endDate = new Date(startDate);
        
        if (updates.period === 'daily') {
          endDate.setDate(endDate.getDate() + 1);
        } else if (updates.period === 'weekly') {
          endDate.setDate(endDate.getDate() + 7);
        } else if (updates.period === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        }
        
        dbUpdates.end_date = endDate.toISOString().split('T')[0];
      }
    }

    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('goals')
      .update(dbUpdates)
      .eq('goal_id', goalId)

    if (error) {
      console.error('Error updating goal:', error)
      return false
    }

    // Sync to localStorage
    const allGoals = JSON.parse(localStorage.getItem('healthApp_goals') || '[]');
    const updatedGoals = allGoals.map((g: HealthGoal) => {
      if (g.id === goalId) {
        return { ...g, ...updates };
      }
      return g;
    });
    localStorage.setItem('healthApp_goals', JSON.stringify(updatedGoals));

    return true
  } catch (error) {
    console.error('Error in updateGoal:', error)
    return false
  }
}

/**
 * Delete a goal from Supabase (with localStorage sync)
 */
export async function deleteGoal(goalId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('goal_id', goalId)

    if (error) {
      console.error('Error deleting goal:', error)
      return false
    }

    // Sync to localStorage
    const allGoals = JSON.parse(localStorage.getItem('healthApp_goals') || '[]');
    const updatedGoals = allGoals.filter((g: HealthGoal) => g.id !== goalId);
    localStorage.setItem('healthApp_goals', JSON.stringify(updatedGoals));

    return true
  } catch (error) {
    console.error('Error in deleteGoal:', error)
    return false
  }
}
