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
  date: Date,
  includeFault: boolean = false
): Biomarker {
  const baseValues: Record<Biomarker['type'], { min: number; max: number }> = {
    heartRate: { min: 60, max: 100 },
    bloodPressure: { min: 110, max: 130 },
    glucose: { min: 70, max: 120 },
    oxygen: { min: 95, max: 100 },
    steps: { min: 3000, max: 12000 },
    sleep: { min: 5, max: 9 },
    temperature: { min: 36.1, max: 37.2 },
    weight: { min: 65, max: 85 },
  };

  let value = Math.random() * (baseValues[type].max - baseValues[type].min) + baseValues[type].min;
  let isFaulty = false;

  // Simulate fault (5% chance or forced)
  if (includeFault || Math.random() < 0.05) {
    if (type === 'steps') {
      value = 1000000; // Impossible step count
      isFaulty = true;
    } else if (type === 'heartRate') {
      value = 250; // Impossibly high
      isFaulty = true;
    }
  }

  const biomarker: Biomarker = {
    id: `${type}-${date.getTime()}-${Math.random()}`,
    userId,
    type,
    value: Math.round(value * 10) / 10,
    timestamp: date.toISOString(),
    deviceId,
    isFaulty,
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

export function isAbnormalReading(type: Biomarker['type'], value: number): boolean {
  const ranges: Record<Biomarker['type'], { min: number; max: number }> = {
    heartRate: { min: 60, max: 100 },
    bloodPressure: { min: 90, max: 140 },
    glucose: { min: 70, max: 130 },
    oxygen: { min: 95, max: 100 },
    steps: { min: 0, max: 50000 },
    sleep: { min: 4, max: 12 },
    temperature: { min: 36, max: 38 },
    weight: { min: 40, max: 200 },
  };

  return value < ranges[type].min || value > ranges[type].max;
}