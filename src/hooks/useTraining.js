import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export function useTraining() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [skillAssessments, setSkillAssessments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let trainingsQuery = supabase.from('hr_training_catalog').select('*').order('created_at', { ascending: false });

      let enrollmentsQuery = supabase
        .from('hr_training_enrollments')
        .select(
          '*, hr_employees!employee_id(id, first_name, last_name, full_name), hr_training_catalog!training_id(id, title)'
        )
        .order('created_at', { ascending: false });

      let skillAssessmentsQuery = supabase
        .from('hr_skill_assessments')
        .select('*, hr_employees!employee_id(id, first_name, last_name, full_name)')
        .order('assessed_at', { ascending: false });

      let employeesQuery = supabase
        .from('hr_employees')
        .select(
          'id, company_id, first_name, last_name, full_name, status, department_id, skills:hr_employee_skills(id, skill_name, skill_level)'
        )
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      // Apply company scope to filter by active company
      trainingsQuery = applyCompanyScope(trainingsQuery);
      enrollmentsQuery = applyCompanyScope(enrollmentsQuery);
      skillAssessmentsQuery = applyCompanyScope(skillAssessmentsQuery);
      employeesQuery = applyCompanyScope(employeesQuery);

      const _results = await Promise.allSettled([
        trainingsQuery,
        enrollmentsQuery,
        skillAssessmentsQuery,
        employeesQuery,
      ]);

      const _trLabels = ['trainings', 'enrollments', 'skillAssessments', 'employees'];
      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Training fetch "${_trLabels[i]}" failed:`, r.reason);
      });

      const _v = (i) => (_results[i].status === 'fulfilled' ? _results[i].value : null) || { data: null, error: null };
      const trainingsResult = _v(0);
      const enrollmentsResult = _v(1);
      const skillAssessmentsResult = _v(2);
      const employeesResult = _v(3);

      [trainingsResult, enrollmentsResult, skillAssessmentsResult, employeesResult].forEach((res, i) => {
        if (res.error) console.error(`Training query "${_trLabels[i]}" error:`, res.error);
      });

      setTrainings(trainingsResult.data || []);
      setEnrollments(enrollmentsResult.data || []);
      setSkillAssessments(skillAssessmentsResult.data || []);
      setEmployees(employeesResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les formations');
      toast({
        title: 'Erreur Formation',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]);
  const createTraining = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        title: payload.title,
        description: payload.description || null,
        provider: payload.provider || null,
        provider_type: payload.provider_type || null,
        format: payload.format || null,
        duration_hours: Number(payload.duration_hours) || 0,
        cost_per_person: Number(payload.cost_per_person) || 0,
        currency: payload.currency || 'EUR',
        skills_covered: payload.skills_covered || [],
        is_mandatory: payload.is_mandatory || false,
        cpf_eligible: payload.cpf_eligible || false,
        opco_eligible: payload.opco_eligible || false,
        certification_name: payload.certification_name || null,
        passing_score: payload.passing_score != null ? Number(payload.passing_score) : null,
        validity_months: payload.validity_months != null ? Number(payload.validity_months) : null,
        tags: payload.tags || [],
        is_active: payload.is_active !== undefined ? payload.is_active : true,
      });

      const { data, error: insertError } = await supabase
        .from('hr_training_catalog')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );
  const updateTraining = useCallback(
    async (id, payload) => {
      if (!id || !supabase) return null;

      const updates = {};
      if (payload.title !== undefined) updates.title = payload.title;
      if (payload.description !== undefined) updates.description = payload.description;
      if (payload.provider !== undefined) updates.provider = payload.provider;
      if (payload.provider_type !== undefined) updates.provider_type = payload.provider_type;
      if (payload.format !== undefined) updates.format = payload.format;
      if (payload.duration_hours !== undefined) updates.duration_hours = Number(payload.duration_hours) || 0;
      if (payload.cost_per_person !== undefined) updates.cost_per_person = Number(payload.cost_per_person) || 0;
      if (payload.currency !== undefined) updates.currency = payload.currency;
      if (payload.skills_covered !== undefined) updates.skills_covered = payload.skills_covered;
      if (payload.is_mandatory !== undefined) updates.is_mandatory = payload.is_mandatory;
      if (payload.cpf_eligible !== undefined) updates.cpf_eligible = payload.cpf_eligible;
      if (payload.opco_eligible !== undefined) updates.opco_eligible = payload.opco_eligible;
      if (payload.certification_name !== undefined) updates.certification_name = payload.certification_name;
      if (payload.passing_score !== undefined)
        updates.passing_score = payload.passing_score != null ? Number(payload.passing_score) : null;
      if (payload.validity_months !== undefined)
        updates.validity_months = payload.validity_months != null ? Number(payload.validity_months) : null;
      if (payload.tags !== undefined) updates.tags = payload.tags;
      if (payload.is_active !== undefined) updates.is_active = payload.is_active;

      const { data, error: updateError } = await supabase
        .from('hr_training_catalog')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  );
  const enrollEmployee = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        training_id: payload.training_id,
        employee_id: payload.employee_id,
        training_plan_id: payload.training_plan_id || null,
        status: payload.status || 'registered',
        planned_start_date: payload.planned_start_date || null,
        planned_end_date: payload.planned_end_date || null,
      });

      const { data, error: insertError } = await supabase
        .from('hr_training_enrollments')
        .insert([row])
        .select(
          '*, hr_employees!employee_id(id, first_name, last_name, full_name), hr_training_catalog!training_id(id, title)'
        )
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );
  const updateEnrollment = useCallback(
    async (id, payload) => {
      if (!id || !supabase) return null;

      const updates = {};
      if (payload.status !== undefined) updates.status = payload.status;
      if (payload.planned_start_date !== undefined) updates.planned_start_date = payload.planned_start_date;
      if (payload.planned_end_date !== undefined) updates.planned_end_date = payload.planned_end_date;
      if (payload.actual_start_date !== undefined) updates.actual_start_date = payload.actual_start_date;
      if (payload.actual_end_date !== undefined) updates.actual_end_date = payload.actual_end_date;
      if (payload.score !== undefined) updates.score = Number(payload.score);
      if (payload.passed !== undefined) updates.passed = payload.passed;
      if (payload.certificate_url !== undefined) updates.certificate_url = payload.certificate_url;
      if (payload.certificate_expiry !== undefined) updates.certificate_expiry = payload.certificate_expiry;
      if (payload.actual_cost !== undefined) updates.actual_cost = Number(payload.actual_cost);
      if (payload.funded_by !== undefined) updates.funded_by = payload.funded_by;
      if (payload.cpf_hours_used !== undefined) updates.cpf_hours_used = Number(payload.cpf_hours_used);
      if (payload.rating_hot !== undefined) updates.rating_hot = Number(payload.rating_hot);
      if (payload.rating_cold !== undefined) updates.rating_cold = Number(payload.rating_cold);
      if (payload.feedback_comment !== undefined) updates.feedback_comment = payload.feedback_comment;

      const { data, error: updateError } = await supabase
        .from('hr_training_enrollments')
        .update(updates)
        .eq('id', id)
        .select(
          '*, hr_employees!employee_id(id, first_name, last_name, full_name), hr_training_catalog!training_id(id, title)'
        )
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  );
  const createSkillAssessment = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const currentLevel = Number(payload.current_level) || 0;
      const requiredLevel = Number(payload.required_level) || 0;
      const targetLevel = Number(payload.target_level) || 0;

      const row = withCompanyScope({
        employee_id: payload.employee_id,
        skill_name: payload.skill_name,
        skill_category: payload.skill_category || null,
        required_level: requiredLevel,
        current_level: currentLevel,
        target_level: targetLevel,
        gap: targetLevel - currentLevel,
        assessed_by: payload.assessed_by || null,
        assessment_method: payload.assessment_method || null,
        assessed_at: payload.assessed_at || new Date().toISOString(),
        next_assessment_date: payload.next_assessment_date || null,
        notes: payload.notes || null,
      });

      const { data, error: insertError } = await supabase
        .from('hr_skill_assessments')
        .insert([row])
        .select('*, hr_employees!employee_id(id, first_name, last_name, full_name)')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    activeCompanyId,
    loading,
    error,
    trainings,
    enrollments,
    skillAssessments,
    employees,
    fetchData,
    createTraining,
    updateTraining,
    enrollEmployee,
    updateEnrollment,
    createSkillAssessment,
  };
}
