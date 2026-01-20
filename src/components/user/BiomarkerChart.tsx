import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Biomarker, Device, getBiomarkerLabel, getBiomarkerUnit, getBiomarkerColor } from '../../utils/mockData';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface BiomarkerChartProps {
  biomarkers: Biomarker[];
  type: Biomarker['type'];
  showDetails?: boolean;
  devices?: Device[];
}

export function BiomarkerChart({ biomarkers, type, showDetails, devices = [] }: BiomarkerChartProps) {
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

  let sortedData = [...biomarkers]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Aggregate by day for steps and sleep, otherwise show individual data points
  if (type === 'steps' || type === 'sleep') {
    sortedData = aggregateDataByDay(sortedData).slice(-20); // Last 20 days
  } else {
    sortedData = sortedData.slice(-20); // Last 20 readings
  }

  // Check if there's no data
  if (sortedData.length === 0) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-foreground">{getBiomarkerLabel(type)}</h3>
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No data recorded yet</p>
              <p className="text-sm">Start tracking to see your {getBiomarkerLabel(type).toLowerCase()} data here</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const chartData = sortedData.map(b => ({
    time: new Date(b.timestamp).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: b.type === 'steps' || b.type === 'sleep' ? undefined : '2-digit',
      minute: b.type === 'steps' || b.type === 'sleep' ? undefined : '2-digit',
    }),
    value: b.type === 'steps' ? Math.round(b.value) : b.value,
    systolic: b.systolic,
    diastolic: b.diastolic,
    isFaulty: b.isFaulty,
    deviceName: getDeviceName(b.deviceId),
    notes: b.notes,
  }));

  const average = sortedData.reduce((sum, b) => sum + b.value, 0) / sortedData.length;
  const min = Math.min(...sortedData.map(b => b.value));
  const max = Math.max(...sortedData.map(b => b.value));
  
  const recentTrend = sortedData.length >= 5 
    ? sortedData.slice(-3).reduce((sum, b) => sum + b.value, 0) / 3 - 
      sortedData.slice(-6, -3).reduce((sum, b) => sum + b.value, 0) / 3
    : 0;

  const faultyCount = sortedData.filter(b => b.isFaulty).length;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground">{getBiomarkerLabel(type)}</h3>
            <p className="text-sm text-muted-foreground">Last {sortedData.length} readings</p>
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
      </div>
    </Card>
  );
}