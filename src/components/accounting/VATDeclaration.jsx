
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Receipt, ArrowDown, ArrowUp, Minus, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/utils/calculations';

const COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const VATDeclaration = ({ outputVAT, inputVAT, vatPayable, vatBreakdown, monthlyData, period, onExportPDF, onExportHTML }) => {

  // Build monthly VAT data - use real data when available
  const monthlyVATData = (monthlyData || []).map(m => {
    const collectee = m.outputVAT || m.revenue * 0.1925;
    const deductible = m.inputVAT || m.expense * 0.1925;
    return {
      name: m.name,
      collectee: Math.round(collectee),
      deductible: Math.round(deductible),
      net: Math.round(collectee - deductible),
    };
  });

  // Build donut data from breakdown
  const donutData = [];
  if (vatBreakdown?.output?.length > 0) {
    vatBreakdown.output.forEach(item => {
      const label = item.name || item.account || `${((item.rate || 0) * 100).toFixed(1)}%`;
      donutData.push({ name: `Collectee: ${label}`, value: Math.abs(item.vat || 0) });
    });
  }
  if (vatBreakdown?.input?.length > 0) {
    vatBreakdown.input.forEach(item => {
      const label = item.name || item.account || `${((item.rate || 0) * 100).toFixed(1)}%`;
      donutData.push({ name: `Deductible: ${label}`, value: Math.abs(item.vat || 0) });
    });
  }

  // Format breakdown item display - handle both legacy and entry-based formats
  const formatBreakdownItem = (item) => {
    const rate = item.rate ? `${(item.rate * 100).toFixed(1)}%` : null;
    const base = item.base ? formatCurrency(item.base) : null;
    return { rate, base };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Declaration TVA
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <ArrowUp className="w-4 h-4" />
              <span className="text-sm font-medium">TVA collectee</span>
            </div>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(outputVAT || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Sur les ventes</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <ArrowDown className="w-4 h-4" />
              <span className="text-sm font-medium">TVA deductible</span>
            </div>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(inputVAT || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Sur les achats</p>
          </CardContent>
        </Card>

        <Card className={`border-gray-800 ${(vatPayable || 0) > 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-green-500/5 border-green-500/30'}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-400">TVA nette</span>
            </div>
            <p className={`text-2xl font-bold ${(vatPayable || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(vatPayable || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(vatPayable || 0) > 0 ? 'A reverser au Tresor' : 'Credit de TVA'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts: Monthly + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly bar chart - 2/3 width */}
        <Card className="bg-gray-900 border-gray-800 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Historique mensuel TVA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {monthlyVATData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVATData} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="gradCollectee" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity={1} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="gradDeductible" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => formatCurrency(value)}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
                    <Bar dataKey="collectee" fill="url(#gradCollectee)" name="Collectee" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="deductible" fill="url(#gradDeductible)" name="Deductible" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p className="text-sm">Aucune donnee pour cette periode</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Donut chart - 1/3 width */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" /> Repartition TVA
            </CardTitle>
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
                      {donutData.map((_, index) => (
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
                  <p className="text-sm">Aucune ventilation disponible</p>
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

      {/* Breakdown by account/rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Output VAT detail */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-green-400 flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5" /> Detail TVA collectee
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vatBreakdown?.output?.length > 0 ? (
              <div className="space-y-2">
                {vatBreakdown.output.map((item, i) => {
                  const { rate, base } = formatBreakdownItem(item);
                  return (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                      <div className="flex items-center gap-2">
                        {rate && <Badge className="bg-green-500/20 text-green-400 text-xs">{rate}</Badge>}
                        {item.account && <span className="text-xs text-gray-500 font-mono">{item.account}</span>}
                        {item.name && <span className="text-xs text-gray-400">{item.name}</span>}
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm text-white">{formatCurrency(item.vat)}</span>
                        {base && <p className="text-xs text-gray-500">Base: {base}</p>}
                      </div>
                    </div>
                  );
                })}
                {/* Total */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-sm font-semibold text-gray-300">Total collectee</span>
                  <span className="font-mono text-sm font-bold text-green-400">{formatCurrency(outputVAT || 0)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Aucune TVA collectee sur cette periode</p>
            )}
          </CardContent>
        </Card>

        {/* Input VAT detail */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5" /> Detail TVA deductible
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vatBreakdown?.input?.length > 0 ? (
              <div className="space-y-2">
                {vatBreakdown.input.map((item, i) => {
                  const { rate, base } = formatBreakdownItem(item);
                  return (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                      <div className="flex items-center gap-2">
                        {rate && <Badge className="bg-blue-500/20 text-blue-400 text-xs">{rate}</Badge>}
                        {item.account && <span className="text-xs text-gray-500 font-mono">{item.account}</span>}
                        {item.name && <span className="text-xs text-gray-400">{item.name}</span>}
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm text-white">{formatCurrency(item.vat)}</span>
                        {base && <p className="text-xs text-gray-500">Base: {base}</p>}
                      </div>
                    </div>
                  );
                })}
                {/* Total */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-sm font-semibold text-gray-300">Total deductible</span>
                  <span className="font-mono text-sm font-bold text-blue-400">{formatCurrency(inputVAT || 0)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Aucune TVA deductible sur cette periode</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VATDeclaration;
