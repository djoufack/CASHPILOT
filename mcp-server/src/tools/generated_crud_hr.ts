import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId, getCompanyId } from '../supabase.js';
import { sanitizeRecord } from '../utils/sanitize.js';
import { validateDatesInRecord } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

// ── Explicit column lists (no select('*') — defense against future data leaks) ──
const COLS_HR_DEPARTMENTS =
  'id, company_id, department_code, name, description, manager_employee_id, created_at, updated_at';
const COLS_HR_EMPLOYEES =
  'id, company_id, user_id, employee_number, first_name, last_name, full_name, work_email, phone, status, hire_date, termination_date, department_id, manager_employee_id, cost_center_id, work_calendar_id, job_title, created_at, updated_at';
const COLS_HR_EMPLOYEE_CONTRACTS =
  'id, company_id, employee_id, contract_type, status, start_date, end_date, pay_basis, hourly_rate, monthly_salary, created_at, updated_at';
const COLS_HR_EMPLOYEE_SKILLS = 'id, company_id, employee_id, skill_name, skill_level, created_at, updated_at';
const COLS_HR_LEAVE_TYPES = 'id, company_id, leave_code, name, is_paid, blocks_productive_time, created_at, updated_at';
const COLS_HR_LEAVE_REQUESTS =
  'id, company_id, employee_id, leave_type_id, start_date, end_date, total_days, status, reason, created_at, updated_at';
const COLS_HR_WORK_CALENDARS = 'id, company_id, name, timezone, weekly_target_minutes, created_at, updated_at';
const COLS_HR_TIMESHEET_PERIODS =
  'id, company_id, employee_id, period_start, period_end, period_type, status, submitted_at, validated_at, created_at, updated_at';
const COLS_HR_TIMESHEET_LINES =
  'id, company_id, timesheet_period_id, employee_id, work_date, project_id, task_id, cost_center_id, service_id, line_type, duration_minutes, billable, billable_rate, notes, source_leave_request_id, legacy_timesheet_id, status, created_at, updated_at';
const COLS_HR_TIMESHEET_APPROVALS =
  'id, company_id, timesheet_period_id, approval_level, approver_employee_id, decision, comment, decided_at';
const COLS_HR_PAYROLL_PERIODS =
  'id, company_id, period_start, period_end, status, calculation_version, calculated_at, validated_at, created_at, updated_at';
const COLS_HR_PAYROLL_VARIABLE_ITEMS =
  'id, company_id, payroll_period_id, employee_id, item_code, item_label, item_category, quantity, rate, amount, currency, source_timesheet_line_id, source_leave_request_id, metadata, created_at, updated_at';
const COLS_HR_PAYROLL_EXPORTS =
  'id, company_id, payroll_period_id, export_format, export_status, version, file_url, generated_by, generated_at, created_at, updated_at';
const COLS_HR_PAYROLL_ANOMALIES =
  'id, company_id, payroll_period_id, employee_id, anomaly_code, severity, message, details, created_at';
const COLS_HR_TRAINING_CATALOG =
  'id, company_id, title, description, provider, provider_type, format, duration_hours, cost_per_person, currency, skills_covered, is_mandatory, cpf_eligible, opco_eligible, certification_name, passing_score, validity_months, tags, is_active, created_at';
const COLS_HR_TRAINING_ENROLLMENTS =
  'id, company_id, training_id, employee_id, training_plan_id, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date, score, passed, certificate_url, certificate_expiry, actual_cost, funded_by, cpf_hours_used, rating_hot, rating_cold, feedback_comment, completed_at, created_at, updated_at';
const COLS_HR_SKILL_ASSESSMENTS =
  'id, company_id, employee_id, skill_name, skill_category, required_level, current_level, target_level, gap, assessed_by, assessment_method, assessed_at, next_assessment_date, notes, created_at, updated_at';
const COLS_HR_PERFORMANCE_REVIEWS =
  'id, company_id, employee_id, reviewer_id, period_year, period_label, review_type, status, objectives, competencies, overall_score, performance_rating, nine_box_performance, nine_box_potential, employee_comment, hr_comment, development_plan, employee_signed_at, created_at, updated_at';
const COLS_HR_SUCCESSION_PLANS =
  'id, company_id, position_id, position_title, incumbent_id, successor_id, readiness_level, nine_box_performance, nine_box_potential, risk_of_loss, development_actions, notes, reviewed_at, created_at, updated_at';
const COLS_HR_HEADCOUNT_BUDGETS =
  'id, company_id, fiscal_year, department_id, budgeted_headcount, actual_headcount, budgeted_fte, actual_fte, budgeted_payroll_cost, actual_payroll_cost, currency, planned_hires, planned_exits, planned_promotions, version, status, notes, created_at, updated_at';
const COLS_HR_SURVEYS =
  'id, company_id, title, survey_type, status, questions, target_audience, anonymous, allow_partial, response_count, enps_score, avg_satisfaction, ai_analysis, starts_at, ends_at, reminder_at, created_by, created_at, updated_at';
const COLS_HR_SURVEY_RESPONSES =
  'id, company_id, survey_id, respondent_id, responses, enps_score, completion_time_secs, submitted_at, created_at, updated_at';
const COLS_HR_RISK_ASSESSMENTS =
  'id, company_id, assessment_type, department_id, risk_category, risk_subcategory, risk_description, situation, probability, severity, risk_score, risk_level, existing_controls, prevention_measures, responsible_id, target_date, completion_date, status, assessment_date, next_review_date, created_at, updated_at';
const COLS_HR_JOB_POSITIONS =
  'id, company_id, title, description, department_id, job_level, status, created_at, updated_at';
const COLS_HR_CANDIDATES = 'id, company_id, first_name, last_name, email, phone, location, created_at, updated_at';
const COLS_HR_APPLICATIONS = 'id, company_id, position_id, candidate_id, status, applied_at, created_at, updated_at';
const COLS_HR_INTERVIEW_SESSIONS =
  'id, company_id, application_id, scheduled_at, status, interview_type, feedback, score, created_at, updated_at';
const COLS_HR_ONBOARDING_PLANS =
  'id, company_id, employee_id, checklist, completion_pct, status, created_at, updated_at';

export function registerHrCrudTools(server: McpServer) {
  // ================================================================
  // 1. hr_departments
  // ================================================================

  server.tool(
    'create_hr_departments',
    'Create a new record in hr_departments',
    {
      company_id: z.string().describe('Company UUID'),
      department_code: z.string().describe('Unique department code'),
      name: z.string().describe('Department name'),
      description: z.string().optional().describe('Department description'),
      manager_employee_id: z.string().optional().describe('Manager employee UUID'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_departments')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_departments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_departments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_departments',
    'Update an existing record in hr_departments',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      department_code: z.string().optional().describe('Unique department code'),
      name: z.string().optional().describe('Department name'),
      description: z.string().optional().describe('Department description'),
      manager_employee_id: z.string().optional().describe('Manager employee UUID'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_departments')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_departments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_departments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_departments',
    'Delete a record from hr_departments',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_departments').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_departments') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_departments' }],
      };
    }
  );

  server.tool(
    'get_hr_departments',
    'Get a single record from hr_departments by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase.from('hr_departments').select(COLS_HR_DEPARTMENTS).eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_departments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_departments',
    'List records from hr_departments with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('hr_departments').select(COLS_HR_DEPARTMENTS).order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_departments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 2. hr_employees
  // ================================================================

  server.tool(
    'create_hr_employees',
    'Create a new record in hr_employees',
    {
      company_id: z.string().describe('Company UUID'),
      user_id: z.string().optional().describe('Linked auth user UUID'),
      employee_number: z.string().optional().describe('Employee number'),
      first_name: z.string().describe('First name'),
      last_name: z.string().describe('Last name'),
      full_name: z.string().optional().describe('Full name'),
      work_email: z.string().optional().describe('Work email'),
      phone: z.string().optional().describe('Phone number'),
      status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).optional().describe('Employee status'),
      hire_date: z.string().optional().describe('Hire date (YYYY-MM-DD)'),
      termination_date: z.string().optional().describe('Termination date (YYYY-MM-DD)'),
      department_id: z.string().optional().describe('Department UUID'),
      manager_employee_id: z.string().optional().describe('Manager employee UUID'),
      cost_center_id: z.string().optional().describe('Cost center UUID'),
      work_calendar_id: z.string().optional().describe('Work calendar UUID'),
      job_title: z.string().optional().describe('Job title'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_employees')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_employees') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_employees record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_employees',
    'Update an existing record in hr_employees',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      user_id: z.string().optional().describe('Linked auth user UUID'),
      employee_number: z.string().optional().describe('Employee number'),
      first_name: z.string().optional().describe('First name'),
      last_name: z.string().optional().describe('Last name'),
      full_name: z.string().optional().describe('Full name'),
      work_email: z.string().optional().describe('Work email'),
      phone: z.string().optional().describe('Phone number'),
      status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).optional().describe('Employee status'),
      hire_date: z.string().optional().describe('Hire date (YYYY-MM-DD)'),
      termination_date: z.string().optional().describe('Termination date (YYYY-MM-DD)'),
      department_id: z.string().optional().describe('Department UUID'),
      manager_employee_id: z.string().optional().describe('Manager employee UUID'),
      cost_center_id: z.string().optional().describe('Cost center UUID'),
      work_calendar_id: z.string().optional().describe('Work calendar UUID'),
      job_title: z.string().optional().describe('Job title'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_employees')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_employees') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_employees record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_employees',
    'Delete a record from hr_employees',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_employees').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_employees') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_employees' }] };
    }
  );

  server.tool(
    'get_hr_employees',
    'Get a single record from hr_employees by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase.from('hr_employees').select(COLS_HR_EMPLOYEES).eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_employees') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_employees',
    'List records from hr_employees with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).optional().describe('Filter by status'),
      department_id: z.string().optional().describe('Filter by department UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, status, department_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('hr_employees').select(COLS_HR_EMPLOYEES).order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (status) query = query.eq('status', status);
      if (department_id) query = query.eq('department_id', department_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_employees') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 3. hr_employee_contracts
  // ================================================================

  server.tool(
    'create_hr_employee_contracts',
    'Create a new record in hr_employee_contracts',
    {
      company_id: z.string().describe('Company UUID'),
      employee_id: z.string().describe('Employee UUID'),
      contract_type: z.string().describe('Contract type (e.g. CDI, CDD)'),
      status: z
        .enum(['draft', 'signed', 'active', 'suspended', 'ended', 'cancelled'])
        .optional()
        .describe('Contract status'),
      start_date: z.string().describe('Contract start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('Contract end date (YYYY-MM-DD)'),
      pay_basis: z.enum(['hourly', 'daily', 'monthly', 'fixed']).optional().describe('Pay basis'),
      hourly_rate: z.number().optional().describe('Hourly rate'),
      monthly_salary: z.number().optional().describe('Monthly salary'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_employee_contracts')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_employee_contracts') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_employee_contracts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_employee_contracts',
    'Update an existing record in hr_employee_contracts',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      contract_type: z.string().optional().describe('Contract type (e.g. CDI, CDD)'),
      status: z
        .enum(['draft', 'signed', 'active', 'suspended', 'ended', 'cancelled'])
        .optional()
        .describe('Contract status'),
      start_date: z.string().optional().describe('Contract start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('Contract end date (YYYY-MM-DD)'),
      pay_basis: z.enum(['hourly', 'daily', 'monthly', 'fixed']).optional().describe('Pay basis'),
      hourly_rate: z.number().optional().describe('Hourly rate'),
      monthly_salary: z.number().optional().describe('Monthly salary'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_employee_contracts')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_employee_contracts') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_employee_contracts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_employee_contracts',
    'Delete a record from hr_employee_contracts',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_employee_contracts').delete().eq('id', id);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_employee_contracts') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_employee_contracts' }],
      };
    }
  );

  server.tool(
    'get_hr_employee_contracts',
    'Get a single record from hr_employee_contracts by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_employee_contracts')
        .select(COLS_HR_EMPLOYEE_CONTRACTS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_employee_contracts') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_employee_contracts',
    'List records from hr_employee_contracts with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      status: z
        .enum(['draft', 'signed', 'active', 'suspended', 'ended', 'cancelled'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, employee_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_employee_contracts')
        .select(COLS_HR_EMPLOYEE_CONTRACTS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_employee_contracts') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 4. hr_employee_skills
  // ================================================================

  server.tool(
    'create_hr_employee_skills',
    'Create a new record in hr_employee_skills',
    {
      company_id: z.string().describe('Company UUID'),
      employee_id: z.string().describe('Employee UUID'),
      skill_name: z.string().describe('Skill name'),
      skill_level: z.string().optional().describe('Skill level'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_employee_skills')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_employee_skills') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_employee_skills record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_employee_skills',
    'Update an existing record in hr_employee_skills',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      skill_name: z.string().optional().describe('Skill name'),
      skill_level: z.string().optional().describe('Skill level'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_employee_skills')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_employee_skills') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_employee_skills record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_employee_skills',
    'Delete a record from hr_employee_skills',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_employee_skills').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_employee_skills') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_employee_skills' }],
      };
    }
  );

  server.tool(
    'get_hr_employee_skills',
    'Get a single record from hr_employee_skills by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_employee_skills')
        .select(COLS_HR_EMPLOYEE_SKILLS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_employee_skills') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_employee_skills',
    'List records from hr_employee_skills with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, employee_id, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_employee_skills')
        .select(COLS_HR_EMPLOYEE_SKILLS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_employee_skills') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 5. hr_leave_types
  // ================================================================

  server.tool(
    'create_hr_leave_types',
    'Create a new record in hr_leave_types',
    {
      company_id: z.string().describe('Company UUID'),
      leave_code: z.string().describe('Leave type code'),
      name: z.string().describe('Leave type name'),
      is_paid: z.boolean().optional().describe('Whether this leave type is paid'),
      blocks_productive_time: z.boolean().optional().describe('Whether this blocks productive time'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_leave_types')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_leave_types') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_leave_types record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_leave_types',
    'Update an existing record in hr_leave_types',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      leave_code: z.string().optional().describe('Leave type code'),
      name: z.string().optional().describe('Leave type name'),
      is_paid: z.boolean().optional().describe('Whether this leave type is paid'),
      blocks_productive_time: z.boolean().optional().describe('Whether this blocks productive time'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_leave_types')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_leave_types') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_leave_types record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_leave_types',
    'Delete a record from hr_leave_types',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_leave_types').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_leave_types') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_leave_types' }],
      };
    }
  );

  server.tool(
    'get_hr_leave_types',
    'Get a single record from hr_leave_types by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase.from('hr_leave_types').select(COLS_HR_LEAVE_TYPES).eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_leave_types') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_leave_types',
    'List records from hr_leave_types with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('hr_leave_types').select(COLS_HR_LEAVE_TYPES).order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_leave_types') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 6. hr_leave_requests
  // ================================================================

  server.tool(
    'create_hr_leave_requests',
    'Create a new record in hr_leave_requests',
    {
      company_id: z.string().describe('Company UUID'),
      employee_id: z.string().describe('Employee UUID'),
      leave_type_id: z.string().describe('Leave type UUID'),
      start_date: z.string().describe('Leave start date (YYYY-MM-DD)'),
      end_date: z.string().describe('Leave end date (YYYY-MM-DD)'),
      total_days: z.number().optional().describe('Total days of leave'),
      status: z
        .enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled', 'validated'])
        .optional()
        .describe('Request status'),
      reason: z.string().optional().describe('Reason for leave'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_leave_requests') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_leave_requests record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_leave_requests',
    'Update an existing record in hr_leave_requests',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      leave_type_id: z.string().optional().describe('Leave type UUID'),
      start_date: z.string().optional().describe('Leave start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('Leave end date (YYYY-MM-DD)'),
      total_days: z.number().optional().describe('Total days of leave'),
      status: z
        .enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled', 'validated'])
        .optional()
        .describe('Request status'),
      reason: z.string().optional().describe('Reason for leave'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_leave_requests') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_leave_requests record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_leave_requests',
    'Delete a record from hr_leave_requests',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_leave_requests').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_leave_requests') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_leave_requests' }],
      };
    }
  );

  server.tool(
    'get_hr_leave_requests',
    'Get a single record from hr_leave_requests by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_leave_requests')
        .select(COLS_HR_LEAVE_REQUESTS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_leave_requests') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_leave_requests',
    'List records from hr_leave_requests with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      status: z
        .enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled', 'validated'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, employee_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_leave_requests')
        .select(COLS_HR_LEAVE_REQUESTS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_leave_requests') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 7. hr_work_calendars
  // ================================================================

  server.tool(
    'create_hr_work_calendars',
    'Create a new record in hr_work_calendars',
    {
      company_id: z.string().describe('Company UUID'),
      name: z.string().describe('Calendar name'),
      timezone: z.string().optional().describe('Timezone (e.g. Europe/Paris)'),
      weekly_target_minutes: z.number().int().optional().describe('Weekly target in minutes'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_work_calendars')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_work_calendars') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_work_calendars record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_work_calendars',
    'Update an existing record in hr_work_calendars',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      name: z.string().optional().describe('Calendar name'),
      timezone: z.string().optional().describe('Timezone (e.g. Europe/Paris)'),
      weekly_target_minutes: z.number().int().optional().describe('Weekly target in minutes'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_work_calendars')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_work_calendars') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_work_calendars record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_work_calendars',
    'Delete a record from hr_work_calendars',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_work_calendars').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_work_calendars') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_work_calendars' }],
      };
    }
  );

  server.tool(
    'get_hr_work_calendars',
    'Get a single record from hr_work_calendars by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_work_calendars')
        .select(COLS_HR_WORK_CALENDARS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_work_calendars') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_work_calendars',
    'List records from hr_work_calendars with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_work_calendars')
        .select(COLS_HR_WORK_CALENDARS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_work_calendars') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 8. hr_timesheet_periods
  // ================================================================

  server.tool(
    'create_hr_timesheet_periods',
    'Create a new record in hr_timesheet_periods',
    {
      company_id: z.string().describe('Company UUID'),
      employee_id: z.string().describe('Employee UUID'),
      period_start: z.string().describe('Period start date (YYYY-MM-DD)'),
      period_end: z.string().describe('Period end date (YYYY-MM-DD)'),
      period_type: z.enum(['weekly', 'monthly']).describe('Period type'),
      status: z
        .enum(['draft', 'submitted', 'approved_l1', 'approved_l2', 'validated', 'rejected', 'closed', 'reopened'])
        .optional()
        .describe('Period status'),
      submitted_at: z.string().optional().describe('Submission timestamp'),
      validated_at: z.string().optional().describe('Validation timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_timesheet_periods')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_timesheet_periods') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_timesheet_periods record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_timesheet_periods',
    'Update an existing record in hr_timesheet_periods',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      period_start: z.string().optional().describe('Period start date (YYYY-MM-DD)'),
      period_end: z.string().optional().describe('Period end date (YYYY-MM-DD)'),
      period_type: z.enum(['weekly', 'monthly']).optional().describe('Period type'),
      status: z
        .enum(['draft', 'submitted', 'approved_l1', 'approved_l2', 'validated', 'rejected', 'closed', 'reopened'])
        .optional()
        .describe('Period status'),
      submitted_at: z.string().optional().describe('Submission timestamp'),
      validated_at: z.string().optional().describe('Validation timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_timesheet_periods')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_timesheet_periods') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_timesheet_periods record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_timesheet_periods',
    'Delete a record from hr_timesheet_periods',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_timesheet_periods').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_timesheet_periods') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_timesheet_periods' }],
      };
    }
  );

  server.tool(
    'get_hr_timesheet_periods',
    'Get a single record from hr_timesheet_periods by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_timesheet_periods')
        .select(COLS_HR_TIMESHEET_PERIODS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_timesheet_periods') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_timesheet_periods',
    'List records from hr_timesheet_periods with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      status: z
        .enum(['draft', 'submitted', 'approved_l1', 'approved_l2', 'validated', 'rejected', 'closed', 'reopened'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, employee_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_timesheet_periods')
        .select(COLS_HR_TIMESHEET_PERIODS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_timesheet_periods') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 9. hr_timesheet_lines
  // ================================================================

  server.tool(
    'create_hr_timesheet_lines',
    'Create a new record in hr_timesheet_lines',
    {
      company_id: z.string().describe('Company UUID'),
      timesheet_period_id: z.string().describe('Timesheet period UUID'),
      employee_id: z.string().describe('Employee UUID'),
      work_date: z.string().describe('Work date (YYYY-MM-DD)'),
      project_id: z.string().optional().describe('Project UUID'),
      task_id: z.string().optional().describe('Task UUID'),
      cost_center_id: z.string().optional().describe('Cost center UUID'),
      service_id: z.string().optional().describe('Service UUID'),
      line_type: z
        .enum(['work', 'overtime', 'night', 'weekend', 'holiday', 'absence', 'on_call', 'travel', 'non_productive'])
        .optional()
        .describe('Line type'),
      duration_minutes: z.number().int().optional().describe('Duration in minutes'),
      billable: z.boolean().optional().describe('Whether billable'),
      billable_rate: z.number().optional().describe('Billable rate'),
      notes: z.string().optional().describe('Notes'),
      source_leave_request_id: z.string().optional().describe('Source leave request UUID'),
      legacy_timesheet_id: z.string().optional().describe('Legacy timesheet UUID'),
      status: z
        .enum(['draft', 'submitted', 'approved', 'rejected', 'closed', 'validated'])
        .optional()
        .describe('Line status'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_timesheet_lines')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_timesheet_lines') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_timesheet_lines record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_timesheet_lines',
    'Update an existing record in hr_timesheet_lines',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      timesheet_period_id: z.string().optional().describe('Timesheet period UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      work_date: z.string().optional().describe('Work date (YYYY-MM-DD)'),
      project_id: z.string().optional().describe('Project UUID'),
      task_id: z.string().optional().describe('Task UUID'),
      cost_center_id: z.string().optional().describe('Cost center UUID'),
      service_id: z.string().optional().describe('Service UUID'),
      line_type: z
        .enum(['work', 'overtime', 'night', 'weekend', 'holiday', 'absence', 'on_call', 'travel', 'non_productive'])
        .optional()
        .describe('Line type'),
      duration_minutes: z.number().int().optional().describe('Duration in minutes'),
      billable: z.boolean().optional().describe('Whether billable'),
      billable_rate: z.number().optional().describe('Billable rate'),
      notes: z.string().optional().describe('Notes'),
      source_leave_request_id: z.string().optional().describe('Source leave request UUID'),
      legacy_timesheet_id: z.string().optional().describe('Legacy timesheet UUID'),
      status: z
        .enum(['draft', 'submitted', 'approved', 'rejected', 'closed', 'validated'])
        .optional()
        .describe('Line status'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_timesheet_lines')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_timesheet_lines') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_timesheet_lines record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_timesheet_lines',
    'Delete a record from hr_timesheet_lines',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_timesheet_lines').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_timesheet_lines') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_timesheet_lines' }],
      };
    }
  );

  server.tool(
    'get_hr_timesheet_lines',
    'Get a single record from hr_timesheet_lines by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_timesheet_lines')
        .select(COLS_HR_TIMESHEET_LINES)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_timesheet_lines') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_timesheet_lines',
    'List records from hr_timesheet_lines with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      timesheet_period_id: z.string().optional().describe('Filter by timesheet period UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      status: z
        .enum(['draft', 'submitted', 'approved', 'rejected', 'closed', 'validated'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, timesheet_period_id, employee_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_timesheet_lines')
        .select(COLS_HR_TIMESHEET_LINES)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (timesheet_period_id) query = query.eq('timesheet_period_id', timesheet_period_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_timesheet_lines') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 10. hr_timesheet_approvals
  // ================================================================

  server.tool(
    'create_hr_timesheet_approvals',
    'Create a new record in hr_timesheet_approvals',
    {
      company_id: z.string().describe('Company UUID'),
      timesheet_period_id: z.string().describe('Timesheet period UUID'),
      approval_level: z.number().int().describe('Approval level'),
      approver_employee_id: z.string().describe('Approver employee UUID'),
      decision: z.enum(['submitted', 'approved', 'rejected', 'reopened']).describe('Decision'),
      comment: z.string().optional().describe('Comment'),
      decided_at: z.string().optional().describe('Decision timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_timesheet_approvals')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_timesheet_approvals') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_timesheet_approvals record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_timesheet_approvals',
    'Update an existing record in hr_timesheet_approvals',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      timesheet_period_id: z.string().optional().describe('Timesheet period UUID'),
      approval_level: z.number().int().optional().describe('Approval level'),
      approver_employee_id: z.string().optional().describe('Approver employee UUID'),
      decision: z.enum(['submitted', 'approved', 'rejected', 'reopened']).optional().describe('Decision'),
      comment: z.string().optional().describe('Comment'),
      decided_at: z.string().optional().describe('Decision timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_timesheet_approvals')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_timesheet_approvals') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_timesheet_approvals record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_timesheet_approvals',
    'Delete a record from hr_timesheet_approvals',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_timesheet_approvals').delete().eq('id', id);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_timesheet_approvals') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_timesheet_approvals' },
        ],
      };
    }
  );

  server.tool(
    'get_hr_timesheet_approvals',
    'Get a single record from hr_timesheet_approvals by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_timesheet_approvals')
        .select(COLS_HR_TIMESHEET_APPROVALS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_timesheet_approvals') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_timesheet_approvals',
    'List records from hr_timesheet_approvals with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      timesheet_period_id: z.string().optional().describe('Filter by timesheet period UUID'),
      approver_employee_id: z.string().optional().describe('Filter by approver UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, timesheet_period_id, approver_employee_id, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_timesheet_approvals')
        .select(COLS_HR_TIMESHEET_APPROVALS)
        .order('decided_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (timesheet_period_id) query = query.eq('timesheet_period_id', timesheet_period_id);
      if (approver_employee_id) query = query.eq('approver_employee_id', approver_employee_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_timesheet_approvals') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 11. hr_payroll_periods
  // ================================================================

  server.tool(
    'create_hr_payroll_periods',
    'Create a new record in hr_payroll_periods',
    {
      company_id: z.string().describe('Company UUID'),
      period_start: z.string().describe('Period start date (YYYY-MM-DD)'),
      period_end: z.string().describe('Period end date (YYYY-MM-DD)'),
      status: z
        .enum(['open', 'calculating', 'calculated', 'under_review', 'validated', 'exported', 'closed', 'reopened'])
        .optional()
        .describe('Period status'),
      calculation_version: z.number().int().optional().describe('Calculation version'),
      calculated_at: z.string().optional().describe('Calculation timestamp'),
      validated_at: z.string().optional().describe('Validation timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_payroll_periods')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_payroll_periods') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_payroll_periods record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_payroll_periods',
    'Update an existing record in hr_payroll_periods',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      period_start: z.string().optional().describe('Period start date (YYYY-MM-DD)'),
      period_end: z.string().optional().describe('Period end date (YYYY-MM-DD)'),
      status: z
        .enum(['open', 'calculating', 'calculated', 'under_review', 'validated', 'exported', 'closed', 'reopened'])
        .optional()
        .describe('Period status'),
      calculation_version: z.number().int().optional().describe('Calculation version'),
      calculated_at: z.string().optional().describe('Calculation timestamp'),
      validated_at: z.string().optional().describe('Validation timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_payroll_periods')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_payroll_periods') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_payroll_periods record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_payroll_periods',
    'Delete a record from hr_payroll_periods',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_payroll_periods').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_payroll_periods') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_payroll_periods' }],
      };
    }
  );

  server.tool(
    'get_hr_payroll_periods',
    'Get a single record from hr_payroll_periods by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_payroll_periods')
        .select(COLS_HR_PAYROLL_PERIODS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_payroll_periods') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_payroll_periods',
    'List records from hr_payroll_periods with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      status: z
        .enum(['open', 'calculating', 'calculated', 'under_review', 'validated', 'exported', 'closed', 'reopened'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_payroll_periods')
        .select(COLS_HR_PAYROLL_PERIODS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_payroll_periods') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 12. hr_payroll_variable_items
  // ================================================================

  server.tool(
    'create_hr_payroll_variable_items',
    'Create a new record in hr_payroll_variable_items',
    {
      company_id: z.string().describe('Company UUID'),
      payroll_period_id: z.string().describe('Payroll period UUID'),
      employee_id: z.string().describe('Employee UUID'),
      item_code: z.string().describe('Item code'),
      item_label: z.string().optional().describe('Item label'),
      item_category: z
        .enum([
          'normal_hours',
          'overtime',
          'night',
          'weekend',
          'holiday',
          'bonus',
          'allowance',
          'deduction',
          'unpaid_leave',
          'other',
        ])
        .optional()
        .describe('Item category'),
      quantity: z.number().optional().describe('Quantity'),
      rate: z.number().optional().describe('Rate'),
      amount: z.number().optional().describe('Amount'),
      currency: z.string().optional().describe('Currency code (3 chars)'),
      source_timesheet_line_id: z.string().optional().describe('Source timesheet line UUID'),
      source_leave_request_id: z.string().optional().describe('Source leave request UUID'),
      metadata: z.any().optional().describe('Additional metadata (JSONB)'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_payroll_variable_items')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_payroll_variable_items') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_payroll_variable_items record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_payroll_variable_items',
    'Update an existing record in hr_payroll_variable_items',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      payroll_period_id: z.string().optional().describe('Payroll period UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      item_code: z.string().optional().describe('Item code'),
      item_label: z.string().optional().describe('Item label'),
      item_category: z
        .enum([
          'normal_hours',
          'overtime',
          'night',
          'weekend',
          'holiday',
          'bonus',
          'allowance',
          'deduction',
          'unpaid_leave',
          'other',
        ])
        .optional()
        .describe('Item category'),
      quantity: z.number().optional().describe('Quantity'),
      rate: z.number().optional().describe('Rate'),
      amount: z.number().optional().describe('Amount'),
      currency: z.string().optional().describe('Currency code (3 chars)'),
      source_timesheet_line_id: z.string().optional().describe('Source timesheet line UUID'),
      source_leave_request_id: z.string().optional().describe('Source leave request UUID'),
      metadata: z.any().optional().describe('Additional metadata (JSONB)'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_payroll_variable_items')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_payroll_variable_items') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_payroll_variable_items record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_payroll_variable_items',
    'Delete a record from hr_payroll_variable_items',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_payroll_variable_items').delete().eq('id', id);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_payroll_variable_items') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_payroll_variable_items' },
        ],
      };
    }
  );

  server.tool(
    'get_hr_payroll_variable_items',
    'Get a single record from hr_payroll_variable_items by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_payroll_variable_items')
        .select(COLS_HR_PAYROLL_VARIABLE_ITEMS)
        .eq('id', id)
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_payroll_variable_items') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_payroll_variable_items',
    'List records from hr_payroll_variable_items with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      payroll_period_id: z.string().optional().describe('Filter by payroll period UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      item_category: z
        .enum([
          'normal_hours',
          'overtime',
          'night',
          'weekend',
          'holiday',
          'bonus',
          'allowance',
          'deduction',
          'unpaid_leave',
          'other',
        ])
        .optional()
        .describe('Filter by item category'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, payroll_period_id, employee_id, item_category, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_payroll_variable_items')
        .select(COLS_HR_PAYROLL_VARIABLE_ITEMS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (payroll_period_id) query = query.eq('payroll_period_id', payroll_period_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (item_category) query = query.eq('item_category', item_category);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_payroll_variable_items') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 13. hr_payroll_exports
  // ================================================================

  server.tool(
    'create_hr_payroll_exports',
    'Create a new record in hr_payroll_exports',
    {
      company_id: z.string().describe('Company UUID'),
      payroll_period_id: z.string().describe('Payroll period UUID'),
      export_format: z.string().describe('Export format'),
      export_status: z
        .enum(['generated', 'downloaded', 'transmitted', 'cancelled'])
        .optional()
        .describe('Export status'),
      version: z.number().int().optional().describe('Version number'),
      file_url: z.string().optional().describe('File URL'),
      generated_by: z.string().optional().describe('Generated by user/system'),
      generated_at: z.string().optional().describe('Generation timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_payroll_exports')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_payroll_exports') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_payroll_exports record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_payroll_exports',
    'Update an existing record in hr_payroll_exports',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      payroll_period_id: z.string().optional().describe('Payroll period UUID'),
      export_format: z.string().optional().describe('Export format'),
      export_status: z
        .enum(['generated', 'downloaded', 'transmitted', 'cancelled'])
        .optional()
        .describe('Export status'),
      version: z.number().int().optional().describe('Version number'),
      file_url: z.string().optional().describe('File URL'),
      generated_by: z.string().optional().describe('Generated by user/system'),
      generated_at: z.string().optional().describe('Generation timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_payroll_exports')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_payroll_exports') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_payroll_exports record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_payroll_exports',
    'Delete a record from hr_payroll_exports',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_payroll_exports').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_payroll_exports') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_payroll_exports' }],
      };
    }
  );

  server.tool(
    'get_hr_payroll_exports',
    'Get a single record from hr_payroll_exports by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_payroll_exports')
        .select(COLS_HR_PAYROLL_EXPORTS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_payroll_exports') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_payroll_exports',
    'List records from hr_payroll_exports with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      payroll_period_id: z.string().optional().describe('Filter by payroll period UUID'),
      export_status: z
        .enum(['generated', 'downloaded', 'transmitted', 'cancelled'])
        .optional()
        .describe('Filter by export status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, payroll_period_id, export_status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_payroll_exports')
        .select(COLS_HR_PAYROLL_EXPORTS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (payroll_period_id) query = query.eq('payroll_period_id', payroll_period_id);
      if (export_status) query = query.eq('export_status', export_status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_payroll_exports') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 14. hr_payroll_anomalies
  // ================================================================

  server.tool(
    'create_hr_payroll_anomalies',
    'Create a new record in hr_payroll_anomalies',
    {
      company_id: z.string().describe('Company UUID'),
      payroll_period_id: z.string().describe('Payroll period UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      anomaly_code: z.string().describe('Anomaly code'),
      severity: z.enum(['info', 'warning', 'blocking']).describe('Severity level'),
      message: z.string().describe('Anomaly message'),
      details: z.any().optional().describe('Additional details (JSONB)'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_payroll_anomalies')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_payroll_anomalies') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_payroll_anomalies record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_payroll_anomalies',
    'Update an existing record in hr_payroll_anomalies',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      payroll_period_id: z.string().optional().describe('Payroll period UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      anomaly_code: z.string().optional().describe('Anomaly code'),
      severity: z.enum(['info', 'warning', 'blocking']).optional().describe('Severity level'),
      message: z.string().optional().describe('Anomaly message'),
      details: z.any().optional().describe('Additional details (JSONB)'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_payroll_anomalies')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_payroll_anomalies') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_payroll_anomalies record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_payroll_anomalies',
    'Delete a record from hr_payroll_anomalies',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_payroll_anomalies').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_payroll_anomalies') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_payroll_anomalies' }],
      };
    }
  );

  server.tool(
    'get_hr_payroll_anomalies',
    'Get a single record from hr_payroll_anomalies by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_payroll_anomalies')
        .select(COLS_HR_PAYROLL_ANOMALIES)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_payroll_anomalies') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_payroll_anomalies',
    'List records from hr_payroll_anomalies with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      payroll_period_id: z.string().optional().describe('Filter by payroll period UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      severity: z.enum(['info', 'warning', 'blocking']).optional().describe('Filter by severity'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, payroll_period_id, employee_id, severity, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_payroll_anomalies')
        .select(COLS_HR_PAYROLL_ANOMALIES)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (payroll_period_id) query = query.eq('payroll_period_id', payroll_period_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (severity) query = query.eq('severity', severity);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_payroll_anomalies') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 15. hr_training_catalog
  // ================================================================

  server.tool(
    'create_hr_training_catalog',
    'Create a new record in hr_training_catalog',
    {
      company_id: z.string().describe('Company UUID'),
      title: z.string().describe('Training title'),
      description: z.string().optional().describe('Training description'),
      provider: z.string().optional().describe('Provider name'),
      provider_type: z.string().optional().describe('Provider type'),
      format: z.string().optional().describe('Training format'),
      duration_hours: z.number().optional().describe('Duration in hours'),
      cost_per_person: z.number().optional().describe('Cost per person'),
      currency: z.string().optional().describe('Currency code (3 chars)'),
      skills_covered: z.any().optional().describe('Skills covered (JSONB)'),
      is_mandatory: z.boolean().optional().describe('Whether mandatory'),
      cpf_eligible: z.boolean().optional().describe('CPF eligible'),
      opco_eligible: z.boolean().optional().describe('OPCO eligible'),
      certification_name: z.string().optional().describe('Certification name'),
      passing_score: z.number().optional().describe('Passing score'),
      validity_months: z.number().int().optional().describe('Validity in months'),
      tags: z.any().optional().describe('Tags (JSONB)'),
      is_active: z.boolean().optional().describe('Whether active'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_training_catalog')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_training_catalog') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_training_catalog record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_training_catalog',
    'Update an existing record in hr_training_catalog',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      title: z.string().optional().describe('Training title'),
      description: z.string().optional().describe('Training description'),
      provider: z.string().optional().describe('Provider name'),
      provider_type: z.string().optional().describe('Provider type'),
      format: z.string().optional().describe('Training format'),
      duration_hours: z.number().optional().describe('Duration in hours'),
      cost_per_person: z.number().optional().describe('Cost per person'),
      currency: z.string().optional().describe('Currency code (3 chars)'),
      skills_covered: z.any().optional().describe('Skills covered (JSONB)'),
      is_mandatory: z.boolean().optional().describe('Whether mandatory'),
      cpf_eligible: z.boolean().optional().describe('CPF eligible'),
      opco_eligible: z.boolean().optional().describe('OPCO eligible'),
      certification_name: z.string().optional().describe('Certification name'),
      passing_score: z.number().optional().describe('Passing score'),
      validity_months: z.number().int().optional().describe('Validity in months'),
      tags: z.any().optional().describe('Tags (JSONB)'),
      is_active: z.boolean().optional().describe('Whether active'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_training_catalog')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_training_catalog') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_training_catalog record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_training_catalog',
    'Delete a record from hr_training_catalog',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_training_catalog').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_training_catalog') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_training_catalog' }],
      };
    }
  );

  server.tool(
    'get_hr_training_catalog',
    'Get a single record from hr_training_catalog by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_training_catalog')
        .select(COLS_HR_TRAINING_CATALOG)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_training_catalog') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_training_catalog',
    'List records from hr_training_catalog with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      is_mandatory: z.boolean().optional().describe('Filter by mandatory status'),
      is_active: z.boolean().optional().describe('Filter by active status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, is_mandatory, is_active, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_training_catalog')
        .select(COLS_HR_TRAINING_CATALOG)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (is_mandatory) query = query.eq('is_mandatory', is_mandatory);
      if (is_active) query = query.eq('is_active', is_active);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_training_catalog') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 16. hr_training_enrollments
  // ================================================================

  server.tool(
    'create_hr_training_enrollments',
    'Create a new record in hr_training_enrollments',
    {
      company_id: z.string().describe('Company UUID'),
      training_id: z.string().describe('Training catalog UUID'),
      employee_id: z.string().describe('Employee UUID'),
      training_plan_id: z.string().optional().describe('Training plan UUID'),
      status: z
        .enum(['enrolled', 'in_progress', 'completed', 'cancelled', 'passed', 'failed'])
        .optional()
        .describe('Enrollment status'),
      planned_start_date: z.string().optional().describe('Planned start date (YYYY-MM-DD)'),
      planned_end_date: z.string().optional().describe('Planned end date (YYYY-MM-DD)'),
      actual_start_date: z.string().optional().describe('Actual start date (YYYY-MM-DD)'),
      actual_end_date: z.string().optional().describe('Actual end date (YYYY-MM-DD)'),
      score: z.number().optional().describe('Score'),
      passed: z.boolean().optional().describe('Whether passed'),
      certificate_url: z.string().optional().describe('Certificate URL'),
      certificate_expiry: z.string().optional().describe('Certificate expiry date'),
      actual_cost: z.number().optional().describe('Actual cost'),
      funded_by: z.string().optional().describe('Funded by'),
      cpf_hours_used: z.number().optional().describe('CPF hours used'),
      rating_hot: z.number().optional().describe('Hot rating'),
      rating_cold: z.number().optional().describe('Cold rating'),
      feedback_comment: z.string().optional().describe('Feedback comment'),
      completed_at: z.string().optional().describe('Completion timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_training_enrollments')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_training_enrollments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_training_enrollments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_training_enrollments',
    'Update an existing record in hr_training_enrollments',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      training_id: z.string().optional().describe('Training catalog UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      training_plan_id: z.string().optional().describe('Training plan UUID'),
      status: z
        .enum(['enrolled', 'in_progress', 'completed', 'cancelled', 'passed', 'failed'])
        .optional()
        .describe('Enrollment status'),
      planned_start_date: z.string().optional().describe('Planned start date (YYYY-MM-DD)'),
      planned_end_date: z.string().optional().describe('Planned end date (YYYY-MM-DD)'),
      actual_start_date: z.string().optional().describe('Actual start date (YYYY-MM-DD)'),
      actual_end_date: z.string().optional().describe('Actual end date (YYYY-MM-DD)'),
      score: z.number().optional().describe('Score'),
      passed: z.boolean().optional().describe('Whether passed'),
      certificate_url: z.string().optional().describe('Certificate URL'),
      certificate_expiry: z.string().optional().describe('Certificate expiry date'),
      actual_cost: z.number().optional().describe('Actual cost'),
      funded_by: z.string().optional().describe('Funded by'),
      cpf_hours_used: z.number().optional().describe('CPF hours used'),
      rating_hot: z.number().optional().describe('Hot rating'),
      rating_cold: z.number().optional().describe('Cold rating'),
      feedback_comment: z.string().optional().describe('Feedback comment'),
      completed_at: z.string().optional().describe('Completion timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_training_enrollments')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_training_enrollments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_training_enrollments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_training_enrollments',
    'Delete a record from hr_training_enrollments',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_training_enrollments').delete().eq('id', id);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_training_enrollments') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_training_enrollments' },
        ],
      };
    }
  );

  server.tool(
    'get_hr_training_enrollments',
    'Get a single record from hr_training_enrollments by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_training_enrollments')
        .select(COLS_HR_TRAINING_ENROLLMENTS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_training_enrollments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_training_enrollments',
    'List records from hr_training_enrollments with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      training_id: z.string().optional().describe('Filter by training UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      status: z
        .enum(['enrolled', 'in_progress', 'completed', 'cancelled', 'passed', 'failed'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, training_id, employee_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_training_enrollments')
        .select(COLS_HR_TRAINING_ENROLLMENTS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (training_id) query = query.eq('training_id', training_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_training_enrollments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 17. hr_skill_assessments
  // ================================================================

  server.tool(
    'create_hr_skill_assessments',
    'Create a new record in hr_skill_assessments',
    {
      company_id: z.string().describe('Company UUID'),
      employee_id: z.string().describe('Employee UUID'),
      skill_name: z.string().describe('Skill name'),
      skill_category: z.string().optional().describe('Skill category'),
      required_level: z.number().optional().describe('Required level'),
      current_level: z.number().optional().describe('Current level'),
      target_level: z.number().optional().describe('Target level'),
      gap: z.number().optional().describe('Gap between current and required'),
      assessed_by: z.string().optional().describe('Assessed by (employee UUID)'),
      assessment_method: z.string().optional().describe('Assessment method'),
      assessed_at: z.string().optional().describe('Assessment timestamp'),
      next_assessment_date: z.string().optional().describe('Next assessment date'),
      notes: z.string().optional().describe('Notes'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_skill_assessments')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_skill_assessments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_skill_assessments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_skill_assessments',
    'Update an existing record in hr_skill_assessments',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      skill_name: z.string().optional().describe('Skill name'),
      skill_category: z.string().optional().describe('Skill category'),
      required_level: z.number().optional().describe('Required level'),
      current_level: z.number().optional().describe('Current level'),
      target_level: z.number().optional().describe('Target level'),
      gap: z.number().optional().describe('Gap between current and required'),
      assessed_by: z.string().optional().describe('Assessed by (employee UUID)'),
      assessment_method: z.string().optional().describe('Assessment method'),
      assessed_at: z.string().optional().describe('Assessment timestamp'),
      next_assessment_date: z.string().optional().describe('Next assessment date'),
      notes: z.string().optional().describe('Notes'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_skill_assessments')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_skill_assessments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_skill_assessments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_skill_assessments',
    'Delete a record from hr_skill_assessments',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_skill_assessments').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_skill_assessments') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_skill_assessments' }],
      };
    }
  );

  server.tool(
    'get_hr_skill_assessments',
    'Get a single record from hr_skill_assessments by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_skill_assessments')
        .select(COLS_HR_SKILL_ASSESSMENTS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_skill_assessments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_skill_assessments',
    'List records from hr_skill_assessments with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      skill_category: z.string().optional().describe('Filter by skill category'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, employee_id, skill_category, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_skill_assessments')
        .select(COLS_HR_SKILL_ASSESSMENTS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (skill_category) query = query.eq('skill_category', skill_category);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_skill_assessments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 18. hr_performance_reviews
  // ================================================================

  server.tool(
    'create_hr_performance_reviews',
    'Create a new record in hr_performance_reviews',
    {
      company_id: z.string().describe('Company UUID'),
      employee_id: z.string().describe('Employee UUID'),
      reviewer_id: z.string().optional().describe('Reviewer employee UUID'),
      period_year: z.number().int().describe('Period year'),
      period_label: z.string().optional().describe('Period label'),
      review_type: z.string().optional().describe('Review type'),
      status: z
        .enum(['draft', 'self_assessment_done', 'manager_review_done', 'signed', 'cancelled'])
        .optional()
        .describe('Review status'),
      objectives: z.any().optional().describe('Objectives (JSONB)'),
      competencies: z.any().optional().describe('Competencies (JSONB)'),
      overall_score: z.number().optional().describe('Overall score'),
      performance_rating: z.string().optional().describe('Performance rating'),
      nine_box_performance: z.string().optional().describe('9-box performance'),
      nine_box_potential: z.string().optional().describe('9-box potential'),
      employee_comment: z.string().optional().describe('Employee comment'),
      hr_comment: z.string().optional().describe('HR comment'),
      development_plan: z.any().optional().describe('Development plan (JSONB)'),
      employee_signed_at: z.string().optional().describe('Employee signature timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_performance_reviews')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_performance_reviews') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_performance_reviews record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_performance_reviews',
    'Update an existing record in hr_performance_reviews',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      reviewer_id: z.string().optional().describe('Reviewer employee UUID'),
      period_year: z.number().int().optional().describe('Period year'),
      period_label: z.string().optional().describe('Period label'),
      review_type: z.string().optional().describe('Review type'),
      status: z
        .enum(['draft', 'self_assessment_done', 'manager_review_done', 'signed', 'cancelled'])
        .optional()
        .describe('Review status'),
      objectives: z.any().optional().describe('Objectives (JSONB)'),
      competencies: z.any().optional().describe('Competencies (JSONB)'),
      overall_score: z.number().optional().describe('Overall score'),
      performance_rating: z.string().optional().describe('Performance rating'),
      nine_box_performance: z.string().optional().describe('9-box performance'),
      nine_box_potential: z.string().optional().describe('9-box potential'),
      employee_comment: z.string().optional().describe('Employee comment'),
      hr_comment: z.string().optional().describe('HR comment'),
      development_plan: z.any().optional().describe('Development plan (JSONB)'),
      employee_signed_at: z.string().optional().describe('Employee signature timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_performance_reviews')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_performance_reviews') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_performance_reviews record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_performance_reviews',
    'Delete a record from hr_performance_reviews',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_performance_reviews').delete().eq('id', id);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_performance_reviews') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_performance_reviews' },
        ],
      };
    }
  );

  server.tool(
    'get_hr_performance_reviews',
    'Get a single record from hr_performance_reviews by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_performance_reviews')
        .select(COLS_HR_PERFORMANCE_REVIEWS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_performance_reviews') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_performance_reviews',
    'List records from hr_performance_reviews with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      period_year: z.number().int().optional().describe('Filter by period year'),
      status: z
        .enum(['draft', 'self_assessment_done', 'manager_review_done', 'signed', 'cancelled'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, employee_id, period_year, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_performance_reviews')
        .select(COLS_HR_PERFORMANCE_REVIEWS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (period_year) query = query.eq('period_year', period_year);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_performance_reviews') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 19. hr_succession_plans
  // ================================================================

  server.tool(
    'create_hr_succession_plans',
    'Create a new record in hr_succession_plans',
    {
      company_id: z.string().describe('Company UUID'),
      position_id: z.string().optional().describe('Position UUID'),
      position_title: z.string().describe('Position title'),
      incumbent_id: z.string().optional().describe('Incumbent employee UUID'),
      successor_id: z.string().optional().describe('Successor employee UUID'),
      readiness_level: z.string().optional().describe('Readiness level'),
      nine_box_performance: z.string().optional().describe('9-box performance'),
      nine_box_potential: z.string().optional().describe('9-box potential'),
      risk_of_loss: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Risk of loss'),
      development_actions: z.string().optional().describe('Development actions'),
      notes: z.string().optional().describe('Notes'),
      reviewed_at: z.string().optional().describe('Last review timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_succession_plans')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_succession_plans') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_succession_plans record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_succession_plans',
    'Update an existing record in hr_succession_plans',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      position_id: z.string().optional().describe('Position UUID'),
      position_title: z.string().optional().describe('Position title'),
      incumbent_id: z.string().optional().describe('Incumbent employee UUID'),
      successor_id: z.string().optional().describe('Successor employee UUID'),
      readiness_level: z.string().optional().describe('Readiness level'),
      nine_box_performance: z.string().optional().describe('9-box performance'),
      nine_box_potential: z.string().optional().describe('9-box potential'),
      risk_of_loss: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Risk of loss'),
      development_actions: z.string().optional().describe('Development actions'),
      notes: z.string().optional().describe('Notes'),
      reviewed_at: z.string().optional().describe('Last review timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_succession_plans')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_succession_plans') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_succession_plans record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_succession_plans',
    'Delete a record from hr_succession_plans',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_succession_plans').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_succession_plans') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_succession_plans' }],
      };
    }
  );

  server.tool(
    'get_hr_succession_plans',
    'Get a single record from hr_succession_plans by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_succession_plans')
        .select(COLS_HR_SUCCESSION_PLANS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_succession_plans') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_succession_plans',
    'List records from hr_succession_plans with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      risk_of_loss: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by risk of loss'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, risk_of_loss, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_succession_plans')
        .select(COLS_HR_SUCCESSION_PLANS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (risk_of_loss) query = query.eq('risk_of_loss', risk_of_loss);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_succession_plans') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 20. hr_headcount_budgets
  // ================================================================

  server.tool(
    'create_hr_headcount_budgets',
    'Create a new record in hr_headcount_budgets',
    {
      company_id: z.string().describe('Company UUID'),
      fiscal_year: z.number().int().describe('Fiscal year'),
      department_id: z.string().optional().describe('Department UUID'),
      budgeted_headcount: z.number().int().optional().describe('Budgeted headcount'),
      actual_headcount: z.number().int().optional().describe('Actual headcount'),
      budgeted_fte: z.number().optional().describe('Budgeted FTE'),
      actual_fte: z.number().optional().describe('Actual FTE'),
      budgeted_payroll_cost: z.number().optional().describe('Budgeted payroll cost'),
      actual_payroll_cost: z.number().optional().describe('Actual payroll cost'),
      currency: z.string().optional().describe('Currency code (3 chars)'),
      planned_hires: z.number().int().optional().describe('Planned hires'),
      planned_exits: z.number().int().optional().describe('Planned exits'),
      planned_promotions: z.number().int().optional().describe('Planned promotions'),
      version: z.number().int().optional().describe('Version number'),
      status: z.enum(['draft', 'under_review', 'approved', 'locked', 'closed']).optional().describe('Budget status'),
      notes: z.string().optional().describe('Notes'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_headcount_budgets')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_headcount_budgets') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_headcount_budgets record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_headcount_budgets',
    'Update an existing record in hr_headcount_budgets',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      fiscal_year: z.number().int().optional().describe('Fiscal year'),
      department_id: z.string().optional().describe('Department UUID'),
      budgeted_headcount: z.number().int().optional().describe('Budgeted headcount'),
      actual_headcount: z.number().int().optional().describe('Actual headcount'),
      budgeted_fte: z.number().optional().describe('Budgeted FTE'),
      actual_fte: z.number().optional().describe('Actual FTE'),
      budgeted_payroll_cost: z.number().optional().describe('Budgeted payroll cost'),
      actual_payroll_cost: z.number().optional().describe('Actual payroll cost'),
      currency: z.string().optional().describe('Currency code (3 chars)'),
      planned_hires: z.number().int().optional().describe('Planned hires'),
      planned_exits: z.number().int().optional().describe('Planned exits'),
      planned_promotions: z.number().int().optional().describe('Planned promotions'),
      version: z.number().int().optional().describe('Version number'),
      status: z.enum(['draft', 'under_review', 'approved', 'locked', 'closed']).optional().describe('Budget status'),
      notes: z.string().optional().describe('Notes'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_headcount_budgets')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_headcount_budgets') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_headcount_budgets record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_headcount_budgets',
    'Delete a record from hr_headcount_budgets',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_headcount_budgets').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_headcount_budgets') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_headcount_budgets' }],
      };
    }
  );

  server.tool(
    'get_hr_headcount_budgets',
    'Get a single record from hr_headcount_budgets by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_headcount_budgets')
        .select(COLS_HR_HEADCOUNT_BUDGETS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_headcount_budgets') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_headcount_budgets',
    'List records from hr_headcount_budgets with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      fiscal_year: z.number().int().optional().describe('Filter by fiscal year'),
      department_id: z.string().optional().describe('Filter by department UUID'),
      status: z.enum(['draft', 'under_review', 'approved', 'locked', 'closed']).optional().describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, fiscal_year, department_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_headcount_budgets')
        .select(COLS_HR_HEADCOUNT_BUDGETS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (fiscal_year) query = query.eq('fiscal_year', fiscal_year);
      if (department_id) query = query.eq('department_id', department_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_headcount_budgets') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 21. hr_surveys
  // ================================================================

  server.tool(
    'create_hr_surveys',
    'Create a new record in hr_surveys',
    {
      company_id: z.string().describe('Company UUID'),
      title: z.string().describe('Survey title'),
      survey_type: z.enum(['engagement', 'satisfaction', 'nps', 'climate', 'qvt', 'custom']).describe('Survey type'),
      status: z.enum(['draft', 'active', 'closed', 'archived']).optional().describe('Survey status'),
      questions: z.any().optional().describe('Questions (JSONB)'),
      target_audience: z.string().optional().describe('Target audience'),
      anonymous: z.boolean().optional().describe('Whether anonymous'),
      allow_partial: z.boolean().optional().describe('Allow partial responses'),
      response_count: z.number().int().optional().describe('Response count'),
      enps_score: z.number().optional().describe('eNPS score'),
      avg_satisfaction: z.number().optional().describe('Average satisfaction'),
      ai_analysis: z.any().optional().describe('AI analysis (JSONB)'),
      starts_at: z.string().optional().describe('Start timestamp'),
      ends_at: z.string().optional().describe('End timestamp'),
      reminder_at: z.string().optional().describe('Reminder timestamp'),
      created_by: z.string().optional().describe('Created by user UUID'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_surveys')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_surveys') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created hr_surveys record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_hr_surveys',
    'Update an existing record in hr_surveys',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      title: z.string().optional().describe('Survey title'),
      survey_type: z
        .enum(['engagement', 'satisfaction', 'nps', 'climate', 'qvt', 'custom'])
        .optional()
        .describe('Survey type'),
      status: z.enum(['draft', 'active', 'closed', 'archived']).optional().describe('Survey status'),
      questions: z.any().optional().describe('Questions (JSONB)'),
      target_audience: z.string().optional().describe('Target audience'),
      anonymous: z.boolean().optional().describe('Whether anonymous'),
      allow_partial: z.boolean().optional().describe('Allow partial responses'),
      response_count: z.number().int().optional().describe('Response count'),
      enps_score: z.number().optional().describe('eNPS score'),
      avg_satisfaction: z.number().optional().describe('Average satisfaction'),
      ai_analysis: z.any().optional().describe('AI analysis (JSONB)'),
      starts_at: z.string().optional().describe('Start timestamp'),
      ends_at: z.string().optional().describe('End timestamp'),
      reminder_at: z.string().optional().describe('Reminder timestamp'),
      created_by: z.string().optional().describe('Created by user UUID'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_surveys')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_surveys') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated hr_surveys record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_surveys',
    'Delete a record from hr_surveys',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_surveys').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_surveys') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_surveys' }] };
    }
  );

  server.tool(
    'get_hr_surveys',
    'Get a single record from hr_surveys by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase.from('hr_surveys').select(COLS_HR_SURVEYS).eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_surveys') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_surveys',
    'List records from hr_surveys with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      survey_type: z
        .enum(['engagement', 'satisfaction', 'nps', 'climate', 'qvt', 'custom'])
        .optional()
        .describe('Filter by survey type'),
      status: z.enum(['draft', 'active', 'closed', 'archived']).optional().describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, survey_type, status, limit = 50, offset = 0 }) => {
      let query = supabase.from('hr_surveys').select(COLS_HR_SURVEYS).order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (survey_type) query = query.eq('survey_type', survey_type);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_surveys') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 22. hr_survey_responses
  // ================================================================

  server.tool(
    'create_hr_survey_responses',
    'Create a new record in hr_survey_responses',
    {
      company_id: z.string().describe('Company UUID'),
      survey_id: z.string().describe('Survey UUID'),
      respondent_id: z.string().optional().describe('Respondent employee UUID'),
      responses: z.any().optional().describe('Responses (JSONB)'),
      enps_score: z.number().int().optional().describe('eNPS score'),
      completion_time_secs: z.number().int().optional().describe('Completion time in seconds'),
      submitted_at: z.string().optional().describe('Submission timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_survey_responses')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_survey_responses') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_survey_responses record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_survey_responses',
    'Update an existing record in hr_survey_responses',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      survey_id: z.string().optional().describe('Survey UUID'),
      respondent_id: z.string().optional().describe('Respondent employee UUID'),
      responses: z.any().optional().describe('Responses (JSONB)'),
      enps_score: z.number().int().optional().describe('eNPS score'),
      completion_time_secs: z.number().int().optional().describe('Completion time in seconds'),
      submitted_at: z.string().optional().describe('Submission timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_survey_responses')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_survey_responses') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_survey_responses record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_survey_responses',
    'Delete a record from hr_survey_responses',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_survey_responses').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_survey_responses') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_survey_responses' }],
      };
    }
  );

  server.tool(
    'get_hr_survey_responses',
    'Get a single record from hr_survey_responses by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_survey_responses')
        .select(COLS_HR_SURVEY_RESPONSES)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_survey_responses') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_survey_responses',
    'List records from hr_survey_responses with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      survey_id: z.string().optional().describe('Filter by survey UUID'),
      respondent_id: z.string().optional().describe('Filter by respondent UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, survey_id, respondent_id, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_survey_responses')
        .select(COLS_HR_SURVEY_RESPONSES)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (survey_id) query = query.eq('survey_id', survey_id);
      if (respondent_id) query = query.eq('respondent_id', respondent_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_survey_responses') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 23. hr_risk_assessments
  // ================================================================

  server.tool(
    'create_hr_risk_assessments',
    'Create a new record in hr_risk_assessments',
    {
      company_id: z.string().describe('Company UUID'),
      assessment_type: z.enum(['duerp', 'pse', 'generic', 'custom']).describe('Assessment type'),
      department_id: z.string().optional().describe('Department UUID'),
      risk_category: z.string().optional().describe('Risk category'),
      risk_subcategory: z.string().optional().describe('Risk subcategory'),
      risk_description: z.string().optional().describe('Risk description'),
      situation: z.string().optional().describe('Situation'),
      probability: z.number().optional().describe('Probability'),
      severity: z.number().optional().describe('Severity'),
      risk_score: z.number().optional().describe('Risk score'),
      risk_level: z.enum(['green', 'yellow', 'orange', 'red']).optional().describe('Risk level'),
      existing_controls: z.string().optional().describe('Existing controls'),
      prevention_measures: z.string().optional().describe('Prevention measures'),
      responsible_id: z.string().optional().describe('Responsible employee UUID'),
      target_date: z.string().optional().describe('Target date (YYYY-MM-DD)'),
      completion_date: z.string().optional().describe('Completion date (YYYY-MM-DD)'),
      status: z
        .enum(['identified', 'assessed', 'in_treatment', 'controlled', 'closed', 'archived'])
        .optional()
        .describe('Assessment status'),
      assessment_date: z.string().optional().describe('Assessment date (YYYY-MM-DD)'),
      next_review_date: z.string().optional().describe('Next review date (YYYY-MM-DD)'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_risk_assessments')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_risk_assessments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_risk_assessments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_risk_assessments',
    'Update an existing record in hr_risk_assessments',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      assessment_type: z.enum(['duerp', 'pse', 'generic', 'custom']).optional().describe('Assessment type'),
      department_id: z.string().optional().describe('Department UUID'),
      risk_category: z.string().optional().describe('Risk category'),
      risk_subcategory: z.string().optional().describe('Risk subcategory'),
      risk_description: z.string().optional().describe('Risk description'),
      situation: z.string().optional().describe('Situation'),
      probability: z.number().optional().describe('Probability'),
      severity: z.number().optional().describe('Severity'),
      risk_score: z.number().optional().describe('Risk score'),
      risk_level: z.enum(['green', 'yellow', 'orange', 'red']).optional().describe('Risk level'),
      existing_controls: z.string().optional().describe('Existing controls'),
      prevention_measures: z.string().optional().describe('Prevention measures'),
      responsible_id: z.string().optional().describe('Responsible employee UUID'),
      target_date: z.string().optional().describe('Target date (YYYY-MM-DD)'),
      completion_date: z.string().optional().describe('Completion date (YYYY-MM-DD)'),
      status: z
        .enum(['identified', 'assessed', 'in_treatment', 'controlled', 'closed', 'archived'])
        .optional()
        .describe('Assessment status'),
      assessment_date: z.string().optional().describe('Assessment date (YYYY-MM-DD)'),
      next_review_date: z.string().optional().describe('Next review date (YYYY-MM-DD)'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_risk_assessments')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_risk_assessments') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_risk_assessments record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_risk_assessments',
    'Delete a record from hr_risk_assessments',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_risk_assessments').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_risk_assessments') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_risk_assessments' }],
      };
    }
  );

  server.tool(
    'get_hr_risk_assessments',
    'Get a single record from hr_risk_assessments by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_risk_assessments')
        .select(COLS_HR_RISK_ASSESSMENTS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_risk_assessments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_risk_assessments',
    'List records from hr_risk_assessments with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      assessment_type: z.enum(['duerp', 'pse', 'generic', 'custom']).optional().describe('Filter by assessment type'),
      department_id: z.string().optional().describe('Filter by department UUID'),
      risk_level: z.enum(['green', 'yellow', 'orange', 'red']).optional().describe('Filter by risk level'),
      status: z
        .enum(['identified', 'assessed', 'in_treatment', 'controlled', 'closed', 'archived'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, assessment_type, department_id, risk_level, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_risk_assessments')
        .select(COLS_HR_RISK_ASSESSMENTS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (assessment_type) query = query.eq('assessment_type', assessment_type);
      if (department_id) query = query.eq('department_id', department_id);
      if (risk_level) query = query.eq('risk_level', risk_level);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_risk_assessments') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 24. hr_job_positions
  // ================================================================

  server.tool(
    'create_hr_job_positions',
    'Create a new record in hr_job_positions',
    {
      company_id: z.string().describe('Company UUID'),
      title: z.string().describe('Position title'),
      description: z.string().optional().describe('Position description'),
      department_id: z.string().optional().describe('Department UUID'),
      job_level: z.string().optional().describe('Job level'),
      status: z.enum(['active', 'filled', 'closed', 'archived']).optional().describe('Position status'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_job_positions')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_job_positions') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_job_positions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_job_positions',
    'Update an existing record in hr_job_positions',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      title: z.string().optional().describe('Position title'),
      description: z.string().optional().describe('Position description'),
      department_id: z.string().optional().describe('Department UUID'),
      job_level: z.string().optional().describe('Job level'),
      status: z.enum(['active', 'filled', 'closed', 'archived']).optional().describe('Position status'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_job_positions')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_job_positions') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_job_positions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_job_positions',
    'Delete a record from hr_job_positions',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_job_positions').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_job_positions') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_job_positions' }],
      };
    }
  );

  server.tool(
    'get_hr_job_positions',
    'Get a single record from hr_job_positions by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_job_positions')
        .select(COLS_HR_JOB_POSITIONS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_job_positions') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_job_positions',
    'List records from hr_job_positions with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      department_id: z.string().optional().describe('Filter by department UUID'),
      status: z.enum(['active', 'filled', 'closed', 'archived']).optional().describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, department_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_job_positions')
        .select(COLS_HR_JOB_POSITIONS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (department_id) query = query.eq('department_id', department_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_job_positions') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 25. hr_candidates
  // ================================================================

  server.tool(
    'create_hr_candidates',
    'Create a new record in hr_candidates',
    {
      company_id: z.string().describe('Company UUID'),
      first_name: z.string().describe('First name'),
      last_name: z.string().describe('Last name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      location: z.string().optional().describe('Location'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_candidates')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_candidates') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_candidates record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_candidates',
    'Update an existing record in hr_candidates',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      first_name: z.string().optional().describe('First name'),
      last_name: z.string().optional().describe('Last name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      location: z.string().optional().describe('Location'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_candidates')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_candidates') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_candidates record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_candidates',
    'Delete a record from hr_candidates',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_candidates').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_candidates') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_candidates' }],
      };
    }
  );

  server.tool(
    'get_hr_candidates',
    'Get a single record from hr_candidates by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase.from('hr_candidates').select(COLS_HR_CANDIDATES).eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_candidates') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_candidates',
    'List records from hr_candidates with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('hr_candidates').select(COLS_HR_CANDIDATES).order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_candidates') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 26. hr_applications
  // ================================================================

  server.tool(
    'create_hr_applications',
    'Create a new record in hr_applications',
    {
      company_id: z.string().describe('Company UUID'),
      position_id: z.string().describe('Position UUID'),
      candidate_id: z.string().describe('Candidate UUID'),
      status: z
        .enum(['new', 'screening', 'first_interview', 'second_interview', 'offer', 'hired', 'rejected', 'withdrawn'])
        .optional()
        .describe('Application status'),
      applied_at: z.string().optional().describe('Application timestamp'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_applications')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_applications') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_applications record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_applications',
    'Update an existing record in hr_applications',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      position_id: z.string().optional().describe('Position UUID'),
      candidate_id: z.string().optional().describe('Candidate UUID'),
      status: z
        .enum(['new', 'screening', 'first_interview', 'second_interview', 'offer', 'hired', 'rejected', 'withdrawn'])
        .optional()
        .describe('Application status'),
      applied_at: z.string().optional().describe('Application timestamp'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_applications')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_applications') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_applications record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_applications',
    'Delete a record from hr_applications',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_applications').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_applications') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_applications' }],
      };
    }
  );

  server.tool(
    'get_hr_applications',
    'Get a single record from hr_applications by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase.from('hr_applications').select(COLS_HR_APPLICATIONS).eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_applications') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_applications',
    'List records from hr_applications with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      position_id: z.string().optional().describe('Filter by position UUID'),
      candidate_id: z.string().optional().describe('Filter by candidate UUID'),
      status: z
        .enum(['new', 'screening', 'first_interview', 'second_interview', 'offer', 'hired', 'rejected', 'withdrawn'])
        .optional()
        .describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, position_id, candidate_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_applications')
        .select(COLS_HR_APPLICATIONS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (position_id) query = query.eq('position_id', position_id);
      if (candidate_id) query = query.eq('candidate_id', candidate_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_applications') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 27. hr_interview_sessions
  // ================================================================

  server.tool(
    'create_hr_interview_sessions',
    'Create a new record in hr_interview_sessions',
    {
      company_id: z.string().describe('Company UUID'),
      application_id: z.string().describe('Application UUID'),
      scheduled_at: z.string().optional().describe('Scheduled timestamp'),
      status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional().describe('Session status'),
      interview_type: z.string().optional().describe('Interview type'),
      feedback: z.string().optional().describe('Feedback'),
      score: z.number().optional().describe('Score'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_interview_sessions')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_interview_sessions') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_interview_sessions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_interview_sessions',
    'Update an existing record in hr_interview_sessions',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      application_id: z.string().optional().describe('Application UUID'),
      scheduled_at: z.string().optional().describe('Scheduled timestamp'),
      status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional().describe('Session status'),
      interview_type: z.string().optional().describe('Interview type'),
      feedback: z.string().optional().describe('Feedback'),
      score: z.number().optional().describe('Score'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_interview_sessions')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_interview_sessions') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_interview_sessions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_interview_sessions',
    'Delete a record from hr_interview_sessions',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_interview_sessions').delete().eq('id', id);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_interview_sessions') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_interview_sessions' }],
      };
    }
  );

  server.tool(
    'get_hr_interview_sessions',
    'Get a single record from hr_interview_sessions by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_interview_sessions')
        .select(COLS_HR_INTERVIEW_SESSIONS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_interview_sessions') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_interview_sessions',
    'List records from hr_interview_sessions with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      application_id: z.string().optional().describe('Filter by application UUID'),
      status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional().describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, application_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_interview_sessions')
        .select(COLS_HR_INTERVIEW_SESSIONS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (application_id) query = query.eq('application_id', application_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_interview_sessions') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ================================================================
  // 28. hr_onboarding_plans
  // ================================================================

  server.tool(
    'create_hr_onboarding_plans',
    'Create a new record in hr_onboarding_plans',
    {
      company_id: z.string().describe('Company UUID'),
      employee_id: z.string().describe('Employee UUID'),
      checklist: z.any().optional().describe('Checklist items (JSONB)'),
      completion_pct: z.number().int().optional().describe('Completion percentage'),
      status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional().describe('Plan status'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('hr_onboarding_plans')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create hr_onboarding_plans') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created hr_onboarding_plans record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_hr_onboarding_plans',
    'Update an existing record in hr_onboarding_plans',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z.string().optional().describe('Company UUID'),
      employee_id: z.string().optional().describe('Employee UUID'),
      checklist: z.any().optional().describe('Checklist items (JSONB)'),
      completion_pct: z.number().int().optional().describe('Completion percentage'),
      status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional().describe('Plan status'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      const { data, error } = await supabase
        .from('hr_onboarding_plans')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update hr_onboarding_plans') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated hr_onboarding_plans record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_hr_onboarding_plans',
    'Delete a record from hr_onboarding_plans',
    { id: z.string().describe('Record UUID to delete') },
    async ({ id }) => {
      const { error } = await supabase.from('hr_onboarding_plans').delete().eq('id', id);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete hr_onboarding_plans') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from hr_onboarding_plans' }],
      };
    }
  );

  server.tool(
    'get_hr_onboarding_plans',
    'Get a single record from hr_onboarding_plans by ID',
    { id: z.string().describe('Record UUID to fetch') },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('hr_onboarding_plans')
        .select(COLS_HR_ONBOARDING_PLANS)
        .eq('id', id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get hr_onboarding_plans') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_hr_onboarding_plans',
    'List records from hr_onboarding_plans with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      employee_id: z.string().optional().describe('Filter by employee UUID'),
      status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional().describe('Filter by status'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, employee_id, status, limit = 50, offset = 0 }) => {
      let query = supabase
        .from('hr_onboarding_plans')
        .select(COLS_HR_ONBOARDING_PLANS)
        .order('created_at', { ascending: false });
      if (company_id) query = query.eq('company_id', company_id);
      if (employee_id) query = query.eq('employee_id', employee_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list hr_onboarding_plans') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
