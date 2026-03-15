import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Shield, Lock, Eye, AlertTriangle, CheckCircle, Key, UserPlus, UserX, UserCog, FileText } from 'lucide-react';
import { Alert } from '../../utils/mockData';
import { AdminUser, fetchSecurityEvents, AuditLog } from '../../utils/supabase';

interface SecurityMonitorProps {
  users: AdminUser[];
  alerts: Alert[];
}

export function SecurityMonitor({ users, alerts }: SecurityMonitorProps) {
  const [securityEvents, setSecurityEvents] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSecurityEvents();
  }, []);

  const loadSecurityEvents = async () => {
    setIsLoading(true);
    try {
      const events = await fetchSecurityEvents(50);
      setSecurityEvents(events);
    } catch (error) {
      console.error('Error loading security events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Security metrics from real audit logs
  const loginEvents = securityEvents.filter(e => 
    e.action === 'LOGIN' || e.action === 'FAILED_LOGIN'
  );
  const failedLogins = securityEvents.filter(e => e.action === 'FAILED_LOGIN');
  const dataAccessEvents = securityEvents.filter(e => 
    e.action === 'DATA_ACCESS' || e.action === 'DATA_EXPORT'
  );

  const getEventIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <Eye className="w-4 h-4 text-blue-600" />;
      case 'FAILED_LOGIN': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'DATA_ACCESS': return <Shield className="w-4 h-4 text-green-600" />;
      case 'DATA_EXPORT': return <FileText className="w-4 h-4 text-purple-600" />;
      case 'PASSWORD_CHANGE': return <Key className="w-4 h-4 text-amber-600" />;
      case 'USER_CREATED': return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'USER_DELETED': return <UserX className="w-4 h-4 text-red-600" />;
      case 'ROLE_CHANGED': return <UserCog className="w-4 h-4 text-blue-600" />;
      default: return <CheckCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventLabel = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const getEventStatus = (action: string): 'success' | 'blocked' | 'warning' => {
    if (action === 'FAILED_LOGIN') return 'blocked';
    if (action === 'USER_DELETED') return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Security Status</p>
              <p className="text-gray-900">{failedLogins.length > 5 ? 'Warning' : 'Secure'}</p>
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
              <p className="text-2xl text-gray-900">{loginEvents.length}</p>
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
              <p className="text-2xl text-gray-900">{failedLogins.length}</p>
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
              <p className="text-2xl text-gray-900">{dataAccessEvents.length}</p>
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
          <p className="text-sm text-gray-600">
            {isLoading ? 'Loading security events...' : `Showing ${securityEvents.length} recent events`}
          </p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading audit logs...</p>
          </div>
        ) : securityEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No security events recorded yet</p>
            <p className="text-sm text-gray-500">Events will appear here as actions are performed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="hidden md:table-cell">IP Address</TableHead>
                <TableHead className="hidden lg:table-cell">Details</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {securityEvents.map(event => {
                const status = getEventStatus(event.action);
                return (
                  <TableRow key={event.log_id} className={status === 'blocked' ? 'bg-red-50 dark:bg-red-950' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.action)}
                        <span>{getEventLabel(event.action)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{event.admin_name || 'System'}</p>
                        {event.target_entity_type && (
                          <p className="text-xs text-gray-500">
                            {event.target_entity_type}: {event.target_entity_id?.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(event.timestamp).toLocaleString(undefined, { 
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {event.ip_address ? (
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {event.ip_address}
                        </code>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {event.details ? (
                        <span className="text-xs text-gray-600 truncate max-w-[200px] block">
                          {typeof event.details === 'string' ? event.details : JSON.stringify(event.details).slice(0, 50)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        status === 'success' ? 'default' : 
                        status === 'blocked' ? 'destructive' : 
                        'secondary'
                      }>
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
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
