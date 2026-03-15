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
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Wallet,
  Landmark,
  AlertTriangle,
  Download,
} from 'lucide-react';

const TafireSection = ({ title, icon: Icon, items, color }) => (
  <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5 mb-6">
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
      <Icon className={`w-5 h-5 ${color}`} />
      <h3 className={`text-lg font-bold ${color}`}>{title}</h3>
    </div>
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
        >
          <span className="text-sm text-gray-300">{item.label}</span>
          <span className={`text-sm font-medium font-mono ${item.value >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {formatCurrency(item.value)}
          </span>
        </div>
      ))}
    </div>
    {items.length > 1 && (
      <div
        className={`flex justify-between items-center px-4 py-3 mt-3 rounded-xl border ${
          color.includes('blue')
            ? 'bg-blue-900/20 border-blue-800'
            : color.includes('purple')
              ? 'bg-purple-900/20 border-purple-800'
              : color.includes('cyan')
                ? 'bg-cyan-900/20 border-cyan-800'
                : 'bg-gray-700/30 border-gray-700'
        }`}
      >
        <span className={`text-sm font-bold ${color}`}>Total</span>
        <span className={`text-sm font-bold font-mono ${color}`}>
          {formatCurrency(items.reduce((sum, item) => sum + item.value, 0))}
        </span>
      </div>
    )}
  </div>
);

const TafirePage = () => {
  const { t } = useTranslation();
  const { tafire, loading, error, fetchTafire } = useSycohadaReports();
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchTafire(null, startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    fetchTafire(null, startDate, endDate);
  };

  const inv = tafire?.investissements || {};
  const fin = tafire?.financement || {};
  const bfr = tafire?.variation_bfr || {};
  const tres = tafire?.tresorerie || {};

  return (
    <>
      <Helmet>
        <title>
          {t('syscohada.tafire', 'TAFIRE')} - {t('app.name')}
        </title>
      </Helmet>

      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">{t('syscohada.tafire', 'TAFIRE')}</h1>
            <p className="text-gray-400 text-sm md:text-base">
              {t('syscohada.tafireDesc', 'Tableau Financier des Ressources et Emplois - OHADA')}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500 text-sm">{t('syscohada.to', 'au')}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
        {loading && !tafire && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* TAFIRE Content */}
        {tafire && (
          <>
            {/* CAF */}
            <div className="bg-gray-900/50 rounded-xl border border-emerald-800 p-5 mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  <span className="text-base font-bold text-emerald-400">
                    {t('syscohada.caf', "Capacite d'Autofinancement (CAF)")}
                  </span>
                </div>
                <span
                  className={`text-xl font-bold font-mono ${
                    (tafire.capacite_autofinancement || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {formatCurrency(tafire.capacite_autofinancement || 0)}
                </span>
              </div>
            </div>

            {/* 1. Investissements */}
            <TafireSection
              title={t('syscohada.investments', 'Investissements et Desinvestissements')}
              icon={Building2}
              color="text-blue-400"
              items={[
                { label: t('syscohada.acquisitions', "Acquisitions d'immobilisations"), value: inv.acquisitions || 0 },
                { label: t('syscohada.disposals', "Cessions d'immobilisations"), value: inv.cessions || 0 },
              ]}
            />

            {/* 2. Financement */}
            <TafireSection
              title={t('syscohada.financing', 'Financement')}
              icon={Landmark}
              color="text-purple-400"
              items={[
                {
                  label: t('syscohada.capitalIncrease', 'Augmentation de capital'),
                  value: fin.augmentation_capital || 0,
                },
                { label: t('syscohada.newLoans', 'Nouveaux emprunts'), value: fin.nouveaux_emprunts || 0 },
                { label: t('syscohada.subsidies', "Subventions d'investissement"), value: fin.subventions || 0 },
                {
                  label: t('syscohada.loanRepayments', "Remboursements d'emprunts"),
                  value: -(fin.remboursements_emprunts || 0),
                },
              ]}
            />

            {/* 3. Variation BFR */}
            <TafireSection
              title={t('syscohada.wcrVariation', 'Variation du Besoin en Fonds de Roulement (BFR)')}
              icon={Wallet}
              color="text-cyan-400"
              items={[
                { label: t('syscohada.inventoryChange', 'Variation des stocks'), value: bfr.variation_stocks || 0 },
                {
                  label: t('syscohada.receivablesChange', 'Variation des creances'),
                  value: bfr.variation_creances || 0,
                },
                {
                  label: t('syscohada.payablesChange', 'Variation des dettes fournisseurs'),
                  value: bfr.variation_dettes_fournisseurs || 0,
                },
                {
                  label: t('syscohada.taxSocialChange', 'Variation des dettes fiscales et sociales'),
                  value: bfr.variation_dettes_fiscales_sociales || 0,
                },
              ]}
            />

            {/* 4. Tresorerie */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-emerald-400">
                    {t('syscohada.cashAssets', 'Tresorerie - Actif')}
                  </h4>
                </div>
                <p className="text-2xl font-bold text-emerald-300 font-mono">
                  {formatCurrency(tres.tresorerie_actif || 0)}
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                  <h4 className="text-sm font-semibold text-red-400">
                    {t('syscohada.cashLiabilities', 'Tresorerie - Passif')}
                  </h4>
                </div>
                <p className="text-2xl font-bold text-red-300 font-mono">
                  {formatCurrency(tres.tresorerie_passif || 0)}
                </p>
              </div>
            </div>

            {/* Net cash variation */}
            <div
              className={`flex justify-between items-center px-6 py-4 rounded-xl border-2 ${
                (tafire.variation_tresorerie_nette || 0) >= 0
                  ? 'bg-emerald-900/30 border-emerald-600'
                  : 'bg-red-900/30 border-red-600'
              }`}
            >
              <span
                className={`text-xl font-bold ${
                  (tafire.variation_tresorerie_nette || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {t('syscohada.netCashVariation', 'Variation de Tresorerie Nette')}
              </span>
              <span
                className={`text-xl font-bold font-mono ${
                  (tafire.variation_tresorerie_nette || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {formatCurrency(tafire.variation_tresorerie_nette || 0)}
              </span>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !tafire && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">{t('syscohada.noData', 'Aucune donnee disponible')}</p>
            <p className="text-sm mt-1">
              {t('syscohada.selectPeriodAndRefresh', 'Selectionnez une periode et actualisez')}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default TafirePage;
