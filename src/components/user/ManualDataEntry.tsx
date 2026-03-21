import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Heart, Activity, Droplet, Wind, Footprints, Moon, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Biomarker } from '../../utils/mockData';
import { secureGetItem, secureSetItem } from '../../utils/secureStorage';
import {
  validateNumber,
  validateDate,
  validateText,
  validateEnum,
  sanitizeText,
  containsDangerousPatterns,
} from '../../utils/inputValidation';

interface ManualDataEntryProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  deviceId: string;
  onDataAdded: () => void;
}

export function ManualDataEntry({ isOpen, onClose, userId, deviceId, onDataAdded }: ManualDataEntryProps) {
  const [dataType, setDataType] = useState<Biomarker['type']>('heartRate');
  const [value, setValue] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  // Helper to get current local datetime in yyyy-MM-ddTHH:mm format for datetime-local input
  function getLocalDateTimeString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const [timestamp, setTimestamp] = useState(getLocalDateTimeString());
  const [notes, setNotes] = useState('');

  const biomarkerTypes = [
    { value: 'heartRate', label: 'Heart Rate', icon: Heart, unit: 'bpm', placeholder: '75', min: 20, max: 300 },
    { value: 'bloodPressure', label: 'Blood Pressure', icon: Activity, unit: 'mmHg', placeholder: 'Systolic/Diastolic', min: 40, max: 300 },
    { value: 'glucose', label: 'Blood Glucose', icon: Droplet, unit: 'mg/dL', placeholder: '100', min: 20, max: 600 },
    { value: 'oxygen', label: 'Blood Oxygen', icon: Wind, unit: '%', placeholder: '98', min: 50, max: 100 },
    { value: 'steps', label: 'Steps', icon: Footprints, unit: 'steps', placeholder: '8000', min: 0, max: 200000 },
    { value: 'sleep', label: 'Sleep', icon: Moon, unit: 'hours', placeholder: '7.5', min: 0, max: 24 },
    { value: 'weight', label: 'Weight', icon: Scale, unit: 'kg', placeholder: '70', min: 1, max: 500 },
  ];

  const handleSubmit = async () => {
    const validDataTypes = ['heartRate', 'bloodPressure', 'glucose', 'oxygen', 'steps', 'sleep', 'weight'] as const;
    const dataTypeValidation = validateEnum(dataType, validDataTypes);
    if (!dataTypeValidation.isValid) {
      toast.error('Please select a valid metric type');
      return;
    }

    const typeConfig = biomarkerTypes.find(t => t.value === dataType);

    if (dataType === 'bloodPressure') {
      if (!systolic || !diastolic) {
        toast.error('Please enter both systolic and diastolic values');
        return;
      }

      const sysValidation = validateNumber(systolic, { min: 40, max: 300, allowDecimal: false });
      const diaValidation = validateNumber(diastolic, { min: 20, max: 200, allowDecimal: false });

      if (!sysValidation.isValid) {
        toast.error('Systolic value must be between 40 and 300');
        return;
      }
      if (!diaValidation.isValid) {
        toast.error('Diastolic value must be between 20 and 200');
        return;
      }

      const sysVal = sysValidation.sanitizedValue as number;
      const diaVal = diaValidation.sanitizedValue as number;

      if (diaVal >= sysVal) {
        toast.error('Diastolic must be lower than systolic');
        return;
      }
    } else {
      if (!value) {
        toast.error('Please enter a value');
        return;
      }

      const allowDecimal = dataType === 'sleep' || dataType === 'weight';
      const valueValidation = validateNumber(value, {
        min: typeConfig?.min ?? 0,
        max: typeConfig?.max ?? 999999,
        allowDecimal
      });

      if (!valueValidation.isValid) {
        toast.error(`${typeConfig?.label || 'Value'} must be between ${typeConfig?.min} and ${typeConfig?.max} ${typeConfig?.unit}`);
        return;
      }
    }

    // Validate timestamp
    const timestampValidation = validateDate(timestamp, {
      required: true,
      maxDate: new Date(Date.now() + 60000), // Allow up to 1 minute in future for clock skew
      minDate: new Date('2000-01-01'),
    });
    if (!timestampValidation.isValid) {
      toast.error(timestampValidation.error || 'Please enter a valid date and time');
      return;
    }

    // Validate and sanitize notes (optional)
    let sanitizedNotes = '';
    if (notes.trim()) {
      const notesValidation = validateText(notes, { maxLength: 500, required: false });
      if (!notesValidation.isValid) {
        toast.error(notesValidation.error || 'Notes contain invalid characters');
        return;
      }

      // Check for dangerous patterns
      const notesDangerCheck = containsDangerousPatterns(notes);
      if (notesDangerCheck.dangerous) {
        toast.error('Notes contain invalid content');
        return;
      }

      sanitizedNotes = sanitizeText(notes, { maxLength: 500, allowNewlines: false });
    }

    const newReading: Biomarker = {
      id: `biomarker-${Date.now()}`,
      userId,
      deviceId,
      type: dataType,
      value: dataType === 'bloodPressure' ? parseInt(systolic) : parseFloat(value),
      systolic: dataType === 'bloodPressure' ? parseInt(systolic) : undefined,
      diastolic: dataType === 'bloodPressure' ? parseInt(diastolic) : undefined,
      timestamp: new Date(timestamp).toISOString(),
      isFaulty: false,
      notes: sanitizedNotes || undefined,
    };

    // Save to database
    try {
      const { supabase } = await import('../../utils/supabase');
      
      // Map frontend type to database enum
      const typeMapping: Record<string, string> = {
        'heartRate': 'HEART_RATE',
        'bloodPressure': 'BLOOD_PRESSURE',
        'glucose': 'BLOOD_GLUCOSE',
        'oxygen': 'SPO2',
        'steps': 'STEPS',
        'sleep': 'SLEEP',
        'temperature': 'RESPIRATORY_RATE',
        'weight': 'WEIGHT'
      };

      const unitMapping: Record<string, string> = {
        'heartRate': 'bpm',
        'bloodPressure': 'mmHg',
        'glucose': 'mg/dL',
        'oxygen': '%',
        'steps': 'steps',
        'sleep': 'hours',
        'temperature': '°F',
        'weight': 'kg'
      };

      // First, create data_point
      const { data: dataPoint, error: dataPointError } = await supabase
        .from('data_points')
        .insert({
          user_id: userId,
          source_id: deviceId,
          timestamp: newReading.timestamp,
          data_type: 'MANUAL'
        })
        .select()
        .single();

      if (dataPointError) {
      } else if (dataPoint) {
        // Create both biomarker_data and manual_entries records
        const { error: biomarkerError } = await supabase
          .from('biomarker_data')
          .insert({
            data_point_id: dataPoint.data_point_id,
            type: typeMapping[dataType] || 'HEART_RATE',
            value: newReading.value,
            secondary_value: newReading.diastolic || null,
            unit: unitMapping[dataType] || 'unit'
          });

        if (biomarkerError) {
        }

        // Also insert into manual_entries
        const { error: manualError } = await supabase
          .from('manual_entries')
          .insert({
            data_point_id: dataPoint.data_point_id,
            entry_type: 'MEASUREMENT',
            content: {
              type: dataType,
              value: newReading.value,
              systolic: newReading.systolic,
              diastolic: newReading.diastolic,
              notes: sanitizedNotes || undefined
            }
          });

        if (manualError) {
        }
      }
    } catch (error) {
      // Continue with localStorage as fallback
    }

    const allBiomarkers = JSON.parse(await secureGetItem('healthApp_biomarkers') || '[]');
    const updatedBiomarkers = [...allBiomarkers, newReading];
    await secureSetItem('healthApp_biomarkers', JSON.stringify(updatedBiomarkers));

    toast.success('Data logged successfully!');
    onDataAdded();
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setValue('');
    setSystolic('');
    setDiastolic('');
    setTimestamp(new Date().toISOString().slice(0, 16));
    setNotes('');
  };

  const currentType = biomarkerTypes.find(t => t.value === dataType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Log Health Data
          </DialogTitle>
          <DialogDescription>Manually enter your health metrics</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Metric Type</Label>
            <Select value={dataType} onValueChange={(value: any) => setDataType(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {biomarkerTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="w-4 h-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dataType === 'bloodPressure' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="systolic">Systolic</Label>
                <Input
                  id="systolic"
                  type="number"
                  placeholder="120"
                  min={40}
                  max={300}
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">mmHg (40-300)</p>
              </div>
              <div>
                <Label htmlFor="diastolic">Diastolic</Label>
                <Input
                  id="diastolic"
                  type="number"
                  placeholder="80"
                  min={20}
                  max={200}
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">mmHg (20-200)</p>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                type="number"
                step={dataType === 'sleep' ? '0.1' : '1'}
                min={currentType?.min}
                max={currentType?.max}
                placeholder={currentType?.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{currentType?.unit} ({currentType?.min}-{currentType?.max})</p>
            </div>
          )}

          <div>
            <Label htmlFor="timestamp">Date & Time</Label>
            <Input
              id="timestamp"
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              type="text"
              placeholder="Add any notes about this reading..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{notes.length}/500 characters</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" onClick={handleSubmit} className="flex-1">
              Log Data
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-xs text-blue-900 dark:text-blue-100 mb-1">Tips for accurate logging:</p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Take readings at the same time each day</li>
            <li>• Ensure devices are properly calibrated</li>
            <li>• Add notes for context (e.g., before/after exercise)</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
