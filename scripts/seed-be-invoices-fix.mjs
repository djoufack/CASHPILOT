#!/usr/bin/env node
/**
 * Fix BE invoices - creates as draft then updates status.
 * The draft invoices + clients + expenses already exist from the main seed.
 */
import { createClient } from '@supabase/supabase-js';

const DEMO_BE_EMAIL = (process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud').trim();

function requireEnv(key) {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireFirstEnv(keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable. Expected one of: ${keys.join(', ')}`);
}

const SUPABASE_URL = requireFirstEnv(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
const SUPABASE_ANON_KEY = requireFirstEnv(['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function randBetween(min, max) { return Math.round(min + Math.random() * (max - min)); }
function roundTo(n) { return Math.round(n * 100) / 100; }

const TAX_RATE = 21;
const MONTHS = [
  { month: 1, date: '2026-01-15', dueDate: '2026-02-14' },
  { month: 2, date: '2026-02-12', dueDate: '2026-03-14' },
  { month: 3, date: '2026-03-05', dueDate: '2026-04-04' },
];

// BE companies and their sectors (clients already created by main seed)
const BE_COMPANIES = [
  { id: '8cc14a9e-6412-2a2a-541f-9f1b6b410447', prefix: '8CC1', priceRange: [8000, 30000] },
  { id: 'c863e896-bae0-8c2d-bdff-07d84047ff86', prefix: 'C863', priceRange: [5000, 20000] },
  { id: 'be71d1ae-2940-8cd9-a097-730e1a6f5743', prefix: 'BE71', priceRange: [4000, 15000] },
  { id: 'e8ef0139-2d5c-4dde-1d4c-d32016ebb9ac', prefix: 'E8EF', priceRange: [6000, 35000] },
  { id: 'e7a16a8e-8cf5-89fd-91a4-ae2ea112fb88', prefix: 'E7A1', priceRange: [8000, 28000] },
  { id: '43c2e5b8-a5aa-28e1-5a3a-12d4abed1741', prefix: '43C2', priceRange: [12000, 45000] },
];

const DESCRIPTIONS = [
  ['Gestion entrepot Q1 2026', 'Transport conteneurs maritime'],
  ['Refonte identite visuelle', 'Campagne publicitaire multi-canal'],
  ['Formation leadership 3 jours', 'Programme Excel avance'],
  ['Gestion locative portefeuille Q1', 'Commission vente immeuble'],
  ['Fourniture cacao premium lot 500kg', 'Installation ligne conditionnement'],
  ['Installation panneaux solaires 100kWc', 'Etude faisabilite parc eolien'],
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const demoBePassword = requireEnv('PILOTAGE_BE_PASSWORD');

  console.log('Logging in as BE...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: DEMO_BE_EMAIL,
    password: demoBePassword,
  });
  if (authError) { console.error('Login failed:', authError.message); return; }
  const userId = authData.user.id;

  for (let ci = 0; ci < BE_COMPANIES.length; ci++) {
    const company = BE_COMPANIES[ci];
    console.log(`\n--- Company ${company.prefix} ---`);

    // Switch active company
    await supabase.from('user_company_preferences').upsert({
      user_id: userId,
      active_company_id: company.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Get existing clients for this company
    const { data: clients } = await supabase
      .from('clients')
      .select('id, company_name')
      .eq('company_id', company.id)
      .limit(4);

    if (!clients || clients.length === 0) {
      console.log('  No clients found, skipping');
      continue;
    }

    const statuses = ['paid', 'sent', 'sent'];
    const payStatuses = ['paid', 'partial', 'unpaid'];

    for (let i = 0; i < 3; i++) {
      const m = MONTHS[i];
      const clientId = clients[i % clients.length].id;
      const invoiceId = uuid();
      const totalHt = randBetween(company.priceRange[0], company.priceRange[1]);
      const taxAmt = roundTo(totalHt * TAX_RATE / 100);
      const totalTtc = roundTo(totalHt + taxAmt);
      const status = statuses[i];
      const payStatus = payStatuses[i];
      const amountPaid = payStatus === 'paid' ? totalTtc :
                         payStatus === 'partial' ? roundTo(totalTtc * (0.3 + Math.random() * 0.4)) : 0;
      const balanceDue = roundTo(totalTtc - amountPaid);
      const invoiceNumber = `BE-SEED-${company.prefix}-2026-M${m.month}`;

      // Insert as DRAFT first (no accounting trigger)
      const { error: invErr } = await supabase.from('invoices').insert({
        id: invoiceId,
        user_id: userId,
        company_id: company.id,
        client_id: clientId,
        invoice_number: invoiceNumber,
        date: m.date,
        due_date: m.dueDate,
        status: 'draft',
        total_ht: totalHt,
        tax_rate: TAX_RATE,
        total_ttc: totalTtc,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_status: payStatus,
        notes: 'Belgique demo invoice',
        header_note: DESCRIPTIONS[ci][i % 2],
        footer_note: 'Generated for CashPilot demo',
        terms_and_conditions: 'Paiement sous 30 jours.',
        invoice_type: 'service',
        currency: 'EUR',
        reference: `REF-BE-SEED-${company.prefix}-M${m.month}`,
        created_at: `${m.date}T09:00:00Z`,
      });

      if (invErr) {
        console.error(`  Invoice draft error:`, invErr.message);
        continue;
      }

      // Add invoice items
      const item1Total = roundTo(totalHt * 0.65);
      const item2Total = roundTo(totalHt - item1Total);
      await supabase.from('invoice_items').insert([
        {
          id: uuid(), invoice_id: invoiceId, item_type: 'service',
          description: DESCRIPTIONS[ci][0], quantity: 1,
          unit_price: item1Total, total: item1Total,
          discount_type: 'none', discount_value: 0, discount_amount: 0, hsn_code: '',
          created_at: `${m.date}T09:00:00Z`,
        },
        {
          id: uuid(), invoice_id: invoiceId, item_type: 'product',
          description: DESCRIPTIONS[ci][1], quantity: randBetween(2, 5),
          unit_price: roundTo(item2Total / 3), total: item2Total,
          discount_type: 'none', discount_value: 0, discount_amount: 0, hsn_code: '',
          created_at: `${m.date}T09:10:00Z`,
        }
      ]);

      // Now update to final status (bypasses the accounting trigger issue)
      if (status !== 'draft') {
        const { error: updErr } = await supabase.from('invoices')
          .update({ status })
          .eq('id', invoiceId);
        if (updErr) console.error(`  Status update error:`, updErr.message);
      }

      console.log(`  + Invoice ${invoiceNumber}: ${totalTtc} EUR [${status}/${payStatus}]`);
    }
  }

  await supabase.auth.signOut();
  console.log('\nDone!');
}

main().catch(console.error);
