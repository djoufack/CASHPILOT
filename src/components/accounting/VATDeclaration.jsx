
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Receipt, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/utils/calculations';

const VATDeclaration = ({ outputVAT, inputVAT, vatPayable, vatBreakdown, monthlyData, period, onExportPDF }) => {

  // Build monthly VAT data from monthlyData
  const monthlyVATData = (monthlyData || []).map(m => ({
    name: m.name,
    collectee: m.revenue * 0.2, // Rough estimate
    deductible: m.expense * 0.2,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Déclaration TVA
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <ArrowUp className="w-4 h-4" />
              <span className="text-sm font-medium">TVA collectée</span>
            </div>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(outputVAT || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Sur les ventes</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <ArrowDown className="w-4 h-4" />
              <span className="text-sm font-medium">TVA déductible</span>
            </div>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(inputVAT || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Sur les achats</p>
          </CardContent>
        </Card>

        <Card className={`border-gray-800 ${(vatPayable || 0) > 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-green-500/5 border-green-500/30'}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-400">TVA à payer</span>
            </div>
            <p className={`text-2xl font-bold ${(vatPayable || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(vatPayable || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(vatPayable || 0) > 0 ? 'À reverser au Trésor' : 'Crédit de TVA'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Output VAT detail */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-green-400">Détail TVA collectée</CardTitle>
          </CardHeader>
          <CardContent>
            {vatBreakdown?.output?.length > 0 ? (
              <div className="space-y-2">
                {vatBreakdown.output.map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <Badge className="bg-green-500/20 text-green-400 text-xs">{(item.rate * 100).toFixed(1)}%</Badge>
                      <span className="text-xs text-gray-500 ml-2">Base : {formatCurrency(item.base)}</span>
                    </div>
                    <span className="font-mono text-sm text-white">{formatCurrency(item.vat)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Aucune TVA collectée sur cette période</p>
            )}
          </CardContent>
        </Card>

        {/* Input VAT detail */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-400">Détail TVA déductible</CardTitle>
          </CardHeader>
          <CardContent>
            {vatBreakdown?.input?.length > 0 ? (
              <div className="space-y-2">
                {vatBreakdown.input.map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <Badge className="bg-blue-500/20 text-blue-400 text-xs">{(item.rate * 100).toFixed(1)}%</Badge>
                      <span className="text-xs text-gray-500 ml-2">Base : {formatCurrency(item.base)}</span>
                    </div>
                    <span className="font-mono text-sm text-white">{formatCurrency(item.vat)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Aucune TVA déductible sur cette période</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly chart */}
      {monthlyVATData.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-gradient text-sm">Historique mensuel TVA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyVATData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="collectee" fill="#22C55E" name="Collectée" />
                  <Bar dataKey="deductible" fill="#3B82F6" name="Déductible" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VATDeclaration;
