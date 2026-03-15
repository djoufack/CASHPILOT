import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSycohadaReports } from '@/hooks/useSycohadaReports';
import { formatCurrency } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Loader2,
  FileText,
  Building2,
  Landmark,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react';

const SectionTable = ({ title, icon: Icon, items, color }) => {
  const total = (items || []).reduce((sum, item) => sum + (item.balance || 0), 0);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h4 className={`text-sm font-semibold ${color}`}>{title}</h4>
      </div>
      <div className="space-y-1">
        {(items || []).map((item, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
          >
            <span className="text-sm text-gray-300">
              <span className="text-gray-500 mr-2 font-mono text-xs">{item.section_code}</span>
              {item.section_name}
            </span>
            <span className="text-sm font-medium text-gray-200 font-mono">{formatCurrency(item.balance)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center px-3 py-2 mt-1 rounded-lg bg-gray-700/30 border border-gray-700/50">
        <span className={`text-sm font-bold ${color}`}>Total {title}</span>
        <span className={`text-sm font-bold ${color} font-mono`}>{formatCurrency(total)}</span>
      </div>
    </div>
  );
};

const SycohadaBalanceSheetPage = () => {
  const { t } = useTranslation();
  const { balanceSheet, loading, error, fetchBalanceSheet } = useSycohadaReports();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchBalanceSheet(null, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    fetchBalanceSheet(null, date);
  };

  const actif = balanceSheet?.actif;
  const passif = balanceSheet?.passif;

  return (
    <>
      <Helmet>
        <title>
          {t('syscohada.balanceSheet', 'Bilan SYSCOHADA')} - {t('app.name')}
        </title>
      </Helmet>

      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              {t('syscohada.balanceSheet', 'Bilan SYSCOHADA')}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">
              {t('syscohada.balanceSheetDesc', 'Bilan conforme au plan comptable OHADA')}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {t('common.refresh', 'Actualiser')}
            </Button>
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              {t('syscohada.exportPdf', 'Export PDF')}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && !balanceSheet && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Balance Sheet Content */}
        {balanceSheet && (
          <>
            {/* Equilibre indicator */}
            <div
              className={`flex items-center gap-2 mb-6 px-4 py-3 rounded-xl border ${
                balanceSheet.equilibre ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'
              }`}
            >
              {balanceSheet.equilibre ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <span className={`text-sm font-medium ${balanceSheet.equilibre ? 'text-green-300' : 'text-red-300'}`}>
                {balanceSheet.equilibre
                  ? t('syscohada.balanced', 'Bilan equilibre : Actif = Passif')
                  : t('syscohada.unbalanced', 'Bilan desequilibre : Actif ≠ Passif')}
              </span>
            </div>

            {/* Two columns: Actif | Passif */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ACTIF */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-bold text-blue-400">{t('syscohada.assets', 'ACTIF')}</h3>
                </div>

                <SectionTable
                  title={t('syscohada.fixedAssets', 'Actif immobilise')}
                  icon={Building2}
                  items={actif?.actif_immobilise}
                  color="text-blue-400"
                />
                <SectionTable
                  title={t('syscohada.currentAssets', 'Actif circulant')}
                  icon={Wallet}
                  items={actif?.actif_circulant}
                  color="text-cyan-400"
                />
                <SectionTable
                  title={t('syscohada.cashAssets', 'Tresorerie - Actif')}
                  icon={Landmark}
                  items={actif?.tresorerie_actif}
                  color="text-emerald-400"
                />

                {/* Total Actif */}
                <div className="flex justify-between items-center px-4 py-3 mt-4 rounded-xl bg-blue-900/20 border border-blue-800">
                  <span className="text-base font-bold text-blue-300">{t('syscohada.totalAssets', 'TOTAL ACTIF')}</span>
                  <span className="text-base font-bold text-blue-300 font-mono">
                    {formatCurrency(actif?.total_actif || 0)}
                  </span>
                </div>
              </div>

              {/* PASSIF */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold text-purple-400">{t('syscohada.liabilities', 'PASSIF')}</h3>
                </div>

                <SectionTable
                  title={t('syscohada.equity', 'Capitaux propres')}
                  icon={Building2}
                  items={passif?.capitaux_propres}
                  color="text-purple-400"
                />
                <SectionTable
                  title={t('syscohada.financialDebts', 'Dettes financieres')}
                  icon={Wallet}
                  items={passif?.dettes_financieres}
                  color="text-pink-400"
                />
                <SectionTable
                  title={t('syscohada.currentLiabilities', 'Passif circulant')}
                  icon={Wallet}
                  items={passif?.passif_circulant}
                  color="text-orange-400"
                />
                <SectionTable
                  title={t('syscohada.cashLiabilities', 'Tresorerie - Passif')}
                  icon={Landmark}
                  items={passif?.tresorerie_passif}
                  color="text-red-400"
                />

                {/* Total Passif */}
                <div className="flex justify-between items-center px-4 py-3 mt-4 rounded-xl bg-purple-900/20 border border-purple-800">
                  <span className="text-base font-bold text-purple-300">
                    {t('syscohada.totalLiabilities', 'TOTAL PASSIF')}
                  </span>
                  <span className="text-base font-bold text-purple-300 font-mono">
                    {formatCurrency(passif?.total_passif || 0)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !balanceSheet && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">{t('syscohada.noData', 'Aucune donnee disponible')}</p>
            <p className="text-sm mt-1">{t('syscohada.selectDateAndRefresh', 'Selectionnez une date et actualisez')}</p>
          </div>
        )}
      </div>
    </>
  );
};

export default SycohadaBalanceSheetPage;
