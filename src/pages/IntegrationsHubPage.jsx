import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Bot, Building2, Cable, Globe, Puzzle, Webhook, Terminal, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountingConnectors from '@/components/settings/AccountingConnectors';
import McpServicesCatalog from '@/components/settings/McpServicesCatalog';

// Lazy import the sub-components from ConnectionSettings
import ConnectionSettings from '@/components/settings/ConnectionSettings';

const IntegrationsHubPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('api');

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
                  <p className="mt-2 text-sm md:text-base text-slate-300">
                    {t('integrationsHub.subtitle')}
                  </p>
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
