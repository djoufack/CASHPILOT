import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePilotageData } from '@/hooks/usePilotageData';
import PilotageHeader from '@/components/pilotage/PilotageHeader';
import PilotageOverviewTab from '@/components/pilotage/PilotageOverviewTab';
import PilotageAccountingTab from '@/components/pilotage/PilotageAccountingTab';
import PilotageFinancialTab from '@/components/pilotage/PilotageFinancialTab';
import PilotageTaxValuationTab from '@/components/pilotage/PilotageTaxValuationTab';
import PilotageSimulatorTab from '@/components/pilotage/PilotageSimulatorTab';
import PilotageAuditTab from '@/components/pilotage/PilotageAuditTab';
import { BarChart3, Eye, Calculator, TrendingUp, Building2, Play, ShieldCheck } from 'lucide-react';

const PilotagePage = () => {
  const { t } = useTranslation();

  // Period state — default to current fiscal year (Jan 1 to today)
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Region and sector selectors
  const [region, setRegion] = useState('france');
  const [sector, setSector] = useState('b2b_services');

  // Active tab
  const [activeTab, setActiveTab] = useState('overview');

  // Orchestrator hook
  const pilotageData = usePilotageData(startDate, endDate, sector, region);

  const tabs = useMemo(() => [
    { id: 'overview', label: t('pilotage.tabs.overview'), icon: Eye },
    { id: 'accounting', label: t('pilotage.tabs.accounting'), icon: Calculator },
    { id: 'financial', label: t('pilotage.tabs.financial'), icon: TrendingUp },
    { id: 'taxValuation', label: t('pilotage.tabs.taxValuation'), icon: Building2 },
    { id: 'simulator', label: t('pilotage.tabs.simulator'), icon: Play },
    { id: 'aiAudit', label: t('pilotage.tabs.aiAudit'), icon: ShieldCheck },
  ], [t]);

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6 space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <BarChart3 className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{t('pilotage.title')}</h1>
            <p className="text-sm text-gray-400">{t('pilotage.subtitle')}</p>
          </div>
        </div>
      </motion.div>

      {/* Header with selectors */}
      <PilotageHeader
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        region={region}
        onRegionChange={setRegion}
        sector={sector}
        onSectorChange={setSector}
      />

      {/* Loading state */}
      {pilotageData.loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
          <span className="ml-3 text-gray-400">{t('loading.data')}</span>
        </div>
      )}

      {/* Main content with tabs */}
      {!pilotageData.loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex flex-wrap bg-gray-900/50 border border-gray-800/50 rounded-xl p-1 gap-1 h-auto">
              {tabs.map(tab => {
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

            <div className="mt-6">
              <TabsContent value="overview">
                <PilotageOverviewTab data={pilotageData} />
              </TabsContent>
              <TabsContent value="accounting">
                <PilotageAccountingTab data={pilotageData} sector={sector} />
              </TabsContent>
              <TabsContent value="financial">
                <PilotageFinancialTab data={pilotageData} />
              </TabsContent>
              <TabsContent value="taxValuation">
                <PilotageTaxValuationTab data={pilotageData} region={region} sector={sector} />
              </TabsContent>
              <TabsContent value="simulator">
                <PilotageSimulatorTab />
              </TabsContent>
              <TabsContent value="aiAudit">
                <PilotageAuditTab startDate={startDate} endDate={endDate} />
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>
      )}
    </div>
  );
};

export default PilotagePage;
