import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-foreground">Population Trend Analysis</h3>
            <p className="text-sm text-gray-600">Average values over last 14 days</p>
          </div>
          <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as Biomarker['type'])}>
            <SelectTrigger className="w-full sm:w-48">
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
          <ReactApexChart
            options={{
              chart: {
                type: 'line',
                animations: {
                  enabled: true,
                  easing: 'easeinout',
                  speed: 800,
                  animateGradually: {
                    enabled: true,
                    delay: 150
                  },
                  dynamicAnimation: {
                    enabled: true,
                    speed: 350
                  }
                },
                toolbar: {
                  show: false
                },
                zoom: {
                  enabled: false
                }
              },
              stroke: {
                curve: 'smooth',
                width: [2, 1, 1],
                dashArray: [0, 5, 5]
              },
              colors: ['#3b82f6', '#ef4444', '#10b981'],
              xaxis: {
                categories: trendData.map(d => d.date),
                labels: {
                  rotate: -45,
                  style: {
                    colors: '#9ca3af',
                    fontSize: '12px'
                  }
                }
              },
              yaxis: {
                labels: {
                  style: {
                    colors: '#9ca3af'
                  }
                }
              },
              grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 3
              },
              markers: {
                size: [4, 0, 0],
                strokeWidth: 0,
                hover: {
                  size: 6
                }
              },
              tooltip: {
                shared: true,
                intersect: false
              },
              legend: {
                show: true,
                position: 'top',
                horizontalAlign: 'right'
              }
            } as ApexOptions}
            series={[
              {
                name: 'Average',
                data: trendData.map(d => d.average)
              },
              {
                name: 'Max',
                data: trendData.map(d => d.max)
              },
              {
                name: 'Min',
                data: trendData.map(d => d.min)
              }
            ]}
            type="line"
            height="100%"
          />
        </div>
      </Card>

      {/* Correlation Analysis */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-foreground">Heart Rate vs Glucose Correlation</h3>
          <p className="text-sm text-gray-600">Scatter plot showing relationship between metrics</p>
        </div>

        <div className="h-80">
          <ReactApexChart
            options={{
              chart: {
                type: 'scatter',
                animations: {
                  enabled: true,
                  easing: 'easeinout',
                  speed: 800,
                  animateGradually: {
                    enabled: true,
                    delay: 150
                  }
                },
                toolbar: {
                  show: false
                },
                zoom: {
                  enabled: true,
                  type: 'xy'
                }
              },
              colors: ['#8b5cf6'],
              xaxis: {
                title: {
                  text: 'Heart Rate (bpm)',
                  style: {
                    color: '#9ca3af'
                  }
                },
                labels: {
                  style: {
                    colors: '#9ca3af'
                  }
                }
              },
              yaxis: {
                title: {
                  text: 'Glucose (mg/dL)',
                  style: {
                    color: '#9ca3af'
                  }
                },
                labels: {
                  style: {
                    colors: '#9ca3af'
                  }
                }
              },
              grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 3
              },
              markers: {
                size: (seriesIndex, dataPointIndex) => {
                  const reading = correlationData[dataPointIndex]?.readings || 50;
                  return Math.min(Math.max(reading / 10, 5), 20);
                },
                strokeWidth: 0,
                hover: {
                  size: undefined,
                  sizeOffset: 3
                }
              },
              tooltip: {
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                  const data = correlationData[dataPointIndex];
                  return `
                    <div class="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p class="text-sm font-medium text-gray-900 mb-2">${data.name}</p>
                      <p class="text-sm">Heart Rate: <span class="font-semibold">${data.heartRate.toFixed(1)} bpm</span></p>
                      <p class="text-sm">Glucose: <span class="font-semibold">${data.glucose.toFixed(1)} mg/dL</span></p>
                      <p class="text-xs text-gray-500 mt-2">Readings: ${data.readings}</p>
                    </div>
                  `;
                }
              },
              legend: {
                show: false
              }
            } as ApexOptions}
            series={[
              {
                name: 'Patients',
                data: correlationData.map(d => ({
                  x: d.heartRate,
                  y: d.glucose
                }))
              }
            ]}
            type="scatter"
            height="100%"
          />
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
