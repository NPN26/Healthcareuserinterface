import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Search, Users, TrendingUp, AlertTriangle, FileText, Download, LogOut, Sun, MoonIcon } from 'lucide-react';
import { PatientDetail } from './PatientDetail';
import { PatternAnalysis } from './PatternAnalysis';
import { Biomarker, User, Alert } from '../utils/mockData';

interface ProviderDashboardProps {
  user: any;
  onLogout: () => void;
}

export function ProviderDashboard({ user, onLogout }: ProviderDashboardProps) {
  const [patients, setPatients] = useState<User[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allUsers = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    const patientUsers = allUsers.filter((u: User) => u.role === 'user');
    setPatients(patientUsers);

    const allBiomarkers = JSON.parse(localStorage.getItem('healthApp_biomarkers') || '[]');
    setBiomarkers(allBiomarkers);

    const allAlerts = JSON.parse(localStorage.getItem('healthApp_alerts') || '[]');
    setAlerts(allAlerts);
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('healthApp_darkMode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPatientAlerts = (patientId: string) => {
    return alerts.filter(a => a.userId === patientId && !a.read);
  };

  const getLatestReading = (patientId: string, type: Biomarker['type']) => {
    const patientBiomarkers = biomarkers
      .filter(b => b.userId === patientId && b.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return patientBiomarkers[0];
  };

  const criticalPatients = patients.filter(p => {
    const patientAlerts = getPatientAlerts(p.id);
    return patientAlerts.some(a => a.type === 'critical' || a.type === 'fault');
  });

  if (selectedPatient) {
    return (
      <PatientDetail 
        patient={selectedPatient}
        biomarkers={biomarkers.filter(b => b.userId === selectedPatient.id)}
        alerts={alerts.filter(a => a.userId === selectedPatient.id)}
        onBack={() => setSelectedPatient(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-900">Healthcare Provider Dashboard</h1>
            <p className="text-gray-600">Welcome, {user.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="h-9 w-9"
            >
              {isDarkMode ? (<Sun className="w-4 h-4" />) : (<MoonIcon className="w-4 h-4" />)}
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Patients</p>
                <p className="text-2xl text-gray-900">{patients.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Critical Alerts</p>
                <p className="text-2xl text-gray-900">
                  {criticalPatients.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Monitoring</p>
                <p className="text-2xl text-gray-900">{patients.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reports</p>
                <p className="text-2xl text-gray-900">{biomarkers.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="patients" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="patients">Patient List</TabsTrigger>
            <TabsTrigger value="alerts">Critical Alerts</TabsTrigger>
            <TabsTrigger value="patterns">Pattern Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="patients" className="space-y-4">
            <Card className="p-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search patients by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                  {filteredPatients.map((patient) => {
                    const patientAlerts = getPatientAlerts(patient.id);
                    const heartRate = getLatestReading(patient.id, "heartRate");
                    const glucose = getLatestReading(patient.id, "glucose");
                    const hasCritical = patientAlerts.some(
                      (a) => a.type === "critical" || a.type === "fault"
                    );

                    return (
                      <TableRow
                        key={patient.id}
                        className={
                          hasCritical ? "bg-red-50 dark:bg-red-950" : ""
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{patient.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-gray-900">{patient.name}</p>
                              <p className="text-sm text-gray-600">
                                {patient.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{patient.age}</TableCell>
                        <TableCell>
                          {heartRate ? (
                            <span
                              className={
                                heartRate.value >= 60 && heartRate.value <= 100
                                  ? "text-green-600 dark:text-green-700"
                                  : "text-red-600 dark:text-red-400"
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
                                  ? "text-green-600 dark:text-green-700"
                                  : "text-red-600 dark:text-red-400"
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
                            <Badge
                              variant={
                                hasCritical ? "destructive" : "secondary"
                              }
                            >
                              {patientAlerts.length} alert
                              {patientAlerts.length !== 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <Badge variant="outline">None</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => setSelectedPatient(patient)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card className="p-6">
              <h3 className="text-foreground mb-4">Critical Patient Alerts</h3>
              <div className="space-y-4">
                {criticalPatients.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No critical alerts</p>
                  </div>
                ) : (
                  criticalPatients.map((patient) => {
                    const patientAlerts = getPatientAlerts(patient.id);
                    return (
                      <Card
                        key={patient.id}
                        className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-950"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{patient.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-gray-900">{patient.name}</p>
                              <p className="text-sm text-gray-600">
                                {patient.age} years old
                              </p>
                              <div className="mt-2 space-y-1">
                                {patientAlerts.slice(0, 3).map((alert) => (
                                  <p
                                    key={alert.id}
                                    className="text-sm text-red-700 dark:text-white"
                                  >
                                    • {alert.message}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setSelectedPatient(patient)}
                          >
                            Review
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="patterns">
            <PatternAnalysis patients={patients} biomarkers={biomarkers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
