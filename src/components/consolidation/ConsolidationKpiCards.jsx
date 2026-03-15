import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Landmark, Scale, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const KpiCard = ({ label, value, previousValue, icon: Icon, colorClass, currency = 'EUR' }) => {
  const variation =
    previousValue != null && previousValue !== 0 ? ((value - previousValue) / Math.abs(previousValue)) * 100 : null;

  const isPositive = variation != null && variation >= 0;

  return (
    <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm hover:border-white/20 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
          <div className={`p-2 rounded-lg bg-white/5 ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-white mb-1">{formatCurrency(value || 0, currency)}</div>
        {variation != null && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}
              {variation.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500 ml-1">vs prev.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function ConsolidationKpiCards({
  pnlData,
  balanceData,
  cashData,
  previousPnl,
  previousBalance,
  previousCash,
  currency = 'EUR',
}) {
  const { t } = useTranslation();

  const kpis = [
    {
      label: t('consolidation.consolidatedRevenue'),
      value: pnlData?.adjusted_revenue ?? pnlData?.total_revenue ?? 0,
      previousValue: previousPnl?.adjusted_revenue ?? previousPnl?.total_revenue ?? null,
      icon: TrendingUp,
      colorClass: 'text-emerald-400',
    },
    {
      label: t('consolidation.consolidatedExpenses'),
      value: pnlData?.total_expenses ?? 0,
      previousValue: previousPnl?.total_expenses ?? null,
      icon: TrendingDown,
      colorClass: 'text-red-400',
    },
    {
      label: t('consolidation.netIncome'),
      value: pnlData?.adjusted_net_income ?? pnlData?.net_income ?? 0,
      previousValue: previousPnl?.adjusted_net_income ?? previousPnl?.net_income ?? null,
      icon: DollarSign,
      colorClass: (pnlData?.adjusted_net_income ?? pnlData?.net_income ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: t('consolidation.totalAssets'),
      value: balanceData?.adjusted_assets ?? balanceData?.total_assets ?? 0,
      previousValue: previousBalance?.adjusted_assets ?? previousBalance?.total_assets ?? null,
      icon: Landmark,
      colorClass: 'text-blue-400',
    },
    {
      label: t('consolidation.totalLiabilities'),
      value: balanceData?.total_liabilities ?? 0,
      previousValue: previousBalance?.total_liabilities ?? null,
      icon: Scale,
      colorClass: 'text-amber-400',
    },
    {
      label: t('consolidation.cashPosition'),
      value: cashData?.total_cash ?? 0,
      previousValue: previousCash?.total_cash ?? null,
      icon: Wallet,
      colorClass: 'text-cyan-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} currency={currency} />
      ))}
    </div>
  );
}
