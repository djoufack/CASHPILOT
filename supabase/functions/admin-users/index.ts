import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const DELETE_CONFIRMATION_PHRASE = 'DELETE_USER_AND_ALL_DATA';
const ACCESS_ROLES = new Set(['user', 'manager', 'accountant', 'admin']);
const PROFILE_ROLES = new Set(['user', 'manager', 'accountant', 'admin', 'freelance', 'client']);

const USER_SCOPED_TABLES = [
  'consent_logs',
  'data_export_requests',
  'credit_transactions',
  'user_credits',
  'invoice_line_items',
  'supplier_invoice_line_items',
  'supplier_invoices',
  'invoices',
  'quotes',
  'purchase_orders',
  'credit_notes',
  'delivery_notes',
  'expenses',
  'payments',
  'projects',
  'products',
  'clients',
  'suppliers',
  'services',
  'categories',
  'tasks',
  'bank_connections',
  'bank_transactions',
  'payment_reminders',
  'payment_reminder_logs',
  'api_keys',
  'webhooks',
  'notifications',
  'audit_log',
  'accountant_company_access',
  'accountant_invitations',
  'employee_portal_access',
  'employee_portal_sessions',
  'reconciliation_patterns',
  'reconciliation_runs',
  'tax_filings',
  'vat_declarations',
  'corporate_tax_calculations',
  'regulatory_updates',
  'regulatory_watchlists',
  'regulatory_actions',
  'cfo_alerts',
  'cfo_scenarios',
  'cfo_decisions',
  'intercompany_links',
  'intercompany_sync_logs',
  'intercompany_reconciliation_jobs',
  'intercompany_reconciliation_runs',
  'api_marketplace_installed_apps',
  'api_marketplace_webhook_events',
  'pdp_assessment_campaigns',
  'pdp_alerts',
  'pdp_incidents',
  'open_api_installed_apps',
  'open_api_webhook_events',
  'user_roles',
  'profiles',
  'company',
];

const STORAGE_BUCKETS = ['supplier-invoices', 'documents', 'avatars', 'exports', 'signatures'];

type AnyRecord = Record<string, unknown>;

const hasOwn = (value: AnyRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAccessRole = (value: unknown) => {
  const role = (asStringOrNull(value) || 'user').toLowerCase();
  return ACCESS_ROLES.has(role) ? role : 'user';
};

const normalizeProfileRole = (value: unknown) => {
  const role = (asStringOrNull(value) || 'user').toLowerCase();
  return PROFILE_ROLES.has(role) ? role : 'user';
};

const ensureBody = async (req: Request): Promise<AnyRecord> => {
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  return body as AnyRecord;
};

const requireAdminAccess = async (supabase: ReturnType<typeof createServiceClient>, requesterId: string) => {
  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', requesterId)
    .maybeSingle();

  if (roleError) {
    throw new HttpError(500, roleError.message || 'Unable to verify admin role');
  }

  if ((roleRow?.role || '').toLowerCase() === 'admin') {
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', requesterId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    throw new HttpError(500, profileError.message || 'Unable to verify admin profile role');
  }

  if ((profile?.role || '').toLowerCase() === 'admin') {
    return;
  }

  throw new HttpError(403, 'Admin access required');
};

const listAllAuthUsers = async (supabase: ReturnType<typeof createServiceClient>) => {
  const users: AnyRecord[] = [];
  const perPage = 200;
  let page = 1;

  while (page <= 500) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new HttpError(500, error.message || 'Unable to list users');
    }

    const batch = (data?.users || []) as AnyRecord[];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
};

const getUserSummaries = async (supabase: ReturnType<typeof createServiceClient>) => {
  const authUsers = await listAllAuthUsers(supabase);
  const activeAuthUsers = authUsers.filter((user) => {
    const deletedAt = asStringOrNull((user as AnyRecord).deleted_at);
    return !deletedAt;
  });
  const userIds = activeAuthUsers
    .map((user) => asStringOrNull(user.id))
    .filter((value): value is string => Boolean(value));

  if (userIds.length === 0) {
    return [];
  }

  const [
    { data: profiles, error: profileError },
    { data: roleRows, error: roleError },
    { data: credits, error: creditsError },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, full_name, company_name, role, phone, created_at, updated_at')
      .in('user_id', userIds),
    supabase.from('user_roles').select('user_id, role, created_at, updated_at').in('user_id', userIds),
    supabase
      .from('user_credits')
      .select(
        'user_id, free_credits, subscription_credits, paid_credits, total_used, subscription_plan_id, subscription_status, current_period_start, current_period_end, updated_at'
      )
      .in('user_id', userIds),
  ]);

  if (profileError) throw new HttpError(500, profileError.message || 'Unable to load profiles');
  if (roleError) throw new HttpError(500, roleError.message || 'Unable to load user roles');
  if (creditsError) throw new HttpError(500, creditsError.message || 'Unable to load user credits');

  const profileByUserId = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
  const roleByUserId = new Map((roleRows || []).map((roleRow) => [roleRow.user_id, roleRow]));
  const creditsByUserId = new Map((credits || []).map((creditsRow) => [creditsRow.user_id, creditsRow]));

  const users = activeAuthUsers.map((authUser) => {
    const userId = asStringOrNull(authUser.id) || '';
    const metadata =
      authUser.user_metadata && typeof authUser.user_metadata === 'object' ? (authUser.user_metadata as AnyRecord) : {};
    const profile = profileByUserId.get(userId) || null;
    const roleRow = roleByUserId.get(userId) || null;
    const creditsRow = creditsByUserId.get(userId) || null;

    const fullName = asStringOrNull(profile?.full_name) || asStringOrNull(metadata.full_name) || null;
    const companyName = asStringOrNull(profile?.company_name) || asStringOrNull(metadata.company_name) || null;

    return {
      user_id: userId,
      email: asStringOrNull(authUser.email),
      full_name: fullName,
      company_name: companyName,
      profile_role: normalizeProfileRole(profile?.role || metadata.role || 'user'),
      access_role: normalizeAccessRole(roleRow?.role || profile?.role || 'user'),
      phone: asStringOrNull(profile?.phone),
      created_at: authUser.created_at || profile?.created_at || null,
      updated_at: authUser.updated_at || profile?.updated_at || roleRow?.updated_at || null,
      email_confirmed_at: authUser.email_confirmed_at || null,
      subscription: creditsRow
        ? {
            free_credits: creditsRow.free_credits,
            subscription_credits: creditsRow.subscription_credits,
            paid_credits: creditsRow.paid_credits,
            total_used: creditsRow.total_used,
            subscription_plan_id: creditsRow.subscription_plan_id,
            subscription_status: creditsRow.subscription_status,
            current_period_start: creditsRow.current_period_start,
            current_period_end: creditsRow.current_period_end,
            updated_at: creditsRow.updated_at,
          }
        : null,
    };
  });

  users.sort((left, right) => {
    const leftDate = new Date(left.created_at || 0).getTime();
    const rightDate = new Date(right.created_at || 0).getTime();
    return rightDate - leftDate;
  });

  return users;
};

const saveProfile = async (
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  profilePatch: AnyRecord
) => {
  const { data: existingProfile, error: existingError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw new HttpError(500, existingError.message || 'Unable to load profile');
  }

  if (existingProfile?.id) {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...profilePatch,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      throw new HttpError(500, error.message || 'Unable to update profile');
    }
    return;
  }

  const { error } = await supabase.from('profiles').insert({
    user_id: userId,
    role: normalizeProfileRole(profilePatch.role || 'user'),
    full_name: asStringOrNull(profilePatch.full_name) || asStringOrNull(profilePatch.company_name) || 'New user',
    ...profilePatch,
  });

  if (error) {
    throw new HttpError(500, error.message || 'Unable to create profile');
  }
};

const setAccessRole = async (supabase: ReturnType<typeof createServiceClient>, userId: string, roleValue: unknown) => {
  const accessRole = normalizeAccessRole(roleValue);
  if (accessRole === 'user') {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (error) {
      throw new HttpError(500, error.message || 'Unable to remove elevated role');
    }
    return;
  }

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: accessRole }, { onConflict: 'user_id' });

  if (error) {
    throw new HttpError(500, error.message || 'Unable to update access role');
  }
};

const cleanupStorageForUser = async (supabase: ReturnType<typeof createServiceClient>, userId: string) => {
  const storageLog: Array<{ bucket: string; status: string; count: number; error?: string }> = [];

  for (const bucket of STORAGE_BUCKETS) {
    try {
      const { data: files, error: listError } = await supabase.storage
        .from(bucket)
        .list(userId, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      if (listError) {
        storageLog.push({ bucket, status: 'error', count: 0, error: listError.message });
        continue;
      }

      const filePaths = (files || [])
        .filter((file) => file && typeof file.name === 'string')
        .map((file) => `${userId}/${file.name}`);

      if (filePaths.length === 0) {
        storageLog.push({ bucket, status: 'skipped', count: 0 });
        continue;
      }

      const { error: removeError } = await supabase.storage.from(bucket).remove(filePaths);
      if (removeError) {
        storageLog.push({ bucket, status: 'error', count: 0, error: removeError.message });
        continue;
      }

      storageLog.push({ bucket, status: 'deleted', count: filePaths.length });
    } catch (error) {
      storageLog.push({
        bucket,
        status: 'error',
        count: 0,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  return storageLog;
};

const deleteUserAndData = async (supabase: ReturnType<typeof createServiceClient>, userId: string) => {
  const tableLog: Array<{ table: string; status: string; count: number; error?: string }> = [];

  for (const table of USER_SCOPED_TABLES) {
    try {
      const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('user_id', userId);

      tableLog.push({
        table,
        status: error ? 'error' : 'deleted',
        count: count || 0,
        error: error?.message,
      });
    } catch (error) {
      tableLog.push({
        table,
        status: 'skipped',
        count: 0,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  const storageLog = await cleanupStorageForUser(supabase, userId);

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    throw new HttpError(500, deleteAuthError.message || 'Unable to delete auth user');
  }

  return { tableLog, storageLog };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createServiceClient();

  try {
    const requester = await requireAuthenticatedUser(req);
    await requireAdminAccess(supabase, requester.id);

    if (req.method === 'GET') {
      const users = await getUserSummaries(supabase);
      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed');
    }

    const body = await ensureBody(req);
    const action = asStringOrNull(body.action)?.toLowerCase() || 'list';

    if (action === 'list') {
      const users = await getUserSummaries(supabase);
      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const userPayload =
        body.user && typeof body.user === 'object' && !Array.isArray(body.user) ? (body.user as AnyRecord) : {};

      const email = asStringOrNull(userPayload.email);
      const password = asStringOrNull(userPayload.password);
      const fullName = asStringOrNull(userPayload.full_name);
      const companyName = asStringOrNull(userPayload.company_name);
      const profileRole = normalizeProfileRole(userPayload.profile_role);
      const accessRole = normalizeAccessRole(userPayload.access_role);
      const phone = asStringOrNull(userPayload.phone);

      if (!email) {
        throw new HttpError(400, 'email is required');
      }
      if (!password || password.length < 8) {
        throw new HttpError(400, 'password is required and must be at least 8 characters');
      }

      const userMetadata: AnyRecord = {};
      if (fullName) userMetadata.full_name = fullName;
      if (companyName) userMetadata.company_name = companyName;
      userMetadata.role = profileRole;

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (createError || !created?.user?.id) {
        throw new HttpError(500, createError?.message || 'Unable to create user');
      }

      const createdUserId = created.user.id;

      await saveProfile(supabase, createdUserId, {
        full_name: fullName || email,
        company_name: companyName,
        role: profileRole,
        phone,
      });

      await setAccessRole(supabase, createdUserId, accessRole);

      const users = await getUserSummaries(supabase);
      const createdUser = users.find((user) => user.user_id === createdUserId) || null;

      return new Response(
        JSON.stringify({
          success: true,
          user: createdUser,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'update') {
      const userPayload =
        body.user && typeof body.user === 'object' && !Array.isArray(body.user) ? (body.user as AnyRecord) : {};

      const userId = asStringOrNull(userPayload.user_id);
      if (!userId) {
        throw new HttpError(400, 'user_id is required');
      }

      const { data: targetUserData, error: targetUserError } = await supabase.auth.admin.getUserById(userId);
      if (targetUserError || !targetUserData?.user) {
        throw new HttpError(404, targetUserError?.message || 'Target user not found');
      }

      const targetUser = targetUserData.user as AnyRecord;
      const currentMetadata =
        targetUser.user_metadata && typeof targetUser.user_metadata === 'object'
          ? ({ ...(targetUser.user_metadata as AnyRecord) } as AnyRecord)
          : {};

      const authPatch: AnyRecord = {};
      const metadataPatch: AnyRecord = {};
      let metadataChanged = false;

      if (hasOwn(userPayload, 'email')) {
        const email = asStringOrNull(userPayload.email);
        if (!email) {
          throw new HttpError(400, 'email cannot be empty');
        }
        authPatch.email = email;
      }

      if (hasOwn(userPayload, 'password')) {
        const password = asStringOrNull(userPayload.password);
        if (password && password.length < 8) {
          throw new HttpError(400, 'password must be at least 8 characters');
        }
        if (password) {
          authPatch.password = password;
        }
      }

      if (hasOwn(userPayload, 'full_name')) {
        const fullName = asStringOrNull(userPayload.full_name);
        if (fullName) {
          metadataPatch.full_name = fullName;
        } else {
          delete currentMetadata.full_name;
        }
        metadataChanged = true;
      }

      if (hasOwn(userPayload, 'company_name')) {
        const companyName = asStringOrNull(userPayload.company_name);
        if (companyName) {
          metadataPatch.company_name = companyName;
        } else {
          delete currentMetadata.company_name;
        }
        metadataChanged = true;
      }

      if (hasOwn(userPayload, 'profile_role')) {
        metadataPatch.role = normalizeProfileRole(userPayload.profile_role);
        metadataChanged = true;
      }

      if (metadataChanged) {
        authPatch.user_metadata = {
          ...currentMetadata,
          ...metadataPatch,
        };
      }

      if (Object.keys(authPatch).length > 0) {
        const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, authPatch);
        if (updateAuthError) {
          throw new HttpError(500, updateAuthError.message || 'Unable to update auth user');
        }
      }

      const profilePatch: AnyRecord = {};
      if (hasOwn(userPayload, 'full_name')) profilePatch.full_name = asStringOrNull(userPayload.full_name);
      if (hasOwn(userPayload, 'company_name')) profilePatch.company_name = asStringOrNull(userPayload.company_name);
      if (hasOwn(userPayload, 'profile_role')) profilePatch.role = normalizeProfileRole(userPayload.profile_role);
      if (hasOwn(userPayload, 'phone')) profilePatch.phone = asStringOrNull(userPayload.phone);

      if (Object.keys(profilePatch).length > 0) {
        await saveProfile(supabase, userId, profilePatch);
      }

      if (hasOwn(userPayload, 'access_role')) {
        await setAccessRole(supabase, userId, userPayload.access_role);
      }

      const users = await getUserSummaries(supabase);
      const updatedUser = users.find((user) => user.user_id === userId) || null;

      return new Response(
        JSON.stringify({
          success: true,
          user: updatedUser,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'delete') {
      const userId = asStringOrNull(body.user_id);
      const confirmation = asStringOrNull(body.confirmation) || '';

      if (!userId) {
        throw new HttpError(400, 'user_id is required');
      }

      if (confirmation !== DELETE_CONFIRMATION_PHRASE) {
        throw new HttpError(400, `Invalid confirmation. Send { confirmation: "${DELETE_CONFIRMATION_PHRASE}" }`);
      }

      if (userId === requester.id) {
        throw new HttpError(400, 'You cannot delete your own admin account from this endpoint');
      }

      const deletionResult = await deleteUserAndData(supabase, userId);

      return new Response(
        JSON.stringify({
          success: true,
          deleted_user_id: userId,
          confirmation_phrase: DELETE_CONFIRMATION_PHRASE,
          ...deletionResult,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    throw new HttpError(400, `Unsupported action "${action}"`);
  } catch (error) {
    console.error('admin-users error:', error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : 'Admin user management failed';

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
