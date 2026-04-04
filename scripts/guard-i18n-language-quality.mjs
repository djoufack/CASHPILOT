import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '..', 'src', 'i18n', 'locales');

const LOCALES = {
  en: 'en.json',
  fr: 'fr.json',
};

const FR_PATTERNS = [
  /\b(actualiser|enregistrement|propri[eé]taire|supprimer|annuler|entrep[oô]t|r[eé]ception|r[eé]partition|donn[eé]es comptables|r[eè]gles de relance|soci[eé]t[eé]s li[eé]es|inter-soci[eé]t[eé]s|aucune transaction inter-soci[eé]t[eé]s|aucun lot enregistr[eé]|chargement des donn[eé]es|compte non pr[eê]t|param[eé]trez|taux de succ[eè]s|nom de l'entrep[oô]t|code entrep[oô]t|supprim[eé]e? de la base|annulation r[eé]seau)\b/i,
];

const EN_PATTERNS = [
  /\b(no data available|language|all rights reserved|overdue|no invoices found|delete invoice|settings saved|next best action|no sku|no products|cancel|save|no history|unknown company|confirm deletion|accounting integration|security settings|back to clients|no bank data|company-scoped|position created|application created|onboarding plan created)\b/i,
];

const IGNORED_KEYS_EN = new Set(['syscohada.haoActivity', 'employee.onboarding.tasksLabel']);

const IGNORED_KEYS_FR = new Set(['integrationsHub.accountingConnectors.toasts.connectedDescription']);

function flattenObject(obj, prefix = '', output = {}) {
  for (const [key, value] of Object.entries(obj || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, fullKey, output);
      continue;
    }
    output[fullKey] = String(value ?? '');
  }
  return output;
}

function isSuspiciousForEn(key, value) {
  if (IGNORED_KEYS_EN.has(key)) return false;
  return FR_PATTERNS.some((pattern) => pattern.test(value));
}

function isSuspiciousForFr(key, value) {
  if (IGNORED_KEYS_FR.has(key)) return false;
  return EN_PATTERNS.some((pattern) => pattern.test(value));
}

function printViolations(label, violations) {
  if (violations.length === 0) return;
  console.error(`\n${label}: ${violations.length} suspicious translation(s)`);
  for (const [key, value] of violations.slice(0, 40)) {
    console.error(`- ${key}: ${value}`);
  }
  if (violations.length > 40) {
    console.error(`... and ${violations.length - 40} more`);
  }
}

async function main() {
  const enRaw = await fs.readFile(path.join(localesDir, LOCALES.en), 'utf8');
  const frRaw = await fs.readFile(path.join(localesDir, LOCALES.fr), 'utf8');
  const enFlat = flattenObject(JSON.parse(enRaw));
  const frFlat = flattenObject(JSON.parse(frRaw));

  const enViolations = Object.entries(enFlat).filter(([key, value]) => isSuspiciousForEn(key, value));
  const frViolations = Object.entries(frFlat).filter(([key, value]) => isSuspiciousForFr(key, value));

  printViolations('i18n language guard (EN)', enViolations);
  printViolations('i18n language guard (FR)', frViolations);

  if (enViolations.length > 0 || frViolations.length > 0) {
    console.error('\ni18n language quality guard failed.');
    process.exit(1);
  }

  console.log('i18n language quality guard passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
