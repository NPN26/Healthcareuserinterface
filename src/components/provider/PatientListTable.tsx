import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Search, Download } from 'lucide-react';
import { User, Biomarker, Alert } from '../../utils/mockData';

interface PatientListTableProps {
  patients: User[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  getPatientAlerts: (patientId: string) => Alert[];
  getLatestReading: (patientId: string, type: Biomarker['type']) => Biomarker | undefined;
  onViewPatient: (patient: User) => void;
}

export function PatientListTable({
  patients,
  searchTerm,
  onSearchChange,
  getPatientAlerts,
  getLatestReading,
  onViewPatient,
}: PatientListTableProps) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search patients by name or email..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Latest Heart Rate</TableHead>
              <TableHead>Latest Glucose</TableHead>
              <TableHead>Alerts</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient) => {
              const patientAlerts = getPatientAlerts(patient.id);
              const heartRate = getLatestReading(patient.id, 'heartRate');
              const glucose = getLatestReading(patient.id, 'glucose');
              const hasCritical = patientAlerts.some(
                (a) => a.type === 'critical' || a.type === 'fault'
              );

              return (
                <TableRow
                  key={patient.id}
                  className={hasCritical ? 'bg-red-50 dark:bg-red-950' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{patient.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-gray-900">{patient.name}</p>
                        <p className="text-sm text-gray-600">{patient.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{patient.age}</TableCell>
                  <TableCell>
                    {heartRate ? (
                      <span
                        className={
                          heartRate.value >= 60 && heartRate.value <= 100
                            ? 'text-green-600 dark:text-green-700'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {heartRate.value} bpm
                      </span>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {glucose ? (
                      <span
                        className={
                          glucose.value >= 70 && glucose.value <= 130
                            ? 'text-green-600 dark:text-green-700'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {glucose.value} mg/dL
                      </span>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {patientAlerts.length > 0 ? (
                      <Badge variant={hasCritical ? 'destructive' : 'secondary'}>
                        {patientAlerts.length} alert{patientAlerts.length !== 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline">None</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => onViewPatient(patient)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
