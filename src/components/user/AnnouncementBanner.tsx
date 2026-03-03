import { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, CheckCircle, Megaphone } from 'lucide-react';
import { fetchActiveAnnouncements, Announcement } from '../../utils/supabase';

const typeConfig: Record<
  Announcement['type'],
  { bg: string; border: string; icon: React.ElementType; text: string; iconColor: string }
> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Info,
    text: 'text-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    text: 'text-amber-800 dark:text-amber-200',
    iconColor: 'text-amber-500',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-800',
    icon: CheckCircle,
    text: 'text-green-800 dark:text-green-200',
    iconColor: 'text-green-500',
  },
  urgent: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-300 dark:border-red-800',
    icon: Megaphone,
    text: 'text-red-800 dark:text-red-200',
    iconColor: 'text-red-500',
  },
};

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load previously dismissed ids from session storage so they don't reappear during the session
    const stored = sessionStorage.getItem('healthApp_dismissedAnnouncements');
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)));
      } catch { /* ignore */ }
    }

    fetchActiveAnnouncements().then(setAnnouncements);
  }, []);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      sessionStorage.setItem('healthApp_dismissedAnnouncements', JSON.stringify([...next]));
      return next;
    });
  };

  const visible = announcements.filter((a) => !dismissed.has(a.announcement_id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a) => {
        const cfg = typeConfig[a.type] || typeConfig.info;
        const Icon = cfg.icon;

        return (
          <div
            key={a.announcement_id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cfg.bg} ${cfg.border} animate-in fade-in slide-in-from-top-2 duration-300`}
          >
            <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${cfg.text}`}>{a.title}</p>
              <p className={`text-sm mt-0.5 ${cfg.text} opacity-80`}>{a.message}</p>
            </div>
            <button
              onClick={() => handleDismiss(a.announcement_id)}
              className={`shrink-0 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${cfg.text}`}
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
