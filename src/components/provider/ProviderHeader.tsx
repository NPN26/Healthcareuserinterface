import { Button } from '../ui/button';
import { LogOut, Sun, MoonIcon, UserPlus } from 'lucide-react';

interface ProviderHeaderProps {
  userName: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onRequestAccess: () => void;
}

export function ProviderHeader({ userName, isDarkMode, onToggleDarkMode, onLogout, onRequestAccess }: ProviderHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-gray-900 text-xl sm:text-2xl">Healthcare Provider Dashboard</h1>
        <p className="text-gray-600">Welcome, {userName}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <Button
          onClick={onRequestAccess}
          variant="outline"
          size="sm"
        >
          <UserPlus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Request Patient Access</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className="h-9 w-9"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </div>
  );
}
