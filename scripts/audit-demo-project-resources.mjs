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

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function buildProjectSummary({
  projects,
  tasks,
  timesheets,
  allocations,
  teamNameById,
}) {
  const tasksByProject = groupBy(tasks, (item) => item.project_id || '__none__');
  const timesheetsByProject = groupBy(timesheets, (item) => item.project_id || '__none__');
  const allocationsByProject = groupBy(allocations, (item) => item.project_id || '__none__');

  return (projects || []).map((project) => {
    const projectTasks = tasksByProject.get(project.id) || [];
    const projectTimesheets = timesheetsByProject.get(project.id) || [];
    const projectAllocations = allocationsByProject.get(project.id) || [];

    const assignedTaskMembers = new Set(
      projectTasks.map((task) => task.assigned_member_id).filter(Boolean),
    );
    const executedTimesheetMembers = new Set(
      projectTimesheets.map((timesheet) => timesheet.executed_by_member_id).filter(Boolean),
    );

    const allocationHumanMembers = new Set(
      projectAllocations
        .filter((allocation) => allocation.resource_type === 'human')
        .map((allocation) => allocation.team_member_id)
        .filter(Boolean),
    );

    const referencedMemberNames = new Set([
      ...assignedTaskMembers,
      ...executedTimesheetMembers,
      ...allocationHumanMembers,
    ].map((memberId) => teamNameById.get(memberId) || memberId));

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
      resourceNames: Array.from(referencedMemberNames).sort((a, b) => a.localeCompare(b)),
    };
  });
}

async function queryUserScopeRows(client) {
  const [
    projectsRes,
    teamMembersRes,
    tasksRes,
    timesheetsRes,
    allocationsRes,
  ] = await Promise.all([
    client.from('projects').select('id,name,company_id,status').order('name', { ascending: true }),
    client.from('team_members').select('id,name').order('name', { ascending: true }),
    client.from('tasks').select('id,project_id,assigned_to,assigned_member_id'),
    client.from('timesheets').select('id,project_id,task_id,executed_by_member_id,duration_minutes,billable,status,date'),
    client.from('project_resource_allocations').select('id,project_id,resource_type,team_member_id,resource_name,planned_quantity,actual_quantity,status'),
  ]);

  for (const [label, result] of [
    ['projects', projectsRes],
    ['team_members', teamMembersRes],
    ['tasks', tasksRes],
    ['timesheets', timesheetsRes],
    ['project_resource_allocations', allocationsRes],
  ]) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
  }

  return {
    projects: projectsRes.data || [],
    teamMembers: teamMembersRes.data || [],
    tasks: tasksRes.data || [],
    timesheets: timesheetsRes.data || [],
    allocations: allocationsRes.data || [],
  };
}

async function auditAccount({ key, email, password }, supabaseUrl, anonKey) {
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

  const rows = await queryUserScopeRows(client);
  const teamNameById = new Map((rows.teamMembers || []).map((member) => [member.id, member.name || member.id]));
  const projects = buildProjectSummary({
    projects: rows.projects,
    tasks: rows.tasks,
    timesheets: rows.timesheets,
    allocations: rows.allocations,
    teamNameById,
  });

  return {
    key,
    email,
    totals: {
      projects: rows.projects.length,
      teamMembers: rows.teamMembers.length,
      tasks: rows.tasks.length,
      timesheets: rows.timesheets.length,
      allocations: rows.allocations.length,
      timesheetsWithExecutedMember: rows.timesheets.filter((timesheet) => !!timesheet.executed_by_member_id).length,
      tasksWithAssignedMember: rows.tasks.filter((task) => !!task.assigned_member_id).length,
    },
    projects,
  };
}

async function main() {
  const supabaseUrl = requireValue('SUPABASE_URL or VITE_SUPABASE_URL', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const anonKey = requireValue('SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

  const output = [];
  for (const account of DEMO_ACCOUNTS) {
    const result = await auditAccount(account, supabaseUrl, anonKey);
    output.push(result);
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), accounts: output }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
