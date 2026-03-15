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
  const [employeeSkills, setEmployeeSkills] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let trainingsQuery = supabase.from('hr_training_catalog').select('*').order('created_at', { ascending: false });

      let enrollmentsQuery = supabase
        .from('hr_training_enrollments')
        .select('*, hr_employees(id, first_name, last_name, full_name), hr_training_catalog(id, title, category)')
        .order('enrolled_at', { ascending: false });

      let skillAssessmentsQuery = supabase
        .from('hr_skill_assessments')
        .select(
          '*, hr_employees!hr_skill_assessments_employee_id_fkey(id, first_name, last_name, full_name), hr_training_catalog(id, title)'
        )
        .order('assessment_date', { ascending: false });

      let employeesQuery = supabase
        .from('hr_employees')
        .select('id, company_id, first_name, last_name, full_name, status, department_id')
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      let employeeSkillsQuery = supabase
        .from('hr_employee_skills')
        .select('*')
        .order('skill_name', { ascending: true });

      trainingsQuery = applyCompanyScope(trainingsQuery);
      enrollmentsQuery = applyCompanyScope(enrollmentsQuery);
      skillAssessmentsQuery = applyCompanyScope(skillAssessmentsQuery);
      employeesQuery = applyCompanyScope(employeesQuery);
      employeeSkillsQuery = applyCompanyScope(employeeSkillsQuery);

      const [trainingsResult, enrollmentsResult, skillAssessmentsResult, employeesResult, employeeSkillsResult] =
        await Promise.all([
          trainingsQuery,
          enrollmentsQuery,
          skillAssessmentsQuery,
          employeesQuery,
          employeeSkillsQuery,
        ]);

      const firstError = [
        trainingsResult.error,
        enrollmentsResult.error,
        skillAssessmentsResult.error,
        employeesResult.error,
        employeeSkillsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setTrainings(trainingsResult.data || []);
      setEnrollments(enrollmentsResult.data || []);
      setSkillAssessments(skillAssessmentsResult.data || []);
      setEmployees(employeesResult.data || []);
      setEmployeeSkills(employeeSkillsResult.data || []);
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
        category: payload.category || null,
        duration_hours: Number(payload.duration_hours) || 0,
        provider: payload.provider || null,
        cpf_eligible: payload.cpf_eligible || false,
        opco_eligible: payload.opco_eligible || false,
        cost_per_person: Number(payload.cost_per_person) || 0,
        currency: payload.currency || 'EUR',
        max_participants: payload.max_participants ? Number(payload.max_participants) : null,
        status: payload.status || 'active',
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
      if (payload.category !== undefined) updates.category = payload.category;
      if (payload.duration_hours !== undefined) updates.duration_hours = Number(payload.duration_hours) || 0;
      if (payload.provider !== undefined) updates.provider = payload.provider;
      if (payload.cpf_eligible !== undefined) updates.cpf_eligible = payload.cpf_eligible;
      if (payload.opco_eligible !== undefined) updates.opco_eligible = payload.opco_eligible;
      if (payload.cost_per_person !== undefined) updates.cost_per_person = Number(payload.cost_per_person) || 0;
      if (payload.currency !== undefined) updates.currency = payload.currency;
      if (payload.max_participants !== undefined)
        updates.max_participants = payload.max_participants ? Number(payload.max_participants) : null;
      if (payload.status !== undefined) updates.status = payload.status;

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
        status: payload.status || 'enrolled',
        enrolled_at: payload.enrolled_at || new Date().toISOString(),
      });

      const { data, error: insertError } = await supabase
        .from('hr_training_enrollments')
        .insert([row])
        .select('*, hr_employees(id, first_name, last_name, full_name), hr_training_catalog(id, title, category)')
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
      if (payload.completed_at !== undefined) updates.completed_at = payload.completed_at;
      if (payload.score !== undefined) updates.score = Number(payload.score);
      if (payload.certificate_url !== undefined) updates.certificate_url = payload.certificate_url;
      if (payload.feedback !== undefined) updates.feedback = payload.feedback;
      if (payload.rating !== undefined) updates.rating = Number(payload.rating);

      const { data, error: updateError } = await supabase
        .from('hr_training_enrollments')
        .update(updates)
        .eq('id', id)
        .select('*, hr_employees(id, first_name, last_name, full_name), hr_training_catalog(id, title, category)')
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
      const targetLevel = Number(payload.target_level) || 0;

      const row = withCompanyScope({
        employee_id: payload.employee_id,
        assessed_by: payload.assessed_by || user.id,
        assessment_date: payload.assessment_date || new Date().toISOString().split('T')[0],
        skill_name: payload.skill_name,
        current_level: currentLevel,
        target_level: targetLevel,
        gap: targetLevel - currentLevel,
        recommended_training_id: payload.recommended_training_id || null,
        notes: payload.notes || null,
      });

      const { data, error: insertError } = await supabase
        .from('hr_skill_assessments')
        .insert([row])
        .select(
          '*, hr_employees!hr_skill_assessments_employee_id_fkey(id, first_name, last_name, full_name), hr_training_catalog(id, title)'
        )
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
    employeeSkills,
    fetchData,
    createTraining,
    updateTraining,
    enrollEmployee,
    updateEnrollment,
    createSkillAssessment,
  };
}
