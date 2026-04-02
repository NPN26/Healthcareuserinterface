import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Filter, Check, CheckCheck, Trash2, Search, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { HeartbeatLoader } from '../ui/HeartbeatLoader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';
import { format, formatDistanceToNow } from 'date-fns';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: 'ALERT' | 'ACHIEVEMENT' | 'GOAL' | 'REMINDER' | 'SYSTEM';
  content: string;
  timestamp: string;
  is_read: boolean;
  read_at: string | null;
}

interface NotificationsPageProps {
  userId: string;
  notifications: Notification[];
  onBack: () => void;
  onMarkAsRead: (notificationId: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDelete: (notificationId: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

const notificationTypeConfig = {
  ALERT: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: '🚨',
    label: 'Alerts',
  },
  ACHIEVEMENT: {
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: '🏆',
    label: 'Achievements',
  },
  GOAL: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: '🎯',
    label: 'Goals',
  },
  REMINDER: {
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    icon: '⏰',
    label: 'Reminders',
  },
  SYSTEM: {
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    icon: 'ℹ️',
    label: 'System',
  },
};

export function NotificationsPage({
  userId,
  notifications,
  onBack,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAll,
  onRefresh,
  isLoading = false,
}: NotificationsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter and sort notifications
  const filteredNotifications = notifications
    .filter((n) => {
      // Search filter
      if (searchQuery && !n.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Type filter
      if (filterType !== 'all' && n.type !== filterType) {
        return false;
      }
      // Status filter
      if (filterStatus === 'unread' && n.is_read) {
        return false;
      }
      if (filterStatus === 'read' && !n.is_read) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
    });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (notificationId: string) => {
    setLoadingId(notificationId);
    try {
      await onMarkAsRead(notificationId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (notificationId: string) => {
    setLoadingId(notificationId);
    try {
      await onDelete(notificationId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setLoadingId('all');
    try {
      await onMarkAllAsRead();
    } finally {
      setLoadingId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const notificationsByType = {
    all: filteredNotifications.length,
    ALERT: notifications.filter((n) => n.type === 'ALERT').length,
    ACHIEVEMENT: notifications.filter((n) => n.type === 'ACHIEVEMENT').length,
    GOAL: notifications.filter((n) => n.type === 'GOAL').length,
    REMINDER: notifications.filter((n) => n.type === 'REMINDER').length,
    SYSTEM: notifications.filter((n) => n.type === 'SYSTEM').length,
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card">
        <div className="flex items-center gap-3 sm:gap-4 p-4 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9"
          >
            <RefreshCw className={cn("w-4 h-4 sm:mr-2", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={loadingId === 'all'}
              className="h-9"
            >
              <CheckCheck className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="px-4 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[130px] sm:w-[140px] h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="ALERT">🚨 Alerts</SelectItem>
                <SelectItem value="ACHIEVEMENT">🏆 Achievements</SelectItem>
                <SelectItem value="GOAL">🎯 Goals</SelectItem>
                <SelectItem value="REMINDER">⏰ Reminders</SelectItem>
                <SelectItem value="SYSTEM">ℹ️ System</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterStatus}
              onValueChange={(v: 'all' | 'unread' | 'read') => setFilterStatus(v)}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v: 'newest' | 'oldest') => setSortBy(v)}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">
              {filteredNotifications.length} of {notifications.length} notifications
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="h-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <HeartbeatLoader label="Loading notifications…" size="md" />
              </div>
            ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Bell className="w-16 h-16 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {notifications.length === 0 ? 'No notifications yet' : 'No notifications match your filters'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {notifications.length === 0
                ? "We'll notify you when something important happens"
                : 'Try adjusting your filters or search query'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredNotifications.map((notification) => {
              const config = notificationTypeConfig[notification.type];
              const isLoading = loadingId === notification.notification_id;

              return (
                <Card
                  key={notification.notification_id}
                  className={cn(
                    'transition-all hover:shadow-md',
                    !notification.is_read && 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0 mt-1">
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant="secondary"
                            className={cn('text-xs font-medium', config.color)}
                          >
                            {config.label}
                          </Badge>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground/70">
                              {format(new Date(notification.timestamp), 'MMM d, yyyy • h:mm a')}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {notification.content}
                        </p>
                        {notification.is_read && notification.read_at && (
                          <p className="text-xs text-muted-foreground">
                            Read {formatDistanceToNow(new Date(notification.read_at), { addSuffix: true })}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          {!notification.is_read && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleMarkAsRead(notification.notification_id)}
                              disabled={isLoading}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Mark as read
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDelete(notification.notification_id)}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
