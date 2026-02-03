/**
 * Simulation Results Component
 * Displays simulation results with charts and key metrics
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportScenarioSimulationPDF } from '@/services/exportScenarioPDF';
import { useToast } from '@/components/ui/use-toast';

const SimulationResults = ({ scenario, results, assumptions }) => {
  const { toast } = useToast();
  const [activeChart, setActiveChart] = useState('revenue');

  // Handle PDF export
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

  if (!results || results.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">Aucun résultat disponible</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary metrics
  const firstPeriod = results[0];
  const lastPeriod = results[results.length - 1];

  const summary = {
    revenue: {
      start: firstPeriod.revenue,
      end: lastPeriod.revenue,
      growth: ((lastPeriod.revenue - firstPeriod.revenue) / firstPeriod.revenue) * 100,
    },
    cashBalance: {
      start: firstPeriod.cashBalance,
      end: lastPeriod.cashBalance,
      change: lastPeriod.cashBalance - firstPeriod.cashBalance,
    },
    ebitdaMargin: {
      start: firstPeriod.ebitdaMargin,
      end: lastPeriod.ebitdaMargin,
      change: lastPeriod.ebitdaMargin - firstPeriod.ebitdaMargin,
    },
    netMargin: {
      start: firstPeriod.netMargin,
      end: lastPeriod.netMargin,
      change: lastPeriod.netMargin - firstPeriod.netMargin,
    },
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-sm mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}:{' '}
              {typeof entry.value === 'number'
                ? entry.name.includes('%')
                  ? `${entry.value.toFixed(1)}%`
                  : new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(entry.value)
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Growth */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              {summary.revenue.growth >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">Croissance du CA</p>
            <p
              className={`text-2xl font-bold ${
                summary.revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {summary.revenue.growth >= 0 ? '+' : ''}
              {summary.revenue.growth.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {formatCurrency(firstPeriod.revenue)} → {formatCurrency(lastPeriod.revenue)}
            </p>
          </CardContent>
        </Card>

        {/* Cash Balance */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              {summary.cashBalance.change >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">Trésorerie finale</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(lastPeriod.cashBalance)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Variation: {formatCurrency(summary.cashBalance.change)}
            </p>
          </CardContent>
        </Card>

        {/* EBITDA Margin */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              {summary.ebitdaMargin.change >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">Marge EBITDA finale</p>
            <p className="text-2xl font-bold text-gray-900">
              {lastPeriod.ebitdaMargin.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {summary.ebitdaMargin.change >= 0 ? '+' : ''}
              {summary.ebitdaMargin.change.toFixed(1)}% pts
            </p>
          </CardContent>
        </Card>

        {/* Net Margin */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Droplets className="w-5 h-5 text-orange-600" />
              </div>
              {summary.netMargin.change >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">Marge nette finale</p>
            <p className="text-2xl font-bold text-gray-900">
              {lastPeriod.netMargin.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {summary.netMargin.change >= 0 ? '+' : ''}
              {summary.netMargin.change.toFixed(1)}% pts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Évolution financière</CardTitle>
              <CardDescription>
                Projection mois par mois sur {results.length} périodes
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              Exporter PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeChart} onValueChange={setActiveChart}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="revenue">Revenus & Marges</TabsTrigger>
              <TabsTrigger value="cash">Trésorerie</TabsTrigger>
              <TabsTrigger value="profitability">Rentabilité</TabsTrigger>
              <TabsTrigger value="balance">Bilan</TabsTrigger>
            </TabsList>

            {/* Revenue & Margins Chart */}
            <TabsContent value="revenue" className="space-y-4">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={results}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Chiffre d'affaires"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                    name="Dépenses"
                  />
                  <Line
                    type="monotone"
                    dataKey="ebitda"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="EBITDA"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">CA Final</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatCurrency(lastPeriod.revenue)}
                  </p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">EBITDA Final</p>
                  <p className="text-lg font-bold text-green-900">
                    {formatCurrency(lastPeriod.ebitda)}
                  </p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Marge EBITDA</p>
                  <p className="text-lg font-bold text-purple-900">
                    {lastPeriod.ebitdaMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Cash Flow Chart */}
            <TabsContent value="cash" className="space-y-4">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={results}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cashBalance"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Solde de trésorerie"
                  />
                  <Line
                    type="monotone"
                    dataKey="operatingCashFlow"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Flux de trésorerie"
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="caf"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="CAF"
                    strokeDasharray="3 3"
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Trésorerie Finale</p>
                  <p className="text-lg font-bold text-green-900">
                    {formatCurrency(lastPeriod.cashBalance)}
                  </p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Flux Opérationnel</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatCurrency(lastPeriod.operatingCashFlow)}
                  </p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">CAF</p>
                  <p className="text-lg font-bold text-purple-900">
                    {formatCurrency(lastPeriod.caf)}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Profitability Chart */}
            <TabsContent value="profitability" className="space-y-4">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={results}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" />
                  <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ebitdaMargin"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Marge EBITDA %"
                  />
                  <Line
                    type="monotone"
                    dataKey="operatingMargin"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Marge Opérationnelle %"
                  />
                  <Line
                    type="monotone"
                    dataKey="netMargin"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Marge Nette %"
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Marge EBITDA</p>
                  <p className="text-lg font-bold text-green-900">
                    {lastPeriod.ebitdaMargin.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Marge Opé.</p>
                  <p className="text-lg font-bold text-blue-900">
                    {lastPeriod.operatingMargin.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Marge Nette</p>
                  <p className="text-lg font-bold text-purple-900">
                    {lastPeriod.netMargin.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-orange-600 font-medium">ROE</p>
                  <p className="text-lg font-bold text-orange-900">
                    {lastPeriod.roe.toFixed(1)}%
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Balance Sheet Chart */}
            <TabsContent value="balance" className="space-y-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={results}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period_label" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="currentAssets" fill="#3b82f6" name="Actifs Circulants" />
                  <Bar dataKey="fixedAssets" fill="#8b5cf6" name="Actifs Immobilisés" />
                  <Bar dataKey="equity" fill="#10b981" name="Capitaux Propres" />
                  <Bar dataKey="debt" fill="#ef4444" name="Dettes" />
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Actifs Totaux</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatCurrency(lastPeriod.totalAssets)}
                  </p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Capitaux Propres</p>
                  <p className="text-lg font-bold text-green-900">
                    {formatCurrency(lastPeriod.equity)}
                  </p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">Dettes</p>
                  <p className="text-lg font-bold text-red-900">
                    {formatCurrency(lastPeriod.debt)}
                  </p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Ratio D/E</p>
                  <p className="text-lg font-bold text-purple-900">
                    {lastPeriod.debtToEquity.toFixed(2)}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Assumptions Summary */}
      {assumptions && assumptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hypothèses appliquées</CardTitle>
            <CardDescription>
              {assumptions.length} hypothèse(s) utilisée(s) dans cette simulation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {assumptions.map((assumption, index) => (
                <Badge key={index} variant="outline" className="text-xs">
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
