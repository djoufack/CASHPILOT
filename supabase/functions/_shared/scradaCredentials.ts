import { HttpError } from './billing.ts';

const ENCRYPTION_ENV = 'COMPANY_SECRETS_ENCRYPTION_KEY';
const ENCRYPTION_PREFIX = 'v1';
const IV_LENGTH = 12;

const encodeBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const importSecretKey = async (usage: KeyUsage[]) => {
  const encoded = (Deno.env.get(ENCRYPTION_ENV) || '').trim();
  if (!encoded) {
    throw new HttpError(500, `${ENCRYPTION_ENV} is not configured`);
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeBase64(encoded);
  } catch {
    throw new HttpError(500, `${ENCRYPTION_ENV} must be base64-encoded`);
  }

  if (keyBytes.length !== 32) {
    throw new HttpError(500, `${ENCRYPTION_ENV} must decode to 32 bytes`);
  }

  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    usage,
  );
};

export const encryptSecretValue = async (plainValue: string | null | undefined) => {
  const normalized = String(plainValue || '').trim();
  if (!normalized) return null;

  const key = await importSecretKey(['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const payload = new TextEncoder().encode(normalized);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);

  return `${ENCRYPTION_PREFIX}:${encodeBase64(iv)}:${encodeBase64(new Uint8Array(encrypted))}`;
};

export const decryptSecretValue = async (storedValue: string | null | undefined) => {
  const normalized = String(storedValue || '').trim();
  if (!normalized) return null;

  // Legacy plaintext compatibility during migration.
  if (!normalized.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return normalized;
  }

  const segments = normalized.split(':');
  if (segments.length !== 3) {
    throw new HttpError(500, 'Malformed encrypted secret payload');
  }

  const iv = decodeBase64(segments[1]);
  const encrypted = decodeBase64(segments[2]);
  const key = await importSecretKey(['decrypt']);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted,
  );

  return new TextDecoder().decode(decrypted);
};

export const resolveScradaCredentials = async (company: Record<string, unknown> | null | undefined) => {
  const apiKey = await decryptSecretValue(
    String(company?.scrada_api_key_encrypted || company?.scrada_api_key || ''),
  );
  const password = await decryptSecretValue(
    String(company?.scrada_password_encrypted || company?.scrada_password || ''),
  );

  return {
    apiKey: apiKey || null,
    password: password || null,
  };
};
