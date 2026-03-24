import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId, getCompanyId } from '../supabase.js';
import { sanitizeText } from '../utils/sanitize.js';
import { validateDate } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

const COLS_INVOICES =
  'id, invoice_number, client_id, date, due_date, total_ht, tax_rate, total_ttc, status, payment_status, amount_paid, balance_due, notes, reference, invoice_type, discount_type, discount_value, discount_amount, shipping_fee, adjustment, adjustment_label, header_note, footer_note, conditions, terms_and_conditions, internal_remark, custom_fields, attached_image_url, payment_terms_id, peppol_status, peppol_document_id, peppol_sent_at, peppol_error_message, created_at';

export function registerInvoiceTools(server: McpServer) {
  server.tool(
    'list_invoices',
    'List invoices with optional filters (status, client, limit)',
    {
      status: z
        .enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'])
        .optional()
        .describe('Filter by status'),
      client_id: z.string().optional().describe('Filter by client UUID'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async ({ status, client_id, limit }) => {
      let query = supabase
        .from('invoices')
        .select(
          `${COLS_INVOICES}, client:clients(id, company_name, contact_name, email), items:invoice_items(id, invoice_id, description, quantity, unit_price, total, discount_type, discount_value, discount_amount)`
        )
        .eq('user_id', getUserId())
        .order('created_at', { ascending: false })
        .limit(limit ?? 50);

      if (status) query = query.eq('status', status);
      if (client_id) query = query.eq('client_id', client_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list invoices') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_invoice',
    'Get full details of a single invoice including items, payments, and client info',
    {
      invoice_id: z.string().describe('Invoice UUID'),
    },
    async ({ invoice_id }) => {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `${COLS_INVOICES}, client:clients(id, company_name, contact_name, email, phone, address, city, postal_code, country, vat_number, preferred_currency), items:invoice_items(id, invoice_id, description, quantity, unit_price, total, discount_type, discount_value, discount_amount), payments:payments(id, amount, payment_date, payment_method, receipt_number)`
        )
        .eq('id', invoice_id)
        .eq('user_id', getUserId())
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get invoice') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'create_invoice',
    'Create a new invoice',
    {
      invoice_number: z.string().describe('Unique invoice number (e.g. INV-2026-001)'),
      client_id: z.string().describe('Client UUID'),
      date: z.string().describe('Issue date (YYYY-MM-DD)'),
      due_date: z.string().describe('Due date (YYYY-MM-DD)'),
      total_ht: z.number().min(0).max(999999999.99).multipleOf(0.01).describe('Total excluding VAT'),
      tax_rate: z
        .number()
        .min(0)
        .max(100)
        .multipleOf(0.01)
        .optional()
        .describe('Tax rate as percentage (e.g., 19.25 for 19.25%). Default 20'),
      total_ttc: z.number().min(0).max(999999999.99).multipleOf(0.01).describe('Total including VAT'),
      status: z
        .enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'])
        .optional()
        .describe('Status (default draft)'),
      notes: z.string().optional().describe('Invoice notes'),
    },
    async ({ invoice_number, client_id, date, due_date, total_ht, tax_rate, total_ttc, status, notes }) => {
      try {
        validateDate(date, 'date');
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: e.message }] };
      }
      try {
        validateDate(due_date, 'due_date');
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: e.message }] };
      }
      const vatRate = tax_rate ?? 20;

      const { data, error } = await supabase
        .from('invoices')
        .insert([
          {
            user_id: getUserId(),
            company_id: await getCompanyId(),
            invoice_number,
            client_id,
            date,
            due_date,
            total_ht,
            tax_rate: vatRate,
            total_ttc,
            status: status ?? 'draft',
            notes: notes ? sanitizeText(notes) : null,
          },
        ])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create invoice') }] };

      return {
        content: [
          { type: 'text' as const, text: `Invoice ${invoice_number} created.\n${JSON.stringify(data, null, 2)}` },
        ],
      };
    }
  );

  server.tool(
    'delete_invoice',
    'Delete an invoice from CashPilot',
    {
      invoice_id: z.string().describe('Invoice UUID to delete'),
    },
    async ({ invoice_id }) => {
      const { error } = await supabase.from('invoices').delete().eq('id', invoice_id).eq('user_id', getUserId());

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete invoice') }] };

      return {
        content: [{ type: 'text' as const, text: `Successfully deleted invoice ${invoice_id}` }],
      };
    }
  );

  server.tool(
    'update_invoice_status',
    'Update the status of an invoice',
    {
      invoice_id: z.string().describe('Invoice UUID'),
      status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial']).describe('New status'),
    },
    async ({ invoice_id, status }) => {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', invoice_id)
        .eq('user_id', getUserId())
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update invoice status') }] };

      return {
        content: [
          { type: 'text' as const, text: `Invoice status updated to '${status}'.\n${JSON.stringify(data, null, 2)}` },
        ],
      };
    }
  );

  server.tool(
    'search_invoices',
    'Search invoices by text (invoice number, notes, client name)',
    {
      query: z.string().describe('Search text'),
    },
    async ({ query: q }) => {
      const safeQ = q.replace(/[|,().]/g, '\\$&');
      const pattern = `%${safeQ}%`;
      const { data, error } = await supabase
        .from('invoices')
        .select(`${COLS_INVOICES}, client:clients(id, company_name)`)
        .eq('user_id', getUserId())
        .or(`invoice_number.ilike.${pattern},notes.ilike.${pattern},reference.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'search invoices') }] };

      return {
        content: [
          { type: 'text' as const, text: `Found ${data?.length ?? 0} invoices.\n${JSON.stringify(data, null, 2)}` },
        ],
      };
    }
  );

  server.tool(
    'get_invoice_stats',
    'Get invoice statistics: totals billed, paid, unpaid, overdue',
    {
      months: z.number().optional().describe('Period in months (default 12)'),
    },
    async ({ months }) => {
      const period = months ?? 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - period);

      const { data, error } = await supabase
        .from('invoices')
        .select('total_ttc, status, due_date, payment_status')
        .eq('user_id', getUserId())
        .gte('date', startDate.toISOString().split('T')[0]);

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get invoice stats') }] };

      const now = new Date().toISOString().split('T')[0];
      const stats = {
        total_invoices: data?.length ?? 0,
        total_billed: 0,
        total_paid: 0,
        total_unpaid: 0,
        total_overdue: 0,
        count_paid: 0,
        count_unpaid: 0,
        count_overdue: 0,
      };

      for (const inv of data ?? []) {
        const amount = parseFloat(inv.total_ttc || '0');
        stats.total_billed += amount;

        if (inv.status === 'paid' || inv.payment_status === 'paid') {
          stats.total_paid += amount;
          stats.count_paid++;
        } else {
          stats.total_unpaid += amount;
          stats.count_unpaid++;
          if (inv.due_date && inv.due_date < now) {
            stats.total_overdue += amount;
            stats.count_overdue++;
          }
        }
      }

      // Round
      stats.total_billed = Math.round(stats.total_billed * 100) / 100;
      stats.total_paid = Math.round(stats.total_paid * 100) / 100;
      stats.total_unpaid = Math.round(stats.total_unpaid * 100) / 100;
      stats.total_overdue = Math.round(stats.total_overdue * 100) / 100;

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  server.tool(
    'get_dunning_candidates',
    'Get overdue invoices that are candidates for dunning (payment follow-up). Returns invoice details with days overdue and previous dunning history.',
    {},
    async () => {
      const userId = getUserId();
      const today = new Date().toISOString().split('T')[0];

      // Fetch overdue unpaid/partial invoices with client info
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(
          'id, invoice_number, date, due_date, total_ttc, payment_status, balance_due, client:clients(id, company_name)'
        )
        .eq('user_id', userId)
        .in('payment_status', ['unpaid', 'partial'])
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get dunning candidates') }] };
      if (!invoices || invoices.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No overdue invoices found for dunning.' }] };
      }

      // Fetch dunning history for these invoices
      const invoiceIds = invoices.map((i: any) => i.id);
      const { data: history } = await supabase
        .from('dunning_history')
        .select('invoice_id, sent_at, status, method')
        .in('invoice_id', invoiceIds)
        .order('sent_at', { ascending: false });

      // Build dunning summary per invoice
      const historyByInvoice: Record<string, { count: number; last_date: string | null }> = {};
      for (const h of history ?? []) {
        if (!historyByInvoice[h.invoice_id]) {
          historyByInvoice[h.invoice_id] = { count: 0, last_date: h.sent_at };
        }
        historyByInvoice[h.invoice_id].count++;
      }

      const todayDate = new Date(today);
      const candidates = invoices.map((inv: any) => {
        const dueDate = new Date(inv.due_date);
        const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const dunning = historyByInvoice[inv.id] || { count: 0, last_date: null };
        return {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          client_name: inv.client?.company_name ?? null,
          total_ttc: inv.total_ttc,
          balance_due: inv.balance_due,
          due_date: inv.due_date,
          days_overdue: daysOverdue,
          last_dunning_date: dunning.last_date,
          dunning_count: dunning.count,
        };
      });

      // Sort by days overdue descending
      candidates.sort((a: any, b: any) => b.days_overdue - a.days_overdue);

      return {
        content: [
          {
            type: 'text' as const,
            text: `${candidates.length} dunning candidate(s) found.\n${JSON.stringify(candidates, null, 2)}`,
          },
        ],
      };
    }
  );
}
