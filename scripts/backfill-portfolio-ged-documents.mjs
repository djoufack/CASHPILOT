import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const TARGETS = {
  invoices: 3,
  quotes: 2,
  credit_notes: 1,
  delivery_notes: 1,
  purchase_orders: 2,
  supplier_invoices: 2,
};

const ACCOUNTS = [
  {
    key: 'FR',
    email: 'pilotage.fr.demo@cashpilot.cloud',
    password: 'PilotageFR#2026!',
    country: 'FR',
  },
  {
    key: 'BE',
    email: 'pilotage.be.demo@cashpilot.cloud',
    password: 'PilotageBE#2026!',
    country: 'BE',
  },
  {
    key: 'OHADA',
    email: 'pilotage.ohada.demo@cashpilot.cloud',
    password: 'PilotageOHADA#2026!',
    country: 'CM',
  },
];

function loadEnvFile(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) return;

  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function addDays(isoDate, days) {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function trimPayload(templateRow, extraBlocked = []) {
  const blocked = new Set(['id', 'created_at', 'updated_at', ...extraBlocked]);
  const payload = {};

  for (const [key, value] of Object.entries(templateRow || {})) {
    if (!blocked.has(key)) payload[key] = value;
  }

  return payload;
}

function maybeSet(payload, templateRow, key, value) {
  if (templateRow && Object.prototype.hasOwnProperty.call(templateRow, key)) {
    payload[key] = value;
  }
}

async function setActiveCompanyPreference(client, userId, companyId) {
  const { error } = await client
    .from('user_company_preferences')
    .upsert(
      { user_id: userId, active_company_id: companyId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

async function countCompanyRows(client, companyId, table) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  if (error) throw error;
  return Number(count || 0);
}

async function ensureClient(client, context) {
  const { companyId, userId, companyName, templateClient, runTag, country } = context;
  const { data: existing, error: readError } = await client
    .from('clients')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;

  const payload = trimPayload(templateClient, ['company_id', 'user_id']);
  payload.user_id = userId;
  payload.company_id = companyId;
  payload.company_name = `${companyName} Client ${runTag}`;
  payload.email = `client.${runTag.toLowerCase()}.${randomUUID().slice(0, 8)}@cashpilot.demo`;
  maybeSet(payload, templateClient, 'country', country);
  maybeSet(payload, templateClient, 'city', 'Brussels');

  const { data, error } = await client.from('clients').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function ensureSupplier(client, context) {
  const { companyId, userId, companyName, templateSupplier, runTag, country } = context;
  const { data: existing, error: readError } = await client
    .from('suppliers')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;

  const payload = trimPayload(templateSupplier, ['company_id', 'user_id']);
  payload.user_id = userId;
  payload.company_id = companyId;
  payload.company_name = `${companyName} Fournisseur ${runTag}`;
  payload.email = `supplier.${runTag.toLowerCase()}.${randomUUID().slice(0, 8)}@cashpilot.demo`;
  maybeSet(payload, templateSupplier, 'country', country);
  maybeSet(payload, templateSupplier, 'city', 'Brussels');

  const { data, error } = await client.from('suppliers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function ensureInvoices(client, context, currentCount) {
  const { companyId, userId, clientId, templateInvoice, runTag } = context;
  const today = new Date().toISOString().slice(0, 10);

  let inserted = 0;
  const toInsert = Math.max(0, TARGETS.invoices - currentCount);
  for (let i = 0; i < toInsert; i += 1) {
    const index = currentCount + i + 1;
    const baseHt = 650 + index * 135;
    const taxRate = Number(templateInvoice.tax_rate || 20);
    const totalTtc = Number((baseHt * (1 + taxRate / 100)).toFixed(2));
    const payload = trimPayload(templateInvoice, ['company_id', 'user_id', 'client_id']);

    payload.user_id = userId;
    payload.company_id = companyId;
    payload.client_id = clientId;
    maybeSet(payload, templateInvoice, 'invoice_number', `GED-${runTag}-${index}`);
    maybeSet(payload, templateInvoice, 'date', addDays(today, -(18 - index)));
    maybeSet(payload, templateInvoice, 'due_date', addDays(today, 20 + index));
    maybeSet(payload, templateInvoice, 'status', index % 3 === 0 ? 'paid' : 'sent');
    maybeSet(payload, templateInvoice, 'total_ht', baseHt);
    maybeSet(payload, templateInvoice, 'tax_rate', taxRate);
    maybeSet(payload, templateInvoice, 'total_ttc', totalTtc);
    maybeSet(payload, templateInvoice, 'amount_paid', index % 3 === 0 ? totalTtc : 0);
    maybeSet(payload, templateInvoice, 'balance_due', index % 3 === 0 ? 0 : totalTtc);
    maybeSet(payload, templateInvoice, 'payment_status', index % 3 === 0 ? 'paid' : 'unpaid');
    maybeSet(payload, templateInvoice, 'notes', `Backfill GED HUB ${runTag}`);
    maybeSet(payload, templateInvoice, 'file_url', null);
    maybeSet(payload, templateInvoice, 'file_generated_at', null);

    const { error } = await client.from('invoices').insert(payload);
    if (error) throw error;
    inserted += 1;
  }

  return inserted;
}

async function ensureQuotes(client, context, currentCount) {
  const { companyId, userId, clientId, templateQuote, runTag } = context;
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0;
  const toInsert = Math.max(0, TARGETS.quotes - currentCount);

  for (let i = 0; i < toInsert; i += 1) {
    const index = currentCount + i + 1;
    const baseHt = 500 + index * 90;
    const taxRate = Number(templateQuote.tax_rate || 20);
    const totalTtc = Number((baseHt * (1 + taxRate / 100)).toFixed(2));
    const payload = trimPayload(templateQuote, ['company_id', 'user_id', 'client_id']);

    payload.user_id = userId;
    payload.company_id = companyId;
    payload.client_id = clientId;
    maybeSet(payload, templateQuote, 'quote_number', `Q-${runTag}-${index}`);
    maybeSet(payload, templateQuote, 'date', addDays(today, -(10 - index)));
    maybeSet(payload, templateQuote, 'status', index % 2 === 0 ? 'sent' : 'draft');
    maybeSet(payload, templateQuote, 'total_ht', baseHt);
    maybeSet(payload, templateQuote, 'tax_rate', taxRate);
    maybeSet(payload, templateQuote, 'total_ttc', totalTtc);
    maybeSet(payload, templateQuote, 'notes', `Backfill GED HUB devis ${runTag}`);
    maybeSet(payload, templateQuote, 'file_url', null);
    maybeSet(payload, templateQuote, 'file_generated_at', null);

    const { error } = await client.from('quotes').insert(payload);
    if (error) throw error;
    inserted += 1;
  }

  return inserted;
}

async function ensureCreditNotes(client, context, currentCount, invoiceId) {
  if (currentCount >= TARGETS.credit_notes) return 0;
  const { companyId, userId, clientId, templateCreditNote, runTag } = context;
  const today = new Date().toISOString().slice(0, 10);
  const payload = trimPayload(templateCreditNote, ['company_id', 'user_id', 'client_id', 'invoice_id']);

  payload.user_id = userId;
  payload.company_id = companyId;
  payload.client_id = clientId;
  payload.invoice_id = invoiceId;
  maybeSet(payload, templateCreditNote, 'credit_note_number', `AV-${runTag}-1`);
  maybeSet(payload, templateCreditNote, 'date', addDays(today, -2));
  maybeSet(payload, templateCreditNote, 'status', 'issued');
  maybeSet(payload, templateCreditNote, 'notes', `Backfill GED HUB avoir ${runTag}`);
  maybeSet(payload, templateCreditNote, 'file_url', null);
  maybeSet(payload, templateCreditNote, 'file_generated_at', null);

  const { error } = await client.from('credit_notes').insert(payload);
  if (error) throw error;
  return 1;
}

async function ensureDeliveryNotes(client, context, currentCount, invoiceId) {
  if (currentCount >= TARGETS.delivery_notes) return 0;
  const { companyId, userId, clientId, templateDeliveryNote, runTag } = context;
  const today = new Date().toISOString().slice(0, 10);
  const payload = trimPayload(templateDeliveryNote, ['company_id', 'user_id', 'client_id', 'invoice_id']);

  payload.user_id = userId;
  payload.company_id = companyId;
  payload.client_id = clientId;
  payload.invoice_id = invoiceId;
  maybeSet(payload, templateDeliveryNote, 'delivery_note_number', `BL-${runTag}-1`);
  maybeSet(payload, templateDeliveryNote, 'date', addDays(today, -1));
  maybeSet(payload, templateDeliveryNote, 'status', 'delivered');
  maybeSet(payload, templateDeliveryNote, 'notes', `Backfill GED HUB livraison ${runTag}`);
  maybeSet(payload, templateDeliveryNote, 'file_url', null);
  maybeSet(payload, templateDeliveryNote, 'file_generated_at', null);

  const { error } = await client.from('delivery_notes').insert(payload);
  if (error) throw error;
  return 1;
}

async function ensurePurchaseOrders(client, context, currentCount) {
  const { companyId, userId, clientId, supplierId, templatePurchaseOrder, runTag } = context;
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0;
  const toInsert = Math.max(0, TARGETS.purchase_orders - currentCount);

  for (let i = 0; i < toInsert; i += 1) {
    const index = currentCount + i + 1;
    const total = 880 + index * 145;
    const payload = trimPayload(templatePurchaseOrder, ['company_id', 'user_id', 'client_id', 'supplier_id']);

    payload.user_id = userId;
    payload.company_id = companyId;
    payload.client_id = clientId;
    maybeSet(payload, templatePurchaseOrder, 'supplier_id', supplierId);
    maybeSet(payload, templatePurchaseOrder, 'po_number', `BC-${runTag}-${index}`);
    maybeSet(payload, templatePurchaseOrder, 'date', addDays(today, -(9 - index)));
    maybeSet(payload, templatePurchaseOrder, 'due_date', addDays(today, 25 + index));
    maybeSet(payload, templatePurchaseOrder, 'status', index % 2 === 0 ? 'approved' : 'draft');
    maybeSet(payload, templatePurchaseOrder, 'total', total);
    maybeSet(payload, templatePurchaseOrder, 'notes', `Backfill GED HUB BC ${runTag}`);
    maybeSet(payload, templatePurchaseOrder, 'file_url', null);
    maybeSet(payload, templatePurchaseOrder, 'file_generated_at', null);

    const { error } = await client.from('purchase_orders').insert(payload);
    if (error) throw error;
    inserted += 1;
  }

  return inserted;
}

async function ensureSupplierInvoices(client, context, currentCount) {
  const { companyId, supplierId, templateSupplierInvoice, runTag } = context;
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0;
  const toInsert = Math.max(0, TARGETS.supplier_invoices - currentCount);

  for (let i = 0; i < toInsert; i += 1) {
    const index = currentCount + i + 1;
    const baseHt = 740 + index * 120;
    const vatRate = Number(templateSupplierInvoice.vat_rate || 20);
    const vatAmount = Number((baseHt * vatRate / 100).toFixed(2));
    const totalAmount = Number((baseHt + vatAmount).toFixed(2));
    const payload = trimPayload(templateSupplierInvoice, ['company_id', 'supplier_id']);

    payload.company_id = companyId;
    payload.supplier_id = supplierId;
    maybeSet(payload, templateSupplierInvoice, 'invoice_number', `FAF-${runTag}-${index}`);
    maybeSet(payload, templateSupplierInvoice, 'invoice_date', addDays(today, -(12 - index)));
    maybeSet(payload, templateSupplierInvoice, 'due_date', addDays(today, 12 + index * 3));
    maybeSet(payload, templateSupplierInvoice, 'total_ht', baseHt);
    maybeSet(payload, templateSupplierInvoice, 'vat_rate', vatRate);
    maybeSet(payload, templateSupplierInvoice, 'vat_amount', vatAmount);
    maybeSet(payload, templateSupplierInvoice, 'total_amount', totalAmount);
    maybeSet(payload, templateSupplierInvoice, 'total_ttc', totalAmount);
    maybeSet(payload, templateSupplierInvoice, 'payment_status', index % 2 === 0 ? 'paid' : 'pending');
    maybeSet(payload, templateSupplierInvoice, 'notes', `Backfill GED HUB fournisseur ${runTag}`);
    maybeSet(payload, templateSupplierInvoice, 'file_url', null);

    const { error } = await client.from('supplier_invoices').insert(payload);
    if (error) throw error;
    inserted += 1;
  }

  return inserted;
}

async function getFirstRow(client, table, companyId) {
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function runAccount(account) {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (authError) throw authError;
  const userId = authData.user.id;

  const { data: prefData } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();
  const previousActiveCompanyId = prefData?.active_company_id || null;

  const { data: companies, error: companiesError } = await supabase
    .from('company')
    .select('id, company_name, country, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (companiesError) throw companiesError;

  let sourceCompany = null;
  let sourceScore = -1;
  for (const company of companies || []) {
    const score = await countCompanyRows(supabase, company.id, 'invoices');
    if (score > sourceScore) {
      sourceCompany = company;
      sourceScore = score;
    }
  }
  if (!sourceCompany) throw new Error(`No source company found for ${account.key}`);

  const templates = {
    client: await getFirstRow(supabase, 'clients', sourceCompany.id),
    supplier: await getFirstRow(supabase, 'suppliers', sourceCompany.id),
    invoice: await getFirstRow(supabase, 'invoices', sourceCompany.id),
    quote: await getFirstRow(supabase, 'quotes', sourceCompany.id),
    creditNote: await getFirstRow(supabase, 'credit_notes', sourceCompany.id),
    deliveryNote: await getFirstRow(supabase, 'delivery_notes', sourceCompany.id),
    purchaseOrder: await getFirstRow(supabase, 'purchase_orders', sourceCompany.id),
    supplierInvoice: await getFirstRow(supabase, 'supplier_invoices', sourceCompany.id),
  };

  const missingTemplates = Object.entries(templates)
    .filter(([, row]) => !row)
    .map(([name]) => name);
  if (missingTemplates.length > 0) {
    throw new Error(`Missing template rows for ${account.key}: ${missingTemplates.join(', ')}`);
  }

  const summary = [];
  let index = 1;

  for (const company of companies || []) {
    const runTag = `${account.key}${String(index).padStart(2, '0')}`;
    index += 1;

    await setActiveCompanyPreference(supabase, userId, company.id);

    const before = {
      invoices: await countCompanyRows(supabase, company.id, 'invoices'),
      quotes: await countCompanyRows(supabase, company.id, 'quotes'),
      credit_notes: await countCompanyRows(supabase, company.id, 'credit_notes'),
      delivery_notes: await countCompanyRows(supabase, company.id, 'delivery_notes'),
      purchase_orders: await countCompanyRows(supabase, company.id, 'purchase_orders'),
      supplier_invoices: await countCompanyRows(supabase, company.id, 'supplier_invoices'),
    };

    const clientRow = await ensureClient(supabase, {
      companyId: company.id,
      userId,
      companyName: company.company_name,
      templateClient: templates.client,
      runTag,
      country: company.country || account.country,
    });

    const supplierRow = await ensureSupplier(supabase, {
      companyId: company.id,
      userId,
      companyName: company.company_name,
      templateSupplier: templates.supplier,
      runTag,
      country: company.country || account.country,
    });

    const insertedInvoices = await ensureInvoices(
      supabase,
      {
        companyId: company.id,
        userId,
        clientId: clientRow.id,
        templateInvoice: templates.invoice,
        runTag,
      },
      before.invoices
    );

    const { data: referenceInvoice, error: invoiceRefError } = await supabase
      .from('invoices')
      .select('id')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (invoiceRefError) throw invoiceRefError;

    const insertedQuotes = await ensureQuotes(
      supabase,
      {
        companyId: company.id,
        userId,
        clientId: clientRow.id,
        templateQuote: templates.quote,
        runTag,
      },
      before.quotes
    );

    const insertedCreditNotes = await ensureCreditNotes(
      supabase,
      {
        companyId: company.id,
        userId,
        clientId: clientRow.id,
        templateCreditNote: templates.creditNote,
        runTag,
      },
      before.credit_notes,
      referenceInvoice.id
    );

    const insertedDeliveryNotes = await ensureDeliveryNotes(
      supabase,
      {
        companyId: company.id,
        userId,
        clientId: clientRow.id,
        templateDeliveryNote: templates.deliveryNote,
        runTag,
      },
      before.delivery_notes,
      referenceInvoice.id
    );

    const insertedPurchaseOrders = await ensurePurchaseOrders(
      supabase,
      {
        companyId: company.id,
        userId,
        clientId: clientRow.id,
        supplierId: supplierRow.id,
        templatePurchaseOrder: templates.purchaseOrder,
        runTag,
      },
      before.purchase_orders
    );

    const insertedSupplierInvoices = await ensureSupplierInvoices(
      supabase,
      {
        companyId: company.id,
        supplierId: supplierRow.id,
        templateSupplierInvoice: templates.supplierInvoice,
        runTag,
      },
      before.supplier_invoices
    );

    const after = {
      invoices: await countCompanyRows(supabase, company.id, 'invoices'),
      quotes: await countCompanyRows(supabase, company.id, 'quotes'),
      credit_notes: await countCompanyRows(supabase, company.id, 'credit_notes'),
      delivery_notes: await countCompanyRows(supabase, company.id, 'delivery_notes'),
      purchase_orders: await countCompanyRows(supabase, company.id, 'purchase_orders'),
      supplier_invoices: await countCompanyRows(supabase, company.id, 'supplier_invoices'),
    };

    summary.push({
      company: company.company_name,
      companyId: company.id,
      before,
      inserted: {
        invoices: insertedInvoices,
        quotes: insertedQuotes,
        credit_notes: insertedCreditNotes,
        delivery_notes: insertedDeliveryNotes,
        purchase_orders: insertedPurchaseOrders,
        supplier_invoices: insertedSupplierInvoices,
      },
      after,
    });
  }

  if (previousActiveCompanyId) {
    await setActiveCompanyPreference(supabase, userId, previousActiveCompanyId);
  }

  await supabase.auth.signOut();

  return {
    account: account.key,
    sourceCompany: sourceCompany.company_name,
    summary,
  };
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env');
  }

  const output = [];
  for (const account of ACCOUNTS) {
    output.push(await runAccount(account));
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error('[backfill-portfolio-ged-documents] fatal', error);
  process.exit(1);
});
