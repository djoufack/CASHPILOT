import { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useInterCompany } from '@/hooks/useInterCompany';
import InterCompanyLinksList from '@/components/intercompany/InterCompanyLinksList';
import TransferPricingPanel from '@/components/intercompany/TransferPricingPanel';
import EliminationSummary from '@/components/intercompany/EliminationSummary';
import { Button } from '@/components/ui/button';
import { Building2, ArrowLeftRight, RefreshCw, Loader2, Link2, Receipt, Scale, Scissors, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const TAB_KEYS = ['links', 'transactions', 'pricing', 'eliminations'];

const TAB_ICONS = {
  links: Link2,
  transactions: Receipt,
  pricing: Scale,
  eliminations: Scissors,
};

const InterCompanyPage = () => {
  const { t } = useTranslation();
  const {
    links,
    transactions,
    pricingRules,
    eliminations,
    loading,
    fetchData,
    createLink,
    toggleLink,
    deleteLink,
    updatePricingRule,
    deletePricingRule,
    computeEliminations,
    autoComputeEliminations,
  } = useInterCompany();

  const [activeTab, setActiveTab] = useState('links');
  const [computing, setComputing] = useState(false);
  const [autoComputing, setAutoComputing] = useState(false);

  // KPIs
  const linkedCompanies = links.filter((l) => l.is_active).length;
  const pendingSyncs = transactions.filter((tx) => tx.status === 'pending').length;
  const eliminationTotal = useMemo(
    () => eliminations.reduce((sum, e) => sum + Number(e.eliminated_amount || 0), 0),
    [eliminations]
  );
  const activeRules = pricingRules.filter((r) => r.is_active).length;

  const handleRefresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const handleComputeEliminations = useCallback(async () => {
    setComputing(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      await computeEliminations(startOfMonth, endOfMonth, null, { status: 'applied' });
    } finally {
      setComputing(false);
    }
  }, [computeEliminations]);

  const handleAutoComputeEliminations = useCallback(async () => {
    setAutoComputing(true);
    try {
      await autoComputeEliminations();
    } finally {
      setAutoComputing(false);
    }
  }, [autoComputeEliminations]);

  const kpis = [
    {
      label: t('intercompany.kpi.linkedCompanies', 'Sociétés liées'),
      value: linkedCompanies,
      icon: Link2,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: t('intercompany.kpi.pendingSyncs', 'Synchros en attente'),
      value: pendingSyncs,
      icon: ArrowLeftRight,
      color: 'from-amber-500 to-orange-500',
    },
    {
      label: t('intercompany.kpi.eliminationTotal', 'Total éliminé'),
      value: formatCurrency(eliminationTotal),
      icon: Scissors,
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: t('intercompany.kpi.activeRules', 'Règles actives'),
      value: activeRules,
      icon: Scale,
      color: 'from-emerald-500 to-teal-500',
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t('intercompany.pageTitle', 'Inter-Sociétés')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {t('intercompany.pageTitle', 'Inter-Sociétés')}
                </h1>
                <ArrowLeftRight className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-sm text-gray-400">
                {t('intercompany.pageDescription', 'Factures inter-sociétés, prix de transfert et éliminations')}
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
              {t('intercompany.refresh', 'Actualiser')}
            </Button>
            <Button
              size="sm"
              onClick={handleComputeEliminations}
              disabled={computing || autoComputing || loading}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-0"
            >
              {computing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scissors className="w-4 h-4 mr-2" />}
              {computing
                ? t('intercompany.computing', 'Calcul en cours...')
                : t('intercompany.computeEliminations', 'Calculer les éliminations')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutoComputeEliminations}
              disabled={computing || autoComputing || loading}
              className="border-cyan-500/50 text-cyan-100 hover:bg-cyan-500/10"
              data-testid="intercompany-auto-elimination-button"
            >
              {autoComputing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {autoComputing
                ? t('intercompany.autoComputing', 'Automatisation...')
                : t('intercompany.autoComputeEliminations', 'Auto-appliquer les éliminations')}
            </Button>
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
        <div className="flex items-center gap-1 bg-[#0a0e1a] rounded-xl p-1 border border-white/5 overflow-x-auto">
          {TAB_KEYS.map((tabKey) => {
            const TabIcon = TAB_ICONS[tabKey];
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tabKey ? 'bg-[#141c33] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {t(`intercompany.tabs.${tabKey}`, tabKey)}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'links' && (
          <InterCompanyLinksList
            links={links}
            onToggle={toggleLink}
            onDelete={deleteLink}
            onAdd={createLink}
            loading={loading}
          />
        )}

        {activeTab === 'transactions' && (
          <div className="rounded-xl border border-white/10 bg-[#0f1528]/80 backdrop-blur-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {t('intercompany.transactions.title', 'Transactions inter-sociétés')}
            </h3>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {t('intercompany.transactions.empty', 'Aucune transaction inter-sociétés')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400">
                      <th className="text-left py-3 px-2">{t('intercompany.transactions.type', 'Type')}</th>
                      <th className="text-left py-3 px-2">{t('intercompany.transactions.company', 'Société')}</th>
                      <th className="text-right py-3 px-2">{t('intercompany.transactions.amount', 'Montant')}</th>
                      <th className="text-left py-3 px-2">{t('intercompany.transactions.status', 'Statut')}</th>
                      <th className="text-left py-3 px-2">{t('intercompany.transactions.date', 'Date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 50).map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-gray-300">{tx.linked_company_id?.slice(0, 8)}...</td>
                        <td className="py-3 px-2 text-right font-mono text-white">
                          {formatCurrency(tx.amount, tx.currency)}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              tx.status === 'synced'
                                ? 'bg-green-500/20 text-green-300'
                                : tx.status === 'eliminated'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pricing' && (
          <TransferPricingPanel
            rules={pricingRules}
            onUpdate={updatePricingRule}
            onDelete={deletePricingRule}
            loading={loading}
          />
        )}

        {activeTab === 'eliminations' && <EliminationSummary eliminations={eliminations} loading={loading} />}
      </div>
    </>
  );
};

export default InterCompanyPage;
