import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * Bilan Social hook.
 *
 * Fetches all social-report KPIs from the SQL function `fn_bilan_social()`
 * via `supabase.rpc()`. The function returns a single JSONB object with
 * headcount, turnover_rate, department_breakdown, etc.
 *
 * Active employees are fetched separately for the page table display.
 */
export function useBilanSocial() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bilanData, setBilanData] = useState(null);
  const [activeEmployees, setActiveEmployees] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase || !activeCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const employeesQuery = supabase
        .from('hr_employees')
        .select('id, full_name, status, hire_date, department_id')
        .eq('status', 'active')
        .order('hire_date', { ascending: false });

      const _results = await Promise.allSettled([
        supabase.rpc('fn_bilan_social', { p_company_id: activeCompanyId }),
        applyCompanyScope(employeesQuery, { includeUnassigned: false }),
      ]);

      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`BilanSocial fetch ${i} failed:`, r.reason);
      });

      const bilanResult = _results[0].status === 'fulfilled' ? _results[0].value : { data: null, error: null };
      const employeesResult = _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };

      if (bilanResult.error) console.error('BilanSocial bilan query error:', bilanResult.error);
      if (employeesResult.error) console.error('BilanSocial employees query error:', employeesResult.error);

      setBilanData(bilanResult.data);
      setActiveEmployees(employeesResult.data || []);
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
  }, [activeCompanyId, applyCompanyScope, toast, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const latestSnapshot = bilanData || null;
  const previousSnapshot = null;
  const snapshots = useMemo(() => (latestSnapshot ? [latestSnapshot] : []), [latestSnapshot]);
  const last6 = useMemo(() => snapshots.slice(0, 6).reverse(), [snapshots]);
  const last12 = useMemo(() => snapshots.slice(0, 12).reverse(), [snapshots]);

  const headcountEvolution = useMemo(
    () => last12.map((s) => ({ date: s.snapshot_date, headcount: Number(s.headcount || 0) })),
    [last12]
  );
  const turnoverTrend = useMemo(
    () => last12.map((s) => ({ date: s.snapshot_date, rate: Number(s.turnover_rate || 0) })),
    [last12]
  );

  const genderIndex = useMemo(() => {
    const f = Number(latestSnapshot?.gender_ratio_f || 0.5);
    return { female: Math.round(f * 100), male: Math.round((1 - f) * 100) };
  }, [latestSnapshot]);

  const departmentBreakdown = useMemo(() => latestSnapshot?.department_breakdown || [], [latestSnapshot]);

  // Age pyramid — same gaussian approximation (no birth_date in DB)
  const agePyramid = useMemo(() => {
    const brackets = [
      { label: '< 25', min: 0, max: 24 },
      { label: '25-34', min: 25, max: 34 },
      { label: '35-44', min: 35, max: 44 },
      { label: '45-54', min: 45, max: 54 },
      { label: '55+', min: 55, max: 200 },
    ];
    const avgAge = Number(latestSnapshot?.avg_age || 40);
    const totalActive = activeEmployees.length || 1;
    const femaleRatio = Number(latestSnapshot?.gender_ratio_f || 0.5);
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

  const trends = useMemo(
    () => ({
      turnover: last12.map((s) => ({ date: s.snapshot_date, value: Number(s.turnover_rate || 0) })),
      absenteeism: last12.map((s) => ({ date: s.snapshot_date, value: Number(s.absenteeism_rate || 0) })),
      enps: last12.map((s) => ({ date: s.snapshot_date, value: Number(s.enps_score || 0) })),
    }),
    [last12]
  );

  const employees = activeEmployees;
  const departments = useMemo(
    () => departmentBreakdown.map((d) => ({ id: d.id, name: d.name })),
    [departmentBreakdown]
  );

  return {
    loading,
    error,
    snapshots,
    employees,
    departments,
    budgets: [],
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
