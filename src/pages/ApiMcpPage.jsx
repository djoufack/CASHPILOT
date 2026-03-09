import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Globe, Terminal, Server, Cable, Key, Webhook, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import ConnectionSettings from '@/components/settings/ConnectionSettings';
import McpServicesCatalog from '@/components/settings/McpServicesCatalog';

const ApiMcpPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('api');
  const [pinging, setPinging] = useState(false);
  const [serverStatus, setServerStatus] = useState(null); // null | 'online' | 'offline'

  const handleMcpPing = async () => {
    setPinging(true);
    setServerStatus(null);
    try {
      const res = await fetch('https://cashpilot.tech/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 'restart-check' }),
      });
      if (res.ok) {
        setServerStatus('online');
        toast({ title: 'Serveur MCP en ligne', description: 'Le serveur répond correctement.' });
      } else {
        setServerStatus('offline');
        toast({ title: 'Serveur MCP indisponible', description: `Erreur HTTP ${res.status}`, variant: 'destructive' });
      }
    } catch (err) {
      setServerStatus('offline');
      toast({ title: 'Serveur MCP injoignable', description: err.message, variant: 'destructive' });
    } finally {
      setPinging(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>API - Webhook - MCP - CashPilot</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 md:px-8 space-y-8 min-h-screen text-white">
        {/* Hero header */}
        <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.15),_transparent_30%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 max-w-3xl">
              <Badge className="bg-white/10 text-orange-200 border-white/10">API - Webhook - MCP</Badge>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-400/10 p-3 ring-1 ring-orange-300/20">
                  <Cable className="w-7 h-7 text-orange-300" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">API - Webhook - MCP</h1>
                  <p className="mt-2 text-sm md:text-base text-slate-300">
                    Générez vos clés API, configurez vos clients MCP et explorez les outils disponibles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-900/80 border border-white/10 p-1 h-auto">
            <TabsTrigger
              value="api"
              className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2.5"
            >
              <Key className="w-4 h-4" />
              Générer API
            </TabsTrigger>
            <TabsTrigger
              value="mcp"
              className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2.5"
            >
              <Terminal className="w-4 h-4" />
              Générer Client MCP
            </TabsTrigger>
            <TabsTrigger
              value="tools"
              className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300 data-[state=active]:shadow-none text-slate-400 gap-2 px-4 py-2.5"
            >
              <Server className="w-4 h-4" />
              Liste des outils Clients MCP
            </TabsTrigger>
          </TabsList>

          {/* ============ TAB 1: Générer API ============ */}
          <TabsContent value="api" className="space-y-6">
            <ConnectionSettings section="api" />
          </TabsContent>

          {/* ============ TAB 2: Générer Client MCP ============ */}
          <TabsContent value="mcp" className="space-y-6">
            {/* MCP Server Status — prominent banner */}
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-900/30 via-slate-900/80 to-cyan-900/30 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/15 rounded-xl ring-1 ring-emerald-400/30">
                    <Server className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Serveur MCP Production</h3>
                    <p className="text-sm text-slate-400 font-mono">https://cashpilot.tech/mcp</p>
                  </div>
                  {serverStatus === 'online' && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-sm px-3 py-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse mr-2 inline-block" />
                      En ligne
                    </Badge>
                  )}
                  {serverStatus === 'offline' && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-sm px-3 py-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400 mr-2 inline-block" />
                      Hors ligne
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={handleMcpPing}
                  disabled={pinging}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-base px-6 py-3 shadow-lg shadow-emerald-900/40"
                >
                  {pinging ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  Tester la connexion
                </Button>
              </div>
            </div>

            <ConnectionSettings section="mcp" />
          </TabsContent>

          {/* ============ TAB 3: Liste des outils Clients MCP ============ */}
          <TabsContent value="tools" className="space-y-6">
            <McpServicesCatalog />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ApiMcpPage;
