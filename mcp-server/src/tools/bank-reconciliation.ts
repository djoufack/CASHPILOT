import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { safeError } from '../utils/errors.js';
import { validateDate } from '../utils/validation.js';

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

      // Fetch only unreconciled transactions with needed columns
      const { data: transactions, error: txErr } = await supabase
        .from('bank_transactions')
        .select('id, amount, reference, remittance_info, description, date')
        .eq('user_id', userId)
        .is('invoice_id', null)
        .gt('amount', 0)
        .order('date', { ascending: false })
        .limit(maxTx);

      if (txErr) {
        return { content: [{ type: 'text' as const, text: safeError(txErr, 'auto reconcile - fetch transactions') }] };
      }

      // Fetch only unpaid invoices with needed columns
      const { data: invoices, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_ttc, client:clients(company_name, contact_name)')
        .eq('user_id', userId)
        .in('status', ['sent', 'overdue'])
        .in('payment_status', ['unpaid', 'partial']);

      if (invErr) {
        return { content: [{ type: 'text' as const, text: safeError(invErr, 'auto reconcile - fetch invoices') }] };
      }

      if (!transactions?.length || !invoices?.length) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ matched: 0, message: 'No unreconciled transactions or unpaid invoices found.' }) }] };
      }

      const matched: Array<{ transaction_id: string; invoice_id: string; invoice_number: string; amount: number; confidence: number }> = [];
      const usedInvoices = new Set<string>();
      const now = new Date().toISOString();

      // Phase 1: scoring / matching (pure computation, no DB writes)
      for (const tx of transactions) {
        let bestMatch: typeof invoices[0] | null = null;
        let bestScore = 0;

        for (const inv of invoices) {
          if (usedInvoices.has(inv.id)) continue;

          let score = 0;
          const amountDiff = Math.abs(tx.amount - (parseFloat(inv.total_ttc) || 0));
          const amountRatio = amountDiff / Math.max(tx.amount, parseFloat(inv.total_ttc) || 1, 1);
          if (amountRatio === 0) score += 50;
          else if (amountRatio < 0.01) score += 40;
          else if (amountRatio < 0.05) score += 20;

          const ref = (tx.reference || tx.remittance_info || tx.description || '').toLowerCase();
          const invNum = (inv.invoice_number || '').toLowerCase();
          if (invNum && ref.includes(invNum)) score += 30;

          const clientName = (inv.client?.company_name || inv.client?.contact_name || '').toLowerCase();
          if (clientName.length >= 3 && ref.includes(clientName)) score += 20;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = inv;
          }
        }

        const confidence = bestScore / 100;
        if (bestMatch && confidence >= minConfidence) {
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

      // Phase 2: batch all DB updates in parallel
      if (matched.length > 0) {
        const updatePromises: Promise<unknown>[] = [];

        for (const m of matched) {
          updatePromises.push(
            supabase.from('bank_transactions').update({
              invoice_id: m.invoice_id,
              reconciliation_status: 'matched',
              match_confidence: m.confidence,
              matched_at: now
            }).eq('id', m.transaction_id)
          );
          updatePromises.push(
            supabase.from('invoices').update({
              status: 'paid',
              payment_status: 'paid'
            }).eq('id', m.invoice_id)
          );
        }

        await Promise.all(updatePromises);
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

      if (error) {
        return { content: [{ type: 'text' as const, text: safeError(error, 'match bank line') }] };
      }
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

      if (error) {
        return { content: [{ type: 'text' as const, text: safeError(error, 'unmatch bank line') }] };
      }
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

      if (error) {
        return { content: [{ type: 'text' as const, text: safeError(error, 'ignore bank lines') }] };
      }
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

      if (error) {
        return { content: [{ type: 'text' as const, text: safeError(error, 'get reconciliation summary') }] };
      }
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

      const { data: bankLine, error: lineErr } = await supabase
        .from('bank_statement_lines')
        .select('*')
        .eq('id', line_id)
        .eq('user_id', userId)
        .single();

      if (lineErr || !bankLine) {
        return { content: [{ type: 'text' as const, text: safeError(lineErr || 'Line not found', 'search match candidates') }] };
      }

      const bankAmount = parseFloat(String(bankLine.amount)) || 0;
      const bankDesc = (bankLine.description || bankLine.reference || '').toLowerCase();
      const isIncoming = bankAmount > 0;

      type Candidate = { source_type: string; source_id: string; description: string; amount: number; date: string; score: number };
      const candidates: Candidate[] = [];

      if (isIncoming) {
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

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          bank_line: { id: bankLine.id, amount: bankAmount, date: bankLine.transaction_date, description: bankLine.description },
          candidates: candidates.slice(0, maxRes),
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
      opening_balance: z.number().max(999999999.99).multipleOf(0.01).optional().describe('Opening balance'),
      closing_balance: z.number().max(999999999.99).multipleOf(0.01).optional().describe('Closing balance'),
      currency: z.string().optional().describe('Currency code (default EUR)'),
      lines: z.array(z.object({
        date: z.string().describe('Transaction date YYYY-MM-DD'),
        description: z.string().describe('Transaction description'),
        amount: z.number().max(999999999.99).multipleOf(0.01).describe('Amount (positive=credit, negative=debit)'),
        reference: z.string().optional().describe('Transaction reference'),
        value_date: z.string().optional().describe('Value date YYYY-MM-DD'),
        balance_after: z.number().max(999999999.99).multipleOf(0.01).optional().describe('Balance after this transaction')
      })).describe('Array of statement lines to import')
    },
    async ({ bank_name, account_number, statement_date, opening_balance, closing_balance, currency, lines }) => {
      try { validateDate(statement_date, 'statement_date'); } catch (e: any) { return { content: [{ type: 'text' as const, text: e.message }] }; }

      // Validate dates in lines
      for (let i = 0; i < lines.length; i++) {
        try { validateDate(lines[i].date, `lines[${i}].date`); } catch (e: any) { return { content: [{ type: 'text' as const, text: e.message }] }; }
        if (lines[i].value_date) {
          try { validateDate(lines[i].value_date!, `lines[${i}].value_date`); } catch (e: any) { return { content: [{ type: 'text' as const, text: e.message }] }; }
        }
      }

      const userId = getUserId();

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

      if (stmtErr) {
        return { content: [{ type: 'text' as const, text: safeError(stmtErr, 'import bank statement') }] };
      }

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

      if (linesErr) {
        return { content: [{ type: 'text' as const, text: safeError(linesErr, 'import bank statement - insert lines') }] };
      }

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
