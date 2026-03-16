import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useRegulatoryIntel } from '@/hooks/useRegulatoryIntel';
import RegulatoryUpdateCard from '@/components/regulatory/RegulatoryUpdateCard';
import ComplianceChecklist from '@/components/regulatory/ComplianceChecklist';
import RegulatorySubscriptions from '@/components/regulatory/RegulatorySubscriptions';
import {
  Shield,
  RefreshCw,
  Loader2,
  AlertTriangle,
  AlertOctagon,
  ClipboardList,
  Globe,
  Bell,
  ListChecks,
  Settings2,
} from 'lucide-react';

const TAB_KEYS = ['updates', 'checklists', 'subscriptions'];

const TAB_ICONS = {
  updates: Bell,
  checklists: ListChecks,
  subscriptions: Settings2,
};

const RegulatoryIntelPage = () => {
  const { t } = useTranslation();
  const {
    updates,
    checklists,
    subscriptions,
    loading,
    error,
    scanForUpdates,
    markUpdate,
    toggleChecklist,
    updateSubscription,
    fetchUpdates,
    fetchChecklists,
    fetchSubscriptions,
  } = useRegulatoryIntel();

  const [activeTab, setActiveTab] = useState('updates');
  const [scanning, setScanning] = useState(false);

  // Compute KPIs
  const newUpdates = updates.filter((u) => u.status === 'new').length;
  const criticalAlerts = updates.filter((u) => u.severity === 'critical' && u.status !== 'dismissed').length;
  const pendingActions = checklists.filter((c) => !c.is_completed).length;
  const countriesMonitored = new Set((subscriptions || []).filter((s) => s.is_active).map((s) => s.country_code)).size;

  const handleRefresh = useCallback(() => {
    fetchUpdates();
    fetchChecklists();
    fetchSubscriptions();
  }, [fetchUpdates, fetchChecklists, fetchSubscriptions]);

  const handleScanAll = useCallback(async () => {
    setScanning(true);
    try {
      // Scan all active subscription countries
      const activeSubscriptions = (subscriptions || []).filter((s) => s.is_active);
      if (activeSubscriptions.length === 0) {
        // If no subscriptions, scan a default set
        await scanForUpdates('FR');
      } else {
        for (const sub of activeSubscriptions) {
          await scanForUpdates(sub.country_code);
        }
      }
    } finally {
      setScanning(false);
    }
  }, [subscriptions, scanForUpdates]);

  const handleMarkUpdate = useCallback(
    async (updateId, status) => {
      await markUpdate(updateId, status);
    },
    [markUpdate]
  );

  const handleDismiss = useCallback(
    async (updateId) => {
      await markUpdate(updateId, 'dismissed');
    },
    [markUpdate]
  );

  const handleToggleChecklist = useCallback(
    async (itemId, isCompleted) => {
      await toggleChecklist(itemId, isCompleted);
    },
    [toggleChecklist]
  );

  const handleUpdateSubscription = useCallback(
    async (countryCode, data) => {
      await updateSubscription(countryCode, data);
    },
    [updateSubscription]
  );

  return (
    <>
      <Helmet>
        <title>{t('regulatory.page.title', 'Veille Reglementaire')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {t('regulatory.page.title', 'Veille Reglementaire')}
              </h1>
              <p className="text-sm text-gray-400">
                {t('regulatory.page.description', 'Surveillance automatisee des evolutions reglementaires par pays')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleScanAll}
              disabled={scanning || loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-colors disabled:opacity-50"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('regulatory.page.scanNow', 'Scanner maintenant')}
            </button>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#141c33] hover:bg-gray-700/50 text-white border border-gray-700/50 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('regulatory.page.refresh', 'Actualiser')}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>
        )}

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* New Updates */}
          <div className="bg-[#0f1528]/80 border border-blue-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('regulatory.kpi.newUpdates', 'Nouvelles mises a jour')}</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-blue-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-white">
              {loading && updates.length === 0 ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500 inline-block" />
              ) : (
                newUpdates
              )}
            </p>
          </div>

          {/* Critical Alerts */}
          <div className="bg-[#0f1528]/80 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('regulatory.kpi.criticalAlerts', 'Alertes critiques')}</span>
              <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-red-400">
              {loading && updates.length === 0 ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500 inline-block" />
              ) : (
                criticalAlerts
              )}
            </p>
          </div>

          {/* Pending Actions */}
          <div className="bg-[#0f1528]/80 border border-amber-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('regulatory.kpi.pendingActions', 'Actions en attente')}</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-amber-400">
              {loading && checklists.length === 0 ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500 inline-block" />
              ) : (
                pendingActions
              )}
            </p>
          </div>

          {/* Countries Monitored */}
          <div className="bg-[#0f1528]/80 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('regulatory.kpi.countriesMonitored', 'Pays surveilles')}</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-400">
              {loading && subscriptions.length === 0 ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500 inline-block" />
              ) : (
                countriesMonitored
              )}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-[#141c33] rounded-lg border border-gray-700/50 overflow-hidden w-fit">
          {TAB_KEYS.map((tab) => {
            const TabIcon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {t(`regulatory.tabs.${tab}`, tab)}
              </button>
            );
          })}
        </div>

        {/* ============================================ */}
        {/* Tab: Recent Updates                          */}
        {/* ============================================ */}
        {activeTab === 'updates' && (
          <div className="space-y-4">
            {loading && updates.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : updates.length === 0 ? (
              <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-8 backdrop-blur-sm text-center">
                <AlertTriangle className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-60" />
                <h3 className="text-lg font-semibold text-white mb-1">
                  {t('regulatory.updates.empty', 'Aucune mise a jour')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('regulatory.updates.emptyDesc', 'Lancez un scan pour detecter les evolutions reglementaires.')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {updates.map((update) => (
                  <RegulatoryUpdateCard
                    key={update.id}
                    update={update}
                    onMark={handleMarkUpdate}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* Tab: Compliance Checklists                   */}
        {/* ============================================ */}
        {activeTab === 'checklists' && (
          <ComplianceChecklist items={checklists} onToggle={handleToggleChecklist} loading={loading} />
        )}

        {/* ============================================ */}
        {/* Tab: Subscriptions                           */}
        {/* ============================================ */}
        {activeTab === 'subscriptions' && (
          <RegulatorySubscriptions subscriptions={subscriptions} onUpdate={handleUpdateSubscription} />
        )}
      </div>
    </>
  );
};

export default RegulatoryIntelPage;
