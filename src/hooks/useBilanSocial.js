import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export function useBilanSocial() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [budgets, setBudgets] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let snapshotsQuery = supabase
        .from('hr_kpi_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(24);

      let employeesQuery = supabase
        .from('hr_employees')
        .select('id, company_id, full_name, status, hire_date, termination_date, job_title, department_id')
        .order('hire_date', { ascending: false });

      let departmentsQuery = supabase
        .from('hr_departments')
        .select('id, company_id, name')
        .order('name', { ascending: true });

      let budgetsQuery = supabase.from('hr_headcount_budgets').select('*').order('fiscal_year', { ascending: false });

      snapshotsQuery = applyCompanyScope(snapshotsQuery);
      employeesQuery = applyCompanyScope(employeesQuery);
      departmentsQuery = applyCompanyScope(departmentsQuery);
      budgetsQuery = applyCompanyScope(budgetsQuery);

      const [snapshotsResult, employeesResult, departmentsResult, budgetsResult] = await Promise.all([
        snapshotsQuery,
        employeesQuery,
        departmentsQuery,
        budgetsQuery,
      ]);

      const firstError = [
        snapshotsResult.error,
        employeesResult.error,
        departmentsResult.error,
        budgetsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setSnapshots(snapshotsResult.data || []);
      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
      setBudgets(budgetsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger le bilan social');
      toast({
        title: 'Erreur Bilan Social',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Latest and previous snapshots
  const latestSnapshot = useMemo(() => snapshots[0] || null, [snapshots]);
  const previousSnapshot = useMemo(() => snapshots[1] || null, [snapshots]);

  // Last 6 and 12 snapshots (chronological order for charts)
  const last6 = useMemo(() => snapshots.slice(0, 6).reverse(), [snapshots]);
  const last12 = useMemo(() => snapshots.slice(0, 12).reverse(), [snapshots]);

  // Headcount evolution: array of { date, headcount }
  const headcountEvolution = useMemo(
    () => last12.map((s) => ({ date: s.snapshot_date, headcount: Number(s.headcount || 0) })),
    [last12]
  );

  // Turnover trend: array of { date, rate }
  const turnoverTrend = useMemo(
    () => last12.map((s) => ({ date: s.snapshot_date, rate: Number(s.turnover_rate || 0) })),
    [last12]
  );

  // Gender index: % female from latest snapshot
  const genderIndex = useMemo(() => {
    if (!latestSnapshot) return { female: 0, male: 0 };
    const f = Number(latestSnapshot.gender_ratio_f || 0);
    return { female: Math.round(f * 100), male: Math.round((1 - f) * 100) };
  }, [latestSnapshot]);

  // Active employees
  const activeEmployees = useMemo(() => employees.filter((e) => e.status === 'active'), [employees]);

  // Department breakdown: { id, name, headcount, budgetPlanned, budgetActual }
  const departmentBreakdown = useMemo(() => {
    const _deptMap = new Map(departments.map((d) => [d.id, d.name]));
    const countByDept = new Map();
    activeEmployees.forEach((e) => {
      if (e.department_id) {
        countByDept.set(e.department_id, (countByDept.get(e.department_id) || 0) + 1);
      }
    });

    const currentYear = new Date().getFullYear();
    const yearBudgets = budgets.filter((b) => Number(b.fiscal_year) === currentYear);
    const budgetByDept = new Map(yearBudgets.map((b) => [b.department_id, b]));

    return departments.map((d) => {
      const budget = budgetByDept.get(d.id);
      return {
        id: d.id,
        name: d.name || 'Sans nom',
        headcount: countByDept.get(d.id) || 0,
        plannedHeadcount: Number(budget?.planned_headcount || 0),
        actualHeadcount: Number(budget?.actual_headcount || 0),
        plannedPayroll: Number(budget?.planned_payroll_cost || 0),
        actualPayroll: Number(budget?.actual_payroll_cost || 0),
      };
    });
  }, [activeEmployees, budgets, departments]);

  // Age pyramid data: count by age bracket and gender
  const agePyramid = useMemo(() => {
    const brackets = [
      { label: '< 25', min: 0, max: 24 },
      { label: '25-34', min: 25, max: 34 },
      { label: '35-44', min: 35, max: 44 },
      { label: '45-54', min: 45, max: 54 },
      { label: '55+', min: 55, max: 200 },
    ];

    // We don't have birth_date / gender per employee in the select,
    // so we use the aggregate avg_age / gender_ratio_f from snapshots for display.
    // For a real pyramid we would need individual employee data.
    // Return bracket structure with estimated distribution from avg_age.
    const avgAge = Number(latestSnapshot?.avg_age || 40);
    const totalActive = activeEmployees.length || Number(latestSnapshot?.headcount || 0);
    const femaleRatio = Number(latestSnapshot?.gender_ratio_f || 0.5);

    // Simple gaussian approximation around avg_age
    const weights = brackets.map((b) => {
      const mid = (b.min + b.max) / 2;
      const diff = mid - avgAge;
      return Math.exp(-(diff * diff) / 200);
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    return brackets.map((b, i) => {
      const count = Math.round((weights[i] / totalWeight) * totalActive);
      return {
        label: b.label,
        female: Math.round(count * femaleRatio),
        male: count - Math.round(count * femaleRatio),
      };
    });
  }, [activeEmployees.length, latestSnapshot]);

  // Trend data for charts
  const trends = useMemo(
    () => ({
      turnover: last12.map((s) => ({ date: s.snapshot_date, value: Number(s.turnover_rate || 0) })),
      absenteeism: last12.map((s) => ({ date: s.snapshot_date, value: Number(s.absenteeism_rate || 0) })),
      enps: last12.map((s) => ({ date: s.snapshot_date, value: Number(s.enps_score || 0) })),
    }),
    [last12]
  );

  return {
    loading,
    error,
    snapshots,
    employees,
    departments,
    budgets,
    latestSnapshot,
    previousSnapshot,
    last6,
    last12,
    headcountEvolution,
    turnoverTrend,
    genderIndex,
    activeEmployees,
    departmentBreakdown,
    agePyramid,
    trends,
    fetchData,
  };
}
