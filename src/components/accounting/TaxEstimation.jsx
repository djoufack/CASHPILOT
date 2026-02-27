
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Calculator, TrendingUp, Banknote, Calendar, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/utils/calculations';
import { estimateTax, DEFAULT_TAX_BRACKETS } from '@/utils/accountingCalculations';

const COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

const TaxEstimation = ({ netIncome, taxEstimate: initialEstimate, period, onExportPDF, onExportHTML }) => {
  const [brackets, setBrackets] = useState(DEFAULT_TAX_BRACKETS);
  const [customMode, setCustomMode] = useState(false);

  const taxEstimate = customMode ? estimateTax(netIncome > 0 ? netIncome : 0, brackets) : initialEstimate;
  const effectiveRate = (taxEstimate?.effectiveRate || 0) * 100;

  const updateBracket = (index, field, value) => {
    const updated = [...brackets];
    updated[index] = { ...updated[index], [field]: field === 'label' ? value : parseFloat(value) || 0 };
    setBrackets(updated);
  };

  // Donut chart data from bracket details
  const donutData = (taxEstimate?.details || [])
    .filter(d => d.tax > 0)
    .map(d => ({ name: d.label, value: d.tax }));

  // Quarterly payment schedule
  const quarterly = taxEstimate?.quarterlyPayment || 0;
  const quarters = [
    { label: 'T1', period: 'Jan - Mar', due: '31 mars' },
    { label: 'T2', period: 'Avr - Jun', due: '30 juin' },
    { label: 'T3', period: 'Jul - Sep', due: '30 sept' },
    { label: 'T4', period: 'Oct - Dec', due: '31 dec' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Estimation d'impot
          </h2>
          {period && (
            <p className="text-sm text-gray-400">
              Du {new Date(period.startDate).toLocaleDateString('fr-FR')} au {new Date(period.endDate).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF} className="border-gray-700 text-gray-300">
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
          )}
          {onExportHTML && (
            <Button variant="outline" size="sm" onClick={onExportHTML} className="border-gray-700 text-gray-300">
              <FileText className="w-4 h-4 mr-2" /> HTML
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Benefice imposable</span>
            </div>
            <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(netIncome || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Banknote className="w-4 h-4" />
              <span className="text-sm font-medium">Impot estime</span>
            </div>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(taxEstimate?.totalTax || 0)}</p>
            {/* Effective rate progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Taux effectif</span>
                <span className="text-orange-400 font-semibold">{effectiveRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                  style={{ width: `${Math.min(effectiveRate * 2, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Calculator className="w-4 h-4" />
              <span className="text-sm font-medium">Revenu net apres impot</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {formatCurrency(Math.max((netIncome || 0) - (taxEstimate?.totalTax || 0), 0))}
            </p>
            <p className="text-xs text-gray-500 mt-1">Benefice - Impot</p>
          </CardContent>
        </Card>
      </div>

      {/* Tax Breakdown: Detail + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Detail - 2/3 */}
        <Card className="bg-gray-900 border-gray-800 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm text-gray-400">Detail par tranche</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomMode(!customMode)}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                {customMode ? 'Tranches par defaut' : 'Personnaliser'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {taxEstimate?.details?.map((detail, i) => {
              const pct = netIncome > 0 ? (detail.taxableAmount / netIncome) * 100 : 0;
              return (
                <div key={i} className="group">
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-10 text-center">
                      <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                        {(detail.rate * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-300">{detail.label}</span>
                        <span className="font-mono text-sm text-white font-medium">{formatCurrency(detail.tax)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-1">
                          <div
                            className="h-1 rounded-full"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: COLORS[i % COLORS.length]
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-24 text-right">
                          sur {formatCurrency(detail.taxableAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {(!taxEstimate?.details || taxEstimate.details.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">
                {netIncome <= 0 ? 'Aucun impot (resultat negatif ou nul)' : 'Aucun calcul disponible'}
              </p>
            )}

            {/* Total line */}
            {taxEstimate?.details?.length > 0 && (
              <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-700">
                <span className="text-sm font-semibold text-gray-300">Total impot</span>
                <span className="font-mono text-sm font-bold text-orange-400">{formatCurrency(taxEstimate?.totalTax || 0)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut - 1/3 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Repartition par tranche</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p className="text-sm">Pas de donnees</p>
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="space-y-1 mt-2">
              {donutData.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-400 truncate">{item.name}</span>
                  <span className="text-gray-300 ml-auto font-mono">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Payments */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Echeancier de paiement trimestriel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quarters.map((q, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">{q.period}</div>
                <div className="text-lg font-bold text-gray-100">{formatCurrency(quarterly)}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                  <ChevronRight className="w-3 h-3" /> Echeance: {q.due}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-700">
            <span className="text-sm text-gray-400">Total annuel</span>
            <span className="font-mono text-sm font-bold text-orange-400">{formatCurrency(taxEstimate?.totalTax || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Custom brackets editor */}
      {customMode && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Tranches d'imposition personnalisees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {brackets.map((bracket, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">De</Label>
                  <Input type="number" value={bracket.min} onChange={e => updateBracket(i, 'min', e.target.value)}
                    className="bg-gray-800 border-gray-700 text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">A</Label>
                  <Input type="number" value={bracket.max === Infinity ? '' : bracket.max}
                    onChange={e => updateBracket(i, 'max', e.target.value || Infinity)}
                    placeholder="∞" className="bg-gray-800 border-gray-700 text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Taux (%)</Label>
                  <Input type="number" step="0.01" value={(bracket.rate * 100).toFixed(2)}
                    onChange={e => updateBracket(i, 'rate', parseFloat(e.target.value) / 100)}
                    className="bg-gray-800 border-gray-700 text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Libelle</Label>
                  <Input value={bracket.label} onChange={e => updateBracket(i, 'label', e.target.value)}
                    className="bg-gray-800 border-gray-700 text-xs h-8" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TaxEstimation;
