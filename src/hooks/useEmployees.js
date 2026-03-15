import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function useEmployees() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [skills, setSkills] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let employeesQuery = supabase.from('hr_employees').select('*').order('created_at', { ascending: false });

      let departmentsQuery = supabase.from('hr_departments').select('*').order('name', { ascending: true });

      let contractsQuery = supabase.from('hr_employee_contracts').select('*').order('created_at', { ascending: false });

      let skillsQuery = supabase.from('hr_employee_skills').select('*').order('created_at', { ascending: false });

      employeesQuery = applyCompanyScope(employeesQuery);
      departmentsQuery = applyCompanyScope(departmentsQuery);
      contractsQuery = applyCompanyScope(contractsQuery);
      skillsQuery = applyCompanyScope(skillsQuery);

      const [employeesResult, departmentsResult, contractsResult, skillsResult] = await Promise.all([
        employeesQuery,
        departmentsQuery,
        contractsQuery,
        skillsQuery,
      ]);

      const firstError = [
        employeesResult.error,
        departmentsResult.error,
        contractsResult.error,
        skillsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
      setContracts(contractsResult.data || []);
      setSkills(skillsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les employÃ©s');
      toast({
        title: 'Erreur EmployÃ©s',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const createEmployee = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const firstName = String(payload.first_name || '').trim();
      const lastName = String(payload.last_name || '').trim();
      const fullName = String(payload.full_name || `${firstName} ${lastName}`).trim();

      const row = withCompanyScope({
        employee_number: payload.employee_number || null,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName || null,
        work_email: payload.work_email || null,
        phone: payload.phone || null,
        status: payload.status || 'active',
        hire_date: payload.hire_date || null,
        termination_date: payload.termination_date || null,
        department_id: payload.department_id || null,
        cost_center_id: payload.cost_center_id || null,
        job_title: payload.job_title || null,
      });

      const { data, error: insertError } = await supabase.from('hr_employees').insert([row]).select('*').single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );

  const updateEmployee = useCallback(
    async (id, payload) => {
      if (!id || !supabase) return null;

      const updates = { ...payload };
      if (updates.first_name !== undefined || updates.last_name !== undefined) {
        const firstName = String(updates.first_name || '').trim();
        const lastName = String(updates.last_name || '').trim();
        updates.full_name = `${firstName} ${lastName}`.trim() || null;
      }

      const { data, error: updateError } = await supabase
        .from('hr_employees')
        .update(withCompanyScope(updates))
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData, withCompanyScope]
  );

  const deleteEmployee = useCallback(
    async (id) => {
      if (!id || !supabase) return null;

      const { error: deleteError } = await supabase.from('hr_employees').delete().eq('id', id);

      if (deleteError) throw deleteError;
      await fetchData();
    },
    [fetchData]
  );

  const createContract = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        employee_id: payload.employee_id,
        contract_type: payload.contract_type || 'cdi',
        status: payload.status || 'active',
        start_date: payload.start_date,
        end_date: payload.end_date || null,
        pay_basis: payload.pay_basis || 'hourly',
        hourly_rate: toNumber(payload.hourly_rate),
        monthly_salary: toNumber(payload.monthly_salary),
      });

      const { data, error: insertError } = await supabase
        .from('hr_employee_contracts')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );

  const updateContract = useCallback(
    async (id, payload) => {
      if (!id || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_employee_contracts')
        .update(withCompanyScope(payload))
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData, withCompanyScope]
  );

  const createSkill = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        employee_id: payload.employee_id,
        skill_name: payload.skill_name,
        skill_level: payload.skill_level || null,
        certified: payload.certified || false,
      });

      const { data, error: insertError } = await supabase.from('hr_employee_skills').insert([row]).select('*').single();

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
    loading,
    error,
    employees,
    departments,
    contracts,
    skills,
    fetchData,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    createContract,
    updateContract,
    createSkill,
  };
}
