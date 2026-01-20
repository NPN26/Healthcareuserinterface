import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';
import { formatDistanceToNow } from 'date-fns';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: 'ALERT' | 'ACHIEVEMENT' | 'GOAL' | 'REMINDER' | 'SYSTEM';
  content: string;
  timestamp: string;
  is_read: boolean;
  read_at: string | null;
}

interface NotificationsPopoverProps {
  userId: string;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (notificationId: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDelete: (notificationId: string) => Promise<void>;
  onViewAll: () => void;
}

const notificationTypeConfig = {
  ALERT: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: '🚨',
  },
  ACHIEVEMENT: {
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: '🏆',
  },
  GOAL: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: '🎯',
  },
  REMINDER: {
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    icon: '⏰',
  },
  SYSTEM: {
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    icon: 'ℹ️',
  },
};

export function NotificationsPopover({
  userId,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onViewAll,
}: NotificationsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Show only recent 5 notifications in popover
  const recentNotifications = notifications.slice(0, 5);

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingId(notificationId);
    try {
      await onMarkAsRead(notificationId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
        >
          {unreadCount === 0 && <Bell className="w-4 h-4" />}
          {unreadCount > 0 && (
            <>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
              {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllAsRead}
                disabled={loadingId === 'all'}
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                We'll notify you when something important happens
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => {
                const config = notificationTypeConfig[notification.type];
                const isLoading = loadingId === notification.notification_id;
                
                return (
                  <div
                    key={notification.notification_id}
                    className={cn(
                      'p-4 hover:bg-muted/50 transition-colors relative group',
                      !notification.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0 mt-0.5">
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant="secondary"
                            className={cn('text-xs font-medium', config.color)}
                          >
                            {notification.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {notification.content}
                        </p>
                        {!notification.is_read && (
                          <div className="absolute top-4 left-2 w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons - shown on hover */}
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => handleMarkAsRead(notification.notification_id, e)}
                          disabled={isLoading}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Mark read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(notification.notification_id, e)}
                        disabled={isLoading}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setIsOpen(false);
                  onViewAll();
                }}
              >
                {notifications.length > 5 
                  ? `View all notifications (${notifications.length})` 
                  : 'View all notifications'
                }
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
