import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSmartDunning } from '@/hooks/useSmartDunning';
import DunningPipeline from '@/components/dunning/DunningPipeline';
import DunningScoreCard from '@/components/dunning/DunningScoreCard';
import DunningCampaignCard from '@/components/dunning/DunningCampaignCard';
import DunningCampaignForm from '@/components/dunning/DunningCampaignForm';
import { Button } from '@/components/ui/button';
import {
  Brain,
  RefreshCw,
  Loader2,
  Target,
  TrendingUp,
  Plus,
  BarChart3,
  CheckCircle2,
  Activity,
  GitBranch,
  Users,
} from 'lucide-react';

const TAB_KEYS = ['pipeline', 'campaigns', 'scores'];

const TAB_ICONS = {
  pipeline: GitBranch,
  campaigns: BarChart3,
  scores: Users,
};

const formatMoney = (value) => {
  if (value == null) return '0,00';
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const SmartDunningPage = () => {
  const { t } = useTranslation();
  const {
    campaigns,
    executions,
    clientScores,
    stats,
    loading,
    error,
    fetchCampaigns,
    fetchExecutions,
    fetchClientScores,
    createCampaign,
    launchDunning,
    toggleCampaign,
  } = useSmartDunning();

  const [activeTab, setActiveTab] = useState('pipeline');
  const [showCampaignForm, setShowCampaignForm] = useState(false);

  const handleRefresh = useCallback(() => {
    fetchClientScores();
    fetchCampaigns();
    fetchExecutions();
  }, [fetchClientScores, fetchCampaigns, fetchExecutions]);

  const handleCreateCampaign = useCallback(
    async (campaignData, templates) => {
      const result = await createCampaign(campaignData, templates);
      if (result) {
        setShowCampaignForm(false);
      }
    },
    [createCampaign]
  );

  const handleLaunchCampaign = useCallback(
    async (campaign) => {
      // Launch dunning for all overdue invoices matching this campaign's channels
      // In a real scenario, this would batch-send to all matching clients.
      // For now, trigger for the first overdue client score if available.
      if (clientScores.length > 0) {
        const firstScore = clientScores[0];
        await launchDunning({
          campaign_id: campaign.id,
          invoice_id: firstScore.invoiceId,
          client_id: firstScore.clientId,
          channel: firstScore.recommendedChannel || campaign.channels?.[0] || 'email',
          tone: firstScore.recommendedTone || 'professional',
          step_number: firstScore.recommendedStep || 1,
          ai_score: firstScore.score,
        });
      }
    },
    [launchDunning, clientScores]
  );

  const handleToggleCampaign = useCallback(
    async (campaignId, isActive) => {
      await toggleCampaign(campaignId, isActive);
    },
    [toggleCampaign]
  );

  return (
    <>
      <Helmet>
        <title>{t('dunning.page.title', 'Relances Intelligentes')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {t('dunning.page.title', 'Relances Intelligentes')}
              </h1>
              <p className="text-sm text-gray-400">
                {t('dunning.page.description', 'Relances personnalisees par canal avec timing optimise par IA')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setActiveTab('campaigns');
                setShowCampaignForm(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('dunning.campaigns.create', 'Nouvelle campagne')}
            </Button>

            <Button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-[#141c33] hover:bg-gray-700/50 text-white border border-gray-700/50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {t('dunning.page.refresh', 'Actualiser')}
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>
        )}

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Overdue */}
          <div className="bg-[#0f1528]/80 border border-orange-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('dunning.kpi.totalOverdue', 'Montant en retard')}</span>
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-orange-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-white">
              {loading && !stats.totalOverdue ? (
                <span className="inline-block">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </span>
              ) : (
                `${formatMoney(stats.totalOverdue)} EUR`
              )}
            </p>
          </div>

          {/* Recovered Amount */}
          <div className="bg-[#0f1528]/80 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('dunning.kpi.recoveredAmount', 'Montant recouvre')}</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-400">
              {loading && !stats.recoveredAmount ? (
                <span className="inline-block">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </span>
              ) : (
                `${formatMoney(stats.recoveredAmount)} EUR`
              )}
            </p>
          </div>

          {/* Recovery Rate */}
          <div className="bg-[#0f1528]/80 border border-blue-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('dunning.kpi.recoveryRate', 'Taux recouvrement')}</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-blue-400">
              {loading && !stats.recoveryRate ? (
                <span className="inline-block">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </span>
              ) : (
                `${stats.recoveryRate ?? 0}%`
              )}
            </p>
          </div>

          {/* Active Campaigns */}
          <div className="bg-[#0f1528]/80 border border-purple-500/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('dunning.kpi.activeCampaigns', 'Campagnes actives')}</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-white">
              {loading && !stats.activeCampaigns ? (
                <span className="inline-block">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </span>
              ) : (
                (stats.activeCampaigns ?? 0)
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
                  activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {t(`dunning.tabs.${tab}`, tab)}
              </button>
            );
          })}
        </div>

        {/* ============================================ */}
        {/* Tab: Pipeline                                */}
        {/* ============================================ */}
        {activeTab === 'pipeline' && <DunningPipeline executions={executions} loading={loading} />}

        {/* ============================================ */}
        {/* Tab: Campaigns                               */}
        {/* ============================================ */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            {/* Campaign Form */}
            {showCampaignForm ? (
              <DunningCampaignForm
                onSubmit={handleCreateCampaign}
                onCancel={() => setShowCampaignForm(false)}
                loading={loading}
              />
            ) : (
              <Button
                onClick={() => setShowCampaignForm(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('dunning.campaigns.create', 'Nouvelle campagne')}
              </Button>
            )}

            {/* Campaign Cards Grid */}
            {loading && campaigns.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-8 backdrop-blur-sm text-center">
                <BarChart3 className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-60" />
                <h3 className="text-lg font-semibold text-white mb-1">
                  {t('dunning.campaigns.empty', 'Aucune campagne')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('dunning.campaigns.emptyDesc', 'Creez votre premiere campagne de relance automatisee.')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map((campaign) => (
                  <DunningCampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onLaunch={handleLaunchCampaign}
                    onToggle={handleToggleCampaign}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* Tab: Client Scores                           */}
        {/* ============================================ */}
        {activeTab === 'scores' && <DunningScoreCard scores={clientScores} loading={loading} />}
      </div>
    </>
  );
};

export default SmartDunningPage;
