import { createClient } from '@supabase/supabase-js';

const ONE_PIXEL_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+Xn1nAAAAAElFTkSuQmCC';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function optionalEnv(name, fallback = null) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    return fallback;
  }

  return String(value).trim();
}

function resolveStripeMode(rawValue) {
  const normalized = String(rawValue || 'full').trim().toLowerCase();
  if (['full', 'safe', 'no-create'].includes(normalized)) {
    return normalized === 'no-create' ? 'safe' : normalized;
  }

  throw new Error(`Unsupported SMOKE_STRIPE_MODE: ${rawValue}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function describeUnknownError(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const fields = ['code', 'message', 'details', 'hint'];
    const compact = {};
    for (const field of fields) {
      if (error[field] != null) compact[field] = error[field];
    }
    if (Object.keys(compact).length > 0) {
      try {
        return JSON.stringify(compact);
      } catch {
        return String(error);
      }
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildRunId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function buildPassword(runId) {
  return `Smoke#${runId.slice(-10)}!`;
}

function buildClient(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function signInWithRetry(url, anonKey, email, password, attempts = 8) {
  let lastError = null;

  for (let index = 1; index <= attempts; index += 1) {
    const client = buildClient(url, anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data?.session?.access_token && data?.user?.id) {
      return {
        client,
        session: data.session,
        user: data.user,
      };
    }

    lastError = error || new Error(`Authentication attempt ${index} failed without session.`);
    await sleep(750 * index);
  }

  throw lastError;
}

async function invokeFunction(supabaseUrl, anonKey, functionName, options = {}) {
  const {
    session = null,
    body,
    headers = {},
    method = 'POST',
  } = options;

  const requestHeaders = {
    apikey: anonKey,
    'x-client-info': 'smoke-runtime-features',
    ...headers,
  };

  if (session?.access_token) {
    requestHeaders.Authorization = `Bearer ${session.access_token}`;
  }

  let payload;
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    text,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function invokeFunctionWithClient(client, functionName, body) {
  const { data, error } = await client.functions.invoke(functionName, { body });

  if (!error) {
    return {
      ok: true,
      status: 200,
      data,
      text: null,
    };
  }

  let status = null;
  let text = error.message || null;
  let payload = null;

  if (error.context) {
    const response = typeof error.context.clone === 'function'
      ? error.context.clone()
      : error.context;

    status = response.status ?? null;

    try {
      payload = await response.json();
      text = payload?.error || JSON.stringify(payload);
    } catch {
      try {
        text = await response.text();
      } catch {
        text = error.message || text;
      }
    }
  }

  return {
    ok: false,
    status,
    data: payload,
    text,
    error,
  };
}

async function fetchPage(url) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'cashpilot-runtime-smoke',
    },
  });

  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    location: response.headers.get('location'),
    contentType: response.headers.get('content-type'),
    text,
  };
}

function extractTokenFromSignatureUrl(signatureUrl) {
  const url = new URL(signatureUrl);
  const segments = url.pathname.split('/').filter(Boolean);
  return segments.at(-1) || null;
}

function parseStoragePath(signatureUrl) {
  if (!signatureUrl || !signatureUrl.startsWith('storage://signatures/')) {
    return null;
  }

  return signatureUrl.replace('storage://signatures/', '');
}

async function createTemporaryUser(adminClient, runId) {
  const email = `smoke.runtime.${runId}@cashpilot.test`;
  const password = buildPassword(runId);

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `Runtime Smoke ${runId}`,
    },
  });

  if (error) {
    throw error;
  }

  return {
    email,
    password,
    user: data.user,
  };
}

async function createCompany(authClient, userId, payload) {
  const { data, error } = await authClient
    .from('company')
    .insert([{
      user_id: userId,
      company_name: payload.company_name,
      company_type: payload.company_type || 'company',
      country: payload.country || 'BE',
      currency: payload.currency || 'EUR',
      accounting_currency: payload.accounting_currency || 'EUR',
      email: payload.email || null,
      city: payload.city || 'Brussels',
    }])
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function setActiveCompany(authClient, userId, companyId) {
  const { error } = await authClient
    .from('user_company_preferences')
    .upsert({
      user_id: userId,
      active_company_id: companyId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    throw error;
  }
}

async function readActiveCompany(authClient, userId) {
  const { data, error } = await authClient
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.active_company_id || null;
}

async function createBusinessClient(authClient, userId, companyId, runId, suffix) {
  const { data, error } = await authClient
    .from('clients')
    .insert([{
      user_id: userId,
      company_id: companyId,
      company_name: `Smoke Client ${suffix.toUpperCase()} ${runId}`,
      email: `smoke.client.${suffix}.${runId}@cashpilot.test`,
      country: 'BE',
      city: 'Brussels',
    }])
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createQuote(authClient, userId, companyId, clientId, runId) {
  const { data, error } = await authClient
    .from('quotes')
    .insert([{
      user_id: userId,
      company_id: companyId,
      client_id: clientId,
      quote_number: `QT-SMOKE-${runId.toUpperCase()}`,
      date: isoDate(),
      total_ht: 100,
      tax_rate: 21,
      total_ttc: 121,
      status: 'draft',
    }])
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createInvoice(authClient, userId, companyId, clientId, runId, suffix, config) {
  const draftInsert = await authClient
    .from('invoices')
    .insert([{
      user_id: userId,
      company_id: companyId,
      client_id: clientId,
      invoice_number: `INV-SMOKE-${suffix.toUpperCase()}-${runId.toUpperCase()}`,
      date: isoDate(),
      due_date: isoDate(7),
      status: 'draft',
      total_ht: 0,
      total_ttc: 0,
      tax_rate: config.taxRate ?? 21,
      balance_due: 0,
      payment_status: 'unpaid',
      notes: `Runtime smoke invoice ${suffix}`,
      currency: config.currency || 'EUR',
    }])
    .select('*')
    .single();

  if (draftInsert.error) {
    throw draftInsert.error;
  }

  const invoice = draftInsert.data;

  const itemInsert = await authClient
    .from('invoice_items')
    .insert([{
      invoice_id: invoice.id,
      description: `Smoke Item ${suffix}`,
      quantity: 1,
      unit_price: config.totalHt,
      total: config.totalHt,
    }])
    .select('*')
    .single();

  if (itemInsert.error) {
    throw itemInsert.error;
  }

  const { data, error } = await authClient
    .from('invoices')
    .update({
      status: config.status,
      total_ht: config.totalHt,
      tax_rate: config.taxRate ?? 21,
      total_ttc: config.totalTtc,
      balance_due: config.balanceDue,
      payment_status: config.paymentStatus,
    })
    .eq('id', invoice.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    invoice: data,
    item: itemInsert.data,
  };
}

async function insertBalancedEntries(preferredClient, fallbackClient, userId, companyId, entryRef, amount) {
  const payload = [
    {
      user_id: userId,
      company_id: companyId,
      transaction_date: isoDate(),
      account_code: '512000',
      debit: amount,
      credit: 0,
      journal: 'OD',
      entry_ref: entryRef,
      is_auto: false,
      description: `Smoke debit ${entryRef}`,
    },
    {
      user_id: userId,
      company_id: companyId,
      transaction_date: isoDate(),
      account_code: '707000',
      debit: 0,
      credit: amount,
      journal: 'OD',
      entry_ref: entryRef,
      is_auto: false,
      description: `Smoke credit ${entryRef}`,
    },
  ];

  const preferredResult = await preferredClient
    .from('accounting_entries')
    .insert(payload)
    .select('id, company_id, entry_ref, debit, credit');

  if (!preferredResult.error) {
    return {
      mode: 'authenticated',
      rows: preferredResult.data || [],
    };
  }

  const fallbackResult = await fallbackClient
    .from('accounting_entries')
    .insert(payload)
    .select('id, company_id, entry_ref, debit, credit');

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return {
    mode: 'service_role',
    rows: fallbackResult.data || [],
    fallbackReason: preferredResult.error.message,
  };
}

async function verifySignatureObject(serviceClient, storagePath) {
  const lastSlashIndex = storagePath.lastIndexOf('/');
  const prefix = lastSlashIndex === -1 ? '' : storagePath.slice(0, lastSlashIndex);
  const fileName = lastSlashIndex === -1 ? storagePath : storagePath.slice(lastSlashIndex + 1);

  const { data, error } = await serviceClient
    .storage
    .from('signatures')
    .list(prefix);

  if (error) {
    throw error;
  }

  return (data || []).some((file) => file.name === fileName);
}

async function removeSignatureObject(serviceClient, storagePath) {
  if (!storagePath) {
    return false;
  }

  const { error } = await serviceClient
    .storage
    .from('signatures')
    .remove([storagePath]);

  if (error) {
    throw error;
  }

  return true;
}

async function deleteTemporaryUser(adminClient, userId) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }
}

async function deleteUserArtifacts(serviceClient, userId) {
  const cleanupTables = [
    'accounting_audit_log',
    'accounting_entries',
    'accounting_health',
  ];

  for (const table of cleanupTables) {
    const { error } = await serviceClient
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
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const defaultAppUrl = optionalEnv('SMOKE_APP_URL', 'https://cashpilot.tech');
  const cleanupEnabled = optionalEnv('SMOKE_CLEANUP', 'true') !== 'false';
  const stripeMode = resolveStripeMode(optionalEnv('SMOKE_STRIPE_MODE', 'full'));
  const runId = buildRunId();

  const adminClient = buildClient(supabaseUrl, serviceRoleKey);
  const serviceClient = buildClient(supabaseUrl, serviceRoleKey);
  const anonClient = buildClient(supabaseUrl, anonKey);

  const cleanupState = {
    userId: null,
    signatureStoragePath: null,
  };

  const summary = {
    runId,
    projectUrl: supabaseUrl,
    appUrl: defaultAppUrl,
    cleanupEnabled,
    stripeMode,
    passed: false,
    failures: [],
    user: null,
    signature: {},
    stripe: {},
    multiCompany: {},
    cleanup: {
      signatureRemoved: false,
      userDeleted: false,
    },
  };
  const { failures } = summary;

  try {
    const tempUser = await createTemporaryUser(adminClient, runId);
    cleanupState.userId = tempUser.user.id;
    summary.user = {
      id: tempUser.user.id,
      email: tempUser.email,
    };

    const auth = await signInWithRetry(supabaseUrl, anonKey, tempUser.email, tempUser.password);
    const authClient = auth.client;
    const user = auth.user;
    let appUrl = defaultAppUrl;

    const companyA = await createCompany(authClient, user.id, {
      company_name: `Smoke Alpha ${runId}`,
    });
    const companyB = await createCompany(authClient, user.id, {
      company_name: `Smoke Beta ${runId}`,
    });
    await setActiveCompany(authClient, user.id, companyA.id);

    const activeCompanyAfterInit = await readActiveCompany(authClient, user.id);
    assert(activeCompanyAfterInit === companyA.id, 'Active company was not persisted after initial switch.');

    const clientA = await createBusinessClient(authClient, user.id, companyA.id, runId, 'a');
    await setActiveCompany(authClient, user.id, companyB.id);
    const activeCompanyBeforeClientB = await readActiveCompany(authClient, user.id);
    assert(activeCompanyBeforeClientB === companyB.id, 'Active company was not persisted before creating Company B data.');
    const clientB = await createBusinessClient(authClient, user.id, companyB.id, runId, 'b');
    await setActiveCompany(authClient, user.id, companyA.id);
    const activeCompanyAfterClientBootstrap = await readActiveCompany(authClient, user.id);
    assert(activeCompanyAfterClientBootstrap === companyA.id, 'Active company was not restored to Company A after bootstrap.');

    await setActiveCompany(authClient, user.id, companyA.id);
    const quote = await createQuote(authClient, user.id, companyA.id, clientA.id, runId);
    const quoteRequest = await invokeFunctionWithClient(authClient, 'quote-sign-request', {
      quoteId: quote.id,
      signerEmail: `signer.${runId}@cashpilot.test`,
    });
    let signatureUrl = quoteRequest.data?.signatureUrl || null;
    let signatureToken = signatureUrl ? extractTokenFromSignatureUrl(signatureUrl) : null;

    if (quoteRequest.ok && signatureUrl && signatureToken) {
      appUrl = new URL(signatureUrl).origin || defaultAppUrl;
    } else {
      failures.push(`quote-sign-request:${quoteRequest.status ?? 'unknown'}:${quoteRequest.text || 'no-body'}`);

      const fallbackToken = `manual${crypto.randomUUID().replace(/-/g, '')}`;
      const fallbackExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const fallbackUpdate = await serviceClient
        .from('quotes')
        .update({
          signature_status: 'pending',
          signature_token: fallbackToken,
          signature_token_expires_at: fallbackExpiresAt,
          signer_email: `signer.${runId}@cashpilot.test`,
          status: 'sent',
        })
        .eq('id', quote.id)
        .select('id')
        .single();

      if (fallbackUpdate.error) {
        throw fallbackUpdate.error;
      }

      signatureToken = fallbackToken;
      signatureUrl = `${appUrl}/quote-sign/${signatureToken}`;
    }

    assert(signatureToken, 'Unable to resolve a signature token for the public signature smoke test.');

    const publicQuoteFetch = await invokeFunction(supabaseUrl, anonKey, 'quote-sign-get', {
      body: {
        token: signatureToken,
      },
    });
    assert(publicQuoteFetch.ok, `quote-sign-get failed with ${publicQuoteFetch.status}: ${publicQuoteFetch.text}`);
    assert(publicQuoteFetch.data?.quote?.id === quote.id, 'Public quote fetch did not return the pending quote by token.');

    const signaturePage = await fetchPage(signatureUrl);
    assert(signaturePage.status >= 200 && signaturePage.status < 400, `Signature page returned ${signaturePage.status}.`);

    const quoteSubmit = await invokeFunctionWithClient(anonClient, 'quote-sign-submit', {
      token: signatureToken,
      signerName: 'Runtime Smoke Tester',
      signatureDataUrl: ONE_PIXEL_PNG_DATA_URL,
      action: 'sign',
    });

    assert(quoteSubmit.ok, `quote-sign-submit failed with ${quoteSubmit.status}: ${quoteSubmit.text}`);
    assert(quoteSubmit.data?.success === true, 'quote-sign-submit did not report success.');

    const signedQuoteResult = await serviceClient
      .from('quotes')
      .select('id, status, signature_status, signed_by, signed_at, signature_url')
      .eq('id', quote.id)
      .single();

    if (signedQuoteResult.error) {
      throw signedQuoteResult.error;
    }

    const signedQuote = signedQuoteResult.data;
    assert(signedQuote.status === 'accepted', 'Signed quote did not transition to accepted.');
    assert(signedQuote.signature_status === 'signed', 'Signed quote did not transition to signed.');
    assert(signedQuote.signed_by === 'Runtime Smoke Tester', 'Signed quote did not persist signer name.');
    assert(Boolean(signedQuote.signature_url), 'Signed quote did not persist signature_url.');

    const signatureStoragePath = parseStoragePath(signedQuote.signature_url);
    assert(signatureStoragePath, 'Signed quote signature_url did not resolve to a storage path.');
    cleanupState.signatureStoragePath = signatureStoragePath;

    const signatureObjectPresent = await verifySignatureObject(serviceClient, signatureStoragePath);
    assert(signatureObjectPresent, 'Signature image was not found in storage.');

    summary.appUrl = appUrl;

    summary.signature = {
      quoteId: quote.id,
      requestStatus: quoteRequest.status,
      requestGatewayAuthFailure:
        quoteRequest.status === 401 &&
        String(quoteRequest.text || '').toLowerCase().includes('invalid jwt'),
      signatureUrl,
      signaturePageStatus: signaturePage.status,
      publicQuoteRead: true,
      submitStatus: quoteSubmit.status,
      finalStatus: signedQuote.status,
      finalSignatureStatus: signedQuote.signature_status,
      signatureObjectPresent,
      requestFallbackUsed: !quoteRequest.ok,
    };

    await setActiveCompany(authClient, user.id, companyA.id);
    const openInvoiceArtifacts = await createInvoice(authClient, user.id, companyA.id, clientA.id, runId, 'open', {
      status: 'sent',
      paymentStatus: 'partial',
      totalHt: 100,
      totalTtc: 121,
      balanceDue: 20.5,
      taxRate: 21,
    });

    const settledInvoiceArtifacts = await createInvoice(authClient, user.id, companyA.id, clientA.id, runId, 'settled', {
      status: 'paid',
      paymentStatus: 'paid',
      totalHt: 100,
      totalTtc: 121,
      balanceDue: 0,
      taxRate: 21,
    });

    await setActiveCompany(authClient, user.id, companyB.id);
    const companyBInvoiceArtifacts = await createInvoice(authClient, user.id, companyB.id, clientB.id, runId, 'beta', {
      status: 'sent',
      paymentStatus: 'unpaid',
      totalHt: 50,
      totalTtc: 60.5,
      balanceDue: 60.5,
      taxRate: 21,
    });
    await setActiveCompany(authClient, user.id, companyA.id);

    const stripeOpen = stripeMode === 'full'
      ? await invokeFunctionWithClient(authClient, 'stripe-invoice-link', {
        invoiceId: openInvoiceArtifacts.invoice.id,
      })
      : {
        ok: true,
        status: null,
        data: null,
        text: null,
        skipped: true,
      };
    const stripeSettled = await invokeFunctionWithClient(authClient, 'stripe-invoice-link', {
      invoiceId: settledInvoiceArtifacts.invoice.id,
    });

    const paymentSuccessPage = await fetchPage(`${appUrl}/payment-success?invoice=${openInvoiceArtifacts.invoice.id}`);
    assert(paymentSuccessPage.status >= 200 && paymentSuccessPage.status < 400, `Payment success page returned ${paymentSuccessPage.status}.`);

    let stripeOpenFetch = null;
    let storedStripeLink = null;

    if (stripeMode === 'full' && !stripeOpen.ok) {
      failures.push(`stripe-invoice-link-open:${stripeOpen.status ?? 'unknown'}:${stripeOpen.text || 'no-body'}`);
    } else if (stripeMode === 'full') {
      assert(stripeOpen.data?.paymentLinkUrl, 'stripe-invoice-link did not return paymentLinkUrl.');
      assert(String(stripeOpen.data.paymentLinkUrl).includes('stripe.com'), 'stripe-invoice-link did not return a Stripe URL.');

      stripeOpenFetch = await fetchPage(stripeOpen.data.paymentLinkUrl);
      assert(stripeOpenFetch.status >= 200 && stripeOpenFetch.status < 400, `Stripe payment link page returned ${stripeOpenFetch.status}.`);

      storedStripeLink = await serviceClient
        .from('invoices')
        .select('id, stripe_payment_link_id, stripe_payment_link_url, payment_link_created_at, balance_due, total_ttc')
        .eq('id', openInvoiceArtifacts.invoice.id)
        .single();

      if (storedStripeLink.error) {
        throw storedStripeLink.error;
      }

      assert(storedStripeLink.data.stripe_payment_link_url === stripeOpen.data.paymentLinkUrl, 'Invoice did not persist the returned Stripe payment link URL.');
      assert(Boolean(storedStripeLink.data.payment_link_created_at), 'Invoice did not persist payment_link_created_at.');
    }

    if (!stripeSettled.ok) {
      if (stripeSettled.status !== 400 || !String(stripeSettled.data?.error || stripeSettled.text || '').toLowerCase().includes('settled')) {
        failures.push(`stripe-invoice-link-settled:${stripeSettled.status ?? 'unknown'}:${stripeSettled.text || 'no-body'}`);
      }
    } else {
      failures.push('stripe-invoice-link-settled:unexpected-success');
    }

    summary.stripe = {
      mode: stripeMode,
      creationSkipped: stripeMode !== 'full',
      openInvoiceId: openInvoiceArtifacts.invoice.id,
      settledInvoiceId: settledInvoiceArtifacts.invoice.id,
      openInvokeStatus: stripeOpen.status,
      settledInvokeStatus: stripeSettled.status,
      openGatewayAuthFailure:
        stripeMode === 'full' &&
        stripeOpen.status === 401 &&
        String(stripeOpen.text || '').toLowerCase().includes('invalid jwt'),
      settledGatewayAuthFailure:
        stripeSettled.status === 401 &&
        String(stripeSettled.text || '').toLowerCase().includes('invalid jwt'),
      paymentLinkUrl: stripeOpen.data?.paymentLinkUrl || null,
      paymentLinkStatus: stripeOpen.status,
      paymentLinkReachableStatus: stripeOpenFetch?.status || null,
      persistedOnInvoice: Boolean(storedStripeLink?.data?.stripe_payment_link_url),
      settledInvoiceRejectedStatus: stripeSettled.status,
      paymentSuccessPageStatus: paymentSuccessPage.status,
    };

    const companyAEntryRef = `SMOKE-MC-A-${runId.toUpperCase()}`;
    const companyBEntryRef = `SMOKE-MC-B-${runId.toUpperCase()}`;

    const companyAEntries = await insertBalancedEntries(
      authClient,
      serviceClient,
      user.id,
      companyA.id,
      companyAEntryRef,
      12.34,
    );
    const companyBEntries = await insertBalancedEntries(
      authClient,
      serviceClient,
      user.id,
      companyB.id,
      companyBEntryRef,
      56.78,
    );

    const fetchScopedData = async (activeCompanyId) => {
      const invoicesResult = await authClient
        .from('invoices')
        .select('id, company_id, invoice_number')
        .eq('user_id', user.id)
        .or(`company_id.is.null,company_id.eq.${activeCompanyId}`)
        .in('id', [openInvoiceArtifacts.invoice.id, companyBInvoiceArtifacts.invoice.id]);

      if (invoicesResult.error) {
        throw invoicesResult.error;
      }

      const entriesResult = await authClient
        .from('accounting_entries')
        .select('id, company_id, entry_ref')
        .eq('user_id', user.id)
        .eq('company_id', activeCompanyId)
        .in('entry_ref', [companyAEntryRef, companyBEntryRef]);

      if (entriesResult.error) {
        throw entriesResult.error;
      }

      return {
        invoices: invoicesResult.data || [],
        entries: entriesResult.data || [],
      };
    };

    await setActiveCompany(authClient, user.id, companyA.id);
    const persistedCompanyA = await readActiveCompany(authClient, user.id);
    assert(persistedCompanyA === companyA.id, 'Active company persistence failed for company A.');
    const scopedCompanyA = await fetchScopedData(companyA.id);

    await setActiveCompany(authClient, user.id, companyB.id);
    const persistedCompanyB = await readActiveCompany(authClient, user.id);
    assert(persistedCompanyB === companyB.id, 'Active company persistence failed for company B.');
    const scopedCompanyB = await fetchScopedData(companyB.id);

    const companyAInvoiceIds = scopedCompanyA.invoices.map((row) => row.id);
    const companyBInvoiceIds = scopedCompanyB.invoices.map((row) => row.id);
    const companyAEntryRefs = scopedCompanyA.entries.map((row) => row.entry_ref);
    const companyBEntryRefs = scopedCompanyB.entries.map((row) => row.entry_ref);

    assert(companyAInvoiceIds.includes(openInvoiceArtifacts.invoice.id), 'Company A scoped invoices did not include the Company A invoice.');
    assert(!companyAInvoiceIds.includes(companyBInvoiceArtifacts.invoice.id), 'Company A scoped invoices leaked the Company B invoice.');
    assert(companyBInvoiceIds.includes(companyBInvoiceArtifacts.invoice.id), 'Company B scoped invoices did not include the Company B invoice.');
    assert(!companyBInvoiceIds.includes(openInvoiceArtifacts.invoice.id), 'Company B scoped invoices leaked the Company A invoice.');
    assert(companyAEntryRefs.includes(companyAEntryRef), 'Company A scoped accounting entries did not include the Company A entry_ref.');
    assert(!companyAEntryRefs.includes(companyBEntryRef), 'Company A scoped accounting entries leaked the Company B entry_ref.');
    assert(companyBEntryRefs.includes(companyBEntryRef), 'Company B scoped accounting entries did not include the Company B entry_ref.');
    assert(!companyBEntryRefs.includes(companyAEntryRef), 'Company B scoped accounting entries leaked the Company A entry_ref.');

    summary.multiCompany = {
      companyIds: {
        alpha: companyA.id,
        beta: companyB.id,
      },
      persistedActiveCompanyIds: {
        alpha: persistedCompanyA,
        beta: persistedCompanyB,
      },
      accountingEntryInsertModes: {
        alpha: companyAEntries.mode,
        beta: companyBEntries.mode,
      },
      companyAVisibleInvoiceIds: companyAInvoiceIds,
      companyAVisibleEntryRefs: companyAEntryRefs,
      companyBVisibleInvoiceIds: companyBInvoiceIds,
      companyBVisibleEntryRefs: companyBEntryRefs,
    };

    await authClient.auth.signOut();
  } catch (error) {
    failures.push(describeUnknownError(error));
  } finally {
    if (cleanupEnabled) {
      if (cleanupState.signatureStoragePath) {
        try {
          summary.cleanup.signatureRemoved = await removeSignatureObject(serviceClient, cleanupState.signatureStoragePath);
        } catch (error) {
          summary.cleanup.signatureRemoved = false;
          summary.cleanup.signatureRemoveError = error.message;
        }
      }

      if (cleanupState.userId) {
        try {
          await deleteUserArtifacts(serviceClient, cleanupState.userId);
          await deleteTemporaryUser(adminClient, cleanupState.userId);
          summary.cleanup.userDeleted = true;
        } catch (error) {
          summary.cleanup.userDeleted = false;
          summary.cleanup.userDeleteError = error.message;
        }
      }
    }
  }

  summary.passed = failures.length === 0;
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
