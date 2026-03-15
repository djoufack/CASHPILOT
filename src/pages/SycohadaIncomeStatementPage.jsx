import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSycohadaReports } from '@/hooks/useSycohadaReports';
import { formatCurrency } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, FileText, TrendingUp, TrendingDown, AlertTriangle, Download } from 'lucide-react';

const ResultSection = ({ title, data, color, t }) => {
  const produits = data?.produits || [];
  const charges = data?.charges || [];
  const totalProduits = data?.total_produits || data?.produits_financiers || data?.produits_hao || 0;
  const totalCharges = data?.total_charges || data?.charges_financieres || data?.charges_hao || 0;
  const resultat = data?.resultat ?? totalProduits - totalCharges;

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5 mb-6">
      <h3 className={`text-lg font-bold ${color} mb-4 pb-3 border-b border-gray-800`}>{title}</h3>

      {/* Produits */}
      {produits.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <h4 className="text-sm font-semibold text-green-400">{t('syscohada.revenue', 'Produits')}</h4>
          </div>
          <div className="space-y-1">
            {produits.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-gray-800/40">
                <span className="text-sm text-gray-300">
                  <span className="text-gray-500 mr-2 font-mono text-xs">{item.code}</span>
                  {item.name}
                </span>
                <span className="text-sm font-medium text-green-300 font-mono">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charges */}
      {charges.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-semibold text-red-400">{t('syscohada.expenses', 'Charges')}</h4>
          </div>
          <div className="space-y-1">
            {charges.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-gray-800/40">
                <span className="text-sm text-gray-300">
                  <span className="text-gray-500 mr-2 font-mono text-xs">{item.code}</span>
                  {item.name}
                </span>
                <span className="text-sm font-medium text-red-300 font-mono">-{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtotals */}
      <div className="space-y-2 mt-4">
        {totalProduits !== 0 && (
          <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-green-900/20 border border-green-900/30">
            <span className="text-sm font-medium text-green-300">{t('syscohada.totalRevenue', 'Total produits')}</span>
            <span className="text-sm font-bold text-green-300 font-mono">{formatCurrency(totalProduits)}</span>
          </div>
        )}
        {totalCharges !== 0 && (
          <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-red-900/20 border border-red-900/30">
            <span className="text-sm font-medium text-red-300">{t('syscohada.totalExpenses', 'Total charges')}</span>
            <span className="text-sm font-bold text-red-300 font-mono">-{formatCurrency(totalCharges)}</span>
          </div>
        )}

        {/* Resultat */}
        <div
          className={`flex justify-between items-center px-4 py-3 rounded-xl border ${
            resultat >= 0 ? 'bg-emerald-900/20 border-emerald-800' : 'bg-red-900/20 border-red-800'
          }`}
        >
          <span className={`text-base font-bold ${resultat >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {t('syscohada.result', 'Resultat')}
          </span>
          <span className={`text-base font-bold font-mono ${resultat >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {formatCurrency(resultat)}
          </span>
        </div>
      </div>
    </div>
  );
};

const SycohadaIncomeStatementPage = () => {
  const { t } = useTranslation();
  const { incomeStatement, loading, error, fetchIncomeStatement } = useSycohadaReports();
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchIncomeStatement(null, startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    fetchIncomeStatement(null, startDate, endDate);
  };

  const data = incomeStatement;

  return (
    <>
      <Helmet>
        <title>
          {t('syscohada.incomeStatement', 'Compte de Resultat SYSCOHADA')} - {t('app.name')}
        </title>
      </Helmet>

      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              {t('syscohada.incomeStatement', 'Compte de Resultat SYSCOHADA')}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">
              {t('syscohada.incomeStatementDesc', 'Compte de resultat conforme au referentiel OHADA')}
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
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Income Statement Content */}
        {data && (
          <>
            {/* 1. Exploitation */}
            <ResultSection
              title={t('syscohada.operatingActivity', "Activite d'exploitation")}
              data={data.exploitation}
              color="text-blue-400"
              t={t}
            />

            {/* 2. Financier */}
            <ResultSection
              title={t('syscohada.financialActivity', 'Activite financiere')}
              data={{
                produits: [],
                charges: [],
                total_produits: data.financier?.produits_financiers || 0,
                total_charges: data.financier?.charges_financieres || 0,
                resultat: data.financier?.resultat || 0,
              }}
              color="text-purple-400"
              t={t}
            />

            {/* 3. HAO */}
            <ResultSection
              title={t('syscohada.haoActivity', 'Activite HAO (Hors Activite Ordinaire)')}
              data={{
                produits: [],
                charges: [],
                total_produits: data.hao?.produits_hao || 0,
                total_charges: data.hao?.charges_hao || 0,
                resultat: data.hao?.resultat || 0,
              }}
              color="text-orange-400"
              t={t}
            />

            {/* 4. Participation & Impots */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-800/40">
                  <span className="text-sm text-gray-300">
                    {t('syscohada.workerParticipation', 'Participation des travailleurs')}
                  </span>
                  <span className="text-sm font-medium text-red-300 font-mono">
                    -{formatCurrency(data.participation_travailleurs || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-800/40">
                  <span className="text-sm text-gray-300">{t('syscohada.incomeTax', 'Impot sur le resultat')}</span>
                  <span className="text-sm font-medium text-red-300 font-mono">
                    -{formatCurrency(data.impot_sur_resultat || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Resultat Net */}
            <div
              className={`flex justify-between items-center px-6 py-4 rounded-xl border-2 ${
                data.resultat_net >= 0 ? 'bg-emerald-900/30 border-emerald-600' : 'bg-red-900/30 border-red-600'
              }`}
            >
              <div className="flex items-center gap-3">
                {data.resultat_net >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" />
                )}
                <span className={`text-xl font-bold ${data.resultat_net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {t('syscohada.netResult', 'RESULTAT NET')}
                </span>
              </div>
              <span
                className={`text-xl font-bold font-mono ${data.resultat_net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}
              >
                {formatCurrency(data.resultat_net || 0)}
              </span>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
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

export default SycohadaIncomeStatementPage;
