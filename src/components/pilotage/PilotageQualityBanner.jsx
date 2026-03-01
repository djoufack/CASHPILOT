import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

const STYLE_BY_STATUS = {
  blocked: {
    container: 'border-red-500/30 bg-red-500/10',
    icon: 'text-red-300',
    title: 'text-red-200',
    body: 'text-red-100/90',
  },
  warning: {
    container: 'border-amber-500/30 bg-amber-500/10',
    icon: 'text-amber-300',
    title: 'text-amber-200',
    body: 'text-amber-100/90',
  },
};

const PilotageQualityBanner = ({ data }) => {
  const { t } = useTranslation();
  const quality = data?.dataQuality;
  const status = quality?.datasetStatus;

  if (!quality || (status !== 'blocked' && status !== 'warning')) {
    return null;
  }

  const style = STYLE_BY_STATUS[status] || STYLE_BY_STATUS.warning;
  const Icon = status === 'blocked' ? ShieldAlert : AlertTriangle;
  const title = status === 'blocked'
    ? t('pilotage.quality.blockedTitle')
    : t('pilotage.quality.warningTitle');
  const hint = status === 'blocked'
    ? t('pilotage.quality.blockedHint')
    : t('pilotage.quality.warningHint');
  const issues = quality.topIssues || [];

  return (
    <div className={`rounded-2xl border p-4 ${style.container}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon className={`h-5 w-5 ${style.icon}`} />
        </div>
        <div className="min-w-0 space-y-2">
          <p className={`text-sm font-semibold ${style.title}`}>{title}</p>
          <p className={`text-sm ${style.body}`}>{hint}</p>
          {issues.length > 0 ? (
            <ul className={`space-y-1 text-xs ${style.body}`}>
              {issues.map((issue) => (
                <li key={`${issue.code}-${issue.message}`}>• {issue.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PilotageQualityBanner;
