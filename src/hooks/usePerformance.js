import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export function usePerformance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [successionPlans, setSuccessionPlans] = useState([]);
  const [headcountBudgets, setHeadcountBudgets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let reviewsQuery = supabase
        .from('hr_performance_reviews')
        .select(
          '*, employee:hr_employees!employee_id(id, full_name, job_title, department_id, status), reviewer:hr_employees!reviewer_id(id, full_name, job_title)'
        )
        .order('created_at', { ascending: false });

      let successionQuery = supabase
        .from('hr_succession_plans')
        .select('*, incumbent:hr_employees!incumbent_employee_id(id, full_name, job_title)')
        .order('created_at', { ascending: false });

      let budgetsQuery = supabase
        .from('hr_headcount_budgets')
        .select('*, department:hr_departments!department_id(id, name)')
        .order('fiscal_year', { ascending: false });

      let employeesQuery = supabase
        .from('hr_employees')
        .select('id, full_name, job_title, department_id, status, company_id')
        .order('full_name', { ascending: true });

      let departmentsQuery = supabase
        .from('hr_departments')
        .select('id, name, company_id')
        .order('name', { ascending: true });

      reviewsQuery = applyCompanyScope(reviewsQuery);
      successionQuery = applyCompanyScope(successionQuery);
      budgetsQuery = applyCompanyScope(budgetsQuery);
      employeesQuery = applyCompanyScope(employeesQuery);
      departmentsQuery = applyCompanyScope(departmentsQuery);

      const [reviewsResult, successionResult, budgetsResult, employeesResult, departmentsResult] = await Promise.all([
        reviewsQuery,
        successionQuery,
        budgetsQuery,
        employeesQuery,
        departmentsQuery,
      ]);

      const firstError = [
        reviewsResult.error,
        successionResult.error,
        budgetsResult.error,
        employeesResult.error,
        departmentsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setReviews(reviewsResult.data || []);
      setSuccessionPlans(successionResult.data || []);
      setHeadcountBudgets(budgetsResult.data || []);
      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les entretiens');
      toast({
        title: 'Erreur Performance',
        description: err.message || 'Chargement impossible.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Reviews CRUD ---

  const createReview = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        employee_id: payload.employee_id,
        reviewer_id: payload.reviewer_id || null,
        review_period: payload.review_period,
        review_type: payload.review_type || 'annual',
        status: 'draft',
        objectives: payload.objectives || [],
        competencies: payload.competencies || [],
        overall_self_rating: null,
        overall_manager_rating: null,
        performance_label: null,
        potential_label: null,
        employee_comments: null,
        manager_comments: null,
        development_plan: null,
      });

      const { data, error: insertError } = await supabase
        .from('hr_performance_reviews')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const updateReview = useCallback(
    async (reviewId, updates) => {
      if (!reviewId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_performance_reviews')
        .update(updates)
        .eq('id', reviewId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const submitSelfAssessment = useCallback(
    async (reviewId, payload) => {
      if (!reviewId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_performance_reviews')
        .update({
          overall_self_rating: payload.overall_self_rating,
          employee_comments: payload.employee_comments || null,
          objectives: payload.objectives || undefined,
          competencies: payload.competencies || undefined,
          status: 'self_assessment_done',
        })
        .eq('id', reviewId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const submitManagerReview = useCallback(
    async (reviewId, payload) => {
      if (!reviewId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_performance_reviews')
        .update({
          overall_manager_rating: payload.overall_manager_rating,
          manager_comments: payload.manager_comments || null,
          performance_label: payload.performance_label || null,
          potential_label: payload.potential_label || null,
          development_plan: payload.development_plan || null,
          objectives: payload.objectives || undefined,
          competencies: payload.competencies || undefined,
          status: 'manager_review_done',
        })
        .eq('id', reviewId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const signReview = useCallback(
    async (reviewId) => {
      if (!reviewId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_performance_reviews')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Succession Plans ---

  const createSuccessionPlan = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        position_id: payload.position_id || null,
        position_title: payload.position_title,
        criticality: payload.criticality || 'medium',
        incumbent_employee_id: payload.incumbent_employee_id || null,
        successors: payload.successors || [],
        risk_of_vacancy: payload.risk_of_vacancy || 'low',
        last_reviewed_at: new Date().toISOString(),
      });

      const { data, error: insertError } = await supabase
        .from('hr_succession_plans')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const updateSuccessionPlan = useCallback(
    async (planId, updates) => {
      if (!planId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_succession_plans')
        .update({ ...updates, last_reviewed_at: new Date().toISOString() })
        .eq('id', planId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Headcount Budgets ---

  const createBudget = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        fiscal_year: payload.fiscal_year,
        department_id: payload.department_id || null,
        planned_headcount: Number(payload.planned_headcount || 0),
        actual_headcount: Number(payload.actual_headcount || 0),
        planned_payroll_cost: Number(payload.planned_payroll_cost || 0),
        actual_payroll_cost: Number(payload.actual_payroll_cost || 0),
        variance_headcount: Number(payload.actual_headcount || 0) - Number(payload.planned_headcount || 0),
        variance_cost: Number(payload.actual_payroll_cost || 0) - Number(payload.planned_payroll_cost || 0),
      });

      const { data, error: insertError } = await supabase
        .from('hr_headcount_budgets')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const updateBudget = useCallback(
    async (budgetId, updates) => {
      if (!budgetId || !supabase) return null;

      const patchedUpdates = { ...updates };
      if (updates.actual_headcount !== undefined || updates.planned_headcount !== undefined) {
        const planned = Number(updates.planned_headcount ?? 0);
        const actual = Number(updates.actual_headcount ?? 0);
        patchedUpdates.variance_headcount = actual - planned;
      }
      if (updates.actual_payroll_cost !== undefined || updates.planned_payroll_cost !== undefined) {
        const planned = Number(updates.planned_payroll_cost ?? 0);
        const actual = Number(updates.actual_payroll_cost ?? 0);
        patchedUpdates.variance_cost = actual - planned;
      }

      const { data, error: updateError } = await supabase
        .from('hr_headcount_budgets')
        .update(patchedUpdates)
        .eq('id', budgetId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    activeCompanyId,
    loading,
    error,
    reviews,
    successionPlans,
    headcountBudgets,
    employees,
    departments,
    fetchData,
    createReview,
    updateReview,
    submitSelfAssessment,
    submitManagerReview,
    signReview,
    createSuccessionPlan,
    updateSuccessionPlan,
    createBudget,
    updateBudget,
  };
}
