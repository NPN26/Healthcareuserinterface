// Mock data generation utilities for the healthcare system

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'END_USER' | 'PROVIDER' | 'ADMIN';
  age?: number;
  avatar?: string;
  dateOfBirth?: string;
  gender?: string;
  assignedDoctor?: string; // Provider ID
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  smsNotifications?: boolean;
  alertThreshold?: string;
}

export interface Biomarker {
  id: string;
  userId: string;
  type: 'heartRate' | 'bloodPressure' | 'glucose' | 'oxygen' | 'steps' | 'sleep' | 'temperature' | 'weight';
  value: number;
  systolic?: number; // For blood pressure
  diastolic?: number; // For blood pressure
  timestamp: string;
  deviceId: string;
  isFaulty?: boolean;
  notes?: string;
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  type: 'smartwatch' | 'glucometer' | 'bloodPressureMonitor' | 'scale' | 'thermometer' | 'sleepTracker';
  status: 'active' | 'inactive' | 'faulty';
  batteryLevel: number;
  lastSync: string;
  autoMode: boolean;
  supportedBiomarkers?: Biomarker['type'][];
  priority?: number;
}

export interface Alert {
  id: string;
  userId: string;
  type: 'warning' | 'critical' | 'info' | 'fault';
  message: string;
  timestamp: string;
  biomarkerType?: string;
  read: boolean;
}

export interface Recommendation {
  id: string;
  userId: string;
  type: 'exercise' | 'medication' | 'diet' | 'device' | 'general';
  title: string;
  description: string;
  timestamp: string;
}

// Generate biomarker data for a specific date
export function generateBiomarkerData(
  userId: string,
  deviceId: string,
  type: Biomarker['type'],
  date?: Date,
  includeFault: boolean = false
): Biomarker {
  // Use provided date or current time
  const timestamp = date ? date.toISOString() : new Date().toISOString();
  const dateObj = date || new Date();
  
  const baseValues: Record<Biomarker['type'], { min: number; max: number }> = {
    heartRate: { min: 60, max: 100 },
    bloodPressure: { min: 110, max: 130 },
    glucose: { min: 70, max: 120 },
    oxygen: { min: 95, max: 100 },
    steps: { min: 10, max: 100 },
    sleep: { min: 5, max: 9 },
    temperature: { min: 36.1, max: 37.2 },
    weight: { min: 65, max: 85 },
  };

  let value = Math.random() * (baseValues[type].max - baseValues[type].min) + baseValues[type].min;
  let isFaulty = false;
  let notes: string | undefined;

  // Special handling for sleep to differentiate naps from nighttime sleep
  if (type === 'sleep') {
    const hour = dateObj.getHours();
    // If it's during the day (8 AM - 6 PM), make it a nap (1-2 hours)
    if (hour >= 8 && hour <= 18) {
      value = Math.random() * 1.5 + 0.5; // 0.5 - 2 hours
      notes = 'Nap';
    } else {
      // Nighttime sleep (5-9 hours)
      value = Math.random() * 4 + 5; // 5-9 hours
      notes = 'Nighttime Sleep';
    }
  }

  // Simulate fault (0.1% chance or forced)
  if (includeFault || Math.random() < 0.001) {
    if (type === 'steps') {
      value = 50000; // Unrealistically high step increment
      isFaulty = true;
    } else if (type === 'heartRate') {
      value = 250; // Impossibly high
      isFaulty = true;
    }
  }

  const biomarker: Biomarker = {
    id: `${type}-${Date.now()}-${Math.random()}`,
    userId,
    type,
    value: Math.round(value * 10) / 10,
    timestamp: timestamp,
    deviceId,
    isFaulty,
    notes,
  };

  // Add blood pressure specific fields
  if (type === 'bloodPressure') {
    biomarker.systolic = Math.round(value);
    biomarker.diastolic = Math.round(value - 40 - Math.random() * 10);
  }

  return biomarker;
}

// Generate historical data for multiple days
export function generateHistoricalData(
  userId: string,
  deviceId: string,
  type: Biomarker['type'],
  days: number
): Biomarker[] {
  const data: Biomarker[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Generate multiple readings per day for some types
    const readingsPerDay = ['heartRate', 'glucose'].includes(type) ? 4 : 1;

    for (let j = 0; j < readingsPerDay; j++) {
      const readingDate = new Date(date);
      readingDate.setHours(6 + j * 4);
      data.push(generateBiomarkerData(userId, deviceId, type, readingDate));
    }
  }

  return data;
}

// Default users
export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    role: 'END_USER',
    age: 45,
    dateOfBirth: '1978-05-15',
    gender: 'male',
    assignedDoctor: 'provider-1',
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    alertThreshold: 'high',
  },
  {
    id: 'user-2',
    name: 'Sarah Smith',
    email: 'sarah@example.com',
    password: 'password123',
    role: 'END_USER',
    age: 32,
    dateOfBirth: '1991-08-22',
    gender: 'female',
    assignedDoctor: 'provider-1',
    emailNotifications: false,
    pushNotifications: true,
    smsNotifications: true,
    alertThreshold: 'medium',
  },
  {
    id: 'provider-1',
    name: 'Dr. Emily Brown',
    email: 'emily@healthcare.com',
    password: 'password123',
    role: 'PROVIDER',
    age: 38,
    dateOfBirth: '1985-03-10',
    gender: 'female',
    assignedDoctor: null,
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: true,
    alertThreshold: 'high',
  },
  {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@system.com',
    password: 'password123',
    role: 'ADMIN',
    age: 40,
    dateOfBirth: '1983-11-05',
    gender: 'male',
    assignedDoctor: null,
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: true,
    alertThreshold: 'high',
  },
];

// Default devices
export const mockDevices: Device[] = [
  {
    id: 'device-1',
    userId: 'user-1',
    name: 'Apple Watch Series 9',
    type: 'smartwatch',
    status: 'active',
    batteryLevel: 85,
    lastSync: new Date().toISOString(),
    autoMode: true,
    supportedBiomarkers: ['heartRate', 'oxygen', 'steps', 'sleep'],
  },
  {
    id: 'device-2',
    userId: 'user-1',
    name: 'Contour Next Glucometer',
    type: 'glucometer',
    status: 'active',
    batteryLevel: 92,
    lastSync: new Date(Date.now() - 3600000).toISOString(),
    autoMode: true,
    supportedBiomarkers: ['glucose'],
  },
  {
    id: 'device-3',
    userId: 'user-1',
    name: 'Omron Blood Pressure Monitor',
    type: 'bloodPressureMonitor',
    status: 'active',
    batteryLevel: 67,
    lastSync: new Date(Date.now() - 7200000).toISOString(),
    autoMode: false,
    supportedBiomarkers: ['bloodPressure', 'heartRate'],
  },
];

// Initialize local storage with mock data
export function initializeMockData() {
  if (!localStorage.getItem('healthApp_users')) {
    localStorage.setItem('healthApp_users', JSON.stringify(mockUsers));
  }

  if (!localStorage.getItem('healthApp_devices')) {
    localStorage.setItem('healthApp_devices', JSON.stringify(mockDevices));
  }

  // Generate initial biomarker data
  if (!localStorage.getItem('healthApp_biomarkers')) {
    const biomarkers: Biomarker[] = [];
    const types: Biomarker['type'][] = ['heartRate', 'bloodPressure', 'glucose', 'oxygen', 'steps', 'sleep'];

    types.forEach((type) => {
      biomarkers.push(...generateHistoricalData('user-1', 'device-1', type, 30));
    });

    localStorage.setItem('healthApp_biomarkers', JSON.stringify(biomarkers));
  }

  if (!localStorage.getItem('healthApp_alerts')) {
    localStorage.setItem('healthApp_alerts', JSON.stringify([]));
  }
}

export function getBiomarkerLabel(type: Biomarker['type']): string {
  const labels: Record<Biomarker['type'], string> = {
    heartRate: 'Heart Rate',
    bloodPressure: 'Blood Pressure',
    glucose: 'Blood Glucose',
    oxygen: 'Blood Oxygen',
    steps: 'Steps',
    sleep: 'Sleep Duration',
    temperature: 'Body Temperature',
    weight: 'Weight',
  };
  return labels[type];
}

export function getBiomarkerUnit(type: Biomarker['type']): string {
  const units: Record<Biomarker['type'], string> = {
    heartRate: 'bpm',
    bloodPressure: 'mmHg',
    glucose: 'mg/dL',
    oxygen: '%',
    steps: 'steps',
    sleep: 'hours',
    temperature: '°C',
    weight: 'kg',
  };
  return units[type];
}

export function getBiomarkerColor(type: Biomarker['type']): string {
  const colors: Record<Biomarker['type'], string> = {
    heartRate: '#ef4444',
    bloodPressure: '#8b5cf6',
    glucose: '#3b82f6',
    oxygen: '#06b6d4',
    steps: '#10b981',
    sleep: '#6366f1',
    temperature: '#f59e0b',
    weight: '#ec4899',
  };
  return colors[type];
}

/** Severity levels for anomaly classification */
export type AnomalySeverity = 'normal' | 'borderline' | 'warning' | 'critical';

export interface AnomalyResult {
  isAbnormal: boolean;
  severity: AnomalySeverity;
  message: string;
  rangeLow: number;
  rangeHigh: number;
}

/**
 * Comprehensive physiological ranges for all 9 biomarker types.
 * Each biomarker has nested severity bands:
 *   critical-low < warning-low < borderline-low < NORMAL < borderline-high < warning-high < critical-high
 */
export const PHYSIOLOGICAL_RANGES: Record<
  Biomarker['type'],
  {
    unit: string;
    criticalLow: number;
    warningLow: number;
    normalLow: number;
    normalHigh: number;
    warningHigh: number;
    criticalHigh: number;
    labels: Record<AnomalySeverity, string>;
  }
> = {
  heartRate: {
    unit: 'bpm',
    criticalLow: 40,
    warningLow: 50,
    normalLow: 60,
    normalHigh: 100,
    warningHigh: 120,
    criticalHigh: 150,
    labels: {
      normal: 'Normal resting heart rate',
      borderline: 'Slightly outside normal range',
      warning: 'Bradycardia / Tachycardia detected',
      critical: 'Dangerously abnormal heart rate - seek medical attention',
    },
  },
  bloodPressure: {
    unit: 'mmHg',
    criticalLow: 70,
    warningLow: 80,
    normalLow: 90,
    normalHigh: 130,
    warningHigh: 150,
    criticalHigh: 180,
    labels: {
      normal: 'Normal blood pressure',
      borderline: 'Elevated / Low-normal blood pressure',
      warning: 'Stage 1 hypertension or hypotension',
      critical: 'Hypertensive crisis - seek immediate care',
    },
  },
  glucose: {
    unit: 'mg/dL',
    criticalLow: 40,
    warningLow: 55,
    normalLow: 70,
    normalHigh: 130,
    warningHigh: 180,
    criticalHigh: 300,
    labels: {
      normal: 'Normal blood glucose',
      borderline: 'Mildly outside target range',
      warning: 'Hypoglycemia or Hyperglycemia risk',
      critical: 'Severe hypo/hyperglycemia - urgent attention needed',
    },
  },
  oxygen: {
    unit: '%',
    criticalLow: 88,
    warningLow: 91,
    normalLow: 95,
    normalHigh: 100,
    warningHigh: 101,
    criticalHigh: 101,
    labels: {
      normal: 'Normal SpO₂ saturation',
      borderline: 'Slightly low oxygen saturation',
      warning: 'Low SpO₂ - monitor closely',
      critical: 'Critically low oxygen - seek emergency care',
    },
  },
  steps: {
    unit: 'steps',
    criticalLow: 0,
    warningLow: 0,
    normalLow: 0,
    normalHigh: 40000,
    warningHigh: 60000,
    criticalHigh: 100000,
    labels: {
      normal: 'Normal activity level',
      borderline: 'Unusually high step count',
      warning: 'Very high steps - possible sensor error',
      critical: 'Implausible step count - likely faulty reading',
    },
  },
  sleep: {
    unit: 'hours',
    criticalLow: 2,
    warningLow: 3,
    normalLow: 4,
    normalHigh: 10,
    warningHigh: 12,
    criticalHigh: 16,
    labels: {
      normal: 'Healthy sleep duration',
      borderline: 'Slightly short or long sleep',
      warning: 'Sleep deprivation or hypersomnia',
      critical: 'Severe sleep abnormality',
    },
  },
  temperature: {
    unit: '°C',
    criticalLow: 34,
    warningLow: 35.5,
    normalLow: 36,
    normalHigh: 37.5,
    warningHigh: 38.5,
    criticalHigh: 40,
    labels: {
      normal: 'Normal body temperature',
      borderline: 'Slightly elevated or low temperature',
      warning: 'Mild fever or hypothermia',
      critical: 'High fever / Severe hypothermia - seek care',
    },
  },
  weight: {
    unit: 'kg',
    criticalLow: 30,
    warningLow: 35,
    normalLow: 40,
    normalHigh: 150,
    warningHigh: 180,
    criticalHigh: 250,
    labels: {
      normal: 'Within typical range',
      borderline: 'Slightly outside expected range',
      warning: 'Significant weight anomaly',
      critical: 'Extreme weight value - verify reading',
    },
  },
};

/**
 * Classify a biomarker reading into a severity band.
 * Returns a rich result with severity, message, and reference ranges.
 */
export function classifyReading(
  type: Biomarker['type'],
  value: number,
  customThresholds?: Record<string, { low: number; high: number }>
): AnomalyResult {
  const range = PHYSIOLOGICAL_RANGES[type];

  // Allow custom thresholds to override normal band
  let normalLow = range.normalLow;
  let normalHigh = range.normalHigh;
  if (customThresholds) {
    const key = type === 'bloodPressure' ? 'bloodPressureSystolic' : type;
    if (customThresholds[key]) {
      normalLow = customThresholds[key].low;
      normalHigh = customThresholds[key].high;
    }
  }

  if (value >= normalLow && value <= normalHigh) {
    return { isAbnormal: false, severity: 'normal', message: range.labels.normal, rangeLow: normalLow, rangeHigh: normalHigh };
  }

  // Critical
  if (value <= range.criticalLow || value >= range.criticalHigh) {
    return { isAbnormal: true, severity: 'critical', message: range.labels.critical, rangeLow: normalLow, rangeHigh: normalHigh };
  }

  // Warning
  if (value <= range.warningLow || value >= range.warningHigh) {
    return { isAbnormal: true, severity: 'warning', message: range.labels.warning, rangeLow: normalLow, rangeHigh: normalHigh };
  }

  // Borderline
  return { isAbnormal: true, severity: 'borderline', message: range.labels.borderline, rangeLow: normalLow, rangeHigh: normalHigh };
}

/**
 * Backward-compatible simple boolean check.
 */
export function isAbnormalReading(type: Biomarker['type'], value: number, customThresholds?: Record<string, { low: number; high: number }>): boolean {
  return classifyReading(type, value, customThresholds).isAbnormal;
}

/**
 * Return a CSS colour class for the severity badge.
 */
export function severityColor(severity: AnomalySeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-700 bg-red-100 border-red-300 dark:text-red-300 dark:bg-red-950 dark:border-red-800';
    case 'warning': return 'text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-800';
    case 'borderline': return 'text-yellow-700 bg-yellow-50 border-yellow-300 dark:text-yellow-300 dark:bg-yellow-950 dark:border-yellow-800';
    default: return 'text-green-700 bg-green-50 border-green-300 dark:text-green-300 dark:bg-green-950 dark:border-green-800';
  }
}