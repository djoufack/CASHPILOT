import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/utils/calculations';
import { useTranslation } from 'react-i18next';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-[#0f1528] px-4 py-3 shadow-xl">
      <p className="mb-1 text-sm font-medium text-gray-300">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value, currency)}
        </p>
      ))}
    </div>
  );
};

export const InstrumentBalanceChart = ({ data = [], currency = 'EUR' }) => {
  const { t } = useTranslation();
  const panelInfo = {
    title: t('financialInstruments.balanceEvolution', 'Balance Evolution (90 days)'),
    definition: 'Vue jour par jour des entrées, sorties et du solde de fin de journée.',
    dataSource: 'Historique des transactions de ce compte.',
    formula: "Solde de cloture = solde d'ouverture + cumul des entrées - sorties.",
    calculationMethod: 'Le graphique combine les 3 courbes pour expliquer visuellement la variation du solde.',
    expertDataSource: 'RPC Supabase `rpc_account_balance_evolution` alimentée par `payment_transactions`.',
    expertFormula: 'closing_balance(day) = opening_balance + SUM(daily_inflow - daily_outflow) OVER (ORDER BY day).',
    expertCalculationMethod: 'Série SQL déjà calculée, puis rendue telle quelle dans Recharts.',
  };

  if (!data.length) {
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
          {t('financialInstruments.balanceEvolution', 'Balance Evolution (90 days)')}
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="day"
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
          <Area
            type="monotone"
            dataKey="daily_inflow"
            name={t('financialInstruments.dailyInflow', 'Daily Inflow')}
            stroke="#10B981"
            fill="url(#colorInflow)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="daily_outflow"
            name={t('financialInstruments.dailyOutflow', 'Daily Outflow')}
            stroke="#EF4444"
            fill="url(#colorOutflow)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="closing_balance"
            name={t('financialInstruments.closingBalance', 'Closing Balance')}
            stroke="#F59E0B"
            fill="url(#colorBalance)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
