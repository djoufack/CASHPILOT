import { useState, useCallback, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useOpenApi } from '@/hooks/useOpenApi';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useApiKeySecurityPolicy } from '@/hooks/useApiKeySecurityPolicy';
import { buildApiKeySecurityInsights } from '@/services/apiKeySecurityInsights';
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

const TAB_LABELS = {
  keys: 'Clés',
  marketplace: 'Marketplace',
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
  const {
    policy,
    loading: policyLoading,
    error: policyError,
    refresh: refreshPolicy,
    updatePolicy,
    defaultPolicy,
  } = useApiKeySecurityPolicy();

  const loading = apiLoading || marketplaceLoading;
  const [activeTab, setActiveTab] = useState('keys');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['read']);
  const [creating, setCreating] = useState(false);
  const [plainKeys, setPlainKeys] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState({
    allowed_scopes: defaultPolicy.allowed_scopes,
    rotation_days: defaultPolicy.rotation_days,
    anomaly_hourly_call_threshold: defaultPolicy.anomaly_hourly_call_threshold,
    anomaly_error_rate_threshold: defaultPolicy.anomaly_error_rate_threshold,
    notify_on_anomaly: defaultPolicy.notify_on_anomaly,
  });

  useEffect(() => {
    setPolicyDraft({
      allowed_scopes: Array.isArray(policy.allowed_scopes) ? policy.allowed_scopes : [...defaultPolicy.allowed_scopes],
      rotation_days: policy.rotation_days ?? defaultPolicy.rotation_days,
      anomaly_hourly_call_threshold:
        policy.anomaly_hourly_call_threshold ?? defaultPolicy.anomaly_hourly_call_threshold,
      anomaly_error_rate_threshold: policy.anomaly_error_rate_threshold ?? defaultPolicy.anomaly_error_rate_threshold,
      notify_on_anomaly: policy.notify_on_anomaly ?? defaultPolicy.notify_on_anomaly,
    });
  }, [defaultPolicy, policy]);

  const securityInsights = useMemo(
    () =>
      buildApiKeySecurityInsights({
        apiKeys,
        usageLogs,
        policy,
      }),
    [apiKeys, usageLogs, policy]
  );

  const handleRefresh = useCallback(async () => {
    await fetchUsage();
    await refreshPolicy();
  }, [fetchUsage, refreshPolicy]);

  const allowedScopes = useMemo(
    () => (Array.isArray(policy.allowed_scopes) && policy.allowed_scopes.length ? policy.allowed_scopes : ['read']),
    [policy.allowed_scopes]
  );

  useEffect(() => {
    setNewKeyScopes((previous) => {
      const filtered = previous.filter((scope) => allowedScopes.includes(scope));
      if (filtered.length === previous.length) return previous;
      return filtered.length > 0 ? filtered : ['read'].filter((scope) => allowedScopes.includes(scope));
    });
  }, [allowedScopes]);

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

  const handlePolicyScopeToggle = useCallback((scope) => {
    setPolicyDraft((previous) => {
      const currentlyEnabled = previous.allowed_scopes.includes(scope);
      const nextScopes = currentlyEnabled
        ? previous.allowed_scopes.filter((item) => item !== scope)
        : [...previous.allowed_scopes, scope];

      if (!nextScopes.includes('read')) {
        nextScopes.push('read');
      }

      return {
        ...previous,
        allowed_scopes: Array.from(new Set(nextScopes)),
      };
    });
  }, []);

  const handleSavePolicy = useCallback(async () => {
    setSavingPolicy(true);
    try {
      await updatePolicy({
        allowed_scopes: policyDraft.allowed_scopes,
        rotation_days: Number(policyDraft.rotation_days),
        anomaly_hourly_call_threshold: Number(policyDraft.anomaly_hourly_call_threshold),
        anomaly_error_rate_threshold: Number(policyDraft.anomaly_error_rate_threshold),
        notify_on_anomaly: Boolean(policyDraft.notify_on_anomaly),
      });
    } finally {
      setSavingPolicy(false);
    }
  }, [policyDraft, updatePolicy]);

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
                {t(`api.tabs.${tabKey}`, { defaultValue: TAB_LABELS[tabKey] || tabKey })}
              </button>
            );
          })}
        </div>

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            {/* Usage Chart */}
            <ApiUsageChart usageLogs={usageLogs} loading={loading} />

            <div
              className="rounded-xl border border-white/10 bg-[#0f1528]/80 backdrop-blur-sm p-6 space-y-5"
              data-testid="api-key-security-policy-panel"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Politique de securite API</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Scope whitelist, rotation des cles et detection d anomalies de trafic.
                  </p>
                </div>
                <div
                  className={`text-xs px-2.5 py-1 rounded-full border w-fit ${
                    securityInsights.status === 'ready'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : securityInsights.status === 'attention'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}
                >
                  {securityInsights.status}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Cles a rotation</p>
                  <p className="text-xl font-semibold text-white mt-1">{securityInsights.rotationDueCount}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Anomalies detectees</p>
                  <p className="text-xl font-semibold text-white mt-1">{securityInsights.anomalyCount}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Scopes autorises</p>
                  <p className="text-xl font-semibold text-white mt-1">{allowedScopes.join(', ')}</p>
                </div>
              </div>

              {securityInsights.recommendations.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100 text-sm">
                  <p className="font-medium mb-1">Recommandations</p>
                  <ul className="space-y-1 text-xs">
                    {securityInsights.recommendations.map((recommendation) => (
                      <li key={recommendation}>• {recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}

              {policyError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {policyError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block text-sm text-gray-300">Scopes autorises</label>
                  <div className="flex gap-2 flex-wrap">
                    {scopeOptions.map((scope) => {
                      const enabled = policyDraft.allowed_scopes.includes(scope);
                      const locked = scope === 'read';
                      return (
                        <button
                          key={`policy-scope-${scope}`}
                          type="button"
                          disabled={locked}
                          onClick={() => handlePolicyScopeToggle(scope)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            enabled
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-white/5 text-gray-500 border border-white/10'
                          } ${locked ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                          {scope}
                        </button>
                      );
                    })}
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={Boolean(policyDraft.notify_on_anomaly)}
                      onChange={(event) =>
                        setPolicyDraft((previous) => ({ ...previous, notify_on_anomaly: event.target.checked }))
                      }
                      className="rounded border-white/20 bg-[#0a0e1a]"
                    />
                    Notifier en cas d anomalie
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Rotation (jours)</label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={policyDraft.rotation_days}
                      onChange={(event) =>
                        setPolicyDraft((previous) => ({ ...previous, rotation_days: event.target.value }))
                      }
                      className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Seuil appels/h</label>
                    <input
                      type="number"
                      min={1}
                      value={policyDraft.anomaly_hourly_call_threshold}
                      onChange={(event) =>
                        setPolicyDraft((previous) => ({
                          ...previous,
                          anomaly_hourly_call_threshold: event.target.value,
                        }))
                      }
                      className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Seuil erreur (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={policyDraft.anomaly_error_rate_threshold}
                      onChange={(event) =>
                        setPolicyDraft((previous) => ({
                          ...previous,
                          anomaly_error_rate_threshold: event.target.value,
                        }))
                      }
                      className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSavePolicy}
                  disabled={savingPolicy || policyLoading}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {savingPolicy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Enregistrer la politique
                </Button>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-medium text-white mb-2">Anomalies detectees (1h)</p>
                {securityInsights.anomalies.length === 0 ? (
                  <p className="text-xs text-gray-500">Aucune anomalie detectee sur la fenetre recente.</p>
                ) : (
                  <div className="space-y-2">
                    {securityInsights.anomalies.map((anomaly) => (
                      <div
                        key={`${anomaly.apiKeyId}-${anomaly.reason}`}
                        className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                      >
                        <p className="font-medium">
                          {anomaly.keyName} ({anomaly.keyPrefix || anomaly.apiKeyId})
                        </p>
                        <p className="mt-1 opacity-90">{anomaly.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* API Keys List */}
            <div className="rounded-xl border border-white/10 bg-[#0f1528]/80 backdrop-blur-sm p-6">
              <h3 className="text-lg font-semibold text-white mb-4">{t('api.keySection.title', 'Vos clés API')}</h3>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {t('api.keySection.empty', 'Aucune clé API. Créez-en une pour commencer.')}
                  </p>
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
                        type="button"
                        disabled={!allowedScopes.includes(scope)}
                        onClick={() =>
                          setNewKeyScopes((prev) =>
                            prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          newKeyScopes.includes(scope)
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        } ${!allowedScopes.includes(scope) ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCreateKey}
                  disabled={creating || !newKeyName.trim() || newKeyScopes.length === 0}
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
