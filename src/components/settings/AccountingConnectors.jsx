import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useAccountingIntegrations } from '@/hooks/useAccountingIntegrations';
import { Building2, CheckCircle2, CircleDashed, Link2Off, RefreshCw } from 'lucide-react';

const PROVIDERS = [
  {
    id: 'xero',
    title: 'Xero',
    subtitle: 'Moyennes et grandes structures multi-entités',
    tenantLabel: 'Tenant ID Xero',
  },
  {
    id: 'quickbooks',
    title: 'QuickBooks',
    subtitle: 'PME et cabinets orientés QuickBooks Online',
    tenantLabel: 'Realm ID QuickBooks',
  },
];

const statusBadge = (status, t) => {
  switch (status) {
    case 'connected':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-0">
          {t('integrationsHub.accountingConnectors.status.connected', 'Connected')}
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border-0">
          {t('integrationsHub.accountingConnectors.status.pending', 'Pending OAuth')}
        </Badge>
      );
    case 'error':
      return (
        <Badge className="bg-red-500/20 text-red-300 border-0">
          {t('integrationsHub.accountingConnectors.status.error', 'Error')}
        </Badge>
      );
    default:
      return (
        <Badge className="bg-slate-500/20 text-slate-300 border-0">
          {t('integrationsHub.accountingConnectors.status.disconnected', 'Disconnected')}
        </Badge>
      );
  }
};

const AccountingConnectors = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { company } = useCompany();
  const {
    providerState,
    loading,
    fetchIntegrations,
    connectProvider,
    markProviderPending,
    disconnectProvider,
    requestSync,
  } = useAccountingIntegrations();

  const [formState, setFormState] = useState({
    xero: { external_company_name: '', external_tenant_id: '', sync_enabled: true },
    quickbooks: { external_company_name: '', external_tenant_id: '', sync_enabled: true },
  });
  const [busyProvider, setBusyProvider] = useState(null);

  useEffect(() => {
    const onOAuthCallback = (event) => {
      const data = event?.data;
      if (!data || data.type !== 'cashpilot:accounting-oauth') return;
      fetchIntegrations();
      toast({
        title: data.status === 'success'
          ? t('integrationsHub.accountingConnectors.toasts.oauthCompletedTitle', 'OAuth completed')
          : t('integrationsHub.accountingConnectors.toasts.oauthFailedTitle', 'OAuth failed'),
        description: data.message || t(
          'integrationsHub.accountingConnectors.toasts.oauthCompletedDescription',
          'Connector status has been refreshed.',
        ),
        variant: data.status === 'success' ? 'default' : 'destructive',
      });
    };

    window.addEventListener('message', onOAuthCallback);
    return () => window.removeEventListener('message', onOAuthCallback);
  }, [fetchIntegrations, t, toast]);

  const companyName = useMemo(
    () => company?.company_name || company?.name || t('integrationsHub.accountingConnectors.currentCompany', 'Current company'),
    [company, t]
  );

  const updateForm = (provider, patch) => {
    setFormState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        ...patch,
      },
    }));
  };

  const withProviderBusy = async (provider, operation) => {
    setBusyProvider(provider);
    try {
      await operation();
    } catch (error) {
      toast({
        title: t('common.error', 'Erreur'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleConnect = async (provider) => {
    await withProviderBusy(provider, async () => {
      const payload = formState[provider];
      const data = await connectProvider(provider, payload);
      const authorizationUrl = data?.authorizationUrl;
      if (!authorizationUrl) {
        throw new Error('OAuth URL is missing for connector initialization.');
      }

      const popup = window.open(
        authorizationUrl,
        `cashpilot-oauth-${provider}`,
        'width=720,height=820,menubar=no,toolbar=no,status=no',
      );

      if (!popup) {
        window.location.assign(authorizationUrl);
      }

      toast({
        title: t('integrationsHub.accountingConnectors.toasts.oauthLaunchTitle', 'OAuth flow started'),
        description: t(
          'integrationsHub.accountingConnectors.toasts.oauthLaunchDescription',
          `Continue in the opened window to connect ${provider === 'xero' ? 'Xero' : 'QuickBooks'} for ${companyName}.`,
          { provider: provider === 'xero' ? 'Xero' : 'QuickBooks', company: companyName }
        ),
      });
    });
  };

  const handlePrepareOauth = async (provider) => {
    await withProviderBusy(provider, async () => {
      const payload = formState[provider];
      await markProviderPending(provider, payload);
      toast({
        title: t('integrationsHub.accountingConnectors.toasts.oauthReadyTitle', 'OAuth ready'),
        description: t(
          'integrationsHub.accountingConnectors.toasts.oauthReadyDescription',
          `${provider === 'xero' ? 'Xero' : 'QuickBooks'} connector is marked as pending OAuth.`,
          { provider: provider === 'xero' ? 'Xero' : 'QuickBooks' }
        ),
      });
    });
  };

  const handleDisconnect = async (provider) => {
    await withProviderBusy(provider, async () => {
      await disconnectProvider(provider);
      toast({
        title: t('integrationsHub.accountingConnectors.toasts.disconnectedTitle', 'Connector disabled'),
        description: t(
          'integrationsHub.accountingConnectors.toasts.disconnectedDescription',
          `${provider === 'xero' ? 'Xero' : 'QuickBooks'} is disconnected.`,
          { provider: provider === 'xero' ? 'Xero' : 'QuickBooks' }
        ),
      });
    });
  };

  const handleSync = async (provider) => {
    await withProviderBusy(provider, async () => {
      await requestSync(provider);
      toast({
        title: t('integrationsHub.accountingConnectors.toasts.syncStartedTitle', 'Sync started'),
        description: t(
          'integrationsHub.accountingConnectors.toasts.syncStartedDescription',
          `${provider === 'xero' ? 'Xero' : 'QuickBooks'} sync has been scheduled.`,
          { provider: provider === 'xero' ? 'Xero' : 'QuickBooks' }
        ),
      });
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Building2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <CardTitle className="text-lg">
              {t('integrationsHub.accountingConnectors.title', 'Accounting connectors')}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {t(
                'integrationsHub.accountingConnectors.description',
                'Xero and QuickBooks use the same source of truth as CashPilot.'
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-amber-200">
              {t('integrationsHub.accountingConnectors.liveOauthTitle', 'Live OAuth')}
            </p>
            <p className="text-xs text-amber-100/90 mt-1">
              {t(
                'integrationsHub.accountingConnectors.liveOauthDescription',
                'OAuth callback and sync probes are active. Configure provider credentials in Edge Function environment variables before production rollout.'
              )}
            </p>
          </div>

        {PROVIDERS.map((provider) => {
          const state = providerState[provider.id];
          const isBusy = busyProvider === provider.id;
          const status = state?.status || 'disconnected';
          const isConnected = status === 'connected';
          const canSync = status === 'connected';

          return (
            <div key={provider.id} className="rounded-xl border border-gray-700/70 bg-gray-800/30 p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-white font-medium">{provider.title}</p>
                  <p className="text-xs text-gray-400">{provider.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(status, t)}
                  {loading ? (
                    <CircleDashed className="w-4 h-4 animate-spin text-gray-400" />
                  ) : isConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-400">
                    {t('integrationsHub.accountingConnectors.fields.remoteOrgName', 'Remote organization name')}
                  </Label>
                  <Input
                    value={formState[provider.id].external_company_name}
                    onChange={(event) => updateForm(provider.id, { external_company_name: event.target.value })}
                    className="bg-gray-900 border-gray-700 text-white"
                    placeholder={`${provider.title} org`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-400">{provider.tenantLabel}</Label>
                  <Input
                    value={formState[provider.id].external_tenant_id}
                    onChange={(event) => updateForm(provider.id, { external_tenant_id: event.target.value })}
                    className="bg-gray-900 border-gray-700 text-white"
                    placeholder="tenant / realm id"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-900/60 border border-gray-700/50 px-3 py-2">
                <div>
                  <p className="text-sm text-white">
                    {t('integrationsHub.accountingConnectors.fields.autoSync', 'Auto sync')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t(
                      'integrationsHub.accountingConnectors.fields.autoSyncDescription',
                      'Enables downstream synchronization for entries and counterparties.'
                    )}
                  </p>
                </div>
                <Switch
                  checked={formState[provider.id].sync_enabled}
                  onCheckedChange={(value) => updateForm(provider.id, { sync_enabled: value })}
                />
              </div>

              {state?.last_sync_at ? (
                <p className="text-xs text-gray-500">
                  {t('integrationsHub.accountingConnectors.lastSync', 'Last sync')}: {new Date(state.last_sync_at).toLocaleString()}
                </p>
              ) : null}
              {state?.last_error ? (
                <p className="text-xs text-red-300">
                  {t('integrationsHub.accountingConnectors.lastError', 'Last error')}: {state.last_error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleConnect(provider.id)}
                  disabled={isBusy}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {isBusy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {t('integrationsHub.accountingConnectors.actions.connect', 'Connect')}
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-900/20"
                  disabled={isBusy}
                  onClick={() => handlePrepareOauth(provider.id)}
                >
                  {t('integrationsHub.accountingConnectors.actions.prepareOauth', 'Prepare OAuth')}
                </Button>
                <Button
                  variant="outline"
                  className="border-green-500/40 text-green-300 hover:bg-green-900/20"
                  disabled={isBusy || !canSync}
                  onClick={() => handleSync(provider.id)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('integrationsHub.accountingConnectors.actions.syncNow', 'Sync now')}
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/40 text-red-300 hover:bg-red-900/20"
                  disabled={isBusy}
                  onClick={() => handleDisconnect(provider.id)}
                >
                  <Link2Off className="w-4 h-4 mr-2" />
                  {t('integrationsHub.accountingConnectors.actions.disconnect', 'Disconnect')}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AccountingConnectors;
