import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    args[key] = value;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const scriptPath = args.script || 'scripts/load-test-cashpilot.js';
const profile = args.profile || 'peak';
const baseUrl = args.baseUrl || process.env.BASE_URL || 'https://cashpilot.tech';
const reportDir = args.reportDir || process.env.LOAD_TEST_REPORT_DIR || 'artifacts/load-tests';

mkdirSync(reportDir, { recursive: true });

const workspace = process.cwd();
const containerReportDir = `/work/${reportDir.replace(/\\/g, '/')}`;
const scriptInContainer = `/work/${scriptPath.replace(/\\/g, '/')}`;

const envPairs = [
  ['BASE_URL', baseUrl],
  ['K6_PROFILE', profile],
  ['LOAD_TEST_REPORT_DIR', containerReportDir],
];

const dockerArgs = [
  'run',
  '--rm',
  ...envPairs.flatMap(([key, value]) => ['-e', `${key}=${value}`]),
  '-v',
  `${workspace}:/work`,
  '-w',
  '/work',
  'grafana/k6:0.53.0',
  'run',
  scriptInContainer,
];

const result = spawnSync('docker', dockerArgs, {
  stdio: 'inherit',
  shell: false,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
