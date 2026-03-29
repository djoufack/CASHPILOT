import { useState } from 'react';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { enGB, fr, nl } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const NotificationCenter = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const panelId = 'notification-center-panel';

  const localeByLanguage = {
    fr,
    en: enGB,
    nl,
  };
  const languageCode = String(i18n.resolvedLanguage || i18n.language || 'fr')
    .toLowerCase()
    .split('-')[0];
  const dateLocale = localeByLanguage[languageCode] || fr;

  const getIcon = (type) => {
    switch (type) {
      case 'payment': return '\u{1F4B0}';
      case 'invoice': return '\u{1F4C4}';
      case 'reminder': return '\u23F0';
      case 'obligation_receivables': return '\u{1F4C4}';
      case 'obligation_payables': return '\u{1F9FE}';
      case 'obligation_quotes': return '\u{1F4DD}';
      case 'alert': return '\u26A0\uFE0F';
      default: return '\u{1F514}';
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        aria-label={t('notifications.toggle', 'Open notifications')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
            aria-label={t('notifications.unreadCount', '{{count}} unread notifications', { count: unreadCount })}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-label={t('notifications.title', 'Notifications')}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">{t('notifications.title', 'Notifications')}</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs text-orange-400 hover:text-orange-300"
                    aria-label={t('notifications.markAllRead', 'Mark all as read')}
                  >
                    {t('notifications.markAllRead', 'Mark all as read')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-white"
                  aria-label={t('common.close', 'Close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {(!notifications || notifications.length === 0) ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {t('notifications.empty', 'No notifications')}
                </div>
              ) : (
                notifications.slice(0, 20).map((notif, i) => (
                  <div
                    key={notif.id || i}
                    className={`px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                      !notif.is_read ? 'bg-gray-800/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getIcon(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
                          {notif.title || notif.message}
                        </p>
                        {notif.message && notif.title && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.message}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: dateLocale }) : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!notif.is_read && markAsRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notif.id)}
                            className="text-gray-600 hover:text-green-400"
                            aria-label={t('notifications.markRead', 'Mark as read')}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        {deleteNotification && (
                          <button
                            type="button"
                            onClick={() => deleteNotification(notif.id)}
                            className="text-gray-600 hover:text-red-400"
                            aria-label={t('notifications.delete', 'Delete notification')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
