import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId, getCompanyId } from '../supabase.js';
import { sanitizeText } from '../utils/sanitize.js';
import { safeError } from '../utils/errors.js';

const COLS_CLIENTS =
  'id, company_name, contact_name, email, phone, address, city, postal_code, country, vat_number, preferred_currency, notes, payment_terms, bank_name, iban, bic_swift, tax_id, website, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled, deleted_at, created_at, updated_at';

export function registerClientTools(server: McpServer) {
  server.tool(
    'list_clients',
    'List all clients with optional search by name',
    {
      search: z.string().optional().describe('Search by company name or contact name'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async ({ search, limit }) => {
      let query = supabase
        .from('clients')
        .select(COLS_CLIENTS)
        .eq('user_id', getUserId())
        .order('company_name', { ascending: true })
        .limit(limit ?? 50);

      if (search) {
        const safeSearch = search.replace(/[|,().]/g, '\\$&');
        const pattern = `%${safeSearch}%`;
        query = query.or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`);
      }

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list clients') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_client',
    'Get client details with recent invoices',
    {
      client_id: z.string().describe('Client UUID'),
    },
    async ({ client_id }) => {
      const [clientRes, invoicesRes] = await Promise.all([
        supabase.from('clients').select(COLS_CLIENTS).eq('id', client_id).eq('user_id', getUserId()).single(),
        supabase
          .from('invoices')
          .select('id, invoice_number, date, total_ttc, status, payment_status')
          .eq('client_id', client_id)
          .eq('user_id', getUserId())
          .order('date', { ascending: false })
          .limit(10),
      ]);

      if (clientRes.error)
        return { content: [{ type: 'text' as const, text: safeError(clientRes.error, 'get client') }] };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ ...clientRes.data, recent_invoices: invoicesRes.data ?? [] }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'create_client',
    'Create a new client',
    {
      company_name: z.string().describe('Company name'),
      contact_name: z.string().optional().describe('Contact person name'),
      email: z.string().email().optional().describe('Email address'),
      address: z.string().optional().describe('Street address'),
      city: z.string().optional().describe('City'),
      postal_code: z.string().optional().describe('Postal code'),
      country: z.string().optional().describe('Country code (e.g. FR, BE)'),
      phone: z.string().optional().describe('Phone number'),
      vat_number: z.string().optional().describe('VAT number'),
      preferred_currency: z.string().optional().describe('Currency code (e.g. EUR, USD, XAF)'),
      notes: z.string().optional().describe('Notes'),
    },
    async ({
      company_name,
      contact_name,
      email,
      address,
      city,
      postal_code,
      country,
      phone,
      vat_number,
      preferred_currency,
      notes,
    }) => {
      const companyId = await getCompanyId();
      const { data, error } = await supabase
        .from('clients')
        .insert([
          {
            user_id: getUserId(),
            company_id: companyId,
            company_name: sanitizeText(company_name),
            contact_name: contact_name ? sanitizeText(contact_name) : null,
            email,
            address: address ? sanitizeText(address) : null,
            city,
            postal_code,
            country,
            phone,
            vat_number,
            preferred_currency,
            notes: notes ? sanitizeText(notes) : null,
          },
        ])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create client') }] };

      return {
        content: [
          { type: 'text' as const, text: `Client '${company_name}' created.\n${JSON.stringify(data, null, 2)}` },
        ],
      };
    }
  );

  server.tool(
    'update_client',
    'Update an existing client',
    {
      client_id: z.string().describe('Client UUID to update'),
      company_name: z.string().optional().describe('Company name'),
      contact_name: z.string().optional().describe('Contact person name'),
      email: z.string().email().optional().describe('Email address'),
      address: z.string().optional().describe('Street address'),
      city: z.string().optional().describe('City'),
      postal_code: z.string().optional().describe('Postal code'),
      country: z.string().optional().describe('Country code (e.g. FR, BE)'),
      phone: z.string().optional().describe('Phone number'),
      vat_number: z.string().optional().describe('VAT number'),
      preferred_currency: z.string().optional().describe('Currency code (e.g. EUR, USD, XAF)'),
      notes: z.string().optional().describe('Notes'),
    },
    async (args) => {
      const { client_id, ...updates } = args;
      if (updates.company_name) updates.company_name = sanitizeText(updates.company_name);
      if (updates.contact_name) updates.contact_name = sanitizeText(updates.contact_name);
      if (updates.address) updates.address = sanitizeText(updates.address);
      if (updates.notes) updates.notes = sanitizeText(updates.notes);

      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client_id)
        .eq('user_id', getUserId())
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update client') }] };

      return {
        content: [{ type: 'text' as const, text: `Client updated.\n${JSON.stringify(data, null, 2)}` }],
      };
    }
  );

  server.tool(
    'delete_client',
    'Soft-delete (archive) a client. The client is not removed from the database but marked as deleted. Use restore_client to undo.',
    {
      client_id: z.string().describe('Client UUID to archive'),
    },
    async ({ client_id }) => {
      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', client_id)
        .eq('user_id', getUserId());

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'archive client') }] };

      return {
        content: [
          { type: 'text' as const, text: `Successfully archived client ${client_id}. Use restore_client to undo.` },
        ],
      };
    }
  );

  server.tool(
    'restore_client',
    'Restore a previously archived (soft-deleted) client',
    {
      client_id: z.string().describe('Client UUID to restore'),
    },
    async ({ client_id }) => {
      const { data, error } = await supabase
        .from('clients')
        .update({ deleted_at: null })
        .eq('id', client_id)
        .eq('user_id', getUserId())
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'restore client') }] };

      return {
        content: [{ type: 'text' as const, text: `Client restored.\n${JSON.stringify(data, null, 2)}` }],
      };
    }
  );

  server.tool(
    'list_archived_clients',
    'List all archived (soft-deleted) clients',
    {
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from('clients')
        .select(COLS_CLIENTS)
        .eq('user_id', getUserId())
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(limit ?? 50);

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list archived clients') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_client_balance',
    'Get a client balance: invoices due, payments received, outstanding amount',
    {
      client_id: z.string().describe('Client UUID'),
    },
    async ({ client_id }) => {
      const [invoicesRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_ttc, status, payment_status, due_date')
          .eq('client_id', client_id)
          .eq('user_id', getUserId()),
        supabase.from('payments').select('amount').eq('client_id', client_id).eq('user_id', getUserId()),
      ]);

      if (invoicesRes.error)
        return { content: [{ type: 'text' as const, text: safeError(invoicesRes.error, 'get client balance') }] };

      const totalInvoiced = (invoicesRes.data ?? []).reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);
      const totalPaid = (paymentsRes.data ?? []).reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
      const now = new Date().toISOString().split('T')[0];
      const overdue = (invoicesRes.data ?? [])
        .filter((i) => i.payment_status !== 'paid' && i.due_date && i.due_date < now)
        .reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);

      const balance = {
        total_invoiced: Math.round(totalInvoiced * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        outstanding: Math.round((totalInvoiced - totalPaid) * 100) / 100,
        overdue: Math.round(overdue * 100) / 100,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(balance, null, 2) }],
      };
    }
  );
}
