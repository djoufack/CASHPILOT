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
      const { data, error } = await supabase
        .from('credit_packages')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_packages: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_packages record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_products')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_products record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('credit_note_items')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_note_items record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('payments')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payments record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('scenario_results')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_results: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_results record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('referrals')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into referrals: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created referrals record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('push_subscriptions')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into push_subscriptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created push_subscriptions record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('user_credits')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into user_credits: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created user_credits record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('delivery_note_items')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into delivery_note_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created delivery_note_items record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('stock_alerts')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into stock_alerts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created stock_alerts record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('bank_connections')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_connections: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_connections record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_invoices')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_invoices record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('payables')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payables record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('timesheets')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into timesheets: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created timesheets record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_product_categories')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_product_categories record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('scenario_templates')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_templates record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('delivery_notes')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into delivery_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created delivery_notes record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('clients')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into clients: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created clients record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('tasks')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into tasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created tasks record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('report_templates')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into report_templates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created report_templates record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('payment_allocations')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_allocations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_allocations record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_locations')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_locations: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_locations record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('invoice_items')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into invoice_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created invoice_items record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('offline_sync_queue')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into offline_sync_queue: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created offline_sync_queue record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('services')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created services record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('consent_logs')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into consent_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created consent_logs record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('accounting_entries')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_entries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_entries record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('user_accounting_settings')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into user_accounting_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created user_accounting_settings record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('push_notification_logs')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into push_notification_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created push_notification_logs record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('scenario_assumptions')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_assumptions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_assumptions record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into products: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created products record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('suppliers')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into suppliers: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created suppliers record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('subtasks')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into subtasks: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created subtasks record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('stripe_settings')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into stripe_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created stripe_settings record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('financial_scenarios')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into financial_scenarios: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created financial_scenarios record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('payment_reminder_rules')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_reminder_rules: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_reminder_rules record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('quotes')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into quotes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created quotes record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('backup_logs')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into backup_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created backup_logs record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('notification_preferences')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into notification_preferences: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created notification_preferences record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('projects')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into projects: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created projects record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('accounting_plan_accounts')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_plan_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_plan_accounts record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('accounting_mappings')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_mappings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_mappings record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('bank_statements')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_statements: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_statements record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('product_barcodes')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into product_barcodes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created product_barcodes record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('credit_transactions')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_transactions record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_order_items')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_order_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_order_items record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('invoices')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created invoices record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('product_stock_history')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into product_stock_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created product_stock_history record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('scenario_comparisons')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into scenario_comparisons: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created scenario_comparisons record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_invoice_line_items')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_invoice_line_items: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_invoice_line_items record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_chart_of_accounts: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_chart_of_accounts record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_orders')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_orders record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('barcode_scan_logs')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into barcode_scan_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created barcode_scan_logs record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('data_export_requests')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into data_export_requests: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created data_export_requests record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('service_categories')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into service_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created service_categories record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into webhook_endpoints: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created webhook_endpoints record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('delivery_routes')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into delivery_routes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created delivery_routes record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('billing_info')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into billing_info: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created billing_info record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('payment_reminder_logs')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_reminder_logs: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_reminder_logs record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into webhook_deliveries: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created webhook_deliveries record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('company')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into company: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created company record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('bank_transactions')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_transactions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_transactions record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('payment_terms')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into payment_terms: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created payment_terms record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('credit_notes')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into credit_notes: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created credit_notes record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_reports_cache')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_reports_cache: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_reports_cache record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('bank_reconciliation_sessions')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_reconciliation_sessions: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_reconciliation_sessions record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('biometric_credentials')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into biometric_credentials: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created biometric_credentials record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('bank_sync_history')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_sync_history: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_sync_history record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('expenses')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into expenses: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created expenses record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('api_keys')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into api_keys: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created api_keys record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('backup_settings')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into backup_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created backup_settings record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('supplier_services')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into supplier_services: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created supplier_services record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('debt_payments')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into debt_payments: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created debt_payments record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('receivables')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into receivables: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created receivables record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into bank_statement_lines: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created bank_statement_lines record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('accounting_tax_rates')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_tax_rates: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_tax_rates record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('recurring_invoices')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into recurring_invoices: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created recurring_invoices record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('product_categories')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into product_categories: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created product_categories record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into purchase_orders: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created purchase_orders record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('accounting_plans')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into accounting_plans: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created accounting_plans record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('notifications')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into notifications: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created notifications record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('team_members')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into team_members: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created team_members record:\n' + JSON.stringify(data, null, 2) }] };
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
      const { data, error } = await supabase
        .from('invoice_settings')
        .insert([payload])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into invoice_settings: ' + error.message }] };
      return { content: [{ type: 'text' as const, text: 'Successfully created invoice_settings record:\n' + JSON.stringify(data, null, 2) }] };
    }
  );
}
