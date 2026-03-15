import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export function useAbsences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { withCompanyScope } = useCompanyScope();

  // --- Leave requests (with employee join) ---
  // RLS policies handle access — no client-side company filter needed
  const {
    data: leaveRequests,
    setData: setLeaveRequests,
    loading: loadingRequests,
    error: errorRequests,
    refetch: refetchRequests,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .select(
          `
          *,
          employee:hr_employees!employee_id(id, first_name, last_name, full_name, status),
          leave_type:hr_leave_types!leave_type_id(id, name, leave_code, is_paid, default_annual_entitlement)
        `
        )
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS error fetching leave requests:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user], defaultData: [], enabled: !!user }
  );

  // --- Leave types ---
  // RLS policies handle access — no client-side company filter needed
  const {
    data: leaveTypes,
    loading: loadingTypes,
    refetch: refetchTypes,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      const { data, error } = await supabase.from('hr_leave_types').select('*').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    { deps: [user], defaultData: [], enabled: !!user }
  );

  // --- Active employees ---
  // RLS policies handle access — no client-side company filter needed
  const { data: employees, loading: loadingEmployees } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      const { data, error } = await supabase
        .from('hr_employees')
        .select('id, first_name, last_name, full_name, status')
        .eq('status', 'active')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    { deps: [user], defaultData: [], enabled: !!user }
  );

  // --- Work calendars ---
  // RLS policies handle access — no client-side company filter needed
  const { data: workCalendars } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      const { data, error } = await supabase.from('hr_work_calendars').select('*').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    { deps: [user], defaultData: [], enabled: !!user }
  );

  // --- CRUD operations ---

  const createLeaveRequest = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;
      const row = withCompanyScope({
        employee_id: payload.employee_id,
        leave_type_id: payload.leave_type_id,
        start_date: payload.start_date,
        end_date: payload.end_date,
        total_days: Number(payload.total_days || payload.days_count || 0),
        status: 'pending',
        reason: payload.reason || null,
      });

      const { data, error } = await supabase
        .from('hr_leave_requests')
        .insert([row])
        .select(
          `
        *,
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status),
        leave_type:hr_leave_types!leave_type_id(id, name, leave_code, is_paid, default_annual_entitlement)
`
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => [data, ...prev]);
      toast({ title: 'Demande creee', description: 'La demande de conge a ete enregistree.' });
      return data;
    },
    [setLeaveRequests, toast, user, withCompanyScope]
  );
  const updateLeaveRequest = useCallback(
    async (id, payload) => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .update(withCompanyScope(payload))
        .eq('id', id)
        .select(
          `
        *,
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status),
        leave_type:hr_leave_types!leave_type_id(id, name, leave_code, is_paid, default_annual_entitlement)
`
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande mise a jour' });
      return data;
    },
    [setLeaveRequests, toast, withCompanyScope]
  );
  const approveLeaveRequest = useCallback(
    async (id) => {
      if (!user || !supabase) return null;
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .update(
          withCompanyScope({
            status: 'approved',
          })
        )
        .eq('id', id)
        .select(
          `
        *,
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status),
        leave_type:hr_leave_types!leave_type_id(id, name, leave_code, is_paid, default_annual_entitlement)
`
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande approuvee', description: 'Le conge a ete approuve.' });
      return data;
    },
    [setLeaveRequests, toast, user, withCompanyScope]
  );
  const rejectLeaveRequest = useCallback(
    async (id) => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .update(withCompanyScope({ status: 'rejected' }))
        .eq('id', id)
        .select(
          `
        *,
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status),
        leave_type:hr_leave_types!leave_type_id(id, name, leave_code, is_paid, default_annual_entitlement)
`
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande rejetee', description: 'Le conge a ete refuse.' });
      return data;
    },
    [setLeaveRequests, toast, withCompanyScope]
  );
  const cancelLeaveRequest = useCallback(
    async (id) => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .update(withCompanyScope({ status: 'cancelled' }))
        .eq('id', id)
        .select(
          `
        *,
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status),
        leave_type:hr_leave_types!leave_type_id(id, name, leave_code, is_paid, default_annual_entitlement)
`
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande annulee' });
      return data;
    },
    [setLeaveRequests, toast, withCompanyScope]
  );
  // --- Leave balances from SQL function (replaces client-side computation) ---
  const {
    data: leaveBalances,
    loading: loadingBalances,
    refetch: refetchBalances,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      const { data, error } = await supabase.rpc('fn_hr_leave_balance', {
        p_year: new Date().getFullYear(),
      });
      if (error) {
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS error fetching leave balances:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user], defaultData: [], enabled: !!user }
  );

  const loading = loadingRequests || loadingTypes || loadingEmployees || loadingBalances;

  const refetch = useCallback(async () => {
    await Promise.all([refetchRequests(), refetchTypes(), refetchBalances()]);
  }, [refetchRequests, refetchTypes, refetchBalances]);

  return {
    leaveRequests,
    leaveTypes,
    employees,
    workCalendars,
    leaveBalances,
    loading,
    error: errorRequests,
    refetch,
    createLeaveRequest,
    updateLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
  };
}
