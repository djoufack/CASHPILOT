/**
 * Simulation Results Component
 * Displays simulation results with charts and key metrics
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Droplets,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  FileDown,
  Sparkles,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportScenarioSimulationPDF } from '@/services/exportScenarioPDF';
import { useToast } from '@/components/ui/use-toast';

const DARK_CARD = 'border-white/10 bg-slate-950/80 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]';
const STAT_CARD =
  'border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-950/70 text-white';

const isVariableSeries = (results, key) => {
  if (!Array.isArray(results) || results.length < 2) {
    return false;
  }

  const values = results
    .map((result) => Number(result?.[key] ?? 0))
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) {
    return false;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return Math.abs(max - min) > 0.01;
};

const SimulationResults = ({ scenario, results, assumptions, currency = 'EUR' }) => {
  const { toast } = useToast();
  const [activeChart, setActiveChart] = useState('revenue');

  const handleExportPDF = async () => {
    try {
      await exportScenarioSimulationPDF(scenario, results, assumptions);
      toast({
        title: 'Export réussi',
        description: 'Le rapport PDF a été téléchargé avec succès',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Erreur d\'export',
        description: error.message || 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(value) || 0);

  const formatFullCurrency = (value) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);

  const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

  const analytics = useMemo(() => {
    if (!results?.length) {
      return null;
    }

    const firstPeriod = results[0];
    const lastPeriod = results[results.length - 1];
    const revenueVariable = isVariableSeries(results, 'revenue');
    const expensesVariable = isVariableSeries(results, 'expenses');
    const cashVariable = isVariableSeries(results, 'cashBalance');
    const profitabilityVariable = isVariableSeries(results, 'netMargin');

    const insights = [];

    if (!revenueVariable && !expensesVariable) {
      insights.push({
        tone: 'warning',
        title: 'Projection très stable',
        description:
          'Vos hypothèses actuelles produisent surtout des montants constants. Pour obtenir une trajectoire plus dynamique, utilisez une date de fin avec un montant fixe, un taux de croissance ou une variation en %.',
      });
    } else if (revenueVariable) {
      insights.push({
        tone: 'success',
        title: 'Courbe de revenus dynamique',
        description:
          'Le chiffre d’affaires évolue bien sur la période. Vous pouvez maintenant comparer son impact sur la trésorerie et la marge.',
      });
    }

    if (!cashVariable) {
      insights.push({
        tone: 'neutral',
        title: 'Trésorerie peu sensible',
        description:
          'Ajoutez des hypothèses de délais de paiement, de BFR ou d’investissement pour faire varier davantage la trésorerie.',
      });
    }

    return {
      firstPeriod,
      lastPeriod,
      revenueVariable,
      expensesVariable,
      cashVariable,
      profitabilityVariable,
      insights,
      summary: {
        revenue: {
          start: firstPeriod.revenue,
          end: lastPeriod.revenue,
          growth:
            Math.abs(Number(firstPeriod.revenue) || 0) > 0.001
              ? (((lastPeriod.revenue || 0) - (firstPeriod.revenue || 0)) / firstPeriod.revenue) * 100
              : 0,
        },
        cashBalance: {
          start: firstPeriod.cashBalance,
          end: lastPeriod.cashBalance,
          change: (lastPeriod.cashBalance || 0) - (firstPeriod.cashBalance || 0),
        },
        ebitdaMargin: {
          start: firstPeriod.ebitdaMargin,
          end: lastPeriod.ebitdaMargin,
          change: (lastPeriod.ebitdaMargin || 0) - (firstPeriod.ebitdaMargin || 0),
        },
        netMargin: {
          start: firstPeriod.netMargin,
          end: lastPeriod.netMargin,
          change: (lastPeriod.netMargin || 0) - (firstPeriod.netMargin || 0),
        },
      },
    };
  }, [results]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
          <p className="mb-2 text-sm font-semibold text-white">{label}</p>
          {payload.map((entry) => (
            <p key={entry.dataKey} className="text-xs text-slate-300" style={{ color: entry.color }}>
              {entry.name}:{' '}
              {typeof entry.value === 'number'
                ? entry.name.includes('%')
                  ? formatPercent(entry.value)
                  : formatFullCurrency(entry.value)
                : entry.value}
            </p>
          ))}
        </div>
      );
    }

    return null;
  };

  if (!results || results.length === 0) {
    return (
      <Card className={DARK_CARD}>
        <CardContent className="py-12 text-center">
          <p className="text-slate-400">Aucun résultat disponible</p>
        </CardContent>
      </Card>
    );
  }

  const { firstPeriod, lastPeriod, summary, insights } = analytics;

  return (
    <div className="space-y-6">
      {insights.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {insights.map((insight) => (
            <div
              key={insight.title}
              className={[
                'rounded-2xl border px-4 py-3',
                insight.tone === 'success'
                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                  : insight.tone === 'warning'
                    ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                    : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                {insight.tone === 'success' ? (
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Waves className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{insight.title}</p>
                  <p className="mt-1 text-sm opacity-90">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className={STAT_CARD}>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
                <TrendingUp className="h-5 w-5 text-blue-300" />
              </div>
              {summary.revenue.growth >= 0 ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-300" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-rose-300" />
              )}
            </div>
            <p className="text-sm text-slate-400">Croissance du CA</p>
            <p className={`mt-2 text-3xl font-semibold ${summary.revenue.growth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {summary.revenue.growth >= 0 ? '+' : ''}
              {summary.revenue.growth.toFixed(1)}%
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {formatCurrency(firstPeriod.revenue)} → {formatCurrency(lastPeriod.revenue)}
            </p>
          </CardContent>
        </Card>

        <Card className={STAT_CARD}>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                <DollarSign className="h-5 w-5 text-emerald-300" />
              </div>
              {summary.cashBalance.change >= 0 ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-300" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-rose-300" />
              )}
            </div>
            <p className="text-sm text-slate-400">Trésorerie finale</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {formatCurrency(lastPeriod.cashBalance)}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Variation: {formatCurrency(summary.cashBalance.change)}
            </p>
          </CardContent>
        </Card>

        <Card className={STAT_CARD}>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
                <BarChart3 className="h-5 w-5 text-fuchsia-300" />
              </div>
              {summary.ebitdaMargin.change >= 0 ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-300" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-rose-300" />
              )}
            </div>
            <p className="text-sm text-slate-400">Marge EBITDA finale</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {formatPercent(lastPeriod.ebitdaMargin)}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {summary.ebitdaMargin.change >= 0 ? '+' : ''}
              {summary.ebitdaMargin.change.toFixed(1)} pts
            </p>
          </CardContent>
        </Card>

        <Card className={STAT_CARD}>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl border border-orange-400/20 bg-orange-500/10 p-3">
                <Droplets className="h-5 w-5 text-orange-300" />
              </div>
              {summary.netMargin.change >= 0 ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-300" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-rose-300" />
              )}
            </div>
            <p className="text-sm text-slate-400">Marge nette finale</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {formatPercent(lastPeriod.netMargin)}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {summary.netMargin.change >= 0 ? '+' : ''}
              {summary.netMargin.change.toFixed(1)} pts
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className={DARK_CARD}>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-white">Évolution financière</CardTitle>
              <CardDescription className="text-slate-400">
                Projection mois par mois sur {results.length} périodes
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  CA {analytics.revenueVariable ? 'variable' : 'stable'}
                </Badge>
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  Dépenses {analytics.expensesVariable ? 'variables' : 'stables'}
                </Badge>
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  Trésorerie {analytics.cashVariable ? 'variable' : 'stable'}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exporter PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeChart} onValueChange={setActiveChart}>
            <TabsList className="mb-6 grid w-full grid-cols-2 gap-2 border border-white/10 bg-slate-900/90 p-1 md:grid-cols-4">
              <TabsTrigger value="revenue" className="text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                Revenus & Marges
              </TabsTrigger>
              <TabsTrigger value="cash" className="text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                Trésorerie
              </TabsTrigger>
              <TabsTrigger value="profitability" className="text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                Rentabilité
              </TabsTrigger>
              <TabsTrigger value="balance" className="text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                Bilan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-4">
              <ResponsiveContainer width="100%" height={420}>
                <AreaChart data={results}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f8cff" stopOpacity={0.65} />
                      <stop offset="95%" stopColor="#4f8cff" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4f8cff"
                    fill="url(#colorRevenue)"
                    fillOpacity={1}
                    strokeWidth={2.5}
                    name="Chiffre d'affaires"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ff6b6b"
                    fill="url(#colorExpenses)"
                    fillOpacity={1}
                    strokeWidth={2}
                    name="Dépenses"
                  />
                  <Line
                    type="monotone"
                    dataKey="ebitda"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                    name="EBITDA"
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-200">CA final</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.revenue)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">EBITDA final</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.ebitda)}</p>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-200">Marge EBITDA</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(lastPeriod.ebitdaMargin)}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cash" className="space-y-4">
              <ResponsiveContainer width="100%" height={420}>
                <LineChart data={results}>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                  <Line type="monotone" dataKey="cashBalance" stroke="#34d399" strokeWidth={3} name="Solde de trésorerie" dot={false} />
                  <Line type="monotone" dataKey="operatingCashFlow" stroke="#4f8cff" strokeWidth={2} name="Flux opérationnel" strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="caf" stroke="#c084fc" strokeWidth={2} name="CAF" strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">Trésorerie finale</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.cashBalance)}</p>
                </div>
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-200">Flux opérationnel</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.operatingCashFlow)}</p>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-200">CAF</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.caf)}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="profitability" className="space-y-4">
              <ResponsiveContainer width="100%" height={420}>
                <LineChart data={results}>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => `${Number(value || 0).toFixed(0)}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                  <Line type="monotone" dataKey="ebitdaMargin" stroke="#34d399" strokeWidth={2.5} name="Marge EBITDA %" dot={false} />
                  <Line type="monotone" dataKey="operatingMargin" stroke="#4f8cff" strokeWidth={2.5} name="Marge opérationnelle %" dot={false} />
                  <Line type="monotone" dataKey="netMargin" stroke="#c084fc" strokeWidth={2.5} name="Marge nette %" dot={false} />
                </LineChart>
              </ResponsiveContainer>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">Marge EBITDA</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(lastPeriod.ebitdaMargin)}</p>
                </div>
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-200">Marge opé.</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(lastPeriod.operatingMargin)}</p>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-200">Marge nette</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(lastPeriod.netMargin)}</p>
                </div>
                <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-200">ROE</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(lastPeriod.roe)}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="balance" className="space-y-4">
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={results}>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                  <Bar dataKey="currentAssets" fill="#4f8cff" name="Actifs circulants" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="fixedAssets" fill="#c084fc" name="Actifs immobilisés" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="equity" fill="#34d399" name="Capitaux propres" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="debt" fill="#ff6b6b" name="Dettes" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-200">Actifs totaux</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.totalAssets)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">Capitaux propres</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.equity)}</p>
                </div>
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose-200">Dettes</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(lastPeriod.debt)}</p>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-200">Ratio D/E</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{Number(lastPeriod.debtToEquity || 0).toFixed(2)}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {assumptions && assumptions.length > 0 && (
        <Card className={DARK_CARD}>
          <CardHeader>
            <CardTitle className="text-white">Hypothèses appliquées</CardTitle>
            <CardDescription className="text-slate-400">
              {assumptions.length} hypothèse(s) utilisée(s) dans cette simulation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {assumptions.map((assumption) => (
                <Badge key={assumption.id || assumption.name} className="border-white/10 bg-white/5 text-slate-200">
                  {assumption.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimulationResults;
