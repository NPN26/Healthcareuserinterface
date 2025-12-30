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
        
        return {
          id: item.data_point_id,
          userId: userId,
          deviceId: item.source_id,
          type: typeMapping[biomarkerData.type] || 'heartRate',
          value: biomarkerData.value,
          diastolic: biomarkerData.secondary_value,
          timestamp: item.timestamp,
          isFaulty: false
        } as Biomarker
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
