import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { CheckCircle, AlertCircle, Target, TrendingUp } from 'lucide-react';
import { Biomarker, getBiomarkerLabel, getBiomarkerUnit } from '../../utils/mockData';

interface DailySummaryProps {
  biomarkers: Biomarker[];
  selectedDate?: Date;
}

export function DailySummary({ biomarkers, selectedDate }: DailySummaryProps) {
  const targetDate = (selectedDate || new Date()).toDateString();
  const todaysBiomarkers = biomarkers.filter(b => 
    new Date(b.timestamp).toDateString() === targetDate
  );

  const getLatestToday = (type: Biomarker['type']) => {
    const filtered = todaysBiomarkers.filter(b => b.type === type);
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  };

  const stepsReadings = todaysBiomarkers.filter(b => b.type === 'steps');
  const stepsTotal = stepsReadings.reduce((sum, reading) => sum + reading.value, 0);
  const stepsGoal = 10000;
  const stepsProgress = stepsReadings.length > 0 ? Math.min((stepsTotal / stepsGoal) * 100, 100) : 0;

  const sleepreadings = todaysBiomarkers.filter(b => b.type === 'sleep');
  const sleep = sleepreadings.length > 0 ? sleepreadings.reduce((acc, curr) => acc.value > curr.value ? acc : curr) : undefined;
  const sleepGoal = 8;
  const sleepProgress = sleep ? Math.min((sleep.value / sleepGoal) * 100, 100) : 0;

  const heartRate = getLatestToday('heartRate');
  const heartRateNormal = heartRate && heartRate.value >= 60 && heartRate.value <= 100;

  const glucose = getLatestToday('glucose');
  const glucoseNormal = glucose && glucose.value >= 70 && glucose.value <= 130;

  const normalCount = [heartRateNormal, glucoseNormal].filter(Boolean).length;
  const totalChecks = 2;
  const healthScore = Math.round((normalCount / totalChecks) * 100);

  const recommendations = [];
  if (stepsReadings.length > 0 && stepsTotal < stepsGoal) {
    recommendations.push(`Walk ${Math.round(stepsGoal - stepsTotal).toLocaleString()} more steps to reach your goal`);
  }
  if (sleep && sleep.value < 7) {
    recommendations.push('Try to get at least 7-8 hours of sleep tonight');
  }
  if (heartRate && heartRate.value > 100) {
    recommendations.push('Your heart rate is elevated. Consider some relaxation exercises');
  }
  if (stepsReadings.length === 0) {
    recommendations.push('Start tracking your steps today');
  }

  return (
    <Card className="p-6 bg-card">
      <div className="space-y-6">
        <div>
          <h3 className="text-foreground mb-1">Daily Health Summary</h3>
          <p className="text-sm text-gray-600">{(selectedDate || new Date()).toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>

        {/* Health Score */}
        <div className="p-4 rounded-xl bg-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-650">Health Score</p>
              <p className="text-2xl text-gray-950">{healthScore}/100</p>
            </div>
            <div className={`text-4xl ${
              healthScore >= 80 ? 'text-green-500' :
              healthScore >= 60 ? 'text-yellow-500' :
              'text-red-500'
            }`}>
              {healthScore >= 80 ? '😊' : healthScore >= 60 ? '😐' : '😟'}
            </div>
          </div>
          <Progress value={healthScore} className="h-2" />
        </div>

        {/* Goals Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-100 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Steps Goal</p>
              <Badge variant={stepsProgress >= 100 ? 'default' : 'secondary'}>
                {stepsReadings.length > 0 ? `${Math.round(stepsTotal).toLocaleString()}/${stepsGoal.toLocaleString()}` : 'No data'}
              </Badge>
            </div>
            <Progress value={stepsProgress} className="h-2 mb-2" />
            <p className="text-xs text-gray-500">
              {stepsProgress >= 100 ? 'Goal achieved! 🎉' : `${(100 - stepsProgress).toFixed(0)}% remaining`}
            </p>
          </div>

          <div className="p-4 bg-gray-100 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Sleep Goal</p>
              <Badge variant={sleepProgress >= 100 ? 'default' : 'secondary'}>
                {sleep ? `${sleep.value.toFixed(1)}/${sleepGoal} hrs` : 'No data'}
              </Badge>
            </div>
            <Progress value={sleepProgress} className="h-2 mb-2" />
            <p className="text-xs text-gray-500">
              {sleepProgress >= 100 ? 'Great sleep! 😴' : 'Aim for 7-8 hours'}
            </p>
          </div>
        </div>

        {/* Vitals Status */}
        <div className="p-4 bg-gray-100 rounded-xl">
          <p className="text-sm text-gray-600 mb-3">Vital Signs Status</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {heartRateNormal ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-sm text-gray-900">Heart Rate</span>
              </div>
              <span className="text-sm text-gray-600">
                {heartRate ? `${heartRate.value} bpm` : 'No data'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {glucoseNormal ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-sm text-gray-900">Blood Glucose</span>
              </div>
              <span className="text-sm text-gray-600">
                {glucose ? `${glucose.value} mg/dL` : 'No data'}
              </span>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="p-4 bg-gray-100 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-gray-900">Today's Recommendations</p>
            </div>
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-600">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
