import { supabase as rawSupabase, supabaseAnonKey, supabaseUrl } from './customSupabaseClient';
import { buildGuardEventDetail, guardTableWritePayload } from '@/lib/supabaseWriteGuard';

const emitGuardEvent = (detail) => {
  if (!detail) return;
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent('cashpilot:data-entry-guard', { detail }));
  } catch {
    // no-op: guard feedback should never break writes
  }
};

const wrapQueryBuilderWithGuard = (table, queryBuilder) => {
  if (!queryBuilder) return queryBuilder;

  return new Proxy(queryBuilder, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== 'function') return value;

      if (!['insert', 'update', 'upsert'].includes(String(property))) {
        return value.bind(target);
      }

      return (...args) => {
        const [values, ...rest] = args;
        const operation = property === 'insert' ? 'create' : property === 'update' ? 'update' : 'upsert';

        const { guardedValues, reports, summary } = guardTableWritePayload(table, operation, values);
        const detail = buildGuardEventDetail({ table, operation, summary, reports });
        emitGuardEvent(detail);

        return value.call(target, guardedValues, ...rest);
      };
    },
  });
};

const buildGuardedSupabaseClient = (client) => {
  if (!client) return null;

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property !== 'from') {
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (table) => {
        const queryBuilder = value.call(target, table);
        return wrapQueryBuilderWithGuard(table, queryBuilder);
      };
    },
  });
};

const supabase = buildGuardedSupabaseClient(rawSupabase);

// Re-export the client to maintain compatibility with existing imports
export { supabase };

/**
 * Validates that the Supabase configuration is present and correct.
 */
export const validateSupabaseConfig = () => {
  const url = supabaseUrl;
  const key = supabaseAnonKey;

  const isUrlValid = url && url !== '__SUPABASE_URL__' && url.startsWith('http');
  const isKeyValid = key && key !== '__SUPABASE_ANON_KEY__';

  if (!isUrlValid || !isKeyValid) {
    return {
      valid: false,
      missing: !isUrlValid ? 'VITE_SUPABASE_URL' : 'VITE_SUPABASE_ANON_KEY',
    };
  }
  return { valid: true };
};

/**
 * Diagnostic function to test connection and configuration
 */
export const checkSupabaseConnection = async () => {
  const result = {
    connected: false,
    error: null,
    details: null,
  };

  const config = validateSupabaseConfig();
  if (!config.valid) {
    result.error = `Configuration Error: Missing ${config.missing}`;
    return result;
  }

  if (!rawSupabase) {
    result.error = 'Supabase client is not initialized.';
    return result;
  }

  try {
    // Attempt a lightweight query to check connectivity
    // Using 'count' on a public table or just checking health if possible
    // We use 'profiles' as it's a core table, but handle RLS errors as "connected"
    const { _data, error, status, statusText } = await rawSupabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (error) {
      // 401/403 often means we connected but RLS stopped us (which means Auth service is reachable)
      if (status === 401 || status === 403) {
        result.connected = true;
      } else if (
        error.message &&
        (error.message.includes('fetch failed') || error.message.includes('Network request failed'))
      ) {
        result.error = 'Network Error: Could not reach Supabase.';
      } else {
        // Even if table doesn't exist or other DB error, we connected to the instance
        if (status !== 0 && status !== 500) {
          result.connected = true;
        } else {
          result.error = `Supabase Error: ${error.message}`;
        }
      }
      result.details = { error, status, statusText };
    } else {
      result.connected = true;
      result.details = { status, statusText };
    }
  } catch (err) {
    console.error('Connection test error:', err);
    result.error = `Client Error: ${err.message}`;
    result.details = err;
  }

  return result;
};
