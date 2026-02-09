import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { sanitizeText } from '../utils/sanitize.js';

export function registerInvoiceTools(server: McpServer) {

  server.tool(
    'list_invoices',
    'List invoices with optional filters (status, client, limit)',
    {
      status: z.string().optional().describe('Filter by status: draft, sent, paid, overdue, cancelled'),
      client_id: z.string().optional().describe('Filter by client UUID'),
      limit: z.number().optional().describe('Max results (default 50)')
    },
    async ({ status, client_id, limit }) => {
      let query = supabase
        .from('invoices')
        .select(`*, client:clients(id, company_name, contact_name, email), items:invoice_items(*)`)
        .eq('user_id', getUserId())
        .order('created_at', { ascending: false })
        .limit(limit ?? 50);

      if (status) query = query.eq('status', status);
      if (client_id) query = query.eq('client_id', client_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'get_invoice',
    'Get full details of a single invoice including items, payments, and client info',
    {
      invoice_id: z.string().describe('Invoice UUID')
    },
    async ({ invoice_id }) => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`*, client:clients(*), items:invoice_items(*), payments:payments(id, amount, payment_date, payment_method, receipt_number)`)
        .eq('id', invoice_id)
        .eq('user_id', getUserId())
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'create_invoice',
    'Create a new invoice',
    {
      invoice_number: z.string().describe('Unique invoice number (e.g. INV-2026-001)'),
      client_id: z.string().describe('Client UUID'),
      invoice_date: z.string().describe('Issue date (YYYY-MM-DD)'),
      due_date: z.string().describe('Due date (YYYY-MM-DD)'),
      total_ht: z.number().describe('Total excluding VAT'),
      tax_rate: z.number().optional().describe('VAT rate (default 20)'),
      total_ttc: z.number().describe('Total including VAT'),
      status: z.string().optional().describe('Status: draft, sent (default draft)'),
      notes: z.string().optional().describe('Invoice notes')
    },
    async ({ invoice_number, client_id, invoice_date, due_date, total_ht, tax_rate, total_ttc, status, notes }) => {
      const vatRate = tax_rate ?? 20;
      const totalVat = total_ttc - total_ht;

      const { data, error } = await supabase
        .from('invoices')
        .insert([{
          user_id: getUserId(),
          invoice_number,
          client_id,
          invoice_date,
          due_date,
          total_ht,
          tax_rate: vatRate,
          total_vat: totalVat,
          total_ttc,
          status: status ?? 'draft',
          notes: notes ? sanitizeText(notes) : null
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: `Invoice ${invoice_number} created.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'update_invoice_status',
    'Update the status of an invoice',
    {
      invoice_id: z.string().describe('Invoice UUID'),
      status: z.string().describe('New status: draft, sent, paid, overdue, cancelled')
    },
    async ({ invoice_id, status }) => {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', invoice_id)
        .eq('user_id', getUserId())
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: `Invoice status updated to '${status}'.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'search_invoices',
    'Search invoices by text (invoice number, notes, client name)',
    {
      query: z.string().describe('Search text')
    },
    async ({ query: q }) => {
      const pattern = `%${q}%`;
      const { data, error } = await supabase
        .from('invoices')
        .select(`*, client:clients(id, company_name)`)
        .eq('user_id', getUserId())
        .or(`invoice_number.ilike.${pattern},notes.ilike.${pattern},reference.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: `Found ${data?.length ?? 0} invoices.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'get_invoice_stats',
    'Get invoice statistics: totals billed, paid, unpaid, overdue',
    {
      months: z.number().optional().describe('Period in months (default 12)')
    },
    async ({ months }) => {
      const period = months ?? 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - period);

      const { data, error } = await supabase
        .from('invoices')
        .select('total_ttc, status, due_date, payment_status')
        .eq('user_id', getUserId())
        .gte('invoice_date', startDate.toISOString().split('T')[0]);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const now = new Date().toISOString().split('T')[0];
      const stats = {
        total_invoices: data?.length ?? 0,
        total_billed: 0,
        total_paid: 0,
        total_unpaid: 0,
        total_overdue: 0,
        count_paid: 0,
        count_unpaid: 0,
        count_overdue: 0
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
        content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }]
      };
    }
  );
}
