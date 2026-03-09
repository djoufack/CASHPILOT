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
            <ConnectionSettings section="mcp" />

            {/* MCP Server Status & Restart */}
            <div className="rounded-xl border border-white/10 bg-slate-900/80 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Server className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">Serveur MCP</h3>
                    <p className="text-xs text-slate-400">https://cashpilot.tech/mcp</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {serverStatus === 'online' && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      En ligne
                    </span>
                  )}
                  {serverStatus === 'offline' && (
                    <span className="flex items-center gap-1.5 text-xs text-red-400">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      Hors ligne
                    </span>
                  )}
                  <Button
                    onClick={handleMcpPing}
                    disabled={pinging}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    {pinging ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Tester la connexion
                  </Button>
                </div>
              </div>
            </div>
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
