import { execFileSync } from 'node:child_process';

function listHistoryObjects() {
  const output = execFileSync('git', ['rev-list', '--all', '--objects'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstSpace = line.indexOf(' ');
      if (firstSpace === -1) return { hash: line, path: '' };
      return {
        hash: line.slice(0, firstSpace),
        path: line.slice(firstSpace + 1),
      };
    });
}

function isForbiddenEnvPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized) return false;
  const base = normalized.split('/').pop() || '';
  if (!base.startsWith('.env')) return false;
  return base !== '.env.example';
}

function main() {
  const offenders = listHistoryObjects().filter((item) => isForbiddenEnvPath(item.path));

  if (offenders.length > 0) {
    console.error('Git history env guard failed: forbidden env files found in commit history.');
    for (const offender of offenders.slice(0, 50)) {
      console.error(`- ${offender.path} (${offender.hash})`);
    }
    if (offenders.length > 50) {
      console.error(`... and ${offenders.length - 50} more`);
    }
    process.exit(1);
  }

  console.log('Git history env guard passed.');
}

main();
