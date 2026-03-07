import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { sanitizeRecord } from '../utils/sanitize.js';

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
      status: z.string().optional(),
      last_sync_at: z.string().optional(),
      sync_error: z.string().optional(),
      account_id: z.string().optional(),
      account_iban: z.string().optional(),
      account_name: z.string().optional(),
      account_currency: z.string().optional(),
      account_balance: z.number().optional(),
      expires_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('bank_connections').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_connections: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_connections record:\n' + JSON.stringify(data, null, 2) }] };
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
      status: z.string().optional(),
      last_sync_at: z.string().optional(),
      sync_error: z.string().optional(),
      account_id: z.string().optional(),
      account_iban: z.string().optional(),
      account_name: z.string().optional(),
      account_currency: z.string().optional(),
      account_balance: z.number().optional(),
      expires_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('bank_connections').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating bank_connections: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated bank_connections record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_bank_connections',
    'Delete a record from bank_connections',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('bank_connections').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from bank_connections: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_connections' }] };
    }
  );

  server.tool(
    'get_bank_connections',
    'Get a single record from bank_connections by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('bank_connections').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from bank_connections: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_connections',
    'List multiple records from bank_connections',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_connections').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing bank_connections: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payables',
    'Create a new record in payables',
    {
      creditor_name: z.string(),
      creditor_phone: z.string().optional(),
      creditor_email: z.string().optional(),
      description: z.string().optional(),
      amount: z.number(),
      amount_paid: z.number(),
      currency: z.string(),
      date_borrowed: z.string(),
      due_date: z.string().optional(),
      status: z.string(),
      category: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('payables').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payables record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_payables',
    'Update an existing record in payables',
    {
      id: z.string().describe('Record UUID to update'),
      creditor_name: z.string().optional(),
      creditor_phone: z.string().optional(),
      creditor_email: z.string().optional(),
      description: z.string().optional(),
      amount: z.number().optional(),
      amount_paid: z.number().optional(),
      currency: z.string().optional(),
      date_borrowed: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      category: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('payables').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating payables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated payables record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_payables',
    'Delete a record from payables',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('payables').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from payables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payables' }] };
    }
  );

  server.tool(
    'get_payables',
    'Get a single record from payables by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('payables').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from payables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payables',
    'List multiple records from payables',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payables').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing payables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_invoice_items',
    'Create a new record in invoice_items',
    {
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      description: z.string().optional(),
      quantity: z.number().optional(),
      unit_price: z.number().optional(),
      total: z.number().optional(),
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      discount_type: z.string().optional(),
      discount_value: z.number().optional(),
      discount_amount: z.number().optional(),
      hsn_code: z.string().optional(),
      item_type: z.string().optional(),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>'),
      timesheet_id: z.string().optional().describe('Note: This is a Foreign Key to `timesheets.id`.<fk table=\'timesheets\' column=\'id\'/>')
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('invoice_items').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into invoice_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created invoice_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_invoice_items',
    'Update an existing record in invoice_items',
    {
      id: z.string().describe('Record UUID to update'),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      description: z.string().optional(),
      quantity: z.number().optional(),
      unit_price: z.number().optional(),
      total: z.number().optional(),
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      discount_type: z.string().optional(),
      discount_value: z.number().optional(),
      discount_amount: z.number().optional(),
      hsn_code: z.string().optional(),
      item_type: z.string().optional(),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>'),
      timesheet_id: z.string().optional().describe('Note: This is a Foreign Key to `timesheets.id`.<fk table=\'timesheets\' column=\'id\'/>')
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('invoice_items').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating invoice_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated invoice_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_invoice_items',
    'Delete a record from invoice_items',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('invoice_items').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from invoice_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from invoice_items' }] };
    }
  );

  server.tool(
    'get_invoice_items',
    'Get a single record from invoice_items by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('invoice_items').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from invoice_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_invoice_items',
    'List multiple records from invoice_items',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('invoice_items').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing invoice_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_services',
    'Create a new record in services',
    {
      service_name: z.string(),
      description: z.string().optional(),
      category_id: z.string().optional().describe('Note: This is a Foreign Key to `service_categories.id`.<fk table=\'service_categories\' column=\'id\'/>'),
      pricing_type: z.string(),
      hourly_rate: z.number().optional(),
      fixed_price: z.number().optional(),
      unit_price: z.number().optional(),
      unit: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('services').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created services record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_services',
    'Update an existing record in services',
    {
      id: z.string().describe('Record UUID to update'),
      service_name: z.string().optional(),
      description: z.string().optional(),
      category_id: z.string().optional().describe('Note: This is a Foreign Key to `service_categories.id`.<fk table=\'service_categories\' column=\'id\'/>'),
      pricing_type: z.string().optional(),
      hourly_rate: z.number().optional(),
      fixed_price: z.number().optional(),
      unit_price: z.number().optional(),
      unit: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('services').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated services record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_services',
    'Delete a record from services',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('services').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from services' }] };
    }
  );

  server.tool(
    'get_services',
    'Get a single record from services by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('services').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_services',
    'List multiple records from services',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('services').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_suppliers',
    'Create a new record in suppliers',
    {
      company_name: z.string(),
      contact_person: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postal_code: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      website: z.string().optional(),
      payment_terms: z.string().optional(),
      supplier_type: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
      tax_id: z.string().optional(),
      currency: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      bic_swift: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('suppliers').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into suppliers: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created suppliers record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_suppliers',
    'Update an existing record in suppliers',
    {
      id: z.string().describe('Record UUID to update'),
      company_name: z.string().optional(),
      contact_person: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postal_code: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      website: z.string().optional(),
      payment_terms: z.string().optional(),
      supplier_type: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
      tax_id: z.string().optional(),
      currency: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      bic_swift: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('suppliers').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating suppliers: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated suppliers record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_suppliers',
    'Delete a record from suppliers',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('suppliers').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from suppliers: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from suppliers' }] };
    }
  );

  server.tool(
    'get_suppliers',
    'Get a single record from suppliers by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('suppliers').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from suppliers: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_suppliers',
    'List multiple records from suppliers',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('suppliers').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing suppliers: ' + error.message }] };
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
      is_active: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('payment_reminder_rules').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_reminder_rules: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_reminder_rules record:\n' + JSON.stringify(data, null, 2) }] };
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
      is_active: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('payment_reminder_rules').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating payment_reminder_rules: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated payment_reminder_rules record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_payment_reminder_rules',
    'Delete a record from payment_reminder_rules',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('payment_reminder_rules').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from payment_reminder_rules: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payment_reminder_rules' }] };
    }
  );

  server.tool(
    'get_payment_reminder_rules',
    'Get a single record from payment_reminder_rules by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('payment_reminder_rules').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from payment_reminder_rules: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_reminder_rules',
    'List multiple records from payment_reminder_rules',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payment_reminder_rules').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing payment_reminder_rules: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_quotes',
    'Create a new record in quotes',
    {
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      quote_number: z.string(),
      date: z.string().optional(),
      status: z.string().optional(),
      total_ht: z.number().optional(),
      tax_rate: z.number().optional(),
      total_ttc: z.number().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('quotes').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into quotes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created quotes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_quotes',
    'Update an existing record in quotes',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      quote_number: z.string().optional(),
      date: z.string().optional(),
      status: z.string().optional(),
      total_ht: z.number().optional(),
      tax_rate: z.number().optional(),
      total_ttc: z.number().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('quotes').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating quotes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated quotes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_quotes',
    'Delete a record from quotes',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('quotes').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from quotes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from quotes' }] };
    }
  );

  server.tool(
    'get_quotes',
    'Get a single record from quotes by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('quotes').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from quotes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_quotes',
    'List multiple records from quotes',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('quotes').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing quotes: ' + error.message }] };
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
      opening_balance: z.number().optional(),
      closing_balance: z.number().optional(),
      file_name: z.string(),
      file_path: z.string(),
      file_type: z.string(),
      file_size: z.number().int().optional(),
      parse_status: z.string(),
      parse_errors: z.any().optional(),
      line_count: z.number().int().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('bank_statements').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_statements: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_statements record:\n' + JSON.stringify(data, null, 2) }] };
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
      opening_balance: z.number().optional(),
      closing_balance: z.number().optional(),
      file_name: z.string().optional(),
      file_path: z.string().optional(),
      file_type: z.string().optional(),
      file_size: z.number().int().optional(),
      parse_status: z.string().optional(),
      parse_errors: z.any().optional(),
      line_count: z.number().int().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('bank_statements').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating bank_statements: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated bank_statements record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_bank_statements',
    'Delete a record from bank_statements',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('bank_statements').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from bank_statements: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_statements' }] };
    }
  );

  server.tool(
    'get_bank_statements',
    'Get a single record from bank_statements by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('bank_statements').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from bank_statements: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_statements',
    'List multiple records from bank_statements',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_statements').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing bank_statements: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_order_items',
    'Create a new record in supplier_order_items',
    {
      order_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>'),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_services.id`.<fk table=\'supplier_services\' column=\'id\'/>'),
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_products.id`.<fk table=\'supplier_products\' column=\'id\'/>'),
      quantity: z.number(),
      unit_price: z.number(),
      total_price: z.number()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('supplier_order_items').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_order_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_order_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_order_items',
    'Update an existing record in supplier_order_items',
    {
      id: z.string().describe('Record UUID to update'),
      order_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>'),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_services.id`.<fk table=\'supplier_services\' column=\'id\'/>'),
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_products.id`.<fk table=\'supplier_products\' column=\'id\'/>'),
      quantity: z.number().optional(),
      unit_price: z.number().optional(),
      total_price: z.number().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_order_items').update(sanitizeRecord(updates)).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_order_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_order_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_order_items',
    'Delete a record from supplier_order_items',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_order_items').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_order_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_order_items' }] };
    }
  );

  server.tool(
    'get_supplier_order_items',
    'Get a single record from supplier_order_items by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_order_items').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_order_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_order_items',
    'List multiple records from supplier_order_items',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_order_items').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_order_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_orders',
    'Create a new record in supplier_orders',
    {
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      order_number: z.string(),
      order_date: z.string().optional(),
      expected_delivery_date: z.string().optional(),
      actual_delivery_date: z.string().optional(),
      order_status: z.string().optional(),
      total_amount: z.number().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('supplier_orders').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_orders record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_orders',
    'Update an existing record in supplier_orders',
    {
      id: z.string().describe('Record UUID to update'),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      order_number: z.string().optional(),
      order_date: z.string().optional(),
      expected_delivery_date: z.string().optional(),
      actual_delivery_date: z.string().optional(),
      order_status: z.string().optional(),
      total_amount: z.number().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_orders').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_orders record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_orders',
    'Delete a record from supplier_orders',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_orders').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_orders' }] };
    }
  );

  server.tool(
    'get_supplier_orders',
    'Get a single record from supplier_orders by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_orders').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_orders',
    'List multiple records from supplier_orders',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_orders').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_service_categories',
    'Create a new record in service_categories',
    {
      name: z.string(),
      description: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('service_categories').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into service_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created service_categories record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_service_categories',
    'Update an existing record in service_categories',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      description: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('service_categories').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating service_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated service_categories record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_service_categories',
    'Delete a record from service_categories',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('service_categories').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from service_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from service_categories' }] };
    }
  );

  server.tool(
    'get_service_categories',
    'Get a single record from service_categories by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('service_categories').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from service_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_service_categories',
    'List multiple records from service_categories',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('service_categories').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing service_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
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
      email: z.string().optional(),
      website: z.string().optional(),
      logo_url: z.string().optional(),
      bank_account: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      swift: z.string().optional(),
      currency: z.string().optional().describe('ISO 4217 currency code (e.g., EUR, USD, XAF, GBP)')
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('company').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into company: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created company record:\n' + JSON.stringify(data, null, 2) }] };
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
      email: z.string().optional(),
      website: z.string().optional(),
      logo_url: z.string().optional(),
      bank_account: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      swift: z.string().optional(),
      currency: z.string().optional().describe('ISO 4217 currency code (e.g., EUR, USD, XAF, GBP)')
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('company').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating company: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated company record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_company',
    'Delete a record from company',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('company').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from company: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from company' }] };
    }
  );

  server.tool(
    'get_company',
    'Get a single record from company by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('company').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from company: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_company',
    'List multiple records from company',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('company').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing company: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_transactions',
    'Create a new record in bank_transactions',
    {
      bank_connection_id: z.string().describe('Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>'),
      external_id: z.string().optional(),
      date: z.string(),
      booking_date: z.string().optional(),
      value_date: z.string().optional(),
      amount: z.number(),
      currency: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      creditor_name: z.string().optional(),
      debtor_name: z.string().optional(),
      remittance_info: z.string().optional(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      reconciliation_status: z.string().optional(),
      match_confidence: z.number().optional(),
      matched_at: z.string().optional(),
      raw_data: z.any().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('bank_transactions').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_transactions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_bank_transactions',
    'Update an existing record in bank_transactions',
    {
      id: z.string().describe('Record UUID to update'),
      bank_connection_id: z.string().optional().describe('Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>'),
      external_id: z.string().optional(),
      date: z.string().optional(),
      booking_date: z.string().optional(),
      value_date: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      creditor_name: z.string().optional(),
      debtor_name: z.string().optional(),
      remittance_info: z.string().optional(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      reconciliation_status: z.string().optional(),
      match_confidence: z.number().optional(),
      matched_at: z.string().optional(),
      raw_data: z.any().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('bank_transactions').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating bank_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated bank_transactions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_bank_transactions',
    'Delete a record from bank_transactions',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('bank_transactions').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from bank_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_transactions' }] };
    }
  );

  server.tool(
    'get_bank_transactions',
    'Get a single record from bank_transactions by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('bank_transactions').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from bank_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_transactions',
    'List multiple records from bank_transactions',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_transactions').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing bank_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payment_terms',
    'Create a new record in payment_terms',
    {
      name: z.string(),
      days: z.number().int(),
      description: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('payment_terms').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_terms: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_terms record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_payment_terms',
    'Update an existing record in payment_terms',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      days: z.number().int().optional(),
      description: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('payment_terms').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating payment_terms: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated payment_terms record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_payment_terms',
    'Delete a record from payment_terms',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('payment_terms').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from payment_terms: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payment_terms' }] };
    }
  );

  server.tool(
    'get_payment_terms',
    'Get a single record from payment_terms by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('payment_terms').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from payment_terms: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_terms',
    'List multiple records from payment_terms',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payment_terms').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing payment_terms: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_credit_notes',
    'Create a new record in credit_notes',
    {
      credit_note_number: z.string(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      date: z.string(),
      reason: z.string().optional(),
      total_ht: z.number().optional(),
      tax_rate: z.number().optional(),
      tax_amount: z.number().optional(),
      total_ttc: z.number().optional(),
      status: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('credit_notes').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_notes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_credit_notes',
    'Update an existing record in credit_notes',
    {
      id: z.string().describe('Record UUID to update'),
      credit_note_number: z.string().optional(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      date: z.string().optional(),
      reason: z.string().optional(),
      total_ht: z.number().optional(),
      tax_rate: z.number().optional(),
      tax_amount: z.number().optional(),
      total_ttc: z.number().optional(),
      status: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('credit_notes').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating credit_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated credit_notes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_credit_notes',
    'Delete a record from credit_notes',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('credit_notes').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from credit_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from credit_notes' }] };
    }
  );

  server.tool(
    'get_credit_notes',
    'Get a single record from credit_notes by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('credit_notes').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from credit_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_credit_notes',
    'List multiple records from credit_notes',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('credit_notes').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing credit_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_reconciliation_sessions',
    'Create a new record in bank_reconciliation_sessions',
    {
      statement_id: z.string().describe('Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>'),
      session_date: z.string().optional(),
      status: z.string(),
      total_lines: z.number().int().optional(),
      matched_lines: z.number().int().optional(),
      unmatched_lines: z.number().int().optional(),
      ignored_lines: z.number().int().optional(),
      total_credits: z.number().optional(),
      total_debits: z.number().optional(),
      matched_credits: z.number().optional(),
      matched_debits: z.number().optional(),
      difference: z.number().optional(),
      completed_at: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('bank_reconciliation_sessions').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_reconciliation_sessions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_reconciliation_sessions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_bank_reconciliation_sessions',
    'Update an existing record in bank_reconciliation_sessions',
    {
      id: z.string().describe('Record UUID to update'),
      statement_id: z.string().optional().describe('Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>'),
      session_date: z.string().optional(),
      status: z.string().optional(),
      total_lines: z.number().int().optional(),
      matched_lines: z.number().int().optional(),
      unmatched_lines: z.number().int().optional(),
      ignored_lines: z.number().int().optional(),
      total_credits: z.number().optional(),
      total_debits: z.number().optional(),
      matched_credits: z.number().optional(),
      matched_debits: z.number().optional(),
      difference: z.number().optional(),
      completed_at: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('bank_reconciliation_sessions').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating bank_reconciliation_sessions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated bank_reconciliation_sessions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_bank_reconciliation_sessions',
    'Delete a record from bank_reconciliation_sessions',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('bank_reconciliation_sessions').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from bank_reconciliation_sessions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_reconciliation_sessions' }] };
    }
  );

  server.tool(
    'get_bank_reconciliation_sessions',
    'Get a single record from bank_reconciliation_sessions by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('bank_reconciliation_sessions').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from bank_reconciliation_sessions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_reconciliation_sessions',
    'List multiple records from bank_reconciliation_sessions',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_reconciliation_sessions').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing bank_reconciliation_sessions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_expenses',
    'Create a new record in expenses',
    {
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      amount: z.number(),
      category: z.string().optional(),
      description: z.string().optional(),
      receipt_url: z.string().optional(),
      refacturable: z.boolean().optional(),
      tax_rate: z.number().optional(),
      amount_ht: z.number().optional(),
      tax_amount: z.number().optional(),
      expense_date: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('expenses').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into expenses: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created expenses record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_expenses',
    'Update an existing record in expenses',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      amount: z.number().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      receipt_url: z.string().optional(),
      refacturable: z.boolean().optional(),
      tax_rate: z.number().optional(),
      amount_ht: z.number().optional(),
      tax_amount: z.number().optional(),
      expense_date: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('expenses').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating expenses: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated expenses record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_expenses',
    'Delete a record from expenses',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('expenses').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from expenses: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from expenses' }] };
    }
  );

  server.tool(
    'get_expenses',
    'Get a single record from expenses by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('expenses').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from expenses: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_expenses',
    'List multiple records from expenses',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('expenses').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing expenses: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_receivables',
    'Create a new record in receivables',
    {
      debtor_name: z.string(),
      debtor_phone: z.string().optional(),
      debtor_email: z.string().optional(),
      description: z.string().optional(),
      amount: z.number(),
      amount_paid: z.number(),
      currency: z.string(),
      date_lent: z.string(),
      due_date: z.string().optional(),
      status: z.string(),
      category: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('receivables').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into receivables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created receivables record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_receivables',
    'Update an existing record in receivables',
    {
      id: z.string().describe('Record UUID to update'),
      debtor_name: z.string().optional(),
      debtor_phone: z.string().optional(),
      debtor_email: z.string().optional(),
      description: z.string().optional(),
      amount: z.number().optional(),
      amount_paid: z.number().optional(),
      currency: z.string().optional(),
      date_lent: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      category: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('receivables').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating receivables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated receivables record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_receivables',
    'Delete a record from receivables',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('receivables').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from receivables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from receivables' }] };
    }
  );

  server.tool(
    'get_receivables',
    'Get a single record from receivables by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('receivables').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from receivables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_receivables',
    'List multiple records from receivables',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('receivables').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing receivables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_statement_lines',
    'Create a new record in bank_statement_lines',
    {
      statement_id: z.string().describe('Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>'),
      line_number: z.number().int().optional(),
      transaction_date: z.string(),
      value_date: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      amount: z.number(),
      balance_after: z.number().optional(),
      raw_data: z.any().optional(),
      reconciliation_status: z.string(),
      matched_source_type: z.string().optional(),
      matched_source_id: z.string().optional(),
      matched_at: z.string().optional(),
      matched_by: z.string().optional(),
      match_confidence: z.number().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('bank_statement_lines').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_statement_lines: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_statement_lines record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_bank_statement_lines',
    'Update an existing record in bank_statement_lines',
    {
      id: z.string().describe('Record UUID to update'),
      statement_id: z.string().optional().describe('Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>'),
      line_number: z.number().int().optional(),
      transaction_date: z.string().optional(),
      value_date: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
      amount: z.number().optional(),
      balance_after: z.number().optional(),
      raw_data: z.any().optional(),
      reconciliation_status: z.string().optional(),
      matched_source_type: z.string().optional(),
      matched_source_id: z.string().optional(),
      matched_at: z.string().optional(),
      matched_by: z.string().optional(),
      match_confidence: z.number().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('bank_statement_lines').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating bank_statement_lines: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated bank_statement_lines record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_bank_statement_lines',
    'Delete a record from bank_statement_lines',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('bank_statement_lines').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from bank_statement_lines: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_statement_lines' }] };
    }
  );

  server.tool(
    'get_bank_statement_lines',
    'Get a single record from bank_statement_lines by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('bank_statement_lines').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from bank_statement_lines: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_statement_lines',
    'List multiple records from bank_statement_lines',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_statement_lines').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing bank_statement_lines: ' + error.message }] };
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
      rate: z.number().optional(),
      tax_type: z.string().optional(),
      is_default: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('accounting_tax_rates').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_tax_rates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_tax_rates record:\n' + JSON.stringify(data, null, 2) }] };
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
      rate: z.number().optional(),
      tax_type: z.string().optional(),
      is_default: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('accounting_tax_rates').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating accounting_tax_rates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated accounting_tax_rates record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_accounting_tax_rates',
    'Delete a record from accounting_tax_rates',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_tax_rates').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from accounting_tax_rates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from accounting_tax_rates' }] };
    }
  );

  server.tool(
    'get_accounting_tax_rates',
    'Get a single record from accounting_tax_rates by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_tax_rates').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from accounting_tax_rates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_accounting_tax_rates',
    'List multiple records from accounting_tax_rates',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('accounting_tax_rates').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing accounting_tax_rates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_recurring_invoices',
    'Create a new record in recurring_invoices',
    {
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      frequency: z.string().optional(),
      next_date: z.string().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('recurring_invoices').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into recurring_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created recurring_invoices record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_recurring_invoices',
    'Update an existing record in recurring_invoices',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      frequency: z.string().optional(),
      next_date: z.string().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('recurring_invoices').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating recurring_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated recurring_invoices record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_recurring_invoices',
    'Delete a record from recurring_invoices',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('recurring_invoices').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from recurring_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from recurring_invoices' }] };
    }
  );

  server.tool(
    'get_recurring_invoices',
    'Get a single record from recurring_invoices by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('recurring_invoices').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from recurring_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_recurring_invoices',
    'List multiple records from recurring_invoices',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('recurring_invoices').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing recurring_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_purchase_orders',
    'Create a new record in purchase_orders',
    {
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      po_number: z.string(),
      date: z.string().optional(),
      due_date: z.string().optional(),
      items: z.any().optional(),
      total: z.number().optional(),
      status: z.string().optional(),
      payment_terms_id: z.string().optional().describe('Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>'),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('purchase_orders').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into purchase_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created purchase_orders record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_purchase_orders',
    'Update an existing record in purchase_orders',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      po_number: z.string().optional(),
      date: z.string().optional(),
      due_date: z.string().optional(),
      items: z.any().optional(),
      total: z.number().optional(),
      status: z.string().optional(),
      payment_terms_id: z.string().optional().describe('Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>'),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('purchase_orders').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating purchase_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated purchase_orders record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_purchase_orders',
    'Delete a record from purchase_orders',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('purchase_orders').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from purchase_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from purchase_orders' }] };
    }
  );

  server.tool(
    'get_purchase_orders',
    'Get a single record from purchase_orders by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('purchase_orders').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from purchase_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_purchase_orders',
    'List multiple records from purchase_orders',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('purchase_orders').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing purchase_orders: ' + error.message }] };
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
      font_family: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('invoice_settings').insert([sanitizeRecord(payload)]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into invoice_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created invoice_settings record:\n' + JSON.stringify(data, null, 2) }] };
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
      font_family: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('invoice_settings').update(sanitizeRecord(updates)).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating invoice_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated invoice_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_invoice_settings',
    'Delete a record from invoice_settings',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('invoice_settings').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from invoice_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from invoice_settings' }] };
    }
  );

  server.tool(
    'get_invoice_settings',
    'Get a single record from invoice_settings by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('invoice_settings').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from invoice_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_invoice_settings',
    'List multiple records from invoice_settings',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('invoice_settings').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing invoice_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
