import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Biomarker, getBiomarkerLabel, getBiomarkerUnit, getBiomarkerColor } from '../utils/mockData';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsComparisonProps {
  biomarkers: Biomarker[];
}

export function StatsComparison({ biomarkers }: StatsComparisonProps) {
  const [selectedType, setSelectedType] = useState<Biomarker['type']>('steps');
  const [comparisonType, setComparisonType] = useState<'day' | 'week' | 'month'>('week');

  const getComparisonData = () => {
    const filtered = biomarkers.filter(b => b.type === selectedType);
    const now = new Date();
    
    if (comparisonType === 'day') {
      // Compare today vs yesterday
      const today = filtered.filter(b => {
        const date = new Date(b.timestamp);
        return date.toDateString() === now.toDateString();
      });
      const yesterday = filtered.filter(b => {
        const date = new Date(b.timestamp);
        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        return date.toDateString() === yesterdayDate.toDateString();
      });

      const todayAvg = today.length > 0 ? today.reduce((sum, b) => sum + b.value, 0) / today.length : 0;
      const yesterdayAvg = yesterday.length > 0 ? yesterday.reduce((sum, b) => sum + b.value, 0) / yesterday.length : 0;

      return {
        data: [
          { name: 'Yesterday', value: yesterdayAvg },
          { name: 'Today', value: todayAvg },
        ],
        change: todayAvg - yesterdayAvg,
        percentChange: yesterdayAvg > 0 ? ((todayAvg - yesterdayAvg) / yesterdayAvg) * 100 : 0,
      };
    } else if (comparisonType === 'week') {
      // Compare this week vs last week
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);

      const thisWeek = filtered.filter(b => {
        const date = new Date(b.timestamp);
        return date >= thisWeekStart && date <= now;
      });
      const lastWeek = filtered.filter(b => {
        const date = new Date(b.timestamp);
        return date >= lastWeekStart && date < lastWeekEnd;
      });

      const thisWeekAvg = thisWeek.length > 0 ? thisWeek.reduce((sum, b) => sum + b.value, 0) / thisWeek.length : 0;
      const lastWeekAvg = lastWeek.length > 0 ? lastWeek.reduce((sum, b) => sum + b.value, 0) / lastWeek.length : 0;

      return {
        data: [
          { name: 'Last Week', value: lastWeekAvg },
          { name: 'This Week', value: thisWeekAvg },
        ],
        change: thisWeekAvg - lastWeekAvg,
        percentChange: lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0,
      };
    } else {
      // Compare this month vs last month
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const thisMonth = filtered.filter(b => {
        const date = new Date(b.timestamp);
        return date >= thisMonthStart && date <= now;
      });
      const lastMonth = filtered.filter(b => {
        const date = new Date(b.timestamp);
        return date >= lastMonthStart && date <= lastMonthEnd;
      });

      const thisMonthAvg = thisMonth.length > 0 ? thisMonth.reduce((sum, b) => sum + b.value, 0) / thisMonth.length : 0;
      const lastMonthAvg = lastMonth.length > 0 ? lastMonth.reduce((sum, b) => sum + b.value, 0) / lastMonth.length : 0;

      return {
        data: [
          { name: 'Last Month', value: lastMonthAvg },
          { name: 'This Month', value: thisMonthAvg },
        ],
        change: thisMonthAvg - lastMonthAvg,
        percentChange: lastMonthAvg > 0 ? ((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100 : 0,
      };
    }
  };

  const comparisonResult = getComparisonData();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-foreground mb-4">Compare Your Health Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Select Metric</label>
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as Biomarker['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="steps">Steps</SelectItem>
                <SelectItem value="heartRate">Heart Rate</SelectItem>
                <SelectItem value="bloodPressure">Blood Pressure</SelectItem>
                <SelectItem value="glucose">Blood Glucose</SelectItem>
                <SelectItem value="oxygen">Blood Oxygen</SelectItem>
                <SelectItem value="sleep">Sleep</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Comparison Period</label>
            <Select value={comparisonType} onValueChange={(value) => setComparisonType(value as 'day' | 'week' | 'month')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today vs Yesterday</SelectItem>
                <SelectItem value="week">This Week vs Last Week</SelectItem>
                <SelectItem value="month">This Month vs Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-foreground">{getBiomarkerLabel(selectedType)} Comparison</h3>
            <p className="text-sm text-gray-600">
              {comparisonType === 'day' ? 'Today vs Yesterday' :
               comparisonType === 'week' ? 'This Week vs Last Week' :
               'This Month vs Last Month'}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className={`flex items-center gap-2 ${
              comparisonResult.change > 0 ? 'text-red-500' : comparisonResult.change < 0 ? 'text-green-500' : 'text-gray-500'
            }`}>
              {comparisonResult.change > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span className="text-2xl">
                {Math.abs(comparisonResult.percentChange).toFixed(1)}%
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {comparisonResult.change > 0 ? 'Increase' : 'Decrease'}
            </p>
          </div>
        </div>

        <div className="h-80">
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
                  }
                },
                toolbar: {
                  show: false
                }
              },
              plotOptions: {
                bar: {
                  borderRadius: 8,
                  borderRadiusApplication: 'end',
                  columnWidth: '50%'
                }
              },
              colors: [getBiomarkerColor(selectedType)],
              xaxis: {
                categories: comparisonResult.data.map(d => d.name),
                labels: {
                  style: {
                    colors: '#9ca3af'
                  }
                }
              },
              yaxis: {
                labels: {
                  style: {
                    colors: '#9ca3af'
                  },
                  formatter: (value) => value.toFixed(1)
                }
              },
              grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 3
              },
              tooltip: {
                y: {
                  formatter: (value) => `${value.toFixed(1)} ${getBiomarkerUnit(selectedType)}`
                }
              },
              dataLabels: {
                enabled: false
              },
              legend: {
                show: false
              }
            } as ApexOptions}
            series={[
              {
                name: getBiomarkerLabel(selectedType),
                data: comparisonResult.data.map(d => d.value)
              }
            ]}
            type="bar"
            height="100%"
          />
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 className="text-sm text-gray-900 mb-2">Insights</h4>
          <p className="text-sm text-gray-600">
            {comparisonResult.change > 0 
              ? `Your ${getBiomarkerLabel(selectedType).toLowerCase()} has increased by ${comparisonResult.change.toFixed(1)} ${getBiomarkerUnit(selectedType)} (${comparisonResult.percentChange.toFixed(1)}%) compared to the previous period.`
              : comparisonResult.change < 0
              ? `Your ${getBiomarkerLabel(selectedType).toLowerCase()} has decreased by ${Math.abs(comparisonResult.change).toFixed(1)} ${getBiomarkerUnit(selectedType)} (${Math.abs(comparisonResult.percentChange).toFixed(1)}%) compared to the previous period.`
              : `Your ${getBiomarkerLabel(selectedType).toLowerCase()} has remained stable compared to the previous period.`
            }
          </p>
        </div>
      </Card>
    </div>
  );
}
