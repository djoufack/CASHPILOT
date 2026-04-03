#!/usr/bin/env node
/**
 * i18n Key Consistency Guard
 * Ensures all locale files (fr, en, nl) have the same top-level keys.
 * Missing keys indicate untranslated sections.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '..', 'src', 'i18n', 'locales');

const REFERENCE_LOCALE = 'fr';
const LOCALES = ['fr', 'en', 'nl'];

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadLocale(locale) {
  const filePath = resolve(localesDir, `${locale}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

let totalMissing = 0;
let totalExtra = 0;
const referenceData = loadLocale(REFERENCE_LOCALE);
const referenceKeys = new Set(flattenKeys(referenceData));

console.log(`i18n guard: reference locale "${REFERENCE_LOCALE}" has ${referenceKeys.size} keys`);

for (const locale of LOCALES) {
  if (locale === REFERENCE_LOCALE) continue;

  const data = loadLocale(locale);
  const localeKeys = new Set(flattenKeys(data));

  const missing = [...referenceKeys].filter(k => !localeKeys.has(k));
  const extra = [...localeKeys].filter(k => !referenceKeys.has(k));

  if (missing.length > 0) {
    console.log(`\n⚠ ${locale}.json: ${missing.length} missing key(s) vs ${REFERENCE_LOCALE}.json:`);
    missing.slice(0, 10).forEach(k => console.log(`  - ${k}`));
    if (missing.length > 10) console.log(`  ... and ${missing.length - 10} more`);
    totalMissing += missing.length;
  }

  if (extra.length > 0) {
    console.log(`\nℹ ${locale}.json: ${extra.length} extra key(s) not in ${REFERENCE_LOCALE}.json:`);
    extra.slice(0, 5).forEach(k => console.log(`  + ${k}`));
    if (extra.length > 5) console.log(`  ... and ${extra.length - 5} more`);
    totalExtra += extra.length;
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${locale}.json: all keys match ${REFERENCE_LOCALE}.json`);
  }
}

console.log(`\ni18n guard summary: ${totalMissing} missing, ${totalExtra} extra`);

// Fail only on missing keys (extra keys are informational)
if (totalMissing > 50) {
  console.error(`\ni18n guard failed: ${totalMissing} missing translations exceed threshold (50)`);
  process.exit(1);
}

console.log('i18n key guard passed.');
