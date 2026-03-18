import { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { ArrowUpRight, Building2, Landmark, Loader2, Plus, RefreshCw, Send, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useEmbeddedBanking } from '@/hooks/useEmbeddedBanking';
import BankConnectionCard from '@/components/banking/BankConnectionCard';
import BankConnectDialog from '@/components/banking/BankConnectDialog';
import BankTransferForm from '@/components/banking/BankTransferForm';

const EmbeddedBankingPage = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const {
    connections,
    providers,
    transfers,
    loading,
    totalBalance,
    connectBank,
    syncAccount,
    initiateTransfer,
    disconnectAccount,
    fetchConnections,
    bankTransfersEnabled,
    integrationHealth,
    integrationHealthLoading,
    refreshIntegrationHealth,
  } = useEmbeddedBanking();

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

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

  const formatDate = useCallback(
    (value) => {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
    },
    [locale]
  );

  const activeConnections = useMemo(() => {
    return connections.filter((c) => c.status === 'active');
  }, [connections]);

  const handleSyncAll = async () => {
    if (!activeConnections.length) return;
    setSyncingAll(true);
    for (const conn of activeConnections) {
      try {
        await syncAccount(conn.id);
      } catch {
        // Individual errors handled by the hook's toast
      }
    }
    setSyncingAll(false);
  };

  const handleRefresh = async () => {
    await Promise.allSettled([fetchConnections(), refreshIntegrationHealth()]);
  };

  const transferStatusConfig = useMemo(
    () => ({
      pending: { color: 'text-yellow-400', label: t('banking.transferPending') },
      processing: { color: 'text-blue-400', label: t('banking.transferProcessing') },
      completed: { color: 'text-green-400', label: t('banking.transferCompleted') },
      failed: { color: 'text-red-400', label: t('banking.transferFailed') },
      cancelled: { color: 'text-gray-400', label: t('banking.transferCancelled') },
    }),
    [t]
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Helmet>
        <title>{t('banking.pageTitle')} | CashPilot</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Landmark className="h-7 w-7 text-blue-400" />
            {t('banking.pageTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-400">{t('banking.pageSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={handleRefresh} className="text-gray-300 hover:text-white">
            <RefreshCw className={`mr-2 h-4 w-4 ${integrationHealthLoading ? 'animate-spin' : ''}`} />
            {t('banking.refresh')}
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={syncingAll || activeConnections.length === 0}
            className="border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
          >
            {syncingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t('banking.syncAll')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setTransferDialogOpen(true)}
            disabled={!bankTransfersEnabled || activeConnections.length === 0}
            className="border-blue-700 bg-blue-900/30 text-blue-300 hover:bg-blue-800/40"
          >
            <Send className="mr-2 h-4 w-4" />
            {t('banking.newTransfer')}
          </Button>
          <Button
            onClick={() => setConnectDialogOpen(true)}
            disabled={!integrationHealth.ready}
            className="bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('banking.connectAccount')}
          </Button>
        </div>
      </div>

      <div
        className={`rounded-xl border p-4 ${
          integrationHealth.ready ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'
        }`}
      >
        <p className="text-sm font-medium text-white">
          {integrationHealth.ready
            ? t('banking.integrationReady', 'Connecteur bancaire opérationnel')
            : t('banking.integrationNotReady', 'Connecteur bancaire non prêt')}
        </p>
        <p className="mt-1 text-xs text-gray-300">
          {integrationHealth.ready
            ? t('banking.integrationReadyHint', 'GoCardless est disponible pour synchroniser les comptes.')
            : integrationHealth.message ||
              t(
                'banking.integrationNotReadyHint',
                'Configuration GoCardless incomplète. Le bouton de connexion est temporairement désactivé.'
              )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Total Balance */}
        <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-6">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">{t('banking.totalBalance')}</p>
              <p className="text-3xl font-bold text-white">{formatAmount(totalBalance)}</p>
              <p className="mt-1 text-xs text-gray-500">
                {t('banking.connectedAccounts', { count: activeConnections.length })}
              </p>
            </div>
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <p className="text-sm text-gray-400">{t('banking.accountOverview')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-2xl font-semibold text-white">{connections.length}</p>
              <p className="text-xs text-gray-500">{t('banking.totalAccounts')}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-2xl font-semibold text-green-400">{activeConnections.length}</p>
              <p className="text-xs text-gray-500">{t('banking.activeAccounts')}</p>
            </div>
          </div>
        </div>

        {/* Transfer Summary */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <p className="text-sm text-gray-400">{t('banking.transferSummary')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-2xl font-semibold text-white">{transfers.length}</p>
              <p className="text-xs text-gray-500">{t('banking.totalTransfers')}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-2xl font-semibold text-green-400">
                {transfers.filter((tx) => tx.status === 'completed').length}
              </p>
              <p className="text-xs text-gray-500">{t('banking.completedTransfers')}</p>
            </div>
          </div>
          {!bankTransfersEnabled && (
            <p className="mt-3 text-xs text-amber-300">
              {t('banking.transfersUnavailable', {
                defaultValue: 'Les virements bancaires directs sont temporairement indisponibles sur ce connecteur.',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Connected Accounts List */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Building2 className="h-5 w-5 text-blue-400" />
          {t('banking.connectedBankAccounts')}
        </h2>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 py-12 text-center text-gray-500">
            <Landmark className="mx-auto mb-4 h-16 w-16 text-gray-700" />
            <p className="text-lg text-white">{t('banking.noAccountsTitle')}</p>
            <p className="mt-1 text-sm">{t('banking.noAccountsDescription')}</p>
            <Button
              onClick={() => setConnectDialogOpen(true)}
              disabled={!integrationHealth.ready}
              className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('banking.connectFirstAccount')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {connections.map((conn) => (
              <BankConnectionCard
                key={conn.id}
                connection={conn}
                onSync={syncAccount}
                onDisconnect={disconnectAccount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transfer History */}
      {transfers.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Send className="h-5 w-5 text-blue-400" />
            {t('banking.recentTransfers')}
          </h2>

          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
                  <th className="px-4 py-3">{t('banking.date')}</th>
                  <th className="px-4 py-3">{t('banking.recipientName')}</th>
                  <th className="px-4 py-3">{t('banking.recipientIban')}</th>
                  <th className="px-4 py-3 text-right">{t('banking.amount')}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3">{t('banking.reference')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {transfers.map((tx) => {
                  const statusCfg = transferStatusConfig[tx.status] || transferStatusConfig.pending;
                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-gray-800/30">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-300">{formatDate(tx.initiated_at)}</td>
                      <td className="px-4 py-3 text-white">{tx.recipient_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {tx.recipient_iban
                          ? `${tx.recipient_iban.slice(0, 4)} **** ${tx.recipient_iban.slice(-4)}`
                          : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1 text-red-400">
                          <ArrowUpRight className="h-3 w-3" />
                          {formatAmount(tx.amount, tx.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{tx.reference || tx.external_ref || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <BankConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        providers={providers}
        onConnect={connectBank}
        loading={false}
      />

      <BankTransferForm
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        connections={connections}
        onSubmit={initiateTransfer}
      />
    </div>
  );
};

export default EmbeddedBankingPage;
