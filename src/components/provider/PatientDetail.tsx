import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { ArrowLeft, Download, Share2, User, AlertTriangle } from 'lucide-react';
import { Biomarker, Alert, User as UserType, getBiomarkerLabel, isAbnormalReading, getBiomarkerUnit } from '../../utils/mockData';
import { BiomarkerChart } from '../user/BiomarkerChart';
import { toast } from 'sonner';
import { checkRateLimit } from '../../utils/rateLimiter';

interface PatientDetailProps {
  patient: UserType;
  biomarkers: Biomarker[];
  alerts: Alert[];
  isBiomarkersLoading?: boolean;
  onRequestRange?: (range: { startDate: string; endDate: string }) => Promise<void> | void;
  onBack: () => void;
}

export function PatientDetail({ patient, biomarkers, alerts, isBiomarkersLoading = false, onRequestRange, onBack }: PatientDetailProps) {
  const biomarkerTypes: Biomarker['type'][] = ['heartRate', 'bloodPressure', 'glucose', 'oxygen', 'steps', 'sleep'];

  const getAverageByType = (type: Biomarker['type'], days: number = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recent = biomarkers.filter(b => 
      b.type === type && new Date(b.timestamp) >= cutoffDate
    );

    if (recent.length === 0) return null;
    
    const avg = recent.reduce((sum, b) => sum + b.value, 0) / recent.length;
    return avg;
  };

  const getTrendAnalysis = (type: Biomarker['type']) => {
    const thisWeek = getAverageByType(type, 7);
    const lastWeek = getAverageByType(type, 14);
    
    if (!thisWeek || !lastWeek) return 'Insufficient data';
    
    const change = ((thisWeek - lastWeek) / lastWeek) * 100;
    
    if (Math.abs(change) < 5) return 'Stable';
    if (change > 0) return `Increasing (+${change.toFixed(1)}%)`;
    return `Decreasing (${change.toFixed(1)}%)`;
  };

  const exportPatientData = () => {
    // Rate-limit data export
    const rateCheck = checkRateLimit('dataExport', patient.id);
    if (!rateCheck.allowed) {
      toast.error(rateCheck.message);
      return;
    }

    const data = {
      patient,
      biomarkers,
      alerts,
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${patient.id}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    toast.success('Patient data exported');
  };

  const shareWithSpecialist = () => {
    toast.success('Patient data shared with specialist');
  };

  const unreadAlerts = alerts.filter(a => !a.read);

  // Find the most recent biomarker by timestamp
  const latestBiomarker = biomarkers.length > 0
    ? biomarkers.reduce((latest, b) =>
        new Date(b.timestamp) > new Date(latest.timestamp) ? b : latest,
      biomarkers[0])
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl text-gray-900">{patient.name}</h1>
            <p className="text-gray-600">{patient.email} • {patient.age} years old</p>
          </div>
          <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPatientData}>
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={shareWithSpecialist}>
            <Share2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          </div>
        </div>

        {/* Patient Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Patient ID</p>
                <p className="text-gray-900">{patient.id.slice(0, 8)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div>
              <p className="text-sm text-gray-600">Total Readings</p>
              <p className="text-2xl text-gray-900">{biomarkers.length}</p>
              <p className="text-xs text-gray-500 mt-1">Loaded range</p>
            </div>
          </Card>

          <Card className="p-6">
            <div>
              <p className="text-sm text-gray-600">Active Alerts</p>
              <p className="text-2xl text-gray-900">{unreadAlerts.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {unreadAlerts.filter(a => a.type === 'critical').length} critical
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div>
              <p className="text-sm text-gray-600">Last Reading</p>
              <p className="text-gray-900">
                {latestBiomarker
                  ? new Date(latestBiomarker.timestamp).toLocaleDateString('en-GB')
                  : 'No data'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {latestBiomarker
                  ? new Date(latestBiomarker.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : ''
                }
              </p>
            </div>
          </Card>
        </div>

        {/* Alerts Summary */}
        {unreadAlerts.length > 0 && (
          <Card className="p-4 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-600">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h3 className="text-gray-900 mb-2">Active Alerts ({unreadAlerts.length})</h3>
                <div className="space-y-1">
                  {unreadAlerts.slice(0, 3).map(alert => (
                    <p key={alert.id} className="text-sm text-amber-900">
                      • {alert.message}
                    </p>
                  ))}
                  {unreadAlerts.length > 3 && (
                    <p className="text-sm text-amber-700">
                      + {unreadAlerts.length - 3} more alerts
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="destructive">Requires Attention</Badge>
            </div>
          </Card>
        )}

        {/* Biomarker Trends */}
        <Card className="p-6">
          <h3 className="text-gray-900 mb-4">7-Day Trend Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {biomarkerTypes.map(type => {
              const avg = getAverageByType(type, 7);
              const trend = getTrendAnalysis(type);
              const abnormal = avg !== null && isAbnormalReading(type, avg);
              
              return (
                <div
                  key={type}
                  className={`p-4 rounded-lg ${
                    abnormal
                      ? 'bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700'
                      : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-600">{getBiomarkerLabel(type)}</p>
                    {abnormal && (
                      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-medium">Abnormal</span>
                      </div>
                    )}
                  </div>
                  <p className={`text-xl ${abnormal ? 'text-red-700 dark:text-red-300 font-semibold' : 'text-gray-900'}`}>
                    {avg ? avg.toFixed(1) : '--'}
                    {avg !== null && (
                      <span className="text-sm text-gray-500 ml-1">{getBiomarkerUnit(type)}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{trend}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Detailed Charts */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
            <TabsTrigger value="all">All Metrics</TabsTrigger>
            <TabsTrigger value="heartRate">Heart Rate</TabsTrigger>
            <TabsTrigger value="bloodPressure">BP</TabsTrigger>
            <TabsTrigger value="glucose">Glucose</TabsTrigger>
            <TabsTrigger value="oxygen">Oxygen</TabsTrigger>
            <TabsTrigger value="steps">Activity</TabsTrigger>
            <TabsTrigger value="sleep">Sleep</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {biomarkerTypes.map(type => (
                <BiomarkerChart
                  key={type}
                  biomarkers={biomarkers.filter(b => b.type === type)}
                  type={type}
                  showDetails
                  isLoading={isBiomarkersLoading}
                  onRequestRange={onRequestRange}
                />
              ))}
            </div>
          </TabsContent>

          {biomarkerTypes.map(type => (
            <TabsContent key={type} value={type}>
              <BiomarkerChart
                biomarkers={biomarkers.filter(b => b.type === type)}
                type={type}
                showDetails
                isLoading={isBiomarkersLoading}
                onRequestRange={onRequestRange}
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Clinical Notes */}
        <Card className="p-6">
          <h3 className="text-gray-900 mb-4">Clinical Notes</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">
                {new Date().toLocaleDateString()} - Dr. {patient.name}
              </p>
              <p className="text-sm text-gray-900">
                Patient biomarkers are being monitored regularly. {
                  unreadAlerts.length > 0 
                    ? 'There are active alerts that require attention.' 
                    : 'All readings are within normal ranges.'
                }
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
