import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Biomarker, Device, getBiomarkerLabel, getBiomarkerUnit, getBiomarkerColor } from '../../utils/mockData';
import { TrendingUp, TrendingDown, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface BiomarkerChartProps {
  biomarkers: Biomarker[];
  type: Biomarker['type'];
  showDetails?: boolean;
  devices?: Device[];
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

export function BiomarkerChart({ biomarkers, type, showDetails, devices = [] }: BiomarkerChartProps) {
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

  // Aggregate data by day for steps and sleep
  const aggregateDataByDay = (data: Biomarker[]) => {
    const dailyMap = new Map<string, Biomarker[]>();
    
    data.forEach(biomarker => {
      const date = new Date(biomarker.timestamp);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      dailyMap.get(dateKey)!.push(biomarker);
    });

    // Convert map to array and aggregate values
    const aggregatedData: Biomarker[] = Array.from(dailyMap.entries()).map(([dateKey, dayData]) => {
      const totalValue = dayData.reduce((sum, b) => sum + b.value, 0);
      const avgValue = totalValue / dayData.length;
      
      // For steps, sum all values; for sleep, average the values
      const aggregatedValue = type === 'steps' ? totalValue : avgValue;
      
      // Use the first reading of the day as the base, but update value and timestamp
      const firstReading = dayData[0];
      return {
        ...firstReading,
        value: aggregatedValue,
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
      // Get the Monday of the week
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      
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
    // For daily view, show individual readings within the day
    // No aggregation needed unless it's steps/sleep
    if (type === 'steps' || type === 'sleep') {
      sortedData = aggregateDataByDay(sortedData);
    }
  }

  const chartData = sortedData.map(b => {
    const date = new Date(b.timestamp);
    let timeLabel = '';
    
    // Format time label based on time range
    if (timeRange === 'monthly') {
      timeLabel = date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    } else if (timeRange === 'weekly') {
      timeLabel = date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    } else if (timeRange === 'daily') {
      // For daily, show time if we have multiple readings, otherwise just show the time
      if (type === 'steps' || type === 'sleep') {
        timeLabel = date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      } else {
        timeLabel = date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
    }
    
    return {
      time: timeLabel,
      value: b.type === 'steps' ? Math.round(b.value) : b.value,
      systolic: b.systolic,
      diastolic: b.diastolic,
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

  // Get display label for time range
  const getTimeRangeLabel = () => {
    const { startDate, endDate } = getDateRange();
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
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
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground">{getBiomarkerLabel(type)}</h3>
            <p className="text-sm text-muted-foreground">{getTimeRangeLabel()}</p>
          </div>
          <div className="flex items-center gap-2">
            {recentTrend > 0 ? (
              <TrendingUp className="w-5 h-5 text-red-500" />
            ) : recentTrend < 0 ? (
              <TrendingDown className="w-5 h-5 text-green-500" />
            ) : null}
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

        {/* Check if there's no data */}
        {sortedData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No data for this period</p>
              <p className="text-sm">Try selecting a different time range or navigate to another period</p>
            </div>
          </div>
        ) : (
          <>
            {showDetails && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
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
              <ResponsiveContainer width="100%" height="100%">
                {type === 'bloodPressure' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      content={(props) => {
                        if (!props.active || !props.payload || props.payload.length === 0) return null;
                        const data = props.payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-600 mb-2">{data.time}</p>
                            <p className="text-sm text-purple-600 dark:text-purple-800">
                              Systolic: <span className="font-semibold">{data.systolic} {getBiomarkerUnit(type)}</span>
                            </p>
                            <p className="text-sm text-purple-400 dark:text-purple-600">
                              Diastolic: <span className="font-semibold">{data.diastolic} {getBiomarkerUnit(type)}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                              📱 {data.deviceName}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="systolic" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      name="Systolic"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="diastolic" 
                      stroke="#c084fc" 
                      strokeWidth={2}
                      dot={{ fill: '#c084fc', r: 4 }}
                      name="Diastolic"
                    />
                  </LineChart>
                ) : (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={getBiomarkerColor(type)} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={getBiomarkerColor(type)} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      content={(props) => {
                        if (!props.active || !props.payload || props.payload.length === 0) return null;
                        const data = props.payload[0].payload;
                        const displayValue = type === 'steps' ? Math.round(data.value) : data.value.toFixed(1);
                        return (
                          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-600 mb-2">{data.time}</p>
                            <p className="text-sm font-semibold dark:text-gray-500">
                              {getBiomarkerLabel(type)}: {displayValue} {getBiomarkerUnit(type)}
                            </p>
                            {data.notes && (
                              <p className="text-xs text-gray-600 mt-1">
                                💤 {data.notes}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                              📱 {data.deviceName}
                            </p>
                            {data.isFaulty && (
                              <p className="text-xs text-red-600 font-medium mt-1">
                                ⚠️ Faulty Reading
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={getBiomarkerColor(type)}
                      strokeWidth={2}
                      fill={`url(#gradient-${type})`}
                      dot={{ fill: getBiomarkerColor(type), r: 4 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}