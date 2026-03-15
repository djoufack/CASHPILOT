import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2, Send, Building2 } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const STATUS_BADGES = {
  draft: 'bg-gray-700/60 text-gray-300 border-gray-600',
  computed: 'bg-blue-900/50 text-blue-300 border-blue-700',
  validated: 'bg-purple-900/50 text-purple-300 border-purple-700',
  submitted: 'bg-amber-900/50 text-amber-300 border-amber-700',
  accepted: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  rejected: 'bg-red-900/50 text-red-300 border-red-700',
};

/**
 * Corporate tax declaration form with fiscal year selector,
 * auto-computed breakdown, status display, and submit capability.
 *
 * @param {{ declaration: Object|null, onSubmit: Function, onCompute: Function, loading: boolean }} props
 */
const CorporateTaxForm = ({ declaration = null, onSubmit, onCompute, loading = false }) => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const [fiscalYear, setFiscalYear] = useState(currentYear - 1);
  const [taxData, setTaxData] = useState(null);

  const handleCompute = async () => {
    if (!onCompute) return;
    const result = await onCompute(fiscalYear);
    if (result) {
      setTaxData(result);
    }
  };

  const handleSubmit = async () => {
    if (!declaration?.id || !onSubmit) return;
    await onSubmit(declaration.id);
  };

  const displayData = taxData || declaration?.computed_data;
  const status = declaration?.status || 'draft';
  const badgeClass = STATUS_BADGES[status] || STATUS_BADGES.draft;

  const breakdownRows = displayData
    ? [
        {
          label: t('tax.corporate.revenue', 'Revenue'),
          value: displayData.revenue || 0,
          color: 'text-emerald-300',
        },
        {
          label: t('tax.corporate.expenses', 'Total Expenses'),
          value: -(displayData.expenses || 0),
          color: 'text-red-300',
        },
        {
          label: t('tax.corporate.fiscalResult', 'Fiscal Result'),
          value: displayData.fiscal_result || 0,
          color: (displayData.fiscal_result || 0) >= 0 ? 'text-blue-300' : 'text-amber-300',
          bold: true,
        },
        ...(displayData.reduced_rate
          ? [
              {
                label: t('tax.corporate.reducedRatePortion', 'Reduced rate ({{rate}}%) up to {{threshold}}', {
                  rate: displayData.reduced_rate,
                  threshold: formatCurrency(displayData.reduced_threshold || 0),
                }),
                value: null,
                color: 'text-gray-400',
                info: true,
              },
            ]
          : []),
        {
          label: t('tax.corporate.normalRate', 'Normal Rate'),
          value: null,
          color: 'text-gray-400',
          info: true,
          infoText: `${displayData.normal_rate ?? '-'}%`,
        },
        {
          label: t('tax.corporate.taxDue', 'Tax Due'),
          value: displayData.tax_due || 0,
          color: 'text-purple-300',
          bold: true,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Fiscal Year Selector */}
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {t('tax.corporate.fiscalYearSelection', 'Fiscal Year')}
          </h3>
          {declaration && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}
            >
              {t(`tax.status.${status}`, status)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('tax.corporate.year', 'Year')}</label>
            <input
              type="number"
              min="2020"
              max={currentYear}
              value={fiscalYear}
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              className="bg-[#0a0e1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
            />
          </div>

          <Button onClick={handleCompute} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
            {t('tax.corporate.compute', 'Compute')}
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          {t('tax.corporate.periodRange', 'Period')}: {fiscalYear}-01-01 → {fiscalYear}-12-31
        </p>
      </div>

      {/* Results */}
      {displayData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0f1528]/80 border border-emerald-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                {t('tax.corporate.revenue', 'Revenue')}
              </p>
              <p className="text-xl font-bold text-emerald-300 font-mono">{formatCurrency(displayData.revenue || 0)}</p>
            </div>
            <div className="bg-[#0f1528]/80 border border-red-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                {t('tax.corporate.expenses', 'Total Expenses')}
              </p>
              <p className="text-xl font-bold text-red-300 font-mono">{formatCurrency(displayData.expenses || 0)}</p>
            </div>
            <div
              className={`bg-[#0f1528]/80 border rounded-2xl p-5 backdrop-blur-sm ${
                (displayData.fiscal_result || 0) >= 0 ? 'border-blue-800/50' : 'border-amber-800/50'
              }`}
            >
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                {t('tax.corporate.taxableIncome', 'Taxable Income')}
              </p>
              <p
                className={`text-xl font-bold font-mono ${
                  (displayData.fiscal_result || 0) >= 0 ? 'text-blue-300' : 'text-amber-300'
                }`}
              >
                {formatCurrency(displayData.fiscal_result || 0)}
              </p>
            </div>
            <div className="bg-[#0f1528]/80 border border-purple-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                {t('tax.corporate.netPayable', 'Net Payable')}
              </p>
              <p className="text-xl font-bold text-purple-300 font-mono">{formatCurrency(displayData.tax_due || 0)}</p>
            </div>
          </div>

          {/* Computation Breakdown Table */}
          <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              {t('tax.corporate.breakdown', 'Computation Breakdown')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-gray-800/50">
                    <th className="text-left pb-2 pr-4">{t('tax.corporate.item', 'Item')}</th>
                    <th className="text-right pb-2">{t('tax.corporate.amount', 'Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row, idx) => (
                    <tr key={idx} className={`border-t border-gray-800/30 ${row.bold ? 'bg-gray-800/20' : ''}`}>
                      <td className={`py-3 pr-4 ${row.bold ? 'font-semibold text-white' : 'text-gray-400'}`}>
                        {row.label}
                      </td>
                      <td className={`py-3 text-right font-mono ${row.color} ${row.bold ? 'font-bold text-lg' : ''}`}>
                        {row.info ? row.infoText || '' : formatCurrency(row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submit action */}
          {declaration && ['computed', 'validated'].includes(declaration.status) && onSubmit && (
            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {t('tax.corporate.submit', 'Submit Declaration')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CorporateTaxForm;
