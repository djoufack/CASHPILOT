import {} from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, AlertTriangle, Info, AlertCircle, X, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCfoAlerts } from '@/hooks/useCfoAlerts';

const severityConfig = {
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-300',
  },
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300',
  },
};

const AlertItem = ({ alert, onMarkRead, onDismiss, t }) => {
  const config = severityConfig[alert.severity] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} border ${config.border} rounded-lg p-3 ${
        !alert.is_read ? 'ring-1 ring-white/10' : 'opacity-75'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 ${config.text} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">{alert.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${config.badge}`}>{alert.severity}</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{alert.message}</p>
          <div className="text-xs text-gray-500 mt-1.5">
            {new Date(alert.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!alert.is_read && (
            <button
              onClick={() => onMarkRead(alert.id)}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-green-400 transition-colors"
              title={t('cfo.alerts.markRead', 'Marquer comme lu')}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDismiss(alert.id)}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
            title={t('cfo.alerts.dismiss', 'Supprimer')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CfoAlertsList = () => {
  const { t } = useTranslation();
  const { alerts, loading, unreadCount, generateAlerts, markAsRead, dismissAlert } = useCfoAlerts();

  return (
    <div className="bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">{t('cfo.alerts.title', 'Alertes CFO')}</h3>
          {unreadCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={generateAlerts}
          disabled={loading}
          className="text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Alert list */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {alerts.length === 0 && !loading && (
          <p className="text-sm text-gray-400 text-center py-4">
            {t('cfo.alerts.empty', 'Aucune alerte. Cliquez sur le bouton pour analyser.')}
          </p>
        )}

        {loading && alerts.length === 0 && (
          <div className="flex items-center justify-center py-4 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            {t('cfo.alerts.analyzing', 'Analyse en cours...')}
          </div>
        )}

        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} onMarkRead={markAsRead} onDismiss={dismissAlert} t={t} />
        ))}
      </div>
    </div>
  );
};

export default CfoAlertsList;
