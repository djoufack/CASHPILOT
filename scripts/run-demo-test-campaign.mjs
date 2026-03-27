#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = process.cwd();
const ARTIFACTS_DIR = path.resolve(ROOT_DIR, 'artifacts', 'test-campaign');
const CHECKLIST_TEMPLATE_PATH = path.resolve(ROOT_DIR, 'docs', 'plans', 'cashpilot-demo-test-checklist.csv');
const NODE_BIN = process.execPath;
const VITE_BIN = path.resolve(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function optionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

const ACCOUNT_CONFIG = [
  {
    key: 'FR',
    defaultEmail: 'pilotage.fr.demo@cashpilot.cloud',
    pilotageEmailEnv: 'PILOTAGE_FR_EMAIL',
    pilotagePasswordEnv: 'PILOTAGE_FR_PASSWORD',
    demoEmailEnv: 'DEMO_USER_EMAIL_FR',
    demoPasswordEnv: 'DEMO_USER_PASSWORD_FR',
  },
  {
    key: 'BE',
    defaultEmail: 'pilotage.be.demo@cashpilot.cloud',
    pilotageEmailEnv: 'PILOTAGE_BE_EMAIL',
    pilotagePasswordEnv: 'PILOTAGE_BE_PASSWORD',
    demoEmailEnv: 'DEMO_USER_EMAIL_BE',
    demoPasswordEnv: 'DEMO_USER_PASSWORD_BE',
  },
  {
    key: 'OHADA',
    defaultEmail: 'pilotage.ohada.demo@cashpilot.cloud',
    pilotageEmailEnv: 'PILOTAGE_OHADA_EMAIL',
    pilotagePasswordEnv: 'PILOTAGE_OHADA_PASSWORD',
    demoEmailEnv: 'DEMO_USER_EMAIL_OHADA',
    demoPasswordEnv: 'DEMO_USER_PASSWORD_OHADA',
  },
];

const DEMO_ACCOUNTS = ACCOUNT_CONFIG.map((config) => ({
  key: config.key,
  email: firstNonEmpty(
    process.env[config.pilotageEmailEnv],
    process.env[config.demoEmailEnv],
    config.defaultEmail,
  ),
  password: firstNonEmpty(
    process.env[config.pilotagePasswordEnv],
    process.env[config.demoPasswordEnv],
  ),
  passwordEnv: config.pilotagePasswordEnv,
  pilotageEmailEnv: config.pilotageEmailEnv,
  demoEmailEnv: config.demoEmailEnv,
  demoPasswordEnv: config.demoPasswordEnv,
}));

function parseArgs(argv) {
  const options = {
    previewHost: '127.0.0.1',
    previewPort: Number.parseInt(process.env.CAMPAIGN_PREVIEW_PORT || '4173', 10),
    failFast: false,
    skipBuild: false,
    skipNavigation: false,
    skipPilotageUi: false,
    skipSmokeCleanup: false,
  };

  for (const arg of argv) {
    if (arg === '--fail-fast') options.failFast = true;
    if (arg === '--skip-build') options.skipBuild = true;
    if (arg === '--skip-navigation') options.skipNavigation = true;
    if (arg === '--skip-pilotage-ui') options.skipPilotageUi = true;
    if (arg === '--skip-smoke-cleanup') options.skipSmokeCleanup = true;
    if (arg.startsWith('--preview-host=')) options.previewHost = String(arg.split('=', 2)[1] || options.previewHost).trim();
    if (arg.startsWith('--preview-port=')) {
      const parsed = Number.parseInt(arg.split('=', 2)[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) options.previewPort = parsed;
    }
  }

  return options;
}

function nowIso() {
  return new Date().toISOString();
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  fields.push(current);
  return fields;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readChecklistRows(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error(`Checklist template has no rows: ${filePath}`);
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = values[i] ?? '';
    }
    return row;
  });

  return { headers, rows };
}

async function getUserByEmail(serviceClient, email) {
  let page = 1;
  while (page <= 30) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = (data?.users || []).find((entry) => String(entry.email || '').toLowerCase() === String(email).toLowerCase());
    if (user) return user;
    if (!data?.users?.length) break;
    page += 1;
  }
  return null;
}

function isRowApplicableToAccount(templateRow, accountKey) {
  const applicability = String(templateRow.applicability || 'ALL').toUpperCase();
  if (applicability === 'ALL') return true;
  if (applicability === 'OHADA_ONLY') return accountKey === 'OHADA';
  return true;
}

async function generateExecutionMatrix({ runDir, runId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      reason: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, matrix generation skipped.',
      outputPath: null,
      totalRows: 0,
    };
  }

  const { headers, rows } = await readChecklistRows(CHECKLIST_TEMPLATE_PATH);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const expandedRows = [];
  const accountCompanyIndex = {};

  for (const account of DEMO_ACCOUNTS) {
    const user = await getUserByEmail(serviceClient, account.email);
    if (!user) {
      accountCompanyIndex[account.key] = [];
      continue;
    }

    const { data: companies, error: companiesError } = await serviceClient
      .from('company')
      .select('id, company_name')
      .eq('user_id', user.id)
      .order('company_name', { ascending: true });

    if (companiesError) {
      throw companiesError;
    }

    accountCompanyIndex[account.key] = companies || [];
  }

  for (const templateRow of rows) {
    for (const account of DEMO_ACCOUNTS) {
      if (!isRowApplicableToAccount(templateRow, account.key)) continue;

      const companyScope = String(templateRow.company_scope || '');
      const companies = accountCompanyIndex[account.key] || [];

      if (companyScope === 'EACH_PORTFOLIO_COMPANY') {
        if (!companies.length) {
          expandedRows.push({
            run_id: runId,
            account_key: account.key,
            account_email: account.email,
            company_id: '',
            company_name: '',
            result_status: 'BLOCKED_NO_COMPANY',
            executed_at: '',
            failing_step: '',
            ...templateRow,
          });
          continue;
        }

        for (const company of companies) {
          expandedRows.push({
            run_id: runId,
            account_key: account.key,
            account_email: account.email,
            company_id: company.id,
            company_name: company.company_name,
            result_status: 'PENDING',
            executed_at: '',
            failing_step: '',
            ...templateRow,
          });
        }
        continue;
      }

      expandedRows.push({
        run_id: runId,
        account_key: account.key,
        account_email: account.email,
        company_id: '',
        company_name: '',
        result_status: 'PENDING',
        executed_at: '',
        failing_step: '',
        ...templateRow,
      });
    }
  }

  const outputHeaders = [
    'run_id',
    'account_key',
    'account_email',
    'company_id',
    'company_name',
    ...headers,
    'result_status',
    'executed_at',
    'failing_step',
  ];
  const lines = [outputHeaders.join(',')];
  for (const row of expandedRows) {
    lines.push(outputHeaders.map((header) => csvEscape(row[header] ?? '')).join(','));
  }

  const outputPath = path.join(runDir, 'execution-matrix.csv');
  await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');

  return {
    ok: true,
    reason: null,
    outputPath,
    totalRows: expandedRows.length,
  };
}

function runCommand({ command, args, cwd, env, logFilePath, timeoutMs = 20 * 60 * 1000 }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    const writeChunk = async (chunk) => {
      await fs.appendFile(logFilePath, chunk);
    };

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
      void writeChunk(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
      void writeChunk(text);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code: code ?? (signal ? 1 : 0),
        signal: signal || null,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

async function waitForHttpReady(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status < 500) return true;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function isPortFree(host, port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(host, preferredPort, maxAttempts = 20) {
  let port = preferredPort;
  for (let i = 0; i < maxAttempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(host, port);
    if (free) return port;
    port += 1;
  }
  return preferredPort;
}

async function runCampaign() {
  const options = parseArgs(process.argv.slice(2));
  const campaignEmails = DEMO_ACCOUNTS.map((account) => String(account.email || '').toLowerCase()).filter(Boolean).join(',');
  const auditMin = Number.parseInt(process.env.CAMPAIGN_AUDIT_MIN || '7', 10);
  const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const runDir = path.join(ARTIFACTS_DIR, runId);
  await ensureDir(runDir);
  const logsDir = path.join(runDir, 'logs');
  await ensureDir(logsDir);

  const matrix = await generateExecutionMatrix({ runDir, runId }).catch((error) => ({
    ok: false,
    reason: `Matrix generation failed: ${error?.message || String(error)}`,
    outputPath: null,
    totalRows: 0,
  }));

  const steps = [];
  let baseUrl = `http://${options.previewHost}:${options.previewPort}`;
  let shouldStop = false;
  const sharedRuntimeEnv = DEMO_ACCOUNTS.reduce((env, account) => {
    env[account.pilotageEmailEnv] = account.email;
    env[account.passwordEnv] = account.password;
    env[account.demoEmailEnv] = account.email;
    env[account.demoPasswordEnv] = account.password;
    return env;
  }, {});

  const addStep = async ({ id, title, command, args = [], env = {}, timeoutMs, force = false }) => {
    if (shouldStop && !force) return;
    const logFilePath = path.join(logsDir, `${id}.log`);
    await fs.writeFile(logFilePath, `# ${id}\n# started_at=${nowIso()}\n# command=${[command, ...args].join(' ')}\n\n`);
    const result = await runCommand({ command, args, cwd: ROOT_DIR, env: { ...sharedRuntimeEnv, ...env }, logFilePath, timeoutMs });
    const ok = result.code === 0 && !result.timedOut;
    steps.push({
      id,
      title,
      ok,
      exitCode: result.code,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      logFile: logFilePath,
      startedAt: new Date(Date.now() - result.durationMs).toISOString(),
      finishedAt: nowIso(),
    });
    if (!ok && options.failFast && !force) shouldStop = true;
  };

  for (const account of DEMO_ACCOUNTS) {
    if (!account.password) {
      steps.push({
        id: `preflight_${account.key.toLowerCase()}_password`,
        title: `Preflight password ${account.key}`,
        ok: false,
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
        logFile: null,
        startedAt: nowIso(),
        finishedAt: nowIso(),
        note: `Missing ${account.passwordEnv} (or ${account.demoPasswordEnv})`,
      });
      if (options.failFast) shouldStop = true;
    }
  }

  if (!shouldStop) {
    await addStep({
      id: 'audit_demo_thresholds',
      title: 'Audit demo thresholds',
      command: NODE_BIN,
      args: [
        'scripts/audit-demo-thresholds.mjs',
        `--emails=${campaignEmails}`,
        `--min=${Number.isFinite(auditMin) && auditMin > 0 ? auditMin : 7}`,
      ],
    });
  }

  await addStep({
    id: 'verify_accounting_company_scope',
    title: 'Verify accounting company scope',
    command: NODE_BIN,
    args: ['scripts/verify-accounting-company-scope.mjs'],
  });

  await addStep({
    id: 'smoke_demo_user_crud',
    title: 'Smoke demo user CRUD',
    command: NODE_BIN,
    args: ['scripts/smoke-demo-user-crud.mjs'],
  });

  await addStep({
    id: 'smoke_demo_user_hr_flows',
    title: 'Smoke demo user HR flows',
    command: NODE_BIN,
    args: ['scripts/smoke-demo-user-hr-flows.mjs'],
  });

  if (!options.skipBuild) {
    await addStep({
      id: 'build',
      title: 'Build frontend',
      command: NODE_BIN,
      args: [VITE_BIN, 'build'],
      timeoutMs: 30 * 60 * 1000,
    });
  }

  let previewProcess = null;
  let previewLogPath = null;
  try {
    if (!options.skipNavigation || !options.skipPilotageUi) {
      const selectedPort = await findAvailablePort(options.previewHost, options.previewPort, 25);
      baseUrl = `http://${options.previewHost}:${selectedPort}`;

      previewLogPath = path.join(logsDir, 'vite-preview.log');
      await fs.writeFile(previewLogPath, '# vite preview\n');
      previewProcess = spawn(
        NODE_BIN,
        [VITE_BIN, 'preview', '--host', options.previewHost, '--port', String(selectedPort), '--strictPort'],
        {
          cwd: ROOT_DIR,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
        },
      );
      previewProcess.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        process.stdout.write(text);
        void fs.appendFile(previewLogPath, text);
      });
      previewProcess.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        process.stderr.write(text);
        void fs.appendFile(previewLogPath, text);
      });

      let processExited = false;
      previewProcess.on('exit', () => {
        processExited = true;
      });

      const ready = await waitForHttpReady(`${baseUrl}/`, 90 * 1000);
      if (!ready || processExited) {
        steps.push({
          id: 'preview_start',
          title: 'Start preview server',
          ok: false,
          exitCode: 1,
          durationMs: 0,
          timedOut: false,
          logFile: previewLogPath,
          startedAt: nowIso(),
          finishedAt: nowIso(),
          note: processExited
            ? `Preview process exited before becoming ready (${baseUrl})`
            : `Preview server not reachable at ${baseUrl}`,
        });
        shouldStop = true;
      } else {
        steps.push({
          id: 'preview_start',
          title: 'Start preview server',
          ok: true,
          exitCode: 0,
          durationMs: 0,
          timedOut: false,
          logFile: previewLogPath,
          startedAt: nowIso(),
          finishedAt: nowIso(),
          note: selectedPort !== options.previewPort
            ? `Preview ready at ${baseUrl} (port ${options.previewPort} busy, auto-shifted)`
            : `Preview ready at ${baseUrl}`,
        });
      }
    }

    if (!shouldStop && !options.skipNavigation) {
      await addStep({
        id: 'smoke_navigation_responsive',
        title: 'Smoke navigation responsive',
        command: NODE_BIN,
        args: ['scripts/smoke-navigation-responsive-playwright.mjs'],
        env: { NAV_SMOKE_BASE_URL: baseUrl },
      });
    }

    if (!shouldStop && !options.skipPilotageUi) {
      await addStep({
        id: 'smoke_pilotage_ui',
        title: 'Smoke pilotage UI',
        command: NODE_BIN,
        args: ['scripts/smoke-pilotage-ui-playwright.mjs'],
        env: { SMOKE_UI_BASE_URL: baseUrl },
      });
    }
  } finally {
    if (previewProcess && !previewProcess.killed) {
      previewProcess.kill('SIGTERM');
    }
  }

  if (!options.skipSmokeCleanup) {
    await addStep({
      id: 'cleanup_smoke_users',
      title: 'Cleanup smoke users',
      command: NODE_BIN,
      args: ['scripts/cleanup-smoke-users.mjs'],
      env: {
        SMOKE_CLEANUP_MIN_AGE_MINUTES: optionalEnv('CAMPAIGN_SMOKE_CLEANUP_MIN_AGE_MINUTES', '0'),
      },
      timeoutMs: 15 * 60 * 1000,
      force: true,
    });
  }

  const passedSteps = steps.filter((step) => step.ok).length;
  const failedSteps = steps.length - passedSteps;
  const summary = {
    runId,
    startedAt: nowIso(),
    finishedAt: nowIso(),
    options,
    artifacts: {
      runDir,
      logsDir,
      matrix,
      externalSummaries: {
        demoUserCrud: path.resolve(ROOT_DIR, 'artifacts', 'demo-user-crud', 'summary.json'),
        demoUserHrFlows: path.resolve(ROOT_DIR, 'artifacts', 'demo-user-hr-flows', 'summary.json'),
        navigation: path.resolve(ROOT_DIR, 'artifacts', 'playwright-navigation', 'summary.json'),
        pilotageUi: path.resolve(ROOT_DIR, 'artifacts', 'playwright-smoke', 'summary.json'),
      },
    },
    totals: {
      totalSteps: steps.length,
      passedSteps,
      failedSteps,
    },
    steps,
  };

  const summaryPath = path.join(runDir, 'summary.json');
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const mdLines = [
    `# Demo Test Campaign Summary (${runId})`,
    '',
    `- Total steps: ${summary.totals.totalSteps}`,
    `- Passed: ${summary.totals.passedSteps}`,
    `- Failed: ${summary.totals.failedSteps}`,
    `- Matrix: ${matrix.outputPath || 'not generated'}`,
    '',
    '## Steps',
    '',
  ];
  for (const step of steps) {
    const status = step.ok ? 'PASS' : 'FAIL';
    mdLines.push(`- [${status}] ${step.id} (${step.title})`);
    if (step.logFile) {
      mdLines.push(`  log: ${step.logFile}`);
    }
    if (step.note) {
      mdLines.push(`  note: ${step.note}`);
    }
  }
  mdLines.push('', '## External Artifacts', '');
  mdLines.push(`- demo-user-crud: ${summary.artifacts.externalSummaries.demoUserCrud}`);
  mdLines.push(`- demo-user-hr-flows: ${summary.artifacts.externalSummaries.demoUserHrFlows}`);
  mdLines.push(`- navigation: ${summary.artifacts.externalSummaries.navigation}`);
  mdLines.push(`- pilotage-ui: ${summary.artifacts.externalSummaries.pilotageUi}`);

  const markdownPath = path.join(runDir, 'summary.md');
  await fs.writeFile(markdownPath, `${mdLines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({
    runId,
    passedSteps,
    failedSteps,
    summaryPath,
    markdownPath,
    matrixPath: matrix.outputPath,
  }, null, 2));

  if (failedSteps > 0) {
    process.exitCode = 1;
  }
}

runCampaign().catch((error) => {
  console.error('[run-demo-test-campaign] fatal:', error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
