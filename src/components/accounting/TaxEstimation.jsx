
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Calculator, TrendingUp, Banknote } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import { estimateTax, DEFAULT_TAX_BRACKETS } from '@/utils/accountingCalculations';

const TaxEstimation = ({ netIncome, taxEstimate: initialEstimate, period, onExportPDF }) => {
  const [brackets, setBrackets] = useState(DEFAULT_TAX_BRACKETS);
  const [customMode, setCustomMode] = useState(false);

  const taxEstimate = customMode ? estimateTax(netIncome > 0 ? netIncome : 0, brackets) : initialEstimate;

  const updateBracket = (index, field, value) => {
    const updated = [...brackets];
    updated[index] = { ...updated[index], [field]: field === 'label' ? value : parseFloat(value) || 0 };
    setBrackets(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Estimation d'impôt
          </h2>
          {period && (
            <p className="text-sm text-gray-400">
              Du {new Date(period.startDate).toLocaleDateString('fr-FR')} au {new Date(period.endDate).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        {onExportPDF && (
          <Button variant="outline" size="sm" onClick={onExportPDF} className="border-gray-700 text-gray-300">
            <Download className="w-4 h-4 mr-2" /> Exporter PDF
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Bénéfice imposable</span>
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
              <span className="text-sm font-medium">Impôt estimé</span>
            </div>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(taxEstimate?.totalTax || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Taux effectif : {((taxEstimate?.effectiveRate || 0) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Calculator className="w-4 h-4" />
              <span className="text-sm font-medium">Provision trimestrielle</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(taxEstimate?.quarterlyPayment || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Par trimestre</p>
          </CardContent>
        </Card>
      </div>

      {/* Tax details */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-gradient text-sm">Détail du calcul</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomMode(!customMode)}
              className="text-xs text-gray-400"
            >
              {customMode ? 'Tranches par défaut' : 'Personnaliser les tranches'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {taxEstimate?.details?.map((detail, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                  {(detail.rate * 100).toFixed(0)}%
                </Badge>
                <div>
                  <span className="text-sm text-gray-300">{detail.label}</span>
                  <p className="text-xs text-gray-500">Sur {formatCurrency(detail.taxableAmount)}</p>
                </div>
              </div>
              <span className="font-mono text-sm text-white font-medium">{formatCurrency(detail.tax)}</span>
            </div>
          ))}

          {(!taxEstimate?.details || taxEstimate.details.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">
              {netIncome <= 0 ? 'Aucun impôt à payer (résultat négatif ou nul)' : 'Aucun calcul disponible'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Custom brackets editor */}
      {customMode && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Tranches d'imposition personnalisées</CardTitle>
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
                  <Label className="text-xs text-gray-500">À</Label>
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
                  <Label className="text-xs text-gray-500">Libellé</Label>
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
