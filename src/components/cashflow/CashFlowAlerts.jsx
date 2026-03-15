import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/calculations';
import { AlertTriangle, TrendingUp, Calendar, ShieldAlert, Loader2 } from 'lucide-react';

const ALERT_CONFIG = {
  overdraft_risk: {
    icon: ShieldAlert,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    severity: 'critical',
  },
  low_balance: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    severity: 'warning',
  },
  growth_opportunity: {
    icon: TrendingUp,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    severity: 'info',
  },
};

/**
 * Cash Flow Alerts cards.
 * Shows alerts for overdraft risk, low balance, and growth opportunities.
 *
 * @param {{ alerts: Array, loading: boolean }} props
 */
const CashFlowAlerts = ({ alerts = [], loading = false }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white">{t('cashflow.alerts.title', 'Alertes de Tresorerie')}</h3>
        </div>
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-emerald-400 font-medium text-sm">
            {t('cashflow.alerts.noAlerts', 'Aucune alerte - Tresorerie saine')}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {t('cashflow.alerts.noAlertsDesc', 'Aucun risque detecte sur la periode')}
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const sortedAlerts = [...alerts].sort((a, b) => {
    const aConfig = ALERT_CONFIG[a.type] || ALERT_CONFIG.low_balance;
    const bConfig = ALERT_CONFIG[b.type] || ALERT_CONFIG.low_balance;
    return (severityOrder[aConfig.severity] ?? 3) - (severityOrder[bConfig.severity] ?? 3);
  });

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{t('cashflow.alerts.title', 'Alertes de Tresorerie')}</h3>
          <p className="text-xs text-gray-500">
            {t('cashflow.alerts.count', '{{count}} alerte(s) detectee(s)', { count: alerts.length })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sortedAlerts.map((alert, index) => {
          const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.low_balance;
          const Icon = config.icon;
          const severityLabel =
            config.severity === 'critical'
              ? t('cashflow.alerts.critical', 'Critique')
              : config.severity === 'warning'
                ? t('cashflow.alerts.warning', 'Attention')
                : t('cashflow.alerts.info', 'Info');

          return (
            <div
              key={`${alert.type}-${index}`}
              className={`${config.bgColor} border ${config.borderColor} rounded-xl p-4 transition-all hover:shadow-lg`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badgeBg} ${config.badgeText}`}
                    >
                      {severityLabel}
                    </span>
                    {alert.days_until != null && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {t('cashflow.alerts.inDays', 'dans {{days}}j', { days: alert.days_until })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">{alert.message}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {alert.date && <span className="text-xs text-gray-500">{formatDate(alert.date)}</span>}
                    {alert.projected_balance != null && (
                      <span
                        className={`text-xs font-medium ${alert.projected_balance < 0 ? 'text-red-400' : 'text-gray-400'}`}
                      >
                        {t('cashflow.alerts.projectedBalance', 'Solde projete')}:{' '}
                        {formatCurrency(alert.projected_balance)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CashFlowAlerts;
