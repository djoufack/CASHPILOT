import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { sanitizeRecord } from '../utils/sanitize.js';
import { validateDatesInRecord } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

// ── Explicit column lists (no select('*') — defense against future data leaks) ──
const COLS_PROJECT_BASELINES =
  'id, user_id, company_id, project_id, version, baseline_label, planned_start_date, planned_end_date, planned_budget_hours, planned_budget_amount, planned_tasks_count, notes, is_active, created_at, updated_at';
const COLS_PROJECT_MILESTONES =
  'id, user_id, company_id, project_id, title, description, status, planned_date, actual_date, planned_amount, bonus_rule_type, bonus_rule_value, malus_rule_type, malus_rule_value, settled_amount, settled_at, linked_invoice_id, linked_payment_id, notes, created_at, updated_at';
const COLS_PROJECT_RESOURCE_ALLOCATIONS =
  'id, user_id, company_id, project_id, resource_type, team_member_id, resource_name, unit, planned_quantity, actual_quantity, planned_cost, actual_cost, start_date, end_date, status, notes, created_at, updated_at';
const COLS_TEAM_MEMBER_COMPENSATIONS =
  'id, user_id, company_id, project_id, team_member_id, task_id, timesheet_id, amount, compensation_type, payment_status, planned_payment_date, paid_at, payment_reference, notes, created_at, updated_at';
const COLS_CRM_SUPPORT_TICKETS =
  'id, user_id, company_id, client_id, project_id, ticket_number, title, description, priority, status, sla_level, due_at, first_response_at, resolved_at, closed_at, created_at, updated_at';
const COLS_CRM_SUPPORT_SLA_POLICIES =
  'id, user_id, company_id, policy_name, priority, target_first_response_minutes, target_resolution_minutes, is_default, is_active, created_at, updated_at';
const COLS_MATERIAL_CATEGORIES = 'id, company_id, category_code, name, description, created_at, updated_at';
const COLS_MATERIAL_ASSETS =
  'id, company_id, category_id, asset_code, asset_name, status, unit_usage_cost, unit_of_measure, cost_center_id, linked_fixed_asset_id, created_at, updated_at';
const COLS_MATERIAL_ASSIGNMENTS =
  'id, company_id, material_asset_id, project_id, task_id, start_at, end_at, planned_quantity, planned_unit, status, notes, created_at, updated_at';
const COLS_MATERIAL_MAINTENANCE_WINDOWS =
  'id, company_id, material_asset_id, start_at, end_at, status, reason, created_at, updated_at';
const COLS_MATERIAL_USAGE_LOGS =
  'id, company_id, material_asset_id, project_id, task_id, usage_date, quantity, unit_cost, total_cost, status, notes, created_at, updated_at';
const COLS_MATERIAL_USAGE_APPROVALS =
  'id, company_id, usage_log_id, approver_employee_id, decision, comment, decided_at';

export function registerProjectCrmCrudTools(server: McpServer) {
  // ============================================================
  // PROJECT_BASELINES CRUD (has user_id + company_id)
  // ============================================================

  server.tool(
    'create_project_baselines',
    'Create a new record in project_baselines',
    {
      company_id: z.string().describe('Company UUID'),
      project_id: z.string().describe('Project UUID'),
      version: z.number().int(),
      baseline_label: z.string().optional(),
      planned_start_date: z.string().optional(),
      planned_end_date: z.string().optional(),
      planned_budget_hours: z.number().optional(),
      planned_budget_amount: z.number().optional(),
      planned_tasks_count: z.number().int().optional(),
      notes: z.string().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      const { data, error } = await supabase
        .from('project_baselines')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create project baseline') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created project_baselines record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_project_baselines',
    'Update an existing record in project_baselines',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      project_id: z.string().optional(),
      version: z.number().int().optional(),
      baseline_label: z.string().optional(),
      planned_start_date: z.string().optional(),
      planned_end_date: z.string().optional(),
      planned_budget_hours: z.number().optional(),
      planned_budget_amount: z.number().optional(),
      planned_tasks_count: z.number().int().optional(),
      notes: z.string().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('project_baselines').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update project baseline') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated project_baselines record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_project_baselines',
    'Delete a record from project_baselines',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('project_baselines').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete project baseline') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from project_baselines' }],
      };
    }
  );

  server.tool(
    'get_project_baselines',
    'Get a single record from project_baselines by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('project_baselines').select(COLS_PROJECT_BASELINES).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get project baseline') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_project_baselines',
    'List multiple records from project_baselines',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      project_id: z.string().optional().describe('Filter by project UUID'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, project_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('project_baselines').select(COLS_PROJECT_BASELINES);
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      if (project_id) query = query.eq('project_id', project_id);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list project baselines') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // PROJECT_MILESTONES CRUD (has user_id + company_id)
  // ============================================================

  server.tool(
    'create_project_milestones',
    'Create a new record in project_milestones',
    {
      company_id: z.string().describe('Company UUID'),
      project_id: z.string().describe('Project UUID'),
      title: z.string(),
      description: z.string().optional(),
      status: z.enum(['planned', 'in_progress', 'achieved', 'overdue', 'cancelled']).optional(),
      planned_date: z.string().optional(),
      actual_date: z.string().optional(),
      planned_amount: z.number().optional(),
      bonus_rule_type: z.enum(['none', 'fixed', 'percentage', 'day']).optional(),
      bonus_rule_value: z.number().optional(),
      malus_rule_type: z.enum(['none', 'fixed', 'percentage', 'day']).optional(),
      malus_rule_value: z.number().optional(),
      settled_amount: z.number().optional(),
      settled_at: z.string().optional(),
      linked_invoice_id: z.string().optional(),
      linked_payment_id: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      const { data, error } = await supabase
        .from('project_milestones')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create project milestone') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created project_milestones record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_project_milestones',
    'Update an existing record in project_milestones',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      project_id: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['planned', 'in_progress', 'achieved', 'overdue', 'cancelled']).optional(),
      planned_date: z.string().optional(),
      actual_date: z.string().optional(),
      planned_amount: z.number().optional(),
      bonus_rule_type: z.enum(['none', 'fixed', 'percentage', 'day']).optional(),
      bonus_rule_value: z.number().optional(),
      malus_rule_type: z.enum(['none', 'fixed', 'percentage', 'day']).optional(),
      malus_rule_value: z.number().optional(),
      settled_amount: z.number().optional(),
      settled_at: z.string().optional(),
      linked_invoice_id: z.string().optional(),
      linked_payment_id: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('project_milestones').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update project milestone') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated project_milestones record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_project_milestones',
    'Delete a record from project_milestones',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('project_milestones').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete project milestone') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from project_milestones' }],
      };
    }
  );

  server.tool(
    'get_project_milestones',
    'Get a single record from project_milestones by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('project_milestones').select(COLS_PROJECT_MILESTONES).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get project milestone') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_project_milestones',
    'List multiple records from project_milestones',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      project_id: z.string().optional().describe('Filter by project UUID'),
      status: z
        .enum(['planned', 'in_progress', 'achieved', 'overdue', 'cancelled'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, project_id, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('project_milestones').select(COLS_PROJECT_MILESTONES);
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      if (project_id) query = query.eq('project_id', project_id);
      if (status) query = query.eq('status', status);
      query = query.order('planned_date', { ascending: true });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list project milestones') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // PROJECT_RESOURCE_ALLOCATIONS CRUD (has user_id + company_id)
  // ============================================================

  server.tool(
    'create_project_resource_allocations',
    'Create a new record in project_resource_allocations',
    {
      company_id: z.string().describe('Company UUID'),
      project_id: z.string().describe('Project UUID'),
      resource_type: z.enum(['human', 'material']),
      team_member_id: z.string().optional(),
      resource_name: z.string().optional(),
      unit: z.string().optional(),
      planned_quantity: z.number().optional(),
      actual_quantity: z.number().optional(),
      planned_cost: z.number().optional(),
      actual_cost: z.number().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      const { data, error } = await supabase
        .from('project_resource_allocations')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create project resource allocation') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created project_resource_allocations record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_project_resource_allocations',
    'Update an existing record in project_resource_allocations',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      project_id: z.string().optional(),
      resource_type: z.enum(['human', 'material']).optional(),
      team_member_id: z.string().optional(),
      resource_name: z.string().optional(),
      unit: z.string().optional(),
      planned_quantity: z.number().optional(),
      actual_quantity: z.number().optional(),
      planned_cost: z.number().optional(),
      actual_cost: z.number().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('project_resource_allocations').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update project resource allocation') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated project_resource_allocations record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_project_resource_allocations',
    'Delete a record from project_resource_allocations',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('project_resource_allocations').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete project resource allocation') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from project_resource_allocations' },
        ],
      };
    }
  );

  server.tool(
    'get_project_resource_allocations',
    'Get a single record from project_resource_allocations by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('project_resource_allocations').select(COLS_PROJECT_RESOURCE_ALLOCATIONS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get project resource allocation') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_project_resource_allocations',
    'List multiple records from project_resource_allocations',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      project_id: z.string().optional().describe('Filter by project UUID'),
      resource_type: z.enum(['human', 'material']).optional().describe('Filter by resource type'),
      status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional().describe('Filter by status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, project_id, resource_type, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('project_resource_allocations').select(COLS_PROJECT_RESOURCE_ALLOCATIONS);
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      if (project_id) query = query.eq('project_id', project_id);
      if (resource_type) query = query.eq('resource_type', resource_type);
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list project resource allocations') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // TEAM_MEMBER_COMPENSATIONS CRUD (has user_id + company_id)
  // ============================================================

  server.tool(
    'create_team_member_compensations',
    'Create a new record in team_member_compensations',
    {
      company_id: z.string().describe('Company UUID'),
      project_id: z.string().optional(),
      team_member_id: z.string().describe('Team member UUID'),
      task_id: z.string().optional(),
      timesheet_id: z.string().optional(),
      amount: z.number(),
      compensation_type: z.enum(['hourly', 'fixed', 'bonus', 'malus', 'adjustment']),
      payment_status: z.enum(['planned', 'approved', 'paid', 'cancelled']).optional(),
      planned_payment_date: z.string().optional(),
      paid_at: z.string().optional(),
      payment_reference: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      const { data, error } = await supabase
        .from('team_member_compensations')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create team member compensation') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created team_member_compensations record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_team_member_compensations',
    'Update an existing record in team_member_compensations',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      project_id: z.string().optional(),
      team_member_id: z.string().optional(),
      task_id: z.string().optional(),
      timesheet_id: z.string().optional(),
      amount: z.number().optional(),
      compensation_type: z.enum(['hourly', 'fixed', 'bonus', 'malus', 'adjustment']).optional(),
      payment_status: z.enum(['planned', 'approved', 'paid', 'cancelled']).optional(),
      planned_payment_date: z.string().optional(),
      paid_at: z.string().optional(),
      payment_reference: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('team_member_compensations').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update team member compensation') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated team_member_compensations record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_team_member_compensations',
    'Delete a record from team_member_compensations',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('team_member_compensations').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete team member compensation') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from team_member_compensations' },
        ],
      };
    }
  );

  server.tool(
    'get_team_member_compensations',
    'Get a single record from team_member_compensations by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('team_member_compensations').select(COLS_TEAM_MEMBER_COMPENSATIONS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get team member compensation') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_team_member_compensations',
    'List multiple records from team_member_compensations',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      project_id: z.string().optional().describe('Filter by project UUID'),
      team_member_id: z.string().optional().describe('Filter by team member UUID'),
      compensation_type: z
        .enum(['hourly', 'fixed', 'bonus', 'malus', 'adjustment'])
        .optional()
        .describe('Filter by compensation type'),
      payment_status: z
        .enum(['planned', 'approved', 'paid', 'cancelled'])
        .optional()
        .describe('Filter by payment status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, project_id, team_member_id, compensation_type, payment_status, limit = 50, offset = 0 }) => {
      let query = supabase.from('team_member_compensations').select(COLS_TEAM_MEMBER_COMPENSATIONS);
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      if (project_id) query = query.eq('project_id', project_id);
      if (team_member_id) query = query.eq('team_member_id', team_member_id);
      if (compensation_type) query = query.eq('compensation_type', compensation_type);
      if (payment_status) query = query.eq('payment_status', payment_status);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list team member compensations') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // CRM_SUPPORT_TICKETS CRUD (has user_id + company_id)
  // ============================================================

  server.tool(
    'create_crm_support_tickets',
    'Create a new record in crm_support_tickets',
    {
      company_id: z.string().describe('Company UUID'),
      client_id: z.string().optional(),
      project_id: z.string().optional(),
      ticket_number: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      status: z.enum(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']).optional(),
      sla_level: z.enum(['standard', 'premium', 'critical']).optional(),
      due_at: z.string().optional(),
      first_response_at: z.string().optional(),
      resolved_at: z.string().optional(),
      closed_at: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      const { data, error } = await supabase
        .from('crm_support_tickets')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create CRM support ticket') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created crm_support_tickets record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_crm_support_tickets',
    'Update an existing record in crm_support_tickets',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      client_id: z.string().optional(),
      project_id: z.string().optional(),
      ticket_number: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      status: z.enum(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']).optional(),
      sla_level: z.enum(['standard', 'premium', 'critical']).optional(),
      due_at: z.string().optional(),
      first_response_at: z.string().optional(),
      resolved_at: z.string().optional(),
      closed_at: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('crm_support_tickets').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update CRM support ticket') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated crm_support_tickets record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_crm_support_tickets',
    'Delete a record from crm_support_tickets',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('crm_support_tickets').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete CRM support ticket') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from crm_support_tickets' }],
      };
    }
  );

  server.tool(
    'get_crm_support_tickets',
    'Get a single record from crm_support_tickets by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('crm_support_tickets').select(COLS_CRM_SUPPORT_TICKETS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get CRM support ticket') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_crm_support_tickets',
    'List multiple records from crm_support_tickets',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      client_id: z.string().optional().describe('Filter by client UUID'),
      project_id: z.string().optional().describe('Filter by project UUID'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by priority'),
      status: z
        .enum(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, client_id, project_id, priority, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('crm_support_tickets').select(COLS_CRM_SUPPORT_TICKETS);
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      if (client_id) query = query.eq('client_id', client_id);
      if (project_id) query = query.eq('project_id', project_id);
      if (priority) query = query.eq('priority', priority);
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list CRM support tickets') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // CRM_SUPPORT_SLA_POLICIES CRUD (has user_id + company_id)
  // ============================================================

  server.tool(
    'create_crm_support_sla_policies',
    'Create a new record in crm_support_sla_policies',
    {
      company_id: z.string().describe('Company UUID'),
      policy_name: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      target_first_response_minutes: z.number().int().optional(),
      target_resolution_minutes: z.number().int().optional(),
      is_default: z.boolean().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      const { data, error } = await supabase
        .from('crm_support_sla_policies')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create CRM support SLA policy') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created crm_support_sla_policies record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_crm_support_sla_policies',
    'Update an existing record in crm_support_sla_policies',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      policy_name: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      target_first_response_minutes: z.number().int().optional(),
      target_resolution_minutes: z.number().int().optional(),
      is_default: z.boolean().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('crm_support_sla_policies').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update CRM support SLA policy') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated crm_support_sla_policies record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_crm_support_sla_policies',
    'Delete a record from crm_support_sla_policies',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('crm_support_sla_policies').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete CRM support SLA policy') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from crm_support_sla_policies' },
        ],
      };
    }
  );

  server.tool(
    'get_crm_support_sla_policies',
    'Get a single record from crm_support_sla_policies by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('crm_support_sla_policies').select(COLS_CRM_SUPPORT_SLA_POLICIES).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get CRM support SLA policy') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_crm_support_sla_policies',
    'List multiple records from crm_support_sla_policies',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by priority'),
      is_active: z.boolean().optional().describe('Filter by active status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, priority, is_active, limit = 50, offset = 0 }) => {
      let query = supabase.from('crm_support_sla_policies').select(COLS_CRM_SUPPORT_SLA_POLICIES);
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      if (priority) query = query.eq('priority', priority);
      if (is_active !== undefined) query = query.eq('is_active', is_active);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list CRM support SLA policies') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // MATERIAL_CATEGORIES CRUD (company_id only — RLS handles user filtering)
  // ============================================================

  server.tool(
    'create_material_categories',
    'Create a new record in material_categories',
    {
      company_id: z.string().describe('Company UUID'),
      category_code: z.string(),
      name: z.string(),
      description: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('material_categories')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create material category') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created material_categories record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_material_categories',
    'Update an existing record in material_categories',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      category_code: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('material_categories').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update material category') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated material_categories record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_material_categories',
    'Delete a record from material_categories',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('material_categories').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete material category') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from material_categories' }],
      };
    }
  );

  server.tool(
    'get_material_categories',
    'Get a single record from material_categories by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('material_categories').select(COLS_MATERIAL_CATEGORIES).eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get material category') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_material_categories',
    'List multiple records from material_categories',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('material_categories').select(COLS_MATERIAL_CATEGORIES);
      if (company_id) query = query.eq('company_id', company_id);
      query = query.order('name', { ascending: true });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list material categories') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // MATERIAL_ASSETS CRUD (company_id only — RLS handles user filtering)
  // ============================================================

  server.tool(
    'create_material_assets',
    'Create a new record in material_assets',
    {
      company_id: z.string().describe('Company UUID'),
      category_id: z.string().optional(),
      asset_code: z.string(),
      asset_name: z.string(),
      status: z.enum(['available', 'in_use', 'maintenance', 'out_of_service', 'retired']).optional(),
      unit_usage_cost: z.number().optional(),
      unit_of_measure: z.string().optional(),
      cost_center_id: z.string().optional(),
      linked_fixed_asset_id: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('material_assets')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create material asset') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created material_assets record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_material_assets',
    'Update an existing record in material_assets',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      category_id: z.string().optional(),
      asset_code: z.string().optional(),
      asset_name: z.string().optional(),
      status: z.enum(['available', 'in_use', 'maintenance', 'out_of_service', 'retired']).optional(),
      unit_usage_cost: z.number().optional(),
      unit_of_measure: z.string().optional(),
      cost_center_id: z.string().optional(),
      linked_fixed_asset_id: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('material_assets').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update material asset') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated material_assets record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_material_assets',
    'Delete a record from material_assets',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('material_assets').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete material asset') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from material_assets' }],
      };
    }
  );

  server.tool(
    'get_material_assets',
    'Get a single record from material_assets by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('material_assets').select(COLS_MATERIAL_ASSETS).eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get material asset') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_material_assets',
    'List multiple records from material_assets',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      category_id: z.string().optional().describe('Filter by category UUID'),
      status: z
        .enum(['available', 'in_use', 'maintenance', 'out_of_service', 'retired'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, category_id, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('material_assets').select(COLS_MATERIAL_ASSETS);
      if (company_id) query = query.eq('company_id', company_id);
      if (category_id) query = query.eq('category_id', category_id);
      if (status) query = query.eq('status', status);
      query = query.order('asset_name', { ascending: true });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list material assets') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // MATERIAL_ASSIGNMENTS CRUD (company_id only — RLS handles user filtering)
  // ============================================================

  server.tool(
    'create_material_assignments',
    'Create a new record in material_assignments',
    {
      company_id: z.string().describe('Company UUID'),
      material_asset_id: z.string().describe('Material asset UUID'),
      project_id: z.string().optional(),
      task_id: z.string().optional(),
      start_at: z.string().optional(),
      end_at: z.string().optional(),
      planned_quantity: z.number().optional(),
      planned_unit: z.string().optional(),
      status: z.enum(['planned', 'approved', 'active', 'completed', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('material_assignments')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create material assignment') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created material_assignments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_material_assignments',
    'Update an existing record in material_assignments',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      material_asset_id: z.string().optional(),
      project_id: z.string().optional(),
      task_id: z.string().optional(),
      start_at: z.string().optional(),
      end_at: z.string().optional(),
      planned_quantity: z.number().optional(),
      planned_unit: z.string().optional(),
      status: z.enum(['planned', 'approved', 'active', 'completed', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('material_assignments').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update material assignment') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated material_assignments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_material_assignments',
    'Delete a record from material_assignments',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('material_assignments').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete material assignment') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from material_assignments' }],
      };
    }
  );

  server.tool(
    'get_material_assignments',
    'Get a single record from material_assignments by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('material_assignments').select(COLS_MATERIAL_ASSIGNMENTS).eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get material assignment') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_material_assignments',
    'List multiple records from material_assignments',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      material_asset_id: z.string().optional().describe('Filter by material asset UUID'),
      project_id: z.string().optional().describe('Filter by project UUID'),
      status: z
        .enum(['planned', 'approved', 'active', 'completed', 'cancelled'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, material_asset_id, project_id, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('material_assignments').select(COLS_MATERIAL_ASSIGNMENTS);
      if (company_id) query = query.eq('company_id', company_id);
      if (material_asset_id) query = query.eq('material_asset_id', material_asset_id);
      if (project_id) query = query.eq('project_id', project_id);
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list material assignments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // MATERIAL_MAINTENANCE_WINDOWS CRUD (company_id only — RLS handles user filtering)
  // ============================================================

  server.tool(
    'create_material_maintenance_windows',
    'Create a new record in material_maintenance_windows',
    {
      company_id: z.string().describe('Company UUID'),
      material_asset_id: z.string().describe('Material asset UUID'),
      start_at: z.string().optional(),
      end_at: z.string().optional(),
      status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
      reason: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('material_maintenance_windows')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create material maintenance window') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created material_maintenance_windows record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_material_maintenance_windows',
    'Update an existing record in material_maintenance_windows',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      material_asset_id: z.string().optional(),
      start_at: z.string().optional(),
      end_at: z.string().optional(),
      status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
      reason: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('material_maintenance_windows').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update material maintenance window') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated material_maintenance_windows record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_material_maintenance_windows',
    'Delete a record from material_maintenance_windows',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('material_maintenance_windows').delete().eq('id', id);
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete material maintenance window') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from material_maintenance_windows' },
        ],
      };
    }
  );

  server.tool(
    'get_material_maintenance_windows',
    'Get a single record from material_maintenance_windows by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('material_maintenance_windows').select(COLS_MATERIAL_MAINTENANCE_WINDOWS).eq('id', id);
      const { data, error } = await query.single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get material maintenance window') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_material_maintenance_windows',
    'List multiple records from material_maintenance_windows',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      material_asset_id: z.string().optional().describe('Filter by material asset UUID'),
      status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional().describe('Filter by status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, material_asset_id, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('material_maintenance_windows').select(COLS_MATERIAL_MAINTENANCE_WINDOWS);
      if (company_id) query = query.eq('company_id', company_id);
      if (material_asset_id) query = query.eq('material_asset_id', material_asset_id);
      if (status) query = query.eq('status', status);
      query = query.order('start_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list material maintenance windows') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // MATERIAL_USAGE_LOGS CRUD (company_id only — RLS handles user filtering)
  // ============================================================

  server.tool(
    'create_material_usage_logs',
    'Create a new record in material_usage_logs',
    {
      company_id: z.string().describe('Company UUID'),
      material_asset_id: z.string().describe('Material asset UUID'),
      project_id: z.string().optional(),
      task_id: z.string().optional(),
      usage_date: z.string().optional(),
      quantity: z.number().optional(),
      unit_cost: z.number().optional(),
      total_cost: z.number().optional(),
      status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('material_usage_logs')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create material usage log') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created material_usage_logs record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_material_usage_logs',
    'Update an existing record in material_usage_logs',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      material_asset_id: z.string().optional(),
      project_id: z.string().optional(),
      task_id: z.string().optional(),
      usage_date: z.string().optional(),
      quantity: z.number().optional(),
      unit_cost: z.number().optional(),
      total_cost: z.number().optional(),
      status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('material_usage_logs').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update material usage log') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated material_usage_logs record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_material_usage_logs',
    'Delete a record from material_usage_logs',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('material_usage_logs').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete material usage log') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from material_usage_logs' }],
      };
    }
  );

  server.tool(
    'get_material_usage_logs',
    'Get a single record from material_usage_logs by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('material_usage_logs').select(COLS_MATERIAL_USAGE_LOGS).eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get material usage log') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_material_usage_logs',
    'List multiple records from material_usage_logs',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      material_asset_id: z.string().optional().describe('Filter by material asset UUID'),
      project_id: z.string().optional().describe('Filter by project UUID'),
      status: z
        .enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, material_asset_id, project_id, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('material_usage_logs').select(COLS_MATERIAL_USAGE_LOGS);
      if (company_id) query = query.eq('company_id', company_id);
      if (material_asset_id) query = query.eq('material_asset_id', material_asset_id);
      if (project_id) query = query.eq('project_id', project_id);
      if (status) query = query.eq('status', status);
      query = query.order('usage_date', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list material usage logs') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // MATERIAL_USAGE_APPROVALS CRUD (company_id only — RLS handles user filtering)
  // ============================================================

  server.tool(
    'create_material_usage_approvals',
    'Create a new record in material_usage_approvals',
    {
      company_id: z.string().describe('Company UUID'),
      usage_log_id: z.string().describe('Usage log UUID'),
      approver_employee_id: z.string().optional(),
      decision: z.enum(['approved', 'rejected', 'reopened']),
      comment: z.string().optional(),
      decided_at: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('material_usage_approvals')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create material usage approval') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created material_usage_approvals record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_material_usage_approvals',
    'Update an existing record in material_usage_approvals',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional(),
      usage_log_id: z.string().optional(),
      approver_employee_id: z.string().optional(),
      decision: z.enum(['approved', 'rejected', 'reopened']).optional(),
      comment: z.string().optional(),
      decided_at: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('material_usage_approvals').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update material usage approval') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated material_usage_approvals record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_material_usage_approvals',
    'Delete a record from material_usage_approvals',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('material_usage_approvals').delete().eq('id', id);
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete material usage approval') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from material_usage_approvals' },
        ],
      };
    }
  );

  server.tool(
    'get_material_usage_approvals',
    'Get a single record from material_usage_approvals by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('material_usage_approvals').select(COLS_MATERIAL_USAGE_APPROVALS).eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get material usage approval') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_material_usage_approvals',
    'List multiple records from material_usage_approvals',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      usage_log_id: z.string().optional().describe('Filter by usage log UUID'),
      decision: z.enum(['approved', 'rejected', 'reopened']).optional().describe('Filter by decision'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, usage_log_id, decision, limit = 50, offset = 0 }) => {
      let query = supabase.from('material_usage_approvals').select(COLS_MATERIAL_USAGE_APPROVALS);
      if (company_id) query = query.eq('company_id', company_id);
      if (usage_log_id) query = query.eq('usage_log_id', usage_log_id);
      if (decision) query = query.eq('decision', decision);
      query = query.order('decided_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list material usage approvals') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
