import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2, Send, TrendingUp, TrendingDown, ArrowRight, Receipt } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const COUNTRIES = [
  { code: 'FR', label: 'France' },
  { code: 'BE', label: 'Belgique' },
  { code: 'CI', label: "Cote d'Ivoire" },
  { code: 'CM', label: 'Cameroun' },
  { code: 'SN', label: 'Senegal' },
];

const PERIOD_TYPES = ['month', 'quarter', 'year'];

const STATUS_BADGES = {
  draft: 'bg-gray-700/60 text-gray-300 border-gray-600',
  computed: 'bg-blue-900/50 text-blue-300 border-blue-700',
  validated: 'bg-purple-900/50 text-purple-300 border-purple-700',
  submitted: 'bg-amber-900/50 text-amber-300 border-amber-700',
  accepted: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  rejected: 'bg-red-900/50 text-red-300 border-red-700',
};

/**
 * VAT declaration form with period/country selectors, auto-computed fields,
 * status badges, and submit capability.
 *
 * @param {{ declaration: Object|null, onSubmit: Function, onCompute: Function, loading: boolean }} props
 */
const VatDeclarationForm = ({ declaration = null, onSubmit, onCompute, loading = false }) => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [periodType, setPeriodType] = useState('quarter');
  const [country, setCountry] = useState('FR');

  // Default period: last complete quarter
  const quarterIndex = Math.floor(currentMonth / 3);
  const defaultQuarter = quarterIndex === 0 ? 4 : quarterIndex;
  const defaultYear = quarterIndex === 0 ? currentYear - 1 : currentYear;

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth === 0 ? 12 : currentMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(defaultQuarter);

  const [vatData, setVatData] = useState(null);

  const { startDate, endDate } = useMemo(() => {
    let start, end;
    if (periodType === 'month') {
      start = new Date(selectedYear, selectedMonth - 1, 1);
      end = new Date(selectedYear, selectedMonth, 0);
    } else if (periodType === 'quarter') {
      const qStartMonth = (selectedQuarter - 1) * 3;
      start = new Date(selectedYear, qStartMonth, 1);
      end = new Date(selectedYear, qStartMonth + 3, 0);
    } else {
      start = new Date(selectedYear, 0, 1);
      end = new Date(selectedYear, 11, 31);
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  const handleCompute = async () => {
    if (!onCompute) return;
    const result = await onCompute(startDate, endDate);
    if (result) {
      setVatData(result);
    }
  };

  const handleSubmit = async () => {
    if (!declaration?.id || !onSubmit) return;
    await onSubmit(declaration.id);
  };

  const collectedItems = vatData?.detail_by_rate?.filter((d) => d.type === 'collected') || [];
  const deductibleItems =
    vatData?.detail_by_rate?.filter((d) => d.type === 'deductible' || d.type === 'deductible_supplier') || [];

  const displayData = vatData || declaration?.computed_data;
  const status = declaration?.status || 'draft';
  const badgeClass = STATUS_BADGES[status] || STATUS_BADGES.draft;

  return (
    <div className="space-y-6">
      {/* Period & Country selector */}
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {t('tax.vat.periodSelection', 'Period & Country')}
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
          {/* Country selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('tax.vat.country', 'Country')}</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-[#0a0e1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Period type selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('tax.vat.periodType', 'Period type')}</label>
            <div className="flex bg-[#0a0e1a] rounded-lg border border-gray-700 overflow-hidden">
              {PERIOD_TYPES.map((pt) => (
                <button
                  key={pt}
                  onClick={() => setPeriodType(pt)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    periodType === pt ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {t(`tax.vat.period.${pt}`, pt)}
                </button>
              ))}
            </div>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('tax.vat.year', 'Year')}</label>
            <input
              type="number"
              min="2020"
              max={currentYear}
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-[#0a0e1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
            />
          </div>

          {/* Month or Quarter selector */}
          {periodType === 'month' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('tax.vat.month', 'Month')}</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-[#0a0e1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'quarter' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('tax.vat.quarter', 'Quarter')}</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(parseInt(e.target.value, 10))}
                className="bg-[#0a0e1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Compute button */}
          <Button onClick={handleCompute} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
            {t('tax.vat.compute', 'Compute')}
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          {t('tax.vat.periodRange', 'Period')}: {startDate} → {endDate}
        </p>
      </div>

      {/* VAT Summary Cards */}
      {displayData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* VAT Collected */}
            <div className="bg-[#0f1528]/80 border border-emerald-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">
                  {t('tax.vat.collected', 'VAT Collected')}
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-300 font-mono">
                {formatCurrency(displayData.vat_collected || 0)}
              </p>
            </div>

            {/* VAT Deductible */}
            <div className="bg-[#0f1528]/80 border border-red-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">
                  {t('tax.vat.deductible', 'VAT Deductible')}
                </span>
              </div>
              <p className="text-2xl font-bold text-red-300 font-mono">
                {formatCurrency(displayData.vat_deductible || 0)}
              </p>
            </div>

            {/* Net VAT Payable */}
            <div
              className={`bg-[#0f1528]/80 border rounded-2xl p-5 backdrop-blur-sm ${
                (displayData.vat_net || 0) >= 0 ? 'border-blue-800/50' : 'border-amber-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">
                  {t('tax.vat.netPayable', 'Net VAT Payable')}
                </span>
              </div>
              <p
                className={`text-2xl font-bold font-mono ${
                  (displayData.vat_net || 0) >= 0 ? 'text-blue-300' : 'text-amber-300'
                }`}
              >
                {formatCurrency(displayData.vat_net || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(displayData.vat_net || 0) >= 0
                  ? t('tax.vat.toPay', 'Amount to pay')
                  : t('tax.vat.credit', 'VAT credit')}
              </p>
            </div>
          </div>

          {/* Detail: Collected by rate */}
          {collectedItems.length > 0 && (
            <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800/50">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                  {t('tax.vat.detailCollected', 'VAT Collected - Detail by Rate')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase">
                      <th className="text-left pb-2 pr-4">{t('tax.vat.rate', 'Rate')}</th>
                      <th className="text-right pb-2 pr-4">{t('tax.vat.taxableBase', 'Taxable Base')}</th>
                      <th className="text-right pb-2">{t('tax.vat.vatAmount', 'VAT Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectedItems.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 pr-4 text-white">{item.rate}%</td>
                        <td className="py-2 pr-4 text-right text-gray-300 font-mono">{formatCurrency(item.base)}</td>
                        <td className="py-2 text-right text-emerald-300 font-mono">{formatCurrency(item.vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detail: Deductible by rate */}
          {deductibleItems.length > 0 && (
            <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800/50">
                <Receipt className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                  {t('tax.vat.detailDeductible', 'VAT Deductible - Detail by Rate')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase">
                      <th className="text-left pb-2 pr-4">{t('tax.vat.rate', 'Rate')}</th>
                      <th className="text-left pb-2 pr-4">{t('tax.vat.source', 'Source')}</th>
                      <th className="text-right pb-2 pr-4">{t('tax.vat.taxableBase', 'Taxable Base')}</th>
                      <th className="text-right pb-2">{t('tax.vat.vatAmount', 'VAT Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductibleItems.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 pr-4 text-white">{item.rate}%</td>
                        <td className="py-2 pr-4 text-gray-400 text-xs">
                          {item.type === 'deductible_supplier'
                            ? t('tax.vat.supplierInvoices', 'Supplier invoices')
                            : t('tax.vat.expenses', 'Expenses')}
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-300 font-mono">{formatCurrency(item.base)}</td>
                        <td className="py-2 text-right text-red-300 font-mono">{formatCurrency(item.vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit action */}
          {declaration && ['computed', 'validated'].includes(declaration.status) && onSubmit && (
            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {t('tax.vat.submit', 'Submit Declaration')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VatDeclarationForm;
