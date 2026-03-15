import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export function useQVT() {
  const { user } = useAuth();
  const { toast } = useToast();
  // RLS policies handle access — no client-side company filter needed
  const { activeCompanyId, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [surveyResponses, setSurveyResponses] = useState([]);
  const [riskAssessments, setRiskAssessments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let surveysQuery = supabase.from('hr_surveys').select('*').order('created_at', { ascending: false });

      let surveyResponsesQuery = supabase
        .from('hr_survey_responses')
        .select('*, survey:hr_surveys!survey_id(id, title), respondent:hr_employees!respondent_id(id, full_name)')
        .order('submitted_at', { ascending: false });

      let riskAssessmentsQuery = supabase
        .from('hr_risk_assessments')
        .select('*, department:hr_departments(id, name), responsible:hr_employees(id, full_name)')
        .order('created_at', { ascending: false });

      let employeesQuery = supabase
        .from('hr_employees')
        .select('id, full_name, company_id')
        .order('full_name', { ascending: true });

      let departmentsQuery = supabase
        .from('hr_departments')
        .select('id, name, company_id')
        .order('name', { ascending: true });

      const [surveysResult, surveyResponsesResult, riskAssessmentsResult, employeesResult, departmentsResult] =
        await Promise.all([surveysQuery, surveyResponsesQuery, riskAssessmentsQuery, employeesQuery, departmentsQuery]);

      const firstError = [
        surveysResult.error,
        surveyResponsesResult.error,
        riskAssessmentsResult.error,
        employeesResult.error,
        departmentsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setSurveys(surveysResult.data || []);
      setSurveyResponses(surveyResponsesResult.data || []);
      setRiskAssessments(riskAssessmentsResult.data || []);
      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger le module QVT');
      toast({
        title: 'Erreur QVT',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);
  const createSurvey = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        title: payload.title,
        survey_type: payload.survey_type || 'engagement',
        status: payload.status || 'draft',
        questions: payload.questions || [],
        target_audience: payload.target_audience || null,
        anonymous: payload.anonymous ?? true,
        allow_partial: payload.allow_partial ?? false,
        response_count: 0,
        enps_score: null,
        avg_satisfaction: null,
        ai_analysis: null,
        starts_at: payload.starts_at || null,
        ends_at: payload.ends_at || null,
        reminder_at: payload.reminder_at || null,
        created_by: user.id,
      });

      const { data, error: insertError } = await supabase.from('hr_surveys').insert([row]).select('*').single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );
  const updateSurvey = useCallback(
    async (surveyId, updates) => {
      if (!surveyId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_surveys')
        .update(withCompanyScope(updates))
        .eq('id', surveyId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData, withCompanyScope]
  );
  const submitSurveyResponse = useCallback(
    async (surveyId, responseData) => {
      if (!surveyId || !supabase) return null;

      const row = withCompanyScope({
        survey_id: surveyId,
        respondent_id: responseData.respondent_id || null,
        responses: responseData.responses || responseData.answers || {},
        enps_score: responseData.enps_score ?? null,
        completion_time_secs: responseData.completion_time_secs ?? null,
        submitted_at: new Date().toISOString(),
      });

      const { data, error: insertError } = await supabase
        .from('hr_survey_responses')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, withCompanyScope]
  );
  const createRiskAssessment = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const probability = Number(payload.probability) || 1;
      const severity = Number(payload.severity) || 1;

      const row = withCompanyScope({
        assessment_type: payload.assessment_type || 'duerp',
        department_id: payload.department_id || null,
        risk_category: payload.risk_category || null,
        risk_subcategory: payload.risk_subcategory || null,
        risk_description: payload.risk_description || payload.title || null,
        situation: payload.situation || null,
        probability,
        severity,
        risk_score: probability * severity,
        risk_level: payload.risk_level || null,
        existing_controls: payload.existing_controls || null,
        prevention_measures: payload.prevention_measures || payload.action_plan || null,
        responsible_id: payload.responsible_id || payload.responsible_employee_id || null,
        target_date: payload.target_date || payload.due_date || null,
        completion_date: payload.completion_date || null,
        status: payload.status || 'identified',
        assessment_date: payload.assessment_date || new Date().toISOString(),
        next_review_date: payload.next_review_date || null,
      });

      const { data, error: insertError } = await supabase
        .from('hr_risk_assessments')
        .insert([row])
        .select('*, department:hr_departments(id, name), responsible:hr_employees(id, full_name)')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );
  const updateRiskAssessment = useCallback(
    async (assessmentId, updates) => {
      if (!assessmentId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_risk_assessments')
        .update(withCompanyScope(updates))
        .eq('id', assessmentId)
        .select('*, department:hr_departments(id, name), responsible:hr_employees(id, full_name)')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData, withCompanyScope]
  );
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    activeCompanyId,
    loading,
    error,
    surveys,
    surveyResponses,
    riskAssessments,
    employees,
    departments,
    fetchData,
    createSurvey,
    updateSurvey,
    submitSurveyResponse,
    createRiskAssessment,
    updateRiskAssessment,
  };
}
