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

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value) {
  return Math.round(safeNumber(value) * 100) / 100;
}

async function queryScope(client) {
  const [
    projectsRes,
    timesheetsRes,
    compensationsRes,
    baselinesRes,
    milestonesRes,
    entriesRes,
  ] = await Promise.all([
    client.from('projects').select('id,name,company_id,client_id').order('name', { ascending: true }),
    client
      .from('timesheets')
      .select('id,project_id,date,duration_minutes,hourly_rate,billable,status,invoice_id,executed_by_member_id'),
    client
      .from('team_member_compensations')
      .select('id,project_id,timesheet_id,amount,payment_status,team_member_id'),
    client
      .from('project_baselines')
      .select('id,project_id,is_active,planned_budget_hours,planned_budget_amount'),
    client
      .from('project_milestones')
      .select('id,project_id,status,settled_amount'),
    client
      .from('accounting_entries')
      .select('id,source_type,source_id,debit,credit')
      .in('source_type', ['team_member_compensation', 'project_milestone', 'team_member_compensation_reversal', 'project_milestone_reversal']),
  ]);

  for (const [label, result] of [
    ['projects', projectsRes],
    ['timesheets', timesheetsRes],
    ['team_member_compensations', compensationsRes],
    ['project_baselines', baselinesRes],
    ['project_milestones', milestonesRes],
  ]) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
  }

  // accounting_entries may be denied by RLS in some contexts; keep audit usable.
  const accountingRows = entriesRes.error ? [] : (entriesRes.data || []);

  return {
    projects: projectsRes.data || [],
    timesheets: timesheetsRes.data || [],
    compensations: compensationsRes.data || [],
    baselines: baselinesRes.data || [],
    milestones: milestonesRes.data || [],
    accountingEntries: accountingRows,
    accountingEntriesError: entriesRes.error?.message || null,
  };
}

function summarizeAccount(rows) {
  const projectsById = new Map((rows.projects || []).map((project) => [project.id, project]));
  const timesheetsByProject = groupBy(rows.timesheets || [], (row) => row.project_id || '__none__');
  const compensationsByProject = groupBy(rows.compensations || [], (row) => row.project_id || '__none__');
  const baselinesByProject = groupBy(rows.baselines || [], (row) => row.project_id || '__none__');
  const milestonesByProject = groupBy(rows.milestones || [], (row) => row.project_id || '__none__');

  const compensationByTimesheet = new Map();
  for (const compensation of rows.compensations || []) {
    if (compensation?.timesheet_id) {
      compensationByTimesheet.set(compensation.timesheet_id, compensation);
    }
  }

  const entryBySource = new Map();
  const sourceBalance = new Map();
  for (const entry of rows.accountingEntries || []) {
    const key = `${entry.source_type}|${entry.source_id}`;
    if (!entryBySource.has(key)) {
      entryBySource.set(key, { count: 0, debit: 0, credit: 0 });
    }
    const current = entryBySource.get(key);
    current.count += 1;
    current.debit += safeNumber(entry.debit);
    current.credit += safeNumber(entry.credit);

    if (!sourceBalance.has(key)) {
      sourceBalance.set(key, { sourceType: entry.source_type, sourceId: entry.source_id, debit: 0, credit: 0 });
    }
    const balance = sourceBalance.get(key);
    balance.debit += safeNumber(entry.debit);
    balance.credit += safeNumber(entry.credit);
  }

  const unbalancedBatches = Array.from(sourceBalance.values())
    .map((batch) => ({
      ...batch,
      delta: round2(batch.debit - batch.credit),
    }))
    .filter((batch) => Math.abs(batch.delta) > 0.01);

  const projects = (rows.projects || []).map((project) => {
    const projectTimesheets = timesheetsByProject.get(project.id) || [];
    const projectCompensations = compensationsByProject.get(project.id) || [];
    const projectBaselines = baselinesByProject.get(project.id) || [];
    const projectMilestones = milestonesByProject.get(project.id) || [];

    const timesheetsWithRates = projectTimesheets.filter((row) => safeNumber(row.hourly_rate) > 0);
    const totalMinutes = projectTimesheets.reduce((sum, row) => sum + safeNumber(row.duration_minutes), 0);
    const billableAmount = projectTimesheets.reduce((sum, row) => {
      if (row.billable === false) return sum;
      const hours = safeNumber(row.duration_minutes) / 60;
      return sum + (hours * safeNumber(row.hourly_rate));
    }, 0);

    const compensationAmount = projectCompensations.reduce((sum, row) => sum + safeNumber(row.amount), 0);
    const compensatedTimesheetIds = new Set(projectCompensations.map((row) => row.timesheet_id).filter(Boolean));
    const timesheetsWithCompensation = projectTimesheets.filter((row) => compensatedTimesheetIds.has(row.id)).length;

    const milestoneJournalLines = projectMilestones.reduce((sum, milestone) => {
      const mainKey = `project_milestone|${milestone.id}`;
      const revKey = `project_milestone_reversal|${milestone.id}`;
      return sum + safeNumber(entryBySource.get(mainKey)?.count || 0) + safeNumber(entryBySource.get(revKey)?.count || 0);
    }, 0);

    const compensationJournalLines = projectCompensations.reduce((sum, compensation) => {
      const mainKey = `team_member_compensation|${compensation.id}`;
      const revKey = `team_member_compensation_reversal|${compensation.id}`;
      return sum + safeNumber(entryBySource.get(mainKey)?.count || 0) + safeNumber(entryBySource.get(revKey)?.count || 0);
    }, 0);

    return {
      projectId: project.id,
      projectName: project.name,
      totals: {
        timesheets: projectTimesheets.length,
        timesheetsWithRates: timesheetsWithRates.length,
        timesheetsWithCompensation,
        totalMinutes,
        billableAmount: round2(billableAmount),
      },
      financial: {
        avgHourlyRate: round2(
          timesheetsWithRates.length
            ? timesheetsWithRates.reduce((sum, row) => sum + safeNumber(row.hourly_rate), 0) / timesheetsWithRates.length
            : 0
        ),
        compensationRows: projectCompensations.length,
        compensationAmount: round2(compensationAmount),
        compensationStatus: {
          planned: projectCompensations.filter((row) => row.payment_status === 'planned').length,
          approved: projectCompensations.filter((row) => row.payment_status === 'approved').length,
          paid: projectCompensations.filter((row) => row.payment_status === 'paid').length,
          cancelled: projectCompensations.filter((row) => row.payment_status === 'cancelled').length,
        },
        baselineRows: projectBaselines.length,
        activeBaselines: projectBaselines.filter((row) => row.is_active).length,
        milestoneRows: projectMilestones.length,
        settledMilestoneAmount: round2(projectMilestones.reduce((sum, row) => sum + safeNumber(row.settled_amount), 0)),
      },
      accounting: {
        compensationJournalLines,
        milestoneJournalLines,
      },
    };
  });

  const allTimesheets = rows.timesheets || [];
  const allCompensations = rows.compensations || [];

  const totals = {
    projects: rows.projects.length,
    timesheets: allTimesheets.length,
    timesheetsWithRates: allTimesheets.filter((row) => safeNumber(row.hourly_rate) > 0).length,
    billableTimesheets: allTimesheets.filter((row) => row.billable !== false).length,
    totalBillableAmount: round2(allTimesheets.reduce((sum, row) => {
      if (row.billable === false) return sum;
      return sum + ((safeNumber(row.duration_minutes) / 60) * safeNumber(row.hourly_rate));
    }, 0)),
    compensations: allCompensations.length,
    totalCompensationAmount: round2(allCompensations.reduce((sum, row) => sum + safeNumber(row.amount), 0)),
    baselines: rows.baselines.length,
    milestones: rows.milestones.length,
    accountingEntryLines: rows.accountingEntries.length,
    accountingUnbalancedBatches: unbalancedBatches.length,
  };

  return {
    totals,
    accountingEntriesError: rows.accountingEntriesError,
    accountingUnbalancedExamples: unbalancedBatches.slice(0, 10),
    projects,
  };
}

async function auditAccount(account, supabaseUrl, anonKey) {
  requireValue(`${account.key} password`, account.password);

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (authError || !authData?.user) {
    throw new Error(`[${account.key}] auth failed for ${account.email}: ${authError?.message || 'unknown error'}`);
  }

  const rows = await queryScope(client);
  const summary = summarizeAccount(rows);

  return {
    key: account.key,
    email: account.email,
    ...summary,
  };
}

async function main() {
  const supabaseUrl = requireValue('SUPABASE_URL or VITE_SUPABASE_URL', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const anonKey = requireValue('SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

  const output = [];
  for (const account of DEMO_ACCOUNTS) {
    try {
      const result = await auditAccount(account, supabaseUrl, anonKey);
      output.push(result);
    } catch (error) {
      output.push({
        key: account.key,
        email: account.email,
        error: error?.message || String(error),
      });
    }
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), accounts: output }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
