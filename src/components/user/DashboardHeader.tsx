import { Bell, User, LogOut, Search, Sun, MoonIcon, Settings, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SidebarTrigger } from '../ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { NotificationsPopover, type Notification } from './NotificationsPopover';
import { sanitizeText, containsDangerousPatterns } from '../../utils/inputValidation';

interface DashboardHeaderProps {
  user: any;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  alertCount: number;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onLogout: () => void;
  // Date navigation props
  selectedDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  // Notification props
  notifications: Notification[];
  unreadCount: number;
  onMarkNotificationAsRead: (notificationId: string) => Promise<void>;
  onMarkAllNotificationsAsRead: () => Promise<void>;
  onDeleteNotification: (notificationId: string) => Promise<void>;
  onViewAllNotifications: () => void;
}

export function DashboardHeader({
  user,
  searchQuery,
  onSearchChange,
  isDarkMode,
  onToggleDarkMode,
  alertCount,
  onProfileClick,
  onSettingsClick,
  onLogout,
  selectedDate,
  onPrevDay,
  onNextDay,
  onToday,
  notifications,
  unreadCount,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onDeleteNotification,
  onViewAllNotifications,
}: DashboardHeaderProps) {
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const handleSearchChange = (value: string) => {
    // Reject dangerous patterns early
    if (containsDangerousPatterns(value).dangerous) {
      return;
    }
    // Sanitize before passing up
    const sanitized = sanitizeText(value, { maxLength: 100, escapeHtml: false });
    onSearchChange(sanitized);
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 sm:h-16 shrink-0 items-center gap-1 sm:gap-4 border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl px-2 sm:px-4">
      <SidebarTrigger className="-ml-1 shrink-0" />

      {/* Date Navigation */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onPrevDay}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <button
          onClick={onToday}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            isToday
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 hidden sm:block" />
          {selectedDate.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: selectedDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
          })}
          {isToday && <span className="text-xs hidden sm:inline">(Today)</span>}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:h-8 sm:w-8"
          onClick={onNextDay}
          disabled={isToday}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex-1 min-w-0 max-w-md hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search health metrics, devices..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9"
            maxLength={100}
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-1 sm:gap-2 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className="h-9 w-9"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
        </Button>

        <NotificationsPopover
          userId={user.user_id}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={onMarkNotificationAsRead}
          onMarkAllAsRead={onMarkAllNotificationsAsRead}
          onDelete={onDeleteNotification}
          onViewAll={onViewAllNotifications}
        />

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple text-white text-xs">
                  {user.name[0]}
                </AvatarFallback>
              </Avatar>
              <span className="ml-2 hidden md:inline">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfileClick}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSettingsClick}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600 dark:text-red-400">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
