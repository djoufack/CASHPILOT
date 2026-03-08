import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { optionalDate } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

const COLS_PAYMENTS = 'id, invoice_id, client_id, amount, payment_method, payment_date, reference, notes, receipt_number, receipt_generated_at, is_lump_sum, deleted_at, created_at, updated_at';
const COLS_RECEIVABLES = 'id, debtor_name, debtor_phone, debtor_email, description, amount, amount_paid, currency, date_lent, due_date, status, category, notes, created_at, updated_at';

export function registerPaymentTools(server: McpServer) {

  server.tool(
    'list_payments',
    'List payments with optional filters',
    {
      invoice_id: z.string().optional().describe('Filter by invoice UUID'),
      client_id: z.string().optional().describe('Filter by client UUID'),
      limit: z.number().optional().describe('Max results (default 50)')
    },
    async ({ invoice_id, client_id, limit }) => {
      let query = supabase
        .from('payments')
        .select(`${COLS_PAYMENTS}, invoice:invoices(id, invoice_number, total_ttc), client:clients(id, company_name)`)
        .eq('user_id', getUserId())
        .order('payment_date', { ascending: false })
        .limit(limit ?? 50);

      if (invoice_id) query = query.eq('invoice_id', invoice_id);
      if (client_id) query = query.eq('client_id', client_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list payments') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'create_payment',
    'Record a payment for an invoice',
    {
      invoice_id: z.string().describe('Invoice UUID'),
      amount: z.number().min(0).max(999999999.99).multipleOf(0.01).describe('Payment amount'),
      payment_method: z.string().optional().describe('Method: bank_transfer, cash, check, card, other (default bank_transfer)'),
      payment_date: z.string().optional().describe('Payment date YYYY-MM-DD (default today)'),
      reference: z.string().optional().describe('Payment reference'),
      notes: z.string().optional().describe('Notes')
    },
    async ({ invoice_id, amount, payment_method, payment_date, reference, notes }) => {
      // Get invoice to find client_id
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select('client_id, total_ttc')
        .eq('id', invoice_id)
        .eq('user_id', getUserId())
        .single();

      if (invErr) return { content: [{ type: 'text' as const, text: safeError(invErr, 'create payment - find invoice') }] };

      const validatedPaymentDate = optionalDate(payment_date);
      if (payment_date && !validatedPaymentDate) {
        return { content: [{ type: 'text' as const, text: "Parameter 'payment_date' must be a valid date (YYYY-MM-DD)" }] };
      }
      const date = validatedPaymentDate ?? new Date().toISOString().split('T')[0];
      const receiptNumber = `REC-${Date.now()}`;

      const { data, error } = await supabase
        .from('payments')
        .insert([{
          user_id: getUserId(),
          invoice_id,
          client_id: invoice.client_id,
          amount,
          payment_method: payment_method ?? 'bank_transfer',
          payment_date: date,
          reference: reference ?? null,
          notes: notes ?? null,
          receipt_number: receiptNumber
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create payment') }] };

      // Update invoice payment status — select only amount column, scoped to user
      const totalTtc = parseFloat(invoice.total_ttc || '0');
      const { data: sumData } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoice_id)
        .eq('user_id', getUserId());

      const totalPaid = (sumData ?? []).reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
      let paymentStatus = 'unpaid';
      if (totalPaid >= totalTtc) paymentStatus = 'paid';
      else if (totalPaid > 0) paymentStatus = 'partial';

      await supabase
        .from('invoices')
        .update({ payment_status: paymentStatus, status: paymentStatus === 'paid' ? 'paid' : undefined })
        .eq('id', invoice_id)
        .eq('user_id', getUserId());

      return {
        content: [{ type: 'text' as const, text: `Payment of ${amount} recorded (${receiptNumber}). Invoice status: ${paymentStatus}.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'get_unpaid_invoices',
    'List unpaid invoices, sorted by oldest first',
    {
      days_overdue: z.number().optional().describe('Only show invoices overdue by at least N days')
    },
    async ({ days_overdue }) => {
      let query = supabase
        .from('invoices')
        .select(`id, invoice_number, date, due_date, total_ttc, payment_status, balance_due, client:clients(id, company_name)`)
        .eq('user_id', getUserId())
        .in('payment_status', ['unpaid', 'partial'])
        .order('due_date', { ascending: true });

      if (days_overdue) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days_overdue);
        query = query.lte('due_date', cutoff.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get unpaid invoices') }] };

      const total = (data ?? []).reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);
      return {
        content: [{ type: 'text' as const, text: `${data?.length ?? 0} unpaid invoices. Total: ${total.toFixed(2)} EUR.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'get_receivables_summary',
    'Get accounts receivable summary: total owed, collected, pending, overdue',
    {},
    async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select(COLS_RECEIVABLES)
        .eq('user_id', getUserId());

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get receivables summary') }] };

      const stats = {
        total_receivable: 0,
        total_collected: 0,
        total_pending: 0,
        total_overdue: 0,
        count: data?.length ?? 0
      };

      const now = new Date().toISOString().split('T')[0];
      for (const r of data ?? []) {
        const amount = parseFloat(r.amount || '0');
        const paid = parseFloat(r.amount_paid || '0');
        stats.total_receivable += amount;
        stats.total_collected += paid;
        const remaining = amount - paid;
        if (remaining > 0) {
          stats.total_pending += remaining;
          if (r.due_date && r.due_date < now) {
            stats.total_overdue += remaining;
          }
        }
      }

      stats.total_receivable = Math.round(stats.total_receivable * 100) / 100;
      stats.total_collected = Math.round(stats.total_collected * 100) / 100;
      stats.total_pending = Math.round(stats.total_pending * 100) / 100;
      stats.total_overdue = Math.round(stats.total_overdue * 100) / 100;

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }]
      };
    }
  );
}
