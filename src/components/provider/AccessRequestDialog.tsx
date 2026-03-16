import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { UserPlus, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createAccessRequest } from '../../utils/supabase';

interface AccessRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
}

export function AccessRequestDialog({ isOpen, onClose, providerId }: AccessRequestDialogProps) {
  const [patientEmail, setPatientEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!patientEmail.trim()) {
      toast.error('Please enter a patient email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patientEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createAccessRequest(providerId, patientEmail.trim());
      
      if (result.success) {
        toast.success(result.message);
        setPatientEmail('');
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to send access request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setPatientEmail('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600" />
            Request Patient Access
          </DialogTitle>
          <DialogDescription>
            Enter the patient's email address to request access to their health data.
            The patient will receive a notification and can approve or deny your request.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="patient-email" className="text-sm font-medium">
              Patient Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="patient-email"
                type="email"
                placeholder="patient@example.com"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                className="pl-10"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500">
              The patient must have an account with this email address.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
