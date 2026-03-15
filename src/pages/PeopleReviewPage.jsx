import { useCallback, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronUp,
  Crown,
  DollarSign,
  Grid3X3,
  Minus,
  Plus,
  Shield,
  Sparkles,
  TrendingUp,
  User,
} from 'lucide-react';
import { usePerformance } from '@/hooks/usePerformance';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ---------- constants ---------- */

const _PERF_LABELS = ['Insuffisant', 'A ameliorer', 'Conforme', 'Superieur', 'Exceptionnel'];
const _POT_LABELS = ['Faible', 'Moyen', 'Eleve'];

const PERF_AXIS = ['Insuffisant', 'A ameliorer', 'Conforme', 'Superieur', 'Exceptionnel'];
const POT_AXIS = ['Eleve', 'Moyen', 'Faible']; // top-to-bottom

const NINE_BOX_COLORS = [
  /* row 0 (Eleve potential) */
  [
    'bg-amber-500/25 border-amber-400/40',
    'bg-emerald-500/20 border-emerald-400/30',
    'bg-emerald-500/25 border-emerald-400/40',
    'bg-emerald-500/35 border-emerald-400/50',
    'bg-emerald-500/50 border-emerald-400/60',
  ],
  /* row 1 (Moyen potential) */
  [
    'bg-red-500/20 border-red-400/30',
    'bg-amber-500/20 border-amber-400/30',
    'bg-blue-500/20 border-blue-400/30',
    'bg-emerald-500/20 border-emerald-400/30',
    'bg-emerald-500/30 border-emerald-400/40',
  ],
  /* row 2 (Faible potential) */
  [
    'bg-red-500/35 border-red-400/50',
    'bg-red-500/25 border-red-400/40',
    'bg-amber-500/20 border-amber-400/30',
    'bg-blue-500/20 border-blue-400/30',
    'bg-blue-500/25 border-blue-400/40',
  ],
];

const NINE_BOX_LABELS = [
  ['Enigme', 'Potentiel brut', 'Futur leader', 'Leader emergent', 'Star'],
  ['Risque', 'Contributeur cle', 'Pilier fiable', 'Performeur solide', 'Talent confirme'],
  ['Sous-performeur', 'A developper', 'Contributeur stable', 'Expert technique', 'Expert confirmé'],
];

const CRITICALITY_COLORS = {
  low: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
  critical: 'bg-red-500/20 text-red-300 border-red-400/30',
};

const CRITICALITY_LABELS = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Eleve',
  critical: 'Critique',
};

const RISK_LABELS = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Eleve',
};

/* ---------- helpers ---------- */

const employeeName = (emp) => emp?.full_name || emp?.id || '-';

const formatCurrency = (value, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value || 0));

const formatNumber = (value) => new Intl.NumberFormat('fr-FR').format(Number(value || 0));

/* ---------- 9-box placement ---------- */

function build9Box(reviews, employees) {
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => []));

  for (const r of reviews) {
    if (!r.performance_label || !r.potential_label) continue;

    const perfIdx = PERF_AXIS.indexOf(r.performance_label);
    const potIdx = POT_AXIS.indexOf(r.potential_label);

    if (perfIdx === -1 || potIdx === -1) continue;

    const emp = r.employee || employees.find((e) => e.id === r.employee_id);
    grid[potIdx][perfIdx].push({
      id: r.id,
      name: employeeName(emp),
      jobTitle: emp?.job_title || '',
      performance: r.performance_label,
      potential: r.potential_label,
    });
  }
  return grid;
}

function getHighPotentials(reviews, employees) {
  return reviews
    .filter(
      (r) =>
        r.potential_label === 'Eleve' && (r.performance_label === 'Superieur' || r.performance_label === 'Exceptionnel')
    )
    .map((r) => {
      const emp = r.employee || employees.find((e) => e.id === r.employee_id);
      return {
        id: r.id,
        name: employeeName(emp),
        jobTitle: emp?.job_title || '',
        performance: r.performance_label,
        potential: r.potential_label,
        reviewPeriod: r.review_period,
      };
    });
}

/* ========== MAIN COMPONENT ========== */

export default function PeopleReviewPage() {
  const {
    loading,
    reviews,
    employees,
    departments,
    successionPlans,
    headcountBudgets,
    createSuccessionPlan,
    updateSuccessionPlan: _updateSuccessionPlan,
    createBudget,
    updateBudget: _updateBudget,
  } = usePerformance();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('ninebox');
  const [showSuccessionForm, setShowSuccessionForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [saving, setSaving] = useState(false);

  /* succession form */
  const [succForm, setSuccForm] = useState({
    position_title: '',
    criticality: 'medium',
    incumbent_employee_id: '',
    successors: [],
    risk_of_vacancy: 'low',
  });

  /* budget form */
  const [budgetForm, setBudgetForm] = useState({
    fiscal_year: new Date().getFullYear().toString(),
    department_id: '',
    planned_headcount: '0',
    actual_headcount: '0',
    planned_payroll_cost: '0',
    actual_payroll_cost: '0',
  });

  /* computed data */
  const nineBox = useMemo(() => build9Box(reviews, employees), [reviews, employees]);
  const highPotentials = useMemo(() => getHighPotentials(reviews, employees), [reviews, employees]);

  const totalEmployeesInGrid = useMemo(() => {
    let count = 0;
    for (const row of nineBox) for (const cell of row) count += cell.length;
    return count;
  }, [nineBox]);

  /* ---------- succession handlers ---------- */

  const resetSuccForm = useCallback(() => {
    setSuccForm({
      position_title: '',
      criticality: 'medium',
      incumbent_employee_id: '',
      successors: [],
      risk_of_vacancy: 'low',
    });
    setShowSuccessionForm(false);
  }, []);

  const addSuccessor = useCallback(() => {
    setSuccForm((prev) => ({
      ...prev,
      successors: [...prev.successors, { employee_id: '', readiness: 'not_ready', notes: '' }],
    }));
  }, []);

  const removeSuccessor = useCallback((idx) => {
    setSuccForm((prev) => ({
      ...prev,
      successors: prev.successors.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateSuccessor = useCallback((idx, field, value) => {
    setSuccForm((prev) => ({
      ...prev,
      successors: prev.successors.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  }, []);

  const handleSaveSuccession = useCallback(async () => {
    if (!succForm.position_title) {
      toast({ title: 'Erreur', description: 'Saisissez un intitule de poste.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createSuccessionPlan(succForm);
      toast({ title: 'Plan de succession cree' });
      resetSuccForm();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [succForm, createSuccessionPlan, resetSuccForm, toast]);

  /* ---------- budget handlers ---------- */

  const resetBudgetForm = useCallback(() => {
    setBudgetForm({
      fiscal_year: new Date().getFullYear().toString(),
      department_id: '',
      planned_headcount: '0',
      actual_headcount: '0',
      planned_payroll_cost: '0',
      actual_payroll_cost: '0',
    });
    setShowBudgetForm(false);
  }, []);

  const handleSaveBudget = useCallback(async () => {
    if (!budgetForm.department_id) {
      toast({ title: 'Erreur', description: 'Selectionnez un departement.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createBudget(budgetForm);
      toast({ title: 'Budget ETP cree' });
      resetBudgetForm();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [budgetForm, createBudget, resetBudgetForm, toast]);

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <Helmet>
        <title>People Review | CashPilot</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-orange-400" />
            People Review
          </h1>
          <p className="text-sm text-gray-400 mt-1">Matrice 9-Box, hauts potentiels, succession et budget ETP</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger
              value="ninebox"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <Grid3X3 className="h-4 w-4 mr-1.5" />
              9-Box
            </TabsTrigger>
            <TabsTrigger
              value="hipot"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Hauts Potentiels
            </TabsTrigger>
            <TabsTrigger
              value="succession"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />
              Succession
            </TabsTrigger>
            <TabsTrigger
              value="budget"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <DollarSign className="h-4 w-4 mr-1.5" />
              Budget ETP
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB: 9-Box Grid ===== */}
          <TabsContent value="ninebox" className="space-y-4 mt-4">
            {loading && <p className="text-gray-400 text-sm">Chargement...</p>}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-orange-400">{totalEmployeesInGrid}</p>
                  <p className="text-xs text-gray-400 mt-1">Dans la matrice</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{highPotentials.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Hauts potentiels</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {reviews.filter((r) => r.status === 'signed').length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Entretiens signes</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">
                    {reviews.filter((r) => r.status !== 'signed').length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">En cours</p>
                </CardContent>
              </Card>
            </div>

            {/* 9-Box Grid */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-orange-400" />
                  Matrice Performance / Potentiel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {/* Column header: Performance axis */}
                  <div className="flex mb-1 ml-24">
                    {PERF_AXIS.map((label) => (
                      <div key={label} className="flex-1 text-center text-xs text-gray-400 font-medium px-1 truncate">
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  {POT_AXIS.map((potLabel, rowIdx) => (
                    <div key={potLabel} className="flex items-stretch mb-1">
                      {/* Row label: Potential axis */}
                      <div className="w-24 shrink-0 flex items-center justify-end pr-3">
                        <span className="text-xs text-gray-400 font-medium">{potLabel}</span>
                      </div>

                      {/* Cells */}
                      {PERF_AXIS.map((perfLabel, colIdx) => {
                        const cellEmployees = nineBox[rowIdx][colIdx];
                        return (
                          <div
                            key={`${rowIdx}-${colIdx}`}
                            className={`flex-1 min-h-[80px] border rounded-lg p-2 mx-0.5 transition-all hover:scale-[1.02] ${NINE_BOX_COLORS[rowIdx][colIdx]}`}
                          >
                            <p className="text-[10px] font-semibold text-gray-300 mb-1 truncate">
                              {NINE_BOX_LABELS[rowIdx][colIdx]}
                            </p>
                            {cellEmployees.length === 0 ? (
                              <p className="text-[10px] text-gray-500 italic">-</p>
                            ) : (
                              <div className="space-y-0.5">
                                {cellEmployees.slice(0, 4).map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="flex items-center gap-1 text-[11px] text-white/80"
                                    title={`${emp.name} - ${emp.jobTitle}`}
                                  >
                                    <User className="h-3 w-3 shrink-0 text-white/40" />
                                    <span className="truncate">{emp.name}</span>
                                  </div>
                                ))}
                                {cellEmployees.length > 4 && (
                                  <p className="text-[10px] text-gray-400">+{cellEmployees.length - 4} autres</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Axis labels */}
                  <div className="flex mt-3">
                    <div className="w-24" />
                    <div className="flex-1 text-center">
                      <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Performance
                      </span>
                    </div>
                  </div>
                </div>

                {/* Y-axis label (rotated) */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 hidden xl:block">
                  <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase">Potentiel</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB: Hauts Potentiels ===== */}
          <TabsContent value="hipot" className="space-y-4 mt-4">
            {loading && <p className="text-gray-400 text-sm">Chargement...</p>}

            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-orange-400" />
                  Hauts Potentiels
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 ml-2">
                    {highPotentials.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {highPotentials.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Aucun haut potentiel identifie.</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Les hauts potentiels sont les collaborateurs avec un potentiel Eleve et une performance Superieur
                      ou Exceptionnel.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {highPotentials.map((hp) => (
                      <div
                        key={hp.id}
                        className="bg-white/[0.03] border border-white/10 rounded-lg p-4 hover:border-orange-400/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {hp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{hp.name}</p>
                            <p className="text-xs text-gray-400 truncate">{hp.jobTitle || '-'}</p>
                            <div className="flex gap-2 mt-2">
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                                {hp.performance}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300">
                                Potentiel {hp.potential}
                              </span>
                            </div>
                            {hp.reviewPeriod && (
                              <p className="text-[10px] text-gray-500 mt-1">Periode : {hp.reviewPeriod}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB: Succession ===== */}
          <TabsContent value="succession" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-300 flex items-center gap-2">
                <Shield className="h-4 w-4 text-orange-400" />
                Plans de succession
              </h2>
              <Button
                size="sm"
                onClick={() => setShowSuccessionForm(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouveau plan
              </Button>
            </div>

            {loading && <p className="text-gray-400 text-sm">Chargement...</p>}

            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-gray-400">
                      <th className="px-4 py-3 font-medium">Poste</th>
                      <th className="px-4 py-3 font-medium">Criticite</th>
                      <th className="px-4 py-3 font-medium">Titulaire</th>
                      <th className="px-4 py-3 font-medium">Risque vacance</th>
                      <th className="px-4 py-3 font-medium">Successeurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {successionPlans.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          Aucun plan de succession
                        </td>
                      </tr>
                    )}
                    {successionPlans.map((plan) => (
                      <tr key={plan.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{plan.position_title || '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CRITICALITY_COLORS[plan.criticality] || CRITICALITY_COLORS.medium}`}
                          >
                            {CRITICALITY_LABELS[plan.criticality] || plan.criticality}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{employeeName(plan.incumbent)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              plan.risk_of_vacancy === 'high'
                                ? 'bg-red-500/20 text-red-300'
                                : plan.risk_of_vacancy === 'medium'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {RISK_LABELS[plan.risk_of_vacancy] || plan.risk_of_vacancy}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!plan.successors || plan.successors.length === 0 ? (
                            <span className="text-gray-500 text-xs">Aucun</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {plan.successors.map((s, idx) => {
                                const emp = employees.find((e) => e.id === s.employee_id);
                                return (
                                  <Badge key={idx} className="bg-white/10 text-gray-300 border-white/10 text-xs">
                                    {employeeName(emp)}
                                    {s.readiness === 'ready_now' && (
                                      <span className="ml-1 text-emerald-400" title="Pret maintenant">
                                        &#10003;
                                      </span>
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Succession form dialog */}
            <Dialog open={showSuccessionForm} onOpenChange={(open) => !open && resetSuccForm()}>
              <DialogContent className="bg-[#0f1528] border-white/10 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-400" />
                    Nouveau plan de succession
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Definissez le poste cle et ses successeurs potentiels.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Intitule du poste *</Label>
                    <Input
                      value={succForm.position_title}
                      onChange={(e) => setSuccForm((p) => ({ ...p, position_title: e.target.value }))}
                      placeholder="Directeur financier..."
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Criticite</Label>
                      <Select
                        value={succForm.criticality}
                        onValueChange={(v) => setSuccForm((p) => ({ ...p, criticality: v }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CRITICALITY_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Risque vacance</Label>
                      <Select
                        value={succForm.risk_of_vacancy}
                        onValueChange={(v) => setSuccForm((p) => ({ ...p, risk_of_vacancy: v }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RISK_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Titulaire actuel</Label>
                    <Select
                      value={succForm.incumbent_employee_id}
                      onValueChange={(v) => setSuccForm((p) => ({ ...p, incumbent_employee_id: v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selectionnez..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {employeeName(e)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Successors */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-300">Successeurs</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addSuccessor}
                        className="text-orange-400 hover:text-orange-300"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Ajouter
                      </Button>
                    </div>
                    {succForm.successors.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-end bg-white/[0.03] border border-white/10 rounded-lg p-3"
                      >
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-gray-400">Employe</Label>
                          <Select value={s.employee_id} onValueChange={(v) => updateSuccessor(idx, 'employee_id', v)}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                              <SelectValue placeholder="Selectionnez..." />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {employeeName(e)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32 space-y-1">
                          <Label className="text-xs text-gray-400">Pret ?</Label>
                          <Select value={s.readiness} onValueChange={(v) => updateSuccessor(idx, 'readiness', v)}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_ready">Pas pret</SelectItem>
                              <SelectItem value="ready_1_2y">1-2 ans</SelectItem>
                              <SelectItem value="ready_now">Pret</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSuccessor(idx)}
                          className="text-red-400 hover:text-red-300 shrink-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={resetSuccForm} className="text-gray-400">
                    Annuler
                  </Button>
                  <Button
                    onClick={handleSaveSuccession}
                    disabled={saving}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {saving ? 'Enregistrement...' : 'Creer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ===== TAB: Budget ETP ===== */}
          <TabsContent value="budget" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-300 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-orange-400" />
                Budget ETP par departement
              </h2>
              <Button
                size="sm"
                onClick={() => setShowBudgetForm(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouveau budget
              </Button>
            </div>

            {loading && <p className="text-gray-400 text-sm">Chargement...</p>}

            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-gray-400">
                      <th className="px-4 py-3 font-medium">Departement</th>
                      <th className="px-4 py-3 font-medium">Annee</th>
                      <th className="px-4 py-3 font-medium text-right">ETP prevu</th>
                      <th className="px-4 py-3 font-medium text-right">ETP reel</th>
                      <th className="px-4 py-3 font-medium text-right">Ecart ETP</th>
                      <th className="px-4 py-3 font-medium text-right">Cout prevu</th>
                      <th className="px-4 py-3 font-medium text-right">Cout reel</th>
                      <th className="px-4 py-3 font-medium text-right">Ecart cout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headcountBudgets.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          Aucun budget ETP
                        </td>
                      </tr>
                    )}
                    {headcountBudgets.map((b) => {
                      const varHC = Number(b.variance_headcount || 0);
                      const varCost = Number(b.variance_cost || 0);
                      const hcColor = varHC > 0 ? 'text-red-400' : varHC < 0 ? 'text-emerald-400' : 'text-gray-400';
                      const costColor =
                        varCost > 0 ? 'text-red-400' : varCost < 0 ? 'text-emerald-400' : 'text-gray-400';
                      return (
                        <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">{b.department?.name || '-'}</td>
                          <td className="px-4 py-3 text-gray-300">{b.fiscal_year || '-'}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{formatNumber(b.planned_headcount)}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">
                            {formatNumber(b.actual_headcount)}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${hcColor}`}>
                            <span className="inline-flex items-center gap-0.5">
                              {varHC > 0 ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : varHC < 0 ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : null}
                              {varHC > 0 ? '+' : ''}
                              {formatNumber(varHC)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrency(b.planned_payroll_cost)}
                          </td>
                          <td className="px-4 py-3 text-right text-white font-medium">
                            {formatCurrency(b.actual_payroll_cost)}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${costColor}`}>
                            <span className="inline-flex items-center gap-0.5">
                              {varCost > 0 ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : varCost < 0 ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : null}
                              {varCost > 0 ? '+' : ''}
                              {formatCurrency(varCost)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totals footer */}
                  {headcountBudgets.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-white/10 bg-white/[0.03]">
                        <td className="px-4 py-3 font-semibold text-white" colSpan={2}>
                          Total
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-300">
                          {formatNumber(headcountBudgets.reduce((s, b) => s + Number(b.planned_headcount || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">
                          {formatNumber(headcountBudgets.reduce((s, b) => s + Number(b.actual_headcount || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-400">
                          {(() => {
                            const total = headcountBudgets.reduce((s, b) => s + Number(b.variance_headcount || 0), 0);
                            const color = total > 0 ? 'text-red-400' : total < 0 ? 'text-emerald-400' : 'text-gray-400';
                            return (
                              <span className={color}>
                                {total > 0 ? '+' : ''}
                                {formatNumber(total)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-300">
                          {formatCurrency(
                            headcountBudgets.reduce((s, b) => s + Number(b.planned_payroll_cost || 0), 0)
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">
                          {formatCurrency(headcountBudgets.reduce((s, b) => s + Number(b.actual_payroll_cost || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {(() => {
                            const total = headcountBudgets.reduce((s, b) => s + Number(b.variance_cost || 0), 0);
                            const color = total > 0 ? 'text-red-400' : total < 0 ? 'text-emerald-400' : 'text-gray-400';
                            return (
                              <span className={color}>
                                {total > 0 ? '+' : ''}
                                {formatCurrency(total)}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* Budget form dialog */}
            <Dialog open={showBudgetForm} onOpenChange={(open) => !open && resetBudgetForm()}>
              <DialogContent className="bg-[#0f1528] border-white/10 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-orange-400" />
                    Nouveau budget ETP
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Definissez le budget previsionnel en effectifs et masse salariale.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Annee fiscale</Label>
                      <Input
                        value={budgetForm.fiscal_year}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, fiscal_year: e.target.value }))}
                        placeholder="2026"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Departement *</Label>
                      <Select
                        value={budgetForm.department_id}
                        onValueChange={(v) => setBudgetForm((p) => ({ ...p, department_id: v }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Selectionnez..." />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">ETP prevu</Label>
                      <Input
                        type="number"
                        min={0}
                        value={budgetForm.planned_headcount}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, planned_headcount: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">ETP reel</Label>
                      <Input
                        type="number"
                        min={0}
                        value={budgetForm.actual_headcount}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, actual_headcount: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Cout prevu (EUR)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={budgetForm.planned_payroll_cost}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, planned_payroll_cost: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Cout reel (EUR)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={budgetForm.actual_payroll_cost}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, actual_payroll_cost: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={resetBudgetForm} className="text-gray-400">
                    Annuler
                  </Button>
                  <Button
                    onClick={handleSaveBudget}
                    disabled={saving}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {saving ? 'Enregistrement...' : 'Creer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
