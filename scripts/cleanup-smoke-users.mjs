import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

async function deleteUserArtifacts(supabase, userId) {
  const tables = [
    'accounting_audit_log',
    'accounting_entries',
    'accounting_health',
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId);

    if (error && !['42P01', 'PGRST204'].includes(error.code)) {
      throw error;
    }
  }
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const removed = [];
  const failed = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const targets = users.filter((user) => {
      const email = String(user.email || '').toLowerCase();
      return email.startsWith('smoke.runtime.') && email.endsWith('@cashpilot.test');
    });

    for (const user of targets) {
      try {
        await deleteUserArtifacts(supabase, user.id);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
          throw deleteError;
        }

        removed.push({
          id: user.id,
          email: user.email,
        });
      } catch (error) {
        failed.push({
          id: user.id,
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  console.log(JSON.stringify({
    removedCount: removed.length,
    failedCount: failed.length,
    removed,
    failed,
  }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
