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

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      const EMPLOYEES_SELECT = `
        *,
        department:hr_departments!department_id(id, name, description),
        manager:hr_employees!manager_employee_id(id, full_name, job_title),
        contracts:hr_employee_contracts(id, contract_type, status, start_date, end_date, pay_basis, hourly_rate, monthly_salary),
        skills:hr_employee_skills(id, skill_name, skill_level)
      `;

      let employeesQuery = supabase
        .from('hr_employees')
        .select(EMPLOYEES_SELECT)
        .order('created_at', { ascending: false });

      // Lightweight departments query for filter dropdown only
      let departmentsQuery = supabase.from('hr_departments').select('id, name').order('name');

      // Apply company scope to filter by active company
      employeesQuery = applyCompanyScope(employeesQuery);
      departmentsQuery = applyCompanyScope(departmentsQuery);

      const _results = await Promise.allSettled([employeesQuery, departmentsQuery]);

      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Employees fetch ${i} failed:`, r.reason);
      });

      const employeesResult = _results[0].status === 'fulfilled' ? _results[0].value : { data: null, error: null };
      const departmentsResult = _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };

      if (employeesResult.error) console.error('Employees query error:', employeesResult.error);
      if (departmentsResult.error) console.error('Departments query error:', departmentsResult.error);

      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les employés');
      toast({
        title: 'Erreur Employés',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]);
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
    fetchData,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    createContract,
    updateContract,
    createSkill,
  };
}
