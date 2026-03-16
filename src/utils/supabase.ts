import { createClient } from '@supabase/supabase-js'
import { Biomarker, Device, Alert } from './mockData'
import { secureGetItem, secureSetItem } from './secureStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Verify the current authenticated user has ADMIN role.
 * Checks the server-side session and fetches the role from the database
 * to prevent client-side role spoofing.
 */
async function requireAdmin(): Promise<{ authorized: boolean; userId: string; error?: string }> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  if (authError || !authUser) {
    return { authorized: false, userId: '', error: 'Not authenticated' }
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', authUser.id)
    .single()

  if (userError || !userData || userData.role !== 'ADMIN') {
    return { authorized: false, userId: authUser.id, error: 'Unauthorized: admin role required' }
  }

  return { authorized: true, userId: authUser.id }
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
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
          // Ensure timestamp is in ISO format with timezone (add Z if missing)
          timestamp: item.timestamp.includes('Z') || item.timestamp.includes('+') || item.timestamp.includes('-') 
            ? item.timestamp 
            : `${item.timestamp}Z`,
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
      .select('source_id, user_id, name, status, last_sync, priority, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
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
        supportedBiomarkers: metadata.supported_biomarkers || [],
        priority: source.priority ?? 0
      } as Device
    })
  } catch (error) {
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
      .select('notification_id, user_id, type, content, timestamp, is_read')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('timestamp', { ascending: false })
      .limit(100)

    if (error) {
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
      .select('notification_id, user_id, type, content, timestamp, is_read, read_at')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })

    if (error) {
      return []
    }

    return data || []
  } catch (error) {
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
      return 0
    }

    return count || 0
  } catch (error) {
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
      return false
    }

    return true
  } catch (error) {
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
      return false
    }

    return true
  } catch (error) {
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
      return false
    }

    return true
  } catch (error) {
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
      return false
    }

    return true
  } catch (error) {
    return false
  }
}

/**
 * Client-side cleanup of expired notifications (older than 90 days).
 * Should be called on app load or periodically.
 * @returns Number of deleted notifications
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  try {
    // Delete notifications whose expires_at has passed, OR that are older than 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .or(`expires_at.lte.${new Date().toISOString()},timestamp.lte.${ninetyDaysAgo.toISOString()}`)
      .select('notification_id')

    if (error) {
      return 0
    }

    const count = data?.length || 0
    return count
  } catch (error) {
    return 0
  }
}

/**
 * Create a notification entry in the database
 */
export async function createNotification(
  userId: string,
  type: 'ALERT' | 'ACHIEVEMENT' | 'GOAL' | 'REMINDER' | 'SYSTEM',
  content: string
): Promise<NotificationData | null> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 90)

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        content,
        is_read: false,
        timestamp: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    return null
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
  status?: 'active' | 'completed' | 'expired';
  completedAt?: string;
  finalProgress?: number;
  // SMART goal metadata
  smartSpecific?: string;
  smartMeasurable?: string;
  smartAchievable?: string;
  smartRelevant?: string;
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
      .select('goal_id, user_id, category, start_date, end_date, progress, target_value, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      // Fallback to localStorage
      const storedGoals = JSON.parse(await secureGetItem('healthApp_goals') || '[]');
      return storedGoals.filter((g: HealthGoal) => g.userId === userId);
    }

    if (!data) {
      // Fallback to localStorage if no data
      const storedGoals = JSON.parse(await secureGetItem('healthApp_goals') || '[]');
      return storedGoals.filter((g: HealthGoal) => g.userId === userId);
    }

    // Map database format to frontend format
    const now = new Date();
    const goals = data.map(goal => {
      const frontendType = categoryToGoalType[goal.category] || 'steps';
      
      // Calculate period based on date range
      const startDate = new Date(goal.start_date);
      const endDate = new Date(goal.end_date);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let period: HealthGoal['period'] = 'daily';
      if (daysDiff > 20) period = 'monthly';
      else if (daysDiff > 5) period = 'weekly';

      // Determine status
      const progress = goal.progress || 0;
      let status: HealthGoal['status'] = 'active';
      if (progress >= 100) {
        status = 'completed';
      } else if (endDate < now) {
        status = 'expired';
      }

      return {
        id: goal.goal_id,
        userId: goal.user_id,
        type: frontendType,
        target: goal.target_value,
        period: period,
        createdAt: goal.created_at,
        deadline: goal.end_date,
        status,
        finalProgress: progress,
        completedAt: status === 'completed' ? goal.updated_at : undefined,
      } as HealthGoal;
    });

    // Sync to localStorage for offline access
    const allStoredGoals = JSON.parse(await secureGetItem('healthApp_goals') || '[]');
    const otherUsersGoals = allStoredGoals.filter((g: HealthGoal) => g.userId !== userId);
    await secureSetItem('healthApp_goals', JSON.stringify([...otherUsersGoals, ...goals]));

    return goals;
  } catch (error) {
    // Fallback to localStorage
    const storedGoals = JSON.parse(await secureGetItem('healthApp_goals') || '[]');
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
    const allGoals = JSON.parse(await secureGetItem('healthApp_goals') || '[]');
    allGoals.push(createdGoal);
    await secureSetItem('healthApp_goals', JSON.stringify(allGoals));

    return createdGoal;
  } catch (error) {
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
      return false
    }

    // Sync to localStorage
    const allGoals = JSON.parse(await secureGetItem('healthApp_goals') || '[]');
    const updatedGoals = allGoals.map((g: HealthGoal) => {
      if (g.id === goalId) {
        return { ...g, ...updates };
      }
      return g;
    });
    await secureSetItem('healthApp_goals', JSON.stringify(updatedGoals));

    return true
  } catch (error) {
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
      return false
    }

    // Sync to localStorage
    const allGoals = JSON.parse(await secureGetItem('healthApp_goals') || '[]');
    const updatedGoals = allGoals.filter((g: HealthGoal) => g.id !== goalId);
    await secureSetItem('healthApp_goals', JSON.stringify(updatedGoals));

    return true
  } catch (error) {
    return false
  }
}

// =========================================
// PROVIDER FUNCTIONS
// =========================================

export interface Patient {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

/**
 * Fetch patients who have granted consent to the provider from Supabase
 * For provider dashboard only - respects access_consents table
 * @param providerId - The provider's user ID
 */
export async function fetchPatients(providerId: string): Promise<Patient[]> {
  try {
    // First, get the list of patient IDs who have granted active consent to this provider
    const { data: consents, error: consentError } = await supabase
      .from('access_consents')
      .select('patient_id')
      .eq('provider_id', providerId)
      .eq('status', 'ACTIVE')
      .is('revoked_at', null)

    if (consentError) {
      return []
    }

    if (!consents || consents.length === 0) {
      return []
    }

    // Extract patient IDs
    const patientIds = consents.map(c => c.patient_id)

    // Fetch user details for consented patients
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, name, role, created_at, last_login')
      .eq('role', 'END_USER')
      .in('user_id', patientIds)
      .order('name', { ascending: true })

    if (error) {
      return []
    }

    if (!data) return []

    // Map database format to frontend format
    return data.map(user => ({
      id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      last_login: user.last_login
    }))
  } catch (error) {
    return []
  }
}

/**
 * Fetch biomarkers for patients who have granted consent to the provider
 * For provider dashboard only - respects access_consents table
 * @param providerId - The provider's user ID
 */
export async function fetchAllPatientsBiomarkers(providerId: string): Promise<Biomarker[]> {
  try {
    // First, get the list of patient IDs who have granted active consent to this provider
    const { data: consents, error: consentError } = await supabase
      .from('access_consents')
      .select('patient_id')
      .eq('provider_id', providerId)
      .eq('status', 'ACTIVE')
      .is('revoked_at', null)

    if (consentError) {
      return []
    }

    if (!consents || consents.length === 0) {
      return []
    }

    // Extract patient IDs
    const patientIds = consents.map(c => c.patient_id)

    const { data, error } = await supabase
      .from('data_points')
      .select(`
        data_point_id,
        user_id,
        timestamp,
        source_id,
        biomarker_data (
          type,
          value,
          secondary_value,
          unit
        )
      `)
      .eq('data_type', 'BIOMARKER')
      .in('user_id', patientIds)
      .order('timestamp', { ascending: false })
      .limit(5000) // Limit to recent data

    if (error) {
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
        
        const biomarker: Biomarker = {
          id: item.data_point_id,
          userId: item.user_id,
          deviceId: item.source_id || 'deleted-device',
          type: frontendType,
          value: biomarkerData.value,
          timestamp: item.timestamp,
          isFaulty: false
        };
        
        // Add blood pressure specific fields
        if (frontendType === 'bloodPressure') {
          biomarker.systolic = biomarkerData.value;
          biomarker.diastolic = biomarkerData.secondary_value;
        } else if (biomarkerData.secondary_value) {
          biomarker.diastolic = biomarkerData.secondary_value;
        }
        
        return biomarker;
      })
  } catch (error) {
    return []
  }
}

/**
 * Fetch alerts for patients who have granted consent to the provider
 * For provider dashboard only - respects access_consents table
 * @param providerId - The provider's user ID
 */
export async function fetchAllPatientsAlerts(providerId: string): Promise<Alert[]> {
  try {
    // First, get the list of patient IDs who have granted active consent to this provider
    const { data: consents, error: consentError } = await supabase
      .from('access_consents')
      .select('patient_id')
      .eq('provider_id', providerId)
      .eq('status', 'ACTIVE')
      .is('revoked_at', null)

    if (consentError) {
      return []
    }

    if (!consents || consents.length === 0) {
      return []
    }

    // Extract patient IDs
    const patientIds = consents.map(c => c.patient_id)

    const { data, error } = await supabase
      .from('notifications')
      .select('notification_id, user_id, type, content, timestamp, is_read')
      .eq('type', 'ALERT')
      .in('user_id', patientIds)
      .order('timestamp', { ascending: false })
      .limit(1000)

    if (error) {
      return []
    }

    if (!data) return []

    // Map database format to frontend format
    return data.map(notification => {
      return {
        id: notification.notification_id,
        userId: notification.user_id,
        type: notification.is_read ? 'info' : 'warning',
        message: notification.content,
        timestamp: notification.timestamp,
        biomarkerType: undefined,
        read: notification.is_read
      } as Alert
    })
  } catch (error) {
    return []
  }
}

// =========================================
// ACCESS REQUEST FUNCTIONS
// =========================================

export interface AccessRequest {
  consent_id: string;
  patient_id: string;
  provider_id: string;
  patient_name?: string;
  patient_email?: string;
  provider_name?: string;
  provider_email?: string;
  status: 'PENDING' | 'ACTIVE' | 'DENIED' | 'REVOKED';
  granted_at: string | null;
  revoked_at: string | null;
  requested_at: string;
}

/**
 * Create an access request from provider to patient
 * Provider enters patient's email, system creates a pending request
 * @param providerId - The provider's user ID
 * @param patientEmail - The patient's email address
 */
export async function createAccessRequest(providerId: string, patientEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    // First, check if patient exists
    const { data: patientData, error: patientError } = await supabase
      .from('users')
      .select('user_id, name, email')
      .eq('email', patientEmail)
      .eq('role', 'END_USER')
      .single()

    if (patientError || !patientData) {
      return { success: false, message: 'Patient not found with this email address' }
    }

    // Check if there's already an active or pending consent
    const { data: existingConsent, error: existingError } = await supabase
      .from('access_consents')
      .select('status')
      .eq('provider_id', providerId)
      .eq('patient_id', patientData.user_id)
      .in('status', ['PENDING', 'ACTIVE'])
      .maybeSingle()

    if (existingConsent) {
      if (existingConsent.status === 'ACTIVE') {
        return { success: false, message: 'You already have active access to this patient' }
      }
      if (existingConsent.status === 'PENDING') {
        return { success: false, message: 'An access request is already pending for this patient' }
      }
    }

    // Get provider info for the notification
    const { data: providerData } = await supabase
      .from('users')
      .select('name, email')
      .eq('user_id', providerId)
      .single()

    // Create a pending access request
    const { error: insertError } = await supabase
      .from('access_consents')
      .insert({
        patient_id: patientData.user_id,
        provider_id: providerId,
        status: 'PENDING',
        requested_at: new Date().toISOString()
      })

    if (insertError) {
      return { success: false, message: 'Failed to create access request' }
    }

    // Create notification for the patient
    await supabase
      .from('notifications')
      .insert({
        user_id: patientData.user_id,
        type: 'ACCESS_REQUEST',
        content: `Dr. ${providerData?.name || 'A healthcare provider'} has requested access to your health data. Please review in Sharing Settings.`,
        is_read: false
      })

    return { success: true, message: `Access request sent to ${patientData.name}` }
  } catch (error) {
    return { success: false, message: 'An error occurred while creating the access request' }
  }
}

/**
 * Fetch pending access requests for a patient
 * @param patientId - The patient's user ID
 */
export async function fetchPendingAccessRequests(patientId: string): Promise<AccessRequest[]> {
  try {
    const { data, error } = await supabase
      .from('access_consents')
      .select(`
        consent_id,
        patient_id,
        provider_id,
        status,
        granted_at,
        revoked_at,
        requested_at,
        provider:users!access_consents_provider_id_fkey(name, email)
      `)
      .eq('patient_id', patientId)
      .eq('status', 'PENDING')
      .order('requested_at', { ascending: false })

    if (error) {
      return []
    }

    if (!data) return []

    return data.map(item => ({
      consent_id: item.consent_id,
      patient_id: item.patient_id,
      provider_id: item.provider_id,
      provider_name: item.provider?.name,
      provider_email: item.provider?.email,
      status: item.status,
      granted_at: item.granted_at,
      revoked_at: item.revoked_at,
      requested_at: item.requested_at
    }))
  } catch (error) {
    return []
  }
}

/**
 * Fetch all access consents for a patient (active and historical)
 * @param patientId - The patient's user ID
 */
export async function fetchAllAccessConsents(patientId: string): Promise<AccessRequest[]> {
  try {
    const { data, error } = await supabase
      .from('access_consents')
      .select(`
        consent_id,
        patient_id,
        provider_id,
        status,
        granted_at,
        revoked_at,
        requested_at,
        provider:users!access_consents_provider_id_fkey(name, email)
      `)
      .eq('patient_id', patientId)
      .order('requested_at', { ascending: false })

    if (error) {
      return []
    }

    if (!data) return []

    return data.map(item => ({
      consent_id: item.consent_id,
      patient_id: item.patient_id,
      provider_id: item.provider_id,
      provider_name: item.provider?.name,
      provider_email: item.provider?.email,
      status: item.status,
      granted_at: item.granted_at,
      revoked_at: item.revoked_at,
      requested_at: item.requested_at
    }))
  } catch (error) {
    return []
  }
}

/**
 * Approve an access request
 * @param consentId - The consent ID to approve
 * @param providerId - The provider ID (for notification)
 */
export async function approveAccessRequest(consentId: string, providerId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('access_consents')
      .update({
        status: 'ACTIVE',
        granted_at: new Date().toISOString()
      })
      .eq('consent_id', consentId)
      .eq('status', 'PENDING')

    if (error) {
      return { success: false, message: 'Failed to approve access request' }
    }

    // Get patient info for notification
    const { data: consentData } = await supabase
      .from('access_consents')
      .select(`
        patient:users!access_consents_patient_id_fkey(name)
      `)
      .eq('consent_id', consentId)
      .single()

    // Create notification for the provider
    await supabase
      .from('notifications')
      .insert({
        user_id: providerId,
        type: 'ACCESS_GRANTED',
        content: `${consentData?.patient?.name || 'A patient'} has granted you access to their health data.`,
        is_read: false
      })

    return { success: true, message: 'Access request approved' }
  } catch (error) {
    return { success: false, message: 'An error occurred while approving the request' }
  }
}

/**
 * Deny an access request
 * @param consentId - The consent ID to deny
 */
export async function denyAccessRequest(consentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('access_consents')
      .update({
        status: 'DENIED',
        revoked_at: new Date().toISOString()
      })
      .eq('consent_id', consentId)
      .eq('status', 'PENDING')

    if (error) {
      return { success: false, message: 'Failed to deny access request' }
    }

    return { success: true, message: 'Access request denied' }
  } catch (error) {
    return { success: false, message: 'An error occurred while denying the request' }
  }
}

/**
 * Revoke an active access consent
 * @param consentId - The consent ID to revoke
 */
export async function revokeAccessConsent(consentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('access_consents')
      .update({
        status: 'REVOKED',
        revoked_at: new Date().toISOString()
      })
      .eq('consent_id', consentId)
      .eq('status', 'ACTIVE')

    if (error) {
      return { success: false, message: 'Failed to revoke access' }
    }

    return { success: true, message: 'Access revoked successfully' }
  } catch (error) {
    return { success: false, message: 'An error occurred while revoking access' }
  }
}

// =========================================
// ADMIN FUNCTIONS
// =========================================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'END_USER' | 'PROVIDER' | 'ADMIN';
  age?: number;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
  is_verified: boolean;
  verification_status: 'pending' | 'approved' | 'denied' | 'not_applicable';
}

/**
 * Fetch all users from Supabase (Admin only)
 * @returns Array of all users
 */
export async function fetchAllUsers(): Promise<AdminUser[]> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return []

    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, name, role, age, created_at, last_login, is_active, is_verified')
      .order('created_at', { ascending: false })

    if (error) {
      return []
    }

    if (!data) return []

    return data.map((user: any) => {
      const isActive = user.is_active !== false
      const isVerified = !!user.is_verified

      return {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role as 'END_USER' | 'PROVIDER' | 'ADMIN',
        age: user.age,
        created_at: user.created_at,
        last_login: user.last_login,
        is_active: isActive,
        is_verified: isVerified,
        verification_status: user.role === 'PROVIDER'
          ? (isVerified ? 'approved' : 'pending')
          : 'not_applicable' as const,
      }
    })
  } catch (error) {
    return []
  }
}

/**
 * Fetch all devices from all users (Admin only)
 * @returns Array of all devices
 */
export async function fetchAllDevices(): Promise<Device[]> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return []

    const { data, error } = await supabase
      .from('data_sources')
      .select('source_id, user_id, name, status, last_sync, metadata')
      .order('created_at', { ascending: false })

    if (error) {
      return []
    }

    if (!data) return []

    return data.map(source => {
      const metadata = source.metadata || {}
      return {
        id: source.source_id,
        userId: source.user_id,
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
    return []
  }
}

/**
 * Fetch all biomarkers from all users (Admin only)
 * @returns Array of all biomarkers
 */
export async function fetchAllBiomarkers(): Promise<Biomarker[]> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return []

    const { data, error } = await supabase
      .from('data_points')
      .select(`
        data_point_id,
        user_id,
        timestamp,
        source_id,
        biomarker_data (
          type,
          value,
          secondary_value,
          unit
        )
      `)
      .eq('data_type', 'BIOMARKER')
      .order('timestamp', { ascending: false })
      .limit(5000)

    if (error) {
      return []
    }

    if (!data) return []

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
        
        const biomarker: Biomarker = {
          id: item.data_point_id,
          userId: item.user_id,
          deviceId: item.source_id || 'deleted-device',
          type: frontendType,
          value: biomarkerData.value,
          timestamp: item.timestamp.includes('Z') || item.timestamp.includes('+') || item.timestamp.includes('-') 
            ? item.timestamp 
            : `${item.timestamp}Z`,
          isFaulty: false
        };
        
        if (frontendType === 'bloodPressure') {
          biomarker.systolic = biomarkerData.value;
          biomarker.diastolic = biomarkerData.secondary_value;
        } else if (biomarkerData.secondary_value) {
          biomarker.diastolic = biomarkerData.secondary_value;
        }
        
        return biomarker;
      })
  } catch (error) {
    return []
  }
}

/**
 * Fetch all alerts from all users (Admin only)
 * @returns Array of all alerts
 */
export async function fetchAllAlerts(): Promise<Alert[]> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return []

    const { data, error } = await supabase
      .from('notifications')
      .select('notification_id, user_id, type, content, timestamp, is_read')
      .order('timestamp', { ascending: false })
      .limit(1000)

    if (error) {
      return []
    }

    if (!data) return []

    return data.map(notification => ({
      id: notification.notification_id,
      userId: notification.user_id,
      type: notification.type === 'ALERT' ? 'warning' : 'info',
      message: notification.content,
      timestamp: notification.timestamp,
      biomarkerType: undefined,
      read: notification.is_read
    }))
  } catch (error) {
    return []
  }
}

/**
 * Update a user's role (Admin only)
 * @param userId - The user ID to update
 * @param newRole - The new role
 * @returns Success status
 */
export async function updateUserRole(userId: string, newRole: 'END_USER' | 'PROVIDER' | 'ADMIN'): Promise<{ success: boolean; message: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('user_id', userId)

    if (error) {
      return { success: false, message: 'Failed to update user role' }
    }

    return { success: true, message: 'User role updated successfully' }
  } catch (error) {
    return { success: false, message: 'An error occurred while updating user role' }
  }
}

/**
 * Delete a user and all associated data (Admin only)
 * WARNING: This is a destructive operation
 * @param userId - The user ID to delete
 * @returns Success status
 */
export async function deleteUserAndData(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    // Note: Cascade delete should handle related data through foreign key constraints
    // This includes: data_points, data_sources, notifications, goals, etc.
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId)

    if (error) {
      return { success: false, message: 'Failed to delete user' }
    }

    return { success: true, message: 'User and associated data deleted successfully' }
  } catch (error) {
    return { success: false, message: 'An error occurred while deleting user' }
  }
}

/**
 * Toggle user active status (Admin only)
 * @param userId - The user ID
 * @param isActive - New active status
 */
export async function updateUserActiveStatus(userId: string, isActive: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    const { error } = await supabase
      .from('users')
      .update({ is_active: isActive } as any)
      .eq('user_id', userId)

    if (error) {
      return { success: false, message: 'Failed to update user active status' }
    }

    return { success: true, message: isActive ? 'User account enabled' : 'User account disabled' }
  } catch (error) {
    return { success: false, message: 'An error occurred while updating user status' }
  }
}

/**
 * Update provider verification status (Admin only)
 * @param userId - The provider user ID
 * @param verified - Whether the provider is verified
 */
export async function updateProviderVerification(userId: string, verified: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    const { error } = await supabase
      .from('users')
      .update({ is_verified: verified } as any)
      .eq('user_id', userId)

    if (error) {
      return { success: false, message: 'Failed to update provider verification' }
    }

    return { success: true, message: verified ? 'Provider verified successfully' : 'Provider verification revoked' }
  } catch (error) {
    return { success: false, message: 'An error occurred while updating verification' }
  }
}

/**
 * Check if a user account is active (for login flow)
 * @param userId - The user ID to check
 */
export async function checkUserIsActive(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, is_active')
      .eq('user_id', userId)
      .maybeSingle()

    // If query errors (e.g. is_active column doesn't exist) or no row found,
    // allow login — the user exists in auth.users, blocking here would be a
    // false lockout. Only deny when is_active is explicitly set to false.
    if (error || !data) return true
    if ((data as any).is_active === false) return false
    return true
  } catch {
    return true
  }
}

/**
 * Update device status (Admin only)
 * @param deviceId - The device ID
 * @param status - New status
 * @returns Success status
 */
export async function updateDeviceStatus(deviceId: string, status: 'active' | 'inactive' | 'faulty'): Promise<{ success: boolean; message: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    // Get current metadata
    const { data: currentData } = await supabase
      .from('data_sources')
      .select('metadata')
      .eq('source_id', deviceId)
      .single()

    const currentMetadata = currentData?.metadata || {}
    
    const dbStatus = status === 'active' ? 'CONNECTED' : status === 'faulty' ? 'ERROR' : 'DISCONNECTED'
    
    const { error } = await supabase
      .from('data_sources')
      .update({
        status: dbStatus,
        metadata: {
          ...currentMetadata,
          status: status
        }
      })
      .eq('source_id', deviceId)

    if (error) {
      return { success: false, message: 'Failed to update device status' }
    }

    return { success: true, message: 'Device status updated successfully' }
  } catch (error) {
    return { success: false, message: 'An error occurred while updating device status' }
  }
}

/**
 * Update all devices to a specific status (Admin only)
 * @param status - New status for all devices
 * @returns Success status
 */
export async function updateAllDevicesStatus(status: 'active' | 'inactive' | 'faulty'): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error!, count: 0 }

    // First, fetch all devices to get their current metadata
    const { data: devices, error: fetchError } = await supabase
      .from('data_sources')
      .select('source_id, metadata')

    if (fetchError) {
      return { success: false, message: 'Failed to fetch devices', count: 0 }
    }

    if (!devices || devices.length === 0) {
      return { success: true, message: 'No devices to update', count: 0 }
    }

    const dbStatus = status === 'active' ? 'CONNECTED' : status === 'faulty' ? 'ERROR' : 'DISCONNECTED'

    // Update each device
    let successCount = 0
    for (const device of devices) {
      const currentMetadata = device.metadata || {}
      const { error } = await supabase
        .from('data_sources')
        .update({
          status: dbStatus,
          metadata: {
            ...currentMetadata,
            status: status
          }
        })
        .eq('source_id', device.source_id)

      if (!error) {
        successCount++
      }
    }

    return { success: true, message: `Updated ${successCount} devices`, count: successCount }
  } catch (error) {
    return { success: false, message: 'An error occurred while updating devices', count: 0 }
  }
}

/**
 * Clear all alerts for all users (Admin only)
 * Marks all notifications as read
 * @returns Success status
 */
export async function clearAllAlertsForAllUsers(): Promise<{ success: boolean; message: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('is_read', false)

    if (error) {
      return { success: false, message: 'Failed to clear alerts' }
    }

    return { success: true, message: 'All alerts cleared successfully' }
  } catch (error) {
    return { success: false, message: 'An error occurred while clearing alerts' }
  }
}

/**
 * Create a new user (Admin only)
 * Note: This creates a user in the users table, but not in auth.users
 * For production, you'd need to use Supabase Admin API to create auth users
 * @param userData - User data
 * @returns Success status with user ID
 */
export async function createNewUser(userData: {
  email: string;
  name: string;
  role: 'END_USER' | 'PROVIDER' | 'ADMIN';
  age?: number;
}): Promise<{ success: boolean; message: string; userId?: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    const userId = generateUUID()
    
    const { error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        age: userData.age,
        created_at: new Date().toISOString()
      })

    if (error) {
      return { success: false, message: 'Failed to create user. Email may already exist.' }
    }

    return { success: true, message: 'User created successfully', userId }
  } catch (error) {
    return { success: false, message: 'An error occurred while creating user' }
  }
}

/**
 * Update user details (Admin only)
 * @param userId - User ID to update
 * @param updates - Fields to update
 * @returns Success status
 */
export async function updateUserDetails(userId: string, updates: {
  name?: string;
  email?: string;
  age?: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const auth = await requireAdmin()
    if (!auth.authorized) return { success: false, message: auth.error! }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', userId)

    if (error) {
      return { success: false, message: 'Failed to update user' }
    }

    return { success: true, message: 'User updated successfully' }
  } catch (error) {
    return { success: false, message: 'An error occurred while updating user' }
  }
}

// =========================================
// AUDIT LOGS & SECURITY MONITORING
// =========================================

export interface AuditLog {
  log_id: string;
  admin_id: string;
  admin_name?: string;
  action: string;
  target_entity_id?: string;
  target_entity_type?: string;
  timestamp: string;
  ip_address?: string;
  details?: any;
}

/**
 * Log an audit event (Admin actions)
 * @param adminId - Admin user ID performing the action
 * @param action - Action being performed
 * @param targetEntityId - Optional ID of the entity being acted upon
 * @param targetEntityType - Optional type of entity (user, device, etc.)
 * @param details - Optional additional details as JSON
 * @param ipAddress - Optional IP address
 * @returns Success status
 */
export async function logAuditEvent(
  adminId: string,
  action: string,
  targetEntityId?: string,
  targetEntityType?: string,
  details?: any,
  ipAddress?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action,
        target_entity_id: targetEntityId,
        target_entity_type: targetEntityType,
        timestamp: new Date().toISOString(),
        ip_address: ipAddress,
        details: details ? JSON.stringify(details) : null
      })

    if (error) {
      return { success: false, message: 'Failed to log audit event' }
    }

    return { success: true, message: 'Audit event logged' }
  } catch (error) {
    return { success: false, message: 'An error occurred while logging audit event' }
  }
}

/**
 * Fetch audit logs with admin user details (Admin only)
 * @param limit - Number of logs to fetch
 * @returns Array of audit logs
 */
export async function fetchAuditLogs(limit: number = 100): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        log_id,
        admin_id,
        action,
        target_entity_id,
        target_entity_type,
        timestamp,
        ip_address,
        details,
        admin:users!audit_logs_admin_id_fkey(name)
      `)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      return []
    }

    if (!data) return []

    return data.map(log => ({
      log_id: log.log_id,
      admin_id: log.admin_id,
      admin_name: log.admin?.name,
      action: log.action,
      target_entity_id: log.target_entity_id,
      target_entity_type: log.target_entity_type,
      timestamp: log.timestamp,
      ip_address: log.ip_address,
      details: log.details
    }))
  } catch (error) {
    return []
  }
}

/**
 * Fetch audit logs for a specific admin user
 * @param adminId - Admin user ID
 * @param limit - Number of logs to fetch
 * @returns Array of audit logs
 */
export async function fetchAuditLogsByAdmin(adminId: string, limit: number = 100): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('log_id, admin_id, action, target_entity_id, target_entity_type, timestamp, ip_address, details')
      .eq('admin_id', adminId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      return []
    }

    if (!data) return []

    return data.map(log => ({
      log_id: log.log_id,
      admin_id: log.admin_id,
      action: log.action,
      target_entity_id: log.target_entity_id,
      target_entity_type: log.target_entity_type,
      timestamp: log.timestamp,
      ip_address: log.ip_address,
      details: log.details
    }))
  } catch (error) {
    return []
  }
}

/**
 * Fetch recent security events from audit logs
 * Filters for security-relevant actions like logins, access changes, etc.
 * @param limit - Number of events to fetch
 * @returns Array of security events
 */
export async function fetchSecurityEvents(limit: number = 50): Promise<AuditLog[]> {
  try {
    const securityActions = [
      'LOGIN',
      'FAILED_LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'USER_CREATED',
      'USER_DELETED',
      'ROLE_CHANGED',
      'ACCESS_GRANTED',
      'ACCESS_REVOKED',
      'DATA_EXPORT',
      'DATA_ACCESS',
      'SETTINGS_CHANGED'
    ];

    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        log_id,
        admin_id,
        action,
        target_entity_id,
        target_entity_type,
        timestamp,
        ip_address,
        details,
        admin:users!audit_logs_admin_id_fkey(name)
      `)
      .in('action', securityActions)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      return []
    }

    if (!data) return []

    return data.map(log => ({
      log_id: log.log_id,
      admin_id: log.admin_id,
      admin_name: log.admin?.name,
      action: log.action,
      target_entity_id: log.target_entity_id,
      target_entity_type: log.target_entity_type,
      timestamp: log.timestamp,
      ip_address: log.ip_address,
      details: log.details
    }))
  } catch (error) {
    return []
  }
}

// =========================================
// SYSTEM METRICS & MONITORING
// =========================================

export interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalDevices: number;
  activeDevices: number;
  totalDataPoints: number;
  todayDataPoints: number;
  storageUsedMB: number;
  databaseSizeMB?: number;
}

/**
 * Fetch comprehensive system metrics (Admin only)
 * Calculates real-time statistics from the database
 * @returns System metrics
 */
export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  try {
    // Fetch all counts in parallel
    const [
      usersResult,
      devicesResult,
      dataPointsResult,
      todayDataPointsResult
    ] = await Promise.all([
      // Total and active users
      supabase.from('users').select('user_id, last_login', { count: 'exact', head: true }),
      // Total and active devices
      supabase.from('data_sources').select('source_id, status', { count: 'exact', head: true }),
      // Total data points
      supabase.from('data_points').select('data_point_id', { count: 'exact', head: true }),
      // Today's data points
      supabase.from('data_points')
        .select('data_point_id', { count: 'exact', head: true })
        .gte('timestamp', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    ]);

    // Get active users (logged in within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: activeUsersCount } = await supabase
      .from('users')
      .select('user_id', { count: 'exact', head: true })
      .gte('last_login', sevenDaysAgo.toISOString());

    // Get active devices (connected status)
    const { count: activeDevicesCount } = await supabase
      .from('data_sources')
      .select('source_id', { count: 'exact', head: true })
      .eq('status', 'CONNECTED');

    // Estimate storage (rough calculation based on data points)
    // Average ~1KB per data point (biomarker + metadata)
    const totalDataPoints = dataPointsResult.count || 0;
    const storageUsedMB = (totalDataPoints * 1) / 1024; // Convert KB to MB

    return {
      totalUsers: usersResult.count || 0,
      activeUsers: activeUsersCount || 0,
      totalDevices: devicesResult.count || 0,
      activeDevices: activeDevicesCount || 0,
      totalDataPoints: totalDataPoints,
      todayDataPoints: todayDataPointsResult.count || 0,
      storageUsedMB: Math.round(storageUsedMB * 100) / 100
    };
  } catch (error) {
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalDevices: 0,
      activeDevices: 0,
      totalDataPoints: 0,
      todayDataPoints: 0,
      storageUsedMB: 0
    };
  }
}

/**
 * Fetch data throughput over the last 24 hours
 * Returns hourly data point counts
 * @returns Array of hourly data counts
 */
export async function fetchDataThroughput(): Promise<{ hour: string; count: number }[]> {
  try {
    const now = new Date();
    const results = [];

    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now);
      hourStart.setHours(now.getHours() - i, 0, 0, 0);
      
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourStart.getHours() + 1);

      const { count } = await supabase
        .from('data_points')
        .select('data_point_id', { count: 'exact', head: true })
        .gte('timestamp', hourStart.toISOString())
        .lt('timestamp', hourEnd.toISOString());

      results.push({
        hour: hourStart.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        count: count || 0
      });
    }

    return results;
  } catch (error) {
    return [];
  }
}

// =========================================
// EMERGENCY CONTACTS
// =========================================

export interface EmergencyContact {
  contact_id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyAlertLog {
  alert_id: string;
  user_id: string;
  contact_id: string;
  alert_type: string;
  trigger_reading: any;
  status: string;
  sent_at: string | null;
  created_at: string;
}

/**
 * Fetch all emergency contacts for a user
 */
export async function fetchEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('contact_id, user_id, name, phone, email, relationship, is_primary, created_at, updated_at')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      return []
    }
    return data || []
  } catch (error) {
    return []
  }
}

/**
 * Add a new emergency contact
 */
export async function addEmergencyContact(
  userId: string,
  contact: { name: string; phone?: string; email?: string; relationship?: string; is_primary?: boolean }
): Promise<EmergencyContact | null> {
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: userId,
        name: contact.name,
        phone: contact.phone || null,
        email: contact.email || null,
        relationship: contact.relationship || null,
        is_primary: contact.is_primary || false,
      })
      .select()
      .single()

    if (error) {
      return null
    }
    return data
  } catch (error) {
    return null
  }
}

/**
 * Update an emergency contact
 */
export async function updateEmergencyContact(
  contactId: string,
  updates: Partial<{ name: string; phone: string; email: string; relationship: string; is_primary: boolean }>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('emergency_contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('contact_id', contactId)

    if (error) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

/**
 * Delete an emergency contact
 */
export async function deleteEmergencyContact(contactId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('contact_id', contactId)

    if (error) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

/**
 * Fetch emergency alert history for a user
 */
export async function fetchEmergencyAlertHistory(userId: string): Promise<EmergencyAlertLog[]> {
  try {
    const { data, error } = await supabase
      .from('emergency_alert_history')
      .select('alert_id, user_id, contact_id, alert_type, trigger_reading, status, sent_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return []
    }
    return data || []
  } catch (error) {
    return []
  }
}

/**
 * Send emergency alert to all contacts (STUB - logs to DB with status STUBBED)
 * In production, this would call an SMS/email API (Twilio, SendGrid, etc.)
 */
export async function sendEmergencyAlerts(
  userId: string,
  triggerReading: { type: string; value: number; timestamp: string }
): Promise<{ sent: number; failed: number }> {
  try {
    const contacts = await fetchEmergencyContacts(userId)
    if (contacts.length === 0) return { sent: 0, failed: 0 }

    let sent = 0
    let failed = 0

    for (const contact of contacts) {
      const alertType = contact.phone && contact.email ? 'BOTH'
        : contact.phone ? 'SMS' : 'EMAIL'

      try {
        // STUB: In production, send actual SMS/email here
        // e.g. await twilioClient.messages.create({ to: contact.phone, ... })
        // e.g. await sendgridClient.send({ to: contact.email, ... })

        await supabase
          .from('emergency_alert_history')
          .insert({
            user_id: userId,
            contact_id: contact.contact_id,
            alert_type: alertType,
            trigger_reading: triggerReading,
            status: 'STUBBED',
            sent_at: new Date().toISOString(),
          })

        sent++
      } catch (err) {

        await supabase
          .from('emergency_alert_history')
          .insert({
            user_id: userId,
            contact_id: contact.contact_id,
            alert_type: alertType,
            trigger_reading: triggerReading,
            status: 'FAILED',
          })

        failed++
      }
    }

    return { sent, failed }
  } catch (error) {
    return { sent: 0, failed: 0 }
  }
}

// =========================================
// ANNOUNCEMENTS
// =========================================

export interface Announcement {
  announcement_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

/**
 * Fetch all active announcements
 */
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('announcement_id, title, message, type, is_active, created_by, created_at, updated_at, expires_at')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })

    if (error) {
      return []
    }
    return data || []
  } catch (error) {
    return []
  }
}

/**
 * Fetch all announcements (admin)
 */
export async function fetchAllAnnouncements(): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('announcement_id, title, message, type, is_active, created_by, created_at, updated_at, expires_at')
      .order('created_at', { ascending: false })

    if (error) {
      return []
    }
    return data || []
  } catch (error) {
    return []
  }
}

/**
 * Create an announcement (admin)
 */
export async function createAnnouncement(
  announcement: { title: string; message: string; type: string; created_by: string; expires_at?: string }
): Promise<Announcement | null> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        is_active: true,
        created_by: announcement.created_by,
        expires_at: announcement.expires_at || null,
      })
      .select()
      .single()

    if (error) {
      return null
    }
    return data
  } catch (error) {
    return null
  }
}

/**
 * Update an announcement (admin)
 */
export async function updateAnnouncement(
  announcementId: string,
  updates: Partial<{ title: string; message: string; type: string; is_active: boolean; expires_at: string }>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('announcements')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('announcement_id', announcementId)

    if (error) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

/**
 * Dismiss (deactivate) an announcement
 */
export async function dismissAnnouncement(announcementId: string): Promise<boolean> {
  return updateAnnouncement(announcementId, { is_active: false })
}
