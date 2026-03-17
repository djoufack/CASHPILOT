import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * Hook responsible for HR employees, employee contracts,
 * and employee-to-team-member synchronisation.
 */
export function useHrMaterialEmployees() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeeContracts, setEmployeeContracts] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let employeesQuery = supabase.from('hr_employees').select('*').order('created_at', { ascending: false });

      let employeeContractsQuery = supabase
        .from('hr_employee_contracts')
        .select('*')
        .order('created_at', { ascending: false });

      employeesQuery = applyCompanyScope(employeesQuery);
      employeeContractsQuery = applyCompanyScope(employeeContractsQuery);

      const _results = await Promise.allSettled([employeesQuery, employeeContractsQuery]);

      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`HrMaterialEmployees fetch ${i} failed:`, r.reason);
      });

      const employeesResult = _results[0].status === 'fulfilled' ? _results[0].value : { data: null, error: null };
      const employeeContractsResult =
        _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };

      if (employeesResult.error) console.error('HrMaterialEmployees query error:', employeesResult.error);
      if (employeeContractsResult.error)
        console.error('HrMaterialEmployeeContracts query error:', employeeContractsResult.error);

      setEmployees(employeesResult.data || []);
      setEmployeeContracts(employeeContractsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les employes');
      toast({
        title: 'Erreur Employes',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]);

  const syncEmployeeToTeamMember = useCallback(
    async (employeeOrId) => {
      if (!user || !supabase) return null;

      const employeeId = typeof employeeOrId === 'string' ? employeeOrId : employeeOrId?.id;
      if (!employeeId) {
        throw new Error('employee_id requis pour la synchronisation equipe');
      }

      let employee = typeof employeeOrId === 'object' ? employeeOrId : null;
      if (!employee) {
        const employeeResult = await supabase
          .from('hr_employees')
          .select('*')
          .eq('id', employeeId)
          .limit(1)
          .maybeSingle();

        if (employeeResult.error) throw employeeResult.error;
        employee = employeeResult.data;
      }

      if (!employee) {
        throw new Error(`Employe introuvable (${employeeId})`);
      }

      const firstName = String(employee.first_name || '').trim();
      const lastName = String(employee.last_name || '').trim();
      const fullName = String(employee.full_name || `${firstName} ${lastName}`).trim();

      const teamMemberScope = withCompanyScope({
        user_id: user.id,
        name: fullName || employee.work_email || 'Employe',
        email: employee.work_email || null,
        role: employee.job_title || 'member',
        joined_at: employee.hire_date || null,
        employee_id: employee.id,
      });

      let existingMember = null;
      const byEmployeeResult = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('employee_id', employee.id)
        .limit(1)
        .maybeSingle();
      if (byEmployeeResult.error) throw byEmployeeResult.error;
      existingMember = byEmployeeResult.data || null;

      if (!existingMember && teamMemberScope.email) {
        const byEmailResult = await supabase
          .from('team_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('email', teamMemberScope.email)
          .limit(1)
          .maybeSingle();
        if (byEmailResult.error) throw byEmailResult.error;
        existingMember = byEmailResult.data || null;
      }

      if (existingMember?.id) {
        const { data: updatedMember, error: updateMemberError } = await supabase
          .from('team_members')
          .update({
            ...teamMemberScope,
            employee_id: employee.id,
          })
          .eq('id', existingMember.id)
          .select('*')
          .single();

        if (updateMemberError) throw updateMemberError;
        return updatedMember;
      }

      const { data: insertedMember, error: insertMemberError } = await supabase
        .from('team_members')
        .insert([teamMemberScope])
        .select('*')
        .single();

      if (insertMemberError) throw insertMemberError;
      return insertedMember;
    },
    [user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

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
        manager_employee_id: payload.manager_employee_id || null,
        cost_center_id: payload.cost_center_id || null,
        work_calendar_id: payload.work_calendar_id || null,
        job_title: payload.job_title || null,
      });

      const { data, error: insertError } = await supabase.from('hr_employees').insert([row]).select('*').single();

      if (insertError) throw insertError;

      let syncError = null;
      if (payload.sync_team_member !== false) {
        try {
          await syncEmployeeToTeamMember(data);
        } catch (err) {
          syncError = err;
        }
      }

      await fetchData();

      if (syncError) {
        toast({
          title: 'Employe cree avec avertissement',
          description: `La liaison vers team_members a echoue: ${syncError.message}`,
          variant: 'destructive',
        });
      }

      return data;
    },
    [fetchData, syncEmployeeToTeamMember, toast, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const createEmployeeContract = useCallback(
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
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const syncAllEmployeesToTeamMembers = useCallback(async () => {
    const currentEmployees = employees || [];
    for (const employee of currentEmployees) {
      await syncEmployeeToTeamMember(employee);
    }
    await fetchData();
  }, [employees, fetchData, syncEmployeeToTeamMember]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    employees,
    employeeContracts,
    fetchData,
    createEmployee,
    createEmployeeContract,
    syncEmployeeToTeamMember,
    syncAllEmployeesToTeamMembers,
  };
}
