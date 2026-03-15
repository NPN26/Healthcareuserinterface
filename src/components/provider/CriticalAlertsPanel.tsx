import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Alert } from '../../utils/mockData';

interface CriticalAlertsPanelProps {
  patients: User[];
  getPatientAlerts: (patientId: string) => Alert[];
  onViewPatient: (patient: User) => void;
}

export function CriticalAlertsPanel({ patients, getPatientAlerts, onViewPatient }: CriticalAlertsPanelProps) {
  return (
    <Card className="p-6">
      <h3 className="text-foreground mb-4">Critical Patient Alerts</h3>
      <div className="space-y-4">
        {patients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No critical alerts</p>
          </div>
        ) : (
          patients.map((patient) => {
            const patientAlerts = getPatientAlerts(patient.id);
            return (
              <Card
                key={patient.id}
                className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-950"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{patient.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-gray-900">{patient.name}</p>
                      <p className="text-sm text-gray-600">{patient.age} years old</p>
                      <div className="mt-2 space-y-1">
                        {patientAlerts.slice(0, 3).map((alert) => (
                          <p key={alert.id} className="text-sm text-red-700 dark:text-white">
                            • {alert.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => onViewPatient(patient)}>
                    Review
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </Card>
  );
}
