import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ProviderHeader, ProviderStatsCards, PatientListTable, CriticalAlertsPanel, PatientDetail, PatternAnalysis } from './provider';
import { Biomarker, User, Alert } from '../utils/mockData';
import { toast } from 'sonner';

interface ProviderDashboardProps {
  user: any;
  onLogout: () => void;
}

export function ProviderDashboard({ user, onLogout }: ProviderDashboardProps) {
  const [patients, setPatients] = useState<User[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
    // Check for dark mode preference
    const darkMode = localStorage.getItem('healthApp_darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load data from Supabase
      console.log('Loading provider data from Supabase database');
      const { fetchPatients, fetchAllPatientsBiomarkers, fetchAllPatientsAlerts } = await import('../utils/supabase');
      
      // Use the provider's user_id or id
      const providerId = user.user_id || user.id;
      
      const [supabasePatients, supabaseBiomarkers, supabaseAlerts] = await Promise.all([
        fetchPatients(providerId),
        fetchAllPatientsBiomarkers(providerId),
        fetchAllPatientsAlerts(providerId)
      ]);

      console.log(`Loaded from DB: ${supabasePatients.length} patients, ${supabaseBiomarkers.length} biomarkers, ${supabaseAlerts.length} alerts`);

      // Map Patient type to User type
      const mappedPatients: User[] = supabasePatients.map(patient => ({
        id: patient.id,
        email: patient.email,
        name: patient.name,
        role: patient.role as 'END_USER' | 'PROVIDER' | 'ADMIN'
      }));

      setPatients(mappedPatients);
      setBiomarkers(supabaseBiomarkers);
      setAlerts(supabaseAlerts);

      if (supabasePatients.length === 0) {
        toast.info('No patients have granted you access yet');
      }
    } catch (error) {
      console.error('Error loading data from Supabase:', error);
      toast.error('Failed to load data from database');
      // Don't fall back to localStorage - show empty data for provider
      setPatients([]);
      setBiomarkers([]);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPatientAlerts = (patientId: string) => {
    return alerts.filter(a => a.userId === patientId && !a.read);
  };

  const getLatestReading = (patientId: string, type: Biomarker['type']) => {
    const patientBiomarkers = biomarkers
      .filter(b => b.userId === patientId && b.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return patientBiomarkers[0];
  };

  const criticalPatients = patients.filter(p => {
    const patientAlerts = getPatientAlerts(p.id);
    return patientAlerts.some(a => a.type === 'critical' || a.type === 'fault');
  });

  if (selectedPatient) {
    return (
      <PatientDetail 
        patient={selectedPatient}
        biomarkers={biomarkers.filter(b => b.userId === selectedPatient.id)}
        alerts={alerts.filter(a => a.userId === selectedPatient.id)}
        onBack={() => setSelectedPatient(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 dark:border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading patient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <ProviderHeader
          userName={user.name}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onLogout={onLogout}
        />

        <ProviderStatsCards
          totalPatients={patients.length}
          criticalPatients={criticalPatients.length}
          activeMonitoring={patients.length}
          totalReports={biomarkers.length}
        />

        <Tabs defaultValue="patients" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="patients">Patient List</TabsTrigger>
            <TabsTrigger value="alerts">Critical Alerts</TabsTrigger>
            <TabsTrigger value="patterns">Pattern Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="patients" className="space-y-4">
            <PatientListTable
              patients={filteredPatients}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              getPatientAlerts={getPatientAlerts}
              getLatestReading={getLatestReading}
              onViewPatient={setSelectedPatient}
            />
          </TabsContent>

          <TabsContent value="alerts">
            <CriticalAlertsPanel
              patients={criticalPatients}
              getPatientAlerts={getPatientAlerts}
              onViewPatient={setSelectedPatient}
            />
          </TabsContent>

          <TabsContent value="patterns">
            <PatternAnalysis patients={patients} biomarkers={biomarkers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
