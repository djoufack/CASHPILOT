import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type PasswordAuthKey = 'admin' | 'scte' | 'freelance';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const LOCAL_ENV_PATH = join(CURRENT_DIR, '.env');

function loadLocalEnvFile() {
  if (!existsSync(LOCAL_ENV_PATH)) return;

  const raw = readFileSync(LOCAL_ENV_PATH, 'utf8');

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnvFile();

const DEFAULT_EMAILS: Record<PasswordAuthKey, string> = {
  admin: '',
  scte: 'scte.test@cashpilot.cloud',
  freelance: 'freelance.test@cashpilot.cloud',
};

function readEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function requireEnv(names: string[]): string {
  const value = readEnv(names);
  if (value) return value;

  throw new Error(`Missing environment variable. Set one of: ${names.join(', ')}`);
}

export const SUPABASE_URL = requireEnv(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
export const SUPABASE_ANON_KEY = requireEnv(['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);
export const API_BASE_URL = readEnv(['CASHPILOT_API_BASE']) || `${SUPABASE_URL}/functions/v1/api-v1`;

export const TEST_USERS: Record<PasswordAuthKey, { email: string; password: string }> = {
  admin: {
    email: readEnv(['TEST_ADMIN_EMAIL']) || DEFAULT_EMAILS.admin,
    password: readEnv(['TEST_ADMIN_PASSWORD']),
  },
  scte: {
    email: readEnv(['TEST_SCTE_EMAIL']) || DEFAULT_EMAILS.scte,
    password: readEnv(['TEST_SCTE_PASSWORD']),
  },
  freelance: {
    email: readEnv(['TEST_FREELANCE_EMAIL']) || DEFAULT_EMAILS.freelance,
    password: readEnv(['TEST_FREELANCE_PASSWORD']),
  },
};

export function hasPasswordAuth(key: PasswordAuthKey): boolean {
  const auth = TEST_USERS[key];
  return Boolean(auth.email && auth.password);
}

export function requirePasswordAuth(key: PasswordAuthKey): { email: string; password: string } {
  const auth = TEST_USERS[key];
  if (!auth.email || !auth.password) {
    throw new Error(
      `Missing test credentials for ${key}. Set ${`TEST_${key.toUpperCase()}_EMAIL`} and ${`TEST_${key.toUpperCase()}_PASSWORD`}.`
    );
  }

  return auth;
}

export function requireApiKey(): string {
  return requireEnv(['CASHPILOT_TEST_API_KEY']);
}
