import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/utils/calculations';
import { useTranslation } from 'react-i18next';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

const INSTRUMENT_COLORS = {
  bank_account: '#3B82F6',
  card: '#8B5CF6',
  cash: '#10B981',
};

const INSTRUMENT_LABELS = {
  bank_account: 'Bank Account',
  card: 'Card',
  cash: 'Cash',
};

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-[#0f1528] px-4 py-3 shadow-xl">
      <p className="mb-2 text-sm font-medium text-gray-300">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(Math.abs(entry.value), currency)}
        </p>
      ))}
    </div>
  );
};

const CustomLegend = ({ payload }) => {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-4">
      {payload?.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-gray-400">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const PaymentVolumeChart = ({ data = [], currency = 'EUR' }) => {
  const { t } = useTranslation();
  const panelInfo = {
    title: t('financialInstruments.paymentVolume', 'Payment Volume by Instrument'),
    definition: 'Volume mensuel des entrées et sorties pour chaque type de moyen de paiement.',
    dataSource: 'Transactions regroupées par mois et par type.',
    formula: 'Pour chaque type: Entrées = somme des entrées, Sorties = somme des sorties.',
    calculationMethod: 'Empile les séries par type (compte, carte, caisse) pour comparer rapidement.',
    expertDataSource: 'Agrégats mensuels par type issus de `payment_transactions`.',
    expertFormula:
      'entry[type_inflow] += total_inflow ; entry[type_outflow] += -ABS(total_outflow) (stackOffset sign).',
    expertCalculationMethod: 'Pré-agrégation JS par mois puis rendu empilé par type instrument dans Recharts.',
  };

  const { chartData, instrumentTypes } = useMemo(() => {
    const monthMap = new Map();
    const types = new Set();

    data.forEach((row) => {
      const { month, instrument_type, total_inflow = 0, total_outflow = 0 } = row;
      types.add(instrument_type);

      if (!monthMap.has(month)) {
        monthMap.set(month, { month });
      }

      const entry = monthMap.get(month);
      entry[`${instrument_type}_inflow`] = (entry[`${instrument_type}_inflow`] || 0) + Number(total_inflow);
      entry[`${instrument_type}_outflow`] =
        (entry[`${instrument_type}_outflow`] || 0) - Math.abs(Number(total_outflow));
    });

    return {
      chartData: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
      instrumentTypes: Array.from(types),
    };
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-gray-700/50 bg-[#0f1528]/60 backdrop-blur-sm">
        <p className="text-sm text-gray-500">{t('common.noData', 'No data available')}</p>
      </div>
    );
  }

  const formatYAxis = (value) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return value.toFixed(0);
  };

  return (
    <div className="rounded-xl border border-gray-700/50 bg-[#0f1528]/60 p-4 backdrop-blur-sm">
      <div className="mb-4 inline-flex items-center gap-1.5">
        <PanelInfoPopover {...panelInfo} ariaLabel={`Informations sur ${panelInfo.title}`} triggerClassName="h-5 w-5" />
        <h3 className="text-sm font-semibold text-gray-300">
          {t('financialInstruments.paymentVolume', 'Payment Volume by Instrument')}
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
            tickFormatter={formatYAxis}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Legend content={<CustomLegend />} />
          {instrumentTypes.map((type) => (
            <Bar
              key={`${type}_inflow`}
              dataKey={`${type}_inflow`}
              name={`${INSTRUMENT_LABELS[type] || type} ${t('financialInstruments.inflow', 'Inflow')}`}
              stackId="inflow"
              fill={INSTRUMENT_COLORS[type] || '#6b7280'}
              radius={[2, 2, 0, 0]}
            />
          ))}
          {instrumentTypes.map((type) => (
            <Bar
              key={`${type}_outflow`}
              dataKey={`${type}_outflow`}
              name={`${INSTRUMENT_LABELS[type] || type} ${t('financialInstruments.outflow', 'Outflow')}`}
              stackId="outflow"
              fill={INSTRUMENT_COLORS[type] || '#6b7280'}
              fillOpacity={0.5}
              radius={[0, 0, 2, 2]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
