import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { ESLint } from 'eslint';

function sortByCountDesc(entries) {
  return entries.sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

async function run() {
  const eslint = new ESLint({
    cwd: process.cwd(),
    fix: false,
    ignore: true,
  });

  const report = await eslint.lintFiles(['.']);
  const byRule = new Map();
  const byFile = new Map();

  let totalWarnings = 0;
  let totalErrors = 0;

  for (const fileResult of report) {
    const filePath = fileResult.filePath;
    const warningsInFile = (fileResult.messages || []).filter((message) => message.severity === 1);
    const errorsInFile = (fileResult.messages || []).filter((message) => message.severity === 2);

    totalWarnings += warningsInFile.length;
    totalErrors += errorsInFile.length;

    if (warningsInFile.length > 0) {
      byFile.set(filePath, (byFile.get(filePath) || 0) + warningsInFile.length);
    }

    for (const warning of warningsInFile) {
      const ruleId = warning.ruleId || 'unknown';
      byRule.set(ruleId, (byRule.get(ruleId) || 0) + 1);
    }
  }

  const topRules = sortByCountDesc(
    [...byRule.entries()].map(([key, count]) => ({ key, count })),
  ).slice(0, 25);

  const topFiles = sortByCountDesc(
    [...byFile.entries()].map(([key, count]) => ({ key: path.relative(process.cwd(), key), count })),
  ).slice(0, 25);

  const summary = {
    generatedAt: new Date().toISOString(),
    totals: {
      warnings: totalWarnings,
      errors: totalErrors,
      filesWithWarnings: byFile.size,
    },
    topRules,
    topFiles,
  };

  const outputDir = path.resolve('artifacts', 'lint-warnings');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log(JSON.stringify(summary, null, 2));

  if (totalErrors > 0 && process.env.LINT_WARNINGS_REPORT_STRICT === 'true') {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('[lint-warnings-report] fatal:', error?.message || error);
  process.exitCode = 1;
});
