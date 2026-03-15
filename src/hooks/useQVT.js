import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export function useQVT() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [riskAssessments, setRiskAssessments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let surveysQuery = supabase.from('hr_surveys').select('*').order('created_at', { ascending: false });

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

      surveysQuery = applyCompanyScope(surveysQuery);
      riskAssessmentsQuery = applyCompanyScope(riskAssessmentsQuery);
      employeesQuery = applyCompanyScope(employeesQuery);
      departmentsQuery = applyCompanyScope(departmentsQuery);

      const [surveysResult, riskAssessmentsResult, employeesResult, departmentsResult] = await Promise.all([
        surveysQuery,
        riskAssessmentsQuery,
        employeesQuery,
        departmentsQuery,
      ]);

      const firstError = [
        surveysResult.error,
        riskAssessmentsResult.error,
        employeesResult.error,
        departmentsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setSurveys(surveysResult.data || []);
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
  }, [applyCompanyScope, toast, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const createSurvey = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        title: payload.title,
        survey_type: payload.survey_type || 'engagement',
        status: payload.status || 'draft',
        questions: payload.questions || [],
        responses: payload.responses || [],
        response_count: 0,
        enps_score: null,
        ai_analysis: null,
        starts_at: payload.starts_at || null,
        ends_at: payload.ends_at || null,
      });

      const { data, error: insertError } = await supabase.from('hr_surveys').insert([row]).select('*').single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

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
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const submitSurveyResponse = useCallback(
    async (surveyId, responseData) => {
      if (!surveyId || !supabase) return null;

      const survey = surveys.find((s) => s.id === surveyId);
      if (!survey) throw new Error('Enquete introuvable');

      const currentResponses = Array.isArray(survey.responses) ? survey.responses : [];
      const updatedResponses = [...currentResponses, { ...responseData, submitted_at: new Date().toISOString() }];

      const { data, error: updateError } = await supabase
        .from('hr_surveys')
        .update({
          responses: updatedResponses,
          response_count: updatedResponses.length,
        })
        .eq('id', surveyId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData, surveys]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const createRiskAssessment = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        title: payload.title,
        assessment_type: payload.assessment_type || 'duerp',
        department_id: payload.department_id || null,
        risk_category: payload.risk_category || null,
        probability: Number(payload.probability) || 1,
        severity: Number(payload.severity) || 1,
        existing_controls: payload.existing_controls || null,
        action_plan: payload.action_plan || null,
        responsible_employee_id: payload.responsible_employee_id || null,
        due_date: payload.due_date || null,
        status: payload.status || 'identified',
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
  ); // eslint-disable-line react-hooks/exhaustive-deps

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
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    activeCompanyId,
    loading,
    error,
    surveys,
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
