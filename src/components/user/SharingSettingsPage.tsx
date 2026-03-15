import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ArrowLeft, Shield, UserCheck, UserX, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AccessRequest,
  fetchPendingAccessRequests,
  fetchAllAccessConsents,
  approveAccessRequest,
  denyAccessRequest,
  revokeAccessConsent
} from '../../utils/supabase';
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

interface SharingSettingsPageProps {
  userId: string;
  onBack: () => void;
}

export function SharingSettingsPage({ userId, onBack }: SharingSettingsPageProps) {
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [activeConsents, setActiveConsents] = useState<AccessRequest[]>([]);
  const [historicalConsents, setHistoricalConsents] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; consentId: string | null }>({
    open: false,
    consentId: null
  });

  useEffect(() => {
    loadAccessData();
  }, [userId]);

  const loadAccessData = async () => {
    setIsLoading(true);
    try {
      const [pending, all] = await Promise.all([
        fetchPendingAccessRequests(userId),
        fetchAllAccessConsents(userId)
      ]);

      setPendingRequests(pending);
      
      const active = all.filter(c => c.status === 'ACTIVE');
      const historical = all.filter(c => ['DENIED', 'REVOKED'].includes(c.status));
      
      setActiveConsents(active);
      setHistoricalConsents(historical);
    } catch (error) {
      console.error('Error loading access data:', error);
      toast.error('Failed to load sharing settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (consentId: string, providerId: string) => {
    setActionInProgress(consentId);
    try {
      const result = await approveAccessRequest(consentId, providerId);
      if (result.success) {
        toast.success(result.message);
        await loadAccessData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve access request');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeny = async (consentId: string) => {
    setActionInProgress(consentId);
    try {
      const result = await denyAccessRequest(consentId);
      if (result.success) {
        toast.success(result.message);
        await loadAccessData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error denying request:', error);
      toast.error('Failed to deny access request');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeDialog.consentId) return;
    
    setActionInProgress(revokeDialog.consentId);
    try {
      const result = await revokeAccessConsent(revokeDialog.consentId);
      if (result.success) {
        toast.success(result.message);
        await loadAccessData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      toast.error('Failed to revoke access');
    } finally {
      setActionInProgress(null);
      setRevokeDialog({ open: false, consentId: null });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 dark:bg-green-900 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 dark:bg-amber-600 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'DENIED':
        return <Badge className="bg-red-100 dark:bg-red-900 text-red-800"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>;
      case 'REVOKED':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading sharing settings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              Data Sharing Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage who has access to your health data
            </p>
          </div>
        </div>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Pending Access Requests ({pendingRequests.length})
              </h2>
            </div>
            <Separator className="mb-4" />
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <Card key={request.consent_id} className="p-4 border-2 border-yellow-200 dark:border-yellow-900">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {request.provider_name || 'Healthcare Provider'}
                        </h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {request.provider_email}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requested: {formatDate(request.requested_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.consent_id, request.provider_id)}
                        disabled={actionInProgress === request.consent_id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeny(request.consent_id)}
                        disabled={actionInProgress === request.consent_id}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Deny
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      By approving, you grant this provider access to view your health data including biomarkers, readings, and alerts.
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Active Access Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Active Access ({activeConsents.length})
            </h2>
          </div>
          <Separator className="mb-4" />
          {activeConsents.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No active access grants. Providers who request access will appear here after approval.
            </p>
          ) : (
            <div className="space-y-4">
              {activeConsents.map((consent) => (
                <Card key={consent.consent_id} className="p-4 border-2 border-green-200 dark:border-green-900">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {consent.provider_name || 'Healthcare Provider'}
                        </h3>
                        {getStatusBadge(consent.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {consent.provider_email}
                      </p>
                      <p className="text-xs text-gray-500">
                        Access granted: {formatDate(consent.granted_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRevokeDialog({ open: true, consentId: consent.consent_id })}
                      disabled={actionInProgress === consent.consent_id}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Historical Access Section */}
        {historicalConsents.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Access History ({historicalConsents.length})
              </h2>
            </div>
            <Separator className="mb-4" />
            <div className="space-y-4">
              {historicalConsents.map((consent) => (
                <Card key={consent.consent_id} className="p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserX className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {consent.provider_name || 'Healthcare Provider'}
                        </h3>
                        {getStatusBadge(consent.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {consent.provider_email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {consent.status === 'DENIED' 
                          ? `Denied: ${formatDate(consent.revoked_at)}`
                          : `Revoked: ${formatDate(consent.revoked_at)}`
                        }
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Info Card */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                About Data Sharing
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• You have full control over who can access your health data</li>
                <li>• Healthcare providers must request access before viewing your information</li>
                <li>• You can revoke access at any time</li>
                <li>• All access activity is logged and can be reviewed here</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialog.open} onOpenChange={(open: boolean) => setRevokeDialog({ open, consentId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke the provider's access to your health data. 
              The provider will no longer be able to view your biomarkers, readings, or alerts.
              They can request access again in the future.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-red-600 hover:bg-red-700"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
