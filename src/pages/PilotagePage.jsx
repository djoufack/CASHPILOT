import React, { useCallback, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePilotageData } from '@/hooks/usePilotageData';
import { useEntitlements } from '@/hooks/useEntitlements';
import { ENTITLEMENT_KEYS, filterEntitledItems } from '@/utils/subscriptionEntitlements';
import PilotageHeader from '@/components/pilotage/PilotageHeader';
import PilotageOverviewTab from '@/components/pilotage/PilotageOverviewTab';
import PilotageAccountingTab from '@/components/pilotage/PilotageAccountingTab';
import PilotageFinancialTab from '@/components/pilotage/PilotageFinancialTab';
import PilotageTaxValuationTab from '@/components/pilotage/PilotageTaxValuationTab';
import PilotageSimulatorTab from '@/components/pilotage/PilotageSimulatorTab';
import PilotageAuditTab from '@/components/pilotage/PilotageAuditTab';
import PilotageDataAvailabilityTab from '@/components/pilotage/PilotageDataAvailabilityTab';
import SnapshotShareDialog from '@/components/SnapshotShareDialog';
import { formatCurrency } from '@/utils/currencyService';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { formatDateInput, formatStartOfYearInput } from '@/utils/dateFormatting';
import {
  BarChart3,
  Eye,
  Calculator,
  TrendingUp,
  Building2,
  Play,
  ShieldCheck,
  DatabaseZap,
  PieChart,
} from 'lucide-react';

const PilotagePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasEntitlement } = useEntitlements();

  // Period state — default to current fiscal year (Jan 1 to today)
  const [startDate, setStartDate] = useState(() => {
    return formatStartOfYearInput();
  });
  const [endDate, setEndDate] = useState(() => {
    return formatDateInput();
  });

  // Region and sector selectors
  const [region, setRegion] = useState('france');
  const [sector, setSector] = useState('b2b_services');

  // Orchestrator hook
  const pilotageData = usePilotageData(startDate, endDate, sector, region);
  const effectiveRegion = pilotageData.region || region;
  const effectiveSector = pilotageData.sector || sector;
  const regionLocked = Boolean(pilotageData.regionSource && pilotageData.regionSource !== 'fallback');
  const companyCurrency = resolveAccountingCurrency(pilotageData.company);

  const tabs = useMemo(
    () => [
      { id: 'overview', label: t('pilotage.tabs.overview'), icon: Eye },
      { id: 'accounting', label: t('pilotage.tabs.accounting'), icon: Calculator },
      { id: 'financial', label: t('pilotage.tabs.financial'), icon: TrendingUp },
      { id: 'taxValuation', label: t('pilotage.tabs.taxValuation'), icon: Building2 },
      { id: 'simulator', label: t('pilotage.tabs.simulator'), icon: Play },
      { id: 'aiAudit', label: t('pilotage.tabs.aiAudit'), icon: ShieldCheck },
      { id: 'dataAvailability', label: t('pilotage.tabs.dataAvailability', 'Disponibilite'), icon: DatabaseZap },
      { id: 'analytics', label: t('nav.analytics'), icon: PieChart, featureKey: ENTITLEMENT_KEYS.ANALYTICS_REPORTS },
    ],
    [t]
  );
  const visibleTabs = useMemo(() => filterEntitledItems(tabs, hasEntitlement), [hasEntitlement, tabs]);
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const resolveTabFromSearch = useCallback((value) => (tabIds.has(value) ? value : 'overview'), [tabIds]);

  const [activeTab, setActiveTab] = useState(() => resolveTabFromSearch(searchParams.get('tab')));

  React.useEffect(() => {
    const nextTab = resolveTabFromSearch(searchParams.get('tab'));
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [resolveTabFromSearch, searchParams]);

  const handleTabChange = useCallback(
    (nextTab) => {
      if (nextTab === 'analytics') {
        navigate('/app/analytics');
        return;
      }

      setActiveTab(nextTab);
      const nextParams = new URLSearchParams(searchParams);
      if (nextTab === 'overview') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', nextTab);
      }
      setSearchParams(nextParams, { replace: true });
    },
    [navigate, searchParams, setSearchParams]
  );

  const pilotageSnapshotData = useMemo(
    () => ({
      module: 'pilotage',
      title: t('pilotage.title'),
      companyName: pilotageData.company?.company_name || t('app.name'),
      currency: companyCurrency,
      generatedAt: new Date().toISOString(),
      period: {
        startDate,
        endDate,
        label: `${startDate} - ${endDate}`,
      },
      scope: {
        region: effectiveRegion,
        sector: effectiveSector,
      },
      summaryCards: [
        {
          label: t('pilotage.snapshot.revenue'),
          value: formatCurrency(pilotageData.revenue || 0, companyCurrency),
          hint: t('pilotage.snapshot.revenueHint'),
          accentClass: 'text-emerald-300',
        },
        {
          label: t('pilotage.snapshot.expenses'),
          value: formatCurrency(pilotageData.totalExpenses || 0, companyCurrency),
          hint: t('pilotage.snapshot.expensesHint'),
          accentClass: 'text-rose-300',
        },
        {
          label: t('pilotage.snapshot.netIncome'),
          value: formatCurrency(pilotageData.netIncome || 0, companyCurrency),
          hint: t('pilotage.snapshot.netIncomeHint'),
          accentClass: 'text-sky-300',
        },
        {
          label: t('pilotage.snapshot.netCashFlow'),
          value: formatCurrency(pilotageData.cashFlow?.summary?.net || 0, companyCurrency),
          hint: t('pilotage.snapshot.netCashFlowHint'),
          accentClass: 'text-orange-300',
        },
      ],
      signalCards: [
        {
          label: t('pilotage.snapshot.datasetStatus'),
          value: t(`pilotage.signal.status.${pilotageData.dataQuality?.datasetStatus || 'setup'}`),
          hint: `${pilotageData.dataQuality?.entriesCount || 0} ${t('pilotage.snapshot.entries')}`,
          accentClass: 'text-violet-300',
        },
        {
          label: t('pilotage.snapshot.alerts'),
          value: `${pilotageData.dataQuality?.criticalAlerts || 0} / ${pilotageData.dataQuality?.warningAlerts || 0}`,
          hint: t('pilotage.snapshot.alertsHint'),
          accentClass: 'text-amber-300',
        },
        {
          label: t('pilotage.snapshot.valuationMode'),
          value: t(`pilotage.signal.valuationMode.${pilotageData.dataQuality?.valuationMode || 'unavailable'}`),
          hint: pilotageData.dataQuality?.preTaxReady
            ? t('pilotage.snapshot.preTaxReady')
            : t('pilotage.snapshot.preTaxMissing'),
          accentClass: 'text-cyan-300',
        },
        {
          label: t('pilotage.snapshot.monthlyPoints'),
          value: String(pilotageData.dataQuality?.monthlyPoints || 0),
          hint: t('pilotage.snapshot.monthlyPointsHint'),
          accentClass: 'text-fuchsia-300',
        },
      ],
      alerts: (pilotageData.alerts || []).slice(0, 5).map((alert) => ({
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
      })),
      topIssues: pilotageData.dataQuality?.topIssues || [],
      dataQuality: {
        criticalAlerts: pilotageData.dataQuality?.criticalAlerts || 0,
        warningAlerts: pilotageData.dataQuality?.warningAlerts || 0,
        blockingIssues: pilotageData.dataQuality?.blockingIssues || 0,
        dataWarnings: pilotageData.dataQuality?.dataWarnings || 0,
        monthlyPoints: pilotageData.dataQuality?.monthlyPoints || 0,
        valuationMode: pilotageData.dataQuality?.valuationMode || 'unavailable',
        datasetStatus: pilotageData.dataQuality?.datasetStatus || 'setup',
      },
      activeTab,
    }),
    [
      activeTab,
      companyCurrency,
      effectiveRegion,
      effectiveSector,
      pilotageData.alerts,
      pilotageData.cashFlow?.summary?.net,
      pilotageData.company?.company_name,
      pilotageData.dataQuality?.blockingIssues,
      pilotageData.dataQuality?.criticalAlerts,
      pilotageData.dataQuality?.dataWarnings,
      pilotageData.dataQuality?.datasetStatus,
      pilotageData.dataQuality?.entriesCount,
      pilotageData.dataQuality?.monthlyPoints,
      pilotageData.dataQuality?.preTaxReady,
      pilotageData.dataQuality?.topIssues,
      pilotageData.dataQuality?.valuationMode,
      pilotageData.dataQuality?.warningAlerts,
      pilotageData.netIncome,
      pilotageData.revenue,
      pilotageData.totalExpenses,
      startDate,
      endDate,
      t,
    ]
  );

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6 space-y-6">
      <Helmet>
        <title>{t('pages.pilotage', 'Pilotage')} | CashPilot</title>
      </Helmet>
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <BarChart3 className="w-6 h-6 text-orange-400" />
          </div>
          <div className="flex-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">{t('pilotage.title')}</h1>
              <p className="text-sm text-gray-400">{t('pilotage.subtitle')}</p>
            </div>
            <div className="flex items-start justify-start md:justify-end">
              <SnapshotShareDialog
                snapshotType="pilotage"
                title={`${pilotageData.company?.company_name || t('app.name')} - ${t('pilotage.title')}`}
                snapshotData={pilotageSnapshotData}
                triggerClassName="border-gray-700"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab navigation — directly after title, above everything */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <TabsList className="w-full flex flex-wrap bg-gray-900/50 border border-gray-800/50 rounded-xl p-1 gap-1 h-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 px-3 py-2 text-sm data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 data-[state=active]:border-orange-500/30 data-[state=active]:border rounded-lg transition-all text-gray-400 hover:text-gray-200"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Header with selectors */}
        <PilotageHeader
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          region={effectiveRegion}
          onRegionChange={setRegion}
          regionLocked={regionLocked}
          sector={effectiveSector}
          onSectorChange={setSector}
        />

        {/* Loading state */}
        {pilotageData.loading && (
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/60 p-8">
            <div className="flex items-center gap-3 text-gray-300">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
              <div>
                <p className="font-medium">{t('loading.data')}</p>
                <p className="text-sm text-gray-500">{t('pilotage.signal.loadingDetail')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab content */}
        {!pilotageData.loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <TabsContent value="overview">
              <PilotageOverviewTab data={pilotageData} />
            </TabsContent>
            <TabsContent value="accounting">
              <PilotageAccountingTab data={pilotageData} sector={effectiveSector} />
            </TabsContent>
            <TabsContent value="financial">
              <PilotageFinancialTab data={pilotageData} />
            </TabsContent>
            <TabsContent value="taxValuation">
              <PilotageTaxValuationTab data={pilotageData} region={effectiveRegion} sector={effectiveSector} />
            </TabsContent>
            <TabsContent value="simulator">
              <PilotageSimulatorTab data={pilotageData} />
            </TabsContent>
            <TabsContent value="aiAudit">
              <PilotageAuditTab startDate={startDate} endDate={endDate} />
            </TabsContent>
            <TabsContent value="dataAvailability">
              <PilotageDataAvailabilityTab
                data={pilotageData}
                region={effectiveRegion}
                sector={effectiveSector}
                startDate={startDate}
                endDate={endDate}
              />
            </TabsContent>
          </motion.div>
        )}
      </Tabs>
    </div>
  );
};

export default PilotagePage;
