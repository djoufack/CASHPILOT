/**
 * Scenario Comparison Component
 * Compare two or more scenarios side by side with charts and metrics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, ArrowRight, FileDown } from 'lucide-react';
import useFinancialScenarios from '@/hooks/useFinancialScenarios';
import { Badge } from '@/components/ui/badge';
import { exportScenarioComparisonPDF } from '@/services/exportScenarioPDF';
import { useToast } from '@/components/ui/use-toast';

const ScenarioComparison = ({ scenarios }) => {
  const { getScenarioResults, compareScenarios } = useFinancialScenarios();
  const { toast } = useToast();

  const [scenario1Id, setScenario1Id] = useState('');
  const [scenario2Id, setScenario2Id] = useState('');
  const [scenario1Results, setScenario1Results] = useState(null);
  const [scenario2Results, setScenario2Results] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filter completed scenarios
  const completedScenarios = scenarios.filter(s => s.status === 'completed');

  // Load scenario results
  const loadScenarioResults = async (scenarioId, setResults) => {
    const results = await getScenarioResults(scenarioId);
    setResults(results);
  };

  // Run comparison when both scenarios are selected
  useEffect(() => {
    if (scenario1Id && scenario2Id && scenario1Id !== scenario2Id) {
      runComparison();
    }
  }, [scenario1Id, scenario2Id]);

  const runComparison = async () => {
    setLoading(true);
    try {
      // Load results for both scenarios
      await Promise.all([
        loadScenarioResults(scenario1Id, setScenario1Results),
        loadScenarioResults(scenario2Id, setScenario2Results),
      ]);

      // Run comparison
      const comparisonResult = await compareScenarios(scenario1Id, scenario2Id);
      setComparison(comparisonResult);
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    if (!comparison || !scenario1Results || !scenario2Results) return;

    try {
      const scenario1 = scenarios.find(s => s.id === scenario1Id);
      const scenario2 = scenarios.find(s => s.id === scenario2Id);

      await exportScenarioComparisonPDF(scenario1, scenario2, scenario1Results, scenario2Results, comparison);

      toast({
        title: 'Export réussi',
        description: 'Le rapport de comparaison PDF a été téléchargé avec succès',
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

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  // Merge data for charts
  const mergedData = scenario1Results && scenario2Results
    ? scenario1Results.map((r1, index) => ({
        period: r1.period_label,
        scenario1_revenue: r1.revenue,
        scenario2_revenue: scenario2Results[index]?.revenue || 0,
        scenario1_cash: r1.cashBalance,
        scenario2_cash: scenario2Results[index]?.cashBalance || 0,
        scenario1_margin: r1.ebitdaMargin,
        scenario2_margin: scenario2Results[index]?.ebitdaMargin || 0,
      }))
    : [];

  const scenario1Name = scenarios.find(s => s.id === scenario1Id)?.name || 'Scénario 1';
  const scenario2Name = scenarios.find(s => s.id === scenario2Id)?.name || 'Scénario 2';

  if (completedScenarios.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Comparaison impossible
          </h3>
          <p className="text-gray-600">
            Vous devez avoir au moins 2 scénarios complétés pour effectuer une comparaison
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scenario Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Comparaison de scénarios</CardTitle>
          <CardDescription>
            Sélectionnez deux scénarios complétés pour comparer leurs résultats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="text-sm font-medium mb-2 block">Premier scénario</label>
              <Select value={scenario1Id} onValueChange={setScenario1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {completedScenarios.map(scenario => (
                    <SelectItem
                      key={scenario.id}
                      value={scenario.id}
                      disabled={scenario.id === scenario2Id}
                    >
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Second scénario</label>
              <Select value={scenario2Id} onValueChange={setScenario2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {completedScenarios.map(scenario => (
                    <SelectItem
                      key={scenario.id}
                      value={scenario.id}
                      disabled={scenario.id === scenario1Id}
                    >
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Comparaison en cours...</p>
          </CardContent>
        </Card>
      )}

      {comparison && scenario1Results && scenario2Results && !loading && (
        <>
          {/* Summary Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Résumé de la comparaison</CardTitle>
              <CardDescription>
                Différences clés entre les deux scénarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Revenue Difference */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-blue-900">
                      Différence de CA final
                    </p>
                    {comparison.summary.finalRevenueDiff >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className={`text-2xl font-bold ${
                    comparison.summary.finalRevenueDiff >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {comparison.summary.finalRevenueDiff >= 0 ? '+' : ''}
                    {formatCurrency(comparison.summary.finalRevenueDiff)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {scenario1Name} vs {scenario2Name}
                  </p>
                </div>

                {/* Cash Difference */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-green-900">
                      Différence de trésorerie
                    </p>
                    {comparison.summary.finalCashDiff >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className={`text-2xl font-bold ${
                    comparison.summary.finalCashDiff >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {comparison.summary.finalCashDiff >= 0 ? '+' : ''}
                    {formatCurrency(comparison.summary.finalCashDiff)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {scenario1Name} vs {scenario2Name}
                  </p>
                </div>

                {/* Profit Difference */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-purple-900">
                      Différence de résultat net
                    </p>
                    {comparison.summary.finalProfitDiff >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className={`text-2xl font-bold ${
                    comparison.summary.finalProfitDiff >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {comparison.summary.finalProfitDiff >= 0 ? '+' : ''}
                    {formatCurrency(comparison.summary.finalProfitDiff)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {scenario1Name} vs {scenario2Name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Comparaison du chiffre d'affaires</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mergedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="scenario1_revenue"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name={scenario1Name}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario2_revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    name={scenario2Name}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cash Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Comparaison de la trésorerie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mergedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="scenario1_cash"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name={scenario1Name}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario2_cash"
                    stroke="#10b981"
                    strokeWidth={3}
                    name={scenario2Name}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Margin Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Comparaison des marges EBITDA</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mergedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    formatter={(value) => `${value.toFixed(1)}%`}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Bar dataKey="scenario1_margin" fill="#3b82f6" name={scenario1Name} />
                  <Bar dataKey="scenario2_margin" fill="#10b981" name={scenario2Name} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Comparison Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tableau de comparaison détaillé</CardTitle>
                  <CardDescription>
                    Évolution mois par mois des différences
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exporter PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Période</th>
                      <th className="px-4 py-2 text-right">Diff. CA</th>
                      <th className="px-4 py-2 text-right">Diff. CA %</th>
                      <th className="px-4 py-2 text-right">Diff. Tréso</th>
                      <th className="px-4 py-2 text-right">Diff. Tréso %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {comparison.revenueDifference.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{item.date}</td>
                        <td className={`px-4 py-2 text-right ${
                          item.difference >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.difference >= 0 ? '+' : ''}
                          {formatCurrency(item.difference)}
                        </td>
                        <td className={`px-4 py-2 text-right ${
                          item.percentDiff >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.percentDiff >= 0 ? '+' : ''}
                          {item.percentDiff.toFixed(1)}%
                        </td>
                        <td className={`px-4 py-2 text-right ${
                          comparison.cashFlowDifference[index]?.difference >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {comparison.cashFlowDifference[index]?.difference >= 0 ? '+' : ''}
                          {formatCurrency(comparison.cashFlowDifference[index]?.difference || 0)}
                        </td>
                        <td className={`px-4 py-2 text-right ${
                          comparison.cashFlowDifference[index]?.percentDiff >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {comparison.cashFlowDifference[index]?.percentDiff >= 0 ? '+' : ''}
                          {(comparison.cashFlowDifference[index]?.percentDiff || 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ScenarioComparison;
