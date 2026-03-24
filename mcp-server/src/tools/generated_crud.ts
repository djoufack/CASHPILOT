import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId, getCompanyId } from '../supabase.js';
import { sanitizeRecord } from '../utils/sanitize.js';
import { validateDatesInRecord } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';
import { getCached, setCache, invalidateCache } from '../utils/cache.js';

// ── Explicit column lists (no select('*') — defense against future data leaks) ──
const COLS_BANK_CONNECTIONS =
  'id, institution_id, institution_name, institution_logo, status, account_id, account_iban, account_name, account_currency, account_balance, last_sync_at, sync_error, expires_at, created_at, updated_at';
const COLS_SUPPLIERS =
  'id, company_name, contact_person, email, phone, address, city, postal_code, country, currency, status, supplier_type, payment_terms, bank_name, iban, bic_swift, tax_id, website, notes, created_at, updated_at';
const COLS_QUOTES = 'id, quote_number, client_id, date, status, tax_rate, total_ht, total_ttc, created_at';
const COLS_BANK_TRANSACTIONS =
  'id, bank_connection_id, external_id, date, booking_date, value_date, amount, currency, description, reference, remittance_info, creditor_name, debtor_name, reconciliation_status, invoice_id, match_confidence, matched_at, created_at, updated_at';
const COLS_EXPENSES =
  'id, description, amount, amount_ht, tax_rate, tax_amount, category, expense_date, payment_method, receipt_url, client_id, refacturable, deleted_at, created_at';
const COLS_COMPANY_PORTFOLIOS =
  'id, user_id, portfolio_name, description, base_currency, is_default, is_active, created_at, updated_at';
const COLS_COMPANY_PORTFOLIO_MEMBERS = 'id, portfolio_id, company_id, user_id, created_at';
const COLS_PAYMENT_INSTRUMENT_BANK_ACCOUNTS =
  'instrument_id, bank_connection_id, bank_name, account_holder, iban_masked, bic_swift, account_number_masked, institution_country, account_kind, statement_import_enabled, api_sync_enabled, last_sync_at, created_at, updated_at';
const COLS_PAYMENT_INSTRUMENT_CARDS =
  'instrument_id, card_brand, card_type, holder_name, last4, expiry_month, expiry_year, issuer_name, billing_cycle_day, statement_due_day, credit_limit, available_credit, network_token, is_virtual, created_at, updated_at';
const COLS_PAYMENT_INSTRUMENT_CASH_ACCOUNTS =
  'instrument_id, cash_point_name, custodian_user_id, location, max_authorized_balance, reconciliation_frequency, created_at, updated_at';
const COLS_PAYMENT_TRANSACTION_ALLOCATIONS =
  'id, payment_transaction_id, allocation_type, target_id, allocated_amount, notes, created_at';
const COLS_PAYMENT_ALERTS =
  'id, user_id, company_id, payment_instrument_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at';

export function registerGeneratedCrudTools(server: McpServer) {
  server.tool(
    'create_bank_connections',
    'Create a new record in bank_connections',
    {
      institution_id: z.string(),
      institution_name: z.string(),
      institution_logo: z.string().optional(),
      requisition_id: z.string().optional(),
      agreement_id: z.string().optional(),
      status: z.enum(['pending', 'active', 'expired', 'revoked', 'error']).optional(),
      last_sync_at: z.string().optional(),
      sync_error: z.string().optional(),
      account_id: z.string().optional(),
      account_iban: z.string().optional(),
      account_name: z.string().optional(),
      account_currency: z.string().optional(),
      account_balance: z.number().max(999999999.99).multipleOf(0.01).optional(),
      expires_at: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('bank_connections')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create bank connection') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created bank_connections record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_bank_connections',
    'Update an existing record in bank_connections',
    {
      id: z.string().describe('Record UUID to update'),
      institution_id: z.string().optional(),
      institution_name: z.string().optional(),
      institution_logo: z.string().optional(),
      requisition_id: z.string().optional(),
      agreement_id: z.string().optional(),
      status: z.enum(['pending', 'active', 'expired', 'revoked', 'error']).optional(),
      last_sync_at: z.string().optional(),
      sync_error: z.string().optional(),
      account_id: z.string().optional(),
      account_iban: z.string().optional(),
      account_name: z.string().optional(),
      account_currency: z.string().optional(),
      account_balance: z.number().max(999999999.99).multipleOf(0.01).optional(),
      expires_at: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('bank_connections').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update bank connection') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated bank_connections record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_bank_connections',
    'Delete a record from bank_connections',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_connections').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete bank connection') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_connections' }],
      };
    }
  );

  server.tool(
    'get_bank_connections',
    'Get a single record from bank_connections by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_connections').select(COLS_BANK_CONNECTIONS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get bank connection') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_connections',
    'List multiple records from bank_connections',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_connections').select(COLS_BANK_CONNECTIONS);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list bank connections') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payables',
    'Create a new record in payables',
    {
      creditor_name: z.string(),
      creditor_phone: z.string().optional(),
      creditor_email: z.string().email().optional(),
      description: z.string().optional(),
      amount: z.number().min(0).max(999999999.99).multipleOf(0.01),
      amount_paid: z.number().min(0).max(999999999.99).multipleOf(0.01),
      currency: z.string(),
      date_borrowed: z.string(),
      due_date: z.string().optional(),
      status: z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled']),
      category: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('payables')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create payable') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created payables record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_payables',
    'Update an existing record in payables',
    {
      id: z.string().describe('Record UUID to update'),
      creditor_name: z.string().optional(),
      creditor_phone: z.string().optional(),
      creditor_email: z.string().email().optional(),
      description: z.string().optional(),
      amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      amount_paid: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      currency: z.string().optional(),
      date_borrowed: z.string().optional(),
      due_date: z.string().optional(),
      status: z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled']).optional(),
      category: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('payables').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update payable') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated payables record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_payables',
    'Delete a record from payables',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('payables').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete payable') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payables' }] };
    }
  );

  server.tool(
    'get_payables',
    'Get a single record from payables by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('payables').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get payable') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payables',
    'List multiple records from payables',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payables').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list payables') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_invoice_items',
    'Create a new record in invoice_items',
    {
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      description: z.string().optional(),
      quantity: z.number().min(0).optional(),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      total: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      product_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `products.id`.<fk table='products' column='id'/>"),
      discount_type: z.string().optional(),
      discount_value: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      discount_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      hsn_code: z.string().optional(),
      item_type: z.string().optional(),
      service_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `services.id`.<fk table='services' column='id'/>"),
      timesheet_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `timesheets.id`.<fk table='timesheets' column='id'/>"),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      // Security: verify the parent invoice belongs to the current user
      if (payload.invoice_id) {
        const { data: inv, error: invErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('id', payload.invoice_id)
          .eq('user_id', getUserId())
          .single();
        if (invErr || !inv)
          return { content: [{ type: 'text' as const, text: 'Error: invoice not found or access denied' }] };
      }
      const { data, error } = await supabase
        .from('invoice_items')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create invoice item') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created invoice_items record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_invoice_items',
    'Update an existing record in invoice_items',
    {
      id: z.string().describe('Record UUID to update'),
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      description: z.string().optional(),
      quantity: z.number().min(0).optional(),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      total: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      product_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `products.id`.<fk table='products' column='id'/>"),
      discount_type: z.string().optional(),
      discount_value: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      discount_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      hsn_code: z.string().optional(),
      item_type: z.string().optional(),
      service_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `services.id`.<fk table='services' column='id'/>"),
      timesheet_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `timesheets.id`.<fk table='timesheets' column='id'/>"),
    },
    async (args) => {
      const { id, ...updates } = args;
      // Security: verify the invoice_item belongs to the current user via parent invoice
      const { data: item, error: itemErr } = await supabase
        .from('invoice_items')
        .select('invoice_id')
        .eq('id', id)
        .single();
      if (itemErr || !item) return { content: [{ type: 'text' as const, text: 'Error: invoice_item not found' }] };
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', item.invoice_id)
        .eq('user_id', getUserId())
        .single();
      if (invErr || !inv)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent invoice does not belong to current user' },
          ],
        };
      // If invoice_id is being changed, verify ownership of the new parent too
      if (updates.invoice_id && updates.invoice_id !== item.invoice_id) {
        const { data: newInv, error: newInvErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('id', updates.invoice_id)
          .eq('user_id', getUserId())
          .single();
        if (newInvErr || !newInv)
          return {
            content: [
              { type: 'text' as const, text: 'Error: access denied — target invoice does not belong to current user' },
            ],
          };
      }
      let query = supabase.from('invoice_items').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update invoice item') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated invoice_items record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_invoice_items',
    'Delete a record from invoice_items',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      // Security: verify the invoice_item belongs to the current user via parent invoice
      const { data: item, error: itemErr } = await supabase
        .from('invoice_items')
        .select('invoice_id')
        .eq('id', id)
        .single();
      if (itemErr || !item) return { content: [{ type: 'text' as const, text: 'Error: invoice_item not found' }] };
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', item.invoice_id)
        .eq('user_id', getUserId())
        .single();
      if (invErr || !inv)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent invoice does not belong to current user' },
          ],
        };
      let query = supabase.from('invoice_items').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete invoice item') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from invoice_items' }],
      };
    }
  );

  server.tool(
    'get_invoice_items',
    'Get a single record from invoice_items by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      // Security: verify the invoice_item belongs to the current user via parent invoice
      const { data: item, error: itemErr } = await supabase
        .from('invoice_items')
        .select('*, invoice_id')
        .eq('id', id)
        .single();
      if (itemErr || !item)
        return { content: [{ type: 'text' as const, text: safeError(itemErr || 'not found', 'get invoice item') }] };
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', item.invoice_id)
        .eq('user_id', getUserId())
        .single();
      if (invErr || !inv)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent invoice does not belong to current user' },
          ],
        };
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    }
  );

  server.tool(
    'list_invoice_items',
    'List multiple records from invoice_items',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      // Security: only return invoice_items whose parent invoice belongs to the current user
      const { data: userInvoices, error: invErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', getUserId());
      if (invErr) return { content: [{ type: 'text' as const, text: safeError(invErr, 'list invoice items') }] };
      const invoiceIds = (userInvoices || []).map((i: any) => i.id);
      if (invoiceIds.length === 0) return { content: [{ type: 'text' as const, text: '[]' }] };
      let query = supabase.from('invoice_items').select('*').in('invoice_id', invoiceIds);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list invoice items') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_services',
    'Create a new record in services',
    {
      service_name: z.string(),
      description: z.string().optional(),
      category_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `service_categories.id`.<fk table='service_categories' column='id'/>"
        ),
      pricing_type: z.string(),
      hourly_rate: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      fixed_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      unit: z.string().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('services')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create service') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created services record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_services',
    'Update an existing record in services',
    {
      id: z.string().describe('Record UUID to update'),
      service_name: z.string().optional(),
      description: z.string().optional(),
      category_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `service_categories.id`.<fk table='service_categories' column='id'/>"
        ),
      pricing_type: z.string().optional(),
      hourly_rate: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      fixed_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      unit: z.string().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('services').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update service') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated services record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_services',
    'Delete a record from services',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('services').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete service') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from services' }] };
    }
  );

  server.tool(
    'get_services',
    'Get a single record from services by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('services').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get service') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_services',
    'List multiple records from services',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('services').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list services') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_suppliers',
    'Create a new record in suppliers',
    {
      company_name: z.string(),
      contact_person: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postal_code: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      website: z.string().optional(),
      payment_terms: z.string().optional(),
      supplier_type: z
        .enum(['service', 'product', 'both'])
        .optional()
        .describe("Supplier type: 'service', 'product', or 'both'"),
      status: z.enum(['active', 'inactive']).optional(),
      notes: z.string().optional(),
      tax_id: z.string().optional(),
      currency: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      bic_swift: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('suppliers')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create supplier') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created suppliers record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_suppliers',
    'Update an existing record in suppliers',
    {
      id: z.string().describe('Record UUID to update'),
      company_name: z.string().optional(),
      contact_person: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postal_code: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      website: z.string().optional(),
      payment_terms: z.string().optional(),
      supplier_type: z
        .enum(['service', 'product', 'both'])
        .optional()
        .describe("Supplier type: 'service', 'product', or 'both'"),
      status: z.enum(['active', 'inactive']).optional(),
      notes: z.string().optional(),
      tax_id: z.string().optional(),
      currency: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      bic_swift: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('suppliers').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update supplier') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated suppliers record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_suppliers',
    'Delete a record from suppliers',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('suppliers').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete supplier') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from suppliers' }] };
    }
  );

  server.tool(
    'get_suppliers',
    'Get a single record from suppliers by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('suppliers').select(COLS_SUPPLIERS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get supplier') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_suppliers',
    'List multiple records from suppliers',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('suppliers').select(COLS_SUPPLIERS);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list suppliers') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payment_reminder_rules',
    'Create a new record in payment_reminder_rules',
    {
      name: z.string(),
      days_before_due: z.number().int().optional(),
      days_after_due: z.number().int().optional(),
      max_reminders: z.number().int().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('payment_reminder_rules')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create payment reminder rule') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created payment_reminder_rules record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_payment_reminder_rules',
    'Update an existing record in payment_reminder_rules',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      days_before_due: z.number().int().optional(),
      days_after_due: z.number().int().optional(),
      max_reminders: z.number().int().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('payment_reminder_rules').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update payment reminder rule') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated payment_reminder_rules record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_payment_reminder_rules',
    'Delete a record from payment_reminder_rules',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('payment_reminder_rules').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete payment reminder rule') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payment_reminder_rules' },
        ],
      };
    }
  );

  server.tool(
    'get_payment_reminder_rules',
    'Get a single record from payment_reminder_rules by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('payment_reminder_rules').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get payment reminder rule') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_reminder_rules',
    'List multiple records from payment_reminder_rules',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payment_reminder_rules').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list payment reminder rules') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_quotes',
    'Raw CRUD insert into quotes table. WARNING: does NOT auto-calculate totals/tax. Prefer create_quote (hand-written) for business logic.',
    {
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      quote_number: z.string(),
      date: z.string().optional(),
      status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).optional(),
      total_ht: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      tax_rate: z
        .number()
        .min(0)
        .max(100)
        .multipleOf(0.01)
        .optional()
        .describe('Tax rate as percentage (e.g., 19.25 for 19.25%)'),
      total_ttc: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('quotes')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create quote') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created quotes record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_quotes',
    'Update an existing record in quotes',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      quote_number: z.string().optional(),
      date: z.string().optional(),
      status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).optional(),
      total_ht: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      tax_rate: z
        .number()
        .min(0)
        .max(100)
        .multipleOf(0.01)
        .optional()
        .describe('Tax rate as percentage (e.g., 19.25 for 19.25%)'),
      total_ttc: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('quotes').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update quote') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated quotes record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_quotes',
    'Delete a record from quotes',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('quotes').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete quote') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from quotes' }] };
    }
  );

  server.tool(
    'get_quotes',
    'Get a single record from quotes by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('quotes').select(COLS_QUOTES).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get quote') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_quotes',
    'List multiple records from quotes',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('quotes').select(COLS_QUOTES);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list quotes') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_statements',
    'Create a new record in bank_statements',
    {
      bank_name: z.string().optional(),
      account_number: z.string().optional(),
      statement_date: z.string().optional(),
      period_start: z.string().optional(),
      period_end: z.string().optional(),
      opening_balance: z.number().max(999999999.99).multipleOf(0.01).optional(),
      closing_balance: z.number().max(999999999.99).multipleOf(0.01).optional(),
      file_name: z.string(),
      file_path: z.string(),
      file_type: z.string(),
      file_size: z.number().int().optional(),
      parse_status: z.enum(['pending', 'processing', 'completed', 'error']),
      parse_errors: z.any().optional(),
      line_count: z.number().int().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('bank_statements')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create bank statement') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created bank_statements record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_bank_statements',
    'Update an existing record in bank_statements',
    {
      id: z.string().describe('Record UUID to update'),
      bank_name: z.string().optional(),
      account_number: z.string().optional(),
      statement_date: z.string().optional(),
      period_start: z.string().optional(),
      period_end: z.string().optional(),
      opening_balance: z.number().max(999999999.99).multipleOf(0.01).optional(),
      closing_balance: z.number().max(999999999.99).multipleOf(0.01).optional(),
      file_name: z.string().optional(),
      file_path: z.string().optional(),
      file_type: z.string().optional(),
      file_size: z.number().int().optional(),
      parse_status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
      parse_errors: z.any().optional(),
      line_count: z.number().int().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('bank_statements').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update bank statement') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated bank_statements record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_bank_statements',
    'Delete a record from bank_statements',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_statements').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete bank statement') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_statements' }],
      };
    }
  );

  server.tool(
    'get_bank_statements',
    'Get a single record from bank_statements by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_statements').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get bank statement') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_statements',
    'List multiple records from bank_statements',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_statements').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list bank statements') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_order_items',
    'Create a new record in supplier_order_items',
    {
      order_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `supplier_orders.id`.<fk table='supplier_orders' column='id'/>"),
      service_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `supplier_services.id`.<fk table='supplier_services' column='id'/>"),
      product_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `supplier_products.id`.<fk table='supplier_products' column='id'/>"),
      quantity: z.number().min(0),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01),
      total_price: z.number().min(0).max(999999999.99).multipleOf(0.01),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      // Security: verify the parent supplier_order belongs to the current user
      if (payload.order_id) {
        const { data: order, error: orderErr } = await supabase
          .from('supplier_orders')
          .select('id')
          .eq('id', payload.order_id)
          .eq('user_id', getUserId())
          .single();
        if (orderErr || !order)
          return { content: [{ type: 'text' as const, text: 'Error: supplier_order not found or access denied' }] };
      }
      const { data, error } = await supabase
        .from('supplier_order_items')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create supplier order item') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created supplier_order_items record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_supplier_order_items',
    'Update an existing record in supplier_order_items',
    {
      id: z.string().describe('Record UUID to update'),
      order_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `supplier_orders.id`.<fk table='supplier_orders' column='id'/>"),
      service_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `supplier_services.id`.<fk table='supplier_services' column='id'/>"),
      product_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `supplier_products.id`.<fk table='supplier_products' column='id'/>"),
      quantity: z.number().min(0).optional(),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      total_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      // Security: verify the supplier_order_item belongs to the current user via parent order
      const { data: item, error: itemErr } = await supabase
        .from('supplier_order_items')
        .select('order_id')
        .eq('id', id)
        .single();
      if (itemErr || !item)
        return { content: [{ type: 'text' as const, text: 'Error: supplier_order_item not found' }] };
      const { data: order, error: orderErr } = await supabase
        .from('supplier_orders')
        .select('id')
        .eq('id', item.order_id)
        .eq('user_id', getUserId())
        .single();
      if (orderErr || !order)
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: access denied — parent supplier_order does not belong to current user',
            },
          ],
        };
      // If order_id is being changed, verify ownership of the new parent too
      if (updates.order_id && updates.order_id !== item.order_id) {
        const { data: newOrder, error: newOrderErr } = await supabase
          .from('supplier_orders')
          .select('id')
          .eq('id', updates.order_id)
          .eq('user_id', getUserId())
          .single();
        if (newOrderErr || !newOrder)
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: access denied — target supplier_order does not belong to current user',
              },
            ],
          };
      }
      let query = supabase.from('supplier_order_items').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update supplier order item') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated supplier_order_items record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_supplier_order_items',
    'Delete a record from supplier_order_items',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      // Security: verify the supplier_order_item belongs to the current user via parent order
      const { data: item, error: itemErr } = await supabase
        .from('supplier_order_items')
        .select('order_id')
        .eq('id', id)
        .single();
      if (itemErr || !item)
        return { content: [{ type: 'text' as const, text: 'Error: supplier_order_item not found' }] };
      const { data: order, error: orderErr } = await supabase
        .from('supplier_orders')
        .select('id')
        .eq('id', item.order_id)
        .eq('user_id', getUserId())
        .single();
      if (orderErr || !order)
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: access denied — parent supplier_order does not belong to current user',
            },
          ],
        };
      let query = supabase.from('supplier_order_items').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete supplier order item') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_order_items' }],
      };
    }
  );

  server.tool(
    'get_supplier_order_items',
    'Get a single record from supplier_order_items by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      // Security: verify the supplier_order_item belongs to the current user via parent order
      const { data: item, error: itemErr } = await supabase
        .from('supplier_order_items')
        .select('*, order_id')
        .eq('id', id)
        .single();
      if (itemErr || !item)
        return {
          content: [{ type: 'text' as const, text: safeError(itemErr || 'not found', 'get supplier order item') }],
        };
      const { data: order, error: orderErr } = await supabase
        .from('supplier_orders')
        .select('id')
        .eq('id', item.order_id)
        .eq('user_id', getUserId())
        .single();
      if (orderErr || !order)
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: access denied — parent supplier_order does not belong to current user',
            },
          ],
        };
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_order_items',
    'List multiple records from supplier_order_items',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      // Security: only return supplier_order_items whose parent order belongs to the current user
      const { data: userOrders, error: orderErr } = await supabase
        .from('supplier_orders')
        .select('id')
        .eq('user_id', getUserId());
      if (orderErr)
        return { content: [{ type: 'text' as const, text: safeError(orderErr, 'list supplier order items') }] };
      const orderIds = (userOrders || []).map((o: any) => o.id);
      if (orderIds.length === 0) return { content: [{ type: 'text' as const, text: '[]' }] };
      let query = supabase.from('supplier_order_items').select('*').in('order_id', orderIds);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list supplier order items') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_orders',
    'Create a new record in supplier_orders',
    {
      supplier_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `suppliers.id`.<fk table='suppliers' column='id'/>"),
      order_number: z.string(),
      order_date: z.string().optional(),
      expected_delivery_date: z.string().optional(),
      actual_delivery_date: z.string().optional(),
      order_status: z.enum(['draft', 'pending', 'confirmed', 'delivered', 'received', 'cancelled']).optional(),
      total_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('supplier_orders')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create supplier order') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created supplier_orders record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_supplier_orders',
    'Update an existing record in supplier_orders',
    {
      id: z.string().describe('Record UUID to update'),
      supplier_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `suppliers.id`.<fk table='suppliers' column='id'/>"),
      order_number: z.string().optional(),
      order_date: z.string().optional(),
      expected_delivery_date: z.string().optional(),
      actual_delivery_date: z.string().optional(),
      order_status: z.enum(['draft', 'pending', 'confirmed', 'delivered', 'received', 'cancelled']).optional(),
      total_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('supplier_orders').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update supplier order') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated supplier_orders record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_supplier_orders',
    'Delete a record from supplier_orders',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('supplier_orders').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete supplier order') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_orders' }],
      };
    }
  );

  server.tool(
    'get_supplier_orders',
    'Get a single record from supplier_orders by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('supplier_orders').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get supplier order') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_orders',
    'List multiple records from supplier_orders',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_orders').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list supplier orders') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_service_categories',
    'Create a new record in service_categories',
    {
      name: z.string(),
      description: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('service_categories')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create service category') }] };
      invalidateCache('service_cats:');
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created service_categories record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_service_categories',
    'Update an existing record in service_categories',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      description: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('service_categories').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update service category') }] };
      invalidateCache('service_cats:');
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated service_categories record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_service_categories',
    'Delete a record from service_categories',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('service_categories').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete service category') }] };
      invalidateCache('service_cats:');
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from service_categories' }],
      };
    }
  );

  server.tool(
    'get_service_categories',
    'Get a single record from service_categories by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('service_categories').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get service category') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_service_categories',
    'List multiple records from service_categories',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      const cacheKey = `service_cats:${getUserId()}:${limit}:${offset}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return cached;

      let query = supabase.from('service_categories').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list service categories') }] };
      const result = { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      setCache(cacheKey, result, 300_000);
      return result;
    }
  );

  server.tool(
    'create_company',
    'Create a new record in company',
    {
      company_name: z.string().optional(),
      company_type: z.string().optional(),
      registration_number: z.string().optional(),
      tax_id: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional().describe('Email address (validated but accepts empty string)'),
      website: z.string().optional(),
      logo_url: z.string().optional(),
      bank_account: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      swift: z.string().optional(),
      currency: z.string().optional().describe('ISO 4217 currency code (e.g., EUR, USD, XAF, GBP)'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Strip empty-string optional fields so DB defaults apply
      for (const key of Object.keys(payload)) {
        if (payload[key] === '') delete payload[key];
      }
      payload.user_id = getUserId();
      // company table has no company_id — it IS the company
      delete payload.company_id;
      const { data, error } = await supabase
        .from('company')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create company') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created company record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_company',
    'Update an existing record in company',
    {
      id: z.string().describe('Record UUID to update'),
      company_name: z.string().optional(),
      company_type: z.string().optional(),
      registration_number: z.string().optional(),
      tax_id: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional().describe('Email address (validated but accepts empty string)'),
      website: z.string().optional(),
      logo_url: z.string().optional(),
      bank_account: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      swift: z.string().optional(),
      currency: z.string().optional().describe('ISO 4217 currency code (e.g., EUR, USD, XAF, GBP)'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Strip empty-string optional fields so they don't overwrite existing data
      for (const key of Object.keys(updates)) {
        if ((updates as Record<string, any>)[key] === '') delete (updates as Record<string, any>)[key];
      }
      let query = supabase.from('company').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update company') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated company record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_company',
    'Delete a record from company',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('company').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete company') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from company' }] };
    }
  );

  server.tool(
    'get_company',
    'Get a single record from company by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('company').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get company') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_company',
    'List multiple records from company',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('company').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list companies') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_transactions',
    'Create a new record in bank_transactions',
    {
      bank_connection_id: z
        .string()
        .describe("Note: This is a Foreign Key to `bank_connections.id`.<fk table='bank_connections' column='id'/>"),
      external_id: z.string().optional(),
      date: z.string(),
      booking_date: z.string().optional(),
      value_date: z.string().optional(),
      amount: z.number().max(999999999.99).multipleOf(0.01),
      currency: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      creditor_name: z.string().optional(),
      debtor_name: z.string().optional(),
      remittance_info: z.string().optional(),
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      reconciliation_status: z.enum(['unreconciled', 'matched', 'ignored']).optional(),
      match_confidence: z.number().min(0).max(1).optional(),
      matched_at: z.string().optional(),
      raw_data: z.any().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('bank_transactions')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create bank transaction') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created bank_transactions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_bank_transactions',
    'Update an existing record in bank_transactions',
    {
      id: z.string().describe('Record UUID to update'),
      bank_connection_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `bank_connections.id`.<fk table='bank_connections' column='id'/>"),
      external_id: z.string().optional(),
      date: z.string().optional(),
      booking_date: z.string().optional(),
      value_date: z.string().optional(),
      amount: z.number().max(999999999.99).multipleOf(0.01).optional(),
      currency: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      creditor_name: z.string().optional(),
      debtor_name: z.string().optional(),
      remittance_info: z.string().optional(),
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      reconciliation_status: z.enum(['unreconciled', 'matched', 'ignored']).optional(),
      match_confidence: z.number().min(0).max(1).optional(),
      matched_at: z.string().optional(),
      raw_data: z.any().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('bank_transactions').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update bank transaction') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated bank_transactions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_bank_transactions',
    'Delete a record from bank_transactions',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_transactions').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete bank transaction') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_transactions' }],
      };
    }
  );

  server.tool(
    'get_bank_transactions',
    'Get a single record from bank_transactions by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_transactions').select(COLS_BANK_TRANSACTIONS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get bank transaction') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_transactions',
    'List multiple records from bank_transactions',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_transactions').select(COLS_BANK_TRANSACTIONS);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list bank transactions') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payment_terms',
    'Create a new record in payment_terms',
    {
      name: z.string(),
      days: z.number().int(),
      description: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('payment_terms')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create payment term') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created payment_terms record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_payment_terms',
    'Update an existing record in payment_terms',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      days: z.number().int().optional(),
      description: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('payment_terms').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update payment term') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated payment_terms record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_payment_terms',
    'Delete a record from payment_terms',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('payment_terms').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete payment term') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payment_terms' }],
      };
    }
  );

  server.tool(
    'get_payment_terms',
    'Get a single record from payment_terms by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('payment_terms').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get payment term') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_terms',
    'List multiple records from payment_terms',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payment_terms').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list payment terms') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_credit_notes',
    'Raw CRUD insert into credit_notes table. WARNING: does NOT validate invoice or calculate refund. Prefer create_credit_note (hand-written) for business logic.',
    {
      credit_note_number: z.string(),
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      date: z.string(),
      reason: z.string().optional(),
      total_ht: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      tax_rate: z
        .number()
        .min(0)
        .max(100)
        .multipleOf(0.01)
        .optional()
        .describe('Tax rate as percentage (e.g., 19.25 for 19.25%)'),
      tax_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      total_ttc: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      status: z.enum(['draft', 'sent', 'applied', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('credit_notes')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create credit note') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created credit_notes record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_credit_notes',
    'Update an existing record in credit_notes',
    {
      id: z.string().describe('Record UUID to update'),
      credit_note_number: z.string().optional(),
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      date: z.string().optional(),
      reason: z.string().optional(),
      total_ht: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      tax_rate: z
        .number()
        .min(0)
        .max(100)
        .multipleOf(0.01)
        .optional()
        .describe('Tax rate as percentage (e.g., 19.25 for 19.25%)'),
      tax_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      total_ttc: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      status: z.enum(['draft', 'sent', 'applied', 'cancelled']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('credit_notes').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update credit note') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated credit_notes record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_credit_notes',
    'Delete a record from credit_notes',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('credit_notes').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete credit note') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from credit_notes' }] };
    }
  );

  server.tool(
    'get_credit_notes',
    'Get a single record from credit_notes by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('credit_notes').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get credit note') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_credit_notes',
    'List multiple records from credit_notes',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('credit_notes').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list credit notes') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_reconciliation_sessions',
    'Create a new record in bank_reconciliation_sessions',
    {
      statement_id: z
        .string()
        .describe("Note: This is a Foreign Key to `bank_statements.id`.<fk table='bank_statements' column='id'/>"),
      session_date: z.string().optional(),
      status: z.enum(['in_progress', 'completed', 'abandoned']),
      total_lines: z.number().int().optional(),
      matched_lines: z.number().int().optional(),
      unmatched_lines: z.number().int().optional(),
      ignored_lines: z.number().int().optional(),
      total_credits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      total_debits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      matched_credits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      matched_debits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      difference: z.number().max(999999999.99).multipleOf(0.01).optional(),
      completed_at: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('bank_reconciliation_sessions')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create bank reconciliation session') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created bank_reconciliation_sessions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_bank_reconciliation_sessions',
    'Update an existing record in bank_reconciliation_sessions',
    {
      id: z.string().describe('Record UUID to update'),
      statement_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `bank_statements.id`.<fk table='bank_statements' column='id'/>"),
      session_date: z.string().optional(),
      status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
      total_lines: z.number().int().optional(),
      matched_lines: z.number().int().optional(),
      unmatched_lines: z.number().int().optional(),
      ignored_lines: z.number().int().optional(),
      total_credits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      total_debits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      matched_credits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      matched_debits: z.number().max(999999999.99).multipleOf(0.01).optional(),
      difference: z.number().max(999999999.99).multipleOf(0.01).optional(),
      completed_at: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('bank_reconciliation_sessions').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update bank reconciliation session') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated bank_reconciliation_sessions record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_bank_reconciliation_sessions',
    'Delete a record from bank_reconciliation_sessions',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_reconciliation_sessions').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete bank reconciliation session') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_reconciliation_sessions' },
        ],
      };
    }
  );

  server.tool(
    'get_bank_reconciliation_sessions',
    'Get a single record from bank_reconciliation_sessions by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_reconciliation_sessions').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get bank reconciliation session') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_reconciliation_sessions',
    'List multiple records from bank_reconciliation_sessions',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_reconciliation_sessions').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list bank reconciliation sessions') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_expenses',
    'Raw CRUD insert into expenses table. WARNING: does NOT auto-calculate HT/TVA from TTC. Prefer create_expense (hand-written) for business logic.',
    {
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      amount: z.number().min(0).max(999999999.99).multipleOf(0.01),
      category: z.string().optional(),
      description: z.string().optional(),
      receipt_url: z.string().optional(),
      refacturable: z.boolean().optional(),
      tax_rate: z
        .number()
        .min(0)
        .max(100)
        .multipleOf(0.01)
        .optional()
        .describe('Tax rate as decimal (e.g., 0.1925 for 19.25%)'),
      amount_ht: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      tax_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      expense_date: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('expenses')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create expense') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created expenses record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_expenses',
    'Update an existing record in expenses',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      receipt_url: z.string().optional(),
      refacturable: z.boolean().optional(),
      tax_rate: z
        .number()
        .min(0)
        .max(100)
        .multipleOf(0.01)
        .optional()
        .describe('Tax rate as decimal (e.g., 0.1925 for 19.25%)'),
      amount_ht: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      tax_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      expense_date: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('expenses').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update expense') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated expenses record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_expenses',
    'Delete a record from expenses',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('expenses').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete expense') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from expenses' }] };
    }
  );

  server.tool(
    'get_expenses',
    'Get a single record from expenses by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('expenses').select(COLS_EXPENSES).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get expense') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_expenses',
    'List multiple records from expenses',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('expenses').select(COLS_EXPENSES);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list expenses') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_receivables',
    'Create a new record in receivables',
    {
      debtor_name: z.string(),
      debtor_phone: z.string().optional(),
      debtor_email: z.string().email().optional(),
      description: z.string().optional(),
      amount: z.number().min(0).max(999999999.99).multipleOf(0.01),
      amount_paid: z.number().min(0).max(999999999.99).multipleOf(0.01),
      currency: z.string(),
      date_lent: z.string(),
      due_date: z.string().optional(),
      status: z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled']),
      category: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('receivables')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create receivable') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created receivables record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_receivables',
    'Update an existing record in receivables',
    {
      id: z.string().describe('Record UUID to update'),
      debtor_name: z.string().optional(),
      debtor_phone: z.string().optional(),
      debtor_email: z.string().email().optional(),
      description: z.string().optional(),
      amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      amount_paid: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      currency: z.string().optional(),
      date_lent: z.string().optional(),
      due_date: z.string().optional(),
      status: z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled']).optional(),
      category: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('receivables').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update receivable') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated receivables record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_receivables',
    'Delete a record from receivables',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('receivables').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete receivable') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from receivables' }] };
    }
  );

  server.tool(
    'get_receivables',
    'Get a single record from receivables by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('receivables').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get receivable') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_receivables',
    'List multiple records from receivables',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('receivables').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list receivables') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_statement_lines',
    'Create a new record in bank_statement_lines',
    {
      statement_id: z
        .string()
        .describe("Note: This is a Foreign Key to `bank_statements.id`.<fk table='bank_statements' column='id'/>"),
      line_number: z.number().int().optional(),
      transaction_date: z.string(),
      value_date: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      amount: z.number().max(999999999.99).multipleOf(0.01),
      balance_after: z.number().max(999999999.99).multipleOf(0.01).optional(),
      raw_data: z.any().optional(),
      reconciliation_status: z.enum(['unmatched', 'matched', 'ignored']),
      matched_source_type: z.string().optional(),
      matched_source_id: z.string().optional(),
      matched_at: z.string().optional(),
      matched_by: z.string().optional(),
      match_confidence: z.number().min(0).max(1).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create bank statement line') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created bank_statement_lines record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_bank_statement_lines',
    'Update an existing record in bank_statement_lines',
    {
      id: z.string().describe('Record UUID to update'),
      statement_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `bank_statements.id`.<fk table='bank_statements' column='id'/>"),
      line_number: z.number().int().optional(),
      transaction_date: z.string().optional(),
      value_date: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      amount: z.number().max(999999999.99).multipleOf(0.01).optional(),
      balance_after: z.number().max(999999999.99).multipleOf(0.01).optional(),
      raw_data: z.any().optional(),
      reconciliation_status: z.enum(['unmatched', 'matched', 'ignored']).optional(),
      matched_source_type: z.string().optional(),
      matched_source_id: z.string().optional(),
      matched_at: z.string().optional(),
      matched_by: z.string().optional(),
      match_confidence: z.number().min(0).max(1).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('bank_statement_lines').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update bank statement line') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated bank_statement_lines record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_bank_statement_lines',
    'Delete a record from bank_statement_lines',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_statement_lines').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete bank statement line') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_statement_lines' }],
      };
    }
  );

  server.tool(
    'get_bank_statement_lines',
    'Get a single record from bank_statement_lines by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('bank_statement_lines').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get bank statement line') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_statement_lines',
    'List multiple records from bank_statement_lines',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_statement_lines').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list bank statement lines') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_accounting_tax_rates',
    'Create a new record in accounting_tax_rates',
    {
      account_code: z.string().optional(),
      is_active: z.boolean().optional(),
      effective_date: z.string().optional(),
      name: z.string().optional(),
      rate: z.number().min(0).max(100).multipleOf(0.01).optional(),
      tax_type: z.string().optional(),
      is_default: z.boolean().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('accounting_tax_rates')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create accounting tax rate') }] };
      invalidateCache('tax_rates:');
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created accounting_tax_rates record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_accounting_tax_rates',
    'Update an existing record in accounting_tax_rates',
    {
      id: z.string().describe('Record UUID to update'),
      account_code: z.string().optional(),
      is_active: z.boolean().optional(),
      effective_date: z.string().optional(),
      name: z.string().optional(),
      rate: z.number().min(0).max(100).multipleOf(0.01).optional(),
      tax_type: z.string().optional(),
      is_default: z.boolean().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('accounting_tax_rates').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update accounting tax rate') }] };
      invalidateCache('tax_rates:');
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated accounting_tax_rates record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_accounting_tax_rates',
    'Delete a record from accounting_tax_rates',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('accounting_tax_rates').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete accounting tax rate') }] };
      invalidateCache('tax_rates:');
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from accounting_tax_rates' }],
      };
    }
  );

  server.tool(
    'get_accounting_tax_rates',
    'Get a single record from accounting_tax_rates by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('accounting_tax_rates').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get accounting tax rate') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_accounting_tax_rates',
    'List multiple records from accounting_tax_rates',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      const cacheKey = `tax_rates:${getUserId()}:${limit}:${offset}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return cached;

      let query = supabase.from('accounting_tax_rates').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list accounting tax rates') }] };
      const result = { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      setCache(cacheKey, result, 300_000);
      return result;
    }
  );

  server.tool(
    'create_recurring_invoices',
    'Create a new record in recurring_invoices',
    {
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      frequency: z.string().optional(),
      next_date: z.string().optional(),
      status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('recurring_invoices')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create recurring invoice') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created recurring_invoices record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_recurring_invoices',
    'Update an existing record in recurring_invoices',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      frequency: z.string().optional(),
      next_date: z.string().optional(),
      status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('recurring_invoices').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update recurring invoice') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated recurring_invoices record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_recurring_invoices',
    'Delete a record from recurring_invoices',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('recurring_invoices').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete recurring invoice') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from recurring_invoices' }],
      };
    }
  );

  server.tool(
    'get_recurring_invoices',
    'Get a single record from recurring_invoices by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('recurring_invoices').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get recurring invoice') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_recurring_invoices',
    'List multiple records from recurring_invoices',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('recurring_invoices').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list recurring invoices') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_purchase_orders',
    'Create a new record in purchase_orders',
    {
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      po_number: z.string(),
      date: z.string().optional(),
      due_date: z.string().optional(),
      items: z.any().optional(),
      total: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      status: z.enum(['draft', 'sent', 'confirmed', 'completed', 'cancelled']).optional(),
      payment_terms_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `payment_terms.id`.<fk table='payment_terms' column='id'/>"),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create purchase order') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created purchase_orders record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_purchase_orders',
    'Update an existing record in purchase_orders',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      po_number: z.string().optional(),
      date: z.string().optional(),
      due_date: z.string().optional(),
      items: z.any().optional(),
      total: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      status: z.enum(['draft', 'sent', 'confirmed', 'completed', 'cancelled']).optional(),
      payment_terms_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `payment_terms.id`.<fk table='payment_terms' column='id'/>"),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('purchase_orders').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update purchase order') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated purchase_orders record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_purchase_orders',
    'Delete a record from purchase_orders',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('purchase_orders').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete purchase order') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from purchase_orders' }],
      };
    }
  );

  server.tool(
    'get_purchase_orders',
    'Get a single record from purchase_orders by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('purchase_orders').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get purchase order') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_purchase_orders',
    'List multiple records from purchase_orders',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('purchase_orders').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list purchase orders') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_invoice_settings',
    'Create a new record in invoice_settings',
    {
      template_id: z.string().optional(),
      color_theme: z.string().optional(),
      custom_labels: z.any().optional(),
      show_logo: z.boolean().optional(),
      show_bank_details: z.boolean().optional(),
      show_payment_terms: z.boolean().optional(),
      footer_text: z.string().optional(),
      font_family: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('invoice_settings')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create invoice settings') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created invoice_settings record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_invoice_settings',
    'Update an existing record in invoice_settings',
    {
      id: z.string().describe('Record UUID to update'),
      template_id: z.string().optional(),
      color_theme: z.string().optional(),
      custom_labels: z.any().optional(),
      show_logo: z.boolean().optional(),
      show_bank_details: z.boolean().optional(),
      show_payment_terms: z.boolean().optional(),
      footer_text: z.string().optional(),
      font_family: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('invoice_settings').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update invoice settings') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated invoice_settings record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_invoice_settings',
    'Delete a record from invoice_settings',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('invoice_settings').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete invoice settings') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from invoice_settings' }],
      };
    }
  );

  server.tool(
    'get_invoice_settings',
    'Get a single record from invoice_settings by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('invoice_settings').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get invoice settings') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_invoice_settings',
    'List multiple records from invoice_settings',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('invoice_settings').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list invoice settings') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // PRODUCTS CRUD
  // ============================================================

  server.tool(
    'create_products',
    'Create a new record in products',
    {
      product_name: z.string(),
      sku: z.string().optional(),
      category_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `service_categories.id`.<fk table='service_categories' column='id'/>"
        ),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      purchase_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      unit: z.string().optional(),
      stock_quantity: z.number().min(0).optional(),
      min_stock_level: z.number().min(0).optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      supplier_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `suppliers.id`.<fk table='suppliers' column='id'/>"),
      company_id: z.string().optional().describe('Company UUID for multi-company scope'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: if supplier_id is provided, verify the supplier belongs to the current user
      if (payload.supplier_id) {
        const { data: sup, error: supErr } = await supabase
          .from('suppliers')
          .select('id')
          .eq('id', payload.supplier_id)
          .eq('user_id', getUserId())
          .single();
        if (supErr || !sup)
          return { content: [{ type: 'text' as const, text: 'Error: supplier not found or access denied' }] };
      }
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('products')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create product') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created products record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_products',
    'Update an existing record in products',
    {
      id: z.string().describe('Record UUID to update'),
      product_name: z.string().optional(),
      sku: z.string().optional(),
      category_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `service_categories.id`.<fk table='service_categories' column='id'/>"
        ),
      unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      purchase_price: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      unit: z.string().optional(),
      stock_quantity: z.number().min(0).optional(),
      min_stock_level: z.number().min(0).optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      supplier_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `suppliers.id`.<fk table='suppliers' column='id'/>"),
      company_id: z.string().optional().describe('Company UUID for multi-company scope'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: if supplier_id is being set/changed, verify the supplier belongs to the current user
      if (updates.supplier_id) {
        const { data: sup, error: supErr } = await supabase
          .from('suppliers')
          .select('id')
          .eq('id', updates.supplier_id)
          .eq('user_id', getUserId())
          .single();
        if (supErr || !sup)
          return { content: [{ type: 'text' as const, text: 'Error: supplier not found or access denied' }] };
      }
      let query = supabase.from('products').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update product') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated products record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_products',
    'Delete a record from products',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('products').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete product') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from products' }] };
    }
  );

  server.tool(
    'get_products',
    'Get a single record from products by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('products').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get product') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_products',
    'List multiple records from products',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('products').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list products') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // TIMESHEETS CRUD
  // ============================================================

  server.tool(
    'create_timesheets',
    'Create a new record in timesheets',
    {
      task_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `tasks.id`.<fk table='tasks' column='id'/>"),
      project_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `projects.id`.<fk table='projects' column='id'/>"),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      date: z.string().describe('Date of the timesheet entry (YYYY-MM-DD)'),
      start_time: z.string().optional().describe('Start time (HH:MM:SS)'),
      end_time: z.string().optional().describe('End time (HH:MM:SS)'),
      duration_minutes: z.number().optional(),
      description: z.string().optional(),
      status: z.enum(['draft', 'approved', 'billed', 'rejected']).optional(),
      notes: z.string().optional(),
      billable: z.boolean().optional(),
      hourly_rate: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      billed_at: z.string().optional(),
      service_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `services.id`.<fk table='services' column='id'/>"),
      company_id: z.string().describe('Company UUID for multi-company scope'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: if project_id is provided, verify the project belongs to the current user
      if (payload.project_id) {
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id')
          .eq('id', payload.project_id)
          .eq('user_id', getUserId())
          .single();
        if (projErr || !proj)
          return { content: [{ type: 'text' as const, text: 'Error: project not found or access denied' }] };
      }
      // Security: if client_id is provided, verify the client belongs to the current user
      if (payload.client_id) {
        const { data: cli, error: cliErr } = await supabase
          .from('clients')
          .select('id')
          .eq('id', payload.client_id)
          .eq('user_id', getUserId())
          .single();
        if (cliErr || !cli)
          return { content: [{ type: 'text' as const, text: 'Error: client not found or access denied' }] };
      }
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('timesheets')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create timesheet') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created timesheets record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_timesheets',
    'Update an existing record in timesheets',
    {
      id: z.string().describe('Record UUID to update'),
      task_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `tasks.id`.<fk table='tasks' column='id'/>"),
      project_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `projects.id`.<fk table='projects' column='id'/>"),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      date: z.string().optional().describe('Date of the timesheet entry (YYYY-MM-DD)'),
      start_time: z.string().optional().describe('Start time (HH:MM:SS)'),
      end_time: z.string().optional().describe('End time (HH:MM:SS)'),
      duration_minutes: z.number().optional(),
      description: z.string().optional(),
      status: z.enum(['draft', 'approved', 'billed', 'rejected']).optional(),
      notes: z.string().optional(),
      billable: z.boolean().optional(),
      hourly_rate: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      invoice_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `invoices.id`.<fk table='invoices' column='id'/>"),
      billed_at: z.string().optional(),
      service_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `services.id`.<fk table='services' column='id'/>"),
      company_id: z.string().optional().describe('Company UUID for multi-company scope'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: if project_id is being set/changed, verify the project belongs to the current user
      if (updates.project_id) {
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id')
          .eq('id', updates.project_id)
          .eq('user_id', getUserId())
          .single();
        if (projErr || !proj)
          return { content: [{ type: 'text' as const, text: 'Error: project not found or access denied' }] };
      }
      // Security: if client_id is being set/changed, verify the client belongs to the current user
      if (updates.client_id) {
        const { data: cli, error: cliErr } = await supabase
          .from('clients')
          .select('id')
          .eq('id', updates.client_id)
          .eq('user_id', getUserId())
          .single();
        if (cliErr || !cli)
          return { content: [{ type: 'text' as const, text: 'Error: client not found or access denied' }] };
      }
      let query = supabase.from('timesheets').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update timesheet') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated timesheets record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_timesheets',
    'Delete a record from timesheets',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('timesheets').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete timesheet') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from timesheets' }] };
    }
  );

  server.tool(
    'get_timesheets',
    'Get a single record from timesheets by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('timesheets').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get timesheet') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_timesheets',
    'List multiple records from timesheets',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('timesheets').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list timesheets') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ============================================================
  // PROJECTS CRUD
  // ============================================================

  server.tool(
    'create_projects',
    'Create a new record in projects',
    {
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      name: z.string(),
      description: z.string().optional(),
      budget_hours: z.number().min(0).optional(),
      hourly_rate: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
      start_date: z.string().optional().describe('Project start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('Project end date (YYYY-MM-DD)'),
      company_id: z.string().describe('Company UUID for multi-company scope'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('projects')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create project') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully created projects record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_projects',
    'Update an existing record in projects',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `clients.id`.<fk table='clients' column='id'/>"),
      name: z.string().optional(),
      description: z.string().optional(),
      budget_hours: z.number().min(0).optional(),
      hourly_rate: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
      start_date: z.string().optional().describe('Project start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('Project end date (YYYY-MM-DD)'),
      company_id: z.string().optional().describe('Company UUID for multi-company scope'),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('projects').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update project') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully updated projects record:\n' + JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_projects',
    'Delete a record from projects',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('projects').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete project') }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from projects' }] };
    }
  );

  server.tool(
    'get_projects',
    'Get a single record from projects by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('projects').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get project') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_projects',
    'List multiple records from projects',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('projects').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list projects') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── dunning_steps CRUD ──

  server.tool(
    'create_dunning_steps',
    'Create a new dunning step (payment follow-up configuration)',
    {
      company_id: z.string().describe('Company UUID'),
      name: z.string().describe('Step name (e.g. First reminder)'),
      days_after_due: z.number().optional().describe('Days after due date to trigger (default 7)'),
      email_subject: z.string().optional().describe('Email subject template'),
      email_body: z.string().optional().describe('Email body template'),
      is_active: z.boolean().optional().describe('Whether this step is active (default true)'),
      step_order: z.number().optional().describe('Order of this step in the dunning sequence (default 1)'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('dunning_steps')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create dunning step') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created dunning_steps record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_dunning_steps',
    'Update an existing dunning step',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      days_after_due: z.number().optional(),
      email_subject: z.string().optional(),
      email_body: z.string().optional(),
      is_active: z.boolean().optional(),
      step_order: z.number().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('dunning_steps').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update dunning step') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated dunning_steps record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_dunning_steps',
    'Delete a dunning step',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('dunning_steps').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete dunning step') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from dunning_steps' }],
      };
    }
  );

  server.tool(
    'get_dunning_steps',
    'Get a single dunning step by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('dunning_steps').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get dunning step') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_dunning_steps',
    'List dunning steps with optional filters',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('dunning_steps').select('*');
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      query = query.order('step_order', { ascending: true });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list dunning steps') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── dunning_history CRUD ──

  server.tool(
    'create_dunning_history',
    'Record a dunning action (payment follow-up sent to a client)',
    {
      invoice_id: z.string().describe('Invoice UUID'),
      dunning_step_id: z.string().optional().describe('Dunning step UUID used'),
      sent_at: z.string().optional().describe('When the dunning was sent (ISO timestamp, default now)'),
      method: z.enum(['email', 'sms', 'letter']).optional().describe('Communication method (default email)'),
      status: z.enum(['sent', 'delivered', 'failed', 'responded']).optional().describe('Status (default sent)'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('dunning_history')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create dunning history') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created dunning_history record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_dunning_history',
    'Update an existing dunning history record',
    {
      id: z.string().describe('Record UUID to update'),
      status: z.enum(['sent', 'delivered', 'failed', 'responded']).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('dunning_history').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update dunning history') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated dunning_history record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_dunning_history',
    'Delete a dunning history record',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('dunning_history').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete dunning history') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from dunning_history' }],
      };
    }
  );

  server.tool(
    'get_dunning_history',
    'Get a single dunning history record by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase
        .from('dunning_history')
        .select('*, dunning_step:dunning_steps(id, name, step_order)')
        .eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get dunning history') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_dunning_history',
    'List dunning history records with optional filters',
    {
      invoice_id: z.string().optional().describe('Filter by invoice UUID'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ invoice_id, limit = 50, offset = 0 }) => {
      let query = supabase.from('dunning_history').select('*, dunning_step:dunning_steps(id, name, step_order)');
      query = query.eq('user_id', getUserId());
      if (invoice_id) query = query.eq('invoice_id', invoice_id);
      query = query.order('sent_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list dunning history') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── company_portfolios CRUD ──

  server.tool(
    'create_company_portfolios',
    'Create a new record in company_portfolios',
    {
      portfolio_name: z.string(),
      description: z.string().optional(),
      base_currency: z.string().optional(),
      is_default: z.boolean().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('company_portfolios')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create company portfolio') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created company_portfolios record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_company_portfolios',
    'Update an existing record in company_portfolios',
    {
      id: z.string().describe('Record UUID to update'),
      portfolio_name: z.string().optional(),
      description: z.string().optional(),
      base_currency: z.string().optional(),
      is_default: z.boolean().optional(),
      is_active: z.boolean().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('company_portfolios').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update company portfolio') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated company_portfolios record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_company_portfolios',
    'Delete a record from company_portfolios',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('company_portfolios').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete company portfolio') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from company_portfolios' }],
      };
    }
  );

  server.tool(
    'get_company_portfolios',
    'Get a single record from company_portfolios by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('company_portfolios').select(COLS_COMPANY_PORTFOLIOS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get company portfolio') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_company_portfolios',
    'List multiple records from company_portfolios',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('company_portfolios').select(COLS_COMPANY_PORTFOLIOS);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list company portfolios') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── company_portfolio_members CRUD ──

  server.tool(
    'create_company_portfolio_members',
    'Create a new record in company_portfolio_members',
    {
      portfolio_id: z
        .string()
        .describe(
          "Note: This is a Foreign Key to `company_portfolios.id`.<fk table='company_portfolios' column='id'/>"
        ),
      company_id: z.string().describe("Note: This is a Foreign Key to `company.id`.<fk table='company' column='id'/>"),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('company_portfolio_members')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create company portfolio member') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created company_portfolio_members record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_company_portfolio_members',
    'Update an existing record in company_portfolio_members',
    {
      id: z.string().describe('Record UUID to update'),
      portfolio_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `company_portfolios.id`.<fk table='company_portfolios' column='id'/>"
        ),
      company_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `company.id`.<fk table='company' column='id'/>"),
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('company_portfolio_members').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update company portfolio member') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated company_portfolio_members record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_company_portfolio_members',
    'Delete a record from company_portfolio_members',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('company_portfolio_members').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete company portfolio member') }] };
      return {
        content: [
          { type: 'text' as const, text: 'Successfully deleted record ' + id + ' from company_portfolio_members' },
        ],
      };
    }
  );

  server.tool(
    'get_company_portfolio_members',
    'Get a single record from company_portfolio_members by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('company_portfolio_members').select(COLS_COMPANY_PORTFOLIO_MEMBERS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get company portfolio member') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_company_portfolio_members',
    'List multiple records from company_portfolio_members',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('company_portfolio_members').select(COLS_COMPANY_PORTFOLIO_MEMBERS);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list company portfolio members') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── payment_instrument_bank_accounts CRUD (PK = instrument_id, no direct user_id) ──

  server.tool(
    'create_payment_instrument_bank_accounts',
    'Create a new record in payment_instrument_bank_accounts',
    {
      instrument_id: z
        .string()
        .describe(
          "Note: This is a Foreign Key to `company_payment_instruments.id`.<fk table='company_payment_instruments' column='id'/>"
        ),
      bank_connection_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `bank_connections.id`.<fk table='bank_connections' column='id'/>"),
      bank_name: z.string().optional(),
      account_holder: z.string().optional(),
      iban_masked: z.string().optional(),
      bic_swift: z.string().optional(),
      account_number_masked: z.string().optional(),
      institution_country: z.string().optional(),
      account_kind: z.string().optional(),
      statement_import_enabled: z.boolean().optional(),
      api_sync_enabled: z.boolean().optional(),
      last_sync_at: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', payload.instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [{ type: 'text' as const, text: 'Error: company_payment_instrument not found or access denied' }],
        };
      const { data, error } = await supabase
        .from('payment_instrument_bank_accounts')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'create payment instrument bank account') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created payment_instrument_bank_accounts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_payment_instrument_bank_accounts',
    'Update an existing record in payment_instrument_bank_accounts',
    {
      instrument_id: z.string().describe('Instrument UUID to update (PK)'),
      bank_connection_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `bank_connections.id`.<fk table='bank_connections' column='id'/>"),
      bank_name: z.string().optional(),
      account_holder: z.string().optional(),
      iban_masked: z.string().optional(),
      bic_swift: z.string().optional(),
      account_number_masked: z.string().optional(),
      institution_country: z.string().optional(),
      account_kind: z.string().optional(),
      statement_import_enabled: z.boolean().optional(),
      api_sync_enabled: z.boolean().optional(),
      last_sync_at: z.string().optional(),
    },
    async (args) => {
      const { instrument_id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_instrument_bank_accounts')
        .update(sanitizeRecord(updates))
        .eq('instrument_id', instrument_id)
        .select()
        .single();
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'update payment instrument bank account') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated payment_instrument_bank_accounts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_payment_instrument_bank_accounts',
    'Delete a record from payment_instrument_bank_accounts',
    {
      instrument_id: z.string().describe('Instrument UUID to delete (PK)'),
    },
    async ({ instrument_id }) => {
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { error } = await supabase
        .from('payment_instrument_bank_accounts')
        .delete()
        .eq('instrument_id', instrument_id);
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'delete payment instrument bank account') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully deleted record ' + instrument_id + ' from payment_instrument_bank_accounts',
          },
        ],
      };
    }
  );

  server.tool(
    'get_payment_instrument_bank_accounts',
    'Get a single record from payment_instrument_bank_accounts by instrument_id',
    {
      instrument_id: z.string().describe('Instrument UUID to fetch (PK)'),
    },
    async ({ instrument_id }) => {
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_instrument_bank_accounts')
        .select(COLS_PAYMENT_INSTRUMENT_BANK_ACCOUNTS)
        .eq('instrument_id', instrument_id)
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get payment instrument bank account') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_instrument_bank_accounts',
    'List multiple records from payment_instrument_bank_accounts',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      // Security: only return records whose parent instrument belongs to the current user
      const { data: userInstruments, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('user_id', getUserId());
      if (instErr)
        return {
          content: [{ type: 'text' as const, text: safeError(instErr, 'list payment instrument bank accounts') }],
        };
      const instrumentIds = (userInstruments || []).map((i: any) => i.id);
      if (instrumentIds.length === 0) return { content: [{ type: 'text' as const, text: '[]' }] };
      let query = supabase
        .from('payment_instrument_bank_accounts')
        .select(COLS_PAYMENT_INSTRUMENT_BANK_ACCOUNTS)
        .in('instrument_id', instrumentIds);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'list payment instrument bank accounts') }],
        };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── payment_instrument_cards CRUD (PK = instrument_id, no direct user_id) ──

  server.tool(
    'create_payment_instrument_cards',
    'Create a new record in payment_instrument_cards',
    {
      instrument_id: z
        .string()
        .describe(
          "Note: This is a Foreign Key to `company_payment_instruments.id`.<fk table='company_payment_instruments' column='id'/>"
        ),
      card_brand: z.string().optional(),
      card_type: z.string().optional(),
      holder_name: z.string().optional(),
      last4: z.string().optional(),
      expiry_month: z.number().min(1).max(12).optional(),
      expiry_year: z.number().optional(),
      issuer_name: z.string().optional(),
      billing_cycle_day: z.number().min(1).max(31).optional(),
      statement_due_day: z.number().min(1).max(31).optional(),
      credit_limit: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      available_credit: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      network_token: z.string().optional(),
      is_virtual: z.boolean().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', payload.instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [{ type: 'text' as const, text: 'Error: company_payment_instrument not found or access denied' }],
        };
      const { data, error } = await supabase
        .from('payment_instrument_cards')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'create payment instrument card') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created payment_instrument_cards record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_payment_instrument_cards',
    'Update an existing record in payment_instrument_cards',
    {
      instrument_id: z.string().describe('Instrument UUID to update (PK)'),
      card_brand: z.string().optional(),
      card_type: z.string().optional(),
      holder_name: z.string().optional(),
      last4: z.string().optional(),
      expiry_month: z.number().min(1).max(12).optional(),
      expiry_year: z.number().optional(),
      issuer_name: z.string().optional(),
      billing_cycle_day: z.number().min(1).max(31).optional(),
      statement_due_day: z.number().min(1).max(31).optional(),
      credit_limit: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      available_credit: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      network_token: z.string().optional(),
      is_virtual: z.boolean().optional(),
    },
    async (args) => {
      const { instrument_id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_instrument_cards')
        .update(sanitizeRecord(updates))
        .eq('instrument_id', instrument_id)
        .select()
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'update payment instrument card') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated payment_instrument_cards record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_payment_instrument_cards',
    'Delete a record from payment_instrument_cards',
    {
      instrument_id: z.string().describe('Instrument UUID to delete (PK)'),
    },
    async ({ instrument_id }) => {
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { error } = await supabase.from('payment_instrument_cards').delete().eq('instrument_id', instrument_id);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'delete payment instrument card') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully deleted record ' + instrument_id + ' from payment_instrument_cards',
          },
        ],
      };
    }
  );

  server.tool(
    'get_payment_instrument_cards',
    'Get a single record from payment_instrument_cards by instrument_id',
    {
      instrument_id: z.string().describe('Instrument UUID to fetch (PK)'),
    },
    async ({ instrument_id }) => {
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_instrument_cards')
        .select(COLS_PAYMENT_INSTRUMENT_CARDS)
        .eq('instrument_id', instrument_id)
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get payment instrument card') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_instrument_cards',
    'List multiple records from payment_instrument_cards',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      // Security: only return records whose parent instrument belongs to the current user
      const { data: userInstruments, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('user_id', getUserId());
      if (instErr)
        return { content: [{ type: 'text' as const, text: safeError(instErr, 'list payment instrument cards') }] };
      const instrumentIds = (userInstruments || []).map((i: any) => i.id);
      if (instrumentIds.length === 0) return { content: [{ type: 'text' as const, text: '[]' }] };
      let query = supabase
        .from('payment_instrument_cards')
        .select(COLS_PAYMENT_INSTRUMENT_CARDS)
        .in('instrument_id', instrumentIds);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list payment instrument cards') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── payment_instrument_cash_accounts CRUD (PK = instrument_id, no direct user_id) ──

  server.tool(
    'create_payment_instrument_cash_accounts',
    'Create a new record in payment_instrument_cash_accounts',
    {
      instrument_id: z
        .string()
        .describe(
          "Note: This is a Foreign Key to `company_payment_instruments.id`.<fk table='company_payment_instruments' column='id'/>"
        ),
      cash_point_name: z.string().optional(),
      custodian_user_id: z.string().optional(),
      location: z.string().optional(),
      max_authorized_balance: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      reconciliation_frequency: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', payload.instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [{ type: 'text' as const, text: 'Error: company_payment_instrument not found or access denied' }],
        };
      const { data, error } = await supabase
        .from('payment_instrument_cash_accounts')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'create payment instrument cash account') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created payment_instrument_cash_accounts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_payment_instrument_cash_accounts',
    'Update an existing record in payment_instrument_cash_accounts',
    {
      instrument_id: z.string().describe('Instrument UUID to update (PK)'),
      cash_point_name: z.string().optional(),
      custodian_user_id: z.string().optional(),
      location: z.string().optional(),
      max_authorized_balance: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      reconciliation_frequency: z.string().optional(),
    },
    async (args) => {
      const { instrument_id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_instrument_cash_accounts')
        .update(sanitizeRecord(updates))
        .eq('instrument_id', instrument_id)
        .select()
        .single();
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'update payment instrument cash account') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated payment_instrument_cash_accounts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_payment_instrument_cash_accounts',
    'Delete a record from payment_instrument_cash_accounts',
    {
      instrument_id: z.string().describe('Instrument UUID to delete (PK)'),
    },
    async ({ instrument_id }) => {
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { error } = await supabase
        .from('payment_instrument_cash_accounts')
        .delete()
        .eq('instrument_id', instrument_id);
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'delete payment instrument cash account') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully deleted record ' + instrument_id + ' from payment_instrument_cash_accounts',
          },
        ],
      };
    }
  );

  server.tool(
    'get_payment_instrument_cash_accounts',
    'Get a single record from payment_instrument_cash_accounts by instrument_id',
    {
      instrument_id: z.string().describe('Instrument UUID to fetch (PK)'),
    },
    async ({ instrument_id }) => {
      // Security: verify the parent instrument belongs to the current user
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_instrument_cash_accounts')
        .select(COLS_PAYMENT_INSTRUMENT_CASH_ACCOUNTS)
        .eq('instrument_id', instrument_id)
        .single();
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'get payment instrument cash account') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_instrument_cash_accounts',
    'List multiple records from payment_instrument_cash_accounts',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ limit = 50, offset = 0 }) => {
      // Security: only return records whose parent instrument belongs to the current user
      const { data: userInstruments, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('user_id', getUserId());
      if (instErr)
        return {
          content: [{ type: 'text' as const, text: safeError(instErr, 'list payment instrument cash accounts') }],
        };
      const instrumentIds = (userInstruments || []).map((i: any) => i.id);
      if (instrumentIds.length === 0) return { content: [{ type: 'text' as const, text: '[]' }] };
      let query = supabase
        .from('payment_instrument_cash_accounts')
        .select(COLS_PAYMENT_INSTRUMENT_CASH_ACCOUNTS)
        .in('instrument_id', instrumentIds);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'list payment instrument cash accounts') }],
        };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── payment_transaction_allocations CRUD ──

  server.tool(
    'create_payment_transaction_allocations',
    'Create a new record in payment_transaction_allocations',
    {
      payment_transaction_id: z
        .string()
        .describe(
          "Note: This is a Foreign Key to `payment_transactions.id`.<fk table='payment_transactions' column='id'/>"
        ),
      allocation_type: z.string(),
      target_id: z.string().optional(),
      allocated_amount: z.number().min(0).max(999999999.99).multipleOf(0.01),
      notes: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the parent transaction belongs to the current user via instrument
      const { data: txn, error: txnErr } = await supabase
        .from('payment_transactions')
        .select('instrument_id')
        .eq('id', payload.payment_transaction_id)
        .single();
      if (txnErr || !txn) return { content: [{ type: 'text' as const, text: 'Error: payment_transaction not found' }] };
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', txn.instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_transaction_allocations')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'create payment transaction allocation') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created payment_transaction_allocations record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_payment_transaction_allocations',
    'Update an existing record in payment_transaction_allocations',
    {
      id: z.string().describe('Record UUID to update'),
      payment_transaction_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `payment_transactions.id`.<fk table='payment_transactions' column='id'/>"
        ),
      allocation_type: z.string().optional(),
      target_id: z.string().optional(),
      allocated_amount: z.number().min(0).max(999999999.99).multipleOf(0.01).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      // Security: verify the allocation belongs to the current user via transaction → instrument
      const { data: alloc, error: allocErr } = await supabase
        .from('payment_transaction_allocations')
        .select('payment_transaction_id')
        .eq('id', id)
        .single();
      if (allocErr || !alloc)
        return { content: [{ type: 'text' as const, text: 'Error: payment_transaction_allocation not found' }] };
      const { data: txn, error: txnErr } = await supabase
        .from('payment_transactions')
        .select('instrument_id')
        .eq('id', alloc.payment_transaction_id)
        .single();
      if (txnErr || !txn)
        return { content: [{ type: 'text' as const, text: 'Error: parent payment_transaction not found' }] };
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', txn.instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { data, error } = await supabase
        .from('payment_transaction_allocations')
        .update(sanitizeRecord(updates))
        .eq('id', id)
        .select()
        .single();
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'update payment transaction allocation') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated payment_transaction_allocations record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_payment_transaction_allocations',
    'Delete a record from payment_transaction_allocations',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      // Security: verify the allocation belongs to the current user via transaction → instrument
      const { data: alloc, error: allocErr } = await supabase
        .from('payment_transaction_allocations')
        .select('payment_transaction_id')
        .eq('id', id)
        .single();
      if (allocErr || !alloc)
        return { content: [{ type: 'text' as const, text: 'Error: payment_transaction_allocation not found' }] };
      const { data: txn, error: txnErr } = await supabase
        .from('payment_transactions')
        .select('instrument_id')
        .eq('id', alloc.payment_transaction_id)
        .single();
      if (txnErr || !txn)
        return { content: [{ type: 'text' as const, text: 'Error: parent payment_transaction not found' }] };
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', txn.instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      const { error } = await supabase.from('payment_transaction_allocations').delete().eq('id', id);
      if (error)
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'delete payment transaction allocation') }],
        };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully deleted record ' + id + ' from payment_transaction_allocations',
          },
        ],
      };
    }
  );

  server.tool(
    'get_payment_transaction_allocations',
    'Get a single record from payment_transaction_allocations by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      // Security: verify the allocation belongs to the current user via transaction → instrument
      const { data: alloc, error: allocErr } = await supabase
        .from('payment_transaction_allocations')
        .select(COLS_PAYMENT_TRANSACTION_ALLOCATIONS)
        .eq('id', id)
        .single();
      if (allocErr || !alloc)
        return {
          content: [
            { type: 'text' as const, text: safeError(allocErr || 'not found', 'get payment transaction allocation') },
          ],
        };
      const { data: txn, error: txnErr } = await supabase
        .from('payment_transactions')
        .select('instrument_id')
        .eq('id', alloc.payment_transaction_id)
        .single();
      if (txnErr || !txn)
        return { content: [{ type: 'text' as const, text: 'Error: parent payment_transaction not found' }] };
      const { data: inst, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('id', txn.instrument_id)
        .eq('user_id', getUserId())
        .single();
      if (instErr || !inst)
        return {
          content: [
            { type: 'text' as const, text: 'Error: access denied — parent instrument does not belong to current user' },
          ],
        };
      return { content: [{ type: 'text' as const, text: JSON.stringify(alloc, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_transaction_allocations',
    'List multiple records from payment_transaction_allocations',
    {
      payment_transaction_id: z.string().optional().describe('Filter by payment transaction UUID'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ payment_transaction_id, limit = 50, offset = 0 }) => {
      // Security: only return allocations whose parent instrument belongs to the current user
      const { data: userInstruments, error: instErr } = await supabase
        .from('company_payment_instruments')
        .select('id')
        .eq('user_id', getUserId());
      if (instErr)
        return {
          content: [{ type: 'text' as const, text: safeError(instErr, 'list payment transaction allocations') }],
        };
      const instrumentIds = (userInstruments || []).map((i: any) => i.id);
      if (instrumentIds.length === 0) return { content: [{ type: 'text' as const, text: '[]' }] };
      const { data: userTxns, error: txnErr } = await supabase
        .from('payment_transactions')
        .select('id')
        .in('instrument_id', instrumentIds);
      if (txnErr)
        return {
          content: [{ type: 'text' as const, text: safeError(txnErr, 'list payment transaction allocations') }],
        };
      const txnIds = (userTxns || []).map((t: any) => t.id);
      if (txnIds.length === 0) return { content: [{ type: 'text' as const, text: '[]' }] };
      let query = supabase
        .from('payment_transaction_allocations')
        .select(COLS_PAYMENT_TRANSACTION_ALLOCATIONS)
        .in('payment_transaction_id', txnIds);
      if (payment_transaction_id) query = query.eq('payment_transaction_id', payment_transaction_id);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error)
        return { content: [{ type: 'text' as const, text: safeError(error, 'list payment transaction allocations') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── payment_alerts CRUD ──

  server.tool(
    'create_payment_alerts',
    'Create a new record in payment_alerts',
    {
      company_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `company.id`.<fk table='company' column='id'/>"),
      payment_instrument_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `company_payment_instruments.id`.<fk table='company_payment_instruments' column='id'/>"
        ),
      alert_type: z.string(),
      severity: z.string().optional(),
      title: z.string(),
      message: z.string().optional(),
      is_resolved: z.boolean().optional(),
      resolved_at: z.string().optional(),
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const dateErr = validateDatesInRecord(payload);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      payload.user_id = getUserId();
      payload.company_id = payload.company_id || (await getCompanyId());
      const { data, error } = await supabase
        .from('payment_alerts')
        .insert([sanitizeRecord(payload)])
        .select()
        .single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create payment alert') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully created payment_alerts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_payment_alerts',
    'Update an existing record in payment_alerts',
    {
      id: z.string().describe('Record UUID to update'),
      company_id: z
        .string()
        .optional()
        .describe("Note: This is a Foreign Key to `company.id`.<fk table='company' column='id'/>"),
      payment_instrument_id: z
        .string()
        .optional()
        .describe(
          "Note: This is a Foreign Key to `company_payment_instruments.id`.<fk table='company_payment_instruments' column='id'/>"
        ),
      alert_type: z.string().optional(),
      severity: z.string().optional(),
      title: z.string().optional(),
      message: z.string().optional(),
      is_resolved: z.boolean().optional(),
      resolved_at: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const dateErr = validateDatesInRecord(updates);
      if (dateErr) return { content: [{ type: 'text' as const, text: dateErr }] };
      let query = supabase.from('payment_alerts').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update payment alert') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Successfully updated payment_alerts record:\n' + JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_payment_alerts',
    'Delete a record from payment_alerts',
    {
      id: z.string().describe('Record UUID to delete'),
    },
    async ({ id }) => {
      let query = supabase.from('payment_alerts').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'delete payment alert') }] };
      return {
        content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payment_alerts' }],
      };
    }
  );

  server.tool(
    'get_payment_alerts',
    'Get a single record from payment_alerts by ID',
    {
      id: z.string().describe('Record UUID to fetch'),
    },
    async ({ id }) => {
      let query = supabase.from('payment_alerts').select(COLS_PAYMENT_ALERTS).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get payment alert') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_alerts',
    'List multiple records from payment_alerts',
    {
      company_id: z.string().optional().describe('Filter by company UUID'),
      payment_instrument_id: z.string().optional().describe('Filter by payment instrument UUID'),
      is_resolved: z.boolean().optional().describe('Filter by resolved status'),
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)'),
    },
    async ({ company_id, payment_instrument_id, is_resolved, limit = 50, offset = 0 }) => {
      let query = supabase.from('payment_alerts').select(COLS_PAYMENT_ALERTS);
      query = query.eq('user_id', getUserId());
      if (company_id) query = query.eq('company_id', company_id);
      if (payment_instrument_id) query = query.eq('payment_instrument_id', payment_instrument_id);
      if (is_resolved !== undefined) query = query.eq('is_resolved', is_resolved);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list payment alerts') }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
