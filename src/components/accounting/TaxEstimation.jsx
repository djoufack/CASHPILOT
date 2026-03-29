import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Calculator, TrendingUp, Banknote, Calendar, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatDate } from '@/utils/dateLocale';
import { formatCurrency } from '@/utils/calculations';
import { estimateTax, DEFAULT_TAX_BRACKETS } from '@/utils/accountingCalculations';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { useAccountingInit } from '@/hooks/useAccountingInit';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/lib/supabase';

/**
 * Build country-aware initial tax brackets for the custom simulator.
 * Priority: DB tax_rules (corporate_tax type) → DEFAULT_TAX_BRACKETS.
 * ENF-1: no hardcoded rates — fetched from tax_rules table in DB.
 */
function useCorporateTaxBrackets(country) {
  const { data: dbRules } = useSupabaseQuery(
    async () => {
      if (!supabase || !country) return [];
      const { data, error } = await supabase
        .from('tax_rules')
        .select('*')
        .eq('country_code', country)
        .eq('tax_type', 'corporate_tax')
        .order('min_amount', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    { deps: [country], defaultData: [], enabled: !!country }
  );

  return useMemo(() => {
    if (dbRules && dbRules.length > 0) {
      return dbRules.map((rule, i) => ({
        min: rule.min_amount ?? 0,
        max: rule.max_amount ?? (i === dbRules.length - 1 ? Infinity : (dbRules[i + 1]?.min_amount ?? Infinity)),
        rate: rule.rate ?? 0,
        label: rule.name || rule.description || `Tranche ${i + 1}`,
      }));
    }
    return DEFAULT_TAX_BRACKETS;
  }, [dbRules]);
}

const COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

const TAX_PANEL_INFO = {
  taxableIncome: {
    title: 'Benefice imposable',
    definition: "Resultat net soumis au calcul d'impot sur la periode selectionnee.",
    dataSource: 'Valeur `netIncome` issue des aggregats comptables SQL (`useAccountingData`).',
    formula: 'Benefice imposable = Resultat net comptable retenu pour la fiscalite',
    calculationMethod:
      'Le montant provient du compte de resultat; s il est negatif ou nul, l assiette fiscale est ramenee a 0.',
  },
  estimatedTax: {
    title: 'Impot estime',
    definition: "Montant total d'impot calcule selon les tranches actives.",
    dataSource: 'Objet `taxEstimate` calcule par `estimateTax(netIncome, brackets)`.',
    formula: 'Impot estime = Somme des impots de chaque tranche appliquee',
    calculationMethod:
      'Le calcul applique les tranches par seuil, puis somme les contributions de chaque tranche imposable.',
  },
  netAfterTax: {
    title: 'Revenu net apres impot',
    definition: 'Montant restant apres deduction de l impot estime.',
    dataSource: 'Valeurs `netIncome` et `taxEstimate.totalTax` du composant.',
    formula: 'Net apres impot = max(Benefice imposable - Impot estime, 0)',
    calculationMethod: 'Le composant soustrait le total d impot au benefice et borne le resultat a zero.',
  },
  bracketDetail: {
    title: 'Detail par tranche',
    definition: 'Ventilation de l impot calcule par tranche fiscale.',
    dataSource: 'Tableau `taxEstimate.details` retourne par `estimateTax`.',
    formula: 'Impot tranche = Base taxable tranche x taux tranche',
    calculationMethod: 'Chaque ligne affiche la base de tranche, le taux et le montant d impot correspondant.',
    notes: 'Le mode personnalisation permet d editer les bornes et taux avant recalcul.',
  },
  bracketDistribution: {
    title: 'Repartition par tranche',
    definition: 'Part relative de chaque tranche dans l impot total.',
    dataSource: 'Donnees derivees de `taxEstimate.details` (tax > 0).',
    formula: 'Part tranche = Impot tranche / Impot total',
    calculationMethod: 'Le donut affiche les montants d impot par tranche pour visualiser la concentration fiscale.',
  },
  quarterlySchedule: {
    title: 'Echeancier de paiement trimestriel',
    definition: 'Projection de paiement trimestriel de l impot annuel estime.',
    dataSource: 'Valeur `taxEstimate.quarterlyPayment` derivee du calcul fiscal.',
    formula: 'Paiement trimestriel = Impot total / 4',
    calculationMethod: 'Le composant repartit le total annuel en quatre acomptes trimestriels avec dates d echeance.',
  },
};

const TaxEstimation = ({ netIncome, taxEstimate: initialEstimate, period, onExportPDF, onExportHTML, currency }) => {
  const { country } = useAccountingInit();
  // Load country-aware corporate tax brackets from DB (ENF-1: no hardcoded rates)
  const defaultBrackets = useCorporateTaxBrackets(country);
  const [brackets, setBrackets] = useState(null); // null = use defaultBrackets (lazy init)
  const [customMode, setCustomMode] = useState(false);
  // Use DB-loaded brackets as the effective brackets; local state overrides only in custom mode
  const effectiveBrackets = brackets ?? defaultBrackets;

  const taxEstimate = customMode ? estimateTax(netIncome > 0 ? netIncome : 0, effectiveBrackets) : initialEstimate;
  const effectiveRate = (taxEstimate?.effectiveRate || 0) * 100;

  const updateBracket = (index, field, value) => {
    // Initialize local brackets from effective (DB-loaded) brackets on first edit
    const base = brackets ?? defaultBrackets;
    const updated = [...base];
    updated[index] = { ...updated[index], [field]: field === 'label' ? value : parseFloat(value) || 0 };
    setBrackets(updated);
  };

  // Donut chart data from bracket details
  const donutData = (taxEstimate?.details || []).filter((d) => d.tax > 0).map((d) => ({ name: d.label, value: d.tax }));

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Estimation d'impot
          </h2>
          {period && (
            <p className="text-sm text-gray-400">
              Du {formatDate(period.startDate)} au {formatDate(period.endDate)}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
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
              <PanelInfoPopover {...TAX_PANEL_INFO.taxableIncome} />
              <span className="text-sm font-medium">Benefice imposable</span>
            </div>
            <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(netIncome || 0, currency)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Banknote className="w-4 h-4" />
              <PanelInfoPopover {...TAX_PANEL_INFO.estimatedTax} />
              <span className="text-sm font-medium">Impot estime</span>
            </div>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(taxEstimate?.totalTax || 0, currency)}</p>
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
              <PanelInfoPopover {...TAX_PANEL_INFO.netAfterTax} />
              <span className="text-sm font-medium">Revenu net apres impot</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {formatCurrency(Math.max((netIncome || 0) - (taxEstimate?.totalTax || 0), 0), currency)}
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
              <CardTitle className="text-sm text-gray-400 inline-flex items-center gap-1.5">
                <PanelInfoPopover {...TAX_PANEL_INFO.bracketDetail} />
                <span>Detail par tranche</span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (customMode) setBrackets(null); // reset to DB brackets
                  setCustomMode(!customMode);
                }}
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
                        <span className="font-mono text-sm text-white font-medium">
                          {formatCurrency(detail.tax, currency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-1">
                          <div
                            className="h-1 rounded-full"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-24 text-right">
                          sur {formatCurrency(detail.taxableAmount, currency)}
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
                <span className="font-mono text-sm font-bold text-orange-400">
                  {formatCurrency(taxEstimate?.totalTax || 0, currency)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut - 1/3 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 inline-flex items-center gap-1.5">
              <PanelInfoPopover {...TAX_PANEL_INFO.bracketDistribution} />
              <span>Repartition par tranche</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        borderColor: '#374151',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value) => formatCurrency(value, currency)}
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
                  <span className="text-gray-300 ml-auto font-mono">{formatCurrency(item.value, currency)}</span>
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
            <PanelInfoPopover {...TAX_PANEL_INFO.quarterlySchedule} />
            <Calendar className="w-4 h-4" /> Echeancier de paiement trimestriel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quarters.map((q, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">{q.period}</div>
                <div className="text-lg font-bold text-gray-100">{formatCurrency(quarterly, currency)}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                  <ChevronRight className="w-3 h-3" /> Echeance: {q.due}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-700">
            <span className="text-sm text-gray-400">Total annuel</span>
            <span className="font-mono text-sm font-bold text-orange-400">
              {formatCurrency(taxEstimate?.totalTax || 0, currency)}
            </span>
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
            {effectiveBrackets.map((bracket, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">De</Label>
                  <Input
                    type="number"
                    value={bracket.min}
                    onChange={(e) => updateBracket(i, 'min', e.target.value)}
                    className="bg-gray-800 border-gray-700 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">A</Label>
                  <Input
                    type="number"
                    value={bracket.max === Infinity ? '' : bracket.max}
                    onChange={(e) => updateBracket(i, 'max', e.target.value || Infinity)}
                    placeholder="∞"
                    className="bg-gray-800 border-gray-700 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Taux (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(bracket.rate * 100).toFixed(2)}
                    onChange={(e) => updateBracket(i, 'rate', parseFloat(e.target.value) / 100)}
                    className="bg-gray-800 border-gray-700 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Libelle</Label>
                  <Input
                    value={bracket.label}
                    onChange={(e) => updateBracket(i, 'label', e.target.value)}
                    className="bg-gray-800 border-gray-700 text-xs h-8"
                  />
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
