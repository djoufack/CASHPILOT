import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';

export function useEmployeePortal() {
  const { user } = useAuth();
  const { activeCompanyId, withCompanyScope } = useCompanyScope();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Portal access state
  const [portalAccess, setPortalAccess] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);

  // Dashboard data from RPC
  const [dashboard, setDashboard] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [expenseReports, setExpenseReports] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [employeeInfo, setEmployeeInfo] = useState(null);

  // Resolve portal access for the current user
  const resolvePortalAccess = useCallback(async () => {
    if (!user || !supabase || !activeCompanyId) return null;

    const { data, error: accessError } = await supabase
      .from('employee_portal_access')
      .select('id, employee_id, access_level, is_active')
      .eq('user_id', user.id)
      .eq('company_id', activeCompanyId)
      .eq('is_active', true)
      .maybeSingle();

    if (accessError) {
      console.error('Portal access error:', accessError);
      return null;
    }

    return data;
  }, [user, activeCompanyId]);

  // Fetch the dashboard via RPC
  const fetchDashboard = useCallback(
    async (empId) => {
      if (!supabase || !empId) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_employee_dashboard', { p_employee_id: empId });

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        if (data?.error === 'access_denied') {
          throw new Error('Access denied to employee dashboard');
        }

        setDashboard(data);
        setEmployeeInfo(data?.employee || null);
        setLeaveBalance(data?.leave_balance || []);
        setPayslips(data?.payslips || []);
        setExpenseReports(data?.expense_reports || []);
        setUpcomingEvents(data?.upcoming_events || []);

        // Fetch leave requests (individual records) for the employee
        if (empId && activeCompanyId) {
          const { data: leaveData } = await supabase
            .from('hr_leave_requests')
            .select(
              'id, leave_type_id, start_date, end_date, total_days, status, reason, created_at, hr_leave_types(name)'
            )
            .eq('employee_id', empId)
            .eq('company_id', activeCompanyId)
            .order('created_at', { ascending: false })
            .limit(50);

          setLeaveRequests(leaveData || []);
        }

        // Fetch contracts for the employee
        if (empId && activeCompanyId) {
          const { data: contractData } = await supabase
            .from('hr_employee_contracts')
            .select(
              'id, contract_type, job_title, department_id, monthly_salary, currency, start_date, end_date, status, hr_departments(name)'
            )
            .eq('employee_id', empId)
            .eq('company_id', activeCompanyId)
            .order('start_date', { ascending: false });

          setContracts(contractData || []);
        }
      } catch (err) {
        setError(err.message);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: err.message,
        });
      } finally {
        setLoading(false);
      }
    },
    [toast, activeCompanyId]
  );

  // Initialize: resolve access then fetch dashboard
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const access = await resolvePortalAccess();
      if (cancelled) return;

      setPortalAccess(access);
      if (access?.employee_id) {
        setEmployeeId(access.employee_id);
        await fetchDashboard(access.employee_id);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [resolvePortalAccess, fetchDashboard]);

  // Submit a leave request
  const submitLeaveRequest = useCallback(
    async ({ leaveTypeId, startDate, endDate, totalDays, reason }) => {
      if (!user || !supabase || !activeCompanyId || !employeeId) {
        throw new Error('Missing portal context');
      }

      const { data, error: insertError } = await supabase
        .from('hr_leave_requests')
        .insert({
          company_id: activeCompanyId,
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          status: 'submitted',
          reason: reason || null,
        })
        .select()
        .single();

      if (insertError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: insertError.message,
        });
        throw insertError;
      }

      toast({
        title: 'Demande envoyee',
        description: 'Votre demande de conge a ete soumise.',
      });

      // Refresh dashboard
      await fetchDashboard(employeeId);
      return data;
    },
    [user, activeCompanyId, employeeId, fetchDashboard, toast]
  );

  // Submit an expense report
  const submitExpenseReport = useCallback(
    async ({ title, items, notes, currency }) => {
      if (!user || !supabase || !activeCompanyId || !employeeId) {
        throw new Error('Missing portal context');
      }

      // 1. Create the report
      const { data: report, error: reportError } = await supabase
        .from('expense_reports')
        .insert(
          withCompanyScope({
            user_id: user.id,
            employee_id: employeeId,
            title,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            notes: notes || null,
            currency: currency || 'EUR',
          })
        )
        .select()
        .single();

      if (reportError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: reportError.message,
        });
        throw reportError;
      }

      // 2. Insert line items
      if (items && items.length > 0) {
        const lineItems = items.map((item) => ({
          report_id: report.id,
          description: item.description,
          amount: item.amount,
          category: item.category || null,
          date: item.date || null,
          receipt_url: item.receiptUrl || null,
        }));

        const { error: itemsError } = await supabase.from('expense_report_items').insert(lineItems);

        if (itemsError) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: itemsError.message,
          });
          throw itemsError;
        }
      }

      toast({
        title: 'Note de frais soumise',
        description: `"${title}" a ete soumise avec succes.`,
      });

      // Refresh dashboard
      await fetchDashboard(employeeId);
      return report;
    },
    [user, activeCompanyId, employeeId, withCompanyScope, fetchDashboard, toast]
  );

  // Refresh dashboard
  const refresh = useCallback(() => {
    if (employeeId) {
      return fetchDashboard(employeeId);
    }
  }, [employeeId, fetchDashboard]);

  return {
    loading,
    error,
    portalAccess,
    employeeId,
    employeeInfo,
    dashboard,
    leaveBalance,
    leaveRequests,
    payslips,
    contracts,
    expenseReports,
    upcomingEvents,
    submitLeaveRequest,
    createLeaveRequest: submitLeaveRequest,
    submitExpenseReport,
    createExpenseReport: submitExpenseReport,
    fetchDashboard: refresh,
    refresh,
  };
}
