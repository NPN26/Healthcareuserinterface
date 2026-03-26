import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FileDown, Search, User } from 'lucide-react';
import { User as UserType } from '../../utils/mockData';
import { ScrollArea } from '../ui/scroll-area';

interface PatientSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patients: UserType[];
  onSelectPatient: (patient: UserType) => void;
}

export function PatientSelectDialog({ isOpen, onClose, patients, onSelectPatient }: PatientSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPatient = (patient: UserType) => {
    onSelectPatient(patient);
    setSearchTerm('');
    onClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-blue-600" />
            Select Patient for Report
          </DialogTitle>
          <DialogDescription>
            Choose a patient to generate and download their health report PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="patient-search" className="text-sm font-medium">
              Search Patients
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="patient-search"
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          {/* Patient List */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Patients ({filteredPatients.length})
            </Label>
            <ScrollArea className="h-64 border rounded-md">
              {filteredPatients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <User className="w-12 h-12 mb-2 text-gray-300" />
                  <p className="text-sm">
                    {patients.length === 0
                      ? 'No patients available'
                      : 'No patients found'}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full text-left p-3 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {patient.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {patient.email}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
