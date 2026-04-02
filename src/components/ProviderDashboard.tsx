import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ProviderHeader, ProviderStatsCards, PatientListTable, CriticalAlertsPanel, PatientDetail, PatternAnalysis, AccessRequestDialog, PatientSelectDialog } from './provider';
import { AnnouncementBanner } from './user';
import { Biomarker, User, Alert, getBiomarkerLabel, getBiomarkerUnit } from '../utils/mockData';
import { Patient } from '../utils/supabase';
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
  const [patients, setPatients] = useState<User[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiomarkerRangeLoading, setIsBiomarkerRangeLoading] = useState(false);
  const [patternDataLoaded, setPatternDataLoaded] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [showPatientSelect, setShowPatientSelect] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('provider_activeTab') || 'patients';
  });
  const loadedProviderRangesRef = useRef<Set<string>>(new Set());
  const loadingProviderRangesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Clear old provider cache entries to ensure fresh data load
    clearOldProviderCache();
    loadData();
    // Check for dark mode preference
    const darkMode = localStorage.getItem('healthApp_darkMode') === 'true';
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Clear old provider cache entries that might have stale data
  const clearOldProviderCache = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        // Clear all old provider cache entries to ensure fresh data
        if (key && key.startsWith('provider_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      // Silently fail on cache cleanup errors
    }
  };

  // Pattern data is now loaded upfront, so mark it as ready when data loads
  useEffect(() => {
    if (biomarkers.length > 0 && !patternDataLoaded) {
      setPatternDataLoaded(true);
    }
  }, [biomarkers, patternDataLoaded]);

  // Generate cache key for data - unique per provider per day
  const getCacheKey = (type: string, providerId: string) => {
    return `provider_${type}_${providerId}_all_${new Date().toDateString()}`;
  };

  // Cache data in sessionStorage with expiry
  const setCacheData = (key: string, data: any) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + (5 * 60 * 1000) // 5 minutes
      };
      sessionStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      // Handle quota exceeded gracefully
      console.warn('Cache storage failed:', error);
    }
  };

  // Get cached data if not expired
  const getCacheData = (key: string) => {
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const cacheData = JSON.parse(cached);
        if (Date.now() < cacheData.expiry) {
          return cacheData.data;
        } else {
          sessionStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
    }
    return null;
  };

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('provider_activeTab', activeTab);
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const providerId = user.user_id || user.id;

      // Try to get cached data first
      const patientsCacheKey = getCacheKey('patients', providerId);
      const alertsCacheKey = getCacheKey('alerts', providerId);
      const biomarkersCacheKey = getCacheKey('biomarkers_all', providerId);

      let cachedPatients = getCacheData(patientsCacheKey);
      let cachedAlerts = getCacheData(alertsCacheKey);
      let cachedBiomarkers = getCacheData(biomarkersCacheKey);

      // Load all critical data at once for comprehensive stats display
      // Fetch ALL biomarkers without date filter to get accurate total counts
      const { fetchPatients, fetchAllPatientsAlerts, fetchAllPatientsBiomarkers } = await import('../utils/supabase');

      const [supabasePatients, supabaseAlerts, supabaseBiomarkers] = await Promise.all([
        cachedPatients ? Promise.resolve(cachedPatients) : fetchPatients(providerId),
        cachedAlerts ? Promise.resolve(cachedAlerts) : fetchAllPatientsAlerts(providerId),
        // No date filter - fetch all biomarkers for accurate stats
        cachedBiomarkers ? Promise.resolve(cachedBiomarkers) : fetchAllPatientsBiomarkers(providerId)
      ]);

      // Cache the fetched data
      if (!cachedPatients) setCacheData(patientsCacheKey, supabasePatients);
      if (!cachedAlerts) setCacheData(alertsCacheKey, supabaseAlerts);
      if (!cachedBiomarkers) setCacheData(biomarkersCacheKey, supabaseBiomarkers);

      // Map Patient type to User type
      const mappedPatients: User[] = supabasePatients.map((patient: Patient) => ({
        id: patient.id,
        email: patient.email,
        name: patient.name,
        role: patient.role as 'END_USER' | 'PROVIDER' | 'ADMIN'
      }));

      setPatients(mappedPatients);
      setAlerts(supabaseAlerts);
      setBiomarkers(supabaseBiomarkers);

      if (supabasePatients.length === 0) {
        toast.info('No patients have granted you access yet');
        setIsLoading(false);
        return;
      }

      // Mark all data as loaded (no date range restriction)
      loadedProviderRangesRef.current.clear();
      loadedProviderRangesRef.current.add(`all|all|all`);
      loadingProviderRangesRef.current.clear();

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

  const loadPatternData = async () => {
    // Pattern data is now loaded upfront in loadData(), so this is a no-op
    // Kept for backwards compatibility but does nothing
    if (patternDataLoaded) return;
    setPatternDataLoaded(true);
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const generatePatientReport = async (patient: User) => {
    let doc: jsPDF | null = null;

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

      // Cache biomarker metadata to avoid repeated lookups
      const biomarkerMetadata = new Map<Biomarker['type'], { label: string; unit: string }>();
      const biomarkerTypes = Array.from(new Set(patientBiomarkers.map(b => b.type))) as Biomarker['type'][];

      biomarkerTypes.forEach(type => {
        biomarkerMetadata.set(type, {
          label: getBiomarkerLabel(type),
          unit: getBiomarkerUnit(type)
        });
      });

      doc = new jsPDF();
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

      // Build stats by type during chart processing to avoid N+1 filtering
      const biomarkerStats = new Map<Biomarker['type'], { data: Biomarker[]; avg: string; min: string; max: string }>();

      // Process charts one at a time to minimize memory usage
      for (const type of biomarkerTypes) {
        const typeBiomarkers = patientBiomarkers
          .filter(b => b.type === type)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (typeBiomarkers.length === 0) continue;

        // Calculate statistics once
        const values = typeBiomarkers.map(b => b.value);
        const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
        const min = Math.min(...values).toFixed(1);
        const max = Math.max(...values).toFixed(1);
        biomarkerStats.set(type, { data: typeBiomarkers, avg, min, max });

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 300;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const metadata = biomarkerMetadata.get(type)!;
          const chart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: typeBiomarkers.map(b =>
                new Date(b.timestamp).toLocaleDateString()
              ),
              datasets: [{
                label: metadata.label,
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
                  text: `${metadata.label} Trend`,
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
                    text: metadata.unit
                  }
                }
              }
            }
          });

          // Add image directly to PDF and then clean up immediately
          if (yPosition > 200) {
            doc.addPage();
            yPosition = 20;
          }

          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 14, yPosition, 180, 67.5);
          yPosition += 75;

          // Destroy chart and clean up canvas immediately to free memory
          chart.destroy();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.remove();
        }
      }

      // Add new page for statistics
      doc.addPage();
      yPosition = 20;

      // Summary Statistics
      doc.setFontSize(16);
      doc.text('Summary Statistics', 14, yPosition);
      yPosition += 10;

      biomarkerStats.forEach((stats, type) => {
        const metadata = biomarkerMetadata.get(type)!;
        doc!.setFontSize(12);
        doc!.text(`${metadata.label}: Avg ${stats.avg}, Min ${stats.min}, Max ${stats.max} ${metadata.unit}`, 14, yPosition);
        yPosition += 7;
      });

      yPosition += 10;

      // Detailed data table - sort once
      const sortedBiomarkers = patientBiomarkers.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const tableData = sortedBiomarkers
        .slice(0, 50)
        .map(bio => {
          const metadata = biomarkerMetadata.get(bio.type)!;
          return [
            new Date(bio.timestamp).toLocaleString(),
            metadata.label,
            bio.value.toString(),
            metadata.unit
          ];
        });

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
    } finally {
      doc = null;
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

  const filteredPatients = useMemo(() =>
    patients.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    ), [patients, searchTerm]);

  const getPatientAlerts = useCallback((patientId: string) => {
    return alerts.filter(a => a.userId === patientId && !a.read);
  }, [alerts]);

  const getLatestReading = useCallback((patientId: string, type: Biomarker['type']) => {
    const patientBiomarkers = biomarkers
      .filter(b => b.userId === patientId && b.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return patientBiomarkers[0];
  }, [biomarkers]);

  const criticalPatients = useMemo(() =>
    patients.filter(p => {
      const patientAlerts = alerts.filter(a => a.userId === p.id && !a.read);
      return patientAlerts.some(a => a.type === 'critical' || a.type === 'fault');
    }), [patients, alerts]);

  // Count total critical/fault alerts (not just patients with them)
  const totalCriticalAlerts = useMemo(() => 
    alerts.filter(a => !a.read && (a.type === 'critical' || a.type === 'fault')).length
  , [alerts]);

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
          criticalAlerts={totalCriticalAlerts}
          activeMonitoring={patients.length}
          totalReadings={biomarkers.length}
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
            <PatternAnalysis
              patients={patients}
              biomarkers={biomarkers}
              isLoading={!patternDataLoaded}
            />
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
