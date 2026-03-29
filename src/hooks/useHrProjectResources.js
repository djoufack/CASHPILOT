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

/**
 * Hook responsible for project resource allocations, compensations, suppliers,
 * tasks, timesheets, accounting entries, and audit logs.
 */
export function useHrProjectResources() {
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
  const [supplierServices, setSupplierServices] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
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

      let suppliersQuery = supabase.from('suppliers').select('*').order('created_at', { ascending: false });

      let supplierServicesQuery = supabase
        .from('supplier_services')
        .select('id, supplier_id, company_id, service_name, pricing_type, hourly_rate, fixed_price, unit, created_at')
        .order('created_at', { ascending: false });

      let supplierProductsQuery = supabase
        .from('supplier_products')
        .select('id, supplier_id, company_id, product_name, sku, unit_price, created_at')
        .order('created_at', { ascending: false });

      let projectsQuery = supabase
        .from('projects')
        .select('id, name, status, client_id, company_id')
        .order('name', { ascending: true });

      let tasksQuery = supabase
        .from('tasks')
        .select('id, title, name, status, assigned_to, assigned_member_id, project_id, due_date, updated_at')
        .order('updated_at', { ascending: false });

      let timesheetsQuery = supabase
        .from('timesheets')
        .select('id, date, status, billable, duration_minutes, hourly_rate, project_id, task_id, executed_by_member_id')
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

      // Apply company scope
      suppliersQuery = applyCompanyScope(suppliersQuery);
      supplierServicesQuery = applyCompanyScope(supplierServicesQuery);
      supplierProductsQuery = applyCompanyScope(supplierProductsQuery);
      projectsQuery = applyCompanyScope(projectsQuery);
      allocationsQuery = applyCompanyScope(allocationsQuery);
      compensationsQuery = applyCompanyScope(compensationsQuery);
      accountingEntriesQuery = applyCompanyScope(accountingEntriesQuery);

      const _results = await Promise.allSettled([
        membersQuery,
        suppliersQuery,
        supplierServicesQuery,
        supplierProductsQuery,
        projectsQuery,
        tasksQuery,
        timesheetsQuery,
        allocationsQuery,
        compensationsQuery,
        accountingEntriesQuery,
        auditLogsQuery,
      ]);

      const _prLabels = [
        'members',
        'suppliers',
        'supplierServices',
        'supplierProducts',
        'projects',
        'tasks',
        'timesheets',
        'allocations',
        'compensations',
        'accountingEntries',
        'auditLogs',
      ];
      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`ProjectResources fetch "${_prLabels[i]}" failed:`, r.reason);
      });

      const _v = (i) => (_results[i].status === 'fulfilled' ? _results[i].value : null) || { data: null, error: null };

      const membersResult = _v(0);
      const suppliersResult = _v(1);
      const supplierServicesResult = _v(2);
      const supplierProductsResult = _v(3);
      const projectsResult = _v(4);
      const tasksResult = _v(5);
      const timesheetsResult = _v(6);
      const allocationsResult = _v(7);
      const compensationsResult = _v(8);
      const accountingEntriesResult = _v(9);
      const auditLogsResult = _v(10);

      // Log Supabase-level errors but continue with partial data
      [
        membersResult,
        suppliersResult,
        supplierServicesResult,
        supplierProductsResult,
        projectsResult,
        tasksResult,
        timesheetsResult,
        allocationsResult,
        compensationsResult,
        accountingEntriesResult,
        auditLogsResult,
      ].forEach((res, i) => {
        if (res.error) console.error(`ProjectResources query "${_prLabels[i]}" error:`, res.error);
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
      const allocationsData = allocationsResult.data || [];
      const compensationsData = compensationsResult.data || [];
      const projectsData = projectsResult.data || [];
      const suppliersData = suppliersResult.data || [];
      const supplierServicesData = supplierServicesResult.data || [];
      const supplierProductsData = supplierProductsResult.data || [];
      const accountingEntriesData = accountingEntriesResult.data || [];
      const scopedProjectIds = new Set((projectsData || []).map((project) => project.id));

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
      const supplierServiceById = new Map(supplierServicesData.map((service) => [service.id, service]));
      const supplierProductById = new Map(supplierProductsData.map((product) => [product.id, product]));

      const normalizedAllocations = allocationsData.map((row) => ({
        ...row,
        project: row?.project || projectById.get(row.project_id) || null,
        team_member: row?.team_member || memberById.get(row.team_member_id) || null,
        supplier_service: row?.supplier_service || supplierServiceById.get(row.supplier_service_id) || null,
        supplier_product: row?.supplier_product || supplierProductById.get(row.supplier_product_id) || null,
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
      setSupplierServices(supplierServicesData);
      setSupplierProducts(supplierProductsData);
      setAccountingEntries(accountingEntriesData);
      setAuditLogs(scopedAuditLogs);
    } catch (err) {
      setError(err.message || 'Impossible de charger les ressources projet');
      toast({
        title: 'Erreur Ressources Projet',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, toast, user]);

  const createAllocation = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const normalizedType = payload.resource_type === 'material' ? 'material' : 'human';
      const normalizedOrigin = normalizeResourceOrigin(payload.resource_origin);
      const normalizedSupplierId = normalizedOrigin === 'external_supplier' ? payload.supplier_id || null : null;
      const normalizedExternalServiceId =
        normalizedOrigin === 'external_supplier' && normalizedType === 'human'
          ? payload.supplier_service_id || null
          : null;
      const normalizedExternalProductId =
        normalizedOrigin === 'external_supplier' && normalizedType === 'material'
          ? payload.supplier_product_id || null
          : null;

      const row = withCompanyScope({
        user_id: user.id,
        project_id: payload.project_id,
        resource_type: normalizedType,
        resource_origin: normalizedOrigin,
        supplier_id: normalizedSupplierId,
        supplier_service_id: normalizedExternalServiceId,
        supplier_product_id: normalizedExternalProductId,
        team_member_id:
          normalizedType === 'human' && normalizedOrigin === 'internal' ? payload.team_member_id || null : null,
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
    },
    [fetchData, user, withCompanyScope]
  );

  const createSupplierFromPortfolioCompany = useCallback(
    async ({ providerCompanyId, providerCompanyName }) => {
      if (!user || !supabase) return null;
      if (!providerCompanyId || !providerCompanyName) {
        throw new Error('Société fournisseur invalide');
      }

      let existingSupplier = null;

      const existingByNameQuery = applyCompanyScope(
        supabase.from('suppliers').select('*').eq('user_id', user.id).eq('company_name', providerCompanyName).limit(1),
        { includeUnassigned: false }
      );
      const existingByNameResult = await existingByNameQuery.maybeSingle();
      if (existingByNameResult.error) throw existingByNameResult.error;
      if (existingByNameResult.data) {
        existingSupplier = existingByNameResult.data;
      }

      if (!existingSupplier) {
        const existingByLinkedQuery = applyCompanyScope(
          supabase
            .from('suppliers')
            .select('*')
            .eq('user_id', user.id)
            .eq('linked_company_id', providerCompanyId)
            .limit(1),
          { includeUnassigned: false }
        );
        const existingByLinkedResult = await existingByLinkedQuery.maybeSingle();
        if (!existingByLinkedResult.error && existingByLinkedResult.data) {
          existingSupplier = existingByLinkedResult.data;
        }
        if (
          existingByLinkedResult.error &&
          !String(existingByLinkedResult.error.message || '')
            .toLowerCase()
            .includes('linked_company_id')
        ) {
          throw existingByLinkedResult.error;
        }
      }

      if (existingSupplier) {
        return { supplier: existingSupplier, created: false };
      }

      const row = withCompanyScope({
        user_id: user.id,
        company_name: providerCompanyName,
        linked_company_id: providerCompanyId,
      });

      let insertResult = await supabase.from('suppliers').insert([row]).select('*').single();

      if (
        insertResult.error &&
        String(insertResult.error.message || '')
          .toLowerCase()
          .includes('linked_company_id')
      ) {
        const fallbackRow = { ...row };
        delete fallbackRow.linked_company_id;
        insertResult = await supabase.from('suppliers').insert([fallbackRow]).select('*').single();
      }

      if (insertResult.error) throw insertResult.error;
      await fetchData();
      return { supplier: insertResult.data, created: true };
    },
    [applyCompanyScope, fetchData, user, withCompanyScope]
  );

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
    supplierServices,
    supplierProducts,
    accountingEntries,
    auditLogs,
    fetchData,
    createAllocation,
    createSupplierFromPortfolioCompany,
    createCompensation,
    updateCompensationStatus,
    assignTaskMember,
  };
}
