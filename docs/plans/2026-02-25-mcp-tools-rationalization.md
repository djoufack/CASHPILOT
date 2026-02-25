# MCP Tools Rationalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce CashPilot MCP server from 454 tools to ~154 by whitelisting 20 CRUD tables and adding 15 new hand-written tools for bank reconciliation, reporting, and documents.

**Architecture:** Modify the CRUD generator script (`generate-crud.ts`) to accept a whitelist of table names, regenerate `generated_crud.ts` with only ~20 tables (~100 tools). Create 3 new tool files: `bank-reconciliation.ts` (7 tools), `reporting.ts` (3 tools), `documents.ts` (5 tools). Register them in `server.ts`.

**Tech Stack:** TypeScript, MCP SDK (`@modelcontextprotocol/sdk`), Zod, Supabase JS client

---

## Task 1: Add whitelist to CRUD generator

**Files:**
- Modify: `mcp-server/scripts/generate-crud.ts:23`

**Step 1: Add the whitelist array after `excludedTables`**

Replace line 23:

```typescript
const excludedTables = ['audit_log', 'profiles', 'user_roles', 'role_permissions', 'schema_migrations'];
```

With:

```typescript
const excludedTables = ['audit_log', 'profiles', 'user_roles', 'role_permissions', 'schema_migrations'];

// Whitelist: only these tables get CRUD tools generated.
// All other tables are ignored. Hand-written tools cover the rest.
const whitelistedTables = [
  'invoice_items',
  'invoice_settings',
  'expenses',
  'quotes',
  'credit_notes',
  'recurring_invoices',
  'payment_terms',
  'payment_reminder_rules',
  'suppliers',
  'services',
  'service_categories',
  'company',
  'accounting_tax_rates',
  'bank_connections',
  'bank_transactions',
  'bank_statements',
  'bank_statement_lines',
  'bank_reconciliation_sessions',
  'payables',
  'receivables',
];
```

**Step 2: Add whitelist filter in the generation loop**

In the `fetchSchema()` function, right after line 48 (`if (definition.type !== 'object' || !definition.properties) continue;`), add:

```typescript
        if (!whitelistedTables.includes(tableName)) continue;
```

**Step 3: Verify the change compiles**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && npx tsx scripts/generate-crud.ts`
Expected: `Successfully generated .../generated_crud.ts` — the new file should be much smaller.

**Step 4: Verify tool count in generated file**

Run: `grep -c "server.tool(" /c/Github-Desktop/CASHPILOT/mcp-server/src/tools/generated_crud.ts`
Expected: approximately 100 (20 tables x 5 operations)

**Step 5: Commit**

```bash
git add mcp-server/scripts/generate-crud.ts mcp-server/src/tools/generated_crud.ts
git commit -m "feat(mcp): whitelist 20 CRUD tables, reduce from 415 to ~100 generated tools"
```

---

## Task 2: Create bank reconciliation tools

**Files:**
- Create: `mcp-server/src/tools/bank-reconciliation.ts`

**Step 1: Create the file with all 7 tools**

Create `mcp-server/src/tools/bank-reconciliation.ts` with the following content:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';

export function registerBankReconciliationTools(server: McpServer) {

  // ── 1. auto_reconcile ─────────────────────────────────────
  server.tool(
    'auto_reconcile',
    'Run intelligent auto-matching of bank transactions against invoices. Scores by amount (50pts), reference (30pts), client name (20pts). Returns matched pairs with confidence scores.',
    {
      threshold: z.number().optional().describe('Minimum confidence score 0-1 to auto-match (default 0.7)'),
      limit: z.number().optional().describe('Max transactions to process (default 100)')
    },
    async ({ threshold, limit }) => {
      const minConfidence = threshold ?? 0.7;
      const maxTx = limit ?? 100;
      const userId = getUserId();

      // Fetch unreconciled bank transactions (incoming only)
      const { data: transactions, error: txErr } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('user_id', userId)
        .is('invoice_id', null)
        .gt('amount', 0)
        .order('date', { ascending: false })
        .limit(maxTx);

      if (txErr) return { content: [{ type: 'text' as const, text: `Error fetching transactions: ${txErr.message}` }] };

      // Fetch unpaid invoices with client names
      const { data: invoices, error: invErr } = await supabase
        .from('invoices')
        .select('*, client:clients(company_name, contact_name)')
        .eq('user_id', userId)
        .in('status', ['sent', 'overdue']);

      if (invErr) return { content: [{ type: 'text' as const, text: `Error fetching invoices: ${invErr.message}` }] };

      if (!transactions?.length || !invoices?.length) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ matched: 0, message: 'No unreconciled transactions or unpaid invoices found.' }) }] };
      }

      const matched: Array<{ transaction_id: string; invoice_id: string; invoice_number: string; amount: number; confidence: number }> = [];
      const usedInvoices = new Set<string>();

      for (const tx of transactions) {
        let bestMatch: typeof invoices[0] | null = null;
        let bestScore = 0;

        for (const inv of invoices) {
          if (usedInvoices.has(inv.id)) continue;

          let score = 0;

          // Amount match (50 pts)
          const amountDiff = Math.abs(tx.amount - (parseFloat(inv.total_ttc) || 0));
          const amountRatio = amountDiff / Math.max(tx.amount, parseFloat(inv.total_ttc) || 1, 1);
          if (amountRatio === 0) score += 50;
          else if (amountRatio < 0.01) score += 40;
          else if (amountRatio < 0.05) score += 20;

          // Reference match (30 pts)
          const ref = (tx.reference || tx.remittance_info || tx.description || '').toLowerCase();
          const invNum = (inv.invoice_number || '').toLowerCase();
          if (invNum && ref.includes(invNum)) score += 30;

          // Client name match (20 pts)
          const clientName = (inv.client?.company_name || inv.client?.contact_name || '').toLowerCase();
          if (clientName.length >= 3 && ref.includes(clientName)) score += 20;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = inv;
          }
        }

        const confidence = bestScore / 100;
        if (bestMatch && confidence >= minConfidence) {
          await supabase.from('bank_transactions').update({
            invoice_id: bestMatch.id,
            reconciliation_status: 'matched',
            match_confidence: confidence,
            matched_at: new Date().toISOString()
          }).eq('id', tx.id);

          await supabase.from('invoices').update({
            status: 'paid',
            payment_status: 'paid'
          }).eq('id', bestMatch.id);

          usedInvoices.add(bestMatch.id);
          matched.push({
            transaction_id: tx.id,
            invoice_id: bestMatch.id,
            invoice_number: bestMatch.invoice_number,
            amount: tx.amount,
            confidence
          });
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          matched: matched.length,
          unmatched: transactions.length - matched.length,
          total_processed: transactions.length,
          details: matched
        }, null, 2) }]
      };
    }
  );

  // ── 2. match_bank_line ────────────────────────────────────
  server.tool(
    'match_bank_line',
    'Manually match a bank statement line to a source document (invoice, expense, or supplier invoice)',
    {
      line_id: z.string().describe('Bank statement line UUID'),
      source_type: z.enum(['invoice', 'expense', 'supplier_invoice']).describe('Type of source document'),
      source_id: z.string().describe('UUID of the source document')
    },
    async ({ line_id, source_type, source_id }) => {
      const userId = getUserId();

      const { data, error } = await supabase
        .from('bank_statement_lines')
        .update({
          reconciliation_status: 'matched',
          matched_source_type: source_type,
          matched_source_id: source_id,
          matched_at: new Date().toISOString(),
          matched_by: 'manual',
          match_confidence: 1.0
        })
        .eq('id', line_id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `Line matched successfully.\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ── 3. unmatch_bank_line ──────────────────────────────────
  server.tool(
    'unmatch_bank_line',
    'Undo a bank statement line reconciliation match',
    {
      line_id: z.string().describe('Bank statement line UUID to unmatch')
    },
    async ({ line_id }) => {
      const userId = getUserId();

      const { data, error } = await supabase
        .from('bank_statement_lines')
        .update({
          reconciliation_status: 'unmatched',
          matched_source_type: null,
          matched_source_id: null,
          matched_at: null,
          matched_by: null,
          match_confidence: null
        })
        .eq('id', line_id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `Line unmatched successfully.\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ── 4. ignore_bank_lines ──────────────────────────────────
  server.tool(
    'ignore_bank_lines',
    'Mark bank statement lines as ignored (bank fees, internal transfers, etc.)',
    {
      line_ids: z.array(z.string()).describe('Array of bank statement line UUIDs to ignore')
    },
    async ({ line_ids }) => {
      const userId = getUserId();

      const { error } = await supabase
        .from('bank_statement_lines')
        .update({
          reconciliation_status: 'ignored',
          matched_source_type: null,
          matched_source_id: null,
          matched_at: null,
          match_confidence: null
        })
        .eq('user_id', userId)
        .in('id', line_ids);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `${line_ids.length} line(s) marked as ignored.` }] };
    }
  );

  // ── 5. get_reconciliation_summary ─────────────────────────
  server.tool(
    'get_reconciliation_summary',
    'Get reconciliation statistics for a bank statement: matched/unmatched lines, amounts, difference',
    {
      statement_id: z.string().describe('Bank statement UUID')
    },
    async ({ statement_id }) => {
      const userId = getUserId();

      const { data: lines, error } = await supabase
        .from('bank_statement_lines')
        .select('amount, reconciliation_status')
        .eq('statement_id', statement_id)
        .eq('user_id', userId);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      if (!lines?.length) return { content: [{ type: 'text' as const, text: 'No lines found for this statement.' }] };

      const matched = lines.filter(l => l.reconciliation_status === 'matched');
      const unmatched = lines.filter(l => l.reconciliation_status === 'unmatched');
      const ignored = lines.filter(l => l.reconciliation_status === 'ignored');

      const sum = (arr: typeof lines) => Math.round(arr.reduce((s, l) => s + (parseFloat(String(l.amount)) || 0), 0) * 100) / 100;

      const summary = {
        total_lines: lines.length,
        matched_lines: matched.length,
        unmatched_lines: unmatched.length,
        ignored_lines: ignored.length,
        match_rate: Math.round((matched.length / lines.length) * 1000) / 10,
        total_credits: sum(lines.filter(l => (parseFloat(String(l.amount)) || 0) > 0)),
        total_debits: sum(lines.filter(l => (parseFloat(String(l.amount)) || 0) < 0)),
        matched_amount: sum(matched),
        unmatched_amount: sum(unmatched),
        ignored_amount: sum(ignored)
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );

  // ── 6. search_match_candidates ────────────────────────────
  server.tool(
    'search_match_candidates',
    'Find matching candidates for a bank statement line. Returns invoices, expenses, and supplier invoices ranked by match score.',
    {
      line_id: z.string().describe('Bank statement line UUID'),
      max_results: z.number().optional().describe('Max candidates to return (default 10)')
    },
    async ({ line_id, max_results }) => {
      const userId = getUserId();
      const maxRes = max_results ?? 10;

      // Fetch the bank line
      const { data: bankLine, error: lineErr } = await supabase
        .from('bank_statement_lines')
        .select('*')
        .eq('id', line_id)
        .eq('user_id', userId)
        .single();

      if (lineErr || !bankLine) return { content: [{ type: 'text' as const, text: `Error: ${lineErr?.message || 'Line not found'}` }] };

      const bankAmount = parseFloat(String(bankLine.amount)) || 0;
      const bankDesc = (bankLine.description || bankLine.reference || '').toLowerCase();
      const isIncoming = bankAmount > 0;

      type Candidate = { source_type: string; source_id: string; description: string; amount: number; date: string; score: number };
      const candidates: Candidate[] = [];

      if (isIncoming) {
        // Match against unpaid invoices
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_ttc, date, client:clients(company_name)')
          .eq('user_id', userId)
          .in('status', ['sent', 'overdue']);

        for (const inv of invoices ?? []) {
          let score = 0;
          const invAmount = parseFloat(inv.total_ttc) || 0;
          const diff = Math.abs(bankAmount - invAmount);
          const ratio = diff / Math.max(bankAmount, invAmount, 1);
          if (ratio === 0) score += 50;
          else if (ratio < 0.01) score += 40;
          else if (ratio < 0.05) score += 20;

          const invNum = (inv.invoice_number || '').toLowerCase();
          if (invNum && bankDesc.includes(invNum)) score += 30;

          const clientName = ((inv.client as any)?.company_name || '').toLowerCase();
          if (clientName.length >= 3 && bankDesc.includes(clientName)) score += 20;

          if (score > 0) {
            candidates.push({
              source_type: 'invoice',
              source_id: inv.id,
              description: `Invoice ${inv.invoice_number} - ${(inv.client as any)?.company_name || 'N/A'}`,
              amount: invAmount,
              date: inv.date,
              score
            });
          }
        }
      } else {
        // Match against expenses
        const { data: expenses } = await supabase
          .from('expenses')
          .select('id, description, amount, expense_date, category')
          .eq('user_id', userId);

        for (const exp of expenses ?? []) {
          let score = 0;
          const expAmount = parseFloat(String(exp.amount)) || 0;
          const diff = Math.abs(Math.abs(bankAmount) - expAmount);
          const ratio = diff / Math.max(Math.abs(bankAmount), expAmount, 1);
          if (ratio === 0) score += 50;
          else if (ratio < 0.01) score += 40;
          else if (ratio < 0.05) score += 20;

          if (score > 0) {
            candidates.push({
              source_type: 'expense',
              source_id: exp.id,
              description: `Expense: ${exp.description || exp.category || 'N/A'}`,
              amount: -expAmount,
              date: exp.expense_date || '',
              score
            });
          }
        }

        // Match against supplier invoices
        const { data: supplierInvs } = await supabase
          .from('supplier_invoices')
          .select('id, invoice_number, total_amount, invoice_date, supplier:suppliers(name)')
          .eq('user_id', userId)
          .in('payment_status', ['pending', 'partial']);

        for (const si of supplierInvs ?? []) {
          let score = 0;
          const siAmount = parseFloat(si.total_amount) || 0;
          const diff = Math.abs(Math.abs(bankAmount) - siAmount);
          const ratio = diff / Math.max(Math.abs(bankAmount), siAmount, 1);
          if (ratio === 0) score += 50;
          else if (ratio < 0.01) score += 40;
          else if (ratio < 0.05) score += 20;

          const siNum = (si.invoice_number || '').toLowerCase();
          if (siNum && bankDesc.includes(siNum)) score += 30;

          if (score > 0) {
            candidates.push({
              source_type: 'supplier_invoice',
              source_id: si.id,
              description: `Supplier invoice ${si.invoice_number} - ${(si.supplier as any)?.name || 'N/A'}`,
              amount: -siAmount,
              date: si.invoice_date || '',
              score
            });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      const topCandidates = candidates.slice(0, maxRes);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          bank_line: { id: bankLine.id, amount: bankAmount, date: bankLine.transaction_date, description: bankLine.description },
          candidates: topCandidates,
          total_candidates: candidates.length
        }, null, 2) }]
      };
    }
  );

  // ── 7. import_bank_statement ──────────────────────────────
  server.tool(
    'import_bank_statement',
    'Import parsed bank statement lines into a statement. Creates the statement record and inserts all lines.',
    {
      bank_name: z.string().describe('Name of the bank'),
      account_number: z.string().optional().describe('Bank account number or IBAN'),
      statement_date: z.string().describe('Statement date (YYYY-MM-DD)'),
      opening_balance: z.number().optional().describe('Opening balance'),
      closing_balance: z.number().optional().describe('Closing balance'),
      currency: z.string().optional().describe('Currency code (default EUR)'),
      lines: z.array(z.object({
        date: z.string().describe('Transaction date YYYY-MM-DD'),
        description: z.string().describe('Transaction description'),
        amount: z.number().describe('Amount (positive=credit, negative=debit)'),
        reference: z.string().optional().describe('Transaction reference'),
        value_date: z.string().optional().describe('Value date YYYY-MM-DD'),
        balance_after: z.number().optional().describe('Balance after this transaction')
      })).describe('Array of statement lines to import')
    },
    async ({ bank_name, account_number, statement_date, opening_balance, closing_balance, currency, lines }) => {
      const userId = getUserId();

      // Create statement
      const totalCredits = lines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
      const totalDebits = lines.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0);

      const { data: statement, error: stmtErr } = await supabase
        .from('bank_statements')
        .insert([{
          user_id: userId,
          bank_name,
          account_number: account_number || null,
          statement_date,
          opening_balance: opening_balance ?? null,
          closing_balance: closing_balance ?? null,
          currency: currency || 'EUR',
          total_credits: Math.round(totalCredits * 100) / 100,
          total_debits: Math.round(Math.abs(totalDebits) * 100) / 100,
          transaction_count: lines.length,
          status: 'imported',
          line_count: lines.length
        }])
        .select()
        .single();

      if (stmtErr) return { content: [{ type: 'text' as const, text: `Error creating statement: ${stmtErr.message}` }] };

      // Insert lines
      const lineRecords = lines.map((line, i) => ({
        statement_id: statement.id,
        user_id: userId,
        line_number: i + 1,
        transaction_date: line.date,
        value_date: line.value_date || null,
        description: line.description,
        reference: line.reference || null,
        amount: line.amount,
        balance_after: line.balance_after ?? null,
        reconciliation_status: 'unmatched',
        matched_by: 'manual'
      }));

      const { error: linesErr } = await supabase
        .from('bank_statement_lines')
        .insert(lineRecords);

      if (linesErr) return { content: [{ type: 'text' as const, text: `Statement created but error inserting lines: ${linesErr.message}` }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          statement_id: statement.id,
          lines_imported: lines.length,
          total_credits: Math.round(totalCredits * 100) / 100,
          total_debits: Math.round(Math.abs(totalDebits) * 100) / 100,
          status: 'imported'
        }, null, 2) }]
      };
    }
  );
}
```

**Step 2: Verify file compiles**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add mcp-server/src/tools/bank-reconciliation.ts
git commit -m "feat(mcp): add 7 bank reconciliation hand-written tools"
```

---

## Task 3: Create reporting tools

**Files:**
- Create: `mcp-server/src/tools/reporting.ts`

**Step 1: Create the file with 3 tools**

Create `mcp-server/src/tools/reporting.ts` with:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';

export function registerReportingTools(server: McpServer) {

  // ── 1. get_profit_and_loss ────────────────────────────────
  server.tool(
    'get_profit_and_loss',
    'Generate a Profit & Loss statement (income statement) for a period. Groups revenue and expense accounts with subtotals.',
    {
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ start_date, end_date }) => {
      const userId = getUserId();

      const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select('account_code, account_name, debit, credit')
        .eq('user_id', userId)
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      // Get account categories from chart of accounts
      const { data: accounts } = await supabase
        .from('accounting_chart_of_accounts')
        .select('account_code, account_name, account_category')
        .eq('user_id', userId);

      const categoryMap: Record<string, string> = {};
      for (const acc of accounts ?? []) {
        categoryMap[acc.account_code] = acc.account_category || 'other';
      }

      // Aggregate by account
      const accountTotals: Record<string, { code: string; name: string; category: string; debit: number; credit: number }> = {};
      for (const e of entries ?? []) {
        const code = e.account_code;
        if (!accountTotals[code]) {
          accountTotals[code] = {
            code,
            name: e.account_name || '',
            category: categoryMap[code] || (code.startsWith('7') ? 'revenue' : code.startsWith('6') ? 'expense' : 'other'),
            debit: 0,
            credit: 0
          };
        }
        accountTotals[code].debit += parseFloat(e.debit || '0');
        accountTotals[code].credit += parseFloat(e.credit || '0');
      }

      const allAccounts = Object.values(accountTotals);
      const revenueAccounts = allAccounts.filter(a => a.category === 'revenue');
      const expenseAccounts = allAccounts.filter(a => a.category === 'expense');

      const totalRevenue = revenueAccounts.reduce((s, a) => s + (a.credit - a.debit), 0);
      const totalExpenses = expenseAccounts.reduce((s, a) => s + (a.debit - a.credit), 0);
      const netResult = totalRevenue - totalExpenses;

      const round = (n: number) => Math.round(n * 100) / 100;
      const formatAccounts = (accs: typeof allAccounts) =>
        accs.map(a => ({ code: a.code, name: a.name, amount: round(a.category === 'revenue' ? a.credit - a.debit : a.debit - a.credit) }))
          .sort((a, b) => a.code.localeCompare(b.code));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          period: { start: start_date, end: end_date },
          revenue: { accounts: formatAccounts(revenueAccounts), total: round(totalRevenue) },
          expenses: { accounts: formatAccounts(expenseAccounts), total: round(totalExpenses) },
          net_result: round(netResult),
          profitable: netResult > 0
        }, null, 2) }]
      };
    }
  );

  // ── 2. get_balance_sheet ──────────────────────────────────
  server.tool(
    'get_balance_sheet',
    'Generate a Balance Sheet (bilan) at a given date. Shows assets, liabilities, and equity.',
    {
      date: z.string().optional().describe('Cut-off date (YYYY-MM-DD), default today')
    },
    async ({ date }) => {
      const cutoff = date ?? new Date().toISOString().split('T')[0];
      const userId = getUserId();

      const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select('account_code, account_name, debit, credit')
        .eq('user_id', userId)
        .lte('transaction_date', cutoff);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const { data: accounts } = await supabase
        .from('accounting_chart_of_accounts')
        .select('account_code, account_name, account_category')
        .eq('user_id', userId);

      const categoryMap: Record<string, string> = {};
      for (const acc of accounts ?? []) {
        categoryMap[acc.account_code] = acc.account_category || 'other';
      }

      const accountTotals: Record<string, { code: string; name: string; category: string; balance: number }> = {};
      for (const e of entries ?? []) {
        const code = e.account_code;
        if (!accountTotals[code]) {
          accountTotals[code] = {
            code,
            name: e.account_name || '',
            category: categoryMap[code] || (code.startsWith('1') || code.startsWith('2') || code.startsWith('3') || code.startsWith('4') || code.startsWith('5') ? 'asset' : 'other'),
            balance: 0
          };
        }
        accountTotals[code].balance += parseFloat(e.debit || '0') - parseFloat(e.credit || '0');
      }

      const allAccounts = Object.values(accountTotals);
      const round = (n: number) => Math.round(n * 100) / 100;
      const format = (accs: typeof allAccounts) =>
        accs.map(a => ({ code: a.code, name: a.name, balance: round(Math.abs(a.balance)) }))
          .sort((a, b) => a.code.localeCompare(b.code));

      const assets = allAccounts.filter(a => a.category === 'asset');
      const liabilities = allAccounts.filter(a => a.category === 'liability');
      const equity = allAccounts.filter(a => a.category === 'equity');

      const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
      const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);
      const totalEquity = equity.reduce((s, a) => s + Math.abs(a.balance), 0);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          date: cutoff,
          assets: { accounts: format(assets), total: round(totalAssets) },
          liabilities: { accounts: format(liabilities), total: round(totalLiabilities) },
          equity: { accounts: format(equity), total: round(totalEquity) },
          balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
        }, null, 2) }]
      };
    }
  );

  // ── 3. get_aging_report ───────────────────────────────────
  server.tool(
    'get_aging_report',
    'Generate an aging report for receivables or payables. Shows amounts in 30/60/90/120+ day buckets.',
    {
      type: z.enum(['receivables', 'payables']).describe('Report type: receivables (client debts) or payables (supplier debts)'),
      as_of_date: z.string().optional().describe('Reference date (YYYY-MM-DD), default today')
    },
    async ({ type, as_of_date }) => {
      const asOf = as_of_date ?? new Date().toISOString().split('T')[0];
      const asOfMs = new Date(asOf).getTime();
      const userId = getUserId();

      if (type === 'receivables') {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_ttc, due_date, date, status, client:clients(company_name)')
          .eq('user_id', userId)
          .in('status', ['sent', 'overdue'])
          .in('payment_status', ['unpaid', 'partial']);

        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

        const buckets = { current: [] as any[], days_30: [] as any[], days_60: [] as any[], days_90: [] as any[], days_120_plus: [] as any[] };

        for (const inv of invoices ?? []) {
          const dueDate = inv.due_date || inv.date;
          const daysPast = Math.floor((asOfMs - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const item = {
            invoice_number: inv.invoice_number,
            client: (inv.client as any)?.company_name || 'N/A',
            amount: parseFloat(inv.total_ttc) || 0,
            due_date: dueDate,
            days_overdue: Math.max(0, daysPast)
          };

          if (daysPast <= 0) buckets.current.push(item);
          else if (daysPast <= 30) buckets.days_30.push(item);
          else if (daysPast <= 60) buckets.days_60.push(item);
          else if (daysPast <= 90) buckets.days_90.push(item);
          else buckets.days_120_plus.push(item);
        }

        const sum = (arr: any[]) => Math.round(arr.reduce((s, i) => s + i.amount, 0) * 100) / 100;

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            type: 'receivables',
            as_of: asOf,
            summary: {
              current: sum(buckets.current),
              '1_30_days': sum(buckets.days_30),
              '31_60_days': sum(buckets.days_60),
              '61_90_days': sum(buckets.days_90),
              '90_plus_days': sum(buckets.days_120_plus),
              total: sum([...buckets.current, ...buckets.days_30, ...buckets.days_60, ...buckets.days_90, ...buckets.days_120_plus])
            },
            details: buckets
          }, null, 2) }]
        };
      } else {
        // Payables
        const { data: payables, error } = await supabase
          .from('payables')
          .select('id, creditor_name, amount, amount_paid, due_date, date_borrowed, status')
          .eq('user_id', userId)
          .in('status', ['pending', 'partial', 'overdue']);

        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

        const buckets = { current: [] as any[], days_30: [] as any[], days_60: [] as any[], days_90: [] as any[], days_120_plus: [] as any[] };

        for (const p of payables ?? []) {
          const dueDate = p.due_date || p.date_borrowed;
          const daysPast = Math.floor((asOfMs - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const remaining = (parseFloat(p.amount) || 0) - (parseFloat(p.amount_paid) || 0);
          const item = {
            creditor: p.creditor_name,
            amount_due: Math.round(remaining * 100) / 100,
            due_date: dueDate,
            days_overdue: Math.max(0, daysPast)
          };

          if (daysPast <= 0) buckets.current.push(item);
          else if (daysPast <= 30) buckets.days_30.push(item);
          else if (daysPast <= 60) buckets.days_60.push(item);
          else if (daysPast <= 90) buckets.days_90.push(item);
          else buckets.days_120_plus.push(item);
        }

        const sum = (arr: any[]) => Math.round(arr.reduce((s, i) => s + i.amount_due, 0) * 100) / 100;

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            type: 'payables',
            as_of: asOf,
            summary: {
              current: sum(buckets.current),
              '1_30_days': sum(buckets.days_30),
              '31_60_days': sum(buckets.days_60),
              '61_90_days': sum(buckets.days_90),
              '90_plus_days': sum(buckets.days_120_plus),
              total: sum([...buckets.current, ...buckets.days_30, ...buckets.days_60, ...buckets.days_90, ...buckets.days_120_plus])
            },
            details: buckets
          }, null, 2) }]
        };
      }
    }
  );
}
```

**Step 2: Verify file compiles**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add mcp-server/src/tools/reporting.ts
git commit -m "feat(mcp): add 3 reporting tools (P&L, balance sheet, aging report)"
```

---

## Task 4: Create document tools

**Files:**
- Create: `mcp-server/src/tools/documents.ts`

**Step 1: Create the file with 5 tools**

Create `mcp-server/src/tools/documents.ts` with:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';

export function registerDocumentTools(server: McpServer) {

  // ── 1. create_quote ───────────────────────────────────────
  server.tool(
    'create_quote',
    'Create a new quote (devis) with line items. Auto-calculates totals and tax.',
    {
      client_id: z.string().describe('Client UUID'),
      quote_number: z.string().optional().describe('Quote number (auto-generated if omitted)'),
      valid_until: z.string().optional().describe('Validity date (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Notes or terms'),
      tax_rate: z.number().optional().describe('Tax rate in % (default 20)'),
      items: z.array(z.object({
        description: z.string().describe('Item description'),
        quantity: z.number().describe('Quantity'),
        unit_price: z.number().describe('Unit price HT')
      })).describe('Quote line items')
    },
    async ({ client_id, quote_number, valid_until, notes, tax_rate, items }) => {
      const userId = getUserId();
      const rate = tax_rate ?? 20;

      const totalHt = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const taxAmount = totalHt * (rate / 100);
      const totalTtc = totalHt + taxAmount;

      const quoteNum = quote_number || `DEV-${Date.now().toString(36).toUpperCase()}`;

      const { data: quote, error } = await supabase
        .from('quotes')
        .insert([{
          user_id: userId,
          client_id,
          quote_number: quoteNum,
          date: new Date().toISOString().split('T')[0],
          valid_until: valid_until || null,
          total_ht: Math.round(totalHt * 100) / 100,
          total_ttc: Math.round(totalTtc * 100) / 100,
          tax_rate: rate,
          tax_amount: Math.round(taxAmount * 100) / 100,
          status: 'draft',
          notes: notes || null,
          items
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `Quote created: ${quoteNum}\n${JSON.stringify(quote, null, 2)}` }] };
    }
  );

  // ── 2. convert_quote_to_invoice ───────────────────────────
  server.tool(
    'convert_quote_to_invoice',
    'Convert an accepted quote into an invoice. Copies all details and marks the quote as converted.',
    {
      quote_id: z.string().describe('Quote UUID to convert')
    },
    async ({ quote_id }) => {
      const userId = getUserId();

      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quote_id)
        .eq('user_id', userId)
        .single();

      if (qErr || !quote) return { content: [{ type: 'text' as const, text: `Error: ${qErr?.message || 'Quote not found'}` }] };

      const invoiceNumber = `FAC-${Date.now().toString(36).toUpperCase()}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert([{
          user_id: userId,
          client_id: quote.client_id,
          invoice_number: invoiceNumber,
          date: new Date().toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          total_ht: quote.total_ht,
          total_ttc: quote.total_ttc,
          tax_rate: quote.tax_rate,
          status: 'draft',
          payment_status: 'unpaid',
          notes: quote.notes,
          quote_id: quote.id
        }])
        .select()
        .single();

      if (invErr) return { content: [{ type: 'text' as const, text: `Error creating invoice: ${invErr.message}` }] };

      // Mark quote as converted
      await supabase
        .from('quotes')
        .update({ status: 'converted', converted_invoice_id: invoice.id })
        .eq('id', quote_id);

      return {
        content: [{ type: 'text' as const, text: `Quote ${quote.quote_number} converted to invoice ${invoiceNumber}\n${JSON.stringify(invoice, null, 2)}` }]
      };
    }
  );

  // ── 3. create_credit_note ─────────────────────────────────
  server.tool(
    'create_credit_note',
    'Create a credit note (avoir) linked to an invoice. Partial or full refund.',
    {
      invoice_id: z.string().describe('Original invoice UUID'),
      amount: z.number().optional().describe('Credit amount TTC (defaults to full invoice amount)'),
      reason: z.string().optional().describe('Reason for credit note')
    },
    async ({ invoice_id, amount, reason }) => {
      const userId = getUserId();

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice_id)
        .eq('user_id', userId)
        .single();

      if (invErr || !invoice) return { content: [{ type: 'text' as const, text: `Error: ${invErr?.message || 'Invoice not found'}` }] };

      const creditAmount = amount ?? parseFloat(invoice.total_ttc) ?? 0;
      const creditNumber = `AV-${Date.now().toString(36).toUpperCase()}`;

      const { data: creditNote, error } = await supabase
        .from('credit_notes')
        .insert([{
          user_id: userId,
          invoice_id,
          client_id: invoice.client_id,
          credit_note_number: creditNumber,
          date: new Date().toISOString().split('T')[0],
          amount: Math.round(creditAmount * 100) / 100,
          reason: reason || null,
          status: 'draft'
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `Credit note created: ${creditNumber} for ${creditAmount} EUR\n${JSON.stringify(creditNote, null, 2)}` }] };
    }
  );

  // ── 4. create_expense ─────────────────────────────────────
  server.tool(
    'create_expense',
    'Record an expense with automatic HT/TVA calculation from TTC amount',
    {
      amount_ttc: z.number().describe('Total amount TTC (tax included)'),
      tax_rate: z.number().optional().describe('Tax rate % (default 20)'),
      category: z.string().optional().describe('Expense category'),
      description: z.string().optional().describe('Description'),
      expense_date: z.string().optional().describe('Date (YYYY-MM-DD), default today'),
      client_id: z.string().optional().describe('Client UUID if billable expense'),
      receipt_url: z.string().optional().describe('URL to receipt image'),
      refacturable: z.boolean().optional().describe('Whether expense can be billed to client')
    },
    async ({ amount_ttc, tax_rate, category, description, expense_date, client_id, receipt_url, refacturable }) => {
      const userId = getUserId();
      const rate = tax_rate ?? 20;
      const amountHt = amount_ttc / (1 + rate / 100);
      const taxAmount = amount_ttc - amountHt;

      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          user_id: userId,
          amount: Math.round(amount_ttc * 100) / 100,
          amount_ht: Math.round(amountHt * 100) / 100,
          tax_amount: Math.round(taxAmount * 100) / 100,
          tax_rate: rate,
          category: category || null,
          description: description || null,
          expense_date: expense_date || new Date().toISOString().split('T')[0],
          client_id: client_id || null,
          receipt_url: receipt_url || null,
          refacturable: refacturable ?? false
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return {
        content: [{ type: 'text' as const, text: `Expense recorded: ${Math.round(amount_ttc * 100) / 100} EUR TTC (${Math.round(amountHt * 100) / 100} HT + ${Math.round(taxAmount * 100) / 100} TVA)\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  // ── 5. get_supplier_balance ───────────────────────────────
  server.tool(
    'get_supplier_balance',
    'Get a supplier balance summary: total invoiced, paid, outstanding, overdue',
    {
      supplier_id: z.string().describe('Supplier UUID')
    },
    async ({ supplier_id }) => {
      const userId = getUserId();

      const [supplierRes, invoicesRes] = await Promise.all([
        supabase.from('suppliers').select('name, email').eq('id', supplier_id).eq('user_id', userId).single(),
        supabase.from('supplier_invoices').select('total_amount, vat_amount, payment_status, due_date')
          .eq('user_id', userId).eq('supplier_id', supplier_id)
      ]);

      if (supplierRes.error) return { content: [{ type: 'text' as const, text: `Error: ${supplierRes.error.message}` }] };

      const invoices = invoicesRes.data ?? [];
      const totalInvoiced = invoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
      const totalPaid = invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
      const outstanding = totalInvoiced - totalPaid;
      const today = new Date().toISOString().split('T')[0];
      const overdue = invoices
        .filter(i => i.payment_status !== 'paid' && i.due_date && i.due_date < today)
        .reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          supplier: supplierRes.data,
          invoice_count: invoices.length,
          total_invoiced: Math.round(totalInvoiced * 100) / 100,
          total_paid: Math.round(totalPaid * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
          overdue: Math.round(overdue * 100) / 100
        }, null, 2) }]
      };
    }
  );
}
```

**Step 2: Verify file compiles**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add mcp-server/src/tools/documents.ts
git commit -m "feat(mcp): add 5 document tools (quote, credit note, expense, supplier balance)"
```

---

## Task 5: Register new tools in server.ts

**Files:**
- Modify: `mcp-server/src/server.ts`

**Step 1: Add imports for the 3 new tool modules**

After line 11 (`import { registerSupplierInvoiceTools } ...`), add:

```typescript
import { registerBankReconciliationTools } from './tools/bank-reconciliation.js';
import { registerReportingTools } from './tools/reporting.js';
import { registerDocumentTools } from './tools/documents.js';
```

**Step 2: Register the new tool modules**

After line 81 (`registerSupplierInvoiceTools(server);`), add:

```typescript
  registerBankReconciliationTools(server);
  registerReportingTools(server);
  registerDocumentTools(server);
```

**Step 3: Verify full server compiles**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add mcp-server/src/server.ts
git commit -m "feat(mcp): register bank-reconciliation, reporting, and document tools"
```

---

## Task 6: Regenerate CRUD and do final verification

**Step 1: Regenerate CRUD tools with whitelist**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && npx tsx scripts/generate-crud.ts`
Expected: `Successfully generated ...generated_crud.ts`

**Step 2: Count final tools**

Run: `grep -c "server.tool(" /c/Github-Desktop/CASHPILOT/mcp-server/src/tools/*.ts`
Expected output should show approximately:
- `accounting.ts`: 5
- `analytics.ts`: 3
- `bank-reconciliation.ts`: 7
- `clients.ts`: ~8
- `documents.ts`: 5
- `exports.ts`: 4
- `generated_crud.ts`: ~100
- `invoices.ts`: ~7
- `payments.ts`: ~4
- `reporting.ts`: 3
- `server.ts`: 3 (auth)
- `supplier-invoices.ts`: 5
- **Total: ~154**

**Step 3: Start the MCP server to verify it boots**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && timeout 5 npx tsx src/index.ts 2>&1 || true`
Expected: No crash, server starts (will timeout after 5s since it waits for stdio)

**Step 4: Final commit**

```bash
git add mcp-server/src/tools/generated_crud.ts
git commit -m "chore(mcp): regenerate CRUD with 20-table whitelist (415 → ~100 tools)"
```

---

## Task 7: Update edge function CRUD (optional, same whitelist)

**Files:**
- Modify: `mcp-server/scripts/generate-crud-edge.ts`

Apply the same `whitelistedTables` array and filter as Task 1. Then regenerate the edge function CRUD.

**Step 1: Add the same whitelist and filter**

Same changes as Task 1 but in `generate-crud-edge.ts`.

**Step 2: Regenerate**

Run: `cd /c/Github-Desktop/CASHPILOT/mcp-server && npx tsx scripts/generate-crud-edge.ts`

**Step 3: Commit**

```bash
git add mcp-server/scripts/generate-crud-edge.ts supabase/functions/mcp/generated_crud.ts
git commit -m "chore(mcp): apply same whitelist to edge function CRUD generator"
```

---

## Summary

| Task | Files | Tools Changed |
|------|-------|---------------|
| 1 | `generate-crud.ts` + `generated_crud.ts` | -315 CRUD tools |
| 2 | `bank-reconciliation.ts` (new) | +7 tools |
| 3 | `reporting.ts` (new) | +3 tools |
| 4 | `documents.ts` (new) | +5 tools |
| 5 | `server.ts` | wiring only |
| 6 | verification | count check |
| 7 | `generate-crud-edge.ts` | edge function sync |
| **Total** | | **454 → ~154 tools** |
