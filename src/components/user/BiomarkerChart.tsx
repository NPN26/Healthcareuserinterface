import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Biomarker, getBiomarkerLabel, getBiomarkerUnit, getBiomarkerColor } from '../../utils/mockData';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface BiomarkerChartProps {
  biomarkers: Biomarker[];
  type: Biomarker['type'];
  showDetails?: boolean;
}

export function BiomarkerChart({ biomarkers, type, showDetails }: BiomarkerChartProps) {
  const sortedData = [...biomarkers]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-20); // Last 20 readings

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
      second: b.type === 'steps' || b.type === 'sleep' ? undefined : '2-digit',
    }),
    value: b.type === 'steps' ? Math.round(b.value) : b.value,
    systolic: b.systolic,
    diastolic: b.diastolic,
    isFaulty: b.isFaulty,
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
                  formatter={(value: any, name: any, props: any) => {
                    const displayValue = type === 'steps' ? Math.round(value) : value.toFixed(1);
                    return [`${displayValue} ${getBiomarkerUnit(type)}`, getBiomarkerLabel(type)];
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