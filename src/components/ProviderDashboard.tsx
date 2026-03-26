import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ProviderHeader, ProviderStatsCards, PatientListTable, CriticalAlertsPanel, PatientDetail, PatternAnalysis, AccessRequestDialog, PatientSelectDialog } from './provider';
import { AnnouncementBanner } from './user';
import { Biomarker, User, Alert, getBiomarkerLabel, getBiomarkerUnit } from '../utils/mockData';
import { toast } from 'sonner';
import { HeartbeatLoader } from './ui/HeartbeatLoader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Chart } from 'chart.js/auto';

interface ProviderDashboardProps {
  user: any;
  onLogout: () => void;
}

export function ProviderDashboard({ user, onLogout }: ProviderDashboardProps) {
  const PROVIDER_LOOKBACK_DAYS = 30;
  const [patients, setPatients] = useState<User[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiomarkerRangeLoading, setIsBiomarkerRangeLoading] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [showPatientSelect, setShowPatientSelect] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('provider_activeTab') || 'patients';
  });
  const loadedProviderRangesRef = useRef<Set<string>>(new Set());
  const loadingProviderRangesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadData();
    // Check for dark mode preference
    const darkMode = localStorage.getItem('healthApp_darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('provider_activeTab', activeTab);
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load data from Supabase
      const { fetchPatients, fetchAllPatientsBiomarkers, fetchAllPatientsAlerts } = await import('../utils/supabase');
      
      // Use the provider's user_id or id
      const providerId = user.user_id || user.id;
      const now = new Date();
      const rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - PROVIDER_LOOKBACK_DAYS);
      rangeStart.setHours(0, 0, 0, 0);
      
      const [supabasePatients, supabaseBiomarkers, supabaseAlerts] = await Promise.all([
        fetchPatients(providerId),
        fetchAllPatientsBiomarkers(providerId, {
          startDate: rangeStart.toISOString(),
          endDate: now.toISOString(),
        }),
        fetchAllPatientsAlerts(providerId)
      ]);

      loadedProviderRangesRef.current.clear();
      loadedProviderRangesRef.current.add(`all|${rangeStart.toISOString()}|${now.toISOString()}`);
      loadingProviderRangesRef.current.clear();


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
      toast.error('Failed to load data from database');
      // Don't fall back to localStorage - show empty data for provider
      setPatients([]);
      setBiomarkers([]);
      setAlerts([]);
      loadedProviderRangesRef.current.clear();
      loadingProviderRangesRef.current.clear();
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

  const generatePatientReport = async (patient: User) => {
    try {
      toast.info('Generating PDF report...');

      // Get all biomarkers for this patient (last 6 months)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);

      const patientBiomarkers = biomarkers.filter(
        b => b.userId === patient.id && new Date(b.timestamp) >= cutoffDate
      );

      if (patientBiomarkers.length === 0) {
        toast.error('No data available for this patient');
        return;
      }

      const doc = new jsPDF();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.text('Patient Health Report', 14, yPosition);
      yPosition += 10;

      // Patient info
      doc.setFontSize(12);
      doc.text(`Patient: ${patient.name}`, 14, yPosition);
      yPosition += 7;
      doc.text(`Email: ${patient.email}`, 14, yPosition);
      yPosition += 7;
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, yPosition);
      yPosition += 7;
      doc.text(`Duration: Last 6 Months`, 14, yPosition);
      yPosition += 7;
      doc.text(`Total Readings: ${patientBiomarkers.length}`, 14, yPosition);
      yPosition += 15;

      // Get unique biomarker types
      const biomarkerTypes = Array.from(new Set(patientBiomarkers.map(b => b.type))) as Biomarker['type'][];

      // Create chart images array
      const chartImages = [];

      for (const type of biomarkerTypes) {
        const typeBiomarkers = patientBiomarkers
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

      // Add chart images to PDF
      for (const imgData of chartImages) {
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 20;
        }

        doc.addImage(imgData, 'PNG', 14, yPosition, 180, 67.5);
        yPosition += 75;
      }

      // Add new page for statistics
      doc.addPage();
      yPosition = 20;

      // Summary Statistics
      doc.setFontSize(16);
      doc.text('Summary Statistics', 14, yPosition);
      yPosition += 10;

      biomarkerTypes.forEach(type => {
        const typeData = patientBiomarkers.filter(b => b.type === type);
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
      const tableData = patientBiomarkers
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50)
        .map(bio => [
          new Date(bio.timestamp).toLocaleString(),
          getBiomarkerLabel(bio.type),
          bio.value.toString(),
          getBiomarkerUnit(bio.type)
        ]);

      autoTable(doc, {
        head: [['Date & Time', 'Biomarker', 'Value', 'Unit']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`patient-${patient.name.replace(/\s+/g, '-')}-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const mergeBiomarkers = (existing: Biomarker[], incoming: Biomarker[]) => {
    const byId = new Map(existing.map(b => [b.id, b]));
    incoming.forEach(b => byId.set(b.id, b));
    return Array.from(byId.values());
  };

  const requestProviderPatientRange = async (patientId: string, range: { startDate: string; endDate: string }) => {
    const providerId = user.user_id || user.id;
    const rangeKey = `${patientId}|${range.startDate}|${range.endDate}`;
    if (loadedProviderRangesRef.current.has(rangeKey) || loadingProviderRangesRef.current.has(rangeKey)) {
      return;
    }

    loadingProviderRangesRef.current.add(rangeKey);
    setIsBiomarkerRangeLoading(true);
    try {
      const { fetchAllPatientsBiomarkers } = await import('../utils/supabase');
      const fetched = await fetchAllPatientsBiomarkers(providerId, {
        patientId,
        startDate: range.startDate,
        endDate: range.endDate,
      });
      setBiomarkers(prev => mergeBiomarkers(prev, fetched));
      loadedProviderRangesRef.current.add(rangeKey);
    } catch (error) {
      toast.error('Unable to load older patient data');
    } finally {
      loadingProviderRangesRef.current.delete(rangeKey);
      if (loadingProviderRangesRef.current.size === 0) {
        setIsBiomarkerRangeLoading(false);
      }
    }
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
        isBiomarkersLoading={isBiomarkerRangeLoading}
        onRequestRange={(range) => requestProviderPatientRange(selectedPatient.id, range)}
        onBack={() => setSelectedPatient(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <HeartbeatLoader label="Loading patient data…" size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <AnnouncementBanner />
        <ProviderHeader
          userName={user.name}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onLogout={onLogout}
          onRequestAccess={() => setShowAccessRequest(true)}
        />

        <ProviderStatsCards
          totalPatients={patients.length}
          criticalPatients={criticalPatients.length}
          activeMonitoring={patients.length}
          totalReports={biomarkers.length}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
              onExport={() => setShowPatientSelect(true)}
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

      {/* Access Request Dialog */}
      <AccessRequestDialog
        isOpen={showAccessRequest}
        onClose={() => {
          setShowAccessRequest(false);
          // Reload data after successful request to refresh patient list
          loadData();
        }}
        providerId={user.user_id || user.id}
      />

      {/* Patient Select Dialog for Export */}
      <PatientSelectDialog
        isOpen={showPatientSelect}
        onClose={() => setShowPatientSelect(false)}
        patients={patients}
        onSelectPatient={generatePatientReport}
      />
    </div>
  );
}
