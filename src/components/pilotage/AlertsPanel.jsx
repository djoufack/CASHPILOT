import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { AlertTriangle, AlertCircle, CheckCircle, XCircle, Bell, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocale } from '@/utils/dateLocale';
import PilotageAlertSubscriptionDialog from '@/components/pilotage/PilotageAlertSubscriptionDialog';
import {
  buildPilotageAlertCandidates,
  PILOTAGE_ALERT_RULES,
  usePilotageAlertSubscriptions,
} from '@/hooks/usePilotageAlertSubscriptions';

const SEVERITY_CONFIG = {
  critical: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    labelKey: 'pilotage.alerts.critical',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-300',
    labelKey: 'pilotage.alerts.warning',
  },
  info: {
    icon: AlertCircle,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    labelKey: 'pilotage.alerts.info',
  },
};

const DEFAULT_SEVERITY = SEVERITY_CONFIG.info;

const ALERT_ACTIONS_BY_TYPE = {
  negative_equity: {
    labelKey: 'pilotage.alerts.actions.openAccountingPilotage',
    labelDefault: 'Ouvrir le pilotage comptable',
    to: '/app/pilotage?tab=accounting',
  },
  low_interest_coverage: {
    labelKey: 'pilotage.alerts.actions.openFinancialPilotage',
    labelDefault: 'Ouvrir le pilotage financier',
    to: '/app/pilotage?tab=financial',
  },
  low_dscr: {
    labelKey: 'pilotage.alerts.actions.openFinancialPilotage',
    labelDefault: 'Ouvrir le pilotage financier',
    to: '/app/pilotage?tab=financial',
  },
  bfr_drift: {
    labelKey: 'pilotage.alerts.actions.openAccountingPilotage',
    labelDefault: 'Ouvrir le pilotage comptable',
    to: '/app/pilotage?tab=accounting',
  },
  negative_operating_cashflow: {
    labelKey: 'pilotage.alerts.actions.openCashFlow',
    labelDefault: 'Ouvrir la trésorerie',
    to: '/app/cash-flow',
  },
  high_gearing: {
    labelKey: 'pilotage.alerts.actions.openFinancialPilotage',
    labelDefault: 'Ouvrir le pilotage financier',
    to: '/app/pilotage?tab=financial',
  },
  negative_net_income: {
    labelKey: 'pilotage.alerts.actions.openFinancialPilotage',
    labelDefault: 'Ouvrir le pilotage financier',
    to: '/app/pilotage?tab=financial',
  },
  negative_working_capital: {
    labelKey: 'pilotage.alerts.actions.openAccountingPilotage',
    labelDefault: 'Ouvrir le pilotage comptable',
    to: '/app/pilotage?tab=accounting',
  },
};

const DEFAULT_ACTION_BY_SEVERITY = {
  critical: {
    labelKey: 'pilotage.alerts.actions.openFinancialPilotage',
    labelDefault: 'Ouvrir le pilotage financier',
    to: '/app/pilotage?tab=financial',
  },
  warning: {
    labelKey: 'pilotage.alerts.actions.openAccountingPilotage',
    labelDefault: 'Ouvrir le pilotage comptable',
    to: '/app/pilotage?tab=accounting',
  },
  info: {
    labelKey: 'pilotage.alerts.actions.openPilotage',
    labelDefault: 'Ouvrir le pilotage',
    to: '/app/pilotage',
  },
};

export const resolveAlertAction = (alert = {}) =>
  ALERT_ACTIONS_BY_TYPE[alert.type] || DEFAULT_ACTION_BY_SEVERITY[alert.severity] || DEFAULT_ACTION_BY_SEVERITY.info;

const ALERTS_INFO = {
  title: 'Alertes financières',
  definition: 'Liste des alertes prioritaires détectées sur le périmètre pilotage pour la période courante.',
  dataSource: 'Alertes calculées à partir des ratios pilotage, des seuils utilisateur et des règles de diagnostic.',
  formula: 'Aucune formule unique: chaque alerte applique sa propre règle de déclenchement.',
  calculationMethod:
    'Les alertes sont recalculées en fonction des seuils abonnés par type, puis dédupliquées et triées par sévérité décroissante.',
  notes: 'Le compteur à droite indique le nombre total d’alertes visibles après application des abonnements.',
};

const formatNumber = (value) => {
  if (value == null) return '--';
  if (typeof value === 'number') {
    return new Intl.NumberFormat(getLocale(), {
      maximumFractionDigits: 2,
    }).format(value);
  }
  return String(value);
};

const AlertRow = ({ alert, t, action }) => {
  const cfg = SEVERITY_CONFIG[alert.severity] || DEFAULT_SEVERITY;
  const SeverityIcon = cfg.icon;
  const actionLabel = t(action.labelKey, action.labelDefault);
  const rule = PILOTAGE_ALERT_RULES[alert.type];
  const alertLabel = rule ? t(rule.labelKey) : alert.type;
  const alertMessage = rule ? t(rule.messageKey, alert.message || '') : alert.message;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 flex items-start gap-3`}>
      <SeverityIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cfg.badgeBg} ${cfg.badgeText}`}
          >
            {alertLabel}
          </span>
        </div>
        <p className="text-sm text-gray-200 leading-snug">{alertMessage}</p>
        {(alert.value != null || alert.threshold != null) && (
          <p className="text-xs text-gray-500 mt-1">
            {alert.value != null && <span>{formatNumber(alert.value)}</span>}
            {alert.value != null && alert.threshold != null && <span className="mx-1 text-gray-600">/</span>}
            {alert.threshold != null && <span className="text-gray-400">seuil: {formatNumber(alert.threshold)}</span>}
          </p>
        )}
      </div>
      <Link
        to={action.to}
        aria-label={actionLabel}
        className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-gray-100 transition-colors hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-100"
      >
        <span>{actionLabel}</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};

const sortAlerts = (alerts = []) => {
  const order = { critical: 0, warning: 1, info: 2 };
  return [...alerts].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
};

const AlertsPanel = ({ data }) => {
  const { t } = useTranslation();
  const companyId = data?.company?.id || null;
  const { settings, loading, saving, saveSettings } = usePilotageAlertSubscriptions(companyId);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const mergedAlerts = React.useMemo(() => {
    if (!data) return [];
    const candidates = buildPilotageAlertCandidates(data, settings);
    return sortAlerts(candidates);
  }, [data, settings]);

  const hasAlerts = mergedAlerts.length > 0;

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <Bell className="w-4 h-4 text-orange-400 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-gray-200 flex items-center gap-2">
              <PanelInfoPopover
                title={ALERTS_INFO.title}
                definition={ALERTS_INFO.definition}
                dataSource={ALERTS_INFO.dataSource}
                formula={ALERTS_INFO.formula}
                calculationMethod={ALERTS_INFO.calculationMethod}
                notes={ALERTS_INFO.notes}
              />
              <span>{t('pilotage.alerts.title')}</span>
              {hasAlerts && <span className="ml-auto text-xs font-normal text-gray-500">{mergedAlerts.length}</span>}
            </CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-orange-500/20 bg-orange-500/10 text-orange-100 hover:bg-orange-500/20"
                onClick={() => setIsDialogOpen(true)}
              >
                <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                {t('pilotage.alertSubscriptions.manage')}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasAlerts ? (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {mergedAlerts.map((alert) => (
              <AlertRow key={alert.type} alert={alert} t={t} action={resolveAlertAction(alert)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <p className="text-sm text-green-400 font-medium">{t('pilotage.alerts.noAlerts')}</p>
          </div>
        )}
      </CardContent>
      <PilotageAlertSubscriptionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        settings={settings}
        onSave={saveSettings}
        loading={loading}
        saving={saving}
        data={data}
      />
    </Card>
  );
};

export default AlertsPanel;
