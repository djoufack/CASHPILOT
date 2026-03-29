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

/**
 * Hook responsible for team members, tasks, timesheets,
 * compensations, accounting entries, audit logs,
 * and task-member assignment.
 *
 * It receives `projects` (fetched by the allocations sub-hook) so that
 * tasks and timesheets can be scoped to the active company via project links.
 * When used standalone the scoping is skipped gracefully.
 */
export function useHrMaterialCompensations({ projects: externalProjects } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
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
        .select('id, name, email, role, joined_at, user_id, company_id, employee_id')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      let tasksQuery = supabase
        .from('tasks')
        .select('id, title, name, status, assigned_to, assigned_member_id, project_id, due_date, updated_at')
        .order('updated_at', { ascending: false });

      let timesheetsQuery = supabase
        .from('timesheets')
        .select('id, date, status, billable, duration_minutes, hourly_rate, project_id, task_id, executed_by_member_id')
        .order('date', { ascending: false });

      let compensationsQuery = supabase
        .from('team_member_compensations')
        .select('*')
        .order('created_at', { ascending: false });

      let accountingEntriesQuery = supabase
        .from('accounting_entries')
        .select(
          `
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
        `
        )
        .eq('user_id', user.id)
        .in('source_type', ACCOUNTING_SOURCE_TYPES)
        .order('transaction_date', { ascending: false })
        .limit(200);

      const auditLogsQuery = supabase
        .from('accounting_audit_log')
        .select(
          'id, user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details, created_at'
        )
        .eq('user_id', user.id)
        .in('source_table', [
          'team_member_compensations',
          'project_milestones',
          'project_resource_allocations',
          'timesheets',
          'tasks',
        ])
        .order('created_at', { ascending: false })
        .limit(200);

      compensationsQuery = applyCompanyScope(compensationsQuery);
      accountingEntriesQuery = applyCompanyScope(accountingEntriesQuery);

      const _results = await Promise.allSettled([
        membersQuery,
        tasksQuery,
        timesheetsQuery,
        compensationsQuery,
        accountingEntriesQuery,
        auditLogsQuery,
      ]);

      const _compLabels = ['members', 'tasks', 'timesheets', 'compensations', 'accountingEntries', 'auditLogs'];
      _results.forEach((r, i) => {
        if (r.status === 'rejected')
          console.error(`HrMaterialCompensations fetch "${_compLabels[i]}" failed:`, r.reason);
      });

      const _v = (i) => (_results[i].status === 'fulfilled' ? _results[i].value : null) || { data: null, error: null };
      const membersResult = _v(0);
      const tasksResult = _v(1);
      const timesheetsResult = _v(2);
      const compensationsResult = _v(3);
      const accountingEntriesResult = _v(4);
      const auditLogsResult = _v(5);

      [
        membersResult,
        tasksResult,
        timesheetsResult,
        compensationsResult,
        accountingEntriesResult,
        auditLogsResult,
      ].forEach((res, i) => {
        if (res.error) console.error(`HrMaterialCompensations query "${_compLabels[i]}" error:`, res.error);
      });

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
      const compensationsData = compensationsResult.data || [];
      const accountingEntriesData = accountingEntriesResult.data || [];

      // Use projects passed from the allocations sub-hook (or empty array) to
      // scope tasks / timesheets to the active company via project links.
      const projectsData = externalProjects || [];
      const scopedProjectIds = new Set(projectsData.map((project) => project.id));

      const tasksData = activeCompanyId
        ? rawTasksData.filter((row) => row?.project_id && scopedProjectIds.has(row.project_id))
        : rawTasksData;

      const scopedTaskIds = new Set(tasksData.map((row) => row.id));
      const timesheetsData = activeCompanyId
        ? rawTimesheetsData.filter(
            (row) =>
              (row?.project_id && scopedProjectIds.has(row.project_id)) ||
              (row?.task_id && scopedTaskIds.has(row.task_id))
          )
        : rawTimesheetsData;

      // Scope members
      let scopedMembers = membersData;
      if (activeCompanyId) {
        const membersWithCompany = membersData.filter((member) => member?.company_id === activeCompanyId);
        if (membersWithCompany.length > 0) {
          scopedMembers = membersWithCompany;
        } else {
          const memberIdsInScope = new Set();

          tasksData.forEach((row) => {
            if (row?.assigned_member_id) memberIdsInScope.add(row.assigned_member_id);
          });
          timesheetsData.forEach((row) => {
            if (row?.executed_by_member_id) memberIdsInScope.add(row.executed_by_member_id);
          });
          compensationsData.forEach((row) => {
            if (row?.team_member_id) memberIdsInScope.add(row.team_member_id);
          });

          if (memberIdsInScope.size > 0) {
            scopedMembers = membersData.filter((member) => memberIdsInScope.has(member.id));
          }
        }
      }

      // Build lookup maps for normalization
      const projectById = new Map(projectsData.map((project) => [project.id, project]));
      const memberById = new Map(membersData.map((member) => [member.id, member]));
      const taskById = new Map(tasksData.map((task) => [task.id, task]));
      const timesheetById = new Map(timesheetsData.map((timesheet) => [timesheet.id, timesheet]));

      const normalizedCompensations = compensationsData.map((row) => ({
        ...row,
        project: row?.project || projectById.get(row.project_id) || null,
        team_member: row?.team_member || memberById.get(row.team_member_id) || null,
        task: row?.task || taskById.get(row.task_id) || null,
        timesheet: row?.timesheet || timesheetById.get(row.timesheet_id) || null,
      }));

      setMembers(scopedMembers);
      setTasks(tasksData);
      setTimesheets(timesheetsData);
      setCompensations(normalizedCompensations);
      setAccountingEntries(accountingEntriesData);
      setAuditLogs(scopedAuditLogs);
    } catch (err) {
      setError(err.message || 'Impossible de charger les compensations');
      toast({
        title: 'Erreur Compensations',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, externalProjects, toast, user]);

  const createCompensation = useCallback(
    async (payload) => {
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
    },
    [fetchData, user, withCompanyScope]
  );

  const updateCompensationStatus = useCallback(
    async (compensationId, nextStatus) => {
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
    },
    [fetchData, withCompanyScope]
  );

  const assignTaskMember = useCallback(
    async ({ taskId, memberId }) => {
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
    },
    [fetchData, members]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    members,
    tasks,
    timesheets,
    compensations,
    accountingEntries,
    auditLogs,
    fetchData,
    createCompensation,
    updateCompensationStatus,
    assignTaskMember,
  };
}
