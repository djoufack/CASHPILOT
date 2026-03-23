import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useOpenApi } from '@/hooks/useOpenApi';
import { useMarketplace } from '@/hooks/useMarketplace';
import ApiKeyCard from '@/components/api/ApiKeyCard';
import ApiUsageChart from '@/components/api/ApiUsageChart';
import AppCard from '@/components/marketplace/AppCard';
import { Button } from '@/components/ui/button';
import { Code2, RefreshCw, Loader2, Plus, Key, BarChart3, Store, X } from 'lucide-react';

const TAB_KEYS = ['keys', 'marketplace'];

const TAB_ICONS = {
  keys: Key,
  marketplace: Store,
};

const OpenApiPage = () => {
  const { t } = useTranslation();
  const {
    apiKeys,
    usageLogs,
    usageStats,
    loading: apiLoading,
    createKey,
    deleteKey,
    toggleKey,
    fetchUsage,
  } = useOpenApi();

  const { apps, installedApps, loading: marketplaceLoading, installApp, uninstallApp } = useMarketplace();

  const loading = apiLoading || marketplaceLoading;
  const [activeTab, setActiveTab] = useState('keys');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['read']);
  const [creating, setCreating] = useState(false);
  const [plainKeys, setPlainKeys] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = useCallback(async () => {
    await fetchUsage();
  }, [fetchUsage]);

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const result = await createKey({
        keyName: newKeyName.trim(),
        scopes: newKeyScopes,
        rateLimit: 100,
      });
      if (result?.id && result?._plainKey) {
        setPlainKeys((prev) => ({
          ...prev,
          [result.id]: result._plainKey,
        }));
      }
      setNewKeyName('');
      setShowCreateDialog(false);
    } finally {
      setCreating(false);
    }
  }, [createKey, newKeyName, newKeyScopes]);

  const handleCopyKey = useCallback((keyId, plainKey) => {
    if (!plainKey) return;
    navigator.clipboard.writeText(plainKey);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 3000);
  }, []);

  const installedAppIds = new Set((installedApps || []).map((ia) => ia.app_id));
  const filteredApps = (apps || []).filter(
    (app) =>
      !searchQuery ||
      app.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const kpis = [
    {
      label: t('api.kpi.totalKeys', 'Clés API'),
      value: apiKeys.length,
      icon: Key,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: t('api.kpi.totalCalls', 'Appels (7j)'),
      value: usageStats.totalCalls.toLocaleString(),
      icon: BarChart3,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      label: t('api.kpi.avgResponse', 'Temps moyen'),
      value: `${usageStats.avgResponseTime}ms`,
      icon: RefreshCw,
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: t('api.kpi.installedApps', 'Apps installées'),
      value: installedApps?.length || 0,
      icon: Store,
      color: 'from-amber-500 to-orange-500',
    },
  ];

  const scopeOptions = ['read', 'write', 'admin'];

  return (
    <>
      <Helmet>
        <title>{t('api.pageTitle', 'Open API & Marketplace')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {t('api.pageTitle', 'Open API & Marketplace')}
              </h1>
              <p className="text-sm text-gray-400">
                {t('api.pageDescription', 'Gérez vos clés API et explorez les extensions')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="text-gray-400 hover:text-white border border-gray-700/50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('api.refresh', 'Actualiser')}
            </Button>
            {activeTab === 'keys' && (
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('api.createKey', 'Nouvelle clé')}
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="rounded-xl border border-white/10 bg-[#0f1528]/80 backdrop-blur-sm p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs text-gray-400">{kpi.label}</span>
                </div>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#0a0e1a] rounded-xl p-1 border border-white/5">
          {TAB_KEYS.map((tabKey) => {
            const TabIcon = TAB_ICONS[tabKey];
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tabKey ? 'bg-[#141c33] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {t(`api.tabs.${tabKey}`, tabKey)}
              </button>
            );
          })}
        </div>

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            {/* Usage Chart */}
            <ApiUsageChart usageLogs={usageLogs} loading={loading} />

            {/* API Keys List */}
            <div className="rounded-xl border border-white/10 bg-[#0f1528]/80 backdrop-blur-sm p-6">
              <h3 className="text-lg font-semibold text-white mb-4">{t('api.keys.title', 'Vos clés API')}</h3>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">{t('api.keys.empty', 'Aucune clé API. Créez-en une pour commencer.')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <ApiKeyCard
                      key={key.id}
                      apiKey={key}
                      plainKey={plainKeys[key.id]}
                      onToggle={(isActive) => toggleKey(key.id, isActive)}
                      onDelete={() => deleteKey(key.id)}
                      onCopy={(plainKey) => handleCopyKey(key.id, plainKey)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Marketplace Tab */}
        {activeTab === 'marketplace' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder={t('api.marketplace.search', 'Rechercher une app...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Apps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  isInstalled={installedAppIds.has(app.id)}
                  onInstall={() => installApp(app.id)}
                  onUninstall={() => uninstallApp(app.id)}
                />
              ))}
            </div>

            {filteredApps.length === 0 && (
              <div className="text-center py-12">
                <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchQuery
                    ? t('api.marketplace.noResults', 'Aucune app trouvée')
                    : t('api.marketplace.empty', 'Marketplace vide pour le moment')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create Key Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#141c33] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{t('api.createDialog.title', 'Nouvelle clé API')}</h3>
                <button onClick={() => setShowCreateDialog(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {t('api.createDialog.name', 'Nom de la clé')}
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Mon application..."
                    className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {t('api.createDialog.scopes', 'Permissions')}
                  </label>
                  <div className="flex gap-2">
                    {scopeOptions.map((scope) => (
                      <button
                        key={scope}
                        onClick={() =>
                          setNewKeyScopes((prev) =>
                            prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          newKeyScopes.includes(scope)
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCreateKey}
                  disabled={creating || !newKeyName.trim()}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0"
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  {t('api.createDialog.submit', 'Créer la clé')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Copied Key Toast */}
        {copiedKeyId && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-300 text-sm backdrop-blur-sm">
            {t('api.keyCopied', 'Clé copiée dans le presse-papiers !')}
          </div>
        )}
      </div>
    </>
  );
};

export default OpenApiPage;
