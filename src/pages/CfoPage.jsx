import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Brain } from 'lucide-react';
import CfoChatPanel from '@/components/cfo/CfoChatPanel';
import CfoInsightsCard from '@/components/cfo/CfoInsightsCard';
import CfoAlertsList from '@/components/cfo/CfoAlertsList';

const CfoPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t('cfo.page.title', 'Agent IA CFO (Directeur Financier)')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {t('cfo.page.title', 'Agent IA CFO (Directeur Financier)')}
            </h1>
            <p className="text-sm text-gray-400">
              {t('cfo.page.description', "Votre directeur financier virtuel propulse par l'IA")}
            </p>
            <p className="text-xs text-blue-300/90 mt-1">
              {t('cfo.page.acronymDefinition', 'CFO = Chief Financial Officer (Directeur Financier)')}
            </p>
          </div>
        </div>

        {/* Layout: 2 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {/* Left: Chat panel (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col" style={{ minHeight: '500px' }}>
            <CfoChatPanel />
          </div>

          {/* Right: Insights + Alerts (1/3 width) */}
          <div className="space-y-6">
            <CfoInsightsCard />
            <CfoAlertsList />
          </div>
        </div>
      </div>
    </>
  );
};

export default CfoPage;
