import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const DEMO_ACCOUNTS = [
  {
    key: 'FR',
    email: process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_FR_PASSWORD || '',
  },
  {
    key: 'BE',
    email: process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_BE_PASSWORD || '',
  },
  {
    key: 'OHADA',
    email: process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_OHADA_PASSWORD || '',
  },
];

function requireValue(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required value: ${name}`);
  }
  return String(value).trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function parseArguments(argv) {
  const options = {
    from: null,
    to: null,
    strict: argv.includes('--strict'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--from=')) {
      options.from = String(arg.slice('--from='.length) || '').trim() || null;
    } else if (arg.startsWith('--to=')) {
      options.to = String(arg.slice('--to='.length) || '').trim() || null;
    }
  }

  return options;
}

function buildProjectSummary({
  projects,
  tasks,
  timesheets,
  allocations,
  baselines,
  milestones,
  compensations,
  teamNameById,
}) {
  const tasksByProject = groupBy(tasks, (item) => item.project_id || '__none__');
  const timesheetsByProject = groupBy(timesheets, (item) => item.project_id || '__none__');
  const allocationsByProject = groupBy(allocations, (item) => item.project_id || '__none__');
  const baselinesByProject = groupBy(baselines, (item) => item.project_id || '__none__');
  const milestonesByProject = groupBy(milestones, (item) => item.project_id || '__none__');
  const compensationsByProject = groupBy(compensations, (item) => item.project_id || '__none__');

  return (projects || []).map((project) => {
    const projectTasks = tasksByProject.get(project.id) || [];
    const projectTimesheets = timesheetsByProject.get(project.id) || [];
    const projectAllocations = allocationsByProject.get(project.id) || [];
    const projectBaselines = baselinesByProject.get(project.id) || [];
    const projectMilestones = milestonesByProject.get(project.id) || [];
    const projectCompensations = compensationsByProject.get(project.id) || [];

    const assignedTaskMembers = new Set(projectTasks.map((task) => task.assigned_member_id).filter(Boolean));
    const executedTimesheetMembers = new Set(
      projectTimesheets.map((timesheet) => timesheet.executed_by_member_id).filter(Boolean)
    );
    const allocationHumanMembers = new Set(
      projectAllocations
        .filter((allocation) => allocation.resource_type === 'human')
        .map((allocation) => allocation.team_member_id)
        .filter(Boolean)
    );
    const compensatedMembers = new Set(projectCompensations.map((row) => row.team_member_id).filter(Boolean));

    const referencedMemberNames = new Set(
      [...assignedTaskMembers, ...executedTimesheetMembers, ...allocationHumanMembers, ...compensatedMembers]
        .map((memberId) => teamNameById.get(memberId) || memberId)
    );

    const timesheetHours = projectTimesheets.reduce(
      (sum, timesheet) => sum + (toNumber(timesheet.duration_minutes) / 60),
      0
    );
    const timesheetCost = projectTimesheets.reduce(
      (sum, timesheet) => sum + ((toNumber(timesheet.duration_minutes) / 60) * toNumber(timesheet.hourly_rate)),
      0
    );
    const resourcePlannedCost = projectAllocations.reduce((sum, row) => sum + toNumber(row.planned_cost), 0);
    const resourceActualCost = projectAllocations.reduce((sum, row) => sum + toNumber(row.actual_cost), 0);
    const compensationAmount = projectCompensations.reduce((sum, row) => sum + toNumber(row.amount), 0);

    const baselineVersions = projectBaselines
      .map((baseline) => toNumber(baseline.version))
      .filter((version) => version > 0)
      .sort((a, b) => a - b);
    const activeBaselineVersion = projectBaselines.find((baseline) => baseline.is_active)?.version || null;

    return {
      projectId: project.id,
      projectName: project.name,
      tasks: projectTasks.length,
      tasksWithAssignedMember: projectTasks.filter((task) => !!task.assigned_member_id).length,
      timesheets: projectTimesheets.length,
      timesheetsWithExecutedMember: projectTimesheets.filter((timesheet) => !!timesheet.executed_by_member_id).length,
      unassignedTimesheets: projectTimesheets.filter((timesheet) => !timesheet.executed_by_member_id).length,
      resourceAllocations: projectAllocations.length,
      humanAllocations: projectAllocations.filter((allocation) => allocation.resource_type === 'human').length,
      materialAllocations: projectAllocations.filter((allocation) => allocation.resource_type === 'material').length,
      baselines: projectBaselines.length,
      baselineVersions,
      activeBaselineVersion,
      milestones: projectMilestones.length,
      achievedMilestones: projectMilestones.filter((milestone) => milestone.status === 'achieved').length,
      overdueMilestones: projectMilestones.filter((milestone) => milestone.status === 'overdue').length,
      compensations: projectCompensations.length,
      approvedOrPaidCompensations: projectCompensations.filter((row) => ['approved', 'paid'].includes(row.payment_status)).length,
      trackedTimesheetHours: Number(timesheetHours.toFixed(2)),
      trackedTimesheetCost: Number(timesheetCost.toFixed(2)),
      trackedResourcePlannedCost: Number(resourcePlannedCost.toFixed(2)),
      trackedResourceActualCost: Number(resourceActualCost.toFixed(2)),
      trackedCompensationCost: Number(compensationAmount.toFixed(2)),
      resourceNames: Array.from(referencedMemberNames).sort((a, b) => a.localeCompare(b)),
    };
  });
}

function buildTimesheetsByMemberSummary({ timesheets, teamNameById, range }) {
  const byMember = new Map();

  for (const timesheet of timesheets || []) {
    const memberId = timesheet.executed_by_member_id || '__unassigned__';
    if (!byMember.has(memberId)) {
      byMember.set(memberId, {
        memberId,
        memberName: teamNameById.get(memberId) || (memberId === '__unassigned__' ? 'Unassigned' : memberId),
        timesheets: 0,
        hours: 0,
        cost: 0,
        firstDate: null,
        lastDate: null,
      });
    }
    const aggregate = byMember.get(memberId);
    const date = String(timesheet.date || '').slice(0, 10) || null;
    aggregate.timesheets += 1;
    aggregate.hours += toNumber(timesheet.duration_minutes) / 60;
    aggregate.cost += (toNumber(timesheet.duration_minutes) / 60) * toNumber(timesheet.hourly_rate);
    if (date) {
      aggregate.firstDate = aggregate.firstDate ? [aggregate.firstDate, date].sort()[0] : date;
      aggregate.lastDate = aggregate.lastDate ? [aggregate.lastDate, date].sort().slice(-1)[0] : date;
    }
  }

  return {
    from: range.from,
    to: range.to,
    members: [...byMember.values()]
      .map((row) => ({
        ...row,
        hours: Number(row.hours.toFixed(2)),
        cost: Number(row.cost.toFixed(2)),
      }))
      .sort((a, b) => a.memberName.localeCompare(b.memberName)),
  };
}

function buildCoverageReport(projects) {
  const projectIdsWithoutBaselines = [];
  const projectIdsWithoutMilestones = [];
  const projectIdsWithoutResourceAllocations = [];
  const projectIdsWithoutTimesheets = [];

  for (const project of projects || []) {
    if ((project.baselines || 0) === 0) projectIdsWithoutBaselines.push(project.projectId);
    if ((project.milestones || 0) === 0) projectIdsWithoutMilestones.push(project.projectId);
    if ((project.resourceAllocations || 0) === 0) projectIdsWithoutResourceAllocations.push(project.projectId);
    if ((project.timesheets || 0) === 0) projectIdsWithoutTimesheets.push(project.projectId);
  }

  return {
    projectsWithoutBaselines: projectIdsWithoutBaselines,
    projectsWithoutMilestones: projectIdsWithoutMilestones,
    projectsWithoutResourceAllocations: projectIdsWithoutResourceAllocations,
    projectsWithoutTimesheets: projectIdsWithoutTimesheets,
    ok:
      projectIdsWithoutBaselines.length === 0
      && projectIdsWithoutMilestones.length === 0
      && projectIdsWithoutResourceAllocations.length === 0,
  };
}

async function queryUserScopeRows(client, range) {
  let timesheetsQuery = client
    .from('timesheets')
    .select('id,project_id,task_id,executed_by_member_id,duration_minutes,hourly_rate,billable,status,date');
  if (range.from) {
    timesheetsQuery = timesheetsQuery.gte('date', range.from);
  }
  if (range.to) {
    timesheetsQuery = timesheetsQuery.lte('date', range.to);
  }

  const [
    projectsRes,
    teamMembersRes,
    tasksRes,
    timesheetsRes,
    allocationsRes,
    baselinesRes,
    milestonesRes,
    compensationsRes,
  ] = await Promise.all([
    client.from('projects').select('id,name,company_id,status').order('name', { ascending: true }),
    client.from('team_members').select('id,name').order('name', { ascending: true }),
    client.from('tasks').select('id,project_id,assigned_to,assigned_member_id'),
    timesheetsQuery,
    client
      .from('project_resource_allocations')
      .select('id,project_id,resource_type,team_member_id,resource_name,planned_quantity,actual_quantity,planned_cost,actual_cost,status'),
    client
      .from('project_baselines')
      .select('id,project_id,version,is_active,planned_budget_hours,planned_budget_amount'),
    client
      .from('project_milestones')
      .select('id,project_id,status,planned_date,actual_date,planned_amount,settled_amount,settled_at'),
    client
      .from('team_member_compensations')
      .select('id,project_id,team_member_id,timesheet_id,amount,compensation_type,payment_status,planned_payment_date,paid_at'),
  ]);

  for (const [label, result] of [
    ['projects', projectsRes],
    ['team_members', teamMembersRes],
    ['tasks', tasksRes],
    ['timesheets', timesheetsRes],
    ['project_resource_allocations', allocationsRes],
    ['project_baselines', baselinesRes],
    ['project_milestones', milestonesRes],
    ['team_member_compensations', compensationsRes],
  ]) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
  }

  return {
    projects: projectsRes.data || [],
    teamMembers: teamMembersRes.data || [],
    tasks: tasksRes.data || [],
    timesheets: timesheetsRes.data || [],
    allocations: allocationsRes.data || [],
    baselines: baselinesRes.data || [],
    milestones: milestonesRes.data || [],
    compensations: compensationsRes.data || [],
  };
}

async function auditAccount({ key, email, password }, supabaseUrl, anonKey, range) {
  requireValue(`${key} password`, password);

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData?.user) {
    throw new Error(`[${key}] auth failed for ${email}: ${authError?.message || 'unknown error'}`);
  }

  const rows = await queryUserScopeRows(client, range);
  const teamNameById = new Map((rows.teamMembers || []).map((member) => [member.id, member.name || member.id]));
  const projects = buildProjectSummary({
    projects: rows.projects,
    tasks: rows.tasks,
    timesheets: rows.timesheets,
    allocations: rows.allocations,
    baselines: rows.baselines,
    milestones: rows.milestones,
    compensations: rows.compensations,
    teamNameById,
  });
  const coverage = buildCoverageReport(projects);
  const timesheetsByMember = buildTimesheetsByMemberSummary({
    timesheets: rows.timesheets,
    teamNameById,
    range,
  });

  return {
    key,
    email,
    period: {
      from: range.from,
      to: range.to,
    },
    totals: {
      projects: rows.projects.length,
      teamMembers: rows.teamMembers.length,
      tasks: rows.tasks.length,
      timesheets: rows.timesheets.length,
      allocations: rows.allocations.length,
      baselines: rows.baselines.length,
      milestones: rows.milestones.length,
      compensations: rows.compensations.length,
      timesheetsWithExecutedMember: rows.timesheets.filter((timesheet) => !!timesheet.executed_by_member_id).length,
      tasksWithAssignedMember: rows.tasks.filter((task) => !!task.assigned_member_id).length,
      trackedTimesheetCost: Number(
        rows.timesheets.reduce(
          (sum, row) => sum + ((toNumber(row.duration_minutes) / 60) * toNumber(row.hourly_rate)),
          0
        ).toFixed(2)
      ),
      trackedResourceCost: Number(rows.allocations.reduce((sum, row) => sum + toNumber(row.actual_cost), 0).toFixed(2)),
      trackedCompensationCost: Number(rows.compensations.reduce((sum, row) => sum + toNumber(row.amount), 0).toFixed(2)),
    },
    coverage,
    timesheetsByMember,
    projects,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const supabaseUrl = requireValue('SUPABASE_URL or VITE_SUPABASE_URL', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const anonKey = requireValue('SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

  const output = [];
  let hasStrictFailure = false;

  for (const account of DEMO_ACCOUNTS) {
    const result = await auditAccount(account, supabaseUrl, anonKey, options);
    output.push(result);
    if (options.strict && !result.coverage.ok) {
      hasStrictFailure = true;
    }
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), strict: options.strict, accounts: output }, null, 2));

  if (hasStrictFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
