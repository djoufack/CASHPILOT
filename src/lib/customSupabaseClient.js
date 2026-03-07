import { createClient } from '@supabase/supabase-js';

const normalizeEnv = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const supabaseUrl = normalizeEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

const customSupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use a simple async lock to avoid Web Locks API "steal" AbortErrors
        // that occur with concurrent tab/auth operations in Supabase v2
        lock: async (name, acquireTimeout, fn) => fn(),
      },
    })
  : null;

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
    supabaseUrl,
    supabaseAnonKey,
};
