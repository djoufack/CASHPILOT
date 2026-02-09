import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { sanitizeText } from '../utils/sanitize.js';

export function registerClientTools(server: McpServer) {

  server.tool(
    'list_clients',
    'List all clients with optional search by name',
    {
      search: z.string().optional().describe('Search by company name or contact name'),
      limit: z.number().optional().describe('Max results (default 50)')
    },
    async ({ search, limit }) => {
      let query = supabase
        .from('clients')
        .select('*')
        .eq('user_id', getUserId())
        .order('company_name', { ascending: true })
        .limit(limit ?? 50);

      if (search) {
        const pattern = `%${search}%`;
        query = query.or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`);
      }

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'get_client',
    'Get client details with recent invoices',
    {
      client_id: z.string().describe('Client UUID')
    },
    async ({ client_id }) => {
      const [clientRes, invoicesRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', client_id).eq('user_id', getUserId()).single(),
        supabase.from('invoices').select('id, invoice_number, invoice_date, total_ttc, status, payment_status')
          .eq('client_id', client_id).eq('user_id', getUserId())
          .order('invoice_date', { ascending: false }).limit(10)
      ]);

      if (clientRes.error) return { content: [{ type: 'text' as const, text: `Error: ${clientRes.error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ...clientRes.data, recent_invoices: invoicesRes.data ?? [] }, null, 2) }]
      };
    }
  );

  server.tool(
    'create_client',
    'Create a new client',
    {
      company_name: z.string().describe('Company name'),
      contact_name: z.string().optional().describe('Contact person name'),
      email: z.string().optional().describe('Email address'),
      address: z.string().optional().describe('Street address'),
      city: z.string().optional().describe('City'),
      postal_code: z.string().optional().describe('Postal code'),
      country: z.string().optional().describe('Country code (e.g. FR, BE)'),
      phone: z.string().optional().describe('Phone number'),
      vat_number: z.string().optional().describe('VAT number'),
      notes: z.string().optional().describe('Notes')
    },
    async ({ company_name, contact_name, email, address, city, postal_code, country, phone, vat_number, notes }) => {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          user_id: getUserId(),
          company_name: sanitizeText(company_name),
          contact_name: contact_name ? sanitizeText(contact_name) : null,
          email,
          address: address ? sanitizeText(address) : null,
          city,
          postal_code,
          country,
          phone,
          vat_number,
          notes: notes ? sanitizeText(notes) : null
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: `Client '${company_name}' created.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'get_client_balance',
    'Get a client balance: invoices due, payments received, outstanding amount',
    {
      client_id: z.string().describe('Client UUID')
    },
    async ({ client_id }) => {
      const [invoicesRes, paymentsRes] = await Promise.all([
        supabase.from('invoices').select('total_ttc, status, payment_status, due_date')
          .eq('client_id', client_id).eq('user_id', getUserId()),
        supabase.from('payments').select('amount')
          .eq('client_id', client_id).eq('user_id', getUserId())
      ]);

      if (invoicesRes.error) return { content: [{ type: 'text' as const, text: `Error: ${invoicesRes.error.message}` }] };

      const totalInvoiced = (invoicesRes.data ?? []).reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);
      const totalPaid = (paymentsRes.data ?? []).reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
      const now = new Date().toISOString().split('T')[0];
      const overdue = (invoicesRes.data ?? [])
        .filter(i => i.payment_status !== 'paid' && i.due_date && i.due_date < now)
        .reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);

      const balance = {
        total_invoiced: Math.round(totalInvoiced * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        outstanding: Math.round((totalInvoiced - totalPaid) * 100) / 100,
        overdue: Math.round(overdue * 100) / 100
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(balance, null, 2) }]
      };
    }
  );
}
