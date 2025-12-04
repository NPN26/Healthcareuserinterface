import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Heart, Activity, Droplet, Wind, Footprints, Moon } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Biomarker } from '../utils/mockData';

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
  const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');

  const biomarkerTypes = [
    { value: 'heartRate', label: 'Heart Rate', icon: Heart, unit: 'bpm', placeholder: '75' },
    { value: 'bloodPressure', label: 'Blood Pressure', icon: Activity, unit: 'mmHg', placeholder: 'Systolic/Diastolic' },
    { value: 'glucose', label: 'Blood Glucose', icon: Droplet, unit: 'mg/dL', placeholder: '100' },
    { value: 'oxygen', label: 'Blood Oxygen', icon: Wind, unit: '%', placeholder: '98' },
    { value: 'steps', label: 'Steps', icon: Footprints, unit: 'steps', placeholder: '8000' },
    { value: 'sleep', label: 'Sleep', icon: Moon, unit: 'hours', placeholder: '7.5' },
  ];

  const handleSubmit = () => {
    if (dataType === 'bloodPressure') {
      if (!systolic || !diastolic) {
        toast.error('Please enter both systolic and diastolic values');
        return;
      }
    } else {
      if (!value) {
        toast.error('Please enter a value');
        return;
      }
    }

    const newReading: Biomarker = {
      id: `biomarker-${Date.now()}`,
      userId,
      deviceId,
      type: dataType,
      value: dataType === 'bloodPressure' ? 0 : parseFloat(value),
      systolic: dataType === 'bloodPressure' ? parseInt(systolic) : undefined,
      diastolic: dataType === 'bloodPressure' ? parseInt(diastolic) : undefined,
      timestamp: new Date(timestamp).toISOString(),
      isFaulty: false,
      notes: notes || undefined,
    };

    const allBiomarkers = JSON.parse(localStorage.getItem('healthApp_biomarkers') || '[]');
    const updatedBiomarkers = [...allBiomarkers, newReading];
    localStorage.setItem('healthApp_biomarkers', JSON.stringify(updatedBiomarkers));

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
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">mmHg</p>
              </div>
              <div>
                <Label htmlFor="diastolic">Diastolic</Label>
                <Input
                  id="diastolic"
                  type="number"
                  placeholder="80"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">mmHg</p>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                type="number"
                step={dataType === 'sleep' ? '0.1' : '1'}
                placeholder={currentType?.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{currentType?.unit}</p>
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
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSubmit} className="flex-1">
              Log Data
            </Button>
            <Button variant="outline" onClick={onClose}>
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
