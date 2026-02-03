import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Shield, Lock, Eye, AlertTriangle, CheckCircle, Key } from 'lucide-react';
import { User, Alert } from '../../utils/mockData';

interface SecurityMonitorProps {
  users: User[];
  alerts: Alert[];
}

export function SecurityMonitor({ users, alerts }: SecurityMonitorProps) {
  // Simulated security events
  const securityEvents = [
    {
      id: '1',
      type: 'login',
      user: users[0]?.name || 'User',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      status: 'success',
      ip: '192.168.1.100',
      location: 'New York, US',
    },
    {
      id: '2',
      type: 'data_access',
      user: users[2]?.name || 'Provider',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      status: 'success',
      ip: '192.168.1.105',
      location: 'Boston, US',
    },
    {
      id: '3',
      type: 'failed_login',
      user: 'Unknown',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      status: 'blocked',
      ip: '45.123.45.67',
      location: 'Unknown',
    },
    {
      id: '4',
      type: 'password_change',
      user: users[0]?.name || 'User',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      status: 'success',
      ip: '192.168.1.100',
      location: 'New York, US',
    },
    {
      id: '5',
      type: 'data_export',
      user: users[2]?.name || 'Provider',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      status: 'success',
      ip: '192.168.1.105',
      location: 'Boston, US',
    },
  ];

  // Security metrics
  const totalLogins = securityEvents.filter(e => e.type === 'login' || e.type === 'failed_login').length;
  const failedLogins = securityEvents.filter(e => e.type === 'failed_login').length;
  const dataAccess = securityEvents.filter(e => e.type === 'data_access' || e.type === 'data_export').length;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login': return <Eye className="w-4 h-4 text-blue-600" />;
      case 'failed_login': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'data_access': return <Shield className="w-4 h-4 text-green-600" />;
      case 'data_export': return <Lock className="w-4 h-4 text-purple-600" />;
      case 'password_change': return <Key className="w-4 h-4 text-amber-600" />;
      default: return <CheckCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'login': return 'Login';
      case 'failed_login': return 'Failed Login';
      case 'data_access': return 'Data Access';
      case 'data_export': return 'Data Export';
      case 'password_change': return 'Password Change';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Security Status</p>
              <p className="text-gray-900">Secure</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Login Attempts</p>
              <p className="text-2xl text-gray-900">{totalLogins}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Failed Logins</p>
              <p className="text-2xl text-gray-900">{failedLogins}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900">
              <Lock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Data Access</p>
              <p className="text-2xl text-gray-900">{dataAccess}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Security Features */}
      <Card className="p-6">
        <h3 className="text-gray-900 mb-4">Active Security Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">End-to-End Encryption</p>
              <p className="text-xs text-gray-600">All data is encrypted in transit and at rest using AES-256</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">Role-Based Access Control</p>
              <p className="text-xs text-gray-600">Granular permissions for users, providers, and admins</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">Audit Logging</p>
              <p className="text-xs text-gray-600">Comprehensive logging of all system activities</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">HIPAA Compliance</p>
              <p className="text-xs text-gray-600">Full compliance with healthcare data protection standards</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">Two-Factor Authentication</p>
              <p className="text-xs text-gray-600">Optional 2FA for enhanced account security</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">Regular Security Audits</p>
              <p className="text-xs text-gray-600">Automated vulnerability scanning and penetration testing</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Security Events */}
      <Card>
        <div className="p-6 border-b">
          <h3 className="text-gray-900">Recent Security Events</h3>
          <p className="text-sm text-gray-600">Last 24 hours of security activity</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Type</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {securityEvents.map(event => (
              <TableRow key={event.id} className={event.status === 'blocked' ? 'bg-red-50 dark:bg-red-950' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getEventIcon(event.type)}
                    <span>{getEventLabel(event.type)}</span>
                  </div>
                </TableCell>
                <TableCell>{event.user}</TableCell>
                <TableCell>
                  {new Date(event.timestamp).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{event.ip}</code>
                </TableCell>
                <TableCell>{event.location}</TableCell>
                <TableCell>
                  <Badge variant={
                    event.status === 'success' ? 'default' : 
                    event.status === 'blocked' ? 'destructive' : 
                    'secondary'
                  }>
                    {event.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Data Protection */}
      <Card className="p-6">
        <h3 className="text-gray-900 mb-4">Data Protection & Privacy</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-900 mb-1">Patient Data Privacy</p>
              <p className="text-sm text-gray-600">
                All patient biomarker data is encrypted and accessible only to authorized healthcare providers. 
                Access is logged and monitored for compliance.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Shield className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-900 mb-1">Row-Level Security</p>
              <p className="text-sm text-gray-600">
                Database implements row-level security policies ensuring users can only access their own data, 
                providers can access assigned patients, and admins have system-wide visibility.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Key className="w-5 h-5 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-900 mb-1">Secure Key Management</p>
              <p className="text-sm text-gray-600">
                Encryption keys are managed using industry-standard key management services with automatic 
                key rotation and secure backup procedures.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
