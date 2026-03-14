import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const ACCOUNTING_SOURCE_TYPES = [
  'team_member_compensation',
  'team_member_compensation_reversal',
  'project_milestone',
  'project_milestone_reversal',
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeResourceOrigin = (value) => (value === 'external_supplier' ? 'external_supplier' : 'internal');

export function useHrMaterial() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [compensations, setCompensations] = useState([]);
  const [accountingEntries, setAccountingEntries] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let membersQuery = supabase
        .from('team_members')
        .select('id, name, email, role, joined_at, user_id')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      let suppliersQuery = supabase
        .from('suppliers')
        // Keep supplier query schema-tolerant across environments.
        .select('*')
        .order('company_name', { ascending: true });

      let projectsQuery = supabase
        .from('projects')
        .select('id, name, status, client_id, company_id')
        .order('name', { ascending: true });

      let tasksQuery = supabase
        .from('tasks')
        .select(`
          id,
          title,
          name,
          status,
          assigned_to,
          assigned_member_id,
          project_id,
          due_date,
          updated_at,
          project:projects(id, name),
          assigned_member:team_members(id, name, email, role)
        `)
        .order('updated_at', { ascending: false });

      let timesheetsQuery = supabase
        .from('timesheets')
        .select(`
          id,
          date,
          status,
          billable,
          duration_minutes,
          hourly_rate,
          project_id,
          task_id,
          executed_by_member_id,
          project:projects(id, name),
          task:tasks(id, title, name),
          executed_by_member:team_members(id, name, email, role)
        `)
        .order('date', { ascending: false });

      let allocationsQuery = supabase
        .from('project_resource_allocations')
        .select(`
          *,
          project:projects(id, name),
          team_member:team_members(id, name, email, role)
        `)
        .order('created_at', { ascending: false });

      let compensationsQuery = supabase
        .from('team_member_compensations')
        .select(`
          *,
          project:projects(id, name),
          team_member:team_members(id, name, email, role),
          task:tasks(id, title, name),
          timesheet:timesheets(id, date)
        `)
        .order('created_at', { ascending: false });

      let accountingEntriesQuery = supabase
        .from('accounting_entries')
        .select(`
          id,
          user_id,
          company_id,
          transaction_date,
          account_code,
          debit,
          credit,
          source_type,
          source_id,
          journal,
          entry_ref,
          description,
          created_at
        `)
        .eq('user_id', user.id)
        .in('source_type', ACCOUNTING_SOURCE_TYPES)
        .order('transaction_date', { ascending: false })
        .limit(200);

      const auditLogsQuery = supabase
        .from('accounting_audit_log')
        .select('id, user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details, created_at')
        .eq('user_id', user.id)
        .in('source_table', ['team_member_compensations', 'project_milestones', 'project_resource_allocations', 'timesheets', 'tasks'])
        .order('created_at', { ascending: false })
        .limit(200);

      // Keep company scope, but include legacy rows with null company_id so existing
      // historical project data remains visible during scope migrations.
      suppliersQuery = applyCompanyScope(suppliersQuery);
      projectsQuery = applyCompanyScope(projectsQuery);
      // Some production schemas still do not expose company_id on tasks/timesheets.
      // Keep these queries column-safe and enforce company scope after fetch via project links.
      allocationsQuery = applyCompanyScope(allocationsQuery);
      compensationsQuery = applyCompanyScope(compensationsQuery);
      accountingEntriesQuery = applyCompanyScope(accountingEntriesQuery);

      const [
        membersResult,
        suppliersResult,
        projectsResult,
        tasksResult,
        timesheetsResult,
        allocationsResult,
        compensationsResult,
        accountingEntriesResult,
        auditLogsResult,
      ] = await Promise.all([
        membersQuery,
        suppliersQuery,
        projectsQuery,
        tasksQuery,
        timesheetsQuery,
        allocationsQuery,
        compensationsQuery,
        accountingEntriesQuery,
        auditLogsQuery,
      ]);

      const firstError = [
        membersResult.error,
        suppliersResult.error,
        projectsResult.error,
        tasksResult.error,
        timesheetsResult.error,
        allocationsResult.error,
        compensationsResult.error,
        accountingEntriesResult.error,
        auditLogsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      let scopedAuditLogs = auditLogsResult.data || [];
      if (activeCompanyId) {
        scopedAuditLogs = scopedAuditLogs.filter((event) => {
          const detailCompanyId = event?.details?.company_id;
          return detailCompanyId === activeCompanyId;
        });
      }

      const membersData = membersResult.data || [];
      const rawTasksData = tasksResult.data || [];
      const rawTimesheetsData = timesheetsResult.data || [];
      const allocationsData = allocationsResult.data || [];
      const compensationsData = compensationsResult.data || [];
      const projectsData = projectsResult.data || [];
      const suppliersData = suppliersResult.data || [];
      const accountingEntriesData = accountingEntriesResult.data || [];
      const scopedProjectIds = new Set((projectsData || []).map((project) => project.id));

      const tasksData = activeCompanyId
        ? rawTasksData.filter((row) => row?.project_id && scopedProjectIds.has(row.project_id))
        : rawTasksData;

      const scopedTaskIds = new Set(tasksData.map((row) => row.id));
      const timesheetsData = activeCompanyId
        ? rawTimesheetsData.filter((row) => (
          (row?.project_id && scopedProjectIds.has(row.project_id))
          || (row?.task_id && scopedTaskIds.has(row.task_id))
        ))
        : rawTimesheetsData;

      let scopedMembers = membersData;
      if (activeCompanyId) {
        const memberIdsInScope = new Set();

        tasksData.forEach((row) => {
          if (row?.assigned_member_id) memberIdsInScope.add(row.assigned_member_id);
        });
        timesheetsData.forEach((row) => {
          if (row?.executed_by_member_id) memberIdsInScope.add(row.executed_by_member_id);
        });
        allocationsData.forEach((row) => {
          if (row?.team_member_id) memberIdsInScope.add(row.team_member_id);
        });
        compensationsData.forEach((row) => {
          if (row?.team_member_id) memberIdsInScope.add(row.team_member_id);
        });

        if (memberIdsInScope.size > 0) {
          scopedMembers = membersData.filter((member) => memberIdsInScope.has(member.id));
        }
      }

      setMembers(scopedMembers);
      setSuppliers(suppliersData);
      setProjects(projectsData);
      setTasks(tasksData);
      setTimesheets(timesheetsData);
      setAllocations(allocationsData);
      setCompensations(compensationsData);
      setAccountingEntries(accountingEntriesData);
      setAuditLogs(scopedAuditLogs);
    } catch (err) {
      setError(err.message || 'Impossible de charger le module RH & Matériel');
      toast({
        title: 'Erreur RH & Matériel',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, toast, user]);

  const createAllocation = useCallback(async (payload) => {
    if (!user || !supabase) return null;

    const normalizedType = payload.resource_type === 'material' ? 'material' : 'human';
    const normalizedOrigin = normalizeResourceOrigin(payload.resource_origin);
    const normalizedSupplierId = normalizedOrigin === 'external_supplier' ? (payload.supplier_id || null) : null;

    const row = withCompanyScope({
      user_id: user.id,
      project_id: payload.project_id,
      resource_type: normalizedType,
      resource_origin: normalizedOrigin,
      supplier_id: normalizedSupplierId,
      team_member_id:
        normalizedType === 'human' && normalizedOrigin === 'internal'
          ? (payload.team_member_id || null)
          : null,
      resource_name:
        normalizedType === 'material' || normalizedOrigin === 'external_supplier'
          ? String(payload.resource_name || '').trim()
          : null,
      unit: payload.unit || 'hour',
      planned_quantity: toNumber(payload.planned_quantity),
      actual_quantity: toNumber(payload.actual_quantity),
      planned_cost: toNumber(payload.planned_cost),
      actual_cost: toNumber(payload.actual_cost),
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      status: payload.status || 'planned',
      notes: payload.notes || null,
    });

    const { data, error: insertError } = await supabase
      .from('project_resource_allocations')
      .insert([row])
      .select('*')
      .single();

    if (insertError) throw insertError;
    await fetchData();
    return data;
  }, [fetchData, supabase, user, withCompanyScope]);

  const createCompensation = useCallback(async (payload) => {
    if (!user || !supabase) return null;

    const row = withCompanyScope({
      user_id: user.id,
      project_id: payload.project_id,
      team_member_id: payload.team_member_id,
      task_id: payload.task_id || null,
      timesheet_id: payload.timesheet_id || null,
      amount: toNumber(payload.amount),
      compensation_type: payload.compensation_type || 'hourly',
      payment_status: payload.payment_status || 'planned',
      planned_payment_date: payload.planned_payment_date || null,
      notes: payload.notes || null,
    });

    const { data, error: insertError } = await supabase
      .from('team_member_compensations')
      .insert([row])
      .select('*')
      .single();

    if (insertError) throw insertError;
    await fetchData();
    return data;
  }, [fetchData, supabase, user, withCompanyScope]);

  const updateCompensationStatus = useCallback(async (compensationId, nextStatus) => {
    if (!compensationId || !supabase) return null;

    const updates = {
      payment_status: nextStatus,
      paid_at: nextStatus === 'paid' ? new Date().toISOString() : null,
    };

    const { data, error: updateError } = await supabase
      .from('team_member_compensations')
      .update(withCompanyScope(updates))
      .eq('id', compensationId)
      .select('*')
      .single();

    if (updateError) throw updateError;
    await fetchData();
    return data;
  }, [fetchData, supabase, withCompanyScope]);

  const assignTaskMember = useCallback(async ({ taskId, memberId }) => {
    if (!taskId || !supabase) return null;

    const selectedMember = members.find((member) => member.id === memberId);

    const updates = {
      assigned_member_id: memberId || null,
      assigned_to: selectedMember?.name || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select('id, assigned_member_id, assigned_to, updated_at')
      .single();

    if (updateError) throw updateError;
    await fetchData();
    return data;
  }, [fetchData, members, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    activeCompanyId,
    loading,
    error,
    members,
    suppliers,
    projects,
    tasks,
    timesheets,
    allocations,
    compensations,
    accountingEntries,
    auditLogs,
    fetchData,
    createAllocation,
    createCompensation,
    updateCompensationStatus,
    assignTaskMember,
  };
}
