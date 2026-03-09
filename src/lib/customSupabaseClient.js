import { createClient } from '@supabase/supabase-js';

// Prevent "Lock broken by another request with the 'steal' option" AbortErrors.
// Removing navigator.locks forces GoTrue to use its built-in lockNoOp fallback.
try {
  if (typeof globalThis !== 'undefined' && globalThis.navigator && globalThis.navigator.locks) {
    Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true, writable: true });
  }
} catch (_e) {
  // navigator.locks may be non-configurable in some browsers (Edge/Opera) — ignore
}

const normalizeEnv = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const supabaseUrl = normalizeEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

const customSupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
    supabaseUrl,
    supabaseAnonKey,
};
