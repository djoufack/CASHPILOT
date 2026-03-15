import { useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export function useAbsences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  // --- Leave requests (with employee join) ---
  const {
    data: leaveRequests,
    setData: setLeaveRequests,
    loading: loadingRequests,
    error: errorRequests,
    refetch: refetchRequests,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('hr_leave_requests')
        .select(
          `
          *,
          employee:hr_employees!employee_id(id, first_name, last_name, full_name, status)
        `
        )
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) {
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS error fetching leave requests:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user } // eslint-disable-line react-hooks/exhaustive-deps
  );

  // --- Leave types ---
  const {
    data: leaveTypes,
    loading: loadingTypes,
    refetch: refetchTypes,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase.from('hr_leave_types').select('*').order('name', { ascending: true });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user } // eslint-disable-line react-hooks/exhaustive-deps
  );

  // --- Active employees ---
  const { data: employees, loading: loadingEmployees } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('hr_employees')
        .select('id, first_name, last_name, full_name, status')
        .eq('status', 'active')
        .order('full_name', { ascending: true });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user } // eslint-disable-line react-hooks/exhaustive-deps
  );

  // --- Work calendars ---
  const { data: workCalendars } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase.from('hr_work_calendars').select('*').order('name', { ascending: true });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user } // eslint-disable-line react-hooks/exhaustive-deps
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
        days_count: Number(payload.days_count || 0),
        status: 'pending',
        reason: payload.reason || null,
      });

      const { data, error } = await supabase
        .from('hr_leave_requests')
        .insert([row])
        .select(
          `
        *,
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status)
      `
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => [data, ...prev]);
      toast({ title: 'Demande creee', description: 'La demande de conge a ete enregistree.' });
      return data;
    },
    [setLeaveRequests, toast, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

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
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status)
      `
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande mise a jour' });
      return data;
    },
    [setLeaveRequests, toast, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const approveLeaveRequest = useCallback(
    async (id) => {
      if (!user || !supabase) return null;
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .update(
          withCompanyScope({
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          })
        )
        .eq('id', id)
        .select(
          `
        *,
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status)
      `
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande approuvee', description: 'Le conge a ete approuve.' });
      return data;
    },
    [setLeaveRequests, toast, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

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
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status)
      `
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande rejetee', description: 'Le conge a ete refuse.' });
      return data;
    },
    [setLeaveRequests, toast, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

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
        employee:hr_employees!employee_id(id, first_name, last_name, full_name, status)
      `
        )
        .single();

      if (error) throw error;
      setLeaveRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      toast({ title: 'Demande annulee' });
      return data;
    },
    [setLeaveRequests, toast, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Balance computation ---

  const computeBalance = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const balanceMap = {};

    employees.forEach((emp) => {
      balanceMap[emp.id] = {};
      leaveTypes.forEach((lt) => {
        balanceMap[emp.id][lt.id] = {
          employee: emp,
          leaveType: lt,
          entitled: lt.default_days_per_year || 0,
          used: 0,
          remaining: lt.default_days_per_year || 0,
        };
      });
    });

    leaveRequests.forEach((req) => {
      if (req.status !== 'approved' && req.status !== 'pending') return;
      const reqYear = new Date(req.start_date).getFullYear();
      if (reqYear !== currentYear) return;
      const empBalance = balanceMap[req.employee_id];
      if (!empBalance) return;
      const typeBalance = empBalance[req.leave_type_id];
      if (!typeBalance) return;
      if (req.status === 'approved') {
        typeBalance.used += req.days_count || 0;
        typeBalance.remaining = typeBalance.entitled - typeBalance.used;
      }
    });

    return balanceMap;
  }, [employees, leaveTypes, leaveRequests]);

  const loading = loadingRequests || loadingTypes || loadingEmployees;

  const refetch = useCallback(async () => {
    await Promise.all([refetchRequests(), refetchTypes()]);
  }, [refetchRequests, refetchTypes]);

  return {
    leaveRequests,
    leaveTypes,
    employees,
    workCalendars,
    loading,
    error: errorRequests,
    computeBalance,
    refetch,
    createLeaveRequest,
    updateLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
  };
}
