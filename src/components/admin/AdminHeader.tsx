import { Button } from '../ui/button';
import { LogOut, Sun, MoonIcon } from 'lucide-react';

interface AdminHeaderProps {
  userName: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
}

export function AdminHeader({ userName, isDarkMode, onToggleDarkMode, onLogout }: AdminHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-gray-900">System Administration</h1>
        <p className="text-gray-600">Welcome, {userName}</p>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className="h-9 w-9"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
        </Button>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
