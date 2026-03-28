import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Building2,
  Cable,
  Globe,
  Puzzle,
  Webhook,
  Terminal,
  Server,
  Copy,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import AccountingConnectors from '@/components/settings/AccountingConnectors';
import McpServicesCatalog from '@/components/settings/McpServicesCatalog';
import { useIntegrationAutomationPacks } from '@/hooks/useIntegrationAutomationPacks';
import { buildIntegrationAutomationPackInsights } from '@/services/integrationAutomationPackInsights';

// Lazy import the sub-components from ConnectionSettings
import ConnectionSettings from '@/components/settings/ConnectionSettings';

const IntegrationsHubPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('api');
  const {
    packs: automationPacks,
    loading: automationPacksLoading,
    error: automationPacksError,
    refresh: refreshAutomationPacks,
    markPackInstalled,
    setPackStatus,
  } = useIntegrationAutomationPacks();
  const packInsights = useMemo(() => buildIntegrationAutomationPackInsights(automationPacks), [automationPacks]);

  const copyPackValue = async (label, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copie effectuee',
        description: `${label} copie dans le presse-papiers.`,
      });
    } catch {
      toast({
        title: 'Copie impossible',
        description: 'Le navigateur bloque la copie automatique.',
        variant: 'destructive',
      });
    }
  };

  const integrationCards = [
    {
      title: t('integrationsHub.cards.api.title'),
      description: t('integrationsHub.cards.api.description'),
      icon: Globe,
      accentClass: 'text-orange-300',
      badge: t('integrationsHub.cards.api.badge'),
      tab: 'api',
    },
    {
      title: t('integrationsHub.cards.webhooks.title'),
      description: t('integrationsHub.cards.webhooks.description'),
      icon: Webhook,
      accentClass: 'text-emerald-300',
      badge: t('integrationsHub.cards.webhooks.badge'),
      tab: 'webhooks',
    },
    {
      title: t('integrationsHub.cards.ai.title'),
      description: t('integrationsHub.cards.ai.description'),
      icon: Bot,
      accentClass: 'text-cyan-300',
      badge: t('integrationsHub.cards.ai.badge'),
      tab: 'mcp',
    },
    {
      title: t('integrationsHub.cards.recipes.title'),
      description: t('integrationsHub.cards.recipes.description'),
      icon: Puzzle,
      accentClass: 'text-violet-300',
      badge: t('integrationsHub.cards.recipes.badge'),
      tab: 'api',
    },
    {
      title: t('integrationsHub.cards.accounting.title', 'Accounting Connectors'),
      description: t(
        'integrationsHub.cards.accounting.description',
        'Connect Xero and QuickBooks while keeping one canonical source of truth in CashPilot.'
      ),
      icon: Building2,
      accentClass: 'text-teal-300',
      badge: t('integrationsHub.cards.accounting.badge', 'Xero + QB'),
      tab: 'api',
    },
  ];

  return (
    <>
      <Helmet>
        <title>{`${t('integrationsHub.badge')} - CashPilot`}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 md:px-8 space-y-8 min-h-screen text-white">
        {/* Hero header */}
        <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_30%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 max-w-3xl">
              <Badge className="bg-white/10 text-cyan-200 border-white/10">{t('integrationsHub.badge')}</Badge>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-400/10 p-3 ring-1 ring-cyan-300/20">
                  <Cable className="w-7 h-7 text-cyan-300" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t('integrationsHub.title')}</h1>
                  <p className="mt-2 text-sm md:text-base text-slate-300">{t('integrationsHub.subtitle')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {integrationCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="border-white/10 bg-slate-950/70 backdrop-blur cursor-pointer hover:border-white/20 transition-colors"
                onClick={() => setActiveTab(card.tab)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <Icon className={`w-5 h-5 ${card.accentClass}`} />
                    </div>
                    <Badge className="bg-white/10 text-slate-200 border-white/10">{card.badge}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-white text-lg">{card.title}</CardTitle>
                  <p className="mt-3 text-sm text-slate-400">{card.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Main tabbed interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-900/80 border border-white/10 p-1 h-auto">
            <TabsTrigger
              value="api"
              className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2.5"
            >
              <Globe className="w-4 h-4" />
              REST API
            </TabsTrigger>
            <TabsTrigger
              value="webhooks"
              className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2.5"
            >
              <Webhook className="w-4 h-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger
              value="mcp"
              className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2.5"
            >
              <Terminal className="w-4 h-4" />
              MCP
            </TabsTrigger>
          </TabsList>

          {/* ============ API TAB ============ */}
          <TabsContent value="api" className="space-y-6">
            <ConnectionSettings section="api" />
            <AccountingConnectors />
            <AutomationPacksPanel
              packs={automationPacks}
              loading={automationPacksLoading}
              error={automationPacksError}
              insights={packInsights}
              onRefresh={refreshAutomationPacks}
              onInstall={markPackInstalled}
              onSetStatus={setPackStatus}
              onCopy={copyPackValue}
            />
          </TabsContent>

          {/* ============ WEBHOOKS TAB ============ */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card className="border-white/10 bg-slate-950/70 backdrop-blur">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Webhook className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">Webhooks signés</CardTitle>
                    <p className="text-sm text-slate-400 mt-1">
                      Configurez vos endpoints, testez la livraison et consultez les logs de déclenchement.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Link to="/app/webhooks">
                    <Webhook className="w-4 h-4 mr-2" />
                    Ouvrir la gestion des webhooks
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ MCP TAB ============ */}
          <TabsContent value="mcp" className="space-y-6">
            <McpSubTabs />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

function AutomationPacksPanel({ packs, loading, error, insights, onRefresh, onInstall, onSetStatus, onCopy }) {
  const [pendingPackId, setPendingPackId] = useState(null);

  const statusBadge = {
    ready: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    installed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    disabled: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };

  const providerBadge = {
    zapier: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    make: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  };

  const statusTone =
    insights.status === 'ready'
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
      : insights.status === 'attention'
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
        : 'bg-red-500/10 border-red-500/20 text-red-200';

  const runPackAction = async (packId, callback) => {
    setPendingPackId(packId);
    try {
      await callback();
    } finally {
      setPendingPackId(null);
    }
  };

  return (
    <Card className="border-white/10 bg-slate-950/70 backdrop-blur" data-testid="integration-packs-panel">
      <CardHeader className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <Puzzle className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Packs d integration Zapier/Make</CardTitle>
              <p className="text-sm text-slate-400 mt-1">
                Demarrez des automatisations no-code preconfigurees pour ventes, achats, RH et comptabilite.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            className="border-white/10 text-slate-300 hover:bg-white/5"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PackKpi label="Packs" value={insights.totalCount} hint="catalogue actif" />
          <PackKpi label="Installes" value={insights.installedCount} hint={`${insights.readinessPct.toFixed(2)}%`} />
          <PackKpi label="Zapier" value={insights.byProvider.zapier} hint="templates Zap" />
          <PackKpi label="Make" value={insights.byProvider.make} hint="scenarios Make" />
        </div>

        <div className={`rounded-xl border p-3 ${statusTone}`}>
          <p className="text-sm font-semibold">
            Etat du portefeuille d integration:{' '}
            {insights.status === 'ready' ? 'Pret' : insights.status === 'attention' ? 'A completer' : 'Critique'}
          </p>
          {insights.recommendations.length > 0 && (
            <ul className="mt-2 text-xs space-y-1 opacity-90">
              {insights.recommendations.map((recommendation) => (
                <li key={recommendation}>• {recommendation}</li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            Erreur chargement packs: {error}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Pack', 'Provider', 'Declencheur', 'Statut', 'Actions'].map((header, index) => (
                  <th
                    key={header}
                    className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide ${index === 4 ? 'text-right' : 'text-left'}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {packs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                    Aucun pack disponible pour cette societe.
                  </td>
                </tr>
              ) : (
                packs.map((pack) => {
                  const pending = pendingPackId === pack.id;
                  const endpointUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://cashpilot.tech'}${pack.endpoint_path || ''}`;
                  return (
                    <tr key={pack.id} className="hover:bg-white/[0.03] align-top">
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-100">{pack.pack_name}</p>
                        <p className="text-xs text-gray-500 mt-1">{pack.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(pack.tags || []).map((tag) => (
                            <Badge
                              key={`${pack.id}-${tag}`}
                              variant="outline"
                              className="border-white/10 text-gray-400 text-[11px]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={providerBadge[pack.provider] || providerBadge.zapier}>
                          {String(pack.provider || 'zapier').toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-2">{pack.target_module}</p>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs text-slate-300 bg-white/5 px-2 py-1 rounded border border-white/10">
                          {pack.trigger_event}
                        </code>
                        <p className="text-xs text-gray-500 mt-2">{pack.endpoint_path}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-2">
                          <Badge className={statusBadge[pack.status] || statusBadge.ready}>{pack.status}</Badge>
                          <select
                            value={pack.status}
                            onChange={(event) => runPackAction(pack.id, () => onSetStatus(pack.id, event.target.value))}
                            disabled={pending}
                            className="w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="ready">ready</option>
                            <option value="installed">installed</option>
                            <option value="disabled">disabled</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                            onClick={() => runPackAction(pack.id, () => onInstall(pack.id))}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            {pack.status === 'installed' ? 'Reinstaller' : 'Installer'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-slate-300 hover:bg-white/10"
                            onClick={() => onCopy('Endpoint webhook', endpointUrl)}
                          >
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            Endpoint
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-slate-300 hover:bg-white/10"
                            onClick={() =>
                              onCopy('Payload exemple', JSON.stringify(pack.sample_payload || {}, null, 2))
                            }
                          >
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            Payload
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PackKpi({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f172a]/80 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-white mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCP Sub-Tabs: Connexion + Services exposés
// ---------------------------------------------------------------------------
function McpSubTabs() {
  const [mcpTab, setMcpTab] = useState('connection');

  return (
    <Tabs value={mcpTab} onValueChange={setMcpTab}>
      <TabsList className="bg-slate-900/80 border border-white/10 p-1 h-auto">
        <TabsTrigger
          value="connection"
          className="data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2"
        >
          <Cable className="w-4 h-4" />
          Connexion
        </TabsTrigger>
        <TabsTrigger
          value="services"
          className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2"
        >
          <Server className="w-4 h-4" />
          Services exposés
        </TabsTrigger>
      </TabsList>

      <TabsContent value="connection" className="space-y-6 mt-4">
        <ConnectionSettings section="mcp" />
      </TabsContent>

      <TabsContent value="services" className="mt-4">
        <McpServicesCatalog />
      </TabsContent>
    </Tabs>
  );
}

export default IntegrationsHubPage;
