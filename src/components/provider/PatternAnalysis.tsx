import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LineChart, Line } from 'recharts';
import { Biomarker, User, getBiomarkerLabel } from '../../utils/mockData';
import { TrendingUp, TrendingDown, Activity, Users } from 'lucide-react';
import { useState } from 'react';

interface PatternAnalysisProps {
  patients: User[];
  biomarkers: Biomarker[];
}

export function PatternAnalysis({ patients, biomarkers }: PatternAnalysisProps) {
  const [selectedMetric, setSelectedMetric] = useState<Biomarker['type']>('heartRate');

  // Analyze correlation between metrics
  const getCorrelationData = () => {
    const heartRateData: { [key: string]: number[] } = {};
    const glucoseData: { [key: string]: number[] } = {};

    patients.forEach(patient => {
      const patientBiomarkers = biomarkers.filter(b => b.userId === patient.id);
      const heartRates = patientBiomarkers.filter(b => b.type === 'heartRate');
      const glucoseLevels = patientBiomarkers.filter(b => b.type === 'glucose');

      heartRateData[patient.id] = heartRates.map(b => b.value);
      glucoseData[patient.id] = glucoseLevels.map(b => b.value);
    });

    const correlationData = patients.map(patient => {
      const hr = heartRateData[patient.id] || [];
      const gl = glucoseData[patient.id] || [];

      const avgHR = hr.length > 0 ? hr.reduce((sum, v) => sum + v, 0) / hr.length : 0;
      const avgGL = gl.length > 0 ? gl.reduce((sum, v) => sum + v, 0) / gl.length : 0;

      return {
        name: patient.name,
        heartRate: avgHR,
        glucose: avgGL,
        readings: hr.length + gl.length,
      };
    }).filter(d => d.heartRate > 0 && d.glucose > 0);

    return correlationData;
  };

  // Get population statistics
  const getPopulationStats = () => {
    const stats: { [key: string]: { avg: number; min: number; max: number; count: number } } = {};

    const types: Biomarker['type'][] = ['heartRate', 'bloodPressure', 'glucose', 'oxygen'];

    types.forEach(type => {
      const values = biomarkers.filter(b => b.type === type).map(b => b.value);
      if (values.length > 0) {
        stats[type] = {
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        };
      }
    });

    return stats;
  };

  // Identify high-risk patients
  const getHighRiskPatients = () => {
    return patients.filter(patient => {
      const patientBiomarkers = biomarkers.filter(b => b.userId === patient.id);
      const recentHR = patientBiomarkers
        .filter(b => b.type === 'heartRate')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      const recentGL = patientBiomarkers
        .filter(b => b.type === 'glucose')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      const avgHR = recentHR.length > 0 
        ? recentHR.reduce((sum, b) => sum + b.value, 0) / recentHR.length 
        : 0;
      
      const avgGL = recentGL.length > 0 
        ? recentGL.reduce((sum, b) => sum + b.value, 0) / recentGL.length 
        : 0;

      return avgHR > 100 || avgGL > 130 || avgGL < 70;
    });
  };

  // Get trend over time for selected metric
  const getTrendOverTime = () => {
    const last30Days = biomarkers.filter(b => {
      const date = new Date(b.timestamp);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return date >= cutoff && b.type === selectedMetric;
    });

    const dayGroups: { [key: string]: number[] } = {};

    last30Days.forEach(b => {
      const day = new Date(b.timestamp).toLocaleDateString();
      if (!dayGroups[day]) {
        dayGroups[day] = [];
      }
      dayGroups[day].push(b.value);
    });

    return Object.entries(dayGroups).map(([day, values]) => ({
      date: day,
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-14);
  };

  const correlationData = getCorrelationData();
  const populationStats = getPopulationStats();
  const highRiskPatients = getHighRiskPatients();
  const trendData = getTrendOverTime();

  return (
    <div className="space-y-6">
      {/* Population Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(populationStats).map(([type, stats]) => (
          <Card key={type} className="p-4">
            <p className="text-sm text-gray-600 mb-1">{getBiomarkerLabel(type as Biomarker['type'])}</p>
            <p className="text-2xl text-gray-900">{stats.avg.toFixed(1)}</p>
            <div className="mt-2 text-xs text-gray-500">
              <p>Range: {stats.min.toFixed(1)} - {stats.max.toFixed(1)}</p>
              <p>{stats.count} readings</p>
            </div>
          </Card>
        ))}
      </div>

      {/* High Risk Patients */}
      {highRiskPatients.length > 0 && (
        <Card className="p-6 border-l-4 border-red-500 bg-red-50 dark:bg-red-950">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900">
              <Users className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-foreground mb-2">High-Risk Patients Identified</h3>
              <p className="text-sm text-gray-600 mb-3">
                {highRiskPatients.length} patient{highRiskPatients.length !== 1 ? 's' : ''} with abnormal biomarker patterns
              </p>
              <div className="flex flex-wrap gap-2">
                {highRiskPatients.map(patient => (
                  <Badge key={patient.id} variant="destructive">
                    {patient.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Population Trend */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-foreground">Population Trend Analysis</h3>
            <p className="text-sm text-gray-600">Average values over last 14 days</p>
          </div>
          <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as Biomarker['type'])}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="heartRate">Heart Rate</SelectItem>
              <SelectItem value="bloodPressure">Blood Pressure</SelectItem>
              <SelectItem value="glucose">Blood Glucose</SelectItem>
              <SelectItem value="oxygen">Blood Oxygen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="average" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="Average"
              />
              <Line 
                type="monotone" 
                dataKey="max" 
                stroke="#ef4444" 
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Max"
              />
              <Line 
                type="monotone" 
                dataKey="min" 
                stroke="#10b981" 
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Min"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Correlation Analysis */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-foreground">Heart Rate vs Glucose Correlation</h3>
          <p className="text-sm text-gray-600">Scatter plot showing relationship between metrics</p>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                type="number" 
                dataKey="heartRate" 
                name="Heart Rate" 
                unit=" bpm"
                stroke="#9ca3af"
              />
              <YAxis 
                type="number" 
                dataKey="glucose" 
                name="Glucose" 
                unit=" mg/dL"
                stroke="#9ca3af"
              />
              <ZAxis type="number" dataKey="readings" range={[50, 400]} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'heartRate') return [`${value.toFixed(1)} bpm`, 'Heart Rate'];
                  if (name === 'glucose') return [`${value.toFixed(1)} mg/dL`, 'Glucose'];
                  return value;
                }}
              />
              <Scatter 
                name="Patients" 
                data={correlationData} 
                fill="#8b5cf6"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
          <h4 className="text-sm text-gray-900 mb-2">Pattern Insights</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• {correlationData.length} patients analyzed</li>
            <li>• Average heart rate: {(correlationData.reduce((sum, d) => sum + d.heartRate, 0) / correlationData.length).toFixed(1)} bpm</li>
            <li>• Average glucose: {(correlationData.reduce((sum, d) => sum + d.glucose, 0) / correlationData.length).toFixed(1)} mg/dL</li>
            <li>• Total readings: {correlationData.reduce((sum, d) => sum + d.readings, 0)}</li>
          </ul>
        </div>
      </Card>

      {/* Key Findings */}
      <Card className="p-6">
        <h3 className="text-foreground mb-4">Key Clinical Findings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900 mb-1">Population Health Trend</p>
                <p className="text-sm text-gray-600">
                  Overall biomarker averages are within normal ranges for {patients.length} patients under monitoring.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900 mb-1">Engagement</p>
                <p className="text-sm text-gray-600">
                  {biomarkers.length} total readings recorded, averaging {Math.round(biomarkers.length / patients.length)} readings per patient.
                </p>
              </div>
            </div>
          </div>

          {highRiskPatients.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingDown className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-900 mb-1">Attention Required</p>
                  <p className="text-sm text-gray-600">
                    {highRiskPatients.length} patient{highRiskPatients.length !== 1 ? 's' : ''} showing abnormal patterns requiring follow-up.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
