import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import {
  TrendingUp,
  BarChart3,
  Wallet,
  ArrowUpDown,
  Gem,
} from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const KPI_CONFIG = [
  {
    key: 'revenue',
    icon: TrendingUp,
    labelKey: 'pilotage.kpis.revenue',
    color: 'blue',
    getValue: (data) => data.revenue,
  },
  {
    key: 'ebitda',
    icon: BarChart3,
    labelKey: 'pilotage.kpis.ebitda',
    color: 'emerald',
    getValue: (data) => data.financialDiagnostic?.margins?.ebitda,
  },
  {
    key: 'netResult',
    icon: Wallet,
    labelKey: 'pilotage.kpis.netResult',
    color: 'orange',
    getValue: (data) => data.netIncome,
  },
  {
    key: 'freeCashFlow',
    icon: ArrowUpDown,
    labelKey: 'pilotage.kpis.freeCashFlow',
    color: 'purple',
    getValue: (data) => data.pilotageRatios?.cashFlow?.freeCashFlow,
  },
  {
    key: 'valuation',
    icon: Gem,
    labelKey: 'pilotage.kpis.valuation',
    color: 'amber',
    getValue: (data) => data.valuation?.multiples?.midValue,
  },
];

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
};

const KPICard = ({ icon: Icon, label, value, color }) => {
  const colors = COLOR_MAP[color];
  const formattedValue =
    value != null ? currencyFormatter.format(value) : '--';

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center`}
          >
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-400 truncate">
              {label}
            </p>
            <p className={`text-lg font-bold text-gray-100 mt-0.5 truncate`}>
              {formattedValue}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const KPICardGrid = ({ data }) => {
  const { t } = useTranslation();

  const kpis = useMemo(
    () =>
      KPI_CONFIG.map((cfg) => ({
        ...cfg,
        label: t(cfg.labelKey),
        value: cfg.getValue(data),
      })),
    [data, t]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <KPICard
          key={kpi.key}
          icon={kpi.icon}
          label={kpi.label}
          value={kpi.value}
          color={kpi.color}
        />
      ))}
    </div>
  );
};

export default KPICardGrid;
