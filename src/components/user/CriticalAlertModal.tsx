import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertTriangle, HeartPulse, Activity, Droplet, ShieldAlert, Phone } from 'lucide-react';

export interface CriticalAlert {
  id: string;
  type: 'heartRate' | 'bloodPressure' | 'glucose' | 'oxygen';
  value: number;
  secondaryValue?: number; // diastolic for BP
  message: string;
  timestamp: string;
}

interface CriticalAlertModalProps {
  alert: CriticalAlert | null;
  onAcknowledge: (alertId: string) => void;
  onCallEmergency?: () => void;
}

/** Thresholds that qualify as dangerously out-of-range */
const CRITICAL_THRESHOLDS: Record<string, { min: number; max: number; label: string }> = {
  heartRate: { min: 40, max: 150, label: 'Heart Rate' },
  bloodPressure: { min: 70, max: 180, label: 'Blood Pressure (Systolic)' },
  glucose: { min: 40, max: 400, label: 'Blood Glucose' },
  oxygen: { min: 85, max: 100, label: 'Blood Oxygen' },
};

/** Check whether a reading is critically dangerous (not just abnormal) */
export function isCriticalReading(type: string, value: number): boolean {
  const threshold = CRITICAL_THRESHOLDS[type];
  if (!threshold) return false;
  return value <= threshold.min || value >= threshold.max;
}

function getIcon(type: string) {
  switch (type) {
    case 'heartRate': return HeartPulse;
    case 'bloodPressure': return Activity;
    case 'glucose': return Droplet;
    default: return ShieldAlert;
  }
}

function getSeverityColor(type: string, value: number) {
  const threshold = CRITICAL_THRESHOLDS[type];
  if (!threshold) return 'bg-red-500';
  if (value >= threshold.max * 1.1 || value <= threshold.min * 0.8) return 'bg-red-700';
  return 'bg-red-500';
}

export function CriticalAlertModal({ alert, onAcknowledge, onCallEmergency }: CriticalAlertModalProps) {
  const [pulseAnim, setPulseAnim] = useState(true);

  useEffect(() => {
    if (alert) {
      setPulseAnim(true);
    }
  }, [alert]);

  if (!alert) return null;

  const Icon = getIcon(alert.type);
  const threshold = CRITICAL_THRESHOLDS[alert.type];
  const isHigh = threshold ? alert.value >= threshold.max : true;
  const severityBg = getSeverityColor(alert.type, alert.value);

  const displayValue = alert.type === 'bloodPressure' && alert.secondaryValue
    ? `${alert.value}/${alert.secondaryValue}`
    : `${alert.value}`;

  const unit = alert.type === 'heartRate' ? 'bpm'
    : alert.type === 'bloodPressure' ? 'mmHg'
    : alert.type === 'glucose' ? 'mg/dL'
    : '%';

  return (
    <Dialog open={!!alert} onOpenChange={() => { /* prevent closing by clicking outside */ }}>
      <DialogContent
        className="sm:max-w-lg border-0 p-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Pulsing header bar */}
        <div className={`relative ${severityBg} text-white p-8 text-center`}>
          {pulseAnim && (
            <div className="absolute inset-0 animate-ping opacity-20 bg-white rounded-lg" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-bounce">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <Badge className="bg-white/30 text-white border-white/40 text-sm px-4 py-1 uppercase tracking-wider">
              Critical Alert
            </Badge>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl text-center text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
              <Icon className="w-7 h-7" />
              {threshold?.label || 'Vital Sign'} - {isHigh ? 'Dangerously High' : 'Dangerously Low'}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {alert.message}
            </DialogDescription>
          </DialogHeader>

          {/* Reading value panel */}
          <div className="mx-auto max-w-xs rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Current Reading</p>
            <p className="text-5xl font-bold text-red-600 dark:text-red-400 tracking-tight">
              {displayValue}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{unit}</p>
            {threshold && (
              <p className="mt-3 text-xs text-red-500 dark:text-red-400">
                Safe range: {threshold.min}–{threshold.max} {unit}
              </p>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-2">
              Recommended Actions
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
              {alert.type === 'heartRate' && isHigh && (
                <>
                  <li>Sit or lie down immediately and breathe deeply</li>
                  <li>Avoid caffeine, alcohol, and strenuous activity</li>
                  <li>If symptoms persist, seek medical attention</li>
                </>
              )}
              {alert.type === 'heartRate' && !isHigh && (
                <>
                  <li>Sit down and monitor how you feel</li>
                  <li>Contact your healthcare provider</li>
                  <li>If dizzy or faint, call emergency services</li>
                </>
              )}
              {alert.type === 'bloodPressure' && isHigh && (
                <>
                  <li>Rest in a comfortable position</li>
                  <li>Take prescribed medication if available</li>
                  <li>If accompanied by headache or chest pain, call 911</li>
                </>
              )}
              {alert.type === 'bloodPressure' && !isHigh && (
                <>
                  <li>Lie down and elevate your legs</li>
                  <li>Hydrate with water or electrolyte drinks</li>
                  <li>Seek medical help if feeling faint</li>
                </>
              )}
              {alert.type === 'glucose' && isHigh && (
                <>
                  <li>Check ketone levels if possible</li>
                  <li>Drink water to stay hydrated</li>
                  <li>Contact your doctor or endocrinologist</li>
                </>
              )}
              {alert.type === 'glucose' && !isHigh && (
                <>
                  <li>Consume fast-acting sugar (juice, candy)</li>
                  <li>Re-test in 15 minutes</li>
                  <li>If unconscious, call emergency services immediately</li>
                </>
              )}
              {alert.type === 'oxygen' && (
                <>
                  <li>Sit upright and take slow, deep breaths</li>
                  <li>Use supplemental oxygen if available</li>
                  <li>Seek immediate medical attention</li>
                </>
              )}
            </ul>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            {onCallEmergency && (
              <Button
                variant="destructive"
                className="flex-1 h-12 text-base gap-2"
                onClick={onCallEmergency}
              >
                <Phone className="w-5 h-5" />
                Call Emergency
              </Button>
            )}
            <Button
              className="flex-1 h-12 text-base bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              onClick={() => {
                setPulseAnim(false);
                onAcknowledge(alert.id);
              }}
            >
              I Understand - Dismiss
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
