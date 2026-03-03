import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBankConnections } from '@/hooks/useBankConnections';
import { useCompany } from '@/hooks/useCompany';
import { useReferenceData } from '@/contexts/ReferenceDataContext';

const DEFAULT_COUNTRY = 'BE';

function normalizeCountryCode(value) {
  return String(value || DEFAULT_COUNTRY).trim().toUpperCase() || DEFAULT_COUNTRY;
}

const BankConnectionsPage = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { company } = useCompany();
  const { countryOptions } = useReferenceData();
  const {
    connections,
    loading,
    listInstitutions,
    initiateConnection,
    disconnectBank,
    syncConnection,
    totalBalance,
    refresh,
  } = useBankConnections();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [institutions, setInstitutions] = useState([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionsError, setInstitutionsError] = useState(null);
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [connectingInstitutionId, setConnectingInstitutionId] = useState(null);
  const [syncingConnectionId, setSyncingConnectionId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const deferredSearch = useDeferredValue(institutionSearch);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

  const statusConfig = useMemo(() => ({
    active: { color: 'text-green-400 bg-green-500/10', icon: CheckCircle2, label: t('bankConnectionsPage.status.active') },
    pending: { color: 'text-yellow-400 bg-yellow-500/10', icon: Clock, label: t('bankConnectionsPage.status.pending') },
    expired: { color: 'text-red-400 bg-red-500/10', icon: XCircle, label: t('bankConnectionsPage.status.expired') },
    revoked: { color: 'text-gray-400 bg-gray-500/10', icon: XCircle, label: t('bankConnectionsPage.status.revoked') },
    error: { color: 'text-red-400 bg-red-500/10', icon: ShieldAlert, label: t('common.error') },
  }), [t]);

  const formatDateTime = useCallback((value) => {
    if (!value) {
      return t('bankConnectionsPage.never');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t('bankConnectionsPage.never');
    }

    return date.toLocaleString(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }, [locale, t]);

  const formatAmount = useCallback((value, currency = 'EUR') => {
    const amount = Number(value || 0);
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ${String(currency || 'EUR').toUpperCase()}`;
  }, [locale]);

  useEffect(() => {
    if (!company?.country) {
      return;
    }

    setSelectedCountry((previous) => {
      if (previous && previous !== DEFAULT_COUNTRY) {
        return previous;
      }

      return normalizeCountryCode(company.country);
    });
  }, [company?.country]);

  useEffect(() => {
    const linked = searchParams.get('linked');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (!linked && !error) {
      return;
    }

    if (linked === '1') {
      const accounts = Number(searchParams.get('accounts') || 0);
      const synced = Number(searchParams.get('synced') || 0);
      toast({
        title: t('bankConnectionsPage.toasts.connectedTitle'),
        description: t('bankConnectionsPage.toasts.connectedDescription', { accounts, synced }),
      });
    }

    if (error) {
      toast({
        title: t('bankConnectionsPage.toasts.connectionFailedTitle'),
        description: message || error,
        variant: 'destructive',
      });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('linked');
    nextParams.delete('accounts');
    nextParams.delete('synced');
    nextParams.delete('error');
    nextParams.delete('message');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, t, toast]);

  const loadInstitutions = async (countryCode, { force = false } = {}) => {
    setInstitutionsLoading(true);
    setInstitutionsError(null);

    try {
      const rows = await listInstitutions(countryCode, { force });
      setInstitutions(rows);
    } catch (err) {
      setInstitutions([]);
      setInstitutionsError(err?.message || t('bankConnectionsPage.errors.loadInstitutions'));
    } finally {
      setInstitutionsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnectDialogOpen) {
      return;
    }

    loadInstitutions(selectedCountry);
  }, [isConnectDialogOpen, selectedCountry]);

  const filteredInstitutions = useMemo(() => {
    const normalizedTerm = deferredSearch.trim().toLowerCase();
    if (!normalizedTerm) {
      return institutions.slice(0, 80);
    }

    return institutions
      .filter((institution) => {
        const haystack = `${institution.name} ${institution.bic}`.toLowerCase();
        return haystack.includes(normalizedTerm);
      })
      .slice(0, 80);
  }, [deferredSearch, institutions]);

  const activeConnections = useMemo(
    () => connections.filter((connection) => connection.status === 'active' && connection.account_id),
    [connections]
  );

  const balanceCurrencies = useMemo(
    () => [...new Set(activeConnections.map((connection) => String(connection.account_currency || 'EUR').toUpperCase()))],
    [activeConnections]
  );

  const hasMixedCurrencies = balanceCurrencies.length > 1;

  const countrySelectOptions = useMemo(() => {
    if (countryOptions?.length) {
      return countryOptions;
    }

    return [
      { value: 'BE', label: t('bankConnectionsPage.countries.BE') },
      { value: 'FR', label: t('bankConnectionsPage.countries.FR') },
      { value: 'DE', label: t('bankConnectionsPage.countries.DE') },
      { value: 'ES', label: t('bankConnectionsPage.countries.ES') },
      { value: 'IT', label: t('bankConnectionsPage.countries.IT') },
      { value: 'NL', label: t('bankConnectionsPage.countries.NL') },
    ];
  }, [countryOptions, t]);

  const handleOpenConnectDialog = () => {
    setInstitutionSearch('');
    setInstitutions([]);
    setInstitutionsError(null);
    setConnectDialogOpen(true);
  };

  const handleConnectInstitution = async (institution) => {
    setConnectingInstitutionId(institution.id);
    try {
      await initiateConnection({
        institutionId: institution.id,
        institutionName: institution.name,
        country: selectedCountry,
      });
    } catch (err) {
      toast({
        title: t('bankConnectionsPage.toasts.connectionImpossibleTitle'),
        description: err?.message || t('bankConnectionsPage.errors.authorizationFailed'),
        variant: 'destructive',
      });
      setConnectingInstitutionId(null);
    }
  };

  const handleSyncConnection = async (connection) => {
    setSyncingConnectionId(connection.id);
    try {
      const result = await syncConnection(connection.id);
      toast({
        title: t('bankConnectionsPage.toasts.syncDoneTitle'),
        description: t('bankConnectionsPage.toasts.syncDoneDescription', {
          name: connection.institution_name || connection.account_name || t('bankConnectionsPage.accountFallback'),
          count: Number(result?.synced || 0),
        }),
      });
    } catch (err) {
      toast({
        title: t('bankConnectionsPage.toasts.syncFailedTitle'),
        description: err?.message || t('bankConnectionsPage.errors.syncFailed'),
        variant: 'destructive',
      });
    } finally {
      setSyncingConnectionId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!activeConnections.length) {
      return;
    }

    setSyncingAll(true);
    let syncedTotal = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const connection of activeConnections) {
      try {
        const result = await syncConnection(connection.id);
        syncedTotal += Number(result?.synced || 0);
        successCount += 1;
      } catch {
        failureCount += 1;
      }
    }

    setSyncingAll(false);

    if (failureCount > 0) {
      toast({
        title: t('bankConnectionsPage.toasts.partialSyncTitle'),
        description: t('bankConnectionsPage.toasts.partialSyncDescription', {
          successCount,
          failureCount,
          syncedTotal,
        }),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('bankConnectionsPage.toasts.fullSyncTitle'),
      description: t('bankConnectionsPage.toasts.fullSyncDescription', {
        successCount,
        syncedTotal,
      }),
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Building2 className="h-7 w-7 text-orange-400" />
            {t('nav.bankConnections', 'Connexions Bancaires')}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {t('bankConnectionsPage.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => refresh()}
            className="text-gray-300 hover:text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('bankConnectionsPage.actions.refresh')}
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={syncingAll || activeConnections.length === 0}
            className="border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
          >
            {syncingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t('bankConnectionsPage.actions.syncAll')}
          </Button>
          <Button onClick={handleOpenConnectDialog} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="mr-2 h-4 w-4" />
            {t('bankConnectionsPage.actions.connectBank')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-amber-500/10 p-6">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-sm text-gray-400">{t('bankConnectionsPage.syncedBalances')}</p>
              <p className="text-3xl font-bold text-white">
                {formatAmount(totalBalance, balanceCurrencies[0] || 'EUR')}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {hasMixedCurrencies
                  ? t('bankConnectionsPage.balanceMixedCurrencies', { currencies: balanceCurrencies.join(', ') })
                  : t('bankConnectionsPage.balanceAggregated')}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <p className="text-sm text-gray-400">{t('bankConnectionsPage.bankEstate')}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-2xl font-semibold text-white">{connections.length}</p>
              <p className="text-xs text-gray-500">{t('bankConnectionsPage.metrics.connections')}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-2xl font-semibold text-green-400">
                {connections.filter((connection) => connection.status === 'active').length}
              </p>
              <p className="text-xs text-gray-500">{t('bankConnectionsPage.metrics.active')}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-2xl font-semibold text-yellow-400">
                {connections.filter((connection) => connection.status === 'pending').length}
              </p>
              <p className="text-xs text-gray-500">{t('bankConnectionsPage.metrics.pending')}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 py-12 text-center text-gray-500">
          <Building2 className="mx-auto mb-4 h-16 w-16 text-gray-700" />
          <p className="text-lg text-white">{t('bankConnectionsPage.emptyTitle')}</p>
          <p className="mt-1 text-sm">{t('bankConnectionsPage.emptyDescription')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => {
            const status = statusConfig[connection.status] || statusConfig.error;
            const StatusIcon = status.icon;
            const isSyncing = syncingConnectionId === connection.id;

            return (
              <div
                key={connection.id}
                className="rounded-xl border border-gray-800 bg-gray-900/60 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-gray-800">
                      {connection.institution_logo ? (
                        <img
                          src={connection.institution_logo}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Building2 className="h-6 w-6 text-gray-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-white">
                          {connection.account_name || connection.institution_name || t('bankConnectionsPage.accountFallback')}
                        </h3>
                        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">
                        {connection.institution_name || t('bankConnectionsPage.institutionFallback')}
                        {connection.account_iban ? ` • ${connection.account_iban}` : ` • ${t('bankConnectionsPage.ibanUnavailable')}`}
                      </p>
                      <div className="mt-3 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                        <p>{t('bankConnectionsPage.lastSync', { date: formatDateTime(connection.last_sync_at) })}</p>
                        <p>{t('bankConnectionsPage.consentUntil', { date: formatDateTime(connection.expires_at) })}</p>
                      </div>
                      {connection.sync_error ? (
                        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          {connection.sync_error}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-w-[220px] flex-col items-start gap-3 lg:items-end">
                    {connection.account_balance != null ? (
                      <p className={`text-lg font-semibold ${Number(connection.account_balance) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatAmount(connection.account_balance, connection.account_currency || 'EUR')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">{t('bankConnectionsPage.balanceUnavailable')}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={connection.status !== 'active' || !connection.account_id || isSyncing}
                        onClick={() => handleSyncConnection(connection)}
                        className="border-gray-700 bg-gray-950 text-white hover:bg-gray-800"
                      >
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {t('bankConnectionsPage.actions.sync')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disconnectBank(connection.id)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('bankConnectionsPage.actions.remove')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isConnectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-3xl border-gray-800 bg-gray-950 text-white">
          <DialogHeader>
            <DialogTitle>{t('bankConnectionsPage.dialog.title')}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('bankConnectionsPage.dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="bank-country">{t('bankConnectionsPage.dialog.countryLabel')}</Label>
              <Select
                value={selectedCountry}
                onValueChange={(value) => setSelectedCountry(normalizeCountryCode(value))}
              >
                <SelectTrigger id="bank-country" className="border-gray-700 bg-gray-900 text-white">
                  <SelectValue placeholder={t('bankConnectionsPage.dialog.chooseCountry')} />
                </SelectTrigger>
                <SelectContent className="border-gray-800 bg-gray-950 text-white">
                  {countrySelectOptions.map((country) => (
                    <SelectItem key={country.value} value={country.value}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-search">{t('bankConnectionsPage.dialog.searchLabel')}</Label>
              <Input
                id="bank-search"
                value={institutionSearch}
                onChange={(event) => setInstitutionSearch(event.target.value)}
                placeholder={t('bankConnectionsPage.dialog.searchPlaceholder')}
                className="border-gray-700 bg-gray-900 text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <p>
              {institutionsLoading
                ? t('bankConnectionsPage.dialog.loadingInstitutions')
                : t('bankConnectionsPage.dialog.institutionsFound', { count: institutions.length, country: selectedCountry })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadInstitutions(selectedCountry, { force: true })}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('bankConnectionsPage.actions.reload')}
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/50">
            {institutionsLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-400" />
              </div>
            ) : institutionsError ? (
              <div className="px-4 py-8 text-center text-sm text-red-300">{institutionsError}</div>
            ) : filteredInstitutions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {t('bankConnectionsPage.dialog.noInstitutionMatch')}
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filteredInstitutions.map((institution) => (
                  <div key={institution.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-800">
                        {institution.logo ? (
                          <img src={institution.logo} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <Building2 className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{institution.name}</p>
                        <p className="text-xs text-gray-500">
                          {institution.bic || t('bankConnectionsPage.dialog.bicUnavailable')}
                          {institution.transactionTotalDays > 0 ? ` • ${t('bankConnectionsPage.dialog.historyDays', { count: institution.transactionTotalDays })}` : ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleConnectInstitution(institution)}
                      disabled={Boolean(connectingInstitutionId)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {connectingInstitutionId === institution.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      {t('bankConnectionsPage.actions.connect')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankConnectionsPage;
