import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export const useRecruitment = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  // --- Job Positions ---
  const {
    data: positions,
    setData: setPositions,
    loading: positionsLoading,
    refetch: refetchPositions,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase.from('hr_job_positions').select('*').order('created_at', { ascending: false });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // --- Candidates ---
  const {
    data: candidates,
    setData: setCandidates,
    loading: candidatesLoading,
    refetch: refetchCandidates,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase.from('hr_candidates').select('*').order('created_at', { ascending: false });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // --- Applications (with joins) ---
  const {
    data: applications,
    setData: setApplications,
    loading: applicationsLoading,
    refetch: refetchApplications,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('hr_applications')
        .select(
          `
          *,
          candidate:hr_candidates(*),
          position:hr_job_positions(*)
        `
        )
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // --- Interview Sessions ---
  const {
    data: interviews,
    setData: setInterviews,
    loading: interviewsLoading,
    refetch: refetchInterviews,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('hr_interview_sessions')
        .select(
          `
          *,
          application:hr_applications(
            *,
            candidate:hr_candidates(*),
            position:hr_job_positions(*)
          ),
          interviewer:hr_employees(*)
        `
        )
        .order('scheduled_at', { ascending: false });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // --- Onboarding Plans ---
  const {
    data: onboardingPlans,
    setData: setOnboardingPlans,
    loading: onboardingLoading,
    refetch: refetchOnboarding,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('hr_onboarding_plans')
        .select(
          `
          *,
          employee:hr_employees!hr_onboarding_plans_employee_id_fkey(*),
          mentor:hr_employees!hr_onboarding_plans_mentor_employee_id_fkey(*)
        `
        )
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // --- Employees (for dropdowns) ---
  const { data: employees, loading: employeesLoading } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('hr_employees')
        .select('id, first_name, last_name, full_name, work_email, job_title, status')
        .eq('status', 'active')
        .order('last_name', { ascending: true });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // --- CRUD Operations ---

  const createPosition = useCallback(
    async (positionData) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('hr_job_positions')
        .insert([withCompanyScope(positionData)])
        .select()
        .single();
      if (error) throw error;
      setPositions((prev) => [data, ...prev]);
      toast({ title: 'Poste cree', description: data.title });
      return data;
    },
    [withCompanyScope, toast, setPositions]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePosition = useCallback(
    async (id, positionData) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('hr_job_positions')
        .update(withCompanyScope(positionData))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setPositions((prev) => prev.map((p) => (p.id === id ? data : p)));
      toast({ title: 'Poste mis a jour' });
      return data;
    },
    [withCompanyScope, toast, setPositions]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const createCandidate = useCallback(
    async (candidateData) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('hr_candidates')
        .insert([withCompanyScope(candidateData)])
        .select()
        .single();
      if (error) throw error;
      setCandidates((prev) => [data, ...prev]);
      toast({ title: 'Candidat ajoute', description: `${data.first_name} ${data.last_name}` });
      return data;
    },
    [withCompanyScope, toast, setCandidates]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const createApplication = useCallback(
    async (applicationData) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('hr_applications')
        .insert([withCompanyScope({ ...applicationData, status: applicationData.status || 'new' })])
        .select(
          `
        *,
        candidate:hr_candidates(*),
        position:hr_job_positions(*)
      `
        )
        .single();
      if (error) throw error;
      setApplications((prev) => [data, ...prev]);
      toast({ title: 'Candidature creee' });
      return data;
    },
    [withCompanyScope, toast, setApplications]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const moveApplication = useCallback(
    async (id, newStatus) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('hr_applications')
        .update(withCompanyScope({ status: newStatus, stage_changed_at: new Date().toISOString() }))
        .eq('id', id)
        .select(
          `
        *,
        candidate:hr_candidates(*),
        position:hr_job_positions(*)
      `
        )
        .single();
      if (error) throw error;
      setApplications((prev) => prev.map((a) => (a.id === id ? data : a)));
      toast({ title: 'Candidature deplacee', description: newStatus });
      return data;
    },
    [withCompanyScope, toast, setApplications]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleInterview = useCallback(
    async (interviewData) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('hr_interview_sessions')
        .insert([withCompanyScope({ ...interviewData, status: interviewData.status || 'scheduled' })])
        .select(
          `
        *,
        application:hr_applications(
          *,
          candidate:hr_candidates(*),
          position:hr_job_positions(*)
        ),
        interviewer:hr_employees(*)
      `
        )
        .single();
      if (error) throw error;
      setInterviews((prev) => [data, ...prev]);
      toast({ title: 'Entretien planifie' });
      return data;
    },
    [withCompanyScope, toast, setInterviews]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const createOnboardingPlan = useCallback(
    async (planData) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('hr_onboarding_plans')
        .insert([withCompanyScope({ ...planData, status: planData.status || 'active', progress_pct: 0 })])
        .select(
          `
        *,
        employee:hr_employees!hr_onboarding_plans_employee_id_fkey(*),
        mentor:hr_employees!hr_onboarding_plans_mentor_employee_id_fkey(*)
      `
        )
        .single();
      if (error) throw error;
      setOnboardingPlans((prev) => [data, ...prev]);
      toast({ title: "Plan d'onboarding cree" });
      return data;
    },
    [withCompanyScope, toast, setOnboardingPlans]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const updateOnboardingTask = useCallback(
    async (planId, taskIndex, completed) => {
      if (!supabase) throw new Error('Supabase not configured');
      const plan = onboardingPlans.find((p) => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      const tasks = Array.isArray(plan.tasks) ? [...plan.tasks] : [];
      if (taskIndex < 0 || taskIndex >= tasks.length) throw new Error('Invalid task index');

      tasks[taskIndex] = { ...tasks[taskIndex], completed };
      const completedCount = tasks.filter((t) => t.completed).length;
      const progress_pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
      const status = progress_pct === 100 ? 'completed' : 'active';

      const { data, error } = await supabase
        .from('hr_onboarding_plans')
        .update(withCompanyScope({ tasks, progress_pct, status }))
        .eq('id', planId)
        .select(
          `
        *,
        employee:hr_employees!hr_onboarding_plans_employee_id_fkey(*),
        mentor:hr_employees!hr_onboarding_plans_mentor_employee_id_fkey(*)
      `
        )
        .single();
      if (error) throw error;
      setOnboardingPlans((prev) => prev.map((p) => (p.id === planId ? data : p)));
      toast({ title: 'Tache mise a jour' });
      return data;
    },
    [withCompanyScope, toast, onboardingPlans, setOnboardingPlans]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const loading =
    positionsLoading ||
    candidatesLoading ||
    applicationsLoading ||
    interviewsLoading ||
    onboardingLoading ||
    employeesLoading;

  return {
    // Data
    positions,
    candidates,
    applications,
    interviews,
    onboardingPlans,
    employees,
    loading,

    // CRUD
    createPosition,
    updatePosition,
    createCandidate,
    createApplication,
    moveApplication,
    scheduleInterview,
    createOnboardingPlan,
    updateOnboardingTask,

    // Refetch
    refetchPositions,
    refetchCandidates,
    refetchApplications,
    refetchInterviews,
    refetchOnboarding,
  };
};
