import { execSync } from 'node:child_process';
import process from 'node:process';

const PHASES = [
  { effectiveFrom: '2026-01-01', maxWarnings: 90, label: 'phase-1' },
  { effectiveFrom: '2026-05-01', maxWarnings: 70, label: 'phase-2' },
  { effectiveFrom: '2026-07-01', maxWarnings: 50, label: 'phase-3' },
  { effectiveFrom: '2026-09-01', maxWarnings: 30, label: 'phase-4' },
];

function resolvePhase(referenceDate) {
  let active = PHASES[0];
  for (const phase of PHASES) {
    if (new Date(phase.effectiveFrom) <= referenceDate) {
      active = phase;
    }
  }
  return active;
}

function runLintJsonReport() {
  try {
    const output = execSync('npx eslint src --format json', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 50,
    });
    return JSON.parse(output || '[]');
  } catch (error) {
    const stdout = String(error?.stdout || '').trim();
    if (!stdout) {
      throw error;
    }
    return JSON.parse(stdout);
  }
}

function countDiagnostics(report) {
  let warnings = 0;
  let errors = 0;

  for (const fileResult of report) {
    for (const message of fileResult.messages || []) {
      if (message.severity === 1) warnings += 1;
      if (message.severity === 2) errors += 1;
    }
  }

  return { warnings, errors };
}

async function run() {
  const report = runLintJsonReport();
  const { warnings, errors } = countDiagnostics(report);

  if (errors > 0) {
    console.error(`[guard-eslint-warning-budget] ESLint has ${errors} error(s).`);
    process.exit(1);
  }

  const referenceDate = process.env.ESLINT_WARNING_BUDGET_DATE
    ? new Date(process.env.ESLINT_WARNING_BUDGET_DATE)
    : new Date();

  if (Number.isNaN(referenceDate.getTime())) {
    console.error('[guard-eslint-warning-budget] Invalid ESLINT_WARNING_BUDGET_DATE.');
    process.exit(1);
  }

  const phase = resolvePhase(referenceDate);
  const maxWarnings = process.env.ESLINT_WARNING_BUDGET_MAX
    ? Number.parseInt(process.env.ESLINT_WARNING_BUDGET_MAX, 10)
    : phase.maxWarnings;

  if (!Number.isFinite(maxWarnings)) {
    console.error('[guard-eslint-warning-budget] Invalid ESLINT_WARNING_BUDGET_MAX.');
    process.exit(1);
  }

  if (warnings > maxWarnings) {
    console.error(
      `[guard-eslint-warning-budget] Warning budget exceeded: ${warnings}/${maxWarnings} (phase=${phase.label}).`,
    );
    process.exit(1);
  }

  const nextPhase = PHASES.find((candidate) => new Date(candidate.effectiveFrom) > referenceDate);
  const nextPhaseHint = nextPhase
    ? ` Next phase ${nextPhase.label} starts ${nextPhase.effectiveFrom} with max=${nextPhase.maxWarnings}.`
    : '';

  console.log(
    `[guard-eslint-warning-budget] OK: ${warnings}/${maxWarnings} warning(s) (phase=${phase.label}).${nextPhaseHint}`,
  );
}

run().catch((error) => {
  console.error('[guard-eslint-warning-budget] fatal:', error?.message || error);
  process.exit(1);
});
