import { useState, useCallback, useMemo } from 'react';
import { Building2, CheckCircle2, Clock, Loader2, RefreshCw, ShieldAlert, Unplug, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const STATUS_MAP = {
  active: { icon: CheckCircle2, colorClass: 'text-green-400 bg-green-500/10', key: 'banking.statusActive' },
  expired: { icon: Clock, colorClass: 'text-orange-400 bg-orange-500/10', key: 'banking.statusExpired' },
  error: { icon: ShieldAlert, colorClass: 'text-red-400 bg-red-500/10', key: 'banking.statusError' },
  disconnected: { icon: XCircle, colorClass: 'text-gray-400 bg-gray-500/10', key: 'banking.statusDisconnected' },
};

export default function BankConnectionCard({ connection, onSync, onDisconnect }) {
  const { t, i18n } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

  const statusConfig = useMemo(() => {
    const config = STATUS_MAP[connection.status] || STATUS_MAP.error;
    return { ...config, label: t(config.key) };
  }, [connection.status, t]);

  const StatusIcon = statusConfig.icon;

  const formatAmount = useCallback(
    (value, currency = 'EUR') => {
      const amount = Number(value || 0);
      return (
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount) + ` ${String(currency || 'EUR').toUpperCase()}`
      );
    },
    [locale]
  );

  const formatDateTime = useCallback(
    (value) => {
      if (!value) return t('banking.never');
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return t('banking.never');
      return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
    },
    [locale, t]
  );

  const handleSync = async () => {
    if (!onSync) return;
    setSyncing(true);
    try {
      await onSync(connection.id);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try {
      await onDisconnect(connection.id);
    } finally {
      setDisconnecting(false);
    }
  };

  const providerLogo = connection.bank_providers?.logo_url || null;
  const institutionName = connection.institution_name || t('banking.unknownInstitution');
  const maskedIban = connection.iban
    ? `${connection.iban.slice(0, 4)} **** **** ${connection.iban.slice(-4)}`
    : connection.account_number_masked || t('banking.ibanUnavailable');

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 transition-colors hover:border-gray-700">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Left section: Logo + Info */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-800">
            {providerLogo ? (
              <img src={providerLogo} alt={institutionName} className="h-full w-full object-contain p-1" />
            ) : (
              <Building2 className="h-6 w-6 text-gray-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-white truncate">{connection.account_name || institutionName}</h3>
              <div
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${statusConfig.colorClass}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </div>
            </div>

            <p className="mt-1 text-sm text-gray-400">
              {institutionName}{' '}
              {maskedIban !== t('banking.ibanUnavailable') && <span className="text-gray-500">{maskedIban}</span>}
            </p>

            <div className="mt-3 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
              <p>
                {t('banking.lastSync')}: {formatDateTime(connection.last_sync_at)}
              </p>
              <p>
                {t('banking.consentUntil')}: {formatDateTime(connection.consent_expires_at)}
              </p>
            </div>

            {connection.sync_error && (
              <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {connection.sync_error}
              </p>
            )}
          </div>
        </div>

        {/* Right section: Balance + Actions */}
        <div className="flex min-w-[200px] flex-col items-start gap-3 lg:items-end">
          {connection.balance != null ? (
            <p
              className={`text-lg font-semibold ${Number(connection.balance) >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {formatAmount(connection.balance, connection.currency)}
            </p>
          ) : (
            <p className="text-sm text-gray-500">{t('banking.balanceUnavailable')}</p>
          )}

          {connection.balance_updated_at && (
            <p className="text-xs text-gray-600">
              {t('banking.updatedAt')}: {formatDateTime(connection.balance_updated_at)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={connection.status !== 'active' || syncing}
              onClick={handleSync}
              className="border-gray-700 bg-gray-950 text-white hover:bg-gray-800"
            >
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t('banking.sync')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disconnecting || connection.status === 'disconnected'}
              onClick={handleDisconnect}
              className="text-gray-400 hover:text-red-400"
            >
              {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
              {t('banking.disconnect')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
