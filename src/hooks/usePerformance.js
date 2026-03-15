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
        .select('*, incumbent:hr_employees!incumbent_id(id, full_name, job_title)')
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

      // Apply company scope to filter by active company
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
  }, [applyCompanyScope, toast, user]);
  // --- Reviews CRUD ---

  const createReview = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        employee_id: payload.employee_id,
        reviewer_id: payload.reviewer_id || null,
        period_year: payload.period_year ?? new Date().getFullYear(),
        period_label: payload.period_label || null,
        review_type: payload.review_type || 'annual',
        status: 'draft',
        objectives: payload.objectives || [],
        competencies: payload.competencies || [],
        overall_score: null,
        performance_rating: null,
        nine_box_performance: null,
        nine_box_potential: null,
        employee_comment: null,
        hr_comment: null,
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
  );
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
  );
  const submitSelfAssessment = useCallback(
    async (reviewId, payload) => {
      if (!reviewId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_performance_reviews')
        .update({
          overall_score: payload.overall_score,
          employee_comment: payload.employee_comment || null,
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
  );
  const submitManagerReview = useCallback(
    async (reviewId, payload) => {
      if (!reviewId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_performance_reviews')
        .update({
          overall_score: payload.overall_score,
          hr_comment: payload.hr_comment || null,
          performance_rating: payload.performance_rating || null,
          nine_box_performance: payload.nine_box_performance ?? null,
          nine_box_potential: payload.nine_box_potential ?? null,
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
  );
  const signReview = useCallback(
    async (reviewId) => {
      if (!reviewId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_performance_reviews')
        .update({
          status: 'signed',
          employee_signed_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  );
  // --- Succession Plans ---

  const createSuccessionPlan = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        position_id: payload.position_id || null,
        position_title: payload.position_title,
        incumbent_id: payload.incumbent_id || null,
        successor_id: payload.successor_id || null,
        readiness_level: payload.readiness_level || null,
        nine_box_performance: payload.nine_box_performance ?? null,
        nine_box_potential: payload.nine_box_potential ?? null,
        risk_of_loss: payload.risk_of_loss || 'low',
        development_actions: payload.development_actions || null,
        notes: payload.notes || null,
        reviewed_at: new Date().toISOString().split('T')[0],
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
  );
  const updateSuccessionPlan = useCallback(
    async (planId, updates) => {
      if (!planId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_succession_plans')
        .update({ ...updates, reviewed_at: new Date().toISOString().split('T')[0] })
        .eq('id', planId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  );
  // --- Headcount Budgets ---

  const createBudget = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        fiscal_year: payload.fiscal_year,
        department_id: payload.department_id || null,
        budgeted_headcount: Number(payload.budgeted_headcount || 0),
        actual_headcount: Number(payload.actual_headcount || 0),
        budgeted_fte: payload.budgeted_fte != null ? Number(payload.budgeted_fte) : null,
        actual_fte: payload.actual_fte != null ? Number(payload.actual_fte) : null,
        budgeted_payroll_cost: Number(payload.budgeted_payroll_cost || 0),
        actual_payroll_cost: Number(payload.actual_payroll_cost || 0),
        currency: payload.currency || 'EUR',
        planned_hires: payload.planned_hires != null ? Number(payload.planned_hires) : null,
        planned_exits: payload.planned_exits != null ? Number(payload.planned_exits) : null,
        planned_promotions: payload.planned_promotions != null ? Number(payload.planned_promotions) : null,
        version: payload.version || null,
        status: payload.status || 'draft',
        notes: payload.notes || null,
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
  );
  const updateBudget = useCallback(
    async (budgetId, updates) => {
      if (!budgetId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_headcount_budgets')
        .update(updates)
        .eq('id', budgetId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  );
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
