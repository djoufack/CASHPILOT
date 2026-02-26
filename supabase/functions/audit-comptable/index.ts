// Supabase Edge Function: audit-comptable
// Core accounting audit engine with 17 checks across 3 categories.
// Produces a scored report with grade, recommendations, and per-check details.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  id: string;
  name: string;
  status: 'pass' | 'warning' | 'fail';
  severity: 'error' | 'warning' | 'info';
  details: string;
  recommendation: string | null;
  items?: any[];
}

interface CategoryResult {
  score: number;
  label: string;
  checks: CheckResult[];
}

interface AuditOutput {
  score: number;
  grade: string;
  period: { start: string; end: string };
  country: string;
  generated_at: string;
  summary: { total_checks: number; passed: number; warnings: number; errors: number };
  categories: Record<string, CategoryResult>;
  recommendations: { priority: string; category: string; check_id: string; message: string; action: string }[];
  data_summary: { entries_count: number; accounts_count: number; invoices_count: number; expenses_count: number; bank_transactions_count: number };
}

// ---------------------------------------------------------------------------
// Legal VAT rates per country
// ---------------------------------------------------------------------------

const LEGAL_VAT_RATES: Record<string, number[]> = {
  FR: [0, 2.1, 5.5, 10, 20],
  BE: [0, 6, 12, 21],
  OHADA: [0, 5, 10, 15, 18, 19.25, 20],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function gradeFromScore(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function computeScore(checks: CheckResult[]): number {
  const weights: Record<string, number> = { error: 10, warning: 5, info: 2 };
  let totalWeight = 0;
  let failedWeight = 0;
  for (const c of checks) {
    const w = weights[c.severity] ?? 5;
    totalWeight += w;
    if (c.status === 'fail') failedWeight += w;
    else if (c.status === 'warning') failedWeight += w * 0.5;
  }
  if (totalWeight === 0) return 100;
  return round2(((totalWeight - failedWeight) / totalWeight) * 100);
}

function computeCategoryScore(checks: CheckResult[]): number {
  return computeScore(checks);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const userId = user.id;

    // ── Parse input ──────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const periodStart = body.period_start || `${now.getFullYear()}-01-01`;
    const periodEnd = body.period_end || now.toISOString().split('T')[0];
    const requestedCategories: string[] | undefined = body.categories;
    let country: string = (body.country || '').toUpperCase();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Auto-detect country from user_accounting_settings ────
    if (!country) {
      const { data: settings } = await supabase
        .from('user_accounting_settings')
        .select('country')
        .eq('user_id', userId)
        .single();
      country = (settings?.country || 'FR').toUpperCase();
    }

    // ── Fetch data in parallel ───────────────────────────────
    const [entriesRes, accountsRes, invoicesRes, expensesRes, bankTxRes] = await Promise.all([
      supabase
        .from('accounting_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd)
        .order('transaction_date', { ascending: true }),
      supabase
        .from('accounting_chart_of_accounts')
        .select('*')
        .eq('user_id', userId),
      supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .gte('date', periodStart)
        .lte('date', periodEnd),
      supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .gte('date', periodStart)
        .lte('date', periodEnd),
      supabase
        .from('bank_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', periodStart)
        .lte('date', periodEnd),
    ]);

    const entries = entriesRes.data ?? [];
    const accounts = accountsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const expenses = expensesRes.data ?? [];
    const bankTx = bankTxRes.data ?? [];

    // Build lookup maps
    const accountCodeSet = new Set(accounts.map((a: any) => a.account_code));
    const accountCategoryMap: Record<string, string> = {};
    for (const a of accounts) {
      accountCategoryMap[a.account_code] = a.account_category || 'other';
    }

    // ── Determine which categories to run ────────────────────
    const allCategoryKeys = ['balance', 'fiscal', 'anomalies'];
    const categoriesToRun = requestedCategories && requestedCategories.length > 0
      ? allCategoryKeys.filter(k => requestedCategories.includes(k))
      : allCategoryKeys;

    // ====================================================================
    // CHECK IMPLEMENTATIONS
    // ====================================================================

    // ---------- CATEGORY: balance ----------

    function checkBalanceDebitCredit(): CheckResult {
      const totalDebit = entries.reduce((s: number, e: any) => s + num(e.debit), 0);
      const totalCredit = entries.reduce((s: number, e: any) => s + num(e.credit), 0);
      const diff = round2(Math.abs(totalDebit - totalCredit));
      const pass = diff < 0.01;
      return {
        id: 'balance_debit_credit',
        name: 'Equilibre Debit/Credit',
        status: pass ? 'pass' : 'fail',
        severity: 'error',
        details: pass
          ? `Total debits (${round2(totalDebit)}) = Total credits (${round2(totalCredit)})`
          : `Ecart de ${diff} entre debits (${round2(totalDebit)}) et credits (${round2(totalCredit)})`,
        recommendation: pass ? null : 'Verifier les ecritures desequilibrees et corriger les montants.',
      };
    }

    function checkBalanceSheetEquilibrium(): CheckResult {
      // Compute balance per account_category using the chart
      const categoryBalances: Record<string, number> = { asset: 0, liability: 0, equity: 0 };
      for (const e of entries) {
        const code = e.account_code || '';
        let cat = accountCategoryMap[code];
        if (!cat) {
          // Fallback from account code prefix
          if (code.startsWith('2') || code.startsWith('3') || code.startsWith('5')) cat = 'asset';
          else if (code.startsWith('1')) cat = 'equity';
          else if (code.startsWith('4')) cat = 'liability';
          else continue; // revenue/expense not in balance sheet
        }
        if (cat === 'revenue' || cat === 'expense') continue;
        const balance = num(e.debit) - num(e.credit);
        categoryBalances[cat] = (categoryBalances[cat] || 0) + balance;
      }
      const assets = round2(categoryBalances.asset || 0);
      const liabilitiesPlusEquity = round2(Math.abs(categoryBalances.liability || 0) + Math.abs(categoryBalances.equity || 0));
      const diff = round2(Math.abs(assets - liabilitiesPlusEquity));
      const pass = diff < 0.01;
      return {
        id: 'balance_sheet_equilibrium',
        name: 'Equilibre du Bilan',
        status: pass ? 'pass' : 'fail',
        severity: 'error',
        details: pass
          ? `Actif (${assets}) = Passif + Capitaux (${liabilitiesPlusEquity})`
          : `Ecart de ${diff}: Actif=${assets}, Passif+Capitaux=${liabilitiesPlusEquity}`,
        recommendation: pass ? null : 'Verifier la classification des comptes (actif/passif/capitaux) dans le plan comptable.',
      };
    }

    function checkChartCoherence(): CheckResult {
      const orphanEntries: any[] = [];
      for (const e of entries) {
        if (!accountCodeSet.has(e.account_code)) {
          orphanEntries.push({ id: e.id, account_code: e.account_code, date: e.transaction_date });
        }
      }
      const pass = orphanEntries.length === 0;
      return {
        id: 'chart_coherence',
        name: 'Coherence Plan Comptable',
        status: pass ? 'pass' : 'fail',
        severity: 'error',
        details: pass
          ? 'Toutes les ecritures referencent un compte existant.'
          : `${orphanEntries.length} ecriture(s) referencent un compte absent du plan comptable.`,
        recommendation: pass ? null : 'Ajouter les comptes manquants au plan comptable ou corriger les codes dans les ecritures.',
        items: pass ? undefined : orphanEntries.slice(0, 10),
      };
    }

    function checkEntrySequence(): CheckResult {
      if (entries.length < 2) {
        return {
          id: 'entry_sequence',
          name: 'Sequence des Ecritures',
          status: 'pass',
          severity: 'warning',
          details: 'Pas assez d\'ecritures pour verifier la sequence.',
          recommendation: null,
        };
      }
      // Sort by id or entry_number and look for gaps
      const sorted = [...entries].sort((a: any, b: any) => {
        const aNum = a.entry_number ?? a.id;
        const bNum = b.entry_number ?? b.id;
        return String(aNum).localeCompare(String(bNum));
      });
      // Check for numeric entry_number gaps
      const numericEntries = sorted.filter((e: any) => typeof e.entry_number === 'number' || (e.entry_number && !isNaN(Number(e.entry_number))));
      const gaps: any[] = [];
      if (numericEntries.length >= 2) {
        for (let i = 1; i < numericEntries.length; i++) {
          const prev = Number(numericEntries[i - 1].entry_number);
          const curr = Number(numericEntries[i].entry_number);
          if (curr - prev > 1) {
            gaps.push({ after: prev, before: curr, missing: curr - prev - 1 });
          }
        }
      }
      const pass = gaps.length === 0;
      return {
        id: 'entry_sequence',
        name: 'Sequence des Ecritures',
        status: pass ? 'pass' : 'warning',
        severity: 'warning',
        details: pass
          ? 'Numerotation des ecritures continue, sans rupture.'
          : `${gaps.length} rupture(s) de sequence detectee(s).`,
        recommendation: pass ? null : 'Verifier s\'il manque des ecritures dans la numerotation. Des ecritures supprimees peuvent indiquer une irregularite.',
        items: pass ? undefined : gaps.slice(0, 10),
      };
    }

    function checkZeroEntries(): CheckResult {
      const zeroes = entries.filter((e: any) => num(e.debit) === 0 && num(e.credit) === 0);
      const pass = zeroes.length === 0;
      return {
        id: 'zero_entries',
        name: 'Ecritures a Zero',
        status: pass ? 'pass' : 'warning',
        severity: 'warning',
        details: pass
          ? 'Aucune ecriture avec debit et credit a zero.'
          : `${zeroes.length} ecriture(s) ont debit=0 et credit=0.`,
        recommendation: pass ? null : 'Supprimer ou corriger les ecritures vides qui n\'apportent aucune information comptable.',
        items: pass ? undefined : zeroes.slice(0, 10).map((e: any) => ({ id: e.id, account_code: e.account_code, date: e.transaction_date })),
      };
    }

    function checkSuspenseAccounts(): CheckResult {
      // Accounts starting with '47' (comptes d'attente / transitoires)
      const suspenseBalances: Record<string, number> = {};
      for (const e of entries) {
        const code = e.account_code || '';
        if (code.startsWith('47')) {
          suspenseBalances[code] = (suspenseBalances[code] || 0) + num(e.debit) - num(e.credit);
        }
      }
      const nonZero = Object.entries(suspenseBalances)
        .filter(([_, bal]) => Math.abs(bal) > 0.01)
        .map(([code, bal]) => ({ account_code: code, balance: round2(bal) }));
      const pass = nonZero.length === 0;
      return {
        id: 'suspense_accounts',
        name: 'Comptes d\'Attente (47x)',
        status: pass ? 'pass' : 'warning',
        severity: 'warning',
        details: pass
          ? 'Aucun solde non nul sur les comptes d\'attente.'
          : `${nonZero.length} compte(s) d'attente avec solde non nul.`,
        recommendation: pass ? null : 'Solder les comptes d\'attente (47x) en reclassant les montants vers les comptes definitifs.',
        items: pass ? undefined : nonZero.slice(0, 10),
      };
    }

    function checkDateCoherence(): CheckResult {
      const outOfRange = entries.filter((e: any) => {
        const d = e.transaction_date;
        return d && (d < periodStart || d > periodEnd);
      });
      const pass = outOfRange.length === 0;
      return {
        id: 'date_coherence',
        name: 'Coherence des Dates',
        status: pass ? 'pass' : 'fail',
        severity: 'error',
        details: pass
          ? `Toutes les ecritures sont dans la periode ${periodStart} - ${periodEnd}.`
          : `${outOfRange.length} ecriture(s) hors de la periode.`,
        recommendation: pass ? null : 'Deplacer les ecritures hors periode vers l\'exercice correct ou ajuster la periode d\'audit.',
        items: pass ? undefined : outOfRange.slice(0, 10).map((e: any) => ({ id: e.id, date: e.transaction_date, account_code: e.account_code })),
      };
    }

    // ---------- CATEGORY: fiscal ----------

    function checkVatRatesValid(): CheckResult {
      const legalRates = LEGAL_VAT_RATES[country] || LEGAL_VAT_RATES['FR'];
      const invalidInvoices: any[] = [];
      for (const inv of invoices) {
        const rate = num(inv.tax_rate);
        if (rate !== 0 && !legalRates.includes(rate)) {
          invalidInvoices.push({
            id: inv.id,
            invoice_number: inv.invoice_number,
            tax_rate: rate,
            legal_rates: legalRates,
          });
        }
      }
      const pass = invalidInvoices.length === 0;
      return {
        id: 'vat_rates_valid',
        name: 'Taux de TVA Legaux',
        status: pass ? 'pass' : 'fail',
        severity: 'error',
        details: pass
          ? `Tous les taux de TVA correspondent aux taux legaux (${country}: ${legalRates.join(', ')}%).`
          : `${invalidInvoices.length} facture(s) avec un taux de TVA non conforme.`,
        recommendation: pass ? null : `Corriger les taux de TVA pour correspondre aux taux legaux ${country}: ${legalRates.join(', ')}%.`,
        items: pass ? undefined : invalidInvoices.slice(0, 10),
      };
    }

    function checkVatDeclaration(): CheckResult {
      // TVA collectee (output): sum of (total_ttc - total_ht) on invoices
      const outputVat = invoices.reduce((s: number, inv: any) => s + (num(inv.total_ttc) - num(inv.total_ht)), 0);
      // TVA deductible (input): sum of vat_amount on expenses (if available), else estimate
      const inputVat = expenses.reduce((s: number, exp: any) => {
        if (exp.vat_amount !== undefined && exp.vat_amount !== null) return s + num(exp.vat_amount);
        // Fallback: estimate from tax_rate if present
        if (exp.tax_rate) {
          const rate = num(exp.tax_rate);
          return s + (num(exp.amount) * rate / (100 + rate));
        }
        return s;
      }, 0);
      const vatPayable = round2(outputVat - inputVat);
      return {
        id: 'vat_declaration',
        name: 'Declaration TVA',
        status: 'pass',
        severity: 'warning',
        details: `TVA collectee: ${round2(outputVat)}, TVA deductible: ${round2(inputVat)}, TVA nette a payer: ${vatPayable}.`,
        recommendation: vatPayable < 0 ? 'Credit de TVA detecte. Verifier l\'eligibilite au remboursement.' : null,
      };
    }

    function checkFecConformity(): CheckResult {
      // Required fields for FEC: account_code, account_name, transaction_date, description
      const nonConformEntries: any[] = [];
      for (const e of entries) {
        const missing: string[] = [];
        if (!e.account_code) missing.push('account_code');
        if (!e.account_name) missing.push('account_name');
        if (!e.transaction_date) missing.push('transaction_date');
        if (!e.description) missing.push('description');
        if (missing.length > 0) {
          nonConformEntries.push({ id: e.id, account_code: e.account_code, missing_fields: missing });
        }
      }
      const pass = nonConformEntries.length === 0;
      return {
        id: 'fec_conformity',
        name: 'Conformite FEC',
        status: pass ? 'pass' : 'fail',
        severity: 'error',
        details: pass
          ? 'Toutes les ecritures ont les champs obligatoires FEC remplis.'
          : `${nonConformEntries.length} ecriture(s) avec des champs FEC manquants.`,
        recommendation: pass ? null : 'Completer les champs obligatoires (code compte, libelle compte, date, description) pour la conformite FEC.',
        items: pass ? undefined : nonConformEntries.slice(0, 10),
      };
    }

    function checkVatReconciliation(): CheckResult {
      // Compare invoice VAT vs VAT recorded in 445x accounts
      const invoiceVat = invoices.reduce((s: number, inv: any) => s + (num(inv.total_ttc) - num(inv.total_ht)), 0);
      // Sum credits on 445x accounts (TVA collectee accounts)
      let accountVat = 0;
      for (const e of entries) {
        const code = e.account_code || '';
        if (code.startsWith('445')) {
          accountVat += num(e.credit) - num(e.debit);
        }
      }
      const diff = round2(Math.abs(invoiceVat - accountVat));
      const pass = diff < 0.01;
      const isWarning = diff >= 0.01;
      return {
        id: 'vat_reconciliation',
        name: 'Rapprochement TVA',
        status: pass ? 'pass' : 'warning',
        severity: 'warning',
        details: pass
          ? `TVA factures (${round2(invoiceVat)}) correspond aux comptes 445x (${round2(accountVat)}).`
          : `Ecart de ${diff} entre TVA factures (${round2(invoiceVat)}) et comptes 445x (${round2(accountVat)}).`,
        recommendation: isWarning ? 'Rapprocher la TVA des factures avec les ecritures comptables 445x. L\'ecart peut indiquer des factures non journalisees.' : null,
      };
    }

    function checkInvoicesWithoutVat(): CheckResult {
      // Invoices > 150 EUR where total_ttc == total_ht (no VAT applied)
      const suspicious = invoices.filter((inv: any) => {
        const ttc = num(inv.total_ttc);
        const ht = num(inv.total_ht);
        return ttc > 150 && Math.abs(ttc - ht) < 0.01;
      });
      const pass = suspicious.length === 0;
      return {
        id: 'invoices_without_vat',
        name: 'Factures sans TVA',
        status: pass ? 'pass' : 'warning',
        severity: 'warning',
        details: pass
          ? 'Aucune facture > 150 EUR sans TVA.'
          : `${suspicious.length} facture(s) > 150 EUR sans TVA appliquee.`,
        recommendation: pass ? null : 'Verifier si l\'exoneration de TVA est justifiee (export, autoliquidation, franchise). Ajouter la mention legale correspondante.',
        items: pass ? undefined : suspicious.slice(0, 10).map((inv: any) => ({ id: inv.id, invoice_number: inv.invoice_number, total_ttc: inv.total_ttc, total_ht: inv.total_ht })),
      };
    }

    // ---------- CATEGORY: anomalies ----------

    function checkDuplicates(): CheckResult {
      const seen = new Map<string, any[]>();
      for (const e of entries) {
        const key = `${e.account_code}|${e.transaction_date}|${num(e.debit)}|${num(e.credit)}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(e);
      }
      const duplicates: any[] = [];
      for (const [key, group] of seen) {
        if (group.length > 1) {
          duplicates.push({ key, count: group.length, ids: group.slice(0, 5).map((e: any) => e.id) });
        }
      }
      const pass = duplicates.length === 0;
      return {
        id: 'duplicates',
        name: 'Doublons',
        status: pass ? 'pass' : 'warning',
        severity: 'warning',
        details: pass
          ? 'Aucun doublon detecte.'
          : `${duplicates.length} groupe(s) d'ecritures potentiellement en doublon.`,
        recommendation: pass ? null : 'Examiner les ecritures identiques (meme compte, date, montant). Supprimer les doublons averes.',
        items: pass ? undefined : duplicates.slice(0, 10),
      };
    }

    function checkAbnormalAmounts(): CheckResult {
      // Group entries by account_code, compute mean + stddev, flag > 3 sigma
      const byAccount: Record<string, number[]> = {};
      for (const e of entries) {
        const code = e.account_code || '';
        if (!byAccount[code]) byAccount[code] = [];
        const amount = Math.max(num(e.debit), num(e.credit));
        if (amount > 0) byAccount[code].push(amount);
      }
      const anomalies: any[] = [];
      for (const [code, amounts] of Object.entries(byAccount)) {
        if (amounts.length < 5) continue;
        const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
        const stddev = Math.sqrt(variance);
        if (stddev < 0.01) continue;
        const threshold = mean + 3 * stddev;
        for (const e of entries) {
          if (e.account_code !== code) continue;
          const amount = Math.max(num(e.debit), num(e.credit));
          if (amount > threshold) {
            anomalies.push({
              id: e.id,
              account_code: code,
              amount: round2(amount),
              mean: round2(mean),
              stddev: round2(stddev),
              threshold: round2(threshold),
            });
          }
        }
      }
      const pass = anomalies.length === 0;
      return {
        id: 'abnormal_amounts',
        name: 'Montants Anormaux',
        status: pass ? 'pass' : 'warning',
        severity: 'warning',
        details: pass
          ? 'Aucun montant anormalement eleve detecte.'
          : `${anomalies.length} ecriture(s) avec un montant > 3 ecarts-types de la moyenne du compte.`,
        recommendation: pass ? null : 'Verifier les ecritures avec des montants statistiquement anormaux. Elles peuvent indiquer une erreur de saisie.',
        items: pass ? undefined : anomalies.slice(0, 10),
      };
    }

    function checkRoundAmounts(): CheckResult {
      // Entries >= 1000 where amount % 1000 == 0
      const largeEntries = entries.filter((e: any) => {
        const amount = Math.max(num(e.debit), num(e.credit));
        return amount >= 1000;
      });
      const roundEntries = largeEntries.filter((e: any) => {
        const amount = Math.max(num(e.debit), num(e.credit));
        return amount % 1000 === 0;
      });
      const ratio = largeEntries.length > 0 ? roundEntries.length / largeEntries.length : 0;
      const suspicious = ratio > 0.15;
      return {
        id: 'round_amounts',
        name: 'Montants Ronds',
        status: suspicious ? 'warning' : 'pass',
        severity: 'info',
        details: `${roundEntries.length}/${largeEntries.length} ecritures >= 1000 sont des montants ronds (${round2(ratio * 100)}%).`,
        recommendation: suspicious ? 'Un taux eleve de montants ronds (> 15%) peut indiquer des estimations plutot que des montants reels. Verifier les justificatifs.' : null,
        items: suspicious ? roundEntries.slice(0, 10).map((e: any) => ({ id: e.id, account_code: e.account_code, amount: Math.max(num(e.debit), num(e.credit)) })) : undefined,
      };
    }

    function checkRarelyUsedAccounts(): CheckResult {
      const countByAccount: Record<string, number> = {};
      for (const e of entries) {
        const code = e.account_code || '';
        countByAccount[code] = (countByAccount[code] || 0) + 1;
      }
      const rareAccounts = Object.entries(countByAccount)
        .filter(([_, count]) => count === 1)
        .map(([code]) => ({ account_code: code }));
      const pass = rareAccounts.length === 0;
      return {
        id: 'rarely_used_accounts',
        name: 'Comptes Rarement Utilises',
        status: pass ? 'pass' : 'warning',
        severity: 'info',
        details: pass
          ? 'Tous les comptes sont utilises plus d\'une fois.'
          : `${rareAccounts.length} compte(s) utilise(s) une seule fois sur la periode.`,
        recommendation: pass ? null : 'Verifier que les comptes a usage unique ne sont pas des erreurs de saisie de code comptable.',
        items: pass ? undefined : rareAccounts.slice(0, 10),
      };
    }

    function checkBankReconciliation(): CheckResult {
      // Bank transactions where invoice_id is null and reconciliation_status is not 'ignored'
      const unreconciled = bankTx.filter((tx: any) =>
        tx.invoice_id === null && tx.reconciliation_status !== 'ignored',
      );
      const total = bankTx.length;
      const ratio = total > 0 ? unreconciled.length / total : 0;
      const suspicious = ratio > 0.10;
      return {
        id: 'bank_reconciliation',
        name: 'Rapprochement Bancaire',
        status: suspicious ? 'warning' : 'pass',
        severity: 'warning',
        details: total === 0
          ? 'Aucune transaction bancaire sur la periode.'
          : `${unreconciled.length}/${total} transactions non rapprochees (${round2(ratio * 100)}%).`,
        recommendation: suspicious ? 'Plus de 10% des transactions bancaires ne sont pas rapprochees. Effectuer un rapprochement bancaire complet.' : null,
        items: suspicious ? unreconciled.slice(0, 10).map((tx: any) => ({ id: tx.id, date: tx.date, amount: tx.amount, description: tx.description })) : undefined,
      };
    }

    // ====================================================================
    // Run checks per category
    // ====================================================================

    const categoryConfigs: Record<string, { label: string; checks: (() => CheckResult)[] }> = {
      balance: {
        label: 'Equilibre & Coherence',
        checks: [
          checkBalanceDebitCredit,
          checkBalanceSheetEquilibrium,
          checkChartCoherence,
          checkEntrySequence,
          checkZeroEntries,
          checkSuspenseAccounts,
          checkDateCoherence,
        ],
      },
      fiscal: {
        label: 'Conformite Fiscale',
        checks: [
          checkVatRatesValid,
          checkVatDeclaration,
          checkFecConformity,
          checkVatReconciliation,
          checkInvoicesWithoutVat,
        ],
      },
      anomalies: {
        label: 'Detection d\'Anomalies',
        checks: [
          checkDuplicates,
          checkAbnormalAmounts,
          checkRoundAmounts,
          checkRarelyUsedAccounts,
          checkBankReconciliation,
        ],
      },
    };

    const allChecks: CheckResult[] = [];
    const categories: Record<string, CategoryResult> = {};

    for (const catKey of categoriesToRun) {
      const config = categoryConfigs[catKey];
      if (!config) continue;
      const checkResults = config.checks.map(fn => fn());
      allChecks.push(...checkResults);
      categories[catKey] = {
        score: computeCategoryScore(checkResults),
        label: config.label,
        checks: checkResults,
      };
    }

    // ====================================================================
    // Scoring & grading
    // ====================================================================

    const overallScore = computeScore(allChecks);
    const grade = gradeFromScore(overallScore);

    const passed = allChecks.filter(c => c.status === 'pass').length;
    const warnings = allChecks.filter(c => c.status === 'warning').length;
    const errors = allChecks.filter(c => c.status === 'fail').length;

    // ====================================================================
    // Recommendations
    // ====================================================================

    const recommendations: AuditOutput['recommendations'] = [];
    for (const catKey of categoriesToRun) {
      const catChecks = categories[catKey]?.checks ?? [];
      for (const c of catChecks) {
        if (c.status !== 'pass' && c.recommendation) {
          const priority = c.severity === 'error' ? 'high' : c.severity === 'warning' ? 'medium' : 'low';
          recommendations.push({
            priority,
            category: catKey,
            check_id: c.id,
            message: c.details,
            action: c.recommendation,
          });
        }
      }
    }
    // Sort: high first, then medium, then low
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

    // ====================================================================
    // Build output
    // ====================================================================

    const output: AuditOutput = {
      score: overallScore,
      grade,
      period: { start: periodStart, end: periodEnd },
      country,
      generated_at: new Date().toISOString(),
      summary: {
        total_checks: allChecks.length,
        passed,
        warnings,
        errors,
      },
      categories,
      recommendations,
      data_summary: {
        entries_count: entries.length,
        accounts_count: accounts.length,
        invoices_count: invoices.length,
        expenses_count: expenses.length,
        bank_transactions_count: bankTx.length,
      },
    };

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
