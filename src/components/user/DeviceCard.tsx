import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Switch } from '../ui/switch';
import { 
  Watch, 
  Activity, 
  Scale, 
  Thermometer,
  Battery,
  WifiOff,
  AlertCircle,
  Power,
  Settings,
  Trash2,
  Loader2,
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Device } from '../../utils/mockData';
import { secureGetItem, secureSetItem } from '../../utils/secureStorage';
import { toast } from 'sonner';

interface DeviceCardProps {
  device: Device;
  onUpdate: () => void;
}

export function DeviceCard({ device, onUpdate }: DeviceCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const getDeviceIcon = () => {
    switch (device.type) {
      case 'smartwatch': return Watch;
      case 'glucometer': return Activity;
      case 'bloodPressureMonitor': return Activity;
      case 'scale': return Scale;
      case 'thermometer': return Thermometer;
      default: return Watch;
    }
  };

  const Icon = getDeviceIcon();

  const toggleDeviceStatus = async () => {
    const newStatus = device.status === 'active' ? 'inactive' : 'active';

    // Update database with ownership verification
    try {
      const { supabase } = await import('../../utils/supabase');

      // Get current metadata (with ownership check)
      const { data: currentData } = await supabase
        .from('data_sources')
        .select('metadata')
        .eq('source_id', device.id)
        .eq('user_id', device.userId) // Ownership check
        .single();

      const currentMetadata = currentData?.metadata || {};

      const { error } = await supabase
        .from('data_sources')
        .update({
          status: newStatus === 'active' ? 'CONNECTED' : 'DISCONNECTED',
          metadata: {
            ...currentMetadata,
            status: newStatus
          }
        })
        .eq('source_id', device.id)
        .eq('user_id', device.userId); // Ownership check: only update if user owns this device

      if (error) {
      }
    } catch (error) {
    }

    const devices = JSON.parse(await secureGetItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) =>
      d.id === device.id
        ? { ...d, status: newStatus }
        : d
    );
    await secureSetItem('healthApp_devices', JSON.stringify(updated));
    onUpdate();
    toast.success(`${device.name} ${device.status === 'active' ? 'deactivated' : 'activated'}`);
  };

  const toggleAutoMode = async () => {
    const newAutoMode = !device.autoMode;

    // Update database metadata with ownership verification
    try {
      const { supabase } = await import('../../utils/supabase');

      // Get current metadata (with ownership check)
      const { data: currentData } = await supabase
        .from('data_sources')
        .select('metadata')
        .eq('source_id', device.id)
        .eq('user_id', device.userId) // Ownership check
        .single();

      const currentMetadata = currentData?.metadata || {};

      const { error } = await supabase
        .from('data_sources')
        .update({
          metadata: {
            ...currentMetadata,
            auto_mode: newAutoMode
          }
        })
        .eq('source_id', device.id)
        .eq('user_id', device.userId); // Ownership check: only update if user owns this device

      if (error) {
      }
    } catch (error) {
    }

    const devices = JSON.parse(await secureGetItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) =>
      d.id === device.id
        ? { ...d, autoMode: newAutoMode }
        : d
    );
    await secureSetItem('healthApp_devices', JSON.stringify(updated));
    onUpdate();
    toast.success(`Auto mode ${newAutoMode ? 'enabled' : 'disabled'}`);
  };

  const syncDevice = async () => {
    setIsSyncing(true);
    const syncTime = new Date().toISOString();
    
    // Generate new biomarker readings based on device's supported biomarkers
    if (device.supportedBiomarkers && device.supportedBiomarkers.length > 0) {
      try {
        const { generateBiomarkerData } = await import('../../utils/mockData');
        const { supabase } = await import('../../utils/supabase');
        
        // Get current user
        const storedUsers = JSON.parse(await secureGetItem('healthApp_users') || '[]');
        const currentUser = storedUsers.find((u: any) => u.id === device.userId);
        
        if (currentUser) {
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

          // Generate readings for each supported biomarker
          for (const biomarkerType of device.supportedBiomarkers) {
            const newReading = generateBiomarkerData(currentUser.id, device.id, biomarkerType, new Date());
            
            // First, create data_point
            const { data: dataPoint, error: dataPointError } = await supabase
              .from('data_points')
              .insert({
                user_id: currentUser.user_id || currentUser.id,
                source_id: device.id,
                timestamp: newReading.timestamp,
                data_type: 'BIOMARKER'
              })
              .select()
              .single();

            if (dataPointError) {
              continue;
            }

            if (dataPoint) {
              // Then, create biomarker_data
              const { error: biomarkerError } = await supabase
                .from('biomarker_data')
                .insert({
                  data_point_id: dataPoint.data_point_id,
                  type: typeMapping[biomarkerType] || 'HEART_RATE',
                  value: newReading.value,
                  secondary_value: newReading.diastolic,
                  unit: newReading.type === 'bloodPressure' ? 'mmHg' : 
                        newReading.type === 'heartRate' ? 'bpm' :
                        newReading.type === 'oxygen' ? '%' :
                        newReading.type === 'glucose' ? 'mg/dL' :
                        newReading.type === 'steps' ? 'steps' :
                        newReading.type === 'sleep' ? 'hours' :
                        newReading.type === 'temperature' ? '°F' :
                        newReading.type === 'weight' ? 'lbs' : 'unit'
                });

              if (biomarkerError) {
              }
            }
            
            const allBiomarkers = JSON.parse(await secureGetItem('healthApp_biomarkers') || '[]');
            allBiomarkers.push(newReading);
            await secureSetItem('healthApp_biomarkers', JSON.stringify(allBiomarkers));
          }
          
          toast.success(`Synced ${device.supportedBiomarkers.length} biomarker reading(s)`);
        }
      } catch (error) {
        toast.error('Failed to sync device data');
        setIsSyncing(false);
      }
    }
    
    // Update device sync time in database with ownership verification
    try {
      const { supabase } = await import('../../utils/supabase');

      const { error } = await supabase
        .from('data_sources')
        .update({
          last_sync: syncTime
        })
        .eq('source_id', device.id)
        .eq('user_id', device.userId); // Ownership check: only update if user owns this device

      if (error) {
      }
    } catch (error) {
    }

    const devices = JSON.parse(await secureGetItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) =>
      d.id === device.id
        ? { ...d, lastSync: syncTime }
        : d
    );
    await secureSetItem('healthApp_devices', JSON.stringify(updated));
    setIsSyncing(false);
    onUpdate();
  };

  const simulateFault = async () => {
    // Update database with ownership verification
    try {
      const { supabase } = await import('../../utils/supabase');

      // Get current metadata (with ownership check)
      const { data: currentData } = await supabase
        .from('data_sources')
        .select('metadata')
        .eq('source_id', device.id)
        .eq('user_id', device.userId) // Ownership check
        .single();

      const currentMetadata = currentData?.metadata || {};

      const { error } = await supabase
        .from('data_sources')
        .update({
          status: 'ERROR',
          metadata: {
            ...currentMetadata,
            status: 'faulty'
          }
        })
        .eq('source_id', device.id)
        .eq('user_id', device.userId); // Ownership check: only update if user owns this device

      if (error) {
      }
    } catch (error) {
    }

    const devices = JSON.parse(await secureGetItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) =>
      d.id === device.id
        ? { ...d, status: 'faulty' }
        : d
    );
    await secureSetItem('healthApp_devices', JSON.stringify(updated));
    onUpdate();
    toast.error('Device fault detected!');
  };

  const deleteDevice = async () => {
    // Delete device from database with ownership verification (biomarker data will be preserved)
    try {
      const { supabase } = await import('../../utils/supabase');

      // Simply delete the device - the database foreign key constraint
      // will automatically set source_id to NULL for all related data_points
      // This preserves the historical biomarker data
      const { error } = await supabase
        .from('data_sources')
        .delete()
        .eq('source_id', device.id)
        .eq('user_id', device.userId); // Ownership check: only delete if user owns this device

      if (error) {
        toast.error('Failed to delete device from database');
        return;
      }
    } catch (error) {
      toast.error('Database error while deleting device');
      return;
    }

    // Delete from localStorage
    const devices = JSON.parse(await secureGetItem('healthApp_devices') || '[]');
    const updated = devices.filter((d: Device) => d.id !== device.id);
    await secureSetItem('healthApp_devices', JSON.stringify(updated));
    
    setShowDeleteDialog(false);
    onUpdate();
    toast.success(`${device.name} removed. Historical data preserved.`);
  };

  const getBatteryColor = () => {
    if (device.batteryLevel > 60) return 'text-green-500';
    if (device.batteryLevel > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-400 dark:bg-gray-600';
      case 'faulty': return 'bg-red-500';
    }
  };

  const timeSinceSync = () => {
    const minutes = Math.floor((Date.now() - new Date(device.lastSync).getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple text-white">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-gray-900">{device.name}</h3>
            <p className="text-sm text-gray-600 capitalize">{device.type.replace(/([A-Z])/g, ' $1').trim()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <Badge variant={device.status === 'faulty' ? 'destructive' : 'secondary'}>
            {device.status}
          </Badge>
        </div>
      </div>

      {device.status === 'faulty' && (
        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">Device malfunction detected. Please check device.</p>
        </div>
      )}

      {device.supportedBiomarkers && device.supportedBiomarkers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Supported Biomarkers</p>
          <div className="flex flex-wrap gap-2">
            {device.supportedBiomarkers.map((biomarker) => (
              <Badge key={biomarker} variant="outline" className="text-xs">
                {biomarker === 'heartRate' && '❤️ Heart Rate'}
                {biomarker === 'bloodPressure' && '🩺 Blood Pressure'}
                {biomarker === 'glucose' && '🩸 Glucose'}
                {biomarker === 'oxygen' && '💨 Oxygen'}
                {biomarker === 'steps' && '👣 Steps'}
                {biomarker === 'sleep' && '😴 Sleep'}
                {biomarker === 'temperature' && '🌡️ Temperature'}
                {biomarker === 'weight' && '⚖️ Weight'}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Battery className={`w-4 h-4 ${getBatteryColor()}`} />
            <span>Battery</span>
          </div>
          <span className="text-sm text-gray-900">{device.batteryLevel}%</span>
        </div>
        <Progress value={device.batteryLevel} className="h-2" />
      </div>

      {isSyncing && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="text-sm text-blue-700 dark:text-blue-300">Syncing device data...</span>
          <Progress value={66} className="h-1.5 flex-1" />
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Last synced</span>
        <span className="text-gray-900">{isSyncing ? 'Syncing...' : timeSinceSync()}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Auto mode</span>
        <Switch 
          checked={device.autoMode}
          onCheckedChange={toggleAutoMode}
          disabled={device.status !== 'active'}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Data Priority</span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={async () => {
              const newPriority = Math.max(0, (device.priority ?? 0) - 1);
              try {
                const { supabase } = await import('../../utils/supabase');
                await supabase
                  .from('data_sources')
                  .update({ priority: newPriority })
                  .eq('source_id', device.id)
                  .eq('user_id', device.userId); // Ownership check
              } catch (error) {
              }
              const devices = JSON.parse(await secureGetItem('healthApp_devices') || '[]');
              const updated = devices.map((d: Device) =>
                d.id === device.id ? { ...d, priority: newPriority } : d
              );
              await secureSetItem('healthApp_devices', JSON.stringify(updated));
              onUpdate();
            }}
          >
            <ArrowDown className="w-3 h-3" />
          </Button>
          <Badge variant="outline" className="min-w-[2rem] justify-center">
            {device.priority ?? 0}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={async () => {
              const newPriority = (device.priority ?? 0) + 1;
              try {
                const { supabase } = await import('../../utils/supabase');
                await supabase
                  .from('data_sources')
                  .update({ priority: newPriority })
                  .eq('source_id', device.id)
                  .eq('user_id', device.userId); // Ownership check
              } catch (error) {
              }
              const devices = JSON.parse(await secureGetItem('healthApp_devices') || '[]');
              const updated = devices.map((d: Device) =>
                d.id === device.id ? { ...d, priority: newPriority } : d
              );
              await secureSetItem('healthApp_devices', JSON.stringify(updated));
              onUpdate();
            }}
          >
            <ArrowUp className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="pt-2 border-t flex gap-2">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          onClick={toggleDeviceStatus}
        >
          <Power className="w-4 h-4 mr-2" />
          {device.status === 'active' ? 'Turn Off' : 'Turn On'}
        </Button>
        <Button 
          size="sm" 
          className="flex-1"
          onClick={syncDevice}
          disabled={device.status !== 'active' || isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {isSyncing ? 'Syncing...' : 'Sync'}
        </Button>
      </div>

      {device.status === 'active' && (
        <Button 
          size="sm" 
          variant="destructive" 
          className="w-full"
          onClick={simulateFault}
        >
          Simulate Fault
        </Button>
      )}

      <Button 
        size="sm" 
        variant="outline" 
        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        onClick={() => setShowDeleteDialog(true)}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete Device
      </Button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {device.name}? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDevice} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
