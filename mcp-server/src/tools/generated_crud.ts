import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';

export function registerGeneratedCrudTools(server: McpServer) {

  server.tool(
    'create_credit_packages',
    'Create a new record in credit_packages',
    {
      name: z.string(),
      credits: z.number().int(),
      price_cents: z.number().int(),
      currency: z.string().optional(),
      is_active: z.boolean().optional(),
      stripe_price_id: z.string().optional(),
      sort_order: z.number().int().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('credit_packages').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_packages: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_packages record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_credit_packages',
    'Update an existing record in credit_packages',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      credits: z.number().int().optional(),
      price_cents: z.number().int().optional(),
      currency: z.string().optional(),
      is_active: z.boolean().optional(),
      stripe_price_id: z.string().optional(),
      sort_order: z.number().int().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('credit_packages').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating credit_packages: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated credit_packages record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_credit_packages',
    'Delete a record from credit_packages',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('credit_packages').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from credit_packages: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from credit_packages' }] };
    }
  );

  server.tool(
    'get_credit_packages',
    'Get a single record from credit_packages by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('credit_packages').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from credit_packages: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_credit_packages',
    'List multiple records from credit_packages',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('credit_packages').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing credit_packages: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_products',
    'Create a new record in supplier_products',
    {
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      category_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_product_categories.id`.<fk table=\'supplier_product_categories\' column=\'id\'/>'),
      product_name: z.string(),
      description: z.string().optional(),
      sku: z.string().optional(),
      unit_price: z.number(),
      unit: z.string().optional(),
      stock_quantity: z.number().int().optional(),
      min_stock_level: z.number().int().optional(),
      reorder_quantity: z.number().int().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('supplier_products').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_products record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_products',
    'Update an existing record in supplier_products',
    {
      id: z.string().describe('Record UUID to update'),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      category_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_product_categories.id`.<fk table=\'supplier_product_categories\' column=\'id\'/>'),
      product_name: z.string().optional(),
      description: z.string().optional(),
      sku: z.string().optional(),
      unit_price: z.number().optional(),
      unit: z.string().optional(),
      stock_quantity: z.number().int().optional(),
      min_stock_level: z.number().int().optional(),
      reorder_quantity: z.number().int().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_products').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_products record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_products',
    'Delete a record from supplier_products',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_products').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_products' }] };
    }
  );

  server.tool(
    'get_supplier_products',
    'Get a single record from supplier_products by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_products').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_products',
    'List multiple records from supplier_products',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_products').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_credit_note_items',
    'Create a new record in credit_note_items',
    {
      credit_note_id: z.string().describe('Note: This is a Foreign Key to `credit_notes.id`.<fk table=\'credit_notes\' column=\'id\'/>'),
      description: z.string(),
      quantity: z.number().optional(),
      unit_price: z.number().optional(),
      amount: z.number().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('credit_note_items').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_note_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_credit_note_items',
    'Update an existing record in credit_note_items',
    {
      id: z.string().describe('Record UUID to update'),
      credit_note_id: z.string().optional().describe('Note: This is a Foreign Key to `credit_notes.id`.<fk table=\'credit_notes\' column=\'id\'/>'),
      description: z.string().optional(),
      quantity: z.number().optional(),
      unit_price: z.number().optional(),
      amount: z.number().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('credit_note_items').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating credit_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated credit_note_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_credit_note_items',
    'Delete a record from credit_note_items',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('credit_note_items').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from credit_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from credit_note_items' }] };
    }
  );

  server.tool(
    'get_credit_note_items',
    'Get a single record from credit_note_items by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('credit_note_items').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from credit_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_credit_note_items',
    'List multiple records from credit_note_items',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('credit_note_items').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing credit_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payments',
    'Create a new record in payments',
    {
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      payment_date: z.string(),
      amount: z.number(),
      payment_method: z.string().optional(),
      reference: z.string().optional(),
      notes: z.string().optional(),
      is_lump_sum: z.boolean().optional(),
      receipt_number: z.string().optional(),
      receipt_generated_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('payments').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payments record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_payments',
    'Update an existing record in payments',
    {
      id: z.string().describe('Record UUID to update'),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      payment_date: z.string().optional(),
      amount: z.number().optional(),
      payment_method: z.string().optional(),
      reference: z.string().optional(),
      notes: z.string().optional(),
      is_lump_sum: z.boolean().optional(),
      receipt_number: z.string().optional(),
      receipt_generated_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('payments').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated payments record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_payments',
    'Delete a record from payments',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('payments').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payments' }] };
    }
  );

  server.tool(
    'get_payments',
    'Get a single record from payments by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('payments').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payments',
    'List multiple records from payments',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payments').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_scenario_results',
    'Create a new record in scenario_results',
    {
      scenario_id: z.string().describe('Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>'),
      calculation_date: z.string(),
      period_label: z.string().optional(),
      metrics: z.any().describe('All calculated financial metrics stored as JSONB'),
      calculated_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('scenario_results').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_results: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_results record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_scenario_results',
    'Update an existing record in scenario_results',
    {
      id: z.string().describe('Record UUID to update'),
      scenario_id: z.string().optional().describe('Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>'),
      calculation_date: z.string().optional(),
      period_label: z.string().optional(),
      metrics: z.any().optional().describe('All calculated financial metrics stored as JSONB'),
      calculated_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('scenario_results').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating scenario_results: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated scenario_results record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_scenario_results',
    'Delete a record from scenario_results',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_results').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from scenario_results: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from scenario_results' }] };
    }
  );

  server.tool(
    'get_scenario_results',
    'Get a single record from scenario_results by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_results').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from scenario_results: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_scenario_results',
    'List multiple records from scenario_results',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('scenario_results').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing scenario_results: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_referrals',
    'Create a new record in referrals',
    {
      referrer_user_id: z.string(),
      referred_user_id: z.string().optional(),
      referral_code: z.string(),
      status: z.string().optional(),
      bonus_credited: z.boolean().optional(),
      completed_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('referrals').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into referrals: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created referrals record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_referrals',
    'Update an existing record in referrals',
    {
      id: z.string().describe('Record UUID to update'),
      referrer_user_id: z.string().optional(),
      referred_user_id: z.string().optional(),
      referral_code: z.string().optional(),
      status: z.string().optional(),
      bonus_credited: z.boolean().optional(),
      completed_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('referrals').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating referrals: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated referrals record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_referrals',
    'Delete a record from referrals',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('referrals').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from referrals: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from referrals' }] };
    }
  );

  server.tool(
    'get_referrals',
    'Get a single record from referrals by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('referrals').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from referrals: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_referrals',
    'List multiple records from referrals',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('referrals').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing referrals: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_push_subscriptions',
    'Create a new record in push_subscriptions',
    {
      endpoint: z.string(),
      auth_key: z.string(),
      p256dh_key: z.string(),
      device_type: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('push_subscriptions').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into push_subscriptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created push_subscriptions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_push_subscriptions',
    'Update an existing record in push_subscriptions',
    {
      id: z.string().describe('Record UUID to update'),
      endpoint: z.string().optional(),
      auth_key: z.string().optional(),
      p256dh_key: z.string().optional(),
      device_type: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('push_subscriptions').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating push_subscriptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated push_subscriptions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_push_subscriptions',
    'Delete a record from push_subscriptions',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('push_subscriptions').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from push_subscriptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from push_subscriptions' }] };
    }
  );

  server.tool(
    'get_push_subscriptions',
    'Get a single record from push_subscriptions by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('push_subscriptions').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from push_subscriptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_push_subscriptions',
    'List multiple records from push_subscriptions',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('push_subscriptions').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing push_subscriptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_user_credits',
    'Create a new record in user_credits',
    {
      free_credits: z.number().int().optional(),
      paid_credits: z.number().int().optional(),
      total_used: z.number().int().optional(),
      referral_code: z.string().optional(),
      referred_by: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('user_credits').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into user_credits: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created user_credits record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_user_credits',
    'Update an existing record in user_credits',
    {
      id: z.string().describe('Record UUID to update'),
      free_credits: z.number().int().optional(),
      paid_credits: z.number().int().optional(),
      total_used: z.number().int().optional(),
      referral_code: z.string().optional(),
      referred_by: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('user_credits').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating user_credits: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated user_credits record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_user_credits',
    'Delete a record from user_credits',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('user_credits').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from user_credits: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from user_credits' }] };
    }
  );

  server.tool(
    'get_user_credits',
    'Get a single record from user_credits by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('user_credits').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from user_credits: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_user_credits',
    'List multiple records from user_credits',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('user_credits').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing user_credits: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_delivery_note_items',
    'Create a new record in delivery_note_items',
    {
      delivery_note_id: z.string().describe('Note: This is a Foreign Key to `delivery_notes.id`.<fk table=\'delivery_notes\' column=\'id\'/>'),
      description: z.string(),
      quantity: z.number().optional(),
      unit: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('delivery_note_items').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into delivery_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created delivery_note_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_delivery_note_items',
    'Update an existing record in delivery_note_items',
    {
      id: z.string().describe('Record UUID to update'),
      delivery_note_id: z.string().optional().describe('Note: This is a Foreign Key to `delivery_notes.id`.<fk table=\'delivery_notes\' column=\'id\'/>'),
      description: z.string().optional(),
      quantity: z.number().optional(),
      unit: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('delivery_note_items').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating delivery_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated delivery_note_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_delivery_note_items',
    'Delete a record from delivery_note_items',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('delivery_note_items').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from delivery_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from delivery_note_items' }] };
    }
  );

  server.tool(
    'get_delivery_note_items',
    'Get a single record from delivery_note_items by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('delivery_note_items').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from delivery_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_delivery_note_items',
    'List multiple records from delivery_note_items',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('delivery_note_items').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing delivery_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_stock_alerts',
    'Create a new record in stock_alerts',
    {
      product_id: z.string().optional(),
      user_product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      alert_type: z.string().optional(),
      is_active: z.boolean().optional(),
      resolved_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('stock_alerts').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into stock_alerts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created stock_alerts record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_stock_alerts',
    'Update an existing record in stock_alerts',
    {
      id: z.string().describe('Record UUID to update'),
      product_id: z.string().optional(),
      user_product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      alert_type: z.string().optional(),
      is_active: z.boolean().optional(),
      resolved_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('stock_alerts').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating stock_alerts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated stock_alerts record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_stock_alerts',
    'Delete a record from stock_alerts',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('stock_alerts').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from stock_alerts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from stock_alerts' }] };
    }
  );

  server.tool(
    'get_stock_alerts',
    'Get a single record from stock_alerts by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('stock_alerts').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from stock_alerts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_stock_alerts',
    'List multiple records from stock_alerts',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('stock_alerts').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing stock_alerts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

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
      const { data, error } = await supabase.from('bank_connections').insert([payload]).select().single();
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
      let query = supabase.from('bank_connections').update(updates).eq('id', id);
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
    'create_supplier_invoices',
    'Create a new record in supplier_invoices',
    {
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      invoice_number: z.string(),
      invoice_date: z.string().optional(),
      due_date: z.string().optional(),
      total_amount: z.number(),
      vat_amount: z.number().optional(),
      vat_rate: z.number().optional(),
      payment_status: z.string().optional(),
      file_url: z.string().optional(),
      notes: z.string().optional(),
      total_ht: z.number().optional(),
      total_ttc: z.number().optional(),
      currency: z.string().optional(),
      supplier_name_extracted: z.string().optional(),
      supplier_address_extracted: z.string().optional(),
      supplier_vat_number: z.string().optional(),
      payment_terms: z.string().optional(),
      iban: z.string().optional(),
      bic: z.string().optional(),
      ai_extracted: z.boolean().optional(),
      ai_confidence: z.number().optional(),
      ai_raw_response: z.any().optional(),
      ai_extracted_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('supplier_invoices').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_invoices record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_invoices',
    'Update an existing record in supplier_invoices',
    {
      id: z.string().describe('Record UUID to update'),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      invoice_number: z.string().optional(),
      invoice_date: z.string().optional(),
      due_date: z.string().optional(),
      total_amount: z.number().optional(),
      vat_amount: z.number().optional(),
      vat_rate: z.number().optional(),
      payment_status: z.string().optional(),
      file_url: z.string().optional(),
      notes: z.string().optional(),
      total_ht: z.number().optional(),
      total_ttc: z.number().optional(),
      currency: z.string().optional(),
      supplier_name_extracted: z.string().optional(),
      supplier_address_extracted: z.string().optional(),
      supplier_vat_number: z.string().optional(),
      payment_terms: z.string().optional(),
      iban: z.string().optional(),
      bic: z.string().optional(),
      ai_extracted: z.boolean().optional(),
      ai_confidence: z.number().optional(),
      ai_raw_response: z.any().optional(),
      ai_extracted_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_invoices').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_invoices record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_invoices',
    'Delete a record from supplier_invoices',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_invoices').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_invoices' }] };
    }
  );

  server.tool(
    'get_supplier_invoices',
    'Get a single record from supplier_invoices by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_invoices').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_invoices',
    'List multiple records from supplier_invoices',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_invoices').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_invoices: ' + error.message }] };
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
      const { data, error } = await supabase.from('payables').insert([payload]).select().single();
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
      let query = supabase.from('payables').update(updates).eq('id', id);
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
    'create_timesheets',
    'Create a new record in timesheets',
    {
      task_id: z.string().optional().describe('Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>'),
      project_id: z.string().optional().describe('Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      date: z.string(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      duration_minutes: z.number().int().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
      billable: z.boolean().optional(),
      hourly_rate: z.number().optional(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      billed_at: z.string().optional(),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>')
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('timesheets').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into timesheets: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created timesheets record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_timesheets',
    'Update an existing record in timesheets',
    {
      id: z.string().describe('Record UUID to update'),
      task_id: z.string().optional().describe('Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>'),
      project_id: z.string().optional().describe('Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      date: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      duration_minutes: z.number().int().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
      billable: z.boolean().optional(),
      hourly_rate: z.number().optional(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      billed_at: z.string().optional(),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>')
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('timesheets').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating timesheets: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated timesheets record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_timesheets',
    'Delete a record from timesheets',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('timesheets').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from timesheets: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from timesheets' }] };
    }
  );

  server.tool(
    'get_timesheets',
    'Get a single record from timesheets by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('timesheets').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from timesheets: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_timesheets',
    'List multiple records from timesheets',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('timesheets').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing timesheets: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_product_categories',
    'Create a new record in supplier_product_categories',
    {
      name: z.string(),
      description: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('supplier_product_categories').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_product_categories record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_product_categories',
    'Update an existing record in supplier_product_categories',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      description: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_product_categories').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_product_categories record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_product_categories',
    'Delete a record from supplier_product_categories',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_product_categories').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_product_categories' }] };
    }
  );

  server.tool(
    'get_supplier_product_categories',
    'Get a single record from supplier_product_categories by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_product_categories').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_product_categories',
    'List multiple records from supplier_product_categories',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_product_categories').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_scenario_templates',
    'Create a new record in scenario_templates',
    {
      name: z.string(),
      description: z.string().optional(),
      category: z.string(),
      icon: z.string().optional(),
      default_assumptions: z.any(),
      suggested_duration_months: z.number().int().optional(),
      is_public: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('scenario_templates').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_templates record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_scenario_templates',
    'Update an existing record in scenario_templates',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      icon: z.string().optional(),
      default_assumptions: z.any().optional(),
      suggested_duration_months: z.number().int().optional(),
      is_public: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('scenario_templates').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating scenario_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated scenario_templates record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_scenario_templates',
    'Delete a record from scenario_templates',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_templates').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from scenario_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from scenario_templates' }] };
    }
  );

  server.tool(
    'get_scenario_templates',
    'Get a single record from scenario_templates by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_templates').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from scenario_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_scenario_templates',
    'List multiple records from scenario_templates',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('scenario_templates').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing scenario_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_delivery_notes',
    'Create a new record in delivery_notes',
    {
      delivery_note_number: z.string(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      date: z.string(),
      delivery_address: z.string().optional(),
      carrier: z.string().optional(),
      tracking_number: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('delivery_notes').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into delivery_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created delivery_notes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_delivery_notes',
    'Update an existing record in delivery_notes',
    {
      id: z.string().describe('Record UUID to update'),
      delivery_note_number: z.string().optional(),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      date: z.string().optional(),
      delivery_address: z.string().optional(),
      carrier: z.string().optional(),
      tracking_number: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('delivery_notes').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating delivery_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated delivery_notes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_delivery_notes',
    'Delete a record from delivery_notes',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('delivery_notes').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from delivery_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from delivery_notes' }] };
    }
  );

  server.tool(
    'get_delivery_notes',
    'Get a single record from delivery_notes by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('delivery_notes').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from delivery_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_delivery_notes',
    'List multiple records from delivery_notes',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('delivery_notes').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing delivery_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_clients',
    'Create a new record in clients',
    {
      company_name: z.string(),
      contact_name: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      vat_number: z.string().optional(),
      preferred_currency: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
      payment_terms: z.string().optional(),
      tax_id: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      bic_swift: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('clients').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into clients: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created clients record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_clients',
    'Update an existing record in clients',
    {
      id: z.string().describe('Record UUID to update'),
      company_name: z.string().optional(),
      contact_name: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      vat_number: z.string().optional(),
      preferred_currency: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
      payment_terms: z.string().optional(),
      tax_id: z.string().optional(),
      bank_name: z.string().optional(),
      iban: z.string().optional(),
      bic_swift: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('clients').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating clients: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated clients record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_clients',
    'Delete a record from clients',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('clients').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from clients: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from clients' }] };
    }
  );

  server.tool(
    'get_clients',
    'Get a single record from clients by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('clients').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from clients: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_clients',
    'List multiple records from clients',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('clients').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing clients: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_tasks',
    'Create a new record in tasks',
    {
      project_id: z.string().optional().describe('Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>'),
      name: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      estimated_hours: z.number().optional(),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>')
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('tasks').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into tasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created tasks record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_tasks',
    'Update an existing record in tasks',
    {
      id: z.string().describe('Record UUID to update'),
      project_id: z.string().optional().describe('Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>'),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      estimated_hours: z.number().optional(),
      service_id: z.string().optional().describe('Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>')
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('tasks').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating tasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated tasks record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_tasks',
    'Delete a record from tasks',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('tasks').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from tasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from tasks' }] };
    }
  );

  server.tool(
    'get_tasks',
    'Get a single record from tasks by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('tasks').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from tasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_tasks',
    'List multiple records from tasks',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('tasks').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing tasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_report_templates',
    'Create a new record in report_templates',
    {
      name: z.string(),
      description: z.string().optional(),
      template_type: z.string().optional(),
      html_template: z.string().optional(),
      css_styles: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('report_templates').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into report_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created report_templates record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_report_templates',
    'Update an existing record in report_templates',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      description: z.string().optional(),
      template_type: z.string().optional(),
      html_template: z.string().optional(),
      css_styles: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('report_templates').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating report_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated report_templates record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_report_templates',
    'Delete a record from report_templates',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('report_templates').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from report_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from report_templates' }] };
    }
  );

  server.tool(
    'get_report_templates',
    'Get a single record from report_templates by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('report_templates').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from report_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_report_templates',
    'List multiple records from report_templates',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('report_templates').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing report_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payment_allocations',
    'Create a new record in payment_allocations',
    {
      payment_id: z.string().describe('Note: This is a Foreign Key to `payments.id`.<fk table=\'payments\' column=\'id\'/>'),
      invoice_id: z.string().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      amount: z.number()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('payment_allocations').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_allocations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_allocations record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_payment_allocations',
    'Update an existing record in payment_allocations',
    {
      id: z.string().describe('Record UUID to update'),
      payment_id: z.string().optional().describe('Note: This is a Foreign Key to `payments.id`.<fk table=\'payments\' column=\'id\'/>'),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      amount: z.number().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('payment_allocations').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating payment_allocations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated payment_allocations record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_payment_allocations',
    'Delete a record from payment_allocations',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('payment_allocations').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from payment_allocations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payment_allocations' }] };
    }
  );

  server.tool(
    'get_payment_allocations',
    'Get a single record from payment_allocations by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('payment_allocations').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from payment_allocations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_allocations',
    'List multiple records from payment_allocations',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payment_allocations').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing payment_allocations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_locations',
    'Create a new record in supplier_locations',
    {
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      location_name: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      address: z.string().optional(),
      postal_code: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      opening_hours: z.any().optional(),
      is_primary: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('supplier_locations').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_locations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_locations record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_locations',
    'Update an existing record in supplier_locations',
    {
      id: z.string().describe('Record UUID to update'),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      location_name: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      address: z.string().optional(),
      postal_code: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      opening_hours: z.any().optional(),
      is_primary: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_locations').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_locations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_locations record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_locations',
    'Delete a record from supplier_locations',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_locations').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_locations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_locations' }] };
    }
  );

  server.tool(
    'get_supplier_locations',
    'Get a single record from supplier_locations by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_locations').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_locations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_locations',
    'List multiple records from supplier_locations',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_locations').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_locations: ' + error.message }] };
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
      const { data, error } = await supabase.from('invoice_items').insert([payload]).select().single();
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
      let query = supabase.from('invoice_items').update(updates).eq('id', id);
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
    'create_offline_sync_queue',
    'Create a new record in offline_sync_queue',
    {
      action: z.string(),
      resource_type: z.string(),
      resource_id: z.string().optional(),
      payload: z.any().optional(),
      status: z.string().optional(),
      error_message: z.string().optional(),
      synced_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('offline_sync_queue').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into offline_sync_queue: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created offline_sync_queue record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_offline_sync_queue',
    'Update an existing record in offline_sync_queue',
    {
      id: z.string().describe('Record UUID to update'),
      action: z.string().optional(),
      resource_type: z.string().optional(),
      resource_id: z.string().optional(),
      payload: z.any().optional(),
      status: z.string().optional(),
      error_message: z.string().optional(),
      synced_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('offline_sync_queue').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating offline_sync_queue: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated offline_sync_queue record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_offline_sync_queue',
    'Delete a record from offline_sync_queue',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('offline_sync_queue').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from offline_sync_queue: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from offline_sync_queue' }] };
    }
  );

  server.tool(
    'get_offline_sync_queue',
    'Get a single record from offline_sync_queue by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('offline_sync_queue').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from offline_sync_queue: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_offline_sync_queue',
    'List multiple records from offline_sync_queue',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('offline_sync_queue').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing offline_sync_queue: ' + error.message }] };
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
      const { data, error } = await supabase.from('services').insert([payload]).select().single();
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
      let query = supabase.from('services').update(updates).eq('id', id);
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
    'create_consent_logs',
    'Create a new record in consent_logs',
    {
      consent_type: z.string(),
      granted: z.boolean(),
      ip_address: z.string().optional(),
      user_agent: z.string().optional(),
      granted_at: z.string().optional(),
      revoked_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('consent_logs').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into consent_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created consent_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_consent_logs',
    'Update an existing record in consent_logs',
    {
      id: z.string().describe('Record UUID to update'),
      consent_type: z.string().optional(),
      granted: z.boolean().optional(),
      ip_address: z.string().optional(),
      user_agent: z.string().optional(),
      granted_at: z.string().optional(),
      revoked_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('consent_logs').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating consent_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated consent_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_consent_logs',
    'Delete a record from consent_logs',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('consent_logs').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from consent_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from consent_logs' }] };
    }
  );

  server.tool(
    'get_consent_logs',
    'Get a single record from consent_logs by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('consent_logs').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from consent_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_consent_logs',
    'List multiple records from consent_logs',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('consent_logs').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing consent_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_accounting_entries',
    'Create a new record in accounting_entries',
    {
      transaction_date: z.string(),
      description: z.string().optional(),
      reference_id: z.string().optional(),
      reference_type: z.string().optional(),
      account_code: z.string(),
      debit: z.number().optional(),
      credit: z.number().optional(),
      source_type: z.string().optional(),
      source_id: z.string().optional(),
      journal: z.string().optional(),
      entry_ref: z.string().optional(),
      is_auto: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('accounting_entries').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_entries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_entries record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_accounting_entries',
    'Update an existing record in accounting_entries',
    {
      id: z.string().describe('Record UUID to update'),
      transaction_date: z.string().optional(),
      description: z.string().optional(),
      reference_id: z.string().optional(),
      reference_type: z.string().optional(),
      account_code: z.string().optional(),
      debit: z.number().optional(),
      credit: z.number().optional(),
      source_type: z.string().optional(),
      source_id: z.string().optional(),
      journal: z.string().optional(),
      entry_ref: z.string().optional(),
      is_auto: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('accounting_entries').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating accounting_entries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated accounting_entries record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_accounting_entries',
    'Delete a record from accounting_entries',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_entries').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from accounting_entries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from accounting_entries' }] };
    }
  );

  server.tool(
    'get_accounting_entries',
    'Get a single record from accounting_entries by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_entries').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from accounting_entries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_accounting_entries',
    'List multiple records from accounting_entries',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('accounting_entries').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing accounting_entries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_user_accounting_settings',
    'Create a new record in user_accounting_settings',
    {
      country: z.string(),
      is_initialized: z.boolean().optional(),
      auto_journal_enabled: z.boolean().optional(),
      fiscal_year_start: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('user_accounting_settings').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into user_accounting_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created user_accounting_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_user_accounting_settings',
    'Update an existing record in user_accounting_settings',
    {
      id: z.string().describe('Record UUID to update'),
      country: z.string().optional(),
      is_initialized: z.boolean().optional(),
      auto_journal_enabled: z.boolean().optional(),
      fiscal_year_start: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('user_accounting_settings').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating user_accounting_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated user_accounting_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_user_accounting_settings',
    'Delete a record from user_accounting_settings',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('user_accounting_settings').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from user_accounting_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from user_accounting_settings' }] };
    }
  );

  server.tool(
    'get_user_accounting_settings',
    'Get a single record from user_accounting_settings by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('user_accounting_settings').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from user_accounting_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_user_accounting_settings',
    'List multiple records from user_accounting_settings',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('user_accounting_settings').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing user_accounting_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_push_notification_logs',
    'Create a new record in push_notification_logs',
    {
      title: z.string(),
      body: z.string().optional(),
      action_url: z.string().optional(),
      sent_at: z.string().optional(),
      read_at: z.string().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('push_notification_logs').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into push_notification_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created push_notification_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_push_notification_logs',
    'Update an existing record in push_notification_logs',
    {
      id: z.string().describe('Record UUID to update'),
      title: z.string().optional(),
      body: z.string().optional(),
      action_url: z.string().optional(),
      sent_at: z.string().optional(),
      read_at: z.string().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('push_notification_logs').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating push_notification_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated push_notification_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_push_notification_logs',
    'Delete a record from push_notification_logs',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('push_notification_logs').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from push_notification_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from push_notification_logs' }] };
    }
  );

  server.tool(
    'get_push_notification_logs',
    'Get a single record from push_notification_logs by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('push_notification_logs').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from push_notification_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_push_notification_logs',
    'List multiple records from push_notification_logs',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('push_notification_logs').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing push_notification_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_scenario_assumptions',
    'Create a new record in scenario_assumptions',
    {
      scenario_id: z.string().describe('Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>'),
      name: z.string(),
      description: z.string().optional(),
      category: z.string(),
      assumption_type: z.string(),
      parameters: z.any().describe('Flexible JSONB field for storing assumption parameters based on type'),
      start_date: z.string().optional(),
      end_date: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('scenario_assumptions').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_assumptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_assumptions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_scenario_assumptions',
    'Update an existing record in scenario_assumptions',
    {
      id: z.string().describe('Record UUID to update'),
      scenario_id: z.string().optional().describe('Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>'),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      assumption_type: z.string().optional(),
      parameters: z.any().optional().describe('Flexible JSONB field for storing assumption parameters based on type'),
      start_date: z.string().optional(),
      end_date: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('scenario_assumptions').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating scenario_assumptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated scenario_assumptions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_scenario_assumptions',
    'Delete a record from scenario_assumptions',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_assumptions').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from scenario_assumptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from scenario_assumptions' }] };
    }
  );

  server.tool(
    'get_scenario_assumptions',
    'Get a single record from scenario_assumptions by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_assumptions').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from scenario_assumptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_scenario_assumptions',
    'List multiple records from scenario_assumptions',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('scenario_assumptions').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing scenario_assumptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_products',
    'Create a new record in products',
    {
      product_name: z.string(),
      sku: z.string().optional(),
      category_id: z.string().optional().describe('Note: This is a Foreign Key to `product_categories.id`.<fk table=\'product_categories\' column=\'id\'/>'),
      unit_price: z.number().optional(),
      purchase_price: z.number().optional(),
      unit: z.string().optional(),
      stock_quantity: z.number().optional(),
      min_stock_level: z.number().optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>')
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('products').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created products record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_products',
    'Update an existing record in products',
    {
      id: z.string().describe('Record UUID to update'),
      product_name: z.string().optional(),
      sku: z.string().optional(),
      category_id: z.string().optional().describe('Note: This is a Foreign Key to `product_categories.id`.<fk table=\'product_categories\' column=\'id\'/>'),
      unit_price: z.number().optional(),
      purchase_price: z.number().optional(),
      unit: z.string().optional(),
      stock_quantity: z.number().optional(),
      min_stock_level: z.number().optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>')
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('products').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated products record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_products',
    'Delete a record from products',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('products').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from products' }] };
    }
  );

  server.tool(
    'get_products',
    'Get a single record from products by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('products').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_products',
    'List multiple records from products',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('products').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing products: ' + error.message }] };
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
      const { data, error } = await supabase.from('suppliers').insert([payload]).select().single();
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
      let query = supabase.from('suppliers').update(updates).eq('id', id);
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
    'create_subtasks',
    'Create a new record in subtasks',
    {
      task_id: z.string().describe('Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>'),
      title: z.string(),
      status: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('subtasks').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into subtasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created subtasks record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_subtasks',
    'Update an existing record in subtasks',
    {
      id: z.string().describe('Record UUID to update'),
      task_id: z.string().optional().describe('Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>'),
      title: z.string().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('subtasks').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating subtasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated subtasks record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_subtasks',
    'Delete a record from subtasks',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('subtasks').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from subtasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from subtasks' }] };
    }
  );

  server.tool(
    'get_subtasks',
    'Get a single record from subtasks by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('subtasks').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from subtasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_subtasks',
    'List multiple records from subtasks',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('subtasks').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing subtasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_stripe_settings',
    'Create a new record in stripe_settings',
    {
      stripe_customer_id: z.string().optional(),
      stripe_enabled: z.boolean().optional(),
      stripe_publishable_key: z.string().optional(),
      stripe_mode: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('stripe_settings').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into stripe_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created stripe_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_stripe_settings',
    'Update an existing record in stripe_settings',
    {
      id: z.string().describe('Record UUID to update'),
      stripe_customer_id: z.string().optional(),
      stripe_enabled: z.boolean().optional(),
      stripe_publishable_key: z.string().optional(),
      stripe_mode: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('stripe_settings').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating stripe_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated stripe_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_stripe_settings',
    'Delete a record from stripe_settings',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('stripe_settings').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from stripe_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from stripe_settings' }] };
    }
  );

  server.tool(
    'get_stripe_settings',
    'Get a single record from stripe_settings by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('stripe_settings').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from stripe_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_stripe_settings',
    'List multiple records from stripe_settings',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('stripe_settings').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing stripe_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_financial_scenarios',
    'Create a new record in financial_scenarios',
    {
      name: z.string(),
      description: z.string().optional(),
      base_date: z.string(),
      end_date: z.string(),
      status: z.string().optional(),
      is_baseline: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('financial_scenarios').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into financial_scenarios: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created financial_scenarios record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_financial_scenarios',
    'Update an existing record in financial_scenarios',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      description: z.string().optional(),
      base_date: z.string().optional(),
      end_date: z.string().optional(),
      status: z.string().optional(),
      is_baseline: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('financial_scenarios').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating financial_scenarios: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated financial_scenarios record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_financial_scenarios',
    'Delete a record from financial_scenarios',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('financial_scenarios').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from financial_scenarios: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from financial_scenarios' }] };
    }
  );

  server.tool(
    'get_financial_scenarios',
    'Get a single record from financial_scenarios by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('financial_scenarios').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from financial_scenarios: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_financial_scenarios',
    'List multiple records from financial_scenarios',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('financial_scenarios').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing financial_scenarios: ' + error.message }] };
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
      const { data, error } = await supabase.from('payment_reminder_rules').insert([payload]).select().single();
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
      let query = supabase.from('payment_reminder_rules').update(updates).eq('id', id);
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
      const { data, error } = await supabase.from('quotes').insert([payload]).select().single();
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
      let query = supabase.from('quotes').update(updates).eq('id', id);
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
    'create_backup_logs',
    'Create a new record in backup_logs',
    {
      provider: z.string(),
      status: z.string(),
      file_name: z.string().optional(),
      file_size_bytes: z.number().int().optional(),
      error_message: z.string().optional(),
      started_at: z.string().optional(),
      completed_at: z.string().optional(),
      metadata: z.any().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('backup_logs').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into backup_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created backup_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_backup_logs',
    'Update an existing record in backup_logs',
    {
      id: z.string().describe('Record UUID to update'),
      provider: z.string().optional(),
      status: z.string().optional(),
      file_name: z.string().optional(),
      file_size_bytes: z.number().int().optional(),
      error_message: z.string().optional(),
      started_at: z.string().optional(),
      completed_at: z.string().optional(),
      metadata: z.any().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('backup_logs').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating backup_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated backup_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_backup_logs',
    'Delete a record from backup_logs',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('backup_logs').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from backup_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from backup_logs' }] };
    }
  );

  server.tool(
    'get_backup_logs',
    'Get a single record from backup_logs by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('backup_logs').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from backup_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_backup_logs',
    'List multiple records from backup_logs',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('backup_logs').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing backup_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_notification_preferences',
    'Create a new record in notification_preferences',
    {
      email_new_tasks: z.boolean().optional(),
      email_overdue_tasks: z.boolean().optional(),
      email_completed_tasks: z.boolean().optional(),
      email_comments: z.boolean().optional(),
      email_project_updates: z.boolean().optional(),
      email_reminders: z.boolean().optional(),
      push_enabled: z.boolean().optional(),
      push_new_tasks: z.boolean().optional(),
      push_comments: z.boolean().optional(),
      frequency: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('notification_preferences').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into notification_preferences: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created notification_preferences record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_notification_preferences',
    'Update an existing record in notification_preferences',
    {
      id: z.string().describe('Record UUID to update'),
      email_new_tasks: z.boolean().optional(),
      email_overdue_tasks: z.boolean().optional(),
      email_completed_tasks: z.boolean().optional(),
      email_comments: z.boolean().optional(),
      email_project_updates: z.boolean().optional(),
      email_reminders: z.boolean().optional(),
      push_enabled: z.boolean().optional(),
      push_new_tasks: z.boolean().optional(),
      push_comments: z.boolean().optional(),
      frequency: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('notification_preferences').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating notification_preferences: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated notification_preferences record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_notification_preferences',
    'Delete a record from notification_preferences',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('notification_preferences').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from notification_preferences: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from notification_preferences' }] };
    }
  );

  server.tool(
    'get_notification_preferences',
    'Get a single record from notification_preferences by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('notification_preferences').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from notification_preferences: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_notification_preferences',
    'List multiple records from notification_preferences',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('notification_preferences').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing notification_preferences: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_projects',
    'Create a new record in projects',
    {
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      name: z.string(),
      description: z.string().optional(),
      budget_hours: z.number().int().optional(),
      hourly_rate: z.number().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('projects').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into projects: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created projects record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_projects',
    'Update an existing record in projects',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      name: z.string().optional(),
      description: z.string().optional(),
      budget_hours: z.number().int().optional(),
      hourly_rate: z.number().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('projects').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating projects: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated projects record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_projects',
    'Delete a record from projects',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('projects').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from projects: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from projects' }] };
    }
  );

  server.tool(
    'get_projects',
    'Get a single record from projects by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('projects').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from projects: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_projects',
    'List multiple records from projects',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('projects').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing projects: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_accounting_plan_accounts',
    'Create a new record in accounting_plan_accounts',
    {
      plan_id: z.string().describe('Note: This is a Foreign Key to `accounting_plans.id`.<fk table=\'accounting_plans\' column=\'id\'/>'),
      account_code: z.string(),
      account_name: z.string(),
      account_type: z.string(),
      account_category: z.string().optional(),
      parent_code: z.string().optional(),
      description: z.string().optional(),
      is_header: z.boolean().optional(),
      sort_order: z.number().int().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('accounting_plan_accounts').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_plan_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_plan_accounts record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_accounting_plan_accounts',
    'Update an existing record in accounting_plan_accounts',
    {
      id: z.string().describe('Record UUID to update'),
      plan_id: z.string().optional().describe('Note: This is a Foreign Key to `accounting_plans.id`.<fk table=\'accounting_plans\' column=\'id\'/>'),
      account_code: z.string().optional(),
      account_name: z.string().optional(),
      account_type: z.string().optional(),
      account_category: z.string().optional(),
      parent_code: z.string().optional(),
      description: z.string().optional(),
      is_header: z.boolean().optional(),
      sort_order: z.number().int().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('accounting_plan_accounts').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating accounting_plan_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated accounting_plan_accounts record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_accounting_plan_accounts',
    'Delete a record from accounting_plan_accounts',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_plan_accounts').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from accounting_plan_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from accounting_plan_accounts' }] };
    }
  );

  server.tool(
    'get_accounting_plan_accounts',
    'Get a single record from accounting_plan_accounts by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_plan_accounts').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from accounting_plan_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_accounting_plan_accounts',
    'List multiple records from accounting_plan_accounts',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('accounting_plan_accounts').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing accounting_plan_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_accounting_mappings',
    'Create a new record in accounting_mappings',
    {
      mapping_name: z.string().optional().describe('Optional user-friendly name for the mapping'),
      description: z.string().optional(),
      source_type: z.string(),
      source_category: z.string().optional(),
      debit_account_code: z.string().optional(),
      credit_account_code: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('accounting_mappings').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_mappings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_mappings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_accounting_mappings',
    'Update an existing record in accounting_mappings',
    {
      id: z.string().describe('Record UUID to update'),
      mapping_name: z.string().optional().describe('Optional user-friendly name for the mapping'),
      description: z.string().optional(),
      source_type: z.string().optional(),
      source_category: z.string().optional(),
      debit_account_code: z.string().optional(),
      credit_account_code: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('accounting_mappings').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating accounting_mappings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated accounting_mappings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_accounting_mappings',
    'Delete a record from accounting_mappings',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_mappings').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from accounting_mappings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from accounting_mappings' }] };
    }
  );

  server.tool(
    'get_accounting_mappings',
    'Get a single record from accounting_mappings by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_mappings').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from accounting_mappings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_accounting_mappings',
    'List multiple records from accounting_mappings',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('accounting_mappings').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing accounting_mappings: ' + error.message }] };
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
      const { data, error } = await supabase.from('bank_statements').insert([payload]).select().single();
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
      let query = supabase.from('bank_statements').update(updates).eq('id', id);
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
    'create_product_barcodes',
    'Create a new record in product_barcodes',
    {
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      barcode: z.string(),
      barcode_type: z.string()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('product_barcodes').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into product_barcodes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created product_barcodes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_product_barcodes',
    'Update an existing record in product_barcodes',
    {
      id: z.string().describe('Record UUID to update'),
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      barcode: z.string().optional(),
      barcode_type: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('product_barcodes').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating product_barcodes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated product_barcodes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_product_barcodes',
    'Delete a record from product_barcodes',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('product_barcodes').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from product_barcodes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from product_barcodes' }] };
    }
  );

  server.tool(
    'get_product_barcodes',
    'Get a single record from product_barcodes by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('product_barcodes').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from product_barcodes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_product_barcodes',
    'List multiple records from product_barcodes',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('product_barcodes').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing product_barcodes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_credit_transactions',
    'Create a new record in credit_transactions',
    {
      type: z.string(),
      amount: z.number().int(),
      description: z.string().optional(),
      stripe_session_id: z.string().optional(),
      stripe_payment_intent: z.string().optional(),
      metadata: z.any().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('credit_transactions').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_transactions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_credit_transactions',
    'Update an existing record in credit_transactions',
    {
      id: z.string().describe('Record UUID to update'),
      type: z.string().optional(),
      amount: z.number().int().optional(),
      description: z.string().optional(),
      stripe_session_id: z.string().optional(),
      stripe_payment_intent: z.string().optional(),
      metadata: z.any().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('credit_transactions').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating credit_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated credit_transactions record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_credit_transactions',
    'Delete a record from credit_transactions',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('credit_transactions').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from credit_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from credit_transactions' }] };
    }
  );

  server.tool(
    'get_credit_transactions',
    'Get a single record from credit_transactions by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('credit_transactions').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from credit_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_credit_transactions',
    'List multiple records from credit_transactions',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('credit_transactions').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing credit_transactions: ' + error.message }] };
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
      const { data, error } = await supabase.from('supplier_order_items').insert([payload]).select().single();
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
      let query = supabase.from('supplier_order_items').update(updates).eq('id', id);
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
    'create_invoices',
    'Create a new record in invoices',
    {
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      invoice_number: z.string(),
      date: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      total_ht: z.number().optional(),
      tax_rate: z.number().optional(),
      total_ttc: z.number().optional(),
      notes: z.string().optional(),
      payment_terms_id: z.string().optional().describe('Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>'),
      conditions: z.string().optional(),
      discount_type: z.string().optional(),
      discount_value: z.number().optional(),
      discount_amount: z.number().optional(),
      amount_paid: z.number().optional(),
      balance_due: z.number().optional(),
      payment_status: z.string().optional(),
      shipping_fee: z.number().optional(),
      adjustment: z.number().optional(),
      adjustment_label: z.string().optional(),
      header_note: z.string().optional(),
      footer_note: z.string().optional(),
      terms_and_conditions: z.string().optional(),
      internal_remark: z.string().optional(),
      attached_image_url: z.string().optional(),
      custom_fields: z.any().optional(),
      reference: z.string().optional(),
      invoice_type: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('invoices').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created invoices record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_invoices',
    'Update an existing record in invoices',
    {
      id: z.string().describe('Record UUID to update'),
      client_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      invoice_number: z.string().optional(),
      date: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      total_ht: z.number().optional(),
      tax_rate: z.number().optional(),
      total_ttc: z.number().optional(),
      notes: z.string().optional(),
      payment_terms_id: z.string().optional().describe('Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>'),
      conditions: z.string().optional(),
      discount_type: z.string().optional(),
      discount_value: z.number().optional(),
      discount_amount: z.number().optional(),
      amount_paid: z.number().optional(),
      balance_due: z.number().optional(),
      payment_status: z.string().optional(),
      shipping_fee: z.number().optional(),
      adjustment: z.number().optional(),
      adjustment_label: z.string().optional(),
      header_note: z.string().optional(),
      footer_note: z.string().optional(),
      terms_and_conditions: z.string().optional(),
      internal_remark: z.string().optional(),
      attached_image_url: z.string().optional(),
      custom_fields: z.any().optional(),
      reference: z.string().optional(),
      invoice_type: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('invoices').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated invoices record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_invoices',
    'Delete a record from invoices',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('invoices').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from invoices' }] };
    }
  );

  server.tool(
    'get_invoices',
    'Get a single record from invoices by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('invoices').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_invoices',
    'List multiple records from invoices',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('invoices').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_product_stock_history',
    'Create a new record in product_stock_history',
    {
      product_id: z.string().optional(),
      user_product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      previous_quantity: z.number().optional(),
      new_quantity: z.number().optional(),
      change_quantity: z.number().optional(),
      reason: z.string().optional(),
      notes: z.string().optional(),
      order_id: z.string().optional(),
      created_by: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('product_stock_history').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into product_stock_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created product_stock_history record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_product_stock_history',
    'Update an existing record in product_stock_history',
    {
      id: z.string().describe('Record UUID to update'),
      product_id: z.string().optional(),
      user_product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      previous_quantity: z.number().optional(),
      new_quantity: z.number().optional(),
      change_quantity: z.number().optional(),
      reason: z.string().optional(),
      notes: z.string().optional(),
      order_id: z.string().optional(),
      created_by: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('product_stock_history').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating product_stock_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated product_stock_history record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_product_stock_history',
    'Delete a record from product_stock_history',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('product_stock_history').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from product_stock_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from product_stock_history' }] };
    }
  );

  server.tool(
    'get_product_stock_history',
    'Get a single record from product_stock_history by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('product_stock_history').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from product_stock_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_product_stock_history',
    'List multiple records from product_stock_history',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('product_stock_history').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing product_stock_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_scenario_comparisons',
    'Create a new record in scenario_comparisons',
    {
      name: z.string(),
      scenario_ids: z.array(z.any()),
      comparison_metrics: z.any().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('scenario_comparisons').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_comparisons: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_comparisons record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_scenario_comparisons',
    'Update an existing record in scenario_comparisons',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      scenario_ids: z.array(z.any()).optional(),
      comparison_metrics: z.any().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('scenario_comparisons').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating scenario_comparisons: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated scenario_comparisons record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_scenario_comparisons',
    'Delete a record from scenario_comparisons',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_comparisons').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from scenario_comparisons: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from scenario_comparisons' }] };
    }
  );

  server.tool(
    'get_scenario_comparisons',
    'Get a single record from scenario_comparisons by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('scenario_comparisons').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from scenario_comparisons: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_scenario_comparisons',
    'List multiple records from scenario_comparisons',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('scenario_comparisons').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing scenario_comparisons: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_invoice_line_items',
    'Create a new record in supplier_invoice_line_items',
    {
      invoice_id: z.string().describe('Note: This is a Foreign Key to `supplier_invoices.id`.<fk table=\'supplier_invoices\' column=\'id\'/>'),
      description: z.string(),
      quantity: z.number().optional(),
      unit_price: z.number().optional(),
      total: z.number().optional(),
      sort_order: z.number().int().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('supplier_invoice_line_items').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_invoice_line_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_invoice_line_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_invoice_line_items',
    'Update an existing record in supplier_invoice_line_items',
    {
      id: z.string().describe('Record UUID to update'),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_invoices.id`.<fk table=\'supplier_invoices\' column=\'id\'/>'),
      description: z.string().optional(),
      quantity: z.number().optional(),
      unit_price: z.number().optional(),
      total: z.number().optional(),
      sort_order: z.number().int().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_invoice_line_items').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_invoice_line_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_invoice_line_items record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_invoice_line_items',
    'Delete a record from supplier_invoice_line_items',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_invoice_line_items').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_invoice_line_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_invoice_line_items' }] };
    }
  );

  server.tool(
    'get_supplier_invoice_line_items',
    'Get a single record from supplier_invoice_line_items by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_invoice_line_items').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_invoice_line_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_invoice_line_items',
    'List multiple records from supplier_invoice_line_items',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_invoice_line_items').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_invoice_line_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_accounting_chart_of_accounts',
    'Create a new record in accounting_chart_of_accounts',
    {
      account_code: z.string(),
      account_name: z.string(),
      account_type: z.string(),
      account_category: z.string().optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      parent_code: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('accounting_chart_of_accounts').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_chart_of_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_chart_of_accounts record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_accounting_chart_of_accounts',
    'Update an existing record in accounting_chart_of_accounts',
    {
      id: z.string().describe('Record UUID to update'),
      account_code: z.string().optional(),
      account_name: z.string().optional(),
      account_type: z.string().optional(),
      account_category: z.string().optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      parent_code: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('accounting_chart_of_accounts').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating accounting_chart_of_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated accounting_chart_of_accounts record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_accounting_chart_of_accounts',
    'Delete a record from accounting_chart_of_accounts',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_chart_of_accounts').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from accounting_chart_of_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from accounting_chart_of_accounts' }] };
    }
  );

  server.tool(
    'get_accounting_chart_of_accounts',
    'Get a single record from accounting_chart_of_accounts by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_chart_of_accounts').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from accounting_chart_of_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_accounting_chart_of_accounts',
    'List multiple records from accounting_chart_of_accounts',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('accounting_chart_of_accounts').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing accounting_chart_of_accounts: ' + error.message }] };
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
      const { data, error } = await supabase.from('supplier_orders').insert([payload]).select().single();
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
      let query = supabase.from('supplier_orders').update(updates).eq('id', id);
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
    'create_barcode_scan_logs',
    'Create a new record in barcode_scan_logs',
    {
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      barcode: z.string(),
      scan_timestamp: z.string().optional(),
      location: z.string().optional(),
      quantity: z.number().optional(),
      action: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('barcode_scan_logs').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into barcode_scan_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created barcode_scan_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_barcode_scan_logs',
    'Update an existing record in barcode_scan_logs',
    {
      id: z.string().describe('Record UUID to update'),
      product_id: z.string().optional().describe('Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>'),
      barcode: z.string().optional(),
      scan_timestamp: z.string().optional(),
      location: z.string().optional(),
      quantity: z.number().optional(),
      action: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('barcode_scan_logs').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating barcode_scan_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated barcode_scan_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_barcode_scan_logs',
    'Delete a record from barcode_scan_logs',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('barcode_scan_logs').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from barcode_scan_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from barcode_scan_logs' }] };
    }
  );

  server.tool(
    'get_barcode_scan_logs',
    'Get a single record from barcode_scan_logs by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('barcode_scan_logs').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from barcode_scan_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_barcode_scan_logs',
    'List multiple records from barcode_scan_logs',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('barcode_scan_logs').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing barcode_scan_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_data_export_requests',
    'Create a new record in data_export_requests',
    {
      status: z.string(),
      file_url: z.string().optional(),
      file_size: z.number().int().optional(),
      requested_at: z.string().optional(),
      completed_at: z.string().optional(),
      expires_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('data_export_requests').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into data_export_requests: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created data_export_requests record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_data_export_requests',
    'Update an existing record in data_export_requests',
    {
      id: z.string().describe('Record UUID to update'),
      status: z.string().optional(),
      file_url: z.string().optional(),
      file_size: z.number().int().optional(),
      requested_at: z.string().optional(),
      completed_at: z.string().optional(),
      expires_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('data_export_requests').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating data_export_requests: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated data_export_requests record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_data_export_requests',
    'Delete a record from data_export_requests',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('data_export_requests').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from data_export_requests: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from data_export_requests' }] };
    }
  );

  server.tool(
    'get_data_export_requests',
    'Get a single record from data_export_requests by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('data_export_requests').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from data_export_requests: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_data_export_requests',
    'List multiple records from data_export_requests',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('data_export_requests').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing data_export_requests: ' + error.message }] };
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
      const { data, error } = await supabase.from('service_categories').insert([payload]).select().single();
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
      let query = supabase.from('service_categories').update(updates).eq('id', id);
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
    'create_webhook_endpoints',
    'Create a new record in webhook_endpoints',
    {
      url: z.string(),
      secret: z.string(),
      events: z.array(z.any()),
      is_active: z.boolean().optional(),
      last_triggered_at: z.string().optional(),
      failure_count: z.number().int().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('webhook_endpoints').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into webhook_endpoints: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created webhook_endpoints record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_webhook_endpoints',
    'Update an existing record in webhook_endpoints',
    {
      id: z.string().describe('Record UUID to update'),
      url: z.string().optional(),
      secret: z.string().optional(),
      events: z.array(z.any()).optional(),
      is_active: z.boolean().optional(),
      last_triggered_at: z.string().optional(),
      failure_count: z.number().int().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('webhook_endpoints').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating webhook_endpoints: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated webhook_endpoints record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_webhook_endpoints',
    'Delete a record from webhook_endpoints',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('webhook_endpoints').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from webhook_endpoints: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from webhook_endpoints' }] };
    }
  );

  server.tool(
    'get_webhook_endpoints',
    'Get a single record from webhook_endpoints by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('webhook_endpoints').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from webhook_endpoints: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_webhook_endpoints',
    'List multiple records from webhook_endpoints',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('webhook_endpoints').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing webhook_endpoints: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_delivery_routes',
    'Create a new record in delivery_routes',
    {
      order_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>'),
      supplier_location_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_locations.id`.<fk table=\'supplier_locations\' column=\'id\'/>'),
      delivery_location_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      route_distance: z.number().optional(),
      estimated_duration: z.number().optional(),
      actual_duration: z.number().optional(),
      route_polyline: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('delivery_routes').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into delivery_routes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created delivery_routes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_delivery_routes',
    'Update an existing record in delivery_routes',
    {
      id: z.string().describe('Record UUID to update'),
      order_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>'),
      supplier_location_id: z.string().optional().describe('Note: This is a Foreign Key to `supplier_locations.id`.<fk table=\'supplier_locations\' column=\'id\'/>'),
      delivery_location_id: z.string().optional().describe('Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>'),
      route_distance: z.number().optional(),
      estimated_duration: z.number().optional(),
      actual_duration: z.number().optional(),
      route_polyline: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('delivery_routes').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating delivery_routes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated delivery_routes record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_delivery_routes',
    'Delete a record from delivery_routes',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('delivery_routes').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from delivery_routes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from delivery_routes' }] };
    }
  );

  server.tool(
    'get_delivery_routes',
    'Get a single record from delivery_routes by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('delivery_routes').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from delivery_routes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_delivery_routes',
    'List multiple records from delivery_routes',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('delivery_routes').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing delivery_routes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_billing_info',
    'Create a new record in billing_info',
    {
      company_name: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
      vat_number: z.string().optional(),
      siret: z.string().optional(),
      plan: z.string().optional(),
      plan_price: z.number().optional(),
      plan_interval: z.string().optional(),
      next_billing_date: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('billing_info').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into billing_info: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created billing_info record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_billing_info',
    'Update an existing record in billing_info',
    {
      id: z.string().describe('Record UUID to update'),
      company_name: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
      vat_number: z.string().optional(),
      siret: z.string().optional(),
      plan: z.string().optional(),
      plan_price: z.number().optional(),
      plan_interval: z.string().optional(),
      next_billing_date: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('billing_info').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating billing_info: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated billing_info record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_billing_info',
    'Delete a record from billing_info',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('billing_info').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from billing_info: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from billing_info' }] };
    }
  );

  server.tool(
    'get_billing_info',
    'Get a single record from billing_info by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('billing_info').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from billing_info: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_billing_info',
    'List multiple records from billing_info',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('billing_info').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing billing_info: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payment_reminder_logs',
    'Create a new record in payment_reminder_logs',
    {
      invoice_id: z.string().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      rule_id: z.string().optional().describe('Note: This is a Foreign Key to `payment_reminder_rules.id`.<fk table=\'payment_reminder_rules\' column=\'id\'/>'),
      reminder_number: z.number().int(),
      sent_at: z.string().optional(),
      status: z.string().optional(),
      recipient_email: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('payment_reminder_logs').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_reminder_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_reminder_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_payment_reminder_logs',
    'Update an existing record in payment_reminder_logs',
    {
      id: z.string().describe('Record UUID to update'),
      invoice_id: z.string().optional().describe('Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>'),
      rule_id: z.string().optional().describe('Note: This is a Foreign Key to `payment_reminder_rules.id`.<fk table=\'payment_reminder_rules\' column=\'id\'/>'),
      reminder_number: z.number().int().optional(),
      sent_at: z.string().optional(),
      status: z.string().optional(),
      recipient_email: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('payment_reminder_logs').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating payment_reminder_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated payment_reminder_logs record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_payment_reminder_logs',
    'Delete a record from payment_reminder_logs',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('payment_reminder_logs').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from payment_reminder_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from payment_reminder_logs' }] };
    }
  );

  server.tool(
    'get_payment_reminder_logs',
    'Get a single record from payment_reminder_logs by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('payment_reminder_logs').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from payment_reminder_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_payment_reminder_logs',
    'List multiple records from payment_reminder_logs',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('payment_reminder_logs').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing payment_reminder_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_webhook_deliveries',
    'Create a new record in webhook_deliveries',
    {
      webhook_endpoint_id: z.string().describe('Note: This is a Foreign Key to `webhook_endpoints.id`.<fk table=\'webhook_endpoints\' column=\'id\'/>'),
      event: z.string(),
      payload: z.any(),
      status_code: z.number().int().optional(),
      response_body: z.string().optional(),
      delivered: z.boolean().optional(),
      attempts: z.number().int().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('webhook_deliveries').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into webhook_deliveries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created webhook_deliveries record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_webhook_deliveries',
    'Update an existing record in webhook_deliveries',
    {
      id: z.string().describe('Record UUID to update'),
      webhook_endpoint_id: z.string().optional().describe('Note: This is a Foreign Key to `webhook_endpoints.id`.<fk table=\'webhook_endpoints\' column=\'id\'/>'),
      event: z.string().optional(),
      payload: z.any().optional(),
      status_code: z.number().int().optional(),
      response_body: z.string().optional(),
      delivered: z.boolean().optional(),
      attempts: z.number().int().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('webhook_deliveries').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating webhook_deliveries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated webhook_deliveries record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_webhook_deliveries',
    'Delete a record from webhook_deliveries',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('webhook_deliveries').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from webhook_deliveries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from webhook_deliveries' }] };
    }
  );

  server.tool(
    'get_webhook_deliveries',
    'Get a single record from webhook_deliveries by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('webhook_deliveries').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from webhook_deliveries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_webhook_deliveries',
    'List multiple records from webhook_deliveries',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('webhook_deliveries').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing webhook_deliveries: ' + error.message }] };
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
      const { data, error } = await supabase.from('company').insert([payload]).select().single();
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
      let query = supabase.from('company').update(updates).eq('id', id);
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
      const { data, error } = await supabase.from('bank_transactions').insert([payload]).select().single();
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
      let query = supabase.from('bank_transactions').update(updates).eq('id', id);
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
      const { data, error } = await supabase.from('payment_terms').insert([payload]).select().single();
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
      let query = supabase.from('payment_terms').update(updates).eq('id', id);
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
      const { data, error } = await supabase.from('credit_notes').insert([payload]).select().single();
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
      let query = supabase.from('credit_notes').update(updates).eq('id', id);
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
    'create_supplier_reports_cache',
    'Create a new record in supplier_reports_cache',
    {
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      report_type: z.string(),
      period: z.string(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      data: z.any().optional(),
      generated_at: z.string().optional(),
      expires_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('supplier_reports_cache').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_reports_cache: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_reports_cache record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_reports_cache',
    'Update an existing record in supplier_reports_cache',
    {
      id: z.string().describe('Record UUID to update'),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      report_type: z.string().optional(),
      period: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      data: z.any().optional(),
      generated_at: z.string().optional(),
      expires_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_reports_cache').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_reports_cache: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_reports_cache record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_reports_cache',
    'Delete a record from supplier_reports_cache',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_reports_cache').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_reports_cache: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_reports_cache' }] };
    }
  );

  server.tool(
    'get_supplier_reports_cache',
    'Get a single record from supplier_reports_cache by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_reports_cache').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_reports_cache: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_reports_cache',
    'List multiple records from supplier_reports_cache',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_reports_cache').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_reports_cache: ' + error.message }] };
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
      const { data, error } = await supabase.from('bank_reconciliation_sessions').insert([payload]).select().single();
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
      let query = supabase.from('bank_reconciliation_sessions').update(updates).eq('id', id);
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
    'create_biometric_credentials',
    'Create a new record in biometric_credentials',
    {
      biometric_type: z.string(),
      device_id: z.string().optional(),
      public_key: z.string(),
      last_used_at: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('biometric_credentials').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into biometric_credentials: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created biometric_credentials record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_biometric_credentials',
    'Update an existing record in biometric_credentials',
    {
      id: z.string().describe('Record UUID to update'),
      biometric_type: z.string().optional(),
      device_id: z.string().optional(),
      public_key: z.string().optional(),
      last_used_at: z.string().optional(),
      is_active: z.boolean().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('biometric_credentials').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating biometric_credentials: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated biometric_credentials record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_biometric_credentials',
    'Delete a record from biometric_credentials',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('biometric_credentials').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from biometric_credentials: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from biometric_credentials' }] };
    }
  );

  server.tool(
    'get_biometric_credentials',
    'Get a single record from biometric_credentials by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('biometric_credentials').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from biometric_credentials: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_biometric_credentials',
    'List multiple records from biometric_credentials',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('biometric_credentials').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing biometric_credentials: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_bank_sync_history',
    'Create a new record in bank_sync_history',
    {
      bank_connection_id: z.string().describe('Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>'),
      sync_type: z.string().optional(),
      status: z.string().optional(),
      transactions_synced: z.number().int().optional(),
      error_message: z.string().optional(),
      started_at: z.string().optional(),
      completed_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('bank_sync_history').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_sync_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_sync_history record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_bank_sync_history',
    'Update an existing record in bank_sync_history',
    {
      id: z.string().describe('Record UUID to update'),
      bank_connection_id: z.string().optional().describe('Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>'),
      sync_type: z.string().optional(),
      status: z.string().optional(),
      transactions_synced: z.number().int().optional(),
      error_message: z.string().optional(),
      started_at: z.string().optional(),
      completed_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('bank_sync_history').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating bank_sync_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated bank_sync_history record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_bank_sync_history',
    'Delete a record from bank_sync_history',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('bank_sync_history').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from bank_sync_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from bank_sync_history' }] };
    }
  );

  server.tool(
    'get_bank_sync_history',
    'Get a single record from bank_sync_history by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('bank_sync_history').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from bank_sync_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_bank_sync_history',
    'List multiple records from bank_sync_history',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('bank_sync_history').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing bank_sync_history: ' + error.message }] };
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
      const { data, error } = await supabase.from('expenses').insert([payload]).select().single();
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
      let query = supabase.from('expenses').update(updates).eq('id', id);
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
    'create_api_keys',
    'Create a new record in api_keys',
    {
      key_hash: z.string(),
      key_prefix: z.string(),
      name: z.string().optional(),
      is_active: z.boolean().optional(),
      expires_at: z.string().optional(),
      last_used_at: z.string().optional(),
      scopes: z.array(z.any()).optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('api_keys').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into api_keys: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created api_keys record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_api_keys',
    'Update an existing record in api_keys',
    {
      id: z.string().describe('Record UUID to update'),
      key_hash: z.string().optional(),
      key_prefix: z.string().optional(),
      name: z.string().optional(),
      is_active: z.boolean().optional(),
      expires_at: z.string().optional(),
      last_used_at: z.string().optional(),
      scopes: z.array(z.any()).optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('api_keys').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating api_keys: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated api_keys record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_api_keys',
    'Delete a record from api_keys',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('api_keys').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from api_keys: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from api_keys' }] };
    }
  );

  server.tool(
    'get_api_keys',
    'Get a single record from api_keys by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('api_keys').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from api_keys: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_api_keys',
    'List multiple records from api_keys',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('api_keys').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing api_keys: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_backup_settings',
    'Create a new record in backup_settings',
    {
      provider: z.string().optional(),
      is_enabled: z.boolean().optional(),
      frequency: z.string().optional(),
      last_backup_at: z.string().optional(),
      next_backup_at: z.string().optional(),
      access_token: z.string().optional(),
      refresh_token: z.string().optional(),
      token_expires_at: z.string().optional(),
      folder_id: z.string().optional(),
      folder_name: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('backup_settings').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into backup_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created backup_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_backup_settings',
    'Update an existing record in backup_settings',
    {
      id: z.string().describe('Record UUID to update'),
      provider: z.string().optional(),
      is_enabled: z.boolean().optional(),
      frequency: z.string().optional(),
      last_backup_at: z.string().optional(),
      next_backup_at: z.string().optional(),
      access_token: z.string().optional(),
      refresh_token: z.string().optional(),
      token_expires_at: z.string().optional(),
      folder_id: z.string().optional(),
      folder_name: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('backup_settings').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating backup_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated backup_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_backup_settings',
    'Delete a record from backup_settings',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('backup_settings').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from backup_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from backup_settings' }] };
    }
  );

  server.tool(
    'get_backup_settings',
    'Get a single record from backup_settings by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('backup_settings').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from backup_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_backup_settings',
    'List multiple records from backup_settings',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('backup_settings').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing backup_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_supplier_services',
    'Create a new record in supplier_services',
    {
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      service_name: z.string(),
      description: z.string().optional(),
      pricing_type: z.string().optional(),
      hourly_rate: z.number().optional(),
      fixed_price: z.number().optional(),
      unit: z.string().optional(),
      availability: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('supplier_services').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_services record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_supplier_services',
    'Update an existing record in supplier_services',
    {
      id: z.string().describe('Record UUID to update'),
      supplier_id: z.string().optional().describe('Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>'),
      service_name: z.string().optional(),
      description: z.string().optional(),
      pricing_type: z.string().optional(),
      hourly_rate: z.number().optional(),
      fixed_price: z.number().optional(),
      unit: z.string().optional(),
      availability: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('supplier_services').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating supplier_services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated supplier_services record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_supplier_services',
    'Delete a record from supplier_services',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_services').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from supplier_services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from supplier_services' }] };
    }
  );

  server.tool(
    'get_supplier_services',
    'Get a single record from supplier_services by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('supplier_services').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from supplier_services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_supplier_services',
    'List multiple records from supplier_services',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('supplier_services').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing supplier_services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_debt_payments',
    'Create a new record in debt_payments',
    {
      record_type: z.string(),
      record_id: z.string(),
      amount: z.number(),
      payment_date: z.string(),
      payment_method: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('debt_payments').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into debt_payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created debt_payments record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_debt_payments',
    'Update an existing record in debt_payments',
    {
      id: z.string().describe('Record UUID to update'),
      record_type: z.string().optional(),
      record_id: z.string().optional(),
      amount: z.number().optional(),
      payment_date: z.string().optional(),
      payment_method: z.string().optional(),
      notes: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('debt_payments').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating debt_payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated debt_payments record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_debt_payments',
    'Delete a record from debt_payments',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('debt_payments').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from debt_payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from debt_payments' }] };
    }
  );

  server.tool(
    'get_debt_payments',
    'Get a single record from debt_payments by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('debt_payments').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from debt_payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_debt_payments',
    'List multiple records from debt_payments',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('debt_payments').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing debt_payments: ' + error.message }] };
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
      const { data, error } = await supabase.from('receivables').insert([payload]).select().single();
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
      let query = supabase.from('receivables').update(updates).eq('id', id);
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
      const { data, error } = await supabase.from('bank_statement_lines').insert([payload]).select().single();
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
      let query = supabase.from('bank_statement_lines').update(updates).eq('id', id);
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
      const { data, error } = await supabase.from('accounting_tax_rates').insert([payload]).select().single();
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
      let query = supabase.from('accounting_tax_rates').update(updates).eq('id', id);
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
      const { data, error } = await supabase.from('recurring_invoices').insert([payload]).select().single();
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
      let query = supabase.from('recurring_invoices').update(updates).eq('id', id);
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
    'create_product_categories',
    'Create a new record in product_categories',
    {
      name: z.string(),
      description: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('product_categories').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created product_categories record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_product_categories',
    'Update an existing record in product_categories',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      description: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('product_categories').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated product_categories record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_product_categories',
    'Delete a record from product_categories',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('product_categories').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from product_categories' }] };
    }
  );

  server.tool(
    'get_product_categories',
    'Get a single record from product_categories by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('product_categories').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_product_categories',
    'List multiple records from product_categories',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('product_categories').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing product_categories: ' + error.message }] };
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
      const { data, error } = await supabase.from('purchase_orders').insert([payload]).select().single();
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
      let query = supabase.from('purchase_orders').update(updates).eq('id', id);
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
    'create_accounting_plans',
    'Create a new record in accounting_plans',
    {
      name: z.string(),
      country_code: z.string().optional(),
      description: z.string().optional(),
      source: z.string().optional(),
      uploaded_by: z.string().optional(),
      is_global: z.boolean().optional(),
      file_url: z.string().optional(),
      accounts_count: z.number().int().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      const { data, error } = await supabase.from('accounting_plans').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_plans: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_plans record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_accounting_plans',
    'Update an existing record in accounting_plans',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      country_code: z.string().optional(),
      description: z.string().optional(),
      source: z.string().optional(),
      uploaded_by: z.string().optional(),
      is_global: z.boolean().optional(),
      file_url: z.string().optional(),
      accounts_count: z.number().int().optional(),
      status: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('accounting_plans').update(updates).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating accounting_plans: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated accounting_plans record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_accounting_plans',
    'Delete a record from accounting_plans',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_plans').delete().eq('id', id);
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from accounting_plans: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from accounting_plans' }] };
    }
  );

  server.tool(
    'get_accounting_plans',
    'Get a single record from accounting_plans by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('accounting_plans').select('*').eq('id', id);
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from accounting_plans: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_accounting_plans',
    'List multiple records from accounting_plans',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('accounting_plans').select('*');
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing accounting_plans: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_notifications',
    'Create a new record in notifications',
    {
      type: z.string().optional(),
      message: z.string().optional(),
      title: z.string().optional(),
      is_read: z.boolean().optional(),
      read_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('notifications').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into notifications: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created notifications record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_notifications',
    'Update an existing record in notifications',
    {
      id: z.string().describe('Record UUID to update'),
      type: z.string().optional(),
      message: z.string().optional(),
      title: z.string().optional(),
      is_read: z.boolean().optional(),
      read_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('notifications').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating notifications: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated notifications record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_notifications',
    'Delete a record from notifications',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('notifications').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from notifications: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from notifications' }] };
    }
  );

  server.tool(
    'get_notifications',
    'Get a single record from notifications by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('notifications').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from notifications: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_notifications',
    'List multiple records from notifications',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('notifications').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing notifications: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_team_members',
    'Create a new record in team_members',
    {
      name: z.string(),
      email: z.string(),
      role: z.string().optional(),
      joined_at: z.string().optional()
    },
    async (args) => {
      const payload = { ...args } as Record<string, any>;
      payload.user_id = getUserId();
      const { data, error } = await supabase.from('team_members').insert([payload]).select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into team_members: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created team_members record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_team_members',
    'Update an existing record in team_members',
    {
      id: z.string().describe('Record UUID to update'),
      name: z.string().optional(),
      email: z.string().optional(),
      role: z.string().optional(),
      joined_at: z.string().optional()
    },
    async (args) => {
      const { id, ...updates } = args;
      let query = supabase.from('team_members').update(updates).eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.select().single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error updating team_members: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully updated team_members record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_team_members',
    'Delete a record from team_members',
    {
      id: z.string().describe('Record UUID to delete')
    },
    async ({ id }) => {
      let query = supabase.from('team_members').delete().eq('id', id);
      query = query.eq('user_id', getUserId());
      const { error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from team_members: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from team_members' }] };
    }
  );

  server.tool(
    'get_team_members',
    'Get a single record from team_members by ID',
    {
      id: z.string().describe('Record UUID to fetch')
    },
    async ({ id }) => {
      let query = supabase.from('team_members').select('*').eq('id', id);
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.single();
      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from team_members: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'list_team_members',
    'List multiple records from team_members',
    {
      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),
      offset: z.number().optional().describe('Number of records to skip (default 0)')
    },
    async ({ limit = 50, offset = 0 }) => {
      let query = supabase.from('team_members').select('*');
      query = query.eq('user_id', getUserId());
      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);
      if (error) return { content: [{ type: 'text' as const, text: 'Error listing team_members: ' + error.message }] };
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
      const { data, error } = await supabase.from('invoice_settings').insert([payload]).select().single();
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
      let query = supabase.from('invoice_settings').update(updates).eq('id', id);
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
