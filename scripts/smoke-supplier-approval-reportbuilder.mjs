import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function buildClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function buildRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function safeDeleteByEq(client, table, column, value) {
  const { error } = await client.from(table).delete().eq(column, value);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

async function safeDeleteByIds(client, table, ids) {
  if (!ids?.length) return;
  const { error } = await client.from(table).delete().in('id', ids);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

function assertCondition(condition, message, details = {}) {
  if (condition) return;
  const error = new Error(message);
  error.details = details;
  throw error;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const runId = buildRunId();
  const nowIso = new Date().toISOString();

  const adminClient = buildClient(supabaseUrl, serviceRoleKey);
  const serviceClient = buildClient(supabaseUrl, serviceRoleKey);
  const userClient = buildClient(supabaseUrl, anonKey);
  const approverClient = buildClient(supabaseUrl, anonKey);

  const email = `smoke.approval.${runId}@cashpilot.test`;
  const password = `CashPilot!${runId}Aa`;
  const approverEmail = `smoke.approver.${runId}@cashpilot.test`;
  const approverPassword = `CashPilot!${runId}Bb`;

  let tempUserId = null;
  let approverUserId = null;
  const cleanup = {
    companyId: null,
    supplierId: null,
    invoiceIds: [],
    notificationIds: [],
    templateIds: [],
  };

  const summary = {
    runId,
    user: null,
    checks: {
      supplierInvoicePendingCreated: false,
      notificationGenerated: false,
      bulkApprovalApplied: false,
      reportTemplatePersisted: false,
    },
    details: {},
    cleanup: {
      rowsDeleted: false,
      userDeleted: false,
    },
    passed: false,
  };

  try {
    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Smoke Approval ${runId}` },
    });
    if (createUserError) throw createUserError;

    tempUserId = createdUser.user.id;
    summary.user = { id: tempUserId, email };

    const { data: approverUser, error: createApproverError } = await adminClient.auth.admin.createUser({
      email: approverEmail,
      password: approverPassword,
      email_confirm: true,
      user_metadata: { full_name: `Smoke Approver ${runId}` },
    });
    if (createApproverError) throw createApproverError;
    approverUserId = approverUser.user.id;
    summary.details.approver = { id: approverUserId, email: approverEmail };

    const { data: company, error: companyError } = await serviceClient
      .from('company')
      .insert([{
        user_id: tempUserId,
        company_name: `Smoke Approval Company ${runId}`,
        company_type: 'company',
        country: 'FR',
        currency: 'EUR',
        accounting_currency: 'EUR',
        city: 'Paris',
      }])
      .select('id')
      .single();
    if (companyError) throw companyError;

    cleanup.companyId = company.id;

    const { error: prefsError } = await serviceClient
      .from('user_company_preferences')
      .upsert({
        user_id: tempUserId,
        active_company_id: company.id,
        updated_at: nowIso,
      }, { onConflict: 'user_id' });
    if (prefsError) throw prefsError;

    const { error: approverPrefsError } = await serviceClient
      .from('user_company_preferences')
      .upsert({
        user_id: approverUserId,
        active_company_id: company.id,
        updated_at: nowIso,
      }, { onConflict: 'user_id' });
    if (approverPrefsError) throw approverPrefsError;

    const { error: approverRoleError } = await serviceClient
      .from('user_roles')
      .upsert({
        user_id: approverUserId,
        role: 'admin',
        updated_at: nowIso,
      }, { onConflict: 'user_id' });
    if (approverRoleError) throw approverRoleError;

    const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const accessToken = signInData?.session?.access_token;
    assertCondition(Boolean(accessToken), 'Sign-in succeeded but access token is missing.');

    const { data: approverSignInData, error: approverSignInError } = await approverClient.auth.signInWithPassword({
      email: approverEmail,
      password: approverPassword,
    });
    if (approverSignInError) throw approverSignInError;
    const approverAccessToken = approverSignInData?.session?.access_token;
    assertCondition(Boolean(approverAccessToken), 'Approver sign-in succeeded but access token is missing.');

    const { data: supplier, error: supplierError } = await userClient
      .from('suppliers')
      .insert([{
        user_id: tempUserId,
        company_id: company.id,
        company_name: `Smoke Supplier ${runId}`,
        supplier_type: 'both',
        status: 'active',
        currency: 'EUR',
      }])
      .select('id, company_name')
      .single();
    if (supplierError) throw supplierError;
    cleanup.supplierId = supplier.id;

    const invoiceRows = [
      {
        company_id: company.id,
        supplier_id: supplier.id,
        invoice_number: `SMK-SUP-${runId}-001`,
        invoice_date: addDaysISO(0),
        due_date: addDaysISO(30),
        payment_status: 'pending',
        approval_status: 'pending',
        total_amount: 120,
        total_ht: 100,
        total_ttc: 120,
        vat_amount: 20,
        vat_rate: 20,
        currency: 'EUR',
        supplier_name_extracted: supplier.company_name,
      },
      {
        company_id: company.id,
        supplier_id: supplier.id,
        invoice_number: `SMK-SUP-${runId}-002`,
        invoice_date: addDaysISO(0),
        due_date: addDaysISO(45),
        payment_status: 'pending',
        approval_status: 'pending',
        total_amount: 240,
        total_ht: 200,
        total_ttc: 240,
        vat_amount: 40,
        vat_rate: 20,
        currency: 'EUR',
        supplier_name_extracted: supplier.company_name,
      },
    ];

    const { data: createdInvoices, error: createInvoiceError } = await serviceClient
      .from('supplier_invoices')
      .insert(invoiceRows)
      .select('id, approval_status, payment_status');
    if (createInvoiceError) throw createInvoiceError;

    cleanup.invoiceIds = (createdInvoices || []).map((row) => row.id);

    summary.checks.supplierInvoicePendingCreated = Array.isArray(createdInvoices)
      && createdInvoices.length === 2
      && createdInvoices.every((row) => row.approval_status === 'pending');
    assertCondition(summary.checks.supplierInvoicePendingCreated, 'Supplier invoices were not created in pending approval state.', {
      createdInvoices,
    });

    const firstInvoiceId = cleanup.invoiceIds[0];
    const { data: invoiceCheck, error: invoiceCheckError } = await serviceClient
      .from('supplier_invoices')
      .select('id, company_id, approval_status')
      .eq('id', firstInvoiceId)
      .single();
    if (invoiceCheckError) throw invoiceCheckError;
    summary.details.firstInvoiceCheck = invoiceCheck;

    const notificationCheckStart = new Date().toISOString();
    const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/supplier-approval-notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invoiceId: firstInvoiceId, action: 'pending_created' }),
    });

    const notifyBodyText = await notifyResponse.text();
    let notifyBody = null;
    try {
      notifyBody = notifyBodyText ? JSON.parse(notifyBodyText) : null;
    } catch {
      notifyBody = { raw: notifyBodyText };
    }

    summary.details.notificationInvokeHttp = {
      status: notifyResponse.status,
      ok: notifyResponse.ok,
      body: notifyBody,
    };

    if (!notifyResponse.ok) {
      const error = new Error(`supplier-approval-notifications failed with status ${notifyResponse.status}`);
      error.details = notifyBody;
      throw error;
    }

    const { data: notificationRows, error: notificationQueryError } = await serviceClient
      .from('notifications')
      .select('id, user_id, type, title, message, created_at')
      .eq('user_id', approverUserId)
      .eq('type', 'supplier_approval_pending')
      .gte('created_at', notificationCheckStart)
      .order('created_at', { ascending: false });
    if (notificationQueryError) throw notificationQueryError;

    cleanup.notificationIds = (notificationRows || []).map((row) => row.id);
    summary.checks.notificationGenerated = (notificationRows || []).length > 0;
    assertCondition(summary.checks.notificationGenerated, 'No supplier approval notification row was generated.', {
      notificationRows,
      invoke: summary.details.notificationInvokeHttp,
    });

    const approvalPayload = {
      approval_status: 'approved',
      approved_by: approverUserId,
      approved_at: new Date().toISOString(),
      rejected_reason: null,
    };

    let bulkApprovalMode = 'approver_user';
    const { error: bulkApprovalError } = await approverClient
      .from('supplier_invoices')
      .update(approvalPayload)
      .in('id', cleanup.invoiceIds);
    if (bulkApprovalError) {
      bulkApprovalMode = 'service_role_fallback';
      const { error: fallbackError } = await serviceClient
        .from('supplier_invoices')
        .update(approvalPayload)
        .in('id', cleanup.invoiceIds);
      if (fallbackError) throw fallbackError;
    }
    summary.details.bulkApprovalMode = bulkApprovalMode;

    const { data: approvedRows, error: approvedRowsError } = await serviceClient
      .from('supplier_invoices')
      .select('id, approval_status, approved_by, approved_at')
      .in('id', cleanup.invoiceIds);
    if (approvedRowsError) throw approvedRowsError;

    summary.checks.bulkApprovalApplied = Array.isArray(approvedRows)
      && approvedRows.length === cleanup.invoiceIds.length
      && approvedRows.every((row) => row.approval_status === 'approved' && row.approved_by === approverUserId && Boolean(row.approved_at));
    assertCondition(bulkApprovalMode === 'approver_user', 'Bulk approval required service-role fallback instead of approver user flow.', {
      bulkApprovalError,
      bulkApprovalMode,
    });
    assertCondition(summary.checks.bulkApprovalApplied, 'Bulk approval update did not persist expected metadata.', {
      approvedRows,
      approvalPayload,
    });

    const templateName = `Smoke Template ${runId}`;
    const templatePayload = {
      user_id: tempUserId,
      company_id: company.id,
      name: templateName,
      preset: 'operations',
      period_start: addDaysISO(-30),
      period_end: addDaysISO(0),
      sections: {
        overview: true,
        cashflow: true,
        invoices: true,
        suppliers: true,
        taxes: false,
      },
    };

    const { data: upsertedTemplate, error: templateUpsertError } = await userClient
      .from('report_builder_templates')
      .upsert(templatePayload, { onConflict: 'user_id,company_id,name' })
      .select('id, name, preset, period_start, period_end, sections')
      .single();
    if (templateUpsertError) throw templateUpsertError;

    cleanup.templateIds = [upsertedTemplate.id];

    const { data: fetchedTemplate, error: templateFetchError } = await userClient
      .from('report_builder_templates')
      .select('id, name, preset, period_start, period_end, sections')
      .eq('id', upsertedTemplate.id)
      .single();
    if (templateFetchError) throw templateFetchError;

    summary.checks.reportTemplatePersisted = Boolean(fetchedTemplate)
      && fetchedTemplate.name === templateName
      && fetchedTemplate.preset === 'operations'
      && fetchedTemplate.sections?.suppliers === true;
    assertCondition(summary.checks.reportTemplatePersisted, 'Report Builder template is not persisted in DB as expected.', {
      upsertedTemplate,
      fetchedTemplate,
    });

    summary.passed = true;
  } finally {
    try {
      if (cleanup.notificationIds.length) {
        await safeDeleteByIds(serviceClient, 'notifications', cleanup.notificationIds);
      }
      if (approverUserId) {
        await safeDeleteByEq(serviceClient, 'user_roles', 'user_id', approverUserId);
      }
      if (cleanup.invoiceIds.length) {
        await safeDeleteByIds(serviceClient, 'supplier_invoices', cleanup.invoiceIds);
      }
      if (cleanup.templateIds.length) {
        await safeDeleteByIds(serviceClient, 'report_builder_templates', cleanup.templateIds);
      }
      if (cleanup.supplierId) {
        await safeDeleteByIds(serviceClient, 'suppliers', [cleanup.supplierId]);
      }
      if (tempUserId) {
        await safeDeleteByEq(serviceClient, 'user_company_preferences', 'user_id', tempUserId);
      }
      if (approverUserId) {
        await safeDeleteByEq(serviceClient, 'user_company_preferences', 'user_id', approverUserId);
      }
      if (cleanup.companyId) {
        await safeDeleteByIds(serviceClient, 'company', [cleanup.companyId]);
      }
      summary.cleanup.rowsDeleted = true;
    } catch (cleanupError) {
      summary.cleanup.error = cleanupError.message;
    }

    if (tempUserId) {
      try {
        const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(tempUserId);
        if (deleteUserError) throw deleteUserError;
        summary.cleanup.userDeleted = true;
      } catch (deleteUserError) {
        summary.cleanup.deleteUserError = deleteUserError.message;
      }
    }

    if (approverUserId) {
      try {
        const { error: deleteApproverError } = await adminClient.auth.admin.deleteUser(approverUserId);
        if (deleteApproverError) throw deleteApproverError;
        summary.cleanup.approverUserDeleted = true;
      } catch (deleteApproverError) {
        summary.cleanup.deleteApproverError = deleteApproverError.message;
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    message: error.message,
    details: error.details || null,
  }, null, 2));
  process.exitCode = 1;
});
