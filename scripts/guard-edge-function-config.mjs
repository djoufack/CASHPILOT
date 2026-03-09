import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, 'supabase', 'functions');
const CONFIG_PATH = path.join(ROOT, 'supabase', 'config.toml');
const IGNORED_DIRS = new Set(['_shared']);

function unique(values) {
  return [...new Set(values)];
}

function parseFunctionSections(configSource) {
  const sections = [];
  let current = null;

  for (const line of configSource.split(/\r?\n/)) {
    const headerMatch = line.match(/^\[functions\.([^\]]+)\]\s*$/);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { name: headerMatch[1], lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) sections.push(current);
  return sections;
}

async function main() {
  const entries = await fs.readdir(FUNCTIONS_DIR, { withFileTypes: true });
  const functionDirs = entries
    .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name))
    .map((entry) => entry.name)
    .sort();

  const configSource = await fs.readFile(CONFIG_PATH, 'utf8');
  const sections = parseFunctionSections(configSource);
  const sectionMatches = sections.map((section) => section.name);
  const sectionNames = unique(sectionMatches).sort();
  const duplicateSections = unique(sectionMatches.filter((name, index) => sectionMatches.indexOf(name) !== index)).sort();
  const sectionsMissingVerifyJwt = sections
    .filter((section) => !section.lines.some((line) => /verify_jwt\s*=\s*(true|false)/.test(line)))
    .map((section) => section.name)
    .sort();

  const configSet = new Set(sectionNames);
  const functionSet = new Set(functionDirs);

  const missingSections = functionDirs.filter((name) => !configSet.has(name));
  const staleSections = sectionNames.filter((name) => !functionSet.has(name));

  if (missingSections.length > 0 || staleSections.length > 0 || duplicateSections.length > 0 || sectionsMissingVerifyJwt.length > 0) {
    console.error('Edge function config guard failed.');

    if (missingSections.length > 0) {
      console.error(`- Missing config entries: ${missingSections.join(', ')}`);
    }
    if (staleSections.length > 0) {
      console.error(`- Config entries without a matching function directory: ${staleSections.join(', ')}`);
    }
    if (duplicateSections.length > 0) {
      console.error(`- Duplicate config entries: ${duplicateSections.join(', ')}`);
    }
    if (sectionsMissingVerifyJwt.length > 0) {
      console.error(`- Config entries missing verify_jwt: ${sectionsMissingVerifyJwt.join(', ')}`);
    }

    process.exit(1);
  }

  console.log(`Edge function config guard passed (${functionDirs.length} functions declared explicitly).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
