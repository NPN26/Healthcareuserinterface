import { useState, useMemo } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Biomarker, Device, getBiomarkerLabel, getBiomarkerUnit, getBiomarkerColor, classifyReading, PHYSIOLOGICAL_RANGES, type AnomalySeverity } from '../../utils/mockData';
import { TrendingUp, TrendingDown, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { HeartbeatLoader } from '../ui/HeartbeatLoader';
import type { HealthGoal } from '../../utils/supabase';

interface BiomarkerChartProps {
  biomarkers: Biomarker[];
  type: Biomarker['type'];
  showDetails?: boolean;
  devices?: Device[];
  isLoading?: boolean;
  /** Optional completed goals to annotate on the chart */
  goals?: HealthGoal[];
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface ChartPoint {
  time: string;
  timestamp: string;
  value: number;
  minValue?: number;
  maxValue?: number;
  systolic?: number;
  diastolic?: number;
  minSystolic?: number;
  maxSystolic?: number;
  minDiastolic?: number;
  maxDiastolic?: number;
  isFaulty?: boolean;
  deviceName: string;
  notes?: string;
  isGap?: boolean;
}

export function BiomarkerChart({ biomarkers, type, showDetails, devices = [], isLoading = false, goals = [] }: BiomarkerChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [offset, setOffset] = useState(0); // 0 = current period, 1 = previous period, etc.
  // Helper function to get device name by ID
  const getDeviceName = (deviceId: string) => {
    if (deviceId === 'deleted-device' || !deviceId) {
      return 'Deleted Device';
    }
    const device = devices.find(d => d.id === deviceId);
    return device ? device.name : 'Unknown Device';
  };

  // Aggregate data by hour for daily view
  // NOTE: Using UTC methods to extract date/time components to avoid timezone issues
  // DB stores timestamps in UTC, so we group by UTC hour. Display will convert to local time.
  const aggregateDataByHour = (data: Biomarker[]) => {
    const hourlyMap = new Map<string, Biomarker[]>();
    
    data.forEach(biomarker => {
      const date = new Date(biomarker.timestamp);
      // Use UTC methods to extract date parts to avoid double timezone conversion
      const hourKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}`;
      
      if (!hourlyMap.has(hourKey)) {
        hourlyMap.set(hourKey, []);
      }
      hourlyMap.get(hourKey)!.push(biomarker);
    });

    // Convert map to array and aggregate values
    const aggregatedData: (Biomarker & { minValue?: number; maxValue?: number; minSystolic?: number; maxSystolic?: number; minDiastolic?: number; maxDiastolic?: number })[] = Array.from(hourlyMap.entries()).map(([hourKey, hourData]) => {
      const values = hourData.map(b => b.value);
      const totalValue = values.reduce((sum, v) => sum + v, 0);
      const avgValue = totalValue / values.length;
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      // For blood pressure, also track systolic/diastolic ranges
      let minSystolic, maxSystolic, minDiastolic, maxDiastolic;
      if (type === 'bloodPressure') {
        const systolicValues = hourData.map(b => b.systolic || 0).filter(v => v > 0);
        const diastolicValues = hourData.map(b => b.diastolic || 0).filter(v => v > 0);
        if (systolicValues.length > 0) {
          minSystolic = Math.min(...systolicValues);
          maxSystolic = Math.max(...systolicValues);
        }
        if (diastolicValues.length > 0) {
          minDiastolic = Math.min(...diastolicValues);
          maxDiastolic = Math.max(...diastolicValues);
        }
      }
      
      // For steps, sum all values; for others, average
      const aggregatedValue = type === 'steps' ? totalValue : avgValue;
      
      // For blood pressure, calculate average systolic/diastolic
      const avgSystolic = type === 'bloodPressure' && hourData[0].systolic
        ? hourData.reduce((sum, b) => sum + (b.systolic || 0), 0) / hourData.length
        : hourData[0].systolic;
      const avgDiastolic = type === 'bloodPressure' && hourData[0].diastolic
        ? hourData.reduce((sum, b) => sum + (b.diastolic || 0), 0) / hourData.length
        : hourData[0].diastolic;
      
      // Use the highest-priority device's reading as the base
      const sortedByPriority = [...hourData].sort((a, b) => {
        const devA = devices.find(d => d.id === a.deviceId);
        const devB = devices.find(d => d.id === b.deviceId);
        return (devB?.priority ?? 0) - (devA?.priority ?? 0);
      });
      const firstReading = sortedByPriority[0];
      const [year, month, day, hour] = hourKey.split('-');
      return {
        ...firstReading,
        value: aggregatedValue,
        minValue,
        maxValue,
        systolic: avgSystolic,
        diastolic: avgDiastolic,
        minSystolic,
        maxSystolic,
        minDiastolic,
        maxDiastolic,
        timestamp: `${year}-${month}-${day}T${hour}:00:00Z`,
        notes: hourData.length > 1 ? `${hourData.length} readings` : firstReading.notes,
      };
    });

    return aggregatedData;
  };

  // Aggregate data by day for steps and sleep
  // NOTE: Using UTC methods to extract date/time components to avoid timezone issues
  const aggregateDataByDay = (data: Biomarker[]) => {
    const dailyMap = new Map<string, Biomarker[]>();
    
    data.forEach(biomarker => {
      const date = new Date(biomarker.timestamp);
      // Use UTC methods to extract date parts to avoid double timezone conversion
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      dailyMap.get(dateKey)!.push(biomarker);
    });

    // Convert map to array and aggregate values
    const aggregatedData: (Biomarker & { minValue?: number; maxValue?: number; minSystolic?: number; maxSystolic?: number; minDiastolic?: number; maxDiastolic?: number })[] = Array.from(dailyMap.entries()).map(([dateKey, dayData]) => {
      const values = dayData.map(b => b.value);
      const totalValue = values.reduce((sum, v) => sum + v, 0);
      const avgValue = totalValue / values.length;
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      // For blood pressure, also track systolic/diastolic ranges
      let minSystolic, maxSystolic, minDiastolic, maxDiastolic;
      if (type === 'bloodPressure') {
        const systolicValues = dayData.map(b => b.systolic || 0).filter(v => v > 0);
        const diastolicValues = dayData.map(b => b.diastolic || 0).filter(v => v > 0);
        if (systolicValues.length > 0) {
          minSystolic = Math.min(...systolicValues);
          maxSystolic = Math.max(...systolicValues);
        }
        if (diastolicValues.length > 0) {
          minDiastolic = Math.min(...diastolicValues);
          maxDiastolic = Math.max(...diastolicValues);
        }
      }
      
      // For steps, sum all values; for others, average
      const aggregatedValue = type === 'steps' ? totalValue : avgValue;
      
      // For blood pressure, calculate average systolic/diastolic
      const avgSystolic = type === 'bloodPressure' && dayData[0].systolic
        ? dayData.reduce((sum, b) => sum + (b.systolic || 0), 0) / dayData.length
        : dayData[0].systolic;
      const avgDiastolic = type === 'bloodPressure' && dayData[0].diastolic
        ? dayData.reduce((sum, b) => sum + (b.diastolic || 0), 0) / dayData.length
        : dayData[0].diastolic;
      
      // Use the highest-priority device's reading as the base
      const sortedByPriority = [...dayData].sort((a, b) => {
        const devA = devices.find(d => d.id === a.deviceId);
        const devB = devices.find(d => d.id === b.deviceId);
        return (devB?.priority ?? 0) - (devA?.priority ?? 0);
      });
      const firstReading = sortedByPriority[0];
      return {
        ...firstReading,
        value: aggregatedValue,
        minValue,
        maxValue,
        systolic: avgSystolic,
        diastolic: avgDiastolic,
        minSystolic,
        maxSystolic,
        minDiastolic,
        maxDiastolic,
        timestamp: dateKey + 'T00:00:00Z', // Set to start of day
        notes: type === 'sleep' && dayData.length > 1 ? `${dayData.length} readings` : firstReading.notes,
      };
    });

    return aggregatedData;
  };

  // Aggregate data by week - shows average daily value for each day in the week
  const aggregateDataByWeek = (data: Biomarker[]) => {
    // First aggregate by day
    const dailyData = aggregateDataByDay(data);
    
    // Group by week
    const weeklyMap = new Map<string, Biomarker[]>();
    
    dailyData.forEach(biomarker => {
      const date = new Date(biomarker.timestamp);
      // Get the Monday of the week (working in UTC to avoid timezone issues)
      const monday = new Date(date);
      const day = date.getUTCDay();
      const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
      monday.setUTCDate(diff);
      // Use UTC methods to extract date parts to avoid double timezone conversion
      const weekKey = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, []);
      }
      weeklyMap.get(weekKey)!.push(biomarker);
    });

    // Return daily averages for the week (each day separately)
    const aggregatedData: Biomarker[] = [];
    Array.from(weeklyMap.entries()).forEach(([weekKey, weekData]) => {
      // Keep each day's data, showing the daily average for the week
      weekData.forEach(day => {
        aggregatedData.push(day);
      });
    });

    return aggregatedData;
  };

  // Aggregate data by month - shows average for each day in the month
  const aggregateDataByMonth = (data: Biomarker[]) => {
    // First aggregate by day
    const dailyData = aggregateDataByDay(data);
    
    // Already aggregated by day, just return the daily data for the month
    return dailyData;
  };

  // Get date range for filtering based on time range and offset
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (timeRange) {
      case 'daily':
        // For daily, show specific day
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - offset);
        endDate.setHours(23, 59, 59, 999);
        
        startDate = new Date(endDate);
        startDate.setHours(0, 0, 0, 0);
        break;
        
      case 'weekly':
        // For weekly, show 7 days
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - (offset * 7));
        endDate.setHours(23, 59, 59, 999);
        
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
        
      case 'monthly':
        // For monthly, show full month
        endDate = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0, 0);
        break;
    }

    return { startDate, endDate };
  };

  // Filter data based on time range
  const filterDataByTimeRange = (data: Biomarker[]) => {
    const { startDate, endDate } = getDateRange();
    
    return data.filter(b => {
      const timestamp = new Date(b.timestamp);
      return timestamp >= startDate && timestamp <= endDate;
    });
  };

  let sortedData = [...biomarkers]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Apply time range filtering and aggregation
  sortedData = filterDataByTimeRange(sortedData);
  
  if (timeRange === 'weekly') {
    sortedData = aggregateDataByWeek(sortedData);
  } else if (timeRange === 'monthly') {
    sortedData = aggregateDataByMonth(sortedData);
  } else if (timeRange === 'daily') {
    // For daily view, aggregate by hour
    sortedData = aggregateDataByHour(sortedData);
  }

  const chartData: ChartPoint[] = sortedData.map(b => {
    const date = new Date(b.timestamp);
    let timeLabel = '';
    
    // Format time label based on time range
    // toLocaleString/toLocaleTimeString automatically converts UTC timestamps to user's local timezone
    if (timeRange === 'monthly') {
      timeLabel = date.toLocaleString(undefined, { month: 'short', day: 'numeric' });
    } else if (timeRange === 'weekly') {
      timeLabel = date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } else if (timeRange === 'daily') {
      // For daily, show hour in local time (automatically converted from UTC)
      timeLabel = date.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true }).replace(' ', '');
    }
    
    const bWithRange = b as Biomarker & { minValue?: number; maxValue?: number; minSystolic?: number; maxSystolic?: number; minDiastolic?: number; maxDiastolic?: number };
    
    return {
      time: timeLabel,
      timestamp: b.timestamp,
      value: b.type === 'steps' ? Math.round(b.value) : b.value,
      minValue: bWithRange.minValue,
      maxValue: bWithRange.maxValue,
      systolic: b.systolic,
      diastolic: b.diastolic,
      minSystolic: bWithRange.minSystolic,
      maxSystolic: bWithRange.maxSystolic,
      minDiastolic: bWithRange.minDiastolic,
      maxDiastolic: bWithRange.maxDiastolic,
      isFaulty: b.isFaulty,
      deviceName: getDeviceName(b.deviceId),
      notes: b.notes,
    };
  });

  const average = sortedData.length > 0 ? sortedData.reduce((sum, b) => sum + b.value, 0) / sortedData.length : 0;
  const min = sortedData.length > 0 ? Math.min(...sortedData.map(b => b.value)) : 0;
  const max = sortedData.length > 0 ? Math.max(...sortedData.map(b => b.value)) : 0;
  
  const recentTrend = sortedData.length >= 5 
    ? sortedData.slice(-3).reduce((sum, b) => sum + b.value, 0) / 3 - 
      sortedData.slice(-6, -3).reduce((sum, b) => sum + b.value, 0) / 3
    : 0;

  const faultyCount = sortedData.filter(b => b.isFaulty).length;

  // ── FR3.2.2 Chart Annotations ──
  // Build ApexCharts point annotations for abnormal readings, manual entries, and goal completions
  const pointAnnotations = useMemo(() => {
    const annotations: ApexAnnotations['points'] = [];
    chartData.forEach((d, i) => {
      // Abnormal reading markers
      const val = type === 'bloodPressure' ? (d.systolic || d.value) : d.value;
      const result = classifyReading(type, val);
      if (result.isAbnormal) {
        annotations.push({
          x: d.time,
          y: val,
          marker: {
            size: result.severity === 'critical' ? 8 : 6,
            fillColor: result.severity === 'critical' ? '#ef4444' : result.severity === 'warning' ? '#f59e0b' : '#eab308',
            strokeColor: '#fff',
            strokeWidth: 2,
            shape: 'circle',
          },
          label: {
            text: result.severity === 'critical' ? '⚠ Critical' : result.severity === 'warning' ? '⚠ Warning' : '! Borderline',
            borderColor: result.severity === 'critical' ? '#ef4444' : '#f59e0b',
            style: { background: result.severity === 'critical' ? '#fef2f2' : '#fffbeb', color: '#111', fontSize: '10px', padding: { left: 4, right: 4, top: 2, bottom: 2 } },
            offsetY: -15,
          },
        });
      }
      // Manual entry markers
      if (d.notes && (d.notes.toLowerCase().includes('manual') || d.notes.toLowerCase().includes('nap'))) {
        annotations.push({
          x: d.time,
          y: val,
          marker: { size: 5, fillColor: '#6366f1', strokeColor: '#fff', strokeWidth: 2, shape: 'square' as any },
          label: { text: '✏ Manual', borderColor: '#6366f1', style: { background: '#eef2ff', color: '#4338ca', fontSize: '10px', padding: { left: 3, right: 3, top: 1, bottom: 1 } }, offsetY: -10 },
        });
      }
    });
    return annotations;
  }, [chartData, type]);

  // Y-axis annotations for normal range bands
  const yAxisAnnotations = useMemo(() => {
    const range = PHYSIOLOGICAL_RANGES[type];

    if (type === 'bloodPressure') {
      // Blood pressure has two readings – show separate bands for each
      const systolicNormalLow = 90;
      const systolicNormalHigh = 130;
      const diastolicNormalLow = 60;
      const diastolicNormalHigh = 80;

      return [
        {
          y: systolicNormalLow,
          y2: systolicNormalHigh,
          borderColor: '#10b981',
          fillColor: '#10b981',
          opacity: 0.08,
          label: {
            text: `Systolic Normal (${systolicNormalLow}–${systolicNormalHigh})`,
            position: 'front' as const,
            textAnchor: 'start' as const,
            offsetX: 6,
            offsetY: -4,
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4,
            style: {
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              background: '#10b981',
              padding: { left: 6, right: 6, top: 3, bottom: 3 },
            },
          },
        },
        {
          y: diastolicNormalLow,
          y2: diastolicNormalHigh,
          borderColor: '#8b5cf6',
          fillColor: '#8b5cf6',
          opacity: 0.08,
          label: {
            text: `Diastolic Normal (${diastolicNormalLow}–${diastolicNormalHigh})`,
            position: 'front' as const,
            textAnchor: 'start' as const,
            offsetX: 6,
            offsetY: -4,
            borderColor: '#8b5cf6',
            borderWidth: 1,
            borderRadius: 4,
            style: {
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              background: '#8b5cf6',
              padding: { left: 6, right: 6, top: 3, bottom: 3 },
            },
          },
        },
      ] as ApexAnnotations['yaxis'];
    }

    return [{
      y: range.normalLow,
      y2: range.normalHigh,
      borderColor: '#10b981',
      fillColor: '#10b981',
      opacity: 0.08,
      label: {
        text: `Normal (${range.normalLow}–${range.normalHigh})`,
        position: 'front' as const,
        textAnchor: 'start' as const,
        offsetX: 6,
        offsetY: -4,
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 4,
        style: {
          color: '#fff',
          fontSize: '11px',
          fontWeight: 600,
          background: '#10b981',
          padding: { left: 6, right: 6, top: 3, bottom: 3 },
        },
      },
    }] as ApexAnnotations['yaxis'];
  }, [type]);

  // Goal completion x-axis annotations
  const xAxisAnnotations = useMemo(() => {
    if (!goals || goals.length === 0) return [];
    const { startDate, endDate } = getDateRange();
    return goals
      .filter(g => g.type === type && g.status === 'completed' && g.completedAt)
      .filter(g => {
        const d = new Date(g.completedAt!);
        return d >= startDate && d <= endDate;
      })
      .map(g => {
        const d = new Date(g.completedAt!);
        let label = '';
        if (timeRange === 'daily') label = d.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true }).replace(' ', '');
        else label = d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
        return {
          x: label,
          borderColor: '#10b981',
          strokeDashArray: 4,
          label: {
            text: '🎯 Goal!',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4,
            style: {
              color: '#fff',
              background: '#10b981',
              fontSize: '11px',
              fontWeight: 600,
              padding: { left: 6, right: 6, top: 3, bottom: 3 },
            },
            orientation: 'horizontal' as const,
            offsetY: -8,
          },
        };
      });
  }, [goals, type, timeRange, offset]);

  // Build annotations object
  const chartAnnotations: ApexAnnotations = {
    points: pointAnnotations,
    yaxis: yAxisAnnotations,
    xaxis: xAxisAnnotations as any,
  };

  // ── FR3.2.3 Data Gap Visualization ──
  // Insert null values for time gaps (connectNulls: false will break the line)
  const insertDataGaps = (data: ChartPoint[]) => {
    if (data.length < 2) return data;

    const expectedIntervalMs =
      timeRange === 'daily'
        ? 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    const formatGapLabel = (timestamp: number) => {
      const date = new Date(timestamp);
      if (timeRange === 'monthly') {
        return date.toLocaleString(undefined, { month: 'short', day: 'numeric' });
      }
      if (timeRange === 'weekly') {
        return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      }
      return date.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true }).replace(' ', '');
    };

    const result: ChartPoint[] = [];
    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      result.push(current);

      if (i < data.length - 1) {
        const currentTime = new Date(current.timestamp).getTime();
        const nextTime = new Date(data[i + 1].timestamp).getTime();
        const gapMs = nextTime - currentTime;
        const missingSlots = Math.floor(gapMs / expectedIntervalMs) - 1;

        if (missingSlots > 0) {
          for (let slot = 1; slot <= missingSlots; slot++) {
            const gapTimestamp = currentTime + (expectedIntervalMs * slot);
            result.push({
              time: formatGapLabel(gapTimestamp),
              timestamp: new Date(gapTimestamp).toISOString(),
              value: Number.NaN,
              deviceName: 'No data',
              notes: 'No data recorded',
              isGap: true,
            });
          }
        }
      }
    }
    return result;
  };

  const displayChartData = useMemo(() => insertDataGaps(chartData), [chartData, timeRange]);

  // ── Anomaly count for review badge ──
  const abnormalCount = useMemo(() => {
    return sortedData.filter(b => {
      const val = type === 'bloodPressure' ? (b.systolic || b.value) : b.value;
      return classifyReading(type, val).isAbnormal;
    }).length;
  }, [sortedData, type]);

  // Get display label for time range
  const getTimeRangeLabel = () => {
    const { startDate, endDate } = getDateRange();
    const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    
    switch (timeRange) {
      case 'daily':
        if (offset === 0) {
          return 'Today';
        } else if (offset === 1) {
          return 'Yesterday';
        }
        return formatDate(startDate);
      case 'weekly':
        if (offset === 0) {
          return `This Week (${formatDate(startDate)} - ${formatDate(endDate)})`;
        }
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      case 'monthly':
        return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  };

  // Handle time range change - reset offset when changing range
  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
    setOffset(0);
  };

  // Navigate to previous/next period
  const goToPreviousPeriod = () => {
    setOffset(offset + 1);
  };

  const goToNextPeriod = () => {
    if (offset > 0) {
      setOffset(offset - 1);
    }
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-foreground">{getBiomarkerLabel(type)}</h3>
            <p className="text-sm text-muted-foreground">{getTimeRangeLabel()}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {recentTrend > 0 ? (
              <TrendingUp className="w-5 h-5 text-red-500" />
            ) : recentTrend < 0 ? (
              <TrendingDown className="w-5 h-5 text-green-500" />
            ) : null}
            {abnormalCount > 0 && (
              <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-300 dark:bg-amber-950">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {abnormalCount} Anomal{abnormalCount === 1 ? 'y' : 'ies'}
              </Badge>
            )}
            {faultyCount > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {faultyCount} Faulty
              </Badge>
            )}
          </div>
        </div>

        {/* Time Range Selector and Navigation */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <Button
              variant={timeRange === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTimeRangeChange('daily')}
            >
              Daily
            </Button>
            <Button
              variant={timeRange === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTimeRangeChange('weekly')}
            >
              Weekly
            </Button>
            <Button
              variant={timeRange === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTimeRangeChange('monthly')}
            >
              Monthly
            </Button>
          </div>
          
          {/* Navigation buttons */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPeriod}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPeriod}
              disabled={offset === 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Show loading state while dashboard is fetching data */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <HeartbeatLoader label="Loading chart data…" size="md" />
          </div>
        ) : sortedData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No data for this period</p>
              <p className="text-sm">Try selecting a different time range or navigate to another period</p>
            </div>
          </div>
        ) : (
          <>
            {showDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Average</p>
                  <p className="text-foreground">
                    {type === 'steps' ? Math.round(average) : average.toFixed(1)} <span className="text-sm text-muted-foreground">{getBiomarkerUnit(type)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Min</p>
                  <p className="text-foreground">
                    {type === 'steps' ? Math.round(min) : min.toFixed(1)} <span className="text-sm text-muted-foreground">{getBiomarkerUnit(type)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max</p>
                  <p className="text-foreground">
                    {type === 'steps' ? Math.round(max) : max.toFixed(1)} <span className="text-sm text-muted-foreground">{getBiomarkerUnit(type)}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="h-64">
              {type === 'bloodPressure' ? (
                <ReactApexChart
                  options={{
                    chart: {
                      type: 'bar',
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
                    annotations: chartAnnotations,
                    plotOptions: {
                      bar: {
                        horizontal: false,
                        columnWidth: '60%',
                        borderRadius: 4
                      }
                    },
                    dataLabels: {
                      enabled: false
                    },
                    colors: ['#8b5cf6', '#c084fc'],
                    xaxis: {
                      categories: displayChartData.map(d => d.time),
                      labels: {
                        style: {
                          colors: '#9ca3af',
                          fontSize: '12px'
                        }
                      }
                    },
                    yaxis: {
                      labels: {
                        style: {
                          colors: '#9ca3af',
                          fontSize: '12px'
                        },
                        formatter: (value: number) => {
                          return Math.round(value).toString();
                        }
                      }
                    },
                    grid: {
                      borderColor: '#e5e7eb',
                      strokeDashArray: 3
                    },
                    tooltip: {
                      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                        const data = displayChartData[dataPointIndex];
                        if (!data || data.isGap) {
                          return `
                            <div class="bg-white p-3 rounded-lg">
                              <p class="text-sm font-medium text-gray-900 dark:text-gray-600 mb-1">No data</p>
                              <p class="text-xs text-gray-500">No blood pressure reading was recorded for this time slot.</p>
                            </div>
                          `;
                        }
                        const showRange = data.notes && data.notes.includes('readings');
                        const systolicRange = data.minSystolic !== undefined && data.maxSystolic !== undefined && data.minSystolic !== data.maxSystolic
                          ? `Range: ${Math.round(data.minSystolic)} - ${Math.round(data.maxSystolic)} ${getBiomarkerUnit(type)}`
                          : '';
                        const diastolicRange = data.minDiastolic !== undefined && data.maxDiastolic !== undefined && data.minDiastolic !== data.maxDiastolic
                          ? `Range: ${Math.round(data.minDiastolic)} - ${Math.round(data.maxDiastolic)} ${getBiomarkerUnit(type)}`
                          : '';
                        return `
                          <div class="bg-white p-3 rounded-lg">
                            <p class="text-sm font-medium text-gray-900 dark:text-gray-600  mb-2">${data.time}</p>
                            <p class="text-sm text-purple-600">
                              Systolic: <span class="font-semibold">${Math.round(data.systolic || 0)} ${getBiomarkerUnit(type)}</span>
                            </p>
                            ${systolicRange ? `<p class="text-xs text-gray-600 mt-0.5">${systolicRange}</p>` : ''}
                            <p class="text-sm text-purple-400 mt-1">
                              Diastolic: <span class="font-semibold">${Math.round(data.diastolic || 0)} ${getBiomarkerUnit(type)}</span>
                            </p>
                            ${diastolicRange ? `<p class="text-xs text-gray-600 mt-0.5">${diastolicRange}</p>` : ''}
                            ${showRange && data.notes ? `<p class="text-xs text-gray-500 mt-1">${data.notes}</p>` : ''}
                            <p class="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                              📱 ${data.deviceName}
                            </p>
                          </div>
                        `;
                      }
                    },
                    legend: {
                      show: true,
                      position: 'top',
                      horizontalAlign: 'right'
                    }
                  } as ApexOptions}
                  series={[
                    {
                      name: 'Blood Pressure',
                      data: displayChartData.map(d => ({
                        x: d.time,
                        y: d.isGap ? null : [d.diastolic || 0, d.systolic || 0]
                      }))
                    }
                  ]}
                  type="rangeBar"
                  height="100%"
                />
              ) : (
                <ReactApexChart
                  options={{
                    chart: {
                      type: type === 'steps' ? 'bar' : 'rangeBar',
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
                    annotations: chartAnnotations,
                    stroke: {
                      curve: 'smooth',
                      connectNulls: false, // FR3.2.3 - break lines at data gaps
                    },
                    plotOptions: {
                      bar: {
                        horizontal: false,
                        columnWidth: '60%',
                        borderRadius: 4
                      }
                    },
                    dataLabels: {
                      enabled: false
                    },
                    colors: [getBiomarkerColor(type)],
                    xaxis: {
                      categories: displayChartData.map(d => d.time),
                      labels: {
                        style: {
                          colors: '#9ca3af',
                          fontSize: '12px'
                        }
                      }
                    },
                    yaxis: {
                      labels: {
                        style: {
                          colors: '#9ca3af',
                          fontSize: '12px'
                        },
                        formatter: (value: number) => {
                          return type === 'steps' ? Math.round(value).toString() : value.toFixed(1);
                        }
                      }
                    },
                    grid: {
                      borderColor: '#e5e7eb',
                      strokeDashArray: 3
                    },
                    tooltip: {
                      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                        const data = displayChartData[dataPointIndex];
                        if (!data || data.isGap) {
                          return `
                            <div class="bg-white p-3 rounded-lg">
                              <p class="text-sm font-medium text-gray-900 dark:text-gray-600 mb-1">No data</p>
                              <p class="text-xs text-gray-500">No ${getBiomarkerLabel(type).toLowerCase()} reading was recorded for this time slot.</p>
                            </div>
                          `;
                        }
                        const displayValue = type === 'steps' ? Math.round(data.value) : data.value.toFixed(1);
                        const hasRange = data.minValue !== undefined && data.maxValue !== undefined && data.minValue !== data.maxValue;
                        const rangeText = hasRange 
                          ? `Range: ${type === 'steps' ? Math.round(data.minValue!) : data.minValue!.toFixed(1)} - ${type === 'steps' ? Math.round(data.maxValue!) : data.maxValue!.toFixed(1)} ${getBiomarkerUnit(type)}`
                          : '';
                        return `
                          <div class="bg-white p-3 rounded-lg">
                            <p class="text-sm font-medium text-gray-900 dark:text-gray-600 mb-2">${data.time}</p>
                            <p class="text-sm font-semibold text-gray-500">
                              ${getBiomarkerLabel(type)}: ${displayValue} ${getBiomarkerUnit(type)}
                            </p>
                            ${hasRange ? `<p class="text-xs text-gray-600 mt-1">${rangeText}</p>` : ''}
                            ${data.notes ? `<p class="text-xs text-gray-600 mt-1"> ${data.notes}</p>` : ''}
                            <p class="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                              📱 ${data.deviceName}
                            </p>
                            ${data.isFaulty ? '<p class="text-xs text-red-600 font-medium mt-1">⚠️ Faulty Reading</p>' : ''}
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
                      name: getBiomarkerLabel(type),
                      data: type === 'steps'
                        ? displayChartData.map(d => ({
                            x: d.time,
                            y: d.isGap ? null : d.value
                          }))
                        : displayChartData.map(d => ({
                            x: d.time,
                            y: d.isGap
                              ? null
                              : d.minValue !== undefined && d.maxValue !== undefined && d.minValue !== d.maxValue
                              ? [d.minValue, d.maxValue]
                              : [d.value, d.value]
                          }))
                    }
                  ]}
                  type={type === 'steps' ? 'bar' : 'rangeBar'}
                  height="100%"
                />
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
