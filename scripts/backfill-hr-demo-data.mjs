import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const TARGET_EMAILS = [
  'pilotage.fr.demo@cashpilot.cloud',
  'pilotage.be.demo@cashpilot.cloud',
  'pilotage.ohada.demo@cashpilot.cloud',
];

const FIRST_NAMES = [
  'Alex', 'Sophie', 'Nora', 'Lucas', 'Ines', 'Martin', 'Camille', 'Sarah',
  'Yanis', 'Lea', 'Hugo', 'Maya', 'Rayan', 'Emma', 'Noah', 'Jade',
  'Lina', 'Mehdi', 'Nina', 'Liam', 'Mila', 'Elias', 'Zoey', 'Aylan',
];

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dumont', 'Laurent', 'Rousseau', 'Mercier', 'Dupuis', 'Lambert',
  'Garcia', 'Lefevre', 'Petit', 'Renaud', 'Moreau', 'Gauthier', 'Dupont', 'Meyer',
  'Henry', 'Dubois', 'Robin', 'Brun', 'Chevalier', 'Marchand', 'Pierre', 'Colin',
];

const CURRENT_YEAR = new Date().getUTCFullYear();

const dateOnly = (year, month, day) => new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
const addDays = (dateString, days) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const ts = (date, hour = 9, minute = 0) => `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
const round = (value) => Math.round(Number(value || 0) * 100) / 100;
const uuidFromSeed = (seed) => {
  const hash = createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};
const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || 'Employe',
    last: parts.slice(1).join(' ') || 'Demo',
  };
};
const identityFor = (companyIndex, memberIndex) => {
  const globalIndex = companyIndex * 7 + memberIndex;
  const first = FIRST_NAMES[globalIndex % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(globalIndex / FIRST_NAMES.length) % LAST_NAMES.length];
  const suffix = `${String(companyIndex + 1).padStart(2, '0')}${String(memberIndex + 1).padStart(2, '0')}`;
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}.${suffix}@cashpilot.demo`,
  };
};

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}
const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function upsertRows(table, rows, onConflict = 'id') {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, { onConflict });
  if (!error) return;
  const message = String(error.message || '');
  if (
    message.includes(`Could not find the table 'public.${table}'`) ||
    message.includes(`relation "public.${table}" does not exist`)
  ) {
    console.log(`[skip] missing table: ${table}`);
    return;
  }
  throw new Error(`Upsert failed for ${table}: ${error.message}`);
}

async function deleteByCompany(table, companyIds) {
  if (!companyIds.length) return;
  const { error } = await client.from(table).delete().in('company_id', companyIds);
  if (!error) return;
  const message = String(error.message || '');
  if (
    message.includes('Could not find the table') ||
    message.includes('does not exist') ||
    message.includes("Could not find the 'company_id' column")
  ) {
    return;
  }
  throw new Error(`Cleanup failed for ${table}: ${error.message}`);
}

async function listUsersByEmail(emails) {
  const result = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users || [];
    if (!users.length) break;
    for (const user of users) {
      const email = String(user.email || '').toLowerCase();
      if (emails.includes(email)) result.set(email, user);
    }
    if (users.length < 200) break;
    page += 1;
  }
  return result;
}

async function run() {
  const emailArg = process.argv.find((arg) => arg.startsWith('--emails='));
  const scopedEmails = emailArg
    ? emailArg.slice('--emails='.length).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
    : TARGET_EMAILS;

  const usersByEmail = await listUsersByEmail(scopedEmails);

  for (const [emailIndex, email] of scopedEmails.entries()) {
    const user = usersByEmail.get(email);
    if (!user) {
      console.log(`[warn] user not found: ${email}`);
      continue;
    }

    const userId = user.id;
    const { data: companies, error: companiesError } = await client
      .from('company')
      .select('id, user_id, country, accounting_currency, city, company_name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (companiesError) throw new Error(`company fetch failed for ${email}: ${companiesError.message}`);

    const scopedCompanies = companies || [];
    const companyIds = scopedCompanies.map((row) => row.id);
    if (!companyIds.length) {
      console.log(`[warn] no companies for ${email}`);
      continue;
    }

    const { data: teamMembersRaw, error: teamError } = await client
      .from('team_members')
      .select('id, user_id, company_id, name, email, role, employee_id, joined_at, created_at, updated_at')
      .eq('user_id', userId)
      .in('company_id', companyIds)
      .order('created_at', { ascending: true });
    if (teamError) throw new Error(`team fetch failed for ${email}: ${teamError.message}`);

    const teamMembersByCompany = new Map();
    for (const member of teamMembersRaw || []) {
      if (!member.company_id) continue;
      if (!teamMembersByCompany.has(member.company_id)) teamMembersByCompany.set(member.company_id, []);
      teamMembersByCompany.get(member.company_id).push(member);
    }

    const cleanupTables = [
      'team_member_compensations',
      'material_assets',
      'material_categories',
      'hr_survey_responses',
      'hr_surveys',
      'hr_risk_assessments',
      'hr_headcount_budgets',
      'hr_succession_plans',
      'hr_performance_reviews',
      'hr_skill_assessments',
      'hr_training_enrollments',
      'hr_training_catalog',
      'hr_onboarding_plans',
      'hr_interview_sessions',
      'hr_applications',
      'hr_candidates',
      'hr_job_positions',
      'hr_payroll_exports',
      'hr_payroll_anomalies',
      'hr_payroll_variable_items',
      'hr_payroll_periods',
      'hr_leave_requests',
      'hr_employee_skills',
      'hr_employee_contracts',
      'hr_leave_types',
      'hr_work_calendars',
      'hr_departments',
    ];
    for (const table of cleanupTables) {
      await deleteByCompany(table, companyIds);
    }

    const updatedTeamMembers = [];
    const updatedEmployees = [];
    const tableRows = {
      hr_departments: [],
      hr_work_calendars: [],
      hr_leave_types: [],
      hr_employee_contracts: [],
      hr_employee_skills: [],
      hr_leave_requests: [],
      hr_payroll_periods: [],
      hr_payroll_variable_items: [],
      hr_payroll_anomalies: [],
      hr_payroll_exports: [],
      hr_job_positions: [],
      hr_candidates: [],
      hr_applications: [],
      hr_interview_sessions: [],
      hr_onboarding_plans: [],
      hr_training_catalog: [],
      hr_training_enrollments: [],
      hr_skill_assessments: [],
      hr_performance_reviews: [],
      hr_succession_plans: [],
      hr_headcount_budgets: [],
      hr_surveys: [],
      hr_survey_responses: [],
      hr_risk_assessments: [],
      material_categories: [],
      material_assets: [],
      team_member_compensations: [],
    };

    const { data: projects, error: projectsError } = await client
      .from('projects')
      .select('id, company_id, user_id')
      .eq('user_id', userId)
      .in('company_id', companyIds);
    if (projectsError) throw new Error(`projects fetch failed for ${email}: ${projectsError.message}`);
    const projectById = new Map((projects || []).map((row) => [row.id, row]));

    const { data: tasks, error: tasksError } = await client
      .from('tasks')
      .select('id, project_id, assigned_member_id')
      .in('project_id', (projects || []).map((row) => row.id));
    if (tasksError) throw new Error(`tasks fetch failed for ${email}: ${tasksError.message}`);
    const tasksByProject = new Map();
    for (const task of tasks || []) {
      if (!tasksByProject.has(task.project_id)) tasksByProject.set(task.project_id, []);
      tasksByProject.get(task.project_id).push(task);
    }

    const { data: timesheets, error: timesheetsError } = await client
      .from('timesheets')
      .select('id, company_id, project_id, task_id, executed_by_member_id, duration_minutes, hourly_rate')
      .eq('user_id', userId)
      .in('project_id', (projects || []).map((row) => row.id));
    if (timesheetsError) throw new Error(`timesheets fetch failed for ${email}: ${timesheetsError.message}`);

    for (let companyIndex = 0; companyIndex < scopedCompanies.length; companyIndex += 1) {
      const company = scopedCompanies[companyIndex];
      const country = String(company.country || '').toUpperCase();
      const currency = company.accounting_currency || 'EUR';
      const timezone = country === 'BE' ? 'Europe/Brussels' : (country === 'FR' ? 'Europe/Paris' : 'Africa/Douala');
      const weeklyTargetMinutes = country === 'FR' ? 2100 : (country === 'BE' ? 2280 : 2400);
      const members = [...(teamMembersByCompany.get(company.id) || [])].slice(0, 7);
      if (!members.length) continue;

      for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
        const member = members[memberIndex];
        const identity = identityFor(companyIndex + emailIndex * 8, memberIndex);
        const employeeId = member.employee_id || uuidFromSeed(`${email}:employee:${company.id}:${member.id}`);
        const { first, last } = splitName(identity.name);

        updatedTeamMembers.push({
          id: member.id,
          user_id: userId,
          company_id: company.id,
          name: identity.name,
          email: identity.email,
          role: member.role || (memberIndex === 0 ? 'manager' : 'member'),
          joined_at: member.joined_at || dateOnly(CURRENT_YEAR - 1, 1, 5 + memberIndex),
          employee_id: employeeId,
          updated_at: new Date().toISOString(),
        });

        updatedEmployees.push({
          id: employeeId,
          company_id: company.id,
          user_id: userId,
          employee_number: `EMP-${String(companyIndex + 1).padStart(2, '0')}-${String(memberIndex + 1).padStart(3, '0')}`,
          first_name: first,
          last_name: last,
          full_name: identity.name,
          work_email: identity.email,
          status: 'active',
          hire_date: member.joined_at || dateOnly(CURRENT_YEAR - 1, 1 + (memberIndex % 4), 6 + memberIndex),
          job_title: ['HR Director', 'Finance Manager', 'Operations Lead', 'Payroll Specialist', 'Recruitment Partner', 'Training Lead', 'Project Analyst'][memberIndex % 7],
          phone: null,
          updated_at: new Date().toISOString(),
        });
      }

      const companyEmployees = updatedEmployees.filter((row) => row.company_id === company.id);
      const managerId = companyEmployees[0]?.id || null;
      const departmentRows = [
        ['DIR', 'Executive Office', 'Leadership and strategic steering'],
        ['FIN', 'Finance and Accounting', 'Financial operations and reporting'],
        ['OPS', 'Operations and Delivery', 'Service and project execution'],
        ['HR', 'People and Culture', 'Talent, payroll, and employee success'],
      ].map(([code, name, description], depIndex) => ({
        id: uuidFromSeed(`${email}:department:${company.id}:${code}`),
        company_id: company.id,
        department_code: code,
        name,
        description,
        manager_employee_id: managerId,
        created_at: ts(dateOnly(CURRENT_YEAR, 1, 2 + depIndex), 9),
        updated_at: ts(dateOnly(CURRENT_YEAR, 1, 3 + depIndex), 9, 10),
      }));
      tableRows.hr_departments.push(...departmentRows);

      const calendarId = uuidFromSeed(`${email}:calendar:${company.id}:default`);
      tableRows.hr_work_calendars.push({
        id: calendarId,
        company_id: company.id,
        name: `Standard ${country || 'INTL'} 5d`,
        timezone,
        weekly_target_minutes: weeklyTargetMinutes,
        created_at: ts(dateOnly(CURRENT_YEAR, 1, 2), 8),
        updated_at: ts(dateOnly(CURRENT_YEAR, 1, 2), 8, 10),
      });

      const leaveTypeRows = [
        ['ANNUAL', 'Annual Paid Leave', true, true],
        ['SICK', 'Sick Leave', true, true],
        ['TRAINING', 'Training Leave', true, false],
        ['UNPAID', 'Unpaid Leave', false, true],
      ].map(([code, name, isPaid, blocks], leaveIndex) => ({
        id: uuidFromSeed(`${email}:leave-type:${company.id}:${code}`),
        company_id: company.id,
        leave_code: code,
        name,
        is_paid: isPaid,
        blocks_productive_time: blocks,
        created_at: ts(dateOnly(CURRENT_YEAR, 1, 5 + leaveIndex), 8),
        updated_at: ts(dateOnly(CURRENT_YEAR, 1, 5 + leaveIndex), 8, 10),
      }));
      tableRows.hr_leave_types.push(...leaveTypeRows);

      companyEmployees.forEach((employee, idx) => {
        tableRows.hr_employee_contracts.push({
          id: uuidFromSeed(`${email}:contract:${company.id}:${employee.id}`),
          company_id: company.id,
          employee_id: employee.id,
          contract_type: ['cdi', 'cdd', 'freelance', 'cdi', 'alternance'][idx % 5],
          status: 'active',
          start_date: employee.hire_date,
          end_date: null,
          pay_basis: idx % 4 === 2 ? 'hourly' : 'monthly',
          hourly_rate: idx % 4 === 2 ? round((2900 + idx * 120) / 151.67) : null,
          monthly_salary: idx % 4 === 2 ? null : round(2900 + companyIndex * 180 + idx * 120),
        });
        tableRows.hr_employee_skills.push({
          id: uuidFromSeed(`${email}:employee-skill:${company.id}:${employee.id}:1`),
          company_id: company.id,
          employee_id: employee.id,
          skill_name: ['Financial Analysis', 'Payroll Operations', 'Recruitment Process', 'Data Reporting'][idx % 4],
          skill_level: ['beginner', 'intermediate', 'advanced', 'expert'][idx % 4],
        });
        tableRows.hr_employee_skills.push({
          id: uuidFromSeed(`${email}:employee-skill:${company.id}:${employee.id}:2`),
          company_id: company.id,
          employee_id: employee.id,
          skill_name: ['Compliance Control', 'Project Delivery', 'Performance Coaching', 'Risk Prevention'][(idx + 1) % 4],
          skill_level: ['intermediate', 'advanced', 'advanced', 'expert'][idx % 4],
        });
      });

      for (let i = 0; i < Math.min(4, companyEmployees.length); i += 1) {
        const startDate = dateOnly(CURRENT_YEAR, 4 + i, 4 + i);
        tableRows.hr_leave_requests.push({
          id: uuidFromSeed(`${email}:leave-request:${company.id}:${i}`),
          company_id: company.id,
          employee_id: companyEmployees[i].id,
          leave_type_id: leaveTypeRows[i % leaveTypeRows.length].id,
          start_date: startDate,
          end_date: addDays(startDate, 1 + (i % 2)),
          total_days: 2 + (i % 2),
          status: ['approved', 'submitted', 'validated', 'rejected'][i % 4],
          reason: `Seed leave request #${i + 1}`,
        });
      }

      const payrollPeriodId = uuidFromSeed(`${email}:payroll-period:${company.id}:02`);
      tableRows.hr_payroll_periods.push({ id: payrollPeriodId, company_id: company.id, period_start: dateOnly(CURRENT_YEAR, 2, 1), period_end: dateOnly(CURRENT_YEAR, 2, 28), status: 'validated', calculation_version: 1 });
      tableRows.hr_payroll_periods.push({ id: uuidFromSeed(`${email}:payroll-period:${company.id}:03`), company_id: company.id, period_start: dateOnly(CURRENT_YEAR, 3, 1), period_end: dateOnly(CURRENT_YEAR, 3, 31), status: 'open', calculation_version: 1 });
      companyEmployees.forEach((employee, idx) => {
        const amount = round(2900 + companyIndex * 180 + idx * 120);
        tableRows.hr_payroll_variable_items.push({
          id: uuidFromSeed(`${email}:payroll-variable:${company.id}:${employee.id}`),
          company_id: company.id,
          payroll_period_id: payrollPeriodId,
          employee_id: employee.id,
          item_code: 'BASE',
          item_label: 'Base monthly salary',
          item_category: 'normal_hours',
          quantity: 151.67,
          rate: round(amount / 151.67),
          amount,
          currency,
          source_timesheet_line_id: null,
          source_leave_request_id: null,
          metadata: { seeded: true },
        });
      });
      tableRows.hr_payroll_anomalies.push({ id: uuidFromSeed(`${email}:payroll-anomaly:${company.id}:1`), company_id: company.id, payroll_period_id: payrollPeriodId, employee_id: companyEmployees[1]?.id || null, anomaly_code: 'NON_VALIDATED_TIMESHEET', severity: 'warning', message: 'One timesheet line is still submitted', details: { seeded: true } });
      tableRows.hr_payroll_exports.push({ id: uuidFromSeed(`${email}:payroll-export:${company.id}:1`), company_id: company.id, payroll_period_id: payrollPeriodId, export_format: 'csv', export_status: 'generated', version: 1, file_url: null, generated_by: userId, generated_at: new Date().toISOString() });

      const position1Id = uuidFromSeed(`${email}:job-position:${company.id}:1`);
      const position2Id = uuidFromSeed(`${email}:job-position:${company.id}:2`);
      tableRows.hr_job_positions.push({ id: position1Id, company_id: company.id, title: 'Senior Financial Controller', department_id: departmentRows[1].id, cost_center_id: null, status: 'open', employment_type: 'cdi', min_salary: 4200, max_salary: 5600, currency, description: 'Lead monthly close and reporting.', requirements: 'Strong accounting background.', location: company.city || 'Head Office', remote_policy: 'hybrid', target_start_date: dateOnly(CURRENT_YEAR, 4, 15) });
      tableRows.hr_job_positions.push({ id: position2Id, company_id: company.id, title: 'HR Operations Specialist', department_id: departmentRows[3].id, cost_center_id: null, status: 'on_hold', employment_type: 'cdd', min_salary: 2800, max_salary: 3600, currency, description: 'Support payroll and onboarding.', requirements: 'HR administration.', location: company.city || 'Regional Office', remote_policy: 'onsite', target_start_date: dateOnly(CURRENT_YEAR, 5, 1) });

      for (let i = 0; i < 4; i += 1) {
        const candidateId = uuidFromSeed(`${email}:candidate:${company.id}:${i}`);
        tableRows.hr_candidates.push({ id: candidateId, company_id: company.id, first_name: ['Sofia', 'Nicolas', 'Imane', 'Karim'][i], last_name: ['Martin', 'Bernard', 'Diallo', 'Renaud'][i], email: `candidate.${companyIndex + 1}.${i + 1}@cashpilot.demo`, source: ['direct', 'linkedin', 'jobboard', 'referral'][i], gdpr_consent: true, gdpr_consent_date: new Date().toISOString() });
        const appId = uuidFromSeed(`${email}:application:${company.id}:${i}`);
        const appStatus = ['new', 'screening', 'interview', 'offer'][i];
        tableRows.hr_applications.push({ id: appId, company_id: company.id, position_id: i % 2 === 0 ? position1Id : position2Id, candidate_id: candidateId, status: appStatus, pipeline_stage: i + 1, assigned_to: managerId, offer_amount: appStatus === 'offer' ? 4300 : null, offer_currency: currency, offer_date: appStatus === 'offer' ? dateOnly(CURRENT_YEAR, 3, 12) : null, offer_expiry_date: appStatus === 'offer' ? dateOnly(CURRENT_YEAR, 3, 22) : null });
        if (appStatus === 'interview' || appStatus === 'offer') {
          tableRows.hr_interview_sessions.push({ id: uuidFromSeed(`${email}:interview:${company.id}:${i}`), company_id: company.id, application_id: appId, interviewer_id: companyEmployees[1]?.id || companyEmployees[0]?.id || null, scheduled_at: ts(dateOnly(CURRENT_YEAR, 3, 5 + i), 14), duration_minutes: 75, format: ['video', 'in_person', 'technical_test', 'phone'][i], status: appStatus === 'interview' ? 'scheduled' : 'completed', score: appStatus === 'offer' ? 4 : null, recommendation: appStatus === 'offer' ? 'yes' : null, feedback: 'Seeded interview trace.' });
        }
      }

      tableRows.hr_onboarding_plans.push({ id: uuidFromSeed(`${email}:onboarding:${company.id}:1`), company_id: company.id, employee_id: companyEmployees[1]?.id || companyEmployees[0]?.id || null, template_name: '90-day-onboarding', status: 'active', start_date: dateOnly(CURRENT_YEAR, 3, 4), end_date: dateOnly(CURRENT_YEAR, 5, 31), completion_pct: 40, buddy_id: companyEmployees[2]?.id || companyEmployees[0]?.id || null, manager_id: managerId, checklist: [{ task: 'Workstation and accesses', done: true }, { task: 'Payroll policy review', done: true }, { task: 'Manager check-in', done: false }] });

      const trainingIds = [0, 1, 2].map((idx) => uuidFromSeed(`${email}:training:${company.id}:${idx}`));
      tableRows.hr_training_catalog.push({ id: trainingIds[0], company_id: company.id, title: 'Payroll Compliance Fundamentals', provider: 'CashPilot Academy', provider_type: 'internal', format: 'workshop', duration_hours: 8, cost_per_person: 420, currency, skills_covered: ['Payroll Operations', 'Compliance Control'], is_mandatory: true, cpf_eligible: true, opco_eligible: false, tags: ['seed', 'hr'], is_active: true });
      tableRows.hr_training_catalog.push({ id: trainingIds[1], company_id: company.id, title: 'Advanced Financial Closing', provider: 'CashPilot Academy', provider_type: 'external', format: 'classroom', duration_hours: 12, cost_per_person: 940, currency, skills_covered: ['Financial Analysis', 'Data Reporting'], is_mandatory: false, cpf_eligible: true, opco_eligible: false, certification_name: 'Certified Financial Closer', passing_score: 70, validity_months: 24, tags: ['seed', 'hr'], is_active: true });
      tableRows.hr_training_catalog.push({ id: trainingIds[2], company_id: company.id, title: 'Recruitment Interview Masterclass', provider: 'CashPilot Academy', provider_type: 'external', format: 'blended', duration_hours: 10, cost_per_person: 690, currency, skills_covered: ['Recruitment Process', 'Performance Coaching'], is_mandatory: false, cpf_eligible: false, opco_eligible: true, tags: ['seed', 'hr'], is_active: true });
      companyEmployees.forEach((employee, idx) => {
        const status = ['completed', 'completed', 'in_progress', 'planned', 'registered', 'completed', 'failed'][idx % 7];
        const startDate = dateOnly(CURRENT_YEAR, 2 + (idx % 3), 8 + idx);
        const endDate = addDays(startDate, 2 + (idx % 2));
        tableRows.hr_training_enrollments.push({ id: uuidFromSeed(`${email}:training-enrollment:${company.id}:${employee.id}`), company_id: company.id, employee_id: employee.id, training_id: trainingIds[idx % trainingIds.length], training_plan_id: null, status, planned_start_date: startDate, planned_end_date: endDate, actual_start_date: status === 'completed' || status === 'failed' ? startDate : null, actual_end_date: status === 'completed' || status === 'failed' ? endDate : null, score: status === 'completed' ? 76 + (idx % 12) : null, passed: status === 'completed' ? true : (status === 'failed' ? false : null), certificate_url: null, certificate_expiry: null, actual_cost: 420 + (idx % 3) * 100, funded_by: ['company', 'cpf', 'opco', 'company', 'grant'][idx % 5], cpf_hours_used: status === 'completed' ? 4 + (idx % 3) : null, rating_hot: status === 'completed' ? 4 : null, rating_cold: status === 'completed' ? 4 : null, feedback_comment: status === 'completed' ? 'Useful and directly applicable.' : null, accounting_entry_id: null });
        tableRows.hr_skill_assessments.push({ id: uuidFromSeed(`${email}:skill-assessment:${company.id}:${employee.id}`), company_id: company.id, employee_id: employee.id, skill_name: ['Financial Analysis', 'Payroll Operations', 'Recruitment Process', 'Data Reporting'][idx % 4], skill_category: ['technical', 'managerial', 'cross_functional'][idx % 3], required_level: 4, current_level: 2 + (idx % 3), target_level: 4 + (idx % 2), assessed_by: managerId, assessment_method: ['manager_review', 'self', 'test'][idx % 3], assessed_at: dateOnly(CURRENT_YEAR, 2, 12 + (idx % 10)), next_assessment_date: dateOnly(CURRENT_YEAR, 9, 12 + (idx % 10)), notes: 'Seeded assessment for skills matrix tests.' });
      });

      companyEmployees.forEach((employee, idx) => {
        const status = ['completed', 'manager_review', 'pending', 'completed', 'pending', 'completed', 'pending'][idx % 7];
        const score = status === 'completed' ? round(3.2 + (idx % 3) * 0.4) : null;
        tableRows.hr_performance_reviews.push({ id: uuidFromSeed(`${email}:performance-review:${company.id}:${employee.id}`), company_id: company.id, employee_id: employee.id, reviewer_id: managerId, review_type: 'annual', period_year: CURRENT_YEAR, period_label: `Annual review ${CURRENT_YEAR}`, status, objectives: [{ name: 'Close quality', target: 'No errors' }], objectives_score: score, competencies: [{ name: 'Collaboration', score }], competencies_score: score, overall_score: score, performance_rating: status === 'completed' ? ['meets', 'exceeds', 'exceptional'][idx % 3] : null, salary_increase_pct: status === 'completed' ? round(1.6 + (idx % 2)) : null, bonus_amount: status === 'completed' ? round(300 + idx * 55) : null, promotion_recommended: status === 'completed' && idx % 3 === 0, nine_box_performance: status === 'completed' ? 1 + (idx % 3) : null, nine_box_potential: status === 'completed' ? 1 + ((idx + 1) % 3) : null });
      });
      tableRows.hr_succession_plans.push({ id: uuidFromSeed(`${email}:succession:${company.id}:1`), company_id: company.id, position_title: 'Finance Director', position_id: position1Id, incumbent_id: companyEmployees[0]?.id || null, successor_id: companyEmployees[1]?.id || companyEmployees[0]?.id || null, readiness_level: 'ready_in_1y', nine_box_performance: 2, nine_box_potential: 3, risk_of_loss: 'medium', development_actions: 'Cross-functional exposure and mentoring.', reviewed_at: dateOnly(CURRENT_YEAR, 2, 24) });
      departmentRows.forEach((department, depIdx) => {
        tableRows.hr_headcount_budgets.push({ id: uuidFromSeed(`${email}:headcount-budget:${company.id}:${department.id}`), company_id: company.id, fiscal_year: CURRENT_YEAR, department_id: department.id, cost_center_id: null, budgeted_headcount: 6 + depIdx, actual_headcount: 5 + depIdx, budgeted_fte: round(5.5 + depIdx * 0.7), actual_fte: round(5.2 + depIdx * 0.6), budgeted_payroll_cost: round(280000 + depIdx * 38000), actual_payroll_cost: round(248000 + depIdx * 34000), currency, planned_hires: 1 + (depIdx % 2), planned_exits: depIdx % 2, planned_promotions: 1, version: 1, status: 'approved' });
      });

      const pulseSurveyId = uuidFromSeed(`${email}:survey:${company.id}:pulse`);
      const annualSurveyId = uuidFromSeed(`${email}:survey:${company.id}:annual`);
      tableRows.hr_surveys.push({ id: pulseSurveyId, company_id: company.id, title: 'Monthly Pulse Survey', survey_type: 'pulse', status: 'active', questions: [{ id: 'q1', type: 'rating', label: 'I have enough resources.' }], target_audience: 'all', anonymous: true, allow_partial: false, starts_at: ts(dateOnly(CURRENT_YEAR, 3, 1), 8), ends_at: ts(dateOnly(CURRENT_YEAR, 3, 31), 20), reminder_at: ts(dateOnly(CURRENT_YEAR, 3, 20), 10), response_count: 0, completion_rate: 0, enps_score: null, avg_satisfaction: null, results_summary: {}, ai_analysis: null, created_by: null });
      tableRows.hr_surveys.push({ id: annualSurveyId, company_id: company.id, title: 'Annual Engagement Survey', survey_type: 'annual', status: 'closed', questions: [{ id: 'q1', type: 'rating', label: 'I feel recognized.' }], target_audience: 'all', anonymous: true, allow_partial: true, starts_at: ts(dateOnly(CURRENT_YEAR, 1, 10), 8), ends_at: ts(dateOnly(CURRENT_YEAR, 2, 5), 20), reminder_at: ts(dateOnly(CURRENT_YEAR, 1, 28), 10), response_count: Math.min(5, companyEmployees.length), completion_rate: 82, enps_score: 24, avg_satisfaction: 4.1, results_summary: { highlights: ['Strong team cohesion'] }, ai_analysis: 'Positive trend.' });
      for (let i = 0; i < Math.min(5, companyEmployees.length); i += 1) {
        tableRows.hr_survey_responses.push({ id: uuidFromSeed(`${email}:survey-response:${company.id}:${i}`), company_id: company.id, survey_id: annualSurveyId, respondent_id: companyEmployees[i].id, responses: { q1: 3 + (i % 3), comment: 'Seeded response.' }, enps_score: 6 + i, completion_time_secs: 170 + i * 25, submitted_at: ts(dateOnly(CURRENT_YEAR, 1, 20 + i), 12) });
      }
      tableRows.hr_risk_assessments.push({ id: uuidFromSeed(`${email}:risk:${company.id}:1`), company_id: company.id, assessment_type: 'duerp', department_id: departmentRows[2].id, risk_category: 'Operational', risk_subcategory: 'Workload', risk_description: 'Month-end workload pressure', situation: 'Month-end close', probability: 3, severity: 3, existing_controls: 'Daily standups', prevention_measures: 'Redistribute tasks', responsible_id: managerId, target_date: dateOnly(CURRENT_YEAR, 5, 20), completion_date: null, status: 'in_progress', assessment_date: dateOnly(CURRENT_YEAR, 3, 1), next_review_date: dateOnly(CURRENT_YEAR, 6, 1) });
      tableRows.hr_risk_assessments.push({ id: uuidFromSeed(`${email}:risk:${company.id}:2`), company_id: company.id, assessment_type: 'rps', department_id: departmentRows[3].id, risk_category: 'Psychosocial', risk_subcategory: 'Communication', risk_description: 'Payroll communication gaps', situation: 'Payroll finalization', probability: 2, severity: 3, existing_controls: 'Weekly sync', prevention_measures: 'Formal protocol', responsible_id: managerId, target_date: dateOnly(CURRENT_YEAR, 4, 30), completion_date: null, status: 'identified', assessment_date: dateOnly(CURRENT_YEAR, 3, 2), next_review_date: dateOnly(CURRENT_YEAR, 5, 30) });

      const materialCategoryItId = uuidFromSeed(`${email}:material-category:${company.id}:it`);
      const materialCategoryOpsId = uuidFromSeed(`${email}:material-category:${company.id}:ops`);
      tableRows.material_categories.push({ id: materialCategoryItId, company_id: company.id, category_code: 'IT', name: 'IT Equipment', description: 'Workstations and devices' });
      tableRows.material_categories.push({ id: materialCategoryOpsId, company_id: company.id, category_code: 'OPS', name: 'Operations Equipment', description: 'Delivery and production tools' });
      tableRows.material_assets.push({ id: uuidFromSeed(`${email}:material-asset:${company.id}:1`), company_id: company.id, category_id: materialCategoryItId, asset_code: `MAT-${companyIndex + 1}-001`, asset_name: 'Laptop Workstation', status: 'available', unit_usage_cost: 20, unit_of_measure: 'hour', cost_center_id: null, linked_fixed_asset_id: null, acquisition_mode: 'purchase', supplier_id: null, contract_reference: null, contract_start_date: null, contract_end_date: null, purchase_date: dateOnly(CURRENT_YEAR - 1, 10, 10), purchase_cost: 4200, rental_rate: null, billing_cycle: null, notes: 'Seeded material asset' });
      tableRows.material_assets.push({ id: uuidFromSeed(`${email}:material-asset:${company.id}:2`), company_id: company.id, category_id: materialCategoryOpsId, asset_code: `MAT-${companyIndex + 1}-002`, asset_name: 'Delivery Van', status: 'in_use', unit_usage_cost: 28, unit_of_measure: 'hour', cost_center_id: null, linked_fixed_asset_id: null, acquisition_mode: 'rental', supplier_id: null, contract_reference: `CTR-${companyIndex + 1}-01`, contract_start_date: dateOnly(CURRENT_YEAR, 2, 1), contract_end_date: dateOnly(CURRENT_YEAR, 12, 31), purchase_date: null, purchase_cost: null, rental_rate: 260, billing_cycle: 'monthly', notes: 'Seeded material asset' });
      tableRows.material_assets.push({ id: uuidFromSeed(`${email}:material-asset:${company.id}:3`), company_id: company.id, category_id: materialCategoryOpsId, asset_code: `MAT-${companyIndex + 1}-003`, asset_name: 'Portable Scanner', status: 'maintenance', unit_usage_cost: 18, unit_of_measure: 'hour', cost_center_id: null, linked_fixed_asset_id: null, acquisition_mode: 'service', supplier_id: null, contract_reference: null, contract_start_date: null, contract_end_date: null, purchase_date: null, purchase_cost: null, rental_rate: null, billing_cycle: null, notes: 'Seeded material asset' });

      const companyProjects = (projects || []).filter((project) => project.company_id === company.id);
      const companyTimesheets = (timesheets || []).filter((timesheet) => (timesheet.company_id || projectById.get(timesheet.project_id)?.company_id) === company.id);
      for (let i = 0; i < Math.min(4, members.length); i += 1) {
        const timesheet = companyTimesheets[i] || null;
        const project = timesheet ? projectById.get(timesheet.project_id) : (companyProjects[i % Math.max(1, companyProjects.length)] || null);
        if (!project) continue;
        const member = members[i];
        const amount = round((Number(timesheet?.duration_minutes || 240) / 60) * Number(timesheet?.hourly_rate || 95));
        const plannedPaymentDate = dateOnly(CURRENT_YEAR, 3, 20 + i);
        const paymentStatus = ['planned', 'approved', 'paid', 'planned'][i % 4];
        tableRows.team_member_compensations.push({ id: uuidFromSeed(`${email}:compensation:${company.id}:${i}`), user_id: userId, company_id: company.id, project_id: project.id, team_member_id: member.id, task_id: timesheet?.task_id || (tasksByProject.get(project.id)?.[0]?.id || null), timesheet_id: timesheet?.id || null, amount, compensation_type: ['hourly', 'bonus', 'fixed'][i % 3], payment_status: paymentStatus, planned_payment_date: plannedPaymentDate, paid_at: paymentStatus === 'paid' ? ts(plannedPaymentDate, 16) : null, payment_reference: paymentStatus === 'paid' ? `PAY-${companyIndex + 1}-${i + 1}` : null, notes: 'Seeded compensation row' });
      }
    }

    await upsertRows('team_members', updatedTeamMembers, 'id');
    await upsertRows('hr_employees', updatedEmployees, 'id');

    const orderedTables = [
      'hr_departments',
      'hr_work_calendars',
      'hr_leave_types',
      'hr_employee_contracts',
      'hr_employee_skills',
      'hr_leave_requests',
      'hr_payroll_periods',
      'hr_payroll_variable_items',
      'hr_payroll_anomalies',
      'hr_payroll_exports',
      'hr_job_positions',
      'hr_candidates',
      'hr_applications',
      'hr_interview_sessions',
      'hr_onboarding_plans',
      'hr_training_catalog',
      'hr_training_enrollments',
      'hr_skill_assessments',
      'hr_performance_reviews',
      'hr_succession_plans',
      'hr_headcount_budgets',
      'hr_surveys',
      'hr_survey_responses',
      'hr_risk_assessments',
      'material_categories',
      'material_assets',
      'team_member_compensations',
    ];
    for (const tableName of orderedTables) {
      await upsertRows(tableName, tableRows[tableName] || [], 'id');
    }

    const employeeRowsForUpdate = updatedEmployees.map((employee) => {
      const department = tableRows.hr_departments.find((row) => row.company_id === employee.company_id);
      const calendar = tableRows.hr_work_calendars.find((row) => row.company_id === employee.company_id);
      const sameCompanyEmployees = updatedEmployees.filter((row) => row.company_id === employee.company_id);
      return {
        ...employee,
        department_id: department?.id || null,
        work_calendar_id: calendar?.id || null,
        manager_employee_id: sameCompanyEmployees[0]?.id === employee.id ? null : (sameCompanyEmployees[0]?.id || null),
      };
    });
    await upsertRows('hr_employees', employeeRowsForUpdate, 'id');

    console.log(`[ok] ${email}: companies=${companyIds.length}, teamMembers=${updatedTeamMembers.length}, hrEmployees=${updatedEmployees.length}`);
  }

  console.log('HR demo backfill completed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
