import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { Alert as AlertType } from '../../utils/mockData';
import { toast } from 'sonner';

interface AlertsPanelProps {
  alerts: AlertType[];
  onUpdate: () => void;
}

export function AlertsPanel({ alerts, onUpdate }: AlertsPanelProps) {
  const markAsRead = (alertId: string) => {
    const allAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');
    const updated = allAlerts.map((a: AlertType) => 
      a.id === alertId ? { ...a, read: true } : a
    );
    localStorage.setItem('healthApp_alerts', JSON.stringify(updated));
    onUpdate();
    toast.success('Alert marked as read');
  };

  const clearAll = () => {
    const allAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');
    const updated = allAlerts.map((a: AlertType) => ({ ...a, read: true }));
    localStorage.setItem('healthApp_alerts', JSON.stringify(updated));
    onUpdate();
    toast.success('All alerts cleared');
  };

  const getAlertIcon = (type: AlertType['type']) => {
    switch (type) {
      case 'critical': return AlertCircle;
      case 'warning': return AlertCircle;
      case 'fault': return X;
      case 'info': return Info;
    }
  };

  const getAlertColor = (type: AlertType['type']) => {
    switch (type) {
      case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-950';
      case 'warning': return 'border-amber-500 bg-amber-50 dark:bg-amber-950';
      case 'fault': return 'border-purple-500 bg-purple-50 dark:bg-purple-950';
      case 'info': return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
    }
  };

  const getAlertTextColor = (type: AlertType['type']) => {
    switch (type) {
      case 'critical': return 'text-red-700';
      case 'warning': return 'text-amber-700';
      case 'fault': return 'text-purple-700';
      case 'info': return 'text-blue-700';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="text-foreground">All Clear!</h3>
            <p className="text-gray-600">You have no active alerts</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground">Active Alerts ({alerts.length})</h3>
        <Button variant="outline" size="sm" onClick={clearAll}>
          Clear All
        </Button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = getAlertIcon(alert.type);
          return (
            <Card 
              key={alert.id} 
              className={`p-4 border-l-4 ${getAlertColor(alert.type)}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 ${getAlertTextColor(alert.type)}`} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={alert.type === 'critical' || alert.type === 'fault' ? 'destructive' : 'secondary'}>
                          {alert.type}
                        </Badge>
                        {alert.biomarkerType && (
                          <Badge variant="outline">{alert.biomarkerType}</Badge>
                        )}
                      </div>
                      <p className={`text-sm ${getAlertTextColor(alert.type)}`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(alert.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
