import { useMemo } from 'react';
import { formatCurrency } from '@/utils/calculations';
import { useTranslation } from 'react-i18next';

const INSTRUMENT_TYPE_CONFIG = {
  bank_account: {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5Z" />
      </svg>
    ),
    color: '#3B82F6',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  card: {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
    color: '#8B5CF6',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  cash: {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    color: '#10B981',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
};

const DEFAULT_CONFIG = {
  icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  color: '#6b7280',
  bgColor: 'bg-gray-500/10',
  borderColor: 'border-gray-500/20',
};

const getConfig = (type) => INSTRUMENT_TYPE_CONFIG[type] || DEFAULT_CONFIG;

export const PortfolioConsolidatedView = ({ data = [], baseCurrency = 'EUR' }) => {
  const { t } = useTranslation();

  const { grouped, companyTotals, grandTotal } = useMemo(() => {
    const groupMap = new Map();
    let total = 0;
    const totals = new Map();

    data.forEach((row) => {
      const companyName = row.company_name || t('financialInstruments.unknownCompany', 'Unknown Company');
      if (!groupMap.has(companyName)) {
        groupMap.set(companyName, []);
      }
      groupMap.get(companyName).push(row);

      const baseBalance = Number(row.balance_base_currency) || 0;
      totals.set(companyName, (totals.get(companyName) || 0) + baseBalance);
      total += baseBalance;
    });

    return {
      grouped: groupMap,
      companyTotals: totals,
      grandTotal: total,
    };
  }, [data, t]);

  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-gray-700/50 bg-[#0f1528]/60 backdrop-blur-sm">
        <p className="text-sm text-gray-500">{t('common.noData', 'No data available')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([companyName, instruments]) => {
        const companyTotal = companyTotals.get(companyName) || 0;

        return (
          <div
            key={companyName}
            className="rounded-xl border border-gray-700/50 bg-[#0f1528]/60 backdrop-blur-sm"
          >
            {/* Company header */}
            <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-200">{companyName}</h3>
              <span className="text-sm font-semibold text-amber-500">
                {formatCurrency(companyTotal, baseCurrency)}
              </span>
            </div>

            {/* Instruments table */}
            <div className="divide-y divide-gray-800/50">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                <div className="col-span-1" />
                <div className="col-span-4">
                  {t('financialInstruments.instrument', 'Instrument')}
                </div>
                <div className="col-span-2 text-center">
                  {t('financialInstruments.type', 'Type')}
                </div>
                <div className="col-span-2 text-right">
                  {t('financialInstruments.originalBalance', 'Balance')}
                </div>
                <div className="col-span-3 text-right">
                  {t('financialInstruments.baseBalance', `Balance (${baseCurrency})`)}
                </div>
              </div>

              {/* Instrument rows */}
              {instruments.map((instrument, index) => {
                const config = getConfig(instrument.instrument_type);
                const originalBalance = Number(instrument.balance) || 0;
                const baseBalance = Number(instrument.balance_base_currency) || 0;
                const originalCurrency = instrument.currency || baseCurrency;

                return (
                  <div
                    key={instrument.id || index}
                    className="grid grid-cols-12 items-center gap-2 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                  >
                    {/* Icon */}
                    <div className="col-span-1 flex justify-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bgColor} ${config.borderColor} border`}
                        style={{ color: config.color }}
                      >
                        {config.icon}
                      </div>
                    </div>

                    {/* Label */}
                    <div className="col-span-4">
                      <p className="truncate text-sm font-medium text-gray-200">
                        {instrument.label || instrument.instrument_name || '-'}
                      </p>
                      {instrument.account_number && (
                        <p className="truncate text-xs text-gray-500">
                          {instrument.account_number}
                        </p>
                      )}
                    </div>

                    {/* Type badge */}
                    <div className="col-span-2 flex justify-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.borderColor} border`}
                        style={{ color: config.color }}
                      >
                        {t(`financialInstruments.types.${instrument.instrument_type}`, instrument.instrument_type)}
                      </span>
                    </div>

                    {/* Original balance */}
                    <div className="col-span-2 text-right">
                      <span
                        className={`text-sm font-medium ${
                          originalBalance >= 0 ? 'text-gray-300' : 'text-red-400'
                        }`}
                      >
                        {formatCurrency(originalBalance, originalCurrency)}
                      </span>
                    </div>

                    {/* Base currency balance */}
                    <div className="col-span-3 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          baseBalance >= 0 ? 'text-gray-200' : 'text-red-400'
                        }`}
                      >
                        {formatCurrency(baseBalance, baseCurrency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Grand total */}
      {grouped.size > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 backdrop-blur-sm">
          <span className="text-sm font-semibold text-gray-200">
            {t('financialInstruments.grandTotal', 'Grand Total')}
          </span>
          <span
            className={`text-base font-bold ${
              grandTotal >= 0 ? 'text-amber-500' : 'text-red-400'
            }`}
          >
            {formatCurrency(grandTotal, baseCurrency)}
          </span>
        </div>
      )}
    </div>
  );
};
