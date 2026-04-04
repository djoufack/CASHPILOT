import { execFileSync } from 'node:child_process';

const SECRET_CHECKS = [
  {
    label: 'Supabase service role JWT in clear text',
    pattern: String.raw`SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[:=][[:space:]]*["']?eyJ[[:alnum:]_-]+\.[[:alnum:]_-]+\.[[:alnum:]_-]+`,
  },
  {
    label: 'Supabase service role key token in clear text',
    pattern: String.raw`SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[:=][[:space:]]*["']?sbp_[[:alnum:]_-]{16,}`,
  },
  {
    label: 'Stripe webhook secret in clear text',
    pattern: String.raw`STRIPE_WEBHOOK_SECRET[[:space:]]*[:=][[:space:]]*["']?whsec_[[:alnum:]]{16,}`,
  },
  {
    label: 'Database URL with credentials in clear text',
    pattern: String.raw`DATABASE_URL[[:space:]]*[:=][[:space:]]*["']?postgres(ql)?:\/\/[^"'[:space:]]+:[^"'[:space:]]+@[^"'[:space:]]+`,
  },
  {
    label: 'Yapily secret with concrete value',
    pattern: String.raw`YAPILY_SECRET[[:space:]]*[:=][[:space:]]*["']?[[:alnum:]._-]{24,}`,
  },
  {
    label: 'Supabase anon/service JWT in clear text',
    pattern:
      String.raw`(SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|anonKey)[[:space:]]*[:=][[:space:]]*["']?eyJ[[:alnum:]_-]+\.[[:alnum:]_-]+\.[[:alnum:]_-]+`,
  },
];

function findCommitsForPattern(pattern) {
  const output = execFileSync(
    'git',
    ['log', '--all', '--pretty=format:%H', '--extended-regexp', '-G', pattern],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  return Array.from(new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)));
}

function main() {
  const violations = [];

  for (const check of SECRET_CHECKS) {
    const commits = findCommitsForPattern(check.pattern);
    if (commits.length === 0) continue;
    violations.push({ label: check.label, commits });
  }

  if (violations.length > 0) {
    console.error('Git history secret guard failed. Concrete secrets detected in commit history:');
    for (const violation of violations) {
      console.error(`- ${violation.label}`);
      for (const commit of violation.commits.slice(0, 10)) {
        console.error(`  - ${commit}`);
      }
      if (violation.commits.length > 10) {
        console.error(`  ... and ${violation.commits.length - 10} more`);
      }
    }
    process.exit(1);
  }

  console.log('Git history secret guard passed.');
}

main();
