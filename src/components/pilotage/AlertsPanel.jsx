import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Bell,
} from 'lucide-react';

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

const ALERTS_INFO = {
  title: 'Alertes financières',
  definition: 'Liste des alertes prioritaires détectées sur le périmètre pilotage pour la période courante.',
  dataSource: 'Alertes calculées à partir de `data.alerts` et des règles de diagnostic pilotage.',
  formula: 'Aucune formule unique: chaque alerte applique sa propre règle de déclenchement.',
  calculationMethod: 'Les alertes sont triées par sévérité décroissante puis affichées avec leur message et leurs seuils.',
  notes: 'Le compteur à droite indique le nombre total d’alertes remontées sur le bloc.',
};

const formatNumber = (value) => {
  if (value == null) return '--';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 2,
    }).format(value);
  }
  return String(value);
};

const AlertRow = ({ alert, t }) => {
  const cfg = SEVERITY_CONFIG[alert.severity] || DEFAULT_SEVERITY;
  const SeverityIcon = cfg.icon;

  return (
    <div
      className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 flex items-start gap-3`}
    >
      <SeverityIcon
        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cfg.badgeBg} ${cfg.badgeText}`}
          >
            {t(cfg.labelKey)}
          </span>
        </div>
        <p className="text-sm text-gray-200 leading-snug">
          {alert.message}
        </p>
        {(alert.value != null || alert.threshold != null) && (
          <p className="text-xs text-gray-500 mt-1">
            {alert.value != null && (
              <span>
                {formatNumber(alert.value)}
              </span>
            )}
            {alert.value != null && alert.threshold != null && (
              <span className="mx-1 text-gray-600">/</span>
            )}
            {alert.threshold != null && (
              <span className="text-gray-400">
                seuil: {formatNumber(alert.threshold)}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
};

const AlertsPanel = ({ alerts }) => {
  const { t } = useTranslation();

  const hasAlerts = alerts && alerts.length > 0;

  // Sort alerts by severity: critical first, then warning, then info
  const sortedAlerts = React.useMemo(() => {
    if (!hasAlerts) return [];
    const order = { critical: 0, warning: 1, info: 2 };
    return [...alerts].sort(
      (a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
    );
  }, [alerts, hasAlerts]);

  return (
      <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-200 flex items-center gap-2">
          <Bell className="w-4 h-4 text-orange-400" />
          <PanelInfoPopover
            title={ALERTS_INFO.title}
            definition={ALERTS_INFO.definition}
            dataSource={ALERTS_INFO.dataSource}
            formula={ALERTS_INFO.formula}
            calculationMethod={ALERTS_INFO.calculationMethod}
            notes={ALERTS_INFO.notes}
          />
          <span>{t('pilotage.alerts.title')}</span>
          {hasAlerts && (
            <span className="ml-auto text-xs font-normal text-gray-500">
              {sortedAlerts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasAlerts ? (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {sortedAlerts.map((alert, index) => (
              <AlertRow key={index} alert={alert} t={t} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <p className="text-sm text-green-400 font-medium">
              {t('pilotage.alerts.noAlerts')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;
