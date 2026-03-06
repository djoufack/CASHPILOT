import { useMemo, useState } from 'react';
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

const statusBadge = (status) => {
  switch (status) {
    case 'connected':
      return <Badge className="bg-emerald-500/20 text-emerald-300 border-0">Connected</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500/20 text-amber-300 border-0">Pending OAuth</Badge>;
    case 'error':
      return <Badge className="bg-red-500/20 text-red-300 border-0">Error</Badge>;
    default:
      return <Badge className="bg-slate-500/20 text-slate-300 border-0">Disconnected</Badge>;
  }
};

const AccountingConnectors = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { company } = useCompany();
  const {
    providerState,
    loading,
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

  const companyName = useMemo(
    () => company?.company_name || company?.name || 'Current company',
    [company]
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
      await connectProvider(provider, payload);
      toast({
        title: 'Connecteur activé',
        description: `${provider === 'xero' ? 'Xero' : 'QuickBooks'} est connecté pour ${companyName}.`,
      });
    });
  };

  const handlePrepareOauth = async (provider) => {
    await withProviderBusy(provider, async () => {
      const payload = formState[provider];
      await markProviderPending(provider, payload);
      toast({
        title: 'OAuth prêt',
        description: `Le connecteur ${provider === 'xero' ? 'Xero' : 'QuickBooks'} est marqué en attente OAuth.`,
      });
    });
  };

  const handleDisconnect = async (provider) => {
    await withProviderBusy(provider, async () => {
      await disconnectProvider(provider);
      toast({
        title: 'Connecteur désactivé',
        description: `${provider === 'xero' ? 'Xero' : 'QuickBooks'} est déconnecté.`,
      });
    });
  };

  const handleSync = async (provider) => {
    await withProviderBusy(provider, async () => {
      await requestSync(provider);
      toast({
        title: 'Synchronisation lancée',
        description: `La synchro ${provider === 'xero' ? 'Xero' : 'QuickBooks'} a été planifiée.`,
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
            <CardTitle className="text-lg">Connecteurs comptables</CardTitle>
            <CardDescription className="text-gray-400">
              Xero et QuickBooks utilisent la même source de vérité que CashPilot.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
                  {statusBadge(status)}
                  {loading ? (
                    <CircleDashed className="w-4 h-4 animate-spin text-gray-400" />
                  ) : isConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-400">Nom organisation distante</Label>
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
                  <p className="text-sm text-white">Synchronisation auto</p>
                  <p className="text-xs text-gray-500">Active la synchro descendante des écritures et tiers</p>
                </div>
                <Switch
                  checked={formState[provider.id].sync_enabled}
                  onCheckedChange={(value) => updateForm(provider.id, { sync_enabled: value })}
                />
              </div>

              {state?.last_sync_at ? (
                <p className="text-xs text-gray-500">
                  Dernière sync: {new Date(state.last_sync_at).toLocaleString()}
                </p>
              ) : null}
              {state?.last_error ? (
                <p className="text-xs text-red-300">Dernière erreur: {state.last_error}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleConnect(provider.id)}
                  disabled={isBusy}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {isBusy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Connecter
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-900/20"
                  disabled={isBusy}
                  onClick={() => handlePrepareOauth(provider.id)}
                >
                  Préparer OAuth
                </Button>
                <Button
                  variant="outline"
                  className="border-green-500/40 text-green-300 hover:bg-green-900/20"
                  disabled={isBusy || !canSync}
                  onClick={() => handleSync(provider.id)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync now
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/40 text-red-300 hover:bg-red-900/20"
                  disabled={isBusy}
                  onClick={() => handleDisconnect(provider.id)}
                >
                  <Link2Off className="w-4 h-4 mr-2" />
                  Déconnecter
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
