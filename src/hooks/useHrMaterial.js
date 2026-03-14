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
  const [employees, setEmployees] = useState([]);
  const [employeeContracts, setEmployeeContracts] = useState([]);
  const [materialCategories, setMaterialCategories] = useState([]);
  const [materialAssets, setMaterialAssets] = useState([]);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [payrollVariableItems, setPayrollVariableItems] = useState([]);
  const [payrollAnomalies, setPayrollAnomalies] = useState([]);
  const [payrollExports, setPayrollExports] = useState([]);

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
        .select('*')
        .order('created_at', { ascending: false });

      let compensationsQuery = supabase
        .from('team_member_compensations')
        .select('*')
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

      let employeesQuery = supabase
        .from('hr_employees')
        .select('*')
        .order('created_at', { ascending: false });

      let employeeContractsQuery = supabase
        .from('hr_employee_contracts')
        .select('*')
        .order('created_at', { ascending: false });

      let materialCategoriesQuery = supabase
        .from('material_categories')
        .select('*')
        .order('name', { ascending: true });

      let materialAssetsQuery = supabase
        .from('material_assets')
        .select('*')
        .order('created_at', { ascending: false });

      let payrollPeriodsQuery = supabase
        .from('hr_payroll_periods')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(60);

      let payrollVariableItemsQuery = supabase
        .from('hr_payroll_variable_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      let payrollAnomaliesQuery = supabase
        .from('hr_payroll_anomalies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      let payrollExportsQuery = supabase
        .from('hr_payroll_exports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(120);

      // Keep company scope, but include legacy rows with null company_id so existing
      // historical project data remains visible during scope migrations.
      suppliersQuery = applyCompanyScope(suppliersQuery);
      projectsQuery = applyCompanyScope(projectsQuery);
      // Some production schemas still do not expose company_id on tasks/timesheets.
      // Keep these queries column-safe and enforce company scope after fetch via project links.
      allocationsQuery = applyCompanyScope(allocationsQuery);
      compensationsQuery = applyCompanyScope(compensationsQuery);
      accountingEntriesQuery = applyCompanyScope(accountingEntriesQuery);
      employeesQuery = applyCompanyScope(employeesQuery);
      employeeContractsQuery = applyCompanyScope(employeeContractsQuery);
      materialCategoriesQuery = applyCompanyScope(materialCategoriesQuery);
      materialAssetsQuery = applyCompanyScope(materialAssetsQuery);
      payrollPeriodsQuery = applyCompanyScope(payrollPeriodsQuery);
      payrollVariableItemsQuery = applyCompanyScope(payrollVariableItemsQuery);
      payrollAnomaliesQuery = applyCompanyScope(payrollAnomaliesQuery);
      payrollExportsQuery = applyCompanyScope(payrollExportsQuery);

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
        employeesResult,
        employeeContractsResult,
        materialCategoriesResult,
        materialAssetsResult,
        payrollPeriodsResult,
        payrollVariableItemsResult,
        payrollAnomaliesResult,
        payrollExportsResult,
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
        employeesQuery,
        employeeContractsQuery,
        materialCategoriesQuery,
        materialAssetsQuery,
        payrollPeriodsQuery,
        payrollVariableItemsQuery,
        payrollAnomaliesQuery,
        payrollExportsQuery,
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
        employeesResult.error,
        employeeContractsResult.error,
        materialCategoriesResult.error,
        materialAssetsResult.error,
        payrollPeriodsResult.error,
        payrollVariableItemsResult.error,
        payrollAnomaliesResult.error,
        payrollExportsResult.error,
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
      const employeesData = employeesResult.data || [];
      const employeeContractsData = employeeContractsResult.data || [];
      const materialCategoriesData = materialCategoriesResult.data || [];
      const materialAssetsData = materialAssetsResult.data || [];
      const payrollPeriodsData = payrollPeriodsResult.data || [];
      const payrollVariableItemsData = payrollVariableItemsResult.data || [];
      const payrollAnomaliesData = payrollAnomaliesResult.data || [];
      const payrollExportsData = payrollExportsResult.data || [];
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
      }

      const projectById = new Map(projectsData.map((project) => [project.id, project]));
      const memberById = new Map(membersData.map((member) => [member.id, member]));
      const taskById = new Map(tasksData.map((task) => [task.id, task]));
      const timesheetById = new Map(timesheetsData.map((timesheet) => [timesheet.id, timesheet]));

      const normalizedAllocations = allocationsData.map((row) => ({
        ...row,
        project: row?.project || projectById.get(row.project_id) || null,
        team_member: row?.team_member || memberById.get(row.team_member_id) || null,
      }));

      const normalizedCompensations = compensationsData.map((row) => ({
        ...row,
        project: row?.project || projectById.get(row.project_id) || null,
        team_member: row?.team_member || memberById.get(row.team_member_id) || null,
        task: row?.task || taskById.get(row.task_id) || null,
        timesheet: row?.timesheet || timesheetById.get(row.timesheet_id) || null,
      }));

      setMembers(scopedMembers);
      setSuppliers(suppliersData);
      setProjects(projectsData);
      setTasks(tasksData);
      setTimesheets(timesheetsData);
      setAllocations(normalizedAllocations);
      setCompensations(normalizedCompensations);
      setAccountingEntries(accountingEntriesData);
      setAuditLogs(scopedAuditLogs);
      setEmployees(employeesData);
      setEmployeeContracts(employeeContractsData);
      setMaterialCategories(materialCategoriesData);
      setMaterialAssets(materialAssetsData);
      setPayrollPeriods(payrollPeriodsData);
      setPayrollVariableItems(payrollVariableItemsData);
      setPayrollAnomalies(payrollAnomaliesData);
      setPayrollExports(payrollExportsData);
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

  const createEmployee = useCallback(async (payload) => {
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

    const { data, error: insertError } = await supabase
      .from('hr_employees')
      .insert([row])
      .select('*')
      .single();

    if (insertError) throw insertError;

    let syncError = null;
    if (payload.sync_team_member !== false) {
      try {
        const teamMemberScope = withCompanyScope({
          user_id: user.id,
          name: fullName || `${firstName} ${lastName}`.trim() || payload.work_email || 'Employé',
          email: payload.work_email || null,
          role: payload.team_role || payload.job_title || 'member',
          joined_at: payload.hire_date || null,
          employee_id: data.id,
        });

        let existingMember = null;
        const byEmployeeResult = await supabase
          .from('team_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('employee_id', data.id)
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
          const { error: updateMemberError } = await supabase
            .from('team_members')
            .update({
              ...teamMemberScope,
              employee_id: data.id,
            })
            .eq('id', existingMember.id);

          if (updateMemberError) throw updateMemberError;
        } else {
          const { error: insertMemberError } = await supabase
            .from('team_members')
            .insert([teamMemberScope]);

          if (insertMemberError) throw insertMemberError;
        }
      } catch (err) {
        syncError = err;
      }
    }

    await fetchData();

    if (syncError) {
      toast({
        title: 'Employé créé avec avertissement',
        description: `La liaison vers team_members a échoué: ${syncError.message}`,
        variant: 'destructive',
      });
    }

    return data;
  }, [fetchData, supabase, toast, user, withCompanyScope]);

  const createEmployeeContract = useCallback(async (payload) => {
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
  }, [fetchData, supabase, user, withCompanyScope]);

  const createMaterialCategory = useCallback(async (payload) => {
    if (!user || !supabase) return null;

    const row = withCompanyScope({
      category_code: payload.category_code || null,
      name: payload.name,
      description: payload.description || null,
    });

    const { data, error: insertError } = await supabase
      .from('material_categories')
      .insert([row])
      .select('*')
      .single();

    if (insertError) throw insertError;
    await fetchData();
    return data;
  }, [fetchData, supabase, user, withCompanyScope]);

  const createMaterialAsset = useCallback(async (payload) => {
    if (!user || !supabase) return null;

    const row = withCompanyScope({
      category_id: payload.category_id || null,
      asset_code: payload.asset_code,
      asset_name: payload.asset_name,
      status: payload.status || 'available',
      unit_usage_cost: toNumber(payload.unit_usage_cost),
      unit_of_measure: payload.unit_of_measure || 'hour',
      cost_center_id: payload.cost_center_id || null,
      linked_fixed_asset_id: payload.linked_fixed_asset_id || null,
      acquisition_mode: payload.acquisition_mode || 'purchase',
      supplier_id: payload.supplier_id || null,
      contract_reference: payload.contract_reference || null,
      contract_start_date: payload.contract_start_date || null,
      contract_end_date: payload.contract_end_date || null,
      purchase_date: payload.purchase_date || null,
      purchase_cost: toNumber(payload.purchase_cost),
      rental_rate: toNumber(payload.rental_rate),
      billing_cycle: payload.billing_cycle || null,
      notes: payload.notes || null,
    });

    const { data, error: insertError } = await supabase
      .from('material_assets')
      .insert([row])
      .select('*')
      .single();

    if (insertError) throw insertError;
    await fetchData();
    return data;
  }, [fetchData, supabase, user, withCompanyScope]);

  const createPayrollPeriod = useCallback(async (payload) => {
    if (!user || !supabase) return null;

    const row = withCompanyScope({
      period_start: payload.period_start,
      period_end: payload.period_end,
      status: payload.status || 'open',
      calculation_version: 1,
    });

    const { data, error: insertError } = await supabase
      .from('hr_payroll_periods')
      .insert([row])
      .select('*')
      .single();

    if (insertError) throw insertError;
    await fetchData();
    return data;
  }, [fetchData, supabase, user, withCompanyScope]);

  const calculatePayrollPeriod = useCallback(async (payrollPeriodId, incremental = false) => {
    if (!payrollPeriodId || !supabase) return null;

    const { data, error: rpcError } = await supabase.rpc('hr_calculate_payroll_period', {
      p_payroll_period_id: payrollPeriodId,
      p_incremental: incremental,
    });

    if (rpcError) throw rpcError;
    await fetchData();
    return data;
  }, [fetchData, supabase]);

  const exportPayrollCsv = useCallback(async (payrollPeriodId) => {
    if (!payrollPeriodId || !supabase || !user) return null;

    const { data: csvData, error: rpcError } = await supabase.rpc('hr_export_payroll_csv', {
      p_payroll_period_id: payrollPeriodId,
    });

    if (rpcError) throw rpcError;

    let nextVersion = 1;
    const existingVersionResult = await supabase
      .from('hr_payroll_exports')
      .select('version')
      .eq('payroll_period_id', payrollPeriodId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingVersionResult.error) throw existingVersionResult.error;
    if (existingVersionResult.data?.version) {
      nextVersion = Number(existingVersionResult.data.version) + 1;
    }

    const exportRow = withCompanyScope({
      payroll_period_id: payrollPeriodId,
      export_format: 'csv',
      export_status: 'generated',
      version: nextVersion,
      generated_by: user.id,
      file_url: null,
    });

    const { error: exportInsertError } = await supabase
      .from('hr_payroll_exports')
      .insert([exportRow]);

    if (exportInsertError) throw exportInsertError;

    await fetchData();
    return csvData || '';
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
    employees,
    employeeContracts,
    materialCategories,
    materialAssets,
    payrollPeriods,
    payrollVariableItems,
    payrollAnomalies,
    payrollExports,
    fetchData,
    createAllocation,
    createCompensation,
    createEmployee,
    createEmployeeContract,
    createMaterialCategory,
    createMaterialAsset,
    createPayrollPeriod,
    calculatePayrollPeriod,
    exportPayrollCsv,
    updateCompensationStatus,
    assignTaskMember,
  };
}
