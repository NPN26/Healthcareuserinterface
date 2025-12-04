import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Switch } from './ui/switch';
import { 
  Watch, 
  Activity, 
  Scale, 
  Thermometer,
  Battery,
  WifiOff,
  AlertCircle,
  Power,
  Settings
} from 'lucide-react';
import { Device } from '../utils/mockData';
import { toast } from 'sonner@2.0.3';

interface DeviceCardProps {
  device: Device;
  onUpdate: () => void;
}

export function DeviceCard({ device, onUpdate }: DeviceCardProps) {
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

  const toggleDeviceStatus = () => {
    const devices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) => 
      d.id === device.id 
        ? { ...d, status: d.status === 'active' ? 'inactive' : 'active' }
        : d
    );
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    onUpdate();
    toast.success(`${device.name} ${device.status === 'active' ? 'deactivated' : 'activated'}`);
  };

  const toggleAutoMode = () => {
    const devices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) => 
      d.id === device.id 
        ? { ...d, autoMode: !d.autoMode }
        : d
    );
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    onUpdate();
    toast.success(`Auto mode ${!device.autoMode ? 'enabled' : 'disabled'}`);
  };

  const syncDevice = () => {
    const devices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) => 
      d.id === device.id 
        ? { ...d, lastSync: new Date().toISOString() }
        : d
    );
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    onUpdate();
    toast.success('Device synced successfully');
  };

  const simulateFault = () => {
    const devices = JSON.parse(localStorage.getItem('healthApp_devices') || '[]');
    const updated = devices.map((d: Device) => 
      d.id === device.id 
        ? { ...d, status: 'faulty' }
        : d
    );
    localStorage.setItem('healthApp_devices', JSON.stringify(updated));
    onUpdate();
    toast.error('Device fault detected!');
  };

  const getBatteryColor = () => {
    if (device.batteryLevel > 60) return 'text-green-500';
    if (device.batteryLevel > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-400';
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">Device malfunction detected. Please check device.</p>
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

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Last synced</span>
        <span className="text-gray-900">{timeSinceSync()}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Auto mode</span>
        <Switch 
          checked={device.autoMode}
          onCheckedChange={toggleAutoMode}
          disabled={device.status !== 'active'}
        />
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
          disabled={device.status !== 'active'}
        >
          <WifiOff className="w-4 h-4 mr-2" />
          Sync
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
    </Card>
  );
}
