import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/utils/calculations';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

const COMPANY_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#141c33] border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-white font-semibold mb-2 text-sm">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs mb-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="text-white font-medium">{formatCurrency(entry.value || 0)}</span>
        </div>
      ))}
    </div>
  );
};

export default function CompanyBreakdownChart({ data, mode = 'pnl', currency: _currency = 'EUR' }) {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return { rows: [], companies: [] };

    const companies = data.map((c) => c.company_name || c.company_id);

    if (mode === 'pnl') {
      const row = { name: t('consolidation.pnlBreakdown') };
      data.forEach((c, idx) => {
        row[c.company_name || `company_${idx}`] = c.revenue || 0;
      });

      const expRow = { name: t('consolidation.expensesBreakdown') };
      data.forEach((c, idx) => {
        expRow[c.company_name || `company_${idx}`] = c.expenses || 0;
      });

      const netRow = { name: t('consolidation.netIncomeBreakdown') };
      data.forEach((c, idx) => {
        netRow[c.company_name || `company_${idx}`] = c.net_income || 0;
      });

      return { rows: [row, expRow, netRow], companies };
    }

    if (mode === 'balance') {
      const assetsRow = { name: t('consolidation.totalAssets') };
      const liabRow = { name: t('consolidation.totalLiabilities') };
      const eqRow = { name: t('consolidation.equity') };

      data.forEach((c, idx) => {
        const key = c.company_name || `company_${idx}`;
        assetsRow[key] = c.assets || 0;
        liabRow[key] = c.liabilities || 0;
        eqRow[key] = c.equity || 0;
      });

      return { rows: [assetsRow, liabRow, eqRow], companies };
    }

    if (mode === 'cash') {
      const cashRow = { name: t('consolidation.cashPosition') };
      data.forEach((c, idx) => {
        cashRow[c.company_name || `company_${idx}`] = c.cash_balance || 0;
      });

      return { rows: [cashRow], companies };
    }

    return { rows: [], companies: [] };
  }, [data, mode, t]);

  const chartInfo = useMemo(() => {
    if (mode === 'balance') {
      return {
        title: t('consolidation.companyBreakdown'),
        definition: 'Répartition des actifs, passifs et capitaux propres par société dans le périmètre consolidé.',
        dataSource: 'Balance consolidée par société.',
        formula: 'Valeur affichée = données de balance par société pour chaque ligne du graphique',
        calculationMethod: 'Construire une ligne par agrégat de balance et la répartir société par société sans modifier les montants sources.',
        notes: 'Le graphique compare les contributions individuelles par société sur la balance consolidée.',
      };
    }

    if (mode === 'cash') {
      return {
        title: t('consolidation.companyBreakdown'),
        definition: 'Répartition de la trésorerie par société dans le portefeuille consolidé.',
        dataSource: 'Vue consolidée de trésorerie par société.',
        formula: 'Valeur affichée = solde de trésorerie par société',
        calculationMethod: 'Afficher les soldes de trésorerie individuels de chaque société dans le périmètre sélectionné.',
        notes: 'Aucune pondération n’est appliquée au niveau du graphique.',
      };
    }

    return {
      title: t('consolidation.companyBreakdown'),
      definition: 'Répartition du compte de résultat consolidé par société.',
      dataSource: 'Compte de résultat consolidé par société.',
      formula: 'Valeur affichée = revenus, charges ou résultat net par société selon la série sélectionnée',
      calculationMethod: 'Afficher, pour chaque catégorie du P&L, les montants consolidés par société à partir des données du portefeuille.',
      notes: 'Le graphique permet de comparer les contributions de chaque société sur les revenus, charges et résultat net.',
    };
  }, [mode, t]);

  if (chartData.rows.length === 0) {
    return (
      <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm">
        <CardContent className="p-6">
          <p className="text-slate-400 text-center text-sm">{t('consolidation.noData')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <PanelInfoPopover {...chartInfo} />
          <span>{t('consolidation.companyBreakdown')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData.rows} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(v) => {
                if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return v;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="circle"
              formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
            />
            {chartData.companies.map((companyName, idx) => (
              <Bar
                key={companyName}
                dataKey={companyName}
                stackId="stack"
                fill={COMPANY_COLORS[idx % COMPANY_COLORS.length]}
                radius={idx === chartData.companies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
