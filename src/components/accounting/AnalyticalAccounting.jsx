import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import {
  Plus,
  RefreshCw,
  Activity,
  Building2,
  Calculator,
  ClipboardList,
  BarChart2,
  Pencil,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const AXIS_TYPES = [
  { value: 'cost_center', label: 'Centre de coût' },
  { value: 'department', label: 'Département' },
  { value: 'product_line', label: 'Ligne de produit' },
  { value: 'project', label: 'Projet' },
  { value: 'custom', label: 'Personnalisé' },
];

const OBJECT_TYPES = ['product', 'service', 'project', 'client', 'channel', 'geography', 'business_unit', 'custom'];

const CENTER_TYPES = ['principal', 'auxiliary', 'structure'];
const COST_BEHAVIORS = ['fixed', 'variable', 'semi_variable'];
const DESTINATIONS = ['production', 'commercial', 'administratif', 'rd'];
const METHODS = ['full_costing', 'direct_costing', 'standard_costing', 'abc_costing', 'manual'];

const currentDate = () => new Date().toISOString().slice(0, 10);
const defaultStartDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};
const firstDayOfCurrentMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyBudgetForm = () => ({
  budget_name: '',
  period_start: defaultStartDate(),
  period_end: currentDate(),
  method: 'full_costing',
  object_id: '',
  cost_center_id: '',
  axis_value_id: '',
});
const emptyBudgetLineForm = () => ({
  id: null,
  period_month: firstDayOfCurrentMonth(),
  planned_amount: '',
  planned_volume: '',
  planned_unit_cost: '',
  notes: '',
});

export default function AnalyticalAccounting() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [moduleTab, setModuleTab] = useState('objects');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(currentDate);

  const [axes, setAxes] = useState([]);
  const [axisValues, setAxisValues] = useState([]);
  const [objects, setObjects] = useState([]);
  const [centers, setCenters] = useState([]);
  const [rules, setRules] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [variances, setVariances] = useState([]);
  const [kpis, setKpis] = useState(null);
  const reportingInfo = useMemo(
    () => ({
      reportingPanel: {
        title: 'KPI analytiques (DB-first)',
        definition: 'Synthèse analytique basée uniquement sur les calculs SQL de la comptabilité analytique.',
        dataSource: "Fonctions RPC `f_analytical_kpis` et `f_analytical_budget_variances` filtrées par société active.",
        formula: 'MCV = marge sur coûts variables; Seuil rentabilité = point mort; Résultat analytique = produits analytiques - charges analytiques.',
        calculationMethod:
          'Les KPI et écarts budgétaires sont calculés en base puis affichés sans recalcul front-end.',
      },
      mcv: {
        title: 'MCV',
        definition: 'Marge sur coûts variables sur la période analytique.',
        dataSource: "Champ `kpis.mcv` retourné par `f_analytical_kpis`.",
        formula: 'MCV = Chiffre d affaires analytique - Coûts variables analytiques',
        calculationMethod: 'Valeur calculée côté SQL et affichée telle quelle.',
      },
      seuilRentabilite: {
        title: 'Seuil rentabilité',
        definition: 'Niveau d activité nécessaire pour couvrir les charges.',
        dataSource: "Champ `kpis.seuil_rentabilite` retourné par `f_analytical_kpis`.",
        formula: 'Seuil = Charges fixes / Taux de marge sur coûts variables',
        calculationMethod: 'Calcul SQL via la fonction analytique puis restitution dans la carte KPI.',
      },
      resultatAnalytique: {
        title: 'Résultat analytique',
        definition: 'Résultat agrégé sur le périmètre analytique sélectionné.',
        dataSource: "Champ `kpis.resultat_analytique` retourné par `f_analytical_kpis`.",
        formula: 'Résultat analytique = Produits analytiques - Charges analytiques',
        calculationMethod: 'Calcul SQL puis affichage direct dans la carte KPI.',
      },
    }),
    []
  );

  const [axisDialogOpen, setAxisDialogOpen] = useState(false);
  const [objectDialogOpen, setObjectDialogOpen] = useState(false);
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetLineDialogOpen, setBudgetLineDialogOpen] = useState(false);
  const [budgetDialogMode, setBudgetDialogMode] = useState('create');

  const [axisForm, setAxisForm] = useState({
    axis_type: 'cost_center',
    axis_code: '',
    axis_name: '',
    color: '#6366f1',
  });
  const [objectForm, setObjectForm] = useState({
    object_type: 'project',
    object_code: '',
    object_name: '',
  });
  const [centerForm, setCenterForm] = useState({
    center_code: '',
    center_name: '',
    center_type: 'principal',
    axis_id: '',
  });
  const [ruleForm, setRuleForm] = useState({
    rule_name: '',
    source_type: '',
    source_category: '',
    allocation_percent: '100',
    cost_center_id: '',
    object_id: '',
    axis_value_id: '',
  });
  const [allocationForm, setAllocationForm] = useState({
    entry_id: '',
    amount: '',
    allocation_percent: '',
    object_id: '',
    cost_center_id: '',
    axis_value_id: '',
    is_direct: '__NO__',
    cost_behavior: 'variable',
    destination: 'production',
    method: 'full_costing',
  });
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm);
  const [budgetLineForm, setBudgetLineForm] = useState(emptyBudgetLineForm);
  const [budgetLines, setBudgetLines] = useState([]);
  const [budgetLineVariances, setBudgetLineVariances] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState(null);
  const [budgetTotalAmount, setBudgetTotalAmount] = useState('');
  const [replaceBudgetLines, setReplaceBudgetLines] = useState('__NO__');
  const [simGrowthPercent, setSimGrowthPercent] = useState('6');
  const [simCostOptimizationPercent, setSimCostOptimizationPercent] = useState('3');
  const [simRiskPercent, setSimRiskPercent] = useState('2');
  const [simulating, setSimulating] = useState(false);
  const [simulationRows, setSimulationRows] = useState([]);
  const [budgetQuality, setBudgetQuality] = useState(null);
  const [budgetScenarios, setBudgetScenarios] = useState([]);
  const [scenarioSummaries, setScenarioSummaries] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioNotes, setScenarioNotes] = useState('');

  const fetchAxes = useCallback(async () => {
    let query = supabase
      .from('accounting_analytical_axes')
      .select('*')
      .eq('user_id', user.id)
      .order('axis_type')
      .order('axis_code');
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const fetchAxisValues = useCallback(async () => {
    let query = supabase.from('analytical_axis_values').select('*').eq('user_id', user.id).order('value_code');
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const fetchObjects = useCallback(async () => {
    let query = supabase
      .from('analytical_objects')
      .select('*')
      .eq('user_id', user.id)
      .order('object_type')
      .order('object_code');
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const fetchCenters = useCallback(async () => {
    let query = supabase
      .from('cost_centers')
      .select('*')
      .eq('user_id', user.id)
      .order('center_type')
      .order('center_code');
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const fetchRules = useCallback(async () => {
    let query = supabase.from('analytical_allocation_rules').select('*').eq('user_id', user.id).order('priority');
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const fetchAllocations = useCallback(async () => {
    let query = supabase
      .from('analytical_allocations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const fetchBudgets = useCallback(async () => {
    let query = supabase
      .from('analytical_budgets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const fetchBudgetLines = useCallback(
    async (budgetId) => {
      if (!budgetId) return [];
      let query = supabase
        .from('analytical_budget_lines')
        .select('*')
        .eq('user_id', user.id)
        .eq('budget_id', budgetId)
        .order('period_month', { ascending: true });
      query = applyCompanyScope(query, { includeUnassigned: false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    [applyCompanyScope, user]
  );

  const fetchBudgetLineVariances = useCallback(
    async (budgetId) => {
      if (!budgetId || !activeCompanyId) return [];
      const { data, error } = await supabase.rpc('f_analytical_budget_line_variances', {
        p_user_id: user.id,
        p_company_id: activeCompanyId,
        p_budget_id: budgetId,
        p_start_date: null,
        p_end_date: null,
      });
      if (error) throw error;
      return data || [];
    },
    [activeCompanyId, user]
  );

  const fetchBudgetSimulation = useCallback(
    async (budgetId, overrides = {}) => {
      if (!budgetId || !activeCompanyId) return [];
      const growth = Number(overrides.growth ?? simGrowthPercent ?? 0);
      const optimization = Number(overrides.optimization ?? simCostOptimizationPercent ?? 0);
      const risk = Number(overrides.risk ?? simRiskPercent ?? 0);
      const { data, error } = await supabase.rpc('f_analytical_budget_simulation_curve', {
        p_user_id: user.id,
        p_company_id: activeCompanyId,
        p_budget_id: budgetId,
        p_revenue_growth_percent: Number.isFinite(growth) ? growth : 0,
        p_cost_optimization_percent: Number.isFinite(optimization) ? optimization : 0,
        p_risk_percent: Number.isFinite(risk) ? risk : 0,
      });
      if (error) throw error;
      return data || [];
    },
    [activeCompanyId, simCostOptimizationPercent, simGrowthPercent, simRiskPercent, user]
  );

  const fetchBudgetQuality = useCallback(
    async (budgetId) => {
      if (!budgetId || !activeCompanyId) return null;
      const { data, error } = await supabase.rpc('f_analytical_budget_data_quality', {
        p_user_id: user.id,
        p_company_id: activeCompanyId,
        p_budget_id: budgetId,
        p_start_date: null,
        p_end_date: null,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
    [activeCompanyId, user]
  );

  const fetchBudgetScenarios = useCallback(
    async (budgetId) => {
      if (!budgetId) return [];
      let query = supabase
        .from('analytical_budget_scenarios')
        .select('*')
        .eq('user_id', user.id)
        .eq('budget_id', budgetId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    [applyCompanyScope, user]
  );

  const fetchScenarioSummaries = useCallback(
    async (budgetId) => {
      if (!budgetId || !activeCompanyId) return [];
      const { data, error } = await supabase.rpc('f_analytical_budget_scenario_summaries', {
        p_user_id: user.id,
        p_company_id: activeCompanyId,
        p_budget_id: budgetId,
      });
      if (error) throw error;
      return data || [];
    },
    [activeCompanyId, user]
  );

  const fetchReporting = useCallback(async () => {
    if (!activeCompanyId) {
      return { kpis: null, variances: [] };
    }
    const { data: kpiData, error: kpiError } = await supabase.rpc('f_analytical_kpis', {
      p_user_id: user.id,
      p_company_id: activeCompanyId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_fixed_costs: null,
    });
    if (kpiError) throw kpiError;

    const { data: varianceData, error: varianceError } = await supabase.rpc('f_analytical_budget_variances', {
      p_user_id: user.id,
      p_company_id: activeCompanyId,
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (varianceError) throw varianceError;

    return { kpis: kpiData, variances: varianceData || [] };
  }, [activeCompanyId, endDate, startDate, user]);

  const syncAccountingToAnalytical = useCallback(async () => {
    if (!activeCompanyId) return 0;
    const { data, error } = await supabase.rpc('f_seed_analytical_allocations_from_entries', {
      p_user_id: user.id,
      p_company_id: activeCompanyId,
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) throw error;
    return Number(data || 0);
  }, [activeCompanyId, endDate, startDate, user]);

  const loadBudgetDetails = useCallback(
    async (budgetId) => {
      if (!budgetId) {
        setBudgetLines([]);
        setBudgetLineVariances([]);
        setSimulationRows([]);
        setBudgetQuality(null);
        setBudgetScenarios([]);
        setScenarioSummaries([]);
        setSelectedScenarioId('');
        return;
      }
      const _budgetResults = await Promise.allSettled([
        fetchBudgetLines(budgetId),
        fetchBudgetLineVariances(budgetId),
        fetchBudgetSimulation(budgetId),
        fetchBudgetQuality(budgetId),
        fetchBudgetScenarios(budgetId),
        fetchScenarioSummaries(budgetId),
      ]);

      const _budgetLabels = ['budgetLines', 'lineVariances', 'simulation', 'quality', 'scenarios', 'summaries'];
      _budgetResults.forEach((r, i) => {
        if (r.status === 'rejected')
          console.error(`AnalyticalAccounting budget fetch "${_budgetLabels[i]}" failed:`, r.reason);
      });

      const _bv = (i) => (_budgetResults[i].status === 'fulfilled' ? _budgetResults[i].value : null);
      const lines = _bv(0);
      const lineVariances = _bv(1);
      const simData = _bv(2);
      const qualityData = _bv(3);
      const scenariosData = _bv(4) || [];
      const summariesData = _bv(5);
      setBudgetLines(lines);
      setBudgetLineVariances(lineVariances);
      setSimulationRows(simData);
      setBudgetQuality(qualityData);
      setBudgetScenarios(scenariosData);
      setScenarioSummaries(summariesData);
      if (scenariosData.length === 0) {
        setSelectedScenarioId('');
      } else {
        const nextScenario = scenariosData.find((s) => s.id === selectedScenarioId) || scenariosData[0];
        setSelectedScenarioId(nextScenario?.id || '');
      }
    },
    [
      fetchBudgetLineVariances,
      fetchBudgetLines,
      fetchBudgetQuality,
      fetchBudgetScenarios,
      fetchBudgetSimulation,
      fetchScenarioSummaries,
      selectedScenarioId,
    ]
  );

  const loadAll = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    setLoading(true);
    try {
      // Keep analytics in sync with posted accounting entries for the active window.
      await syncAccountingToAnalytical();

      const _analyticalResults = await Promise.allSettled([
        fetchAxes(),
        fetchAxisValues(),
        fetchObjects(),
        fetchCenters(),
        fetchRules(),
        fetchAllocations(),
        fetchBudgets(),
        fetchReporting(),
      ]);

      const _analyticalLabels = [
        'axes',
        'axisValues',
        'objects',
        'centers',
        'rules',
        'allocations',
        'budgets',
        'reporting',
      ];
      _analyticalResults.forEach((r, i) => {
        if (r.status === 'rejected')
          console.error(`AnalyticalAccounting fetch "${_analyticalLabels[i]}" failed:`, r.reason);
      });

      const _av = (i) => (_analyticalResults[i].status === 'fulfilled' ? _analyticalResults[i].value : null);
      const axesData = _av(0);
      const axisValuesData = _av(1);
      const objectsData = _av(2);
      const centersData = _av(3);
      const rulesData = _av(4);
      const allocationsData = _av(5);
      const budgetsData = _av(6);
      const reporting = _av(7);
      setAxes(axesData);
      setAxisValues(axisValuesData);
      setObjects(objectsData);
      setCenters(centersData);
      setRules(rulesData);
      setAllocations(allocationsData);
      setBudgets(budgetsData);
      setKpis(reporting.kpis);
      setVariances(reporting.variances);

      const nextBudgetId =
        selectedBudgetId && budgetsData.some((b) => b.id === selectedBudgetId)
          ? selectedBudgetId
          : (budgetsData[0]?.id ?? null);
      setSelectedBudgetId(nextBudgetId);
      await loadBudgetDetails(nextBudgetId);
    } catch (err) {
      toast({ title: 'Erreur analytique', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [
    activeCompanyId,
    fetchAllocations,
    fetchAxes,
    fetchAxisValues,
    fetchBudgets,
    fetchCenters,
    fetchObjects,
    fetchReporting,
    fetchRules,
    loadBudgetDetails,
    selectedBudgetId,
    syncAccountingToAnalytical,
    toast,
    user,
  ]);

  const bootstrapAnalyticalFromSeed = useCallback(async () => {
    if (!activeCompanyId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('f_bootstrap_analytical_from_seed', {
        p_user_id: user.id,
        p_company_id: activeCompanyId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      const summary = [
        `axes: ${Number(data?.axes_upserted || 0)}`,
        `valeurs: ${Number(data?.axis_values_upserted || 0)}`,
        `centres: ${Number(data?.centers_upserted || 0)}`,
        `budgets: ${Number(data?.budgets_upserted || 0)}`,
      ].join(' · ');
      toast({ title: 'Initialisation analytique terminée', description: summary });
      await loadAll();
    } catch (err) {
      toast({ title: 'Erreur initialisation', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }, [activeCompanyId, endDate, loadAll, startDate, toast, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadBudgetDetails(selectedBudgetId);
  }, [loadBudgetDetails, selectedBudgetId]);

  const createAxis = async () => {
    if (!axisForm.axis_code.trim() || !axisForm.axis_name.trim()) return;
    const payload = withCompanyScope({
      user_id: user.id,
      axis_type: axisForm.axis_type,
      axis_code: axisForm.axis_code.trim(),
      axis_name: axisForm.axis_name.trim(),
      color: axisForm.color,
    });
    const { error } = await supabase.from('accounting_analytical_axes').insert(payload);
    if (error) throw error;
    setAxisDialogOpen(false);
    setAxisForm({ axis_type: 'cost_center', axis_code: '', axis_name: '', color: '#6366f1' });
    await loadAll();
  };

  const createObject = async () => {
    if (!objectForm.object_code.trim() || !objectForm.object_name.trim()) return;
    const payload = withCompanyScope({
      user_id: user.id,
      object_type: objectForm.object_type,
      object_code: objectForm.object_code.trim(),
      object_name: objectForm.object_name.trim(),
    });
    const { error } = await supabase.from('analytical_objects').insert(payload);
    if (error) throw error;
    setObjectDialogOpen(false);
    setObjectForm({ object_type: 'project', object_code: '', object_name: '' });
    await loadAll();
  };

  const createCenter = async () => {
    if (!centerForm.center_code.trim() || !centerForm.center_name.trim()) return;
    const payload = withCompanyScope({
      user_id: user.id,
      center_code: centerForm.center_code.trim(),
      center_name: centerForm.center_name.trim(),
      center_type: centerForm.center_type,
      axis_id: centerForm.axis_id || null,
    });
    const { error } = await supabase.from('cost_centers').insert(payload);
    if (error) throw error;
    setCenterDialogOpen(false);
    setCenterForm({ center_code: '', center_name: '', center_type: 'principal', axis_id: '' });
    await loadAll();
  };

  const createRule = async () => {
    if (!ruleForm.rule_name.trim()) return;
    const payload = withCompanyScope({
      user_id: user.id,
      rule_name: ruleForm.rule_name.trim(),
      source_type: ruleForm.source_type.trim() || null,
      source_category: ruleForm.source_category.trim() || null,
      allocation_percent: Number(ruleForm.allocation_percent || 0),
      cost_center_id: ruleForm.cost_center_id || null,
      object_id: ruleForm.object_id || null,
      axis_value_id: ruleForm.axis_value_id || null,
    });
    const { error } = await supabase.from('analytical_allocation_rules').insert(payload);
    if (error) throw error;
    setRuleDialogOpen(false);
    setRuleForm({
      rule_name: '',
      source_type: '',
      source_category: '',
      allocation_percent: '100',
      cost_center_id: '',
      object_id: '',
      axis_value_id: '',
    });
    await loadAll();
  };

  const createAllocation = async () => {
    if (!allocationForm.entry_id.trim() || !allocationForm.amount) return;
    const payload = withCompanyScope({
      user_id: user.id,
      entry_id: allocationForm.entry_id.trim(),
      amount: Number(allocationForm.amount || 0),
      allocation_percent: allocationForm.allocation_percent ? Number(allocationForm.allocation_percent) : null,
      object_id: allocationForm.object_id || null,
      cost_center_id: allocationForm.cost_center_id || null,
      axis_value_id: allocationForm.axis_value_id || null,
      is_direct: allocationForm.is_direct === '__YES__',
      cost_behavior: allocationForm.cost_behavior || null,
      destination: allocationForm.destination || null,
      method: allocationForm.method || null,
    });
    const { error } = await supabase.from('analytical_allocations').insert(payload);
    if (error) throw error;
    setAllocationDialogOpen(false);
    setAllocationForm({
      entry_id: '',
      amount: '',
      allocation_percent: '',
      object_id: '',
      cost_center_id: '',
      axis_value_id: '',
      is_direct: '__NO__',
      cost_behavior: 'variable',
      destination: 'production',
      method: 'full_costing',
    });
    await loadAll();
  };

  const createBudget = async () => {
    if (!budgetForm.budget_name.trim()) return;
    const payload = withCompanyScope({
      user_id: user.id,
      budget_name: budgetForm.budget_name.trim(),
      period_start: budgetForm.period_start,
      period_end: budgetForm.period_end,
      method: budgetForm.method,
      object_id: budgetForm.object_id || null,
      cost_center_id: budgetForm.cost_center_id || null,
      axis_value_id: budgetForm.axis_value_id || null,
      is_active: false,
    });
    const { data, error } = await supabase.from('analytical_budgets').insert(payload).select('id').single();
    if (error) throw error;

    if (data?.id) {
      const { error: genError } = await supabase.rpc('f_generate_budget_lines', {
        p_user_id: user.id,
        p_company_id: activeCompanyId,
        p_budget_id: data.id,
        p_total_amount: null,
        p_replace_existing: true,
      });
      if (genError) throw genError;

      const { error: activateError } = await supabase
        .from('analytical_budgets')
        .update({ is_active: true })
        .eq('id', data.id)
        .eq('user_id', user.id)
        .eq('company_id', activeCompanyId);
      if (activateError) throw activateError;

      setSelectedBudgetId(data.id);
    }

    setBudgetDialogOpen(false);
    setBudgetDialogMode('create');
    setBudgetForm(emptyBudgetForm());
    await loadAll();
  };

  const updateBudget = async () => {
    if (!selectedBudgetId || !budgetForm.budget_name.trim()) return;
    const payload = {
      budget_name: budgetForm.budget_name.trim(),
      period_start: budgetForm.period_start,
      period_end: budgetForm.period_end,
      method: budgetForm.method,
      object_id: budgetForm.object_id || null,
      cost_center_id: budgetForm.cost_center_id || null,
      axis_value_id: budgetForm.axis_value_id || null,
    };
    let query = supabase.from('analytical_budgets').update(payload).eq('id', selectedBudgetId).eq('user_id', user.id);
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { error } = await query;
    if (error) throw error;
    setBudgetDialogOpen(false);
    setBudgetDialogMode('create');
    setBudgetForm(emptyBudgetForm());
    await loadAll();
  };

  const deleteBudget = async (budgetId) => {
    if (!budgetId) return;
    const confirmed = window.confirm('Supprimer ce budget et toutes ses lignes ?');
    if (!confirmed) return;
    let query = supabase.from('analytical_budgets').delete().eq('id', budgetId).eq('user_id', user.id);
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { error } = await query;
    if (error) throw error;
    setSelectedBudgetId((prev) => (prev === budgetId ? null : prev));
    await loadAll();
  };

  const openCreateBudgetDialog = () => {
    setBudgetDialogMode('create');
    setBudgetForm(emptyBudgetForm());
    setBudgetDialogOpen(true);
  };

  const openEditBudgetDialog = (budget) => {
    if (!budget) return;
    setBudgetDialogMode('edit');
    setBudgetForm({
      budget_name: budget.budget_name || '',
      period_start: budget.period_start || defaultStartDate(),
      period_end: budget.period_end || currentDate(),
      method: budget.method || 'full_costing',
      object_id: budget.object_id || '',
      cost_center_id: budget.cost_center_id || '',
      axis_value_id: budget.axis_value_id || '',
    });
    setBudgetDialogOpen(true);
  };

  const openCreateBudgetLineDialog = () => {
    setBudgetLineForm(emptyBudgetLineForm());
    setBudgetLineDialogOpen(true);
  };

  const openEditBudgetLineDialog = (line) => {
    if (!line) return;
    setBudgetLineForm({
      id: line.id,
      period_month: line.period_month,
      planned_amount: String(line.planned_amount ?? ''),
      planned_volume: line.planned_volume == null ? '' : String(line.planned_volume),
      planned_unit_cost: line.planned_unit_cost == null ? '' : String(line.planned_unit_cost),
      notes: line.notes || '',
    });
    setBudgetLineDialogOpen(true);
  };

  const saveBudgetLine = async () => {
    if (!selectedBudgetId || !budgetLineForm.period_month) return;
    const payload = withCompanyScope({
      user_id: user.id,
      budget_id: selectedBudgetId,
      period_month: budgetLineForm.period_month,
      planned_amount: budgetLineForm.planned_amount === '' ? 0 : Number(budgetLineForm.planned_amount),
      planned_volume: budgetLineForm.planned_volume === '' ? null : Number(budgetLineForm.planned_volume),
      planned_unit_cost: budgetLineForm.planned_unit_cost === '' ? null : Number(budgetLineForm.planned_unit_cost),
      notes: budgetLineForm.notes || null,
    });
    if (budgetLineForm.id) {
      payload.id = budgetLineForm.id;
    }
    const { error } = await supabase
      .from('analytical_budget_lines')
      .upsert(payload, { onConflict: 'budget_id,period_month' });
    if (error) throw error;
    setBudgetLineDialogOpen(false);
    setBudgetLineForm(emptyBudgetLineForm());
    await loadBudgetDetails(selectedBudgetId);
    await loadAll();
  };

  const deleteBudgetLine = async (lineId) => {
    if (!lineId) return;
    const confirmed = window.confirm('Supprimer cette ligne budgétaire ?');
    if (!confirmed) return;
    let query = supabase.from('analytical_budget_lines').delete().eq('id', lineId).eq('user_id', user.id);
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { error } = await query;
    if (error) throw error;
    await loadBudgetDetails(selectedBudgetId);
    await loadAll();
  };

  const generateBudgetLines = async () => {
    if (!selectedBudgetId) return;
    const total = budgetTotalAmount === '' ? null : Number(budgetTotalAmount);
    const { data, error } = await supabase.rpc('f_generate_budget_lines', {
      p_user_id: user.id,
      p_company_id: activeCompanyId,
      p_budget_id: selectedBudgetId,
      p_total_amount: total,
      p_replace_existing: replaceBudgetLines === '__YES__',
    });
    if (error) throw error;
    toast({ title: 'Lignes générées', description: `${Number(data || 0)} ligne(s) traitée(s).` });
    await loadBudgetDetails(selectedBudgetId);
    await loadAll();
  };

  const runBudgetSimulation = async (overrides = null) => {
    if (!selectedBudgetId) return;
    setSimulating(true);
    try {
      const data = await fetchBudgetSimulation(selectedBudgetId, overrides || {});
      setSimulationRows(data);
      toast({
        title: 'Simulation recalculée',
        description: `${data.length} point(s) de courbe chargés depuis la base.`,
      });
    } catch (err) {
      toast({ title: 'Erreur simulation', description: err.message, variant: 'destructive' });
    } finally {
      setSimulating(false);
    }
  };

  const saveScenario = async () => {
    if (!selectedBudgetId || !scenarioName.trim()) return;
    const payload = withCompanyScope({
      user_id: user.id,
      budget_id: selectedBudgetId,
      scenario_name: scenarioName.trim(),
      revenue_growth_percent: Number(simGrowthPercent || 0),
      cost_optimization_percent: Number(simCostOptimizationPercent || 0),
      risk_percent: Number(simRiskPercent || 0),
      notes: scenarioNotes.trim() || null,
      is_active: true,
    });
    const { error } = await supabase.from('analytical_budget_scenarios').upsert(payload, {
      onConflict: 'company_id,user_id,budget_id,scenario_name',
    });
    if (error) throw error;
    const [scenariosData, summariesData] = await Promise.all([
      fetchBudgetScenarios(selectedBudgetId),
      fetchScenarioSummaries(selectedBudgetId),
    ]);
    setBudgetScenarios(scenariosData);
    setScenarioSummaries(summariesData);
    const created = scenariosData.find((s) => s.scenario_name === scenarioName.trim());
    setSelectedScenarioId(created?.id || '');
    toast({ title: 'Scénario sauvegardé', description: `Scénario "${scenarioName.trim()}" enregistré en base.` });
  };

  const applyScenario = async (scenarioId) => {
    if (!selectedBudgetId || !scenarioId) return;
    const scenario = budgetScenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setSelectedScenarioId(scenario.id);
    setScenarioName(scenario.scenario_name || '');
    setScenarioNotes(scenario.notes || '');
    setSimGrowthPercent(String(scenario.revenue_growth_percent ?? 0));
    setSimCostOptimizationPercent(String(scenario.cost_optimization_percent ?? 0));
    setSimRiskPercent(String(scenario.risk_percent ?? 0));

    const { data, error } = await supabase.rpc('f_analytical_budget_scenario_curve', {
      p_user_id: user.id,
      p_company_id: activeCompanyId,
      p_budget_id: selectedBudgetId,
      p_scenario_id: scenario.id,
    });
    if (error) throw error;
    setSimulationRows(data || []);
    toast({ title: 'Scénario appliqué', description: `${scenario.scenario_name} chargé depuis la base.` });
  };

  const deleteScenario = async (scenarioId) => {
    if (!scenarioId) return;
    const confirmed = window.confirm('Supprimer ce scénario budgétaire ?');
    if (!confirmed) return;
    let query = supabase.from('analytical_budget_scenarios').delete().eq('id', scenarioId).eq('user_id', user.id);
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { error } = await query;
    if (error) throw error;

    const [scenariosData, summariesData] = await Promise.all([
      fetchBudgetScenarios(selectedBudgetId),
      fetchScenarioSummaries(selectedBudgetId),
    ]);
    setBudgetScenarios(scenariosData);
    setScenarioSummaries(summariesData);
    setSelectedScenarioId((prev) => (prev === scenarioId ? '' : prev));
    toast({ title: 'Scénario supprimé' });
  };

  const clearScenarioSelection = async () => {
    setSelectedScenarioId('');
    setScenarioName('');
    setScenarioNotes('');
    await runBudgetSimulation();
  };

  const redistributeAuxiliaryCenters = async () => {
    if (!activeCompanyId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('f_redistribute_auxiliary_centers', {
        p_user_id: user.id,
        p_company_id: activeCompanyId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      toast({ title: 'Redistribution terminée', description: `${data || 0} allocation(s) générée(s).` });
      await loadAll();
    } catch (err) {
      toast({ title: 'Erreur redistribution', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const allocationHealth = useMemo(() => {
    const byEntry = allocations.reduce((acc, row) => {
      const key = row.entry_id;
      if (!acc[key]) acc[key] = { totalAmount: 0, totalPct: 0, hasPct: false };
      acc[key].totalAmount += Number(row.amount || 0);
      if (row.allocation_percent != null) {
        acc[key].totalPct += Number(row.allocation_percent || 0);
        acc[key].hasPct = true;
      }
      return acc;
    }, {});
    const entries = Object.values(byEntry);
    const withPct = entries.filter((e) => e.hasPct).length;
    const validPct = entries.filter((e) => !e.hasPct || Math.abs(e.totalPct - 100) <= 0.01).length;
    return { totalEntries: entries.length, withPct, validPct };
  }, [allocations]);

  const selectedBudget = useMemo(
    () => budgets.find((b) => b.id === selectedBudgetId) || null,
    [budgets, selectedBudgetId]
  );

  const selectedScenario = useMemo(
    () => budgetScenarios.find((s) => s.id === selectedScenarioId) || null,
    [budgetScenarios, selectedScenarioId]
  );

  const budgetTotals = useMemo(() => {
    const actualByMonth = new Map(budgetLineVariances.map((row) => [row.period_month, Number(row.actual_amount || 0)]));
    const planned = budgetLines.reduce((sum, row) => sum + Number(row.planned_amount || 0), 0);
    const actual = budgetLines.reduce((sum, row) => sum + Number(actualByMonth.get(row.period_month) || 0), 0);
    return {
      planned,
      actual,
      variance: actual - planned,
    };
  }, [budgetLineVariances, budgetLines]);

  const budgetLineVarianceByMonth = useMemo(
    () => new Map(budgetLineVariances.map((row) => [row.period_month, row])),
    [budgetLineVariances]
  );

  const simulationByMonth = useMemo(
    () => new Map(simulationRows.map((row) => [row.period_month, row])),
    [simulationRows]
  );

  const budgetCurveData = useMemo(
    () =>
      budgetLines.map((line) => {
        const variance = budgetLineVarianceByMonth.get(line.period_month);
        const sim = simulationByMonth.get(line.period_month);
        return {
          period_month: line.period_month,
          month: line.period_month ? line.period_month.slice(0, 7) : '-',
          planned: Number(line.planned_amount || 0),
          actual: Number(variance?.actual_amount || 0),
          variance: Number(variance?.variance_amount || 0),
          baseline: Number(sim?.simulated_baseline || 0),
          optimistic: Number(sim?.simulated_optimistic || 0),
          prudent: Number(sim?.simulated_prudent || 0),
        };
      }),
    [budgetLineVarianceByMonth, budgetLines, simulationByMonth]
  );

  useEffect(() => {
    if (!selectedScenario) return;
    setScenarioName(selectedScenario.scenario_name || '');
    setScenarioNotes(selectedScenario.notes || '');
  }, [selectedScenario]);

  const safeAction = async (fn) => {
    try {
      await fn();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  if (!activeCompanyId) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">{t('accounting.analytique.title', 'Comptabilité analytique')}</CardTitle>
        </CardHeader>
        <CardContent className="text-gray-400">
          Sélectionnez une société active pour gérer la comptabilité analytique.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {t('accounting.analytique.title', 'Comptabilité analytique')}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Scope strict company_id actif • audit CRUD transactionnel • calculs DB-first
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
            <Building2 className="w-3.5 h-3.5 mr-1" />
            Société active
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => safeAction(bootstrapAnalyticalFromSeed)}
            disabled={loading || syncing}
          >
            <Wand2 className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Initialiser depuis la compta seedée
          </Button>
          <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      <Tabs value={moduleTab} onValueChange={setModuleTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-2">
          <TabsTrigger value="objects">Objets</TabsTrigger>
          <TabsTrigger value="centers">Centres</TabsTrigger>
          <TabsTrigger value="rules">Règles</TabsTrigger>
          <TabsTrigger value="allocations">Imputations</TabsTrigger>
          <TabsTrigger value="methods">Méthodes</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="objects" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm">Objets de coûts & axes</CardTitle>
              <div className="flex gap-2">
                <Dialog open={axisDialogOpen} onOpenChange={setAxisDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvel axe
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#0f1528] border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle>Créer un axe analytique</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Label>Type</Label>
                      <Select
                        value={axisForm.axis_type}
                        onValueChange={(v) => setAxisForm((p) => ({ ...p, axis_type: v }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1528] border-white/10">
                          {AXIS_TYPES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label>Code</Label>
                      <Input
                        className="bg-white/5 border-white/20"
                        value={axisForm.axis_code}
                        onChange={(e) => setAxisForm((p) => ({ ...p, axis_code: e.target.value }))}
                      />
                      <Label>Libellé</Label>
                      <Input
                        className="bg-white/5 border-white/20"
                        value={axisForm.axis_name}
                        onChange={(e) => setAxisForm((p) => ({ ...p, axis_name: e.target.value }))}
                      />
                      <Button className="w-full" onClick={() => safeAction(createAxis)}>
                        Enregistrer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={objectDialogOpen} onOpenChange={setObjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvel objet
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#0f1528] border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle>Créer un objet de coût</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Label>Type</Label>
                      <Select
                        value={objectForm.object_type}
                        onValueChange={(v) => setObjectForm((p) => ({ ...p, object_type: v }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1528] border-white/10">
                          {OBJECT_TYPES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label>Code</Label>
                      <Input
                        className="bg-white/5 border-white/20"
                        value={objectForm.object_code}
                        onChange={(e) => setObjectForm((p) => ({ ...p, object_code: e.target.value }))}
                      />
                      <Label>Nom</Label>
                      <Input
                        className="bg-white/5 border-white/20"
                        value={objectForm.object_name}
                        onChange={(e) => setObjectForm((p) => ({ ...p, object_name: e.target.value }))}
                      />
                      <Button className="w-full" onClick={() => safeAction(createObject)}>
                        Enregistrer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">Axes analytiques</p>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead>Type</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Libellé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {axes.map((a) => (
                      <TableRow key={a.id} className="border-white/5">
                        <TableCell className="text-gray-300">{a.axis_type}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{a.axis_code}</Badge>
                        </TableCell>
                        <TableCell className="text-white">{a.axis_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Objets de coûts</p>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead>Type</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Nom</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {objects.map((o) => (
                      <TableRow key={o.id} className="border-white/5">
                        <TableCell className="text-gray-300">{o.object_type}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{o.object_code}</Badge>
                        </TableCell>
                        <TableCell className="text-white">{o.object_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="centers" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm">Centres principaux / auxiliaires / structure</CardTitle>
              <Dialog open={centerDialogOpen} onOpenChange={setCenterDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau centre
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0f1528] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>Créer un centre d’analyse</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Label>Code</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      value={centerForm.center_code}
                      onChange={(e) => setCenterForm((p) => ({ ...p, center_code: e.target.value }))}
                    />
                    <Label>Nom</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      value={centerForm.center_name}
                      onChange={(e) => setCenterForm((p) => ({ ...p, center_name: e.target.value }))}
                    />
                    <Label>Type</Label>
                    <Select
                      value={centerForm.center_type}
                      onValueChange={(v) => setCenterForm((p) => ({ ...p, center_type: v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        {CENTER_TYPES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Axe (optionnel)</Label>
                    <Select
                      value={centerForm.axis_id || '__none__'}
                      onValueChange={(v) => setCenterForm((p) => ({ ...p, axis_id: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {axes.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.axis_code} • {a.axis_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={() => safeAction(createCenter)}>
                      Enregistrer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centers.map((c) => (
                    <TableRow key={c.id} className="border-white/5">
                      <TableCell>
                        <Badge variant="outline">{c.center_code}</Badge>
                      </TableCell>
                      <TableCell className="text-white">{c.center_name}</TableCell>
                      <TableCell className="text-gray-300">{c.center_type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm">Règles de répartition</CardTitle>
              <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle règle
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0f1528] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>Créer une règle d’allocation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Label>Nom</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      value={ruleForm.rule_name}
                      onChange={(e) => setRuleForm((p) => ({ ...p, rule_name: e.target.value }))}
                    />
                    <Label>Source type</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      value={ruleForm.source_type}
                      onChange={(e) => setRuleForm((p) => ({ ...p, source_type: e.target.value }))}
                    />
                    <Label>Source catégorie</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      value={ruleForm.source_category}
                      onChange={(e) => setRuleForm((p) => ({ ...p, source_category: e.target.value }))}
                    />
                    <Label>% allocation</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      type="number"
                      value={ruleForm.allocation_percent}
                      onChange={(e) => setRuleForm((p) => ({ ...p, allocation_percent: e.target.value }))}
                    />
                    <Label>Centre (optionnel)</Label>
                    <Select
                      value={ruleForm.cost_center_id || '__none__'}
                      onValueChange={(v) => setRuleForm((p) => ({ ...p, cost_center_id: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {centers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.center_code} • {c.center_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Objet (optionnel)</Label>
                    <Select
                      value={ruleForm.object_id || '__none__'}
                      onValueChange={(v) => setRuleForm((p) => ({ ...p, object_id: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {objects.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.object_code} • {o.object_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Valeur d’axe (optionnel)</Label>
                    <Select
                      value={ruleForm.axis_value_id || '__none__'}
                      onValueChange={(v) => setRuleForm((p) => ({ ...p, axis_value_id: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {axisValues.map((av) => (
                          <SelectItem key={av.id} value={av.id}>
                            {av.value_code} • {av.value_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={() => safeAction(createRule)}>
                      Enregistrer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead>Nom</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id} className="border-white/5">
                      <TableCell className="text-white">{r.rule_name}</TableCell>
                      <TableCell className="text-gray-300">
                        {r.source_type || '-'} / {r.source_category || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatMoney(r.allocation_percent)}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm">Imputations analytiques</CardTitle>
              <Dialog open={allocationDialogOpen} onOpenChange={setAllocationDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle imputation
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0f1528] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>Imputer une écriture</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Label>ID écriture comptable</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      value={allocationForm.entry_id}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, entry_id: e.target.value }))}
                    />
                    <Label>Montant</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      type="number"
                      value={allocationForm.amount}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, amount: e.target.value }))}
                    />
                    <Label>% allocation</Label>
                    <Input
                      className="bg-white/5 border-white/20"
                      type="number"
                      value={allocationForm.allocation_percent}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, allocation_percent: e.target.value }))}
                    />
                    <Label>Objet (optionnel)</Label>
                    <Select
                      value={allocationForm.object_id || '__none__'}
                      onValueChange={(v) => setAllocationForm((p) => ({ ...p, object_id: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {objects.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.object_code} • {o.object_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Centre (optionnel)</Label>
                    <Select
                      value={allocationForm.cost_center_id || '__none__'}
                      onValueChange={(v) =>
                        setAllocationForm((p) => ({ ...p, cost_center_id: v === '__none__' ? '' : v }))
                      }
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {centers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.center_code} • {c.center_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Valeur d’axe (optionnel)</Label>
                    <Select
                      value={allocationForm.axis_value_id || '__none__'}
                      onValueChange={(v) =>
                        setAllocationForm((p) => ({ ...p, axis_value_id: v === '__none__' ? '' : v }))
                      }
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {axisValues.map((av) => (
                          <SelectItem key={av.id} value={av.id}>
                            {av.value_code} • {av.value_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Type de coût</Label>
                    <Select
                      value={allocationForm.cost_behavior}
                      onValueChange={(v) => setAllocationForm((p) => ({ ...p, cost_behavior: v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        {COST_BEHAVIORS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Destination</Label>
                    <Select
                      value={allocationForm.destination}
                      onValueChange={(v) => setAllocationForm((p) => ({ ...p, destination: v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        {DESTINATIONS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Méthode</Label>
                    <Select
                      value={allocationForm.method}
                      onValueChange={(v) => setAllocationForm((p) => ({ ...p, method: v }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f1528] border-white/10">
                        {METHODS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={() => safeAction(createAllocation)}>
                      Enregistrer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <Card className="bg-[#10192d] border-white/10">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400">Écritures allocées</p>
                    <p className="text-xl text-white font-semibold">{allocationHealth.totalEntries}</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#10192d] border-white/10">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400">Entrées avec %</p>
                    <p className="text-xl text-white font-semibold">{allocationHealth.withPct}</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#10192d] border-white/10">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400">% équilibré à 100</p>
                    <p className="text-xl text-emerald-300 font-semibold">{allocationHealth.validPct}</p>
                  </CardContent>
                </Card>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead>Entry</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Méthode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => (
                    <TableRow key={a.id} className="border-white/5">
                      <TableCell className="text-gray-300 font-mono text-xs">{a.entry_id}</TableCell>
                      <TableCell className="text-white">{formatMoney(a.amount)} €</TableCell>
                      <TableCell className="text-gray-300">
                        {a.allocation_percent == null ? '-' : `${formatMoney(a.allocation_percent)}%`}
                      </TableCell>
                      <TableCell className="text-gray-300">{a.method || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Méthodes de coûts & redistribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-white/10 bg-[#10192d]">
                  <p className="text-sm text-white font-medium">Redistribution auxiliaire → principal</p>
                  <p className="text-xs text-gray-400 mt-1">RPC transactionnelle avec journalisation automatique.</p>
                  <Button className="mt-3" onClick={redistributeAuxiliaryCenters} disabled={syncing}>
                    <Activity className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    Exécuter la redistribution
                  </Button>
                </div>
                <div className="p-3 rounded-lg border border-white/10 bg-[#10192d]">
                  <p className="text-sm text-white font-medium">Fenêtre d’analyse</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input
                      type="date"
                      className="bg-white/5 border-white/20"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Input
                      type="date"
                      className="bg-white/5 border-white/20"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <Button className="mt-3" variant="outline" onClick={loadAll}>
                    Recalculer KPI
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Budgets analytiques
              </CardTitle>
              <div className="flex gap-2">
                <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={openCreateBudgetDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nouveau budget
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#0f1528] border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle>
                        {budgetDialogMode === 'edit' ? 'Modifier le budget' : 'Créer un budget analytique'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Label>Nom</Label>
                      <Input
                        className="bg-white/5 border-white/20"
                        value={budgetForm.budget_name}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, budget_name: e.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Début</Label>
                          <Input
                            type="date"
                            className="bg-white/5 border-white/20"
                            value={budgetForm.period_start}
                            onChange={(e) => setBudgetForm((p) => ({ ...p, period_start: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Fin</Label>
                          <Input
                            type="date"
                            className="bg-white/5 border-white/20"
                            value={budgetForm.period_end}
                            onChange={(e) => setBudgetForm((p) => ({ ...p, period_end: e.target.value }))}
                          />
                        </div>
                      </div>
                      <Label>Méthode</Label>
                      <Select
                        value={budgetForm.method}
                        onValueChange={(v) => setBudgetForm((p) => ({ ...p, method: v }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1528] border-white/10">
                          {METHODS.filter((m) => m !== 'manual').map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Label>Objet de coût</Label>
                      <Select
                        value={budgetForm.object_id || '__NONE__'}
                        onValueChange={(v) => setBudgetForm((p) => ({ ...p, object_id: v === '__NONE__' ? '' : v }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1528] border-white/10">
                          <SelectItem value="__NONE__">Aucun</SelectItem>
                          {objects.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.object_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Label>Centre</Label>
                      <Select
                        value={budgetForm.cost_center_id || '__NONE__'}
                        onValueChange={(v) =>
                          setBudgetForm((p) => ({ ...p, cost_center_id: v === '__NONE__' ? '' : v }))
                        }
                      >
                        <SelectTrigger className="bg-white/5 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1528] border-white/10">
                          <SelectItem value="__NONE__">Aucun</SelectItem>
                          {centers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.center_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Label>Axe</Label>
                      <Select
                        value={budgetForm.axis_value_id || '__NONE__'}
                        onValueChange={(v) =>
                          setBudgetForm((p) => ({ ...p, axis_value_id: v === '__NONE__' ? '' : v }))
                        }
                      >
                        <SelectTrigger className="bg-white/5 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1528] border-white/10">
                          <SelectItem value="__NONE__">Aucun</SelectItem>
                          {axisValues.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.value_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        className="w-full"
                        onClick={() => safeAction(budgetDialogMode === 'edit' ? updateBudget : createBudget)}
                      >
                        {budgetDialogMode === 'edit' ? 'Mettre à jour' : 'Enregistrer'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedBudget}
                  onClick={() => openEditBudgetDialog(selectedBudget)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedBudget}
                  onClick={() => safeAction(() => deleteBudget(selectedBudget?.id))}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 rounded-lg border border-white/10 bg-[#10192d] p-3">
                  <p className="text-xs text-gray-400 mb-2">Budgets disponibles</p>
                  <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                    {budgets.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left transition ${selectedBudgetId === b.id ? 'border-orange-400/60 bg-orange-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                        onClick={() => setSelectedBudgetId(b.id)}
                      >
                        <p className="text-white text-sm font-medium">{b.budget_name}</p>
                        <p className="text-xs text-gray-400">
                          {b.period_start} → {b.period_end}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{b.method}</p>
                      </button>
                    ))}
                    {budgets.length === 0 && (
                      <p className="text-xs text-gray-500">Aucun budget pour la société active.</p>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-lg border border-white/10 bg-[#10192d] p-3 space-y-3">
                  {selectedBudget ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{selectedBudget.budget_name}</p>
                          <p className="text-xs text-gray-400">
                            {selectedBudget.period_start} → {selectedBudget.period_end}
                          </p>
                        </div>
                        <Dialog open={budgetLineDialogOpen} onOpenChange={setBudgetLineDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={openCreateBudgetLineDialog}>
                              <Plus className="w-4 h-4 mr-2" />
                              Nouvelle ligne
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#0f1528] border-white/10 text-white">
                            <DialogHeader>
                              <DialogTitle>
                                {budgetLineForm.id ? 'Modifier ligne budgétaire' : 'Créer ligne budgétaire'}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <Label>Mois</Label>
                              <Input
                                type="date"
                                className="bg-white/5 border-white/20"
                                value={budgetLineForm.period_month}
                                onChange={(e) => setBudgetLineForm((p) => ({ ...p, period_month: e.target.value }))}
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label>Montant prévu</Label>
                                  <Input
                                    type="number"
                                    className="bg-white/5 border-white/20"
                                    value={budgetLineForm.planned_amount}
                                    onChange={(e) =>
                                      setBudgetLineForm((p) => ({ ...p, planned_amount: e.target.value }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Volume</Label>
                                  <Input
                                    type="number"
                                    className="bg-white/5 border-white/20"
                                    value={budgetLineForm.planned_volume}
                                    onChange={(e) =>
                                      setBudgetLineForm((p) => ({ ...p, planned_volume: e.target.value }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Coût unitaire</Label>
                                  <Input
                                    type="number"
                                    className="bg-white/5 border-white/20"
                                    value={budgetLineForm.planned_unit_cost}
                                    onChange={(e) =>
                                      setBudgetLineForm((p) => ({ ...p, planned_unit_cost: e.target.value }))
                                    }
                                  />
                                </div>
                              </div>
                              <Label>Notes</Label>
                              <Input
                                className="bg-white/5 border-white/20"
                                value={budgetLineForm.notes}
                                onChange={(e) => setBudgetLineForm((p) => ({ ...p, notes: e.target.value }))}
                              />
                              <Button className="w-full" onClick={() => safeAction(saveBudgetLine)}>
                                Enregistrer la ligne
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="grid md:grid-cols-4 gap-3">
                        <Card className="bg-[#0f1528] border-white/10">
                          <CardContent className="p-3">
                            <p className="text-xs text-gray-400">Couverture réelle</p>
                            <p className="text-white text-lg font-semibold">
                              {formatMoney(budgetQuality?.real_coverage_percent)}%
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#0f1528] border-white/10">
                          <CardContent className="p-3">
                            <p className="text-xs text-gray-400">Mois alimentés (réel)</p>
                            <p className="text-white text-lg font-semibold">
                              {Number(budgetQuality?.months_with_actual || 0)} /{' '}
                              {Number(budgetQuality?.months_planned || 0)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#0f1528] border-white/10">
                          <CardContent className="p-3">
                            <p className="text-xs text-gray-400">Axes imputés</p>
                            <p className="text-white text-lg font-semibold">
                              {Number(budgetQuality?.axes_imputed_count || 0)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#0f1528] border-white/10">
                          <CardContent className="p-3">
                            <p className="text-xs text-gray-400">Allocations utilisées</p>
                            <p className="text-white text-lg font-semibold">
                              {Number(budgetQuality?.allocations_count || 0)}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid md:grid-cols-3 gap-3">
                        <Card className="bg-[#0f1528] border-white/10">
                          <CardContent className="p-3">
                            <p className="text-xs text-gray-400">Prévu total</p>
                            <p className="text-white text-lg font-semibold">{formatMoney(budgetTotals.planned)} €</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#0f1528] border-white/10">
                          <CardContent className="p-3">
                            <p className="text-xs text-gray-400">Réel total</p>
                            <p className="text-white text-lg font-semibold">{formatMoney(budgetTotals.actual)} €</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#0f1528] border-white/10">
                          <CardContent className="p-3">
                            <p className="text-xs text-gray-400">Écart total</p>
                            <p
                              className={`text-lg font-semibold ${budgetTotals.variance >= 0 ? 'text-orange-300' : 'text-emerald-300'}`}
                            >
                              {formatMoney(budgetTotals.variance)} €
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-[#0f1528] p-3">
                        <p className="text-sm text-white font-medium flex items-center gap-2">
                          <Wand2 className="w-4 h-4" />
                          Génération automatique des lignes
                        </p>
                        <div className="grid md:grid-cols-3 gap-2 mt-2">
                          <div>
                            <Label>Montant total (optionnel)</Label>
                            <Input
                              type="number"
                              className="bg-white/5 border-white/20"
                              value={budgetTotalAmount}
                              onChange={(e) => setBudgetTotalAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Remplacer existant</Label>
                            <Select value={replaceBudgetLines} onValueChange={setReplaceBudgetLines}>
                              <SelectTrigger className="bg-white/5 border-white/20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#0f1528] border-white/10">
                                <SelectItem value="__NO__">Non</SelectItem>
                                <SelectItem value="__YES__">Oui</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={() => safeAction(generateBudgetLines)}
                            >
                              Générer mois par mois
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-[#0f1528] p-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm text-white font-medium">Scénarios persistés (source DB)</p>
                          <div className="flex gap-2 w-full md:w-auto">
                            <Input
                              className="bg-white/5 border-white/20"
                              value={scenarioName}
                              onChange={(e) => setScenarioName(e.target.value)}
                              placeholder="Nom scénario (ex: Croissance agressive)"
                            />
                            <Button
                              variant="outline"
                              onClick={() => safeAction(saveScenario)}
                              disabled={!selectedBudgetId || !scenarioName.trim()}
                            >
                              Sauvegarder
                            </Button>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2 mt-2">
                          <Input
                            className="bg-white/5 border-white/20"
                            value={scenarioNotes}
                            onChange={(e) => setScenarioNotes(e.target.value)}
                            placeholder="Notes scénario (optionnel)"
                          />
                          <Select
                            value={selectedScenarioId || '__NONE__'}
                            onValueChange={(v) =>
                              safeAction(async () => {
                                if (v === '__NONE__') {
                                  await clearScenarioSelection();
                                  return;
                                }
                                await applyScenario(v);
                              })
                            }
                          >
                            <SelectTrigger className="bg-white/5 border-white/20">
                              <SelectValue placeholder="Charger un scénario sauvegardé" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f1528] border-white/10">
                              <SelectItem value="__NONE__">Aucun</SelectItem>
                              {budgetScenarios.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.scenario_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Les hypothèses sont historisées par société et budget dans la table
                          `analytical_budget_scenarios`.
                        </p>
                        {selectedScenarioId && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => safeAction(() => deleteScenario(selectedScenarioId))}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Supprimer le scénario sélectionné
                            </Button>
                          </div>
                        )}
                        <div className="mt-3">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-white/10">
                                <TableHead>Scénario</TableHead>
                                <TableHead>Prévu</TableHead>
                                <TableHead>Réel</TableHead>
                                <TableHead>Écart</TableHead>
                                <TableHead>Sim. base</TableHead>
                                <TableHead>Sim. optimiste</TableHead>
                                <TableHead>Sim. prudente</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {scenarioSummaries.map((row) => (
                                <TableRow key={row.scenario_id} className="border-white/5">
                                  <TableCell className="text-white">{row.scenario_name}</TableCell>
                                  <TableCell className="text-gray-300">{formatMoney(row.planned_total)} €</TableCell>
                                  <TableCell className="text-gray-300">{formatMoney(row.actual_total)} €</TableCell>
                                  <TableCell
                                    className={Number(row.variance_total) >= 0 ? 'text-orange-300' : 'text-emerald-300'}
                                  >
                                    {formatMoney(row.variance_total)} €
                                  </TableCell>
                                  <TableCell className="text-gray-300">
                                    {formatMoney(row.simulated_baseline_total)} €
                                  </TableCell>
                                  <TableCell className="text-emerald-300">
                                    {formatMoney(row.simulated_optimistic_total)} €
                                  </TableCell>
                                  <TableCell className="text-sky-300">
                                    {formatMoney(row.simulated_prudent_total)} €
                                  </TableCell>
                                </TableRow>
                              ))}
                              {scenarioSummaries.length === 0 && (
                                <TableRow className="border-white/5">
                                  <TableCell colSpan={7} className="text-center text-gray-500 py-4">
                                    Aucun scénario enregistré pour ce budget.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-[#0f1528] p-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm text-white font-medium">Courbes budgétaires & simulation (source DB)</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto">
                            <Input
                              type="number"
                              className="bg-white/5 border-white/20"
                              value={simGrowthPercent}
                              onChange={(e) => setSimGrowthPercent(e.target.value)}
                              placeholder="Croissance %"
                            />
                            <Input
                              type="number"
                              className="bg-white/5 border-white/20"
                              value={simCostOptimizationPercent}
                              onChange={(e) => setSimCostOptimizationPercent(e.target.value)}
                              placeholder="Optimisation %"
                            />
                            <Input
                              type="number"
                              className="bg-white/5 border-white/20"
                              value={simRiskPercent}
                              onChange={(e) => setSimRiskPercent(e.target.value)}
                              placeholder="Risque %"
                            />
                            <Button
                              variant="outline"
                              onClick={() => safeAction(runBudgetSimulation)}
                              disabled={simulating}
                            >
                              {simulating ? 'Calcul...' : 'Simuler'}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Prévu, réel et simulations sont calculés via des RPC PostgreSQL sur les données de la société
                          active.
                        </p>
                        <div className="grid lg:grid-cols-2 gap-3 mt-3">
                          <div className="h-72 rounded-md border border-white/10 bg-[#10192d] p-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={budgetCurveData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#25314f" />
                                <XAxis dataKey="month" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                  contentStyle={{ background: '#0f1528', border: '1px solid #2b3a5d', color: '#fff' }}
                                  formatter={(value) => `${formatMoney(value)} €`}
                                />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="planned"
                                  name="Prévu (DB)"
                                  stroke="#f97316"
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="actual"
                                  name="Réel (DB)"
                                  stroke="#22c55e"
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="baseline"
                                  name="Simulation base (DB)"
                                  stroke="#60a5fa"
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="h-72 rounded-md border border-white/10 bg-[#10192d] p-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={budgetCurveData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#25314f" />
                                <XAxis dataKey="month" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                  contentStyle={{ background: '#0f1528', border: '1px solid #2b3a5d', color: '#fff' }}
                                  formatter={(value) => `${formatMoney(value)} €`}
                                />
                                <Legend />
                                <Bar dataKey="variance" name="Écart Réel-Prévu (DB)" fill="#f97316" />
                                <Bar dataKey="optimistic" name="Simulation optimiste (DB)" fill="#22c55e" />
                                <Bar dataKey="prudent" name="Simulation prudente (DB)" fill="#60a5fa" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead>Mois</TableHead>
                            <TableHead>Prévu</TableHead>
                            <TableHead>Réel</TableHead>
                            <TableHead>Écart</TableHead>
                            <TableHead>Volume</TableHead>
                            <TableHead>Coût unit.</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {budgetLines.map((line) => {
                            const variance = budgetLineVarianceByMonth.get(line.period_month);
                            const varianceAmount = Number(variance?.variance_amount || 0);
                            const variancePercent =
                              variance?.variance_percent == null ? null : Number(variance.variance_percent);
                            return (
                              <TableRow key={line.id} className="border-white/5">
                                <TableCell className="text-gray-300">{line.period_month}</TableCell>
                                <TableCell className="text-white">{formatMoney(line.planned_amount)} €</TableCell>
                                <TableCell className="text-gray-300">
                                  {formatMoney(variance?.actual_amount)} €
                                </TableCell>
                                <TableCell className={varianceAmount >= 0 ? 'text-orange-300' : 'text-emerald-300'}>
                                  {formatMoney(varianceAmount)} €{' '}
                                  {variancePercent == null ? '' : `(${formatMoney(variancePercent)}%)`}
                                </TableCell>
                                <TableCell className="text-gray-300">
                                  {line.planned_volume == null ? '-' : line.planned_volume}
                                </TableCell>
                                <TableCell className="text-gray-300">
                                  {line.planned_unit_cost == null ? '-' : line.planned_unit_cost}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openEditBudgetLineDialog(line)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => safeAction(() => deleteBudgetLine(line.id))}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {budgetLines.length === 0 && (
                            <TableRow className="border-white/5">
                              <TableCell colSpan={7} className="text-center text-gray-500 py-6">
                                Aucune ligne budgétaire. Générez les mois ou ajoutez une ligne.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Sélectionnez un budget pour gérer ses lignes, sa génération automatique et ses écarts mensuels.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reporting" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                <PanelInfoPopover {...reportingInfo.reportingPanel} />
                <span>KPI analytiques (DB-first)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <Card className="bg-[#10192d] border-white/10">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400 inline-flex items-center gap-1.5">
                      <PanelInfoPopover {...reportingInfo.mcv} />
                      <span>MCV</span>
                    </p>
                    <p className="text-xl text-white font-semibold">{formatMoney(kpis?.mcv)} €</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#10192d] border-white/10">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400 inline-flex items-center gap-1.5">
                      <PanelInfoPopover {...reportingInfo.seuilRentabilite} />
                      <span>Seuil rentabilité</span>
                    </p>
                    <p className="text-xl text-orange-300 font-semibold">{formatMoney(kpis?.seuil_rentabilite)} €</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#10192d] border-white/10">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400 inline-flex items-center gap-1.5">
                      <PanelInfoPopover {...reportingInfo.resultatAnalytique} />
                      <span>Résultat analytique</span>
                    </p>
                    <p className="text-xl text-emerald-300 font-semibold">{formatMoney(kpis?.resultat_analytique)} €</p>
                  </CardContent>
                </Card>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead>Budget</TableHead>
                    <TableHead>Dimension</TableHead>
                    <TableHead>Prévu</TableHead>
                    <TableHead>Réel</TableHead>
                    <TableHead>Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variances.map((v) => (
                    <TableRow key={`${v.budget_id}-${v.dimension}`} className="border-white/5">
                      <TableCell className="text-white">{v.budget_name}</TableCell>
                      <TableCell className="text-gray-300">{v.dimension}</TableCell>
                      <TableCell className="text-gray-300">{formatMoney(v.planned_amount)} €</TableCell>
                      <TableCell className="text-gray-300">{formatMoney(v.actual_amount)} €</TableCell>
                      <TableCell className={Number(v.variance_amount) >= 0 ? 'text-orange-300' : 'text-emerald-300'}>
                        {formatMoney(v.variance_amount)} €{' '}
                        {v.variance_percent == null ? '' : `(${formatMoney(v.variance_percent)}%)`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
