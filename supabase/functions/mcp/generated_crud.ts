// AUTO-GENERATED CRUD TOOLS FOR EDGE FUNCTION
export const generatedTools: any[] = [];
export const generatedHandlers: Record<string, any> = {};

generatedTools.push({
  name: 'create_credit_packages',
  description: 'Create a new record in credit_packages',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      credits: { type: 'number' },
      price_cents: { type: 'number' },
      currency: { type: 'string' },
      is_active: { type: 'boolean' },
      stripe_price_id: { type: 'string' },
      sort_order: { type: 'number' },
    },
    required: ['name', 'credits', 'price_cents']
  }
});
generatedHandlers['create_credit_packages'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('credit_packages').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_credit_packages',
  description: 'Update an existing record in credit_packages',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      credits: { type: 'number' },
      price_cents: { type: 'number' },
      currency: { type: 'string' },
      is_active: { type: 'boolean' },
      stripe_price_id: { type: 'string' },
      sort_order: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_credit_packages'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('credit_packages').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_credit_packages',
  description: 'Delete a record from credit_packages',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_credit_packages'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_packages').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_credit_packages',
  description: 'Get a single record from credit_packages by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_credit_packages'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_packages').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_credit_packages',
  description: 'List multiple records from credit_packages',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_credit_packages'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('credit_packages').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_products',
  description: 'Create a new record in supplier_products',
  inputSchema: {
    type: 'object',
    properties: {
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      category_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_product_categories.id`.<fk table=\'supplier_product_categories\' column=\'id\'/>' },
      product_name: { type: 'string' },
      description: { type: 'string' },
      sku: { type: 'string' },
      unit_price: { type: 'number' },
      unit: { type: 'string' },
      stock_quantity: { type: 'number' },
      min_stock_level: { type: 'number' },
      reorder_quantity: { type: 'number' },
    },
    required: ['product_name', 'unit_price']
  }
});
generatedHandlers['create_supplier_products'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('supplier_products').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_products',
  description: 'Update an existing record in supplier_products',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      category_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_product_categories.id`.<fk table=\'supplier_product_categories\' column=\'id\'/>' },
      product_name: { type: 'string' },
      description: { type: 'string' },
      sku: { type: 'string' },
      unit_price: { type: 'number' },
      unit: { type: 'string' },
      stock_quantity: { type: 'number' },
      min_stock_level: { type: 'number' },
      reorder_quantity: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_products'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_products').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_products',
  description: 'Delete a record from supplier_products',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_products'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_products').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_products',
  description: 'Get a single record from supplier_products by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_products'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_products').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_products',
  description: 'List multiple records from supplier_products',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_products'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_products').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_credit_note_items',
  description: 'Create a new record in credit_note_items',
  inputSchema: {
    type: 'object',
    properties: {
      credit_note_id: { type: 'string', description: 'Note: This is a Foreign Key to `credit_notes.id`.<fk table=\'credit_notes\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      amount: { type: 'number' },
    },
    required: ['credit_note_id', 'description']
  }
});
generatedHandlers['create_credit_note_items'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('credit_note_items').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_credit_note_items',
  description: 'Update an existing record in credit_note_items',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      credit_note_id: { type: 'string', description: 'Note: This is a Foreign Key to `credit_notes.id`.<fk table=\'credit_notes\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      amount: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_credit_note_items'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('credit_note_items').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_credit_note_items',
  description: 'Delete a record from credit_note_items',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_credit_note_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_note_items').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_credit_note_items',
  description: 'Get a single record from credit_note_items by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_credit_note_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_note_items').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_credit_note_items',
  description: 'List multiple records from credit_note_items',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_credit_note_items'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('credit_note_items').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_payments',
  description: 'Create a new record in payments',
  inputSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      payment_date: { type: 'string' },
      amount: { type: 'number' },
      payment_method: { type: 'string' },
      reference: { type: 'string' },
      notes: { type: 'string' },
      is_lump_sum: { type: 'boolean' },
      receipt_number: { type: 'string' },
      receipt_generated_at: { type: 'string' },
    },
    required: ['payment_date', 'amount']
  }
});
generatedHandlers['create_payments'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('payments').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_payments',
  description: 'Update an existing record in payments',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      payment_date: { type: 'string' },
      amount: { type: 'number' },
      payment_method: { type: 'string' },
      reference: { type: 'string' },
      notes: { type: 'string' },
      is_lump_sum: { type: 'boolean' },
      receipt_number: { type: 'string' },
      receipt_generated_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_payments'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('payments').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_payments',
  description: 'Delete a record from payments',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_payments'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payments').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_payments',
  description: 'Get a single record from payments by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_payments'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payments').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_payments',
  description: 'List multiple records from payments',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_payments'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('payments').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_scenario_results',
  description: 'Create a new record in scenario_results',
  inputSchema: {
    type: 'object',
    properties: {
      scenario_id: { type: 'string', description: 'Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>' },
      calculation_date: { type: 'string' },
      period_label: { type: 'string' },
      metrics: { type: 'object', description: 'All calculated financial metrics stored as JSONB' },
      calculated_at: { type: 'string' },
    },
    required: ['scenario_id', 'calculation_date', 'metrics']
  }
});
generatedHandlers['create_scenario_results'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('scenario_results').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_scenario_results',
  description: 'Update an existing record in scenario_results',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      scenario_id: { type: 'string', description: 'Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>' },
      calculation_date: { type: 'string' },
      period_label: { type: 'string' },
      metrics: { type: 'object', description: 'All calculated financial metrics stored as JSONB' },
      calculated_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_scenario_results'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('scenario_results').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_scenario_results',
  description: 'Delete a record from scenario_results',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_scenario_results'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_results').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_scenario_results',
  description: 'Get a single record from scenario_results by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_scenario_results'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_results').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_scenario_results',
  description: 'List multiple records from scenario_results',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_scenario_results'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('scenario_results').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_referrals',
  description: 'Create a new record in referrals',
  inputSchema: {
    type: 'object',
    properties: {
      referrer_user_id: { type: 'string' },
      referred_user_id: { type: 'string' },
      referral_code: { type: 'string' },
      status: { type: 'string' },
      bonus_credited: { type: 'boolean' },
      completed_at: { type: 'string' },
    },
    required: ['referrer_user_id', 'referral_code']
  }
});
generatedHandlers['create_referrals'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('referrals').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_referrals',
  description: 'Update an existing record in referrals',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      referrer_user_id: { type: 'string' },
      referred_user_id: { type: 'string' },
      referral_code: { type: 'string' },
      status: { type: 'string' },
      bonus_credited: { type: 'boolean' },
      completed_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_referrals'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('referrals').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_referrals',
  description: 'Delete a record from referrals',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_referrals'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('referrals').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_referrals',
  description: 'Get a single record from referrals by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_referrals'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('referrals').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_referrals',
  description: 'List multiple records from referrals',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_referrals'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('referrals').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_push_subscriptions',
  description: 'Create a new record in push_subscriptions',
  inputSchema: {
    type: 'object',
    properties: {
      endpoint: { type: 'string' },
      auth_key: { type: 'string' },
      p256dh_key: { type: 'string' },
      device_type: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['endpoint', 'auth_key', 'p256dh_key']
  }
});
generatedHandlers['create_push_subscriptions'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('push_subscriptions').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_push_subscriptions',
  description: 'Update an existing record in push_subscriptions',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      endpoint: { type: 'string' },
      auth_key: { type: 'string' },
      p256dh_key: { type: 'string' },
      device_type: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_push_subscriptions'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('push_subscriptions').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_push_subscriptions',
  description: 'Delete a record from push_subscriptions',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_push_subscriptions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('push_subscriptions').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_push_subscriptions',
  description: 'Get a single record from push_subscriptions by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_push_subscriptions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('push_subscriptions').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_push_subscriptions',
  description: 'List multiple records from push_subscriptions',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_push_subscriptions'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('push_subscriptions').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_user_credits',
  description: 'Create a new record in user_credits',
  inputSchema: {
    type: 'object',
    properties: {
      free_credits: { type: 'number' },
      paid_credits: { type: 'number' },
      total_used: { type: 'number' },
      referral_code: { type: 'string' },
      referred_by: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_user_credits'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('user_credits').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_user_credits',
  description: 'Update an existing record in user_credits',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      free_credits: { type: 'number' },
      paid_credits: { type: 'number' },
      total_used: { type: 'number' },
      referral_code: { type: 'string' },
      referred_by: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_user_credits'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('user_credits').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_user_credits',
  description: 'Delete a record from user_credits',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_user_credits'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('user_credits').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_user_credits',
  description: 'Get a single record from user_credits by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_user_credits'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('user_credits').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_user_credits',
  description: 'List multiple records from user_credits',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_user_credits'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('user_credits').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_delivery_note_items',
  description: 'Create a new record in delivery_note_items',
  inputSchema: {
    type: 'object',
    properties: {
      delivery_note_id: { type: 'string', description: 'Note: This is a Foreign Key to `delivery_notes.id`.<fk table=\'delivery_notes\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit: { type: 'string' },
    },
    required: ['delivery_note_id', 'description']
  }
});
generatedHandlers['create_delivery_note_items'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('delivery_note_items').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_delivery_note_items',
  description: 'Update an existing record in delivery_note_items',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      delivery_note_id: { type: 'string', description: 'Note: This is a Foreign Key to `delivery_notes.id`.<fk table=\'delivery_notes\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_delivery_note_items'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('delivery_note_items').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_delivery_note_items',
  description: 'Delete a record from delivery_note_items',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_delivery_note_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('delivery_note_items').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_delivery_note_items',
  description: 'Get a single record from delivery_note_items by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_delivery_note_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('delivery_note_items').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_delivery_note_items',
  description: 'List multiple records from delivery_note_items',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_delivery_note_items'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('delivery_note_items').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_stock_alerts',
  description: 'Create a new record in stock_alerts',
  inputSchema: {
    type: 'object',
    properties: {
      product_id: { type: 'string' },
      user_product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      alert_type: { type: 'string' },
      is_active: { type: 'boolean' },
      resolved_at: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_stock_alerts'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('stock_alerts').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_stock_alerts',
  description: 'Update an existing record in stock_alerts',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      product_id: { type: 'string' },
      user_product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      alert_type: { type: 'string' },
      is_active: { type: 'boolean' },
      resolved_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_stock_alerts'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('stock_alerts').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_stock_alerts',
  description: 'Delete a record from stock_alerts',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_stock_alerts'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('stock_alerts').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_stock_alerts',
  description: 'Get a single record from stock_alerts by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_stock_alerts'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('stock_alerts').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_stock_alerts',
  description: 'List multiple records from stock_alerts',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_stock_alerts'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('stock_alerts').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_bank_connections',
  description: 'Create a new record in bank_connections',
  inputSchema: {
    type: 'object',
    properties: {
      institution_id: { type: 'string' },
      institution_name: { type: 'string' },
      institution_logo: { type: 'string' },
      requisition_id: { type: 'string' },
      agreement_id: { type: 'string' },
      status: { type: 'string' },
      last_sync_at: { type: 'string' },
      sync_error: { type: 'string' },
      account_id: { type: 'string' },
      account_iban: { type: 'string' },
      account_name: { type: 'string' },
      account_currency: { type: 'string' },
      account_balance: { type: 'number' },
      expires_at: { type: 'string' },
    },
    required: ['institution_id', 'institution_name']
  }
});
generatedHandlers['create_bank_connections'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('bank_connections').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_bank_connections',
  description: 'Update an existing record in bank_connections',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      institution_id: { type: 'string' },
      institution_name: { type: 'string' },
      institution_logo: { type: 'string' },
      requisition_id: { type: 'string' },
      agreement_id: { type: 'string' },
      status: { type: 'string' },
      last_sync_at: { type: 'string' },
      sync_error: { type: 'string' },
      account_id: { type: 'string' },
      account_iban: { type: 'string' },
      account_name: { type: 'string' },
      account_currency: { type: 'string' },
      account_balance: { type: 'number' },
      expires_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_bank_connections'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('bank_connections').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_bank_connections',
  description: 'Delete a record from bank_connections',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_bank_connections'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_connections').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_bank_connections',
  description: 'Get a single record from bank_connections by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_bank_connections'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_connections').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_bank_connections',
  description: 'List multiple records from bank_connections',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_bank_connections'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('bank_connections').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_invoices',
  description: 'Create a new record in supplier_invoices',
  inputSchema: {
    type: 'object',
    properties: {
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      invoice_number: { type: 'string' },
      invoice_date: { type: 'string' },
      due_date: { type: 'string' },
      total_amount: { type: 'number' },
      vat_amount: { type: 'number' },
      vat_rate: { type: 'number' },
      payment_status: { type: 'string' },
      file_url: { type: 'string' },
      notes: { type: 'string' },
      total_ht: { type: 'number' },
      total_ttc: { type: 'number' },
      currency: { type: 'string' },
      supplier_name_extracted: { type: 'string' },
      supplier_address_extracted: { type: 'string' },
      supplier_vat_number: { type: 'string' },
      payment_terms: { type: 'string' },
      iban: { type: 'string' },
      bic: { type: 'string' },
      ai_extracted: { type: 'boolean' },
      ai_confidence: { type: 'number' },
      ai_raw_response: { type: 'object' },
      ai_extracted_at: { type: 'string' },
    },
    required: ['invoice_number', 'total_amount']
  }
});
generatedHandlers['create_supplier_invoices'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('supplier_invoices').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_invoices',
  description: 'Update an existing record in supplier_invoices',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      invoice_number: { type: 'string' },
      invoice_date: { type: 'string' },
      due_date: { type: 'string' },
      total_amount: { type: 'number' },
      vat_amount: { type: 'number' },
      vat_rate: { type: 'number' },
      payment_status: { type: 'string' },
      file_url: { type: 'string' },
      notes: { type: 'string' },
      total_ht: { type: 'number' },
      total_ttc: { type: 'number' },
      currency: { type: 'string' },
      supplier_name_extracted: { type: 'string' },
      supplier_address_extracted: { type: 'string' },
      supplier_vat_number: { type: 'string' },
      payment_terms: { type: 'string' },
      iban: { type: 'string' },
      bic: { type: 'string' },
      ai_extracted: { type: 'boolean' },
      ai_confidence: { type: 'number' },
      ai_raw_response: { type: 'object' },
      ai_extracted_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_invoices').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_invoices',
  description: 'Delete a record from supplier_invoices',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_invoices').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_invoices',
  description: 'Get a single record from supplier_invoices by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_invoices').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_invoices',
  description: 'List multiple records from supplier_invoices',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_invoices'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_invoices').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_payables',
  description: 'Create a new record in payables',
  inputSchema: {
    type: 'object',
    properties: {
      creditor_name: { type: 'string' },
      creditor_phone: { type: 'string' },
      creditor_email: { type: 'string' },
      description: { type: 'string' },
      amount: { type: 'number' },
      amount_paid: { type: 'number' },
      currency: { type: 'string' },
      date_borrowed: { type: 'string' },
      due_date: { type: 'string' },
      status: { type: 'string' },
      category: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['creditor_name', 'amount', 'amount_paid', 'currency', 'date_borrowed', 'status']
  }
});
generatedHandlers['create_payables'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('payables').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_payables',
  description: 'Update an existing record in payables',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      creditor_name: { type: 'string' },
      creditor_phone: { type: 'string' },
      creditor_email: { type: 'string' },
      description: { type: 'string' },
      amount: { type: 'number' },
      amount_paid: { type: 'number' },
      currency: { type: 'string' },
      date_borrowed: { type: 'string' },
      due_date: { type: 'string' },
      status: { type: 'string' },
      category: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_payables'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('payables').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_payables',
  description: 'Delete a record from payables',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_payables'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payables').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_payables',
  description: 'Get a single record from payables by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_payables'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payables').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_payables',
  description: 'List multiple records from payables',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_payables'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('payables').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_timesheets',
  description: 'Create a new record in timesheets',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>' },
      project_id: { type: 'string', description: 'Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      date: { type: 'string' },
      start_time: { type: 'string' },
      end_time: { type: 'string' },
      duration_minutes: { type: 'number' },
      description: { type: 'string' },
      status: { type: 'string' },
      notes: { type: 'string' },
      billable: { type: 'boolean' },
      hourly_rate: { type: 'number' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      billed_at: { type: 'string' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>' },
    },
    required: ['date']
  }
});
generatedHandlers['create_timesheets'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('timesheets').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_timesheets',
  description: 'Update an existing record in timesheets',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      task_id: { type: 'string', description: 'Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>' },
      project_id: { type: 'string', description: 'Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      date: { type: 'string' },
      start_time: { type: 'string' },
      end_time: { type: 'string' },
      duration_minutes: { type: 'number' },
      description: { type: 'string' },
      status: { type: 'string' },
      notes: { type: 'string' },
      billable: { type: 'boolean' },
      hourly_rate: { type: 'number' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      billed_at: { type: 'string' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>' },
    },
    required: ['id']
  }
});
generatedHandlers['update_timesheets'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('timesheets').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_timesheets',
  description: 'Delete a record from timesheets',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_timesheets'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('timesheets').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_timesheets',
  description: 'Get a single record from timesheets by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_timesheets'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('timesheets').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_timesheets',
  description: 'List multiple records from timesheets',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_timesheets'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('timesheets').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_product_categories',
  description: 'Create a new record in supplier_product_categories',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name']
  }
});
generatedHandlers['create_supplier_product_categories'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('supplier_product_categories').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_product_categories',
  description: 'Update an existing record in supplier_product_categories',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_product_categories'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_product_categories').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_product_categories',
  description: 'Delete a record from supplier_product_categories',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_product_categories'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_product_categories').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_product_categories',
  description: 'Get a single record from supplier_product_categories by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_product_categories'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_product_categories').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_product_categories',
  description: 'List multiple records from supplier_product_categories',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_product_categories'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_product_categories').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_scenario_templates',
  description: 'Create a new record in scenario_templates',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      icon: { type: 'string' },
      default_assumptions: { type: 'object' },
      suggested_duration_months: { type: 'number' },
      is_public: { type: 'boolean' },
    },
    required: ['name', 'category', 'default_assumptions']
  }
});
generatedHandlers['create_scenario_templates'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('scenario_templates').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_scenario_templates',
  description: 'Update an existing record in scenario_templates',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      icon: { type: 'string' },
      default_assumptions: { type: 'object' },
      suggested_duration_months: { type: 'number' },
      is_public: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_scenario_templates'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('scenario_templates').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_scenario_templates',
  description: 'Delete a record from scenario_templates',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_scenario_templates'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_templates').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_scenario_templates',
  description: 'Get a single record from scenario_templates by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_scenario_templates'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_templates').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_scenario_templates',
  description: 'List multiple records from scenario_templates',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_scenario_templates'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('scenario_templates').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_delivery_notes',
  description: 'Create a new record in delivery_notes',
  inputSchema: {
    type: 'object',
    properties: {
      delivery_note_number: { type: 'string' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      date: { type: 'string' },
      delivery_address: { type: 'string' },
      carrier: { type: 'string' },
      tracking_number: { type: 'string' },
      status: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['delivery_note_number', 'date']
  }
});
generatedHandlers['create_delivery_notes'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('delivery_notes').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_delivery_notes',
  description: 'Update an existing record in delivery_notes',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      delivery_note_number: { type: 'string' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      date: { type: 'string' },
      delivery_address: { type: 'string' },
      carrier: { type: 'string' },
      tracking_number: { type: 'string' },
      status: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_delivery_notes'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('delivery_notes').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_delivery_notes',
  description: 'Delete a record from delivery_notes',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_delivery_notes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('delivery_notes').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_delivery_notes',
  description: 'Get a single record from delivery_notes by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_delivery_notes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('delivery_notes').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_delivery_notes',
  description: 'List multiple records from delivery_notes',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_delivery_notes'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('delivery_notes').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_clients',
  description: 'Create a new record in clients',
  inputSchema: {
    type: 'object',
    properties: {
      company_name: { type: 'string' },
      contact_name: { type: 'string' },
      email: { type: 'string' },
      address: { type: 'string' },
      vat_number: { type: 'string' },
      preferred_currency: { type: 'string' },
      phone: { type: 'string' },
      website: { type: 'string' },
      city: { type: 'string' },
      postal_code: { type: 'string' },
      country: { type: 'string' },
      payment_terms: { type: 'string' },
      tax_id: { type: 'string' },
      bank_name: { type: 'string' },
      iban: { type: 'string' },
      bic_swift: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['company_name']
  }
});
generatedHandlers['create_clients'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('clients').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_clients',
  description: 'Update an existing record in clients',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      company_name: { type: 'string' },
      contact_name: { type: 'string' },
      email: { type: 'string' },
      address: { type: 'string' },
      vat_number: { type: 'string' },
      preferred_currency: { type: 'string' },
      phone: { type: 'string' },
      website: { type: 'string' },
      city: { type: 'string' },
      postal_code: { type: 'string' },
      country: { type: 'string' },
      payment_terms: { type: 'string' },
      tax_id: { type: 'string' },
      bank_name: { type: 'string' },
      iban: { type: 'string' },
      bic_swift: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_clients'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('clients').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_clients',
  description: 'Delete a record from clients',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_clients'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('clients').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_clients',
  description: 'Get a single record from clients by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_clients'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('clients').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_clients',
  description: 'List multiple records from clients',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_clients'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('clients').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_tasks',
  description: 'Create a new record in tasks',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: { type: 'string', description: 'Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>' },
      name: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string' },
      estimated_hours: { type: 'number' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>' },
    },
    required: ['name']
  }
});
generatedHandlers['create_tasks'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('tasks').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_tasks',
  description: 'Update an existing record in tasks',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      project_id: { type: 'string', description: 'Note: This is a Foreign Key to `projects.id`.<fk table=\'projects\' column=\'id\'/>' },
      name: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string' },
      estimated_hours: { type: 'number' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>' },
    },
    required: ['id']
  }
});
generatedHandlers['update_tasks'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('tasks').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_tasks',
  description: 'Delete a record from tasks',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_tasks'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('tasks').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_tasks',
  description: 'Get a single record from tasks by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_tasks'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('tasks').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_tasks',
  description: 'List multiple records from tasks',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_tasks'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('tasks').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_report_templates',
  description: 'Create a new record in report_templates',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      template_type: { type: 'string' },
      html_template: { type: 'string' },
      css_styles: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['name']
  }
});
generatedHandlers['create_report_templates'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('report_templates').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_report_templates',
  description: 'Update an existing record in report_templates',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      description: { type: 'string' },
      template_type: { type: 'string' },
      html_template: { type: 'string' },
      css_styles: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_report_templates'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('report_templates').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_report_templates',
  description: 'Delete a record from report_templates',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_report_templates'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('report_templates').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_report_templates',
  description: 'Get a single record from report_templates by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_report_templates'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('report_templates').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_report_templates',
  description: 'List multiple records from report_templates',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_report_templates'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('report_templates').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_payment_allocations',
  description: 'Create a new record in payment_allocations',
  inputSchema: {
    type: 'object',
    properties: {
      payment_id: { type: 'string', description: 'Note: This is a Foreign Key to `payments.id`.<fk table=\'payments\' column=\'id\'/>' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      amount: { type: 'number' },
    },
    required: ['payment_id', 'invoice_id', 'amount']
  }
});
generatedHandlers['create_payment_allocations'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('payment_allocations').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_payment_allocations',
  description: 'Update an existing record in payment_allocations',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      payment_id: { type: 'string', description: 'Note: This is a Foreign Key to `payments.id`.<fk table=\'payments\' column=\'id\'/>' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      amount: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_payment_allocations'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('payment_allocations').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_payment_allocations',
  description: 'Delete a record from payment_allocations',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_payment_allocations'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_allocations').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_payment_allocations',
  description: 'Get a single record from payment_allocations by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_payment_allocations'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_allocations').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_payment_allocations',
  description: 'List multiple records from payment_allocations',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_payment_allocations'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('payment_allocations').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_locations',
  description: 'Create a new record in supplier_locations',
  inputSchema: {
    type: 'object',
    properties: {
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      location_name: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      address: { type: 'string' },
      postal_code: { type: 'string' },
      city: { type: 'string' },
      country: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      opening_hours: { type: 'object' },
      is_primary: { type: 'boolean' },
    },
    required: ['location_name']
  }
});
generatedHandlers['create_supplier_locations'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('supplier_locations').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_locations',
  description: 'Update an existing record in supplier_locations',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      location_name: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      address: { type: 'string' },
      postal_code: { type: 'string' },
      city: { type: 'string' },
      country: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      opening_hours: { type: 'object' },
      is_primary: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_locations'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_locations').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_locations',
  description: 'Delete a record from supplier_locations',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_locations'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_locations').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_locations',
  description: 'Get a single record from supplier_locations by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_locations'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_locations').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_locations',
  description: 'List multiple records from supplier_locations',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_locations'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_locations').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_invoice_items',
  description: 'Create a new record in invoice_items',
  inputSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      total: { type: 'number' },
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      discount_type: { type: 'string' },
      discount_value: { type: 'number' },
      discount_amount: { type: 'number' },
      hsn_code: { type: 'string' },
      item_type: { type: 'string' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>' },
      timesheet_id: { type: 'string', description: 'Note: This is a Foreign Key to `timesheets.id`.<fk table=\'timesheets\' column=\'id\'/>' },
    },
    required: []
  }
});
generatedHandlers['create_invoice_items'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('invoice_items').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_invoice_items',
  description: 'Update an existing record in invoice_items',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      total: { type: 'number' },
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      discount_type: { type: 'string' },
      discount_value: { type: 'number' },
      discount_amount: { type: 'number' },
      hsn_code: { type: 'string' },
      item_type: { type: 'string' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `services.id`.<fk table=\'services\' column=\'id\'/>' },
      timesheet_id: { type: 'string', description: 'Note: This is a Foreign Key to `timesheets.id`.<fk table=\'timesheets\' column=\'id\'/>' },
    },
    required: ['id']
  }
});
generatedHandlers['update_invoice_items'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('invoice_items').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_invoice_items',
  description: 'Delete a record from invoice_items',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_invoice_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('invoice_items').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_invoice_items',
  description: 'Get a single record from invoice_items by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_invoice_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('invoice_items').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_invoice_items',
  description: 'List multiple records from invoice_items',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_invoice_items'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('invoice_items').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_offline_sync_queue',
  description: 'Create a new record in offline_sync_queue',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      resource_type: { type: 'string' },
      resource_id: { type: 'string' },
      payload: { type: 'object' },
      status: { type: 'string' },
      error_message: { type: 'string' },
      synced_at: { type: 'string' },
    },
    required: ['action', 'resource_type']
  }
});
generatedHandlers['create_offline_sync_queue'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('offline_sync_queue').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_offline_sync_queue',
  description: 'Update an existing record in offline_sync_queue',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      action: { type: 'string' },
      resource_type: { type: 'string' },
      resource_id: { type: 'string' },
      payload: { type: 'object' },
      status: { type: 'string' },
      error_message: { type: 'string' },
      synced_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_offline_sync_queue'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('offline_sync_queue').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_offline_sync_queue',
  description: 'Delete a record from offline_sync_queue',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_offline_sync_queue'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('offline_sync_queue').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_offline_sync_queue',
  description: 'Get a single record from offline_sync_queue by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_offline_sync_queue'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('offline_sync_queue').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_offline_sync_queue',
  description: 'List multiple records from offline_sync_queue',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_offline_sync_queue'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('offline_sync_queue').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_services',
  description: 'Create a new record in services',
  inputSchema: {
    type: 'object',
    properties: {
      service_name: { type: 'string' },
      description: { type: 'string' },
      category_id: { type: 'string', description: 'Note: This is a Foreign Key to `service_categories.id`.<fk table=\'service_categories\' column=\'id\'/>' },
      pricing_type: { type: 'string' },
      hourly_rate: { type: 'number' },
      fixed_price: { type: 'number' },
      unit_price: { type: 'number' },
      unit: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['service_name', 'pricing_type']
  }
});
generatedHandlers['create_services'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('services').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_services',
  description: 'Update an existing record in services',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      service_name: { type: 'string' },
      description: { type: 'string' },
      category_id: { type: 'string', description: 'Note: This is a Foreign Key to `service_categories.id`.<fk table=\'service_categories\' column=\'id\'/>' },
      pricing_type: { type: 'string' },
      hourly_rate: { type: 'number' },
      fixed_price: { type: 'number' },
      unit_price: { type: 'number' },
      unit: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_services'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('services').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_services',
  description: 'Delete a record from services',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_services'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('services').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_services',
  description: 'Get a single record from services by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_services'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('services').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_services',
  description: 'List multiple records from services',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_services'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('services').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_consent_logs',
  description: 'Create a new record in consent_logs',
  inputSchema: {
    type: 'object',
    properties: {
      consent_type: { type: 'string' },
      granted: { type: 'boolean' },
      ip_address: { type: 'string' },
      user_agent: { type: 'string' },
      granted_at: { type: 'string' },
      revoked_at: { type: 'string' },
    },
    required: ['consent_type', 'granted']
  }
});
generatedHandlers['create_consent_logs'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('consent_logs').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_consent_logs',
  description: 'Update an existing record in consent_logs',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      consent_type: { type: 'string' },
      granted: { type: 'boolean' },
      ip_address: { type: 'string' },
      user_agent: { type: 'string' },
      granted_at: { type: 'string' },
      revoked_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_consent_logs'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('consent_logs').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_consent_logs',
  description: 'Delete a record from consent_logs',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_consent_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('consent_logs').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_consent_logs',
  description: 'Get a single record from consent_logs by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_consent_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('consent_logs').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_consent_logs',
  description: 'List multiple records from consent_logs',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_consent_logs'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('consent_logs').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_accounting_entries',
  description: 'Create a new record in accounting_entries',
  inputSchema: {
    type: 'object',
    properties: {
      transaction_date: { type: 'string' },
      description: { type: 'string' },
      reference_id: { type: 'string' },
      reference_type: { type: 'string' },
      account_code: { type: 'string' },
      debit: { type: 'number' },
      credit: { type: 'number' },
      source_type: { type: 'string' },
      source_id: { type: 'string' },
      journal: { type: 'string' },
      entry_ref: { type: 'string' },
      is_auto: { type: 'boolean' },
    },
    required: ['transaction_date', 'account_code']
  }
});
generatedHandlers['create_accounting_entries'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('accounting_entries').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_accounting_entries',
  description: 'Update an existing record in accounting_entries',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      transaction_date: { type: 'string' },
      description: { type: 'string' },
      reference_id: { type: 'string' },
      reference_type: { type: 'string' },
      account_code: { type: 'string' },
      debit: { type: 'number' },
      credit: { type: 'number' },
      source_type: { type: 'string' },
      source_id: { type: 'string' },
      journal: { type: 'string' },
      entry_ref: { type: 'string' },
      is_auto: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_accounting_entries'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('accounting_entries').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_accounting_entries',
  description: 'Delete a record from accounting_entries',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_accounting_entries'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_entries').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_accounting_entries',
  description: 'Get a single record from accounting_entries by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_accounting_entries'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_entries').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_accounting_entries',
  description: 'List multiple records from accounting_entries',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_accounting_entries'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('accounting_entries').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_user_accounting_settings',
  description: 'Create a new record in user_accounting_settings',
  inputSchema: {
    type: 'object',
    properties: {
      country: { type: 'string' },
      is_initialized: { type: 'boolean' },
      auto_journal_enabled: { type: 'boolean' },
      fiscal_year_start: { type: 'string' },
    },
    required: ['country']
  }
});
generatedHandlers['create_user_accounting_settings'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('user_accounting_settings').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_user_accounting_settings',
  description: 'Update an existing record in user_accounting_settings',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      country: { type: 'string' },
      is_initialized: { type: 'boolean' },
      auto_journal_enabled: { type: 'boolean' },
      fiscal_year_start: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_user_accounting_settings'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('user_accounting_settings').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_user_accounting_settings',
  description: 'Delete a record from user_accounting_settings',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_user_accounting_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('user_accounting_settings').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_user_accounting_settings',
  description: 'Get a single record from user_accounting_settings by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_user_accounting_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('user_accounting_settings').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_user_accounting_settings',
  description: 'List multiple records from user_accounting_settings',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_user_accounting_settings'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('user_accounting_settings').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_push_notification_logs',
  description: 'Create a new record in push_notification_logs',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      action_url: { type: 'string' },
      sent_at: { type: 'string' },
      read_at: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['title']
  }
});
generatedHandlers['create_push_notification_logs'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('push_notification_logs').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_push_notification_logs',
  description: 'Update an existing record in push_notification_logs',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      title: { type: 'string' },
      body: { type: 'string' },
      action_url: { type: 'string' },
      sent_at: { type: 'string' },
      read_at: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_push_notification_logs'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('push_notification_logs').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_push_notification_logs',
  description: 'Delete a record from push_notification_logs',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_push_notification_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('push_notification_logs').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_push_notification_logs',
  description: 'Get a single record from push_notification_logs by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_push_notification_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('push_notification_logs').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_push_notification_logs',
  description: 'List multiple records from push_notification_logs',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_push_notification_logs'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('push_notification_logs').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_scenario_assumptions',
  description: 'Create a new record in scenario_assumptions',
  inputSchema: {
    type: 'object',
    properties: {
      scenario_id: { type: 'string', description: 'Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      assumption_type: { type: 'string' },
      parameters: { type: 'object', description: 'Flexible JSONB field for storing assumption parameters based on type' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
    },
    required: ['scenario_id', 'name', 'category', 'assumption_type', 'parameters']
  }
});
generatedHandlers['create_scenario_assumptions'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('scenario_assumptions').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_scenario_assumptions',
  description: 'Update an existing record in scenario_assumptions',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      scenario_id: { type: 'string', description: 'Note: This is a Foreign Key to `financial_scenarios.id`.<fk table=\'financial_scenarios\' column=\'id\'/>' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      assumption_type: { type: 'string' },
      parameters: { type: 'object', description: 'Flexible JSONB field for storing assumption parameters based on type' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_scenario_assumptions'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('scenario_assumptions').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_scenario_assumptions',
  description: 'Delete a record from scenario_assumptions',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_scenario_assumptions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_assumptions').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_scenario_assumptions',
  description: 'Get a single record from scenario_assumptions by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_scenario_assumptions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_assumptions').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_scenario_assumptions',
  description: 'List multiple records from scenario_assumptions',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_scenario_assumptions'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('scenario_assumptions').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_products',
  description: 'Create a new record in products',
  inputSchema: {
    type: 'object',
    properties: {
      product_name: { type: 'string' },
      sku: { type: 'string' },
      category_id: { type: 'string', description: 'Note: This is a Foreign Key to `product_categories.id`.<fk table=\'product_categories\' column=\'id\'/>' },
      unit_price: { type: 'number' },
      purchase_price: { type: 'number' },
      unit: { type: 'string' },
      stock_quantity: { type: 'number' },
      min_stock_level: { type: 'number' },
      description: { type: 'string' },
      is_active: { type: 'boolean' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
    },
    required: ['product_name']
  }
});
generatedHandlers['create_products'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('products').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_products',
  description: 'Update an existing record in products',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      product_name: { type: 'string' },
      sku: { type: 'string' },
      category_id: { type: 'string', description: 'Note: This is a Foreign Key to `product_categories.id`.<fk table=\'product_categories\' column=\'id\'/>' },
      unit_price: { type: 'number' },
      purchase_price: { type: 'number' },
      unit: { type: 'string' },
      stock_quantity: { type: 'number' },
      min_stock_level: { type: 'number' },
      description: { type: 'string' },
      is_active: { type: 'boolean' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
    },
    required: ['id']
  }
});
generatedHandlers['update_products'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('products').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_products',
  description: 'Delete a record from products',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_products'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('products').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_products',
  description: 'Get a single record from products by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_products'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('products').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_products',
  description: 'List multiple records from products',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_products'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('products').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_suppliers',
  description: 'Create a new record in suppliers',
  inputSchema: {
    type: 'object',
    properties: {
      company_name: { type: 'string' },
      contact_person: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      address: { type: 'string' },
      postal_code: { type: 'string' },
      city: { type: 'string' },
      country: { type: 'string' },
      website: { type: 'string' },
      payment_terms: { type: 'string' },
      supplier_type: { type: 'string' },
      status: { type: 'string' },
      notes: { type: 'string' },
      tax_id: { type: 'string' },
      currency: { type: 'string' },
      bank_name: { type: 'string' },
      iban: { type: 'string' },
      bic_swift: { type: 'string' },
    },
    required: ['company_name']
  }
});
generatedHandlers['create_suppliers'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('suppliers').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_suppliers',
  description: 'Update an existing record in suppliers',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      company_name: { type: 'string' },
      contact_person: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      address: { type: 'string' },
      postal_code: { type: 'string' },
      city: { type: 'string' },
      country: { type: 'string' },
      website: { type: 'string' },
      payment_terms: { type: 'string' },
      supplier_type: { type: 'string' },
      status: { type: 'string' },
      notes: { type: 'string' },
      tax_id: { type: 'string' },
      currency: { type: 'string' },
      bank_name: { type: 'string' },
      iban: { type: 'string' },
      bic_swift: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_suppliers'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('suppliers').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_suppliers',
  description: 'Delete a record from suppliers',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_suppliers'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('suppliers').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_suppliers',
  description: 'Get a single record from suppliers by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_suppliers'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('suppliers').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_suppliers',
  description: 'List multiple records from suppliers',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_suppliers'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('suppliers').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_subtasks',
  description: 'Create a new record in subtasks',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>' },
      title: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['task_id', 'title']
  }
});
generatedHandlers['create_subtasks'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('subtasks').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_subtasks',
  description: 'Update an existing record in subtasks',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      task_id: { type: 'string', description: 'Note: This is a Foreign Key to `tasks.id`.<fk table=\'tasks\' column=\'id\'/>' },
      title: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_subtasks'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('subtasks').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_subtasks',
  description: 'Delete a record from subtasks',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_subtasks'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('subtasks').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_subtasks',
  description: 'Get a single record from subtasks by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_subtasks'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('subtasks').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_subtasks',
  description: 'List multiple records from subtasks',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_subtasks'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('subtasks').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_stripe_settings',
  description: 'Create a new record in stripe_settings',
  inputSchema: {
    type: 'object',
    properties: {
      stripe_customer_id: { type: 'string' },
      stripe_enabled: { type: 'boolean' },
      stripe_publishable_key: { type: 'string' },
      stripe_mode: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_stripe_settings'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('stripe_settings').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_stripe_settings',
  description: 'Update an existing record in stripe_settings',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      stripe_customer_id: { type: 'string' },
      stripe_enabled: { type: 'boolean' },
      stripe_publishable_key: { type: 'string' },
      stripe_mode: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_stripe_settings'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('stripe_settings').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_stripe_settings',
  description: 'Delete a record from stripe_settings',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_stripe_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('stripe_settings').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_stripe_settings',
  description: 'Get a single record from stripe_settings by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_stripe_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('stripe_settings').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_stripe_settings',
  description: 'List multiple records from stripe_settings',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_stripe_settings'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('stripe_settings').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_financial_scenarios',
  description: 'Create a new record in financial_scenarios',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      base_date: { type: 'string' },
      end_date: { type: 'string' },
      status: { type: 'string' },
      is_baseline: { type: 'boolean' },
    },
    required: ['name', 'base_date', 'end_date']
  }
});
generatedHandlers['create_financial_scenarios'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('financial_scenarios').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_financial_scenarios',
  description: 'Update an existing record in financial_scenarios',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      description: { type: 'string' },
      base_date: { type: 'string' },
      end_date: { type: 'string' },
      status: { type: 'string' },
      is_baseline: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_financial_scenarios'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('financial_scenarios').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_financial_scenarios',
  description: 'Delete a record from financial_scenarios',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_financial_scenarios'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('financial_scenarios').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_financial_scenarios',
  description: 'Get a single record from financial_scenarios by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_financial_scenarios'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('financial_scenarios').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_financial_scenarios',
  description: 'List multiple records from financial_scenarios',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_financial_scenarios'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('financial_scenarios').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_payment_reminder_rules',
  description: 'Create a new record in payment_reminder_rules',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      days_before_due: { type: 'number' },
      days_after_due: { type: 'number' },
      max_reminders: { type: 'number' },
      is_active: { type: 'boolean' },
    },
    required: ['name']
  }
});
generatedHandlers['create_payment_reminder_rules'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('payment_reminder_rules').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_payment_reminder_rules',
  description: 'Update an existing record in payment_reminder_rules',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      days_before_due: { type: 'number' },
      days_after_due: { type: 'number' },
      max_reminders: { type: 'number' },
      is_active: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_payment_reminder_rules'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('payment_reminder_rules').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_payment_reminder_rules',
  description: 'Delete a record from payment_reminder_rules',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_payment_reminder_rules'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_reminder_rules').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_payment_reminder_rules',
  description: 'Get a single record from payment_reminder_rules by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_payment_reminder_rules'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_reminder_rules').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_payment_reminder_rules',
  description: 'List multiple records from payment_reminder_rules',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_payment_reminder_rules'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('payment_reminder_rules').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_quotes',
  description: 'Create a new record in quotes',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      quote_number: { type: 'string' },
      date: { type: 'string' },
      status: { type: 'string' },
      total_ht: { type: 'number' },
      tax_rate: { type: 'number' },
      total_ttc: { type: 'number' },
    },
    required: ['quote_number']
  }
});
generatedHandlers['create_quotes'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('quotes').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_quotes',
  description: 'Update an existing record in quotes',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      quote_number: { type: 'string' },
      date: { type: 'string' },
      status: { type: 'string' },
      total_ht: { type: 'number' },
      tax_rate: { type: 'number' },
      total_ttc: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_quotes'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('quotes').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_quotes',
  description: 'Delete a record from quotes',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_quotes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('quotes').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_quotes',
  description: 'Get a single record from quotes by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_quotes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('quotes').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_quotes',
  description: 'List multiple records from quotes',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_quotes'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('quotes').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_backup_logs',
  description: 'Create a new record in backup_logs',
  inputSchema: {
    type: 'object',
    properties: {
      provider: { type: 'string' },
      status: { type: 'string' },
      file_name: { type: 'string' },
      file_size_bytes: { type: 'number' },
      error_message: { type: 'string' },
      started_at: { type: 'string' },
      completed_at: { type: 'string' },
      metadata: { type: 'object' },
    },
    required: ['provider', 'status']
  }
});
generatedHandlers['create_backup_logs'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('backup_logs').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_backup_logs',
  description: 'Update an existing record in backup_logs',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      provider: { type: 'string' },
      status: { type: 'string' },
      file_name: { type: 'string' },
      file_size_bytes: { type: 'number' },
      error_message: { type: 'string' },
      started_at: { type: 'string' },
      completed_at: { type: 'string' },
      metadata: { type: 'object' },
    },
    required: ['id']
  }
});
generatedHandlers['update_backup_logs'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('backup_logs').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_backup_logs',
  description: 'Delete a record from backup_logs',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_backup_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('backup_logs').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_backup_logs',
  description: 'Get a single record from backup_logs by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_backup_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('backup_logs').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_backup_logs',
  description: 'List multiple records from backup_logs',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_backup_logs'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('backup_logs').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_notification_preferences',
  description: 'Create a new record in notification_preferences',
  inputSchema: {
    type: 'object',
    properties: {
      email_new_tasks: { type: 'boolean' },
      email_overdue_tasks: { type: 'boolean' },
      email_completed_tasks: { type: 'boolean' },
      email_comments: { type: 'boolean' },
      email_project_updates: { type: 'boolean' },
      email_reminders: { type: 'boolean' },
      push_enabled: { type: 'boolean' },
      push_new_tasks: { type: 'boolean' },
      push_comments: { type: 'boolean' },
      frequency: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_notification_preferences'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('notification_preferences').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_notification_preferences',
  description: 'Update an existing record in notification_preferences',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      email_new_tasks: { type: 'boolean' },
      email_overdue_tasks: { type: 'boolean' },
      email_completed_tasks: { type: 'boolean' },
      email_comments: { type: 'boolean' },
      email_project_updates: { type: 'boolean' },
      email_reminders: { type: 'boolean' },
      push_enabled: { type: 'boolean' },
      push_new_tasks: { type: 'boolean' },
      push_comments: { type: 'boolean' },
      frequency: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_notification_preferences'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('notification_preferences').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_notification_preferences',
  description: 'Delete a record from notification_preferences',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_notification_preferences'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('notification_preferences').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_notification_preferences',
  description: 'Get a single record from notification_preferences by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_notification_preferences'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('notification_preferences').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_notification_preferences',
  description: 'List multiple records from notification_preferences',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_notification_preferences'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('notification_preferences').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_projects',
  description: 'Create a new record in projects',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      name: { type: 'string' },
      description: { type: 'string' },
      budget_hours: { type: 'number' },
      hourly_rate: { type: 'number' },
      status: { type: 'string' },
    },
    required: ['name']
  }
});
generatedHandlers['create_projects'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('projects').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_projects',
  description: 'Update an existing record in projects',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      name: { type: 'string' },
      description: { type: 'string' },
      budget_hours: { type: 'number' },
      hourly_rate: { type: 'number' },
      status: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_projects'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('projects').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_projects',
  description: 'Delete a record from projects',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_projects'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('projects').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_projects',
  description: 'Get a single record from projects by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_projects'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('projects').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_projects',
  description: 'List multiple records from projects',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_projects'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('projects').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_accounting_plan_accounts',
  description: 'Create a new record in accounting_plan_accounts',
  inputSchema: {
    type: 'object',
    properties: {
      plan_id: { type: 'string', description: 'Note: This is a Foreign Key to `accounting_plans.id`.<fk table=\'accounting_plans\' column=\'id\'/>' },
      account_code: { type: 'string' },
      account_name: { type: 'string' },
      account_type: { type: 'string' },
      account_category: { type: 'string' },
      parent_code: { type: 'string' },
      description: { type: 'string' },
      is_header: { type: 'boolean' },
      sort_order: { type: 'number' },
    },
    required: ['plan_id', 'account_code', 'account_name', 'account_type']
  }
});
generatedHandlers['create_accounting_plan_accounts'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('accounting_plan_accounts').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_accounting_plan_accounts',
  description: 'Update an existing record in accounting_plan_accounts',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      plan_id: { type: 'string', description: 'Note: This is a Foreign Key to `accounting_plans.id`.<fk table=\'accounting_plans\' column=\'id\'/>' },
      account_code: { type: 'string' },
      account_name: { type: 'string' },
      account_type: { type: 'string' },
      account_category: { type: 'string' },
      parent_code: { type: 'string' },
      description: { type: 'string' },
      is_header: { type: 'boolean' },
      sort_order: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_accounting_plan_accounts'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('accounting_plan_accounts').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_accounting_plan_accounts',
  description: 'Delete a record from accounting_plan_accounts',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_accounting_plan_accounts'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_plan_accounts').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_accounting_plan_accounts',
  description: 'Get a single record from accounting_plan_accounts by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_accounting_plan_accounts'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_plan_accounts').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_accounting_plan_accounts',
  description: 'List multiple records from accounting_plan_accounts',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_accounting_plan_accounts'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('accounting_plan_accounts').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_accounting_mappings',
  description: 'Create a new record in accounting_mappings',
  inputSchema: {
    type: 'object',
    properties: {
      mapping_name: { type: 'string', description: 'Optional user-friendly name for the mapping' },
      description: { type: 'string' },
      source_type: { type: 'string' },
      source_category: { type: 'string' },
      debit_account_code: { type: 'string' },
      credit_account_code: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['source_type']
  }
});
generatedHandlers['create_accounting_mappings'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('accounting_mappings').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_accounting_mappings',
  description: 'Update an existing record in accounting_mappings',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      mapping_name: { type: 'string', description: 'Optional user-friendly name for the mapping' },
      description: { type: 'string' },
      source_type: { type: 'string' },
      source_category: { type: 'string' },
      debit_account_code: { type: 'string' },
      credit_account_code: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_accounting_mappings'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('accounting_mappings').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_accounting_mappings',
  description: 'Delete a record from accounting_mappings',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_accounting_mappings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_mappings').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_accounting_mappings',
  description: 'Get a single record from accounting_mappings by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_accounting_mappings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_mappings').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_accounting_mappings',
  description: 'List multiple records from accounting_mappings',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_accounting_mappings'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('accounting_mappings').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_bank_statements',
  description: 'Create a new record in bank_statements',
  inputSchema: {
    type: 'object',
    properties: {
      bank_name: { type: 'string' },
      account_number: { type: 'string' },
      statement_date: { type: 'string' },
      period_start: { type: 'string' },
      period_end: { type: 'string' },
      opening_balance: { type: 'number' },
      closing_balance: { type: 'number' },
      file_name: { type: 'string' },
      file_path: { type: 'string' },
      file_type: { type: 'string' },
      file_size: { type: 'number' },
      parse_status: { type: 'string' },
      parse_errors: { type: 'object' },
      line_count: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['file_name', 'file_path', 'file_type', 'parse_status']
  }
});
generatedHandlers['create_bank_statements'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('bank_statements').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_bank_statements',
  description: 'Update an existing record in bank_statements',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      bank_name: { type: 'string' },
      account_number: { type: 'string' },
      statement_date: { type: 'string' },
      period_start: { type: 'string' },
      period_end: { type: 'string' },
      opening_balance: { type: 'number' },
      closing_balance: { type: 'number' },
      file_name: { type: 'string' },
      file_path: { type: 'string' },
      file_type: { type: 'string' },
      file_size: { type: 'number' },
      parse_status: { type: 'string' },
      parse_errors: { type: 'object' },
      line_count: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_bank_statements'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('bank_statements').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_bank_statements',
  description: 'Delete a record from bank_statements',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_bank_statements'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_statements').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_bank_statements',
  description: 'Get a single record from bank_statements by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_bank_statements'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_statements').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_bank_statements',
  description: 'List multiple records from bank_statements',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_bank_statements'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('bank_statements').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_product_barcodes',
  description: 'Create a new record in product_barcodes',
  inputSchema: {
    type: 'object',
    properties: {
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      barcode: { type: 'string' },
      barcode_type: { type: 'string' },
    },
    required: ['barcode', 'barcode_type']
  }
});
generatedHandlers['create_product_barcodes'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('product_barcodes').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_product_barcodes',
  description: 'Update an existing record in product_barcodes',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      barcode: { type: 'string' },
      barcode_type: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_product_barcodes'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('product_barcodes').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_product_barcodes',
  description: 'Delete a record from product_barcodes',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_product_barcodes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('product_barcodes').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_product_barcodes',
  description: 'Get a single record from product_barcodes by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_product_barcodes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('product_barcodes').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_product_barcodes',
  description: 'List multiple records from product_barcodes',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_product_barcodes'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('product_barcodes').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_credit_transactions',
  description: 'Create a new record in credit_transactions',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      amount: { type: 'number' },
      description: { type: 'string' },
      stripe_session_id: { type: 'string' },
      stripe_payment_intent: { type: 'string' },
      metadata: { type: 'object' },
    },
    required: ['type', 'amount']
  }
});
generatedHandlers['create_credit_transactions'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('credit_transactions').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_credit_transactions',
  description: 'Update an existing record in credit_transactions',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      type: { type: 'string' },
      amount: { type: 'number' },
      description: { type: 'string' },
      stripe_session_id: { type: 'string' },
      stripe_payment_intent: { type: 'string' },
      metadata: { type: 'object' },
    },
    required: ['id']
  }
});
generatedHandlers['update_credit_transactions'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('credit_transactions').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_credit_transactions',
  description: 'Delete a record from credit_transactions',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_credit_transactions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_transactions').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_credit_transactions',
  description: 'Get a single record from credit_transactions by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_credit_transactions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_transactions').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_credit_transactions',
  description: 'List multiple records from credit_transactions',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_credit_transactions'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('credit_transactions').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_order_items',
  description: 'Create a new record in supplier_order_items',
  inputSchema: {
    type: 'object',
    properties: {
      order_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_services.id`.<fk table=\'supplier_services\' column=\'id\'/>' },
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_products.id`.<fk table=\'supplier_products\' column=\'id\'/>' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      total_price: { type: 'number' },
    },
    required: ['quantity', 'unit_price', 'total_price']
  }
});
generatedHandlers['create_supplier_order_items'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('supplier_order_items').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_order_items',
  description: 'Update an existing record in supplier_order_items',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      order_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>' },
      service_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_services.id`.<fk table=\'supplier_services\' column=\'id\'/>' },
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_products.id`.<fk table=\'supplier_products\' column=\'id\'/>' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      total_price: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_order_items'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_order_items').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_order_items',
  description: 'Delete a record from supplier_order_items',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_order_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_order_items').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_order_items',
  description: 'Get a single record from supplier_order_items by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_order_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_order_items').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_order_items',
  description: 'List multiple records from supplier_order_items',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_order_items'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_order_items').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_invoices',
  description: 'Create a new record in invoices',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      invoice_number: { type: 'string' },
      date: { type: 'string' },
      due_date: { type: 'string' },
      status: { type: 'string' },
      total_ht: { type: 'number' },
      tax_rate: { type: 'number' },
      total_ttc: { type: 'number' },
      notes: { type: 'string' },
      payment_terms_id: { type: 'string', description: 'Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>' },
      conditions: { type: 'string' },
      discount_type: { type: 'string' },
      discount_value: { type: 'number' },
      discount_amount: { type: 'number' },
      amount_paid: { type: 'number' },
      balance_due: { type: 'number' },
      payment_status: { type: 'string' },
      shipping_fee: { type: 'number' },
      adjustment: { type: 'number' },
      adjustment_label: { type: 'string' },
      header_note: { type: 'string' },
      footer_note: { type: 'string' },
      terms_and_conditions: { type: 'string' },
      internal_remark: { type: 'string' },
      attached_image_url: { type: 'string' },
      custom_fields: { type: 'object' },
      reference: { type: 'string' },
      invoice_type: { type: 'string' },
    },
    required: ['invoice_number']
  }
});
generatedHandlers['create_invoices'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('invoices').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_invoices',
  description: 'Update an existing record in invoices',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      invoice_number: { type: 'string' },
      date: { type: 'string' },
      due_date: { type: 'string' },
      status: { type: 'string' },
      total_ht: { type: 'number' },
      tax_rate: { type: 'number' },
      total_ttc: { type: 'number' },
      notes: { type: 'string' },
      payment_terms_id: { type: 'string', description: 'Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>' },
      conditions: { type: 'string' },
      discount_type: { type: 'string' },
      discount_value: { type: 'number' },
      discount_amount: { type: 'number' },
      amount_paid: { type: 'number' },
      balance_due: { type: 'number' },
      payment_status: { type: 'string' },
      shipping_fee: { type: 'number' },
      adjustment: { type: 'number' },
      adjustment_label: { type: 'string' },
      header_note: { type: 'string' },
      footer_note: { type: 'string' },
      terms_and_conditions: { type: 'string' },
      internal_remark: { type: 'string' },
      attached_image_url: { type: 'string' },
      custom_fields: { type: 'object' },
      reference: { type: 'string' },
      invoice_type: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('invoices').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_invoices',
  description: 'Delete a record from invoices',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('invoices').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_invoices',
  description: 'Get a single record from invoices by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('invoices').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_invoices',
  description: 'List multiple records from invoices',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_invoices'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('invoices').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_product_stock_history',
  description: 'Create a new record in product_stock_history',
  inputSchema: {
    type: 'object',
    properties: {
      product_id: { type: 'string' },
      user_product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      previous_quantity: { type: 'number' },
      new_quantity: { type: 'number' },
      change_quantity: { type: 'number' },
      reason: { type: 'string' },
      notes: { type: 'string' },
      order_id: { type: 'string' },
      created_by: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_product_stock_history'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('product_stock_history').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_product_stock_history',
  description: 'Update an existing record in product_stock_history',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      product_id: { type: 'string' },
      user_product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      previous_quantity: { type: 'number' },
      new_quantity: { type: 'number' },
      change_quantity: { type: 'number' },
      reason: { type: 'string' },
      notes: { type: 'string' },
      order_id: { type: 'string' },
      created_by: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_product_stock_history'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('product_stock_history').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_product_stock_history',
  description: 'Delete a record from product_stock_history',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_product_stock_history'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('product_stock_history').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_product_stock_history',
  description: 'Get a single record from product_stock_history by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_product_stock_history'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('product_stock_history').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_product_stock_history',
  description: 'List multiple records from product_stock_history',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_product_stock_history'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('product_stock_history').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_scenario_comparisons',
  description: 'Create a new record in scenario_comparisons',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      scenario_ids: { type: 'array', items: { type: 'string' } },
      comparison_metrics: { type: 'object' },
    },
    required: ['name', 'scenario_ids']
  }
});
generatedHandlers['create_scenario_comparisons'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('scenario_comparisons').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_scenario_comparisons',
  description: 'Update an existing record in scenario_comparisons',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      scenario_ids: { type: 'array', items: { type: 'string' } },
      comparison_metrics: { type: 'object' },
    },
    required: ['id']
  }
});
generatedHandlers['update_scenario_comparisons'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('scenario_comparisons').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_scenario_comparisons',
  description: 'Delete a record from scenario_comparisons',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_scenario_comparisons'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_comparisons').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_scenario_comparisons',
  description: 'Get a single record from scenario_comparisons by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_scenario_comparisons'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('scenario_comparisons').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_scenario_comparisons',
  description: 'List multiple records from scenario_comparisons',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_scenario_comparisons'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('scenario_comparisons').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_invoice_line_items',
  description: 'Create a new record in supplier_invoice_line_items',
  inputSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_invoices.id`.<fk table=\'supplier_invoices\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      total: { type: 'number' },
      sort_order: { type: 'number' },
    },
    required: ['invoice_id', 'description']
  }
});
generatedHandlers['create_supplier_invoice_line_items'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('supplier_invoice_line_items').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_invoice_line_items',
  description: 'Update an existing record in supplier_invoice_line_items',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_invoices.id`.<fk table=\'supplier_invoices\' column=\'id\'/>' },
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit_price: { type: 'number' },
      total: { type: 'number' },
      sort_order: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_invoice_line_items'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_invoice_line_items').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_invoice_line_items',
  description: 'Delete a record from supplier_invoice_line_items',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_invoice_line_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_invoice_line_items').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_invoice_line_items',
  description: 'Get a single record from supplier_invoice_line_items by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_invoice_line_items'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_invoice_line_items').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_invoice_line_items',
  description: 'List multiple records from supplier_invoice_line_items',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_invoice_line_items'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_invoice_line_items').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_accounting_chart_of_accounts',
  description: 'Create a new record in accounting_chart_of_accounts',
  inputSchema: {
    type: 'object',
    properties: {
      account_code: { type: 'string' },
      account_name: { type: 'string' },
      account_type: { type: 'string' },
      account_category: { type: 'string' },
      description: { type: 'string' },
      is_active: { type: 'boolean' },
      parent_code: { type: 'string' },
    },
    required: ['account_code', 'account_name', 'account_type']
  }
});
generatedHandlers['create_accounting_chart_of_accounts'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('accounting_chart_of_accounts').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_accounting_chart_of_accounts',
  description: 'Update an existing record in accounting_chart_of_accounts',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      account_code: { type: 'string' },
      account_name: { type: 'string' },
      account_type: { type: 'string' },
      account_category: { type: 'string' },
      description: { type: 'string' },
      is_active: { type: 'boolean' },
      parent_code: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_accounting_chart_of_accounts'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('accounting_chart_of_accounts').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_accounting_chart_of_accounts',
  description: 'Delete a record from accounting_chart_of_accounts',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_accounting_chart_of_accounts'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_chart_of_accounts').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_accounting_chart_of_accounts',
  description: 'Get a single record from accounting_chart_of_accounts by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_accounting_chart_of_accounts'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_chart_of_accounts').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_accounting_chart_of_accounts',
  description: 'List multiple records from accounting_chart_of_accounts',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_accounting_chart_of_accounts'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('accounting_chart_of_accounts').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_orders',
  description: 'Create a new record in supplier_orders',
  inputSchema: {
    type: 'object',
    properties: {
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      order_number: { type: 'string' },
      order_date: { type: 'string' },
      expected_delivery_date: { type: 'string' },
      actual_delivery_date: { type: 'string' },
      order_status: { type: 'string' },
      total_amount: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['order_number']
  }
});
generatedHandlers['create_supplier_orders'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('supplier_orders').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_orders',
  description: 'Update an existing record in supplier_orders',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      order_number: { type: 'string' },
      order_date: { type: 'string' },
      expected_delivery_date: { type: 'string' },
      actual_delivery_date: { type: 'string' },
      order_status: { type: 'string' },
      total_amount: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_orders'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_orders').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_orders',
  description: 'Delete a record from supplier_orders',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_orders'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_orders').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_orders',
  description: 'Get a single record from supplier_orders by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_orders'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_orders').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_orders',
  description: 'List multiple records from supplier_orders',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_orders'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_orders').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_barcode_scan_logs',
  description: 'Create a new record in barcode_scan_logs',
  inputSchema: {
    type: 'object',
    properties: {
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      barcode: { type: 'string' },
      scan_timestamp: { type: 'string' },
      location: { type: 'string' },
      quantity: { type: 'number' },
      action: { type: 'string' },
    },
    required: ['barcode']
  }
});
generatedHandlers['create_barcode_scan_logs'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('barcode_scan_logs').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_barcode_scan_logs',
  description: 'Update an existing record in barcode_scan_logs',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      product_id: { type: 'string', description: 'Note: This is a Foreign Key to `products.id`.<fk table=\'products\' column=\'id\'/>' },
      barcode: { type: 'string' },
      scan_timestamp: { type: 'string' },
      location: { type: 'string' },
      quantity: { type: 'number' },
      action: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_barcode_scan_logs'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('barcode_scan_logs').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_barcode_scan_logs',
  description: 'Delete a record from barcode_scan_logs',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_barcode_scan_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('barcode_scan_logs').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_barcode_scan_logs',
  description: 'Get a single record from barcode_scan_logs by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_barcode_scan_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('barcode_scan_logs').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_barcode_scan_logs',
  description: 'List multiple records from barcode_scan_logs',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_barcode_scan_logs'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('barcode_scan_logs').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_data_export_requests',
  description: 'Create a new record in data_export_requests',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      file_url: { type: 'string' },
      file_size: { type: 'number' },
      requested_at: { type: 'string' },
      completed_at: { type: 'string' },
      expires_at: { type: 'string' },
    },
    required: ['status']
  }
});
generatedHandlers['create_data_export_requests'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('data_export_requests').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_data_export_requests',
  description: 'Update an existing record in data_export_requests',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      status: { type: 'string' },
      file_url: { type: 'string' },
      file_size: { type: 'number' },
      requested_at: { type: 'string' },
      completed_at: { type: 'string' },
      expires_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_data_export_requests'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('data_export_requests').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_data_export_requests',
  description: 'Delete a record from data_export_requests',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_data_export_requests'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('data_export_requests').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_data_export_requests',
  description: 'Get a single record from data_export_requests by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_data_export_requests'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('data_export_requests').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_data_export_requests',
  description: 'List multiple records from data_export_requests',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_data_export_requests'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('data_export_requests').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_service_categories',
  description: 'Create a new record in service_categories',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name']
  }
});
generatedHandlers['create_service_categories'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('service_categories').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_service_categories',
  description: 'Update an existing record in service_categories',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_service_categories'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('service_categories').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_service_categories',
  description: 'Delete a record from service_categories',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_service_categories'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('service_categories').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_service_categories',
  description: 'Get a single record from service_categories by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_service_categories'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('service_categories').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_service_categories',
  description: 'List multiple records from service_categories',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_service_categories'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('service_categories').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_webhook_endpoints',
  description: 'Create a new record in webhook_endpoints',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      secret: { type: 'string' },
      events: { type: 'array', items: { type: 'string' } },
      is_active: { type: 'boolean' },
      last_triggered_at: { type: 'string' },
      failure_count: { type: 'number' },
    },
    required: ['url', 'secret', 'events']
  }
});
generatedHandlers['create_webhook_endpoints'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('webhook_endpoints').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_webhook_endpoints',
  description: 'Update an existing record in webhook_endpoints',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      url: { type: 'string' },
      secret: { type: 'string' },
      events: { type: 'array', items: { type: 'string' } },
      is_active: { type: 'boolean' },
      last_triggered_at: { type: 'string' },
      failure_count: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_webhook_endpoints'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('webhook_endpoints').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_webhook_endpoints',
  description: 'Delete a record from webhook_endpoints',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_webhook_endpoints'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('webhook_endpoints').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_webhook_endpoints',
  description: 'Get a single record from webhook_endpoints by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_webhook_endpoints'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('webhook_endpoints').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_webhook_endpoints',
  description: 'List multiple records from webhook_endpoints',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_webhook_endpoints'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('webhook_endpoints').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_delivery_routes',
  description: 'Create a new record in delivery_routes',
  inputSchema: {
    type: 'object',
    properties: {
      order_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>' },
      supplier_location_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_locations.id`.<fk table=\'supplier_locations\' column=\'id\'/>' },
      delivery_location_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      route_distance: { type: 'number' },
      estimated_duration: { type: 'number' },
      actual_duration: { type: 'number' },
      route_polyline: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_delivery_routes'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('delivery_routes').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_delivery_routes',
  description: 'Update an existing record in delivery_routes',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      order_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_orders.id`.<fk table=\'supplier_orders\' column=\'id\'/>' },
      supplier_location_id: { type: 'string', description: 'Note: This is a Foreign Key to `supplier_locations.id`.<fk table=\'supplier_locations\' column=\'id\'/>' },
      delivery_location_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      route_distance: { type: 'number' },
      estimated_duration: { type: 'number' },
      actual_duration: { type: 'number' },
      route_polyline: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_delivery_routes'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('delivery_routes').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_delivery_routes',
  description: 'Delete a record from delivery_routes',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_delivery_routes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('delivery_routes').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_delivery_routes',
  description: 'Get a single record from delivery_routes by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_delivery_routes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('delivery_routes').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_delivery_routes',
  description: 'List multiple records from delivery_routes',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_delivery_routes'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('delivery_routes').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_billing_info',
  description: 'Create a new record in billing_info',
  inputSchema: {
    type: 'object',
    properties: {
      company_name: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      postal_code: { type: 'string' },
      country: { type: 'string' },
      vat_number: { type: 'string' },
      siret: { type: 'string' },
      plan: { type: 'string' },
      plan_price: { type: 'number' },
      plan_interval: { type: 'string' },
      next_billing_date: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_billing_info'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('billing_info').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_billing_info',
  description: 'Update an existing record in billing_info',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      company_name: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      postal_code: { type: 'string' },
      country: { type: 'string' },
      vat_number: { type: 'string' },
      siret: { type: 'string' },
      plan: { type: 'string' },
      plan_price: { type: 'number' },
      plan_interval: { type: 'string' },
      next_billing_date: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_billing_info'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('billing_info').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_billing_info',
  description: 'Delete a record from billing_info',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_billing_info'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('billing_info').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_billing_info',
  description: 'Get a single record from billing_info by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_billing_info'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('billing_info').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_billing_info',
  description: 'List multiple records from billing_info',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_billing_info'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('billing_info').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_payment_reminder_logs',
  description: 'Create a new record in payment_reminder_logs',
  inputSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      rule_id: { type: 'string', description: 'Note: This is a Foreign Key to `payment_reminder_rules.id`.<fk table=\'payment_reminder_rules\' column=\'id\'/>' },
      reminder_number: { type: 'number' },
      sent_at: { type: 'string' },
      status: { type: 'string' },
      recipient_email: { type: 'string' },
    },
    required: ['invoice_id', 'reminder_number']
  }
});
generatedHandlers['create_payment_reminder_logs'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('payment_reminder_logs').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_payment_reminder_logs',
  description: 'Update an existing record in payment_reminder_logs',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      rule_id: { type: 'string', description: 'Note: This is a Foreign Key to `payment_reminder_rules.id`.<fk table=\'payment_reminder_rules\' column=\'id\'/>' },
      reminder_number: { type: 'number' },
      sent_at: { type: 'string' },
      status: { type: 'string' },
      recipient_email: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_payment_reminder_logs'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('payment_reminder_logs').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_payment_reminder_logs',
  description: 'Delete a record from payment_reminder_logs',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_payment_reminder_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_reminder_logs').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_payment_reminder_logs',
  description: 'Get a single record from payment_reminder_logs by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_payment_reminder_logs'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_reminder_logs').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_payment_reminder_logs',
  description: 'List multiple records from payment_reminder_logs',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_payment_reminder_logs'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('payment_reminder_logs').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_webhook_deliveries',
  description: 'Create a new record in webhook_deliveries',
  inputSchema: {
    type: 'object',
    properties: {
      webhook_endpoint_id: { type: 'string', description: 'Note: This is a Foreign Key to `webhook_endpoints.id`.<fk table=\'webhook_endpoints\' column=\'id\'/>' },
      event: { type: 'string' },
      payload: { type: 'object' },
      status_code: { type: 'number' },
      response_body: { type: 'string' },
      delivered: { type: 'boolean' },
      attempts: { type: 'number' },
    },
    required: ['webhook_endpoint_id', 'event', 'payload']
  }
});
generatedHandlers['create_webhook_deliveries'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('webhook_deliveries').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_webhook_deliveries',
  description: 'Update an existing record in webhook_deliveries',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      webhook_endpoint_id: { type: 'string', description: 'Note: This is a Foreign Key to `webhook_endpoints.id`.<fk table=\'webhook_endpoints\' column=\'id\'/>' },
      event: { type: 'string' },
      payload: { type: 'object' },
      status_code: { type: 'number' },
      response_body: { type: 'string' },
      delivered: { type: 'boolean' },
      attempts: { type: 'number' },
    },
    required: ['id']
  }
});
generatedHandlers['update_webhook_deliveries'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('webhook_deliveries').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_webhook_deliveries',
  description: 'Delete a record from webhook_deliveries',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_webhook_deliveries'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('webhook_deliveries').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_webhook_deliveries',
  description: 'Get a single record from webhook_deliveries by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_webhook_deliveries'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('webhook_deliveries').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_webhook_deliveries',
  description: 'List multiple records from webhook_deliveries',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_webhook_deliveries'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('webhook_deliveries').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_company',
  description: 'Create a new record in company',
  inputSchema: {
    type: 'object',
    properties: {
      company_name: { type: 'string' },
      company_type: { type: 'string' },
      registration_number: { type: 'string' },
      tax_id: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      postal_code: { type: 'string' },
      country: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      website: { type: 'string' },
      logo_url: { type: 'string' },
      bank_account: { type: 'string' },
      bank_name: { type: 'string' },
      iban: { type: 'string' },
      swift: { type: 'string' },
      currency: { type: 'string', description: 'ISO 4217 currency code (e.g., EUR, USD, XAF, GBP)' },
    },
    required: []
  }
});
generatedHandlers['create_company'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('company').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_company',
  description: 'Update an existing record in company',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      company_name: { type: 'string' },
      company_type: { type: 'string' },
      registration_number: { type: 'string' },
      tax_id: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      postal_code: { type: 'string' },
      country: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      website: { type: 'string' },
      logo_url: { type: 'string' },
      bank_account: { type: 'string' },
      bank_name: { type: 'string' },
      iban: { type: 'string' },
      swift: { type: 'string' },
      currency: { type: 'string', description: 'ISO 4217 currency code (e.g., EUR, USD, XAF, GBP)' },
    },
    required: ['id']
  }
});
generatedHandlers['update_company'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('company').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_company',
  description: 'Delete a record from company',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_company'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('company').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_company',
  description: 'Get a single record from company by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_company'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('company').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_company',
  description: 'List multiple records from company',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_company'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('company').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_bank_transactions',
  description: 'Create a new record in bank_transactions',
  inputSchema: {
    type: 'object',
    properties: {
      bank_connection_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>' },
      external_id: { type: 'string' },
      date: { type: 'string' },
      booking_date: { type: 'string' },
      value_date: { type: 'string' },
      amount: { type: 'number' },
      currency: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      creditor_name: { type: 'string' },
      debtor_name: { type: 'string' },
      remittance_info: { type: 'string' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      reconciliation_status: { type: 'string' },
      match_confidence: { type: 'number' },
      matched_at: { type: 'string' },
      raw_data: { type: 'object' },
    },
    required: ['bank_connection_id', 'date', 'amount']
  }
});
generatedHandlers['create_bank_transactions'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('bank_transactions').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_bank_transactions',
  description: 'Update an existing record in bank_transactions',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      bank_connection_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>' },
      external_id: { type: 'string' },
      date: { type: 'string' },
      booking_date: { type: 'string' },
      value_date: { type: 'string' },
      amount: { type: 'number' },
      currency: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      creditor_name: { type: 'string' },
      debtor_name: { type: 'string' },
      remittance_info: { type: 'string' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      reconciliation_status: { type: 'string' },
      match_confidence: { type: 'number' },
      matched_at: { type: 'string' },
      raw_data: { type: 'object' },
    },
    required: ['id']
  }
});
generatedHandlers['update_bank_transactions'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('bank_transactions').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_bank_transactions',
  description: 'Delete a record from bank_transactions',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_bank_transactions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_transactions').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_bank_transactions',
  description: 'Get a single record from bank_transactions by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_bank_transactions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_transactions').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_bank_transactions',
  description: 'List multiple records from bank_transactions',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_bank_transactions'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('bank_transactions').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_payment_terms',
  description: 'Create a new record in payment_terms',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      days: { type: 'number' },
      description: { type: 'string' },
    },
    required: ['name', 'days']
  }
});
generatedHandlers['create_payment_terms'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('payment_terms').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_payment_terms',
  description: 'Update an existing record in payment_terms',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      days: { type: 'number' },
      description: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_payment_terms'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('payment_terms').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_payment_terms',
  description: 'Delete a record from payment_terms',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_payment_terms'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_terms').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_payment_terms',
  description: 'Get a single record from payment_terms by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_payment_terms'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('payment_terms').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_payment_terms',
  description: 'List multiple records from payment_terms',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_payment_terms'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('payment_terms').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_credit_notes',
  description: 'Create a new record in credit_notes',
  inputSchema: {
    type: 'object',
    properties: {
      credit_note_number: { type: 'string' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      date: { type: 'string' },
      reason: { type: 'string' },
      total_ht: { type: 'number' },
      tax_rate: { type: 'number' },
      tax_amount: { type: 'number' },
      total_ttc: { type: 'number' },
      status: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['credit_note_number', 'date']
  }
});
generatedHandlers['create_credit_notes'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('credit_notes').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_credit_notes',
  description: 'Update an existing record in credit_notes',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      credit_note_number: { type: 'string' },
      invoice_id: { type: 'string', description: 'Note: This is a Foreign Key to `invoices.id`.<fk table=\'invoices\' column=\'id\'/>' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      date: { type: 'string' },
      reason: { type: 'string' },
      total_ht: { type: 'number' },
      tax_rate: { type: 'number' },
      tax_amount: { type: 'number' },
      total_ttc: { type: 'number' },
      status: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_credit_notes'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('credit_notes').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_credit_notes',
  description: 'Delete a record from credit_notes',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_credit_notes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_notes').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_credit_notes',
  description: 'Get a single record from credit_notes by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_credit_notes'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('credit_notes').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_credit_notes',
  description: 'List multiple records from credit_notes',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_credit_notes'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('credit_notes').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_reports_cache',
  description: 'Create a new record in supplier_reports_cache',
  inputSchema: {
    type: 'object',
    properties: {
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      report_type: { type: 'string' },
      period: { type: 'string' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      data: { type: 'object' },
      generated_at: { type: 'string' },
      expires_at: { type: 'string' },
    },
    required: ['report_type', 'period']
  }
});
generatedHandlers['create_supplier_reports_cache'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('supplier_reports_cache').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_reports_cache',
  description: 'Update an existing record in supplier_reports_cache',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      report_type: { type: 'string' },
      period: { type: 'string' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      data: { type: 'object' },
      generated_at: { type: 'string' },
      expires_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_reports_cache'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_reports_cache').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_reports_cache',
  description: 'Delete a record from supplier_reports_cache',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_reports_cache'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_reports_cache').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_reports_cache',
  description: 'Get a single record from supplier_reports_cache by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_reports_cache'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_reports_cache').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_reports_cache',
  description: 'List multiple records from supplier_reports_cache',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_reports_cache'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_reports_cache').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_bank_reconciliation_sessions',
  description: 'Create a new record in bank_reconciliation_sessions',
  inputSchema: {
    type: 'object',
    properties: {
      statement_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>' },
      session_date: { type: 'string' },
      status: { type: 'string' },
      total_lines: { type: 'number' },
      matched_lines: { type: 'number' },
      unmatched_lines: { type: 'number' },
      ignored_lines: { type: 'number' },
      total_credits: { type: 'number' },
      total_debits: { type: 'number' },
      matched_credits: { type: 'number' },
      matched_debits: { type: 'number' },
      difference: { type: 'number' },
      completed_at: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['statement_id', 'status']
  }
});
generatedHandlers['create_bank_reconciliation_sessions'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('bank_reconciliation_sessions').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_bank_reconciliation_sessions',
  description: 'Update an existing record in bank_reconciliation_sessions',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      statement_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>' },
      session_date: { type: 'string' },
      status: { type: 'string' },
      total_lines: { type: 'number' },
      matched_lines: { type: 'number' },
      unmatched_lines: { type: 'number' },
      ignored_lines: { type: 'number' },
      total_credits: { type: 'number' },
      total_debits: { type: 'number' },
      matched_credits: { type: 'number' },
      matched_debits: { type: 'number' },
      difference: { type: 'number' },
      completed_at: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_bank_reconciliation_sessions'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('bank_reconciliation_sessions').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_bank_reconciliation_sessions',
  description: 'Delete a record from bank_reconciliation_sessions',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_bank_reconciliation_sessions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_reconciliation_sessions').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_bank_reconciliation_sessions',
  description: 'Get a single record from bank_reconciliation_sessions by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_bank_reconciliation_sessions'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_reconciliation_sessions').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_bank_reconciliation_sessions',
  description: 'List multiple records from bank_reconciliation_sessions',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_bank_reconciliation_sessions'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('bank_reconciliation_sessions').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_biometric_credentials',
  description: 'Create a new record in biometric_credentials',
  inputSchema: {
    type: 'object',
    properties: {
      biometric_type: { type: 'string' },
      device_id: { type: 'string' },
      public_key: { type: 'string' },
      last_used_at: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['biometric_type', 'public_key']
  }
});
generatedHandlers['create_biometric_credentials'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('biometric_credentials').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_biometric_credentials',
  description: 'Update an existing record in biometric_credentials',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      biometric_type: { type: 'string' },
      device_id: { type: 'string' },
      public_key: { type: 'string' },
      last_used_at: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_biometric_credentials'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('biometric_credentials').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_biometric_credentials',
  description: 'Delete a record from biometric_credentials',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_biometric_credentials'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('biometric_credentials').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_biometric_credentials',
  description: 'Get a single record from biometric_credentials by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_biometric_credentials'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('biometric_credentials').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_biometric_credentials',
  description: 'List multiple records from biometric_credentials',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_biometric_credentials'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('biometric_credentials').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_bank_sync_history',
  description: 'Create a new record in bank_sync_history',
  inputSchema: {
    type: 'object',
    properties: {
      bank_connection_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>' },
      sync_type: { type: 'string' },
      status: { type: 'string' },
      transactions_synced: { type: 'number' },
      error_message: { type: 'string' },
      started_at: { type: 'string' },
      completed_at: { type: 'string' },
    },
    required: ['bank_connection_id']
  }
});
generatedHandlers['create_bank_sync_history'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('bank_sync_history').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_bank_sync_history',
  description: 'Update an existing record in bank_sync_history',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      bank_connection_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_connections.id`.<fk table=\'bank_connections\' column=\'id\'/>' },
      sync_type: { type: 'string' },
      status: { type: 'string' },
      transactions_synced: { type: 'number' },
      error_message: { type: 'string' },
      started_at: { type: 'string' },
      completed_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_bank_sync_history'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('bank_sync_history').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_bank_sync_history',
  description: 'Delete a record from bank_sync_history',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_bank_sync_history'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_sync_history').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_bank_sync_history',
  description: 'Get a single record from bank_sync_history by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_bank_sync_history'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_sync_history').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_bank_sync_history',
  description: 'List multiple records from bank_sync_history',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_bank_sync_history'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('bank_sync_history').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_expenses',
  description: 'Create a new record in expenses',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      amount: { type: 'number' },
      category: { type: 'string' },
      description: { type: 'string' },
      receipt_url: { type: 'string' },
      refacturable: { type: 'boolean' },
      tax_rate: { type: 'number' },
      amount_ht: { type: 'number' },
      tax_amount: { type: 'number' },
      expense_date: { type: 'string' },
    },
    required: ['amount']
  }
});
generatedHandlers['create_expenses'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('expenses').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_expenses',
  description: 'Update an existing record in expenses',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      amount: { type: 'number' },
      category: { type: 'string' },
      description: { type: 'string' },
      receipt_url: { type: 'string' },
      refacturable: { type: 'boolean' },
      tax_rate: { type: 'number' },
      amount_ht: { type: 'number' },
      tax_amount: { type: 'number' },
      expense_date: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_expenses'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('expenses').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_expenses',
  description: 'Delete a record from expenses',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_expenses'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('expenses').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_expenses',
  description: 'Get a single record from expenses by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_expenses'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('expenses').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_expenses',
  description: 'List multiple records from expenses',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_expenses'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('expenses').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_api_keys',
  description: 'Create a new record in api_keys',
  inputSchema: {
    type: 'object',
    properties: {
      key_hash: { type: 'string' },
      key_prefix: { type: 'string' },
      name: { type: 'string' },
      is_active: { type: 'boolean' },
      expires_at: { type: 'string' },
      last_used_at: { type: 'string' },
      scopes: { type: 'array', items: { type: 'string' } },
    },
    required: ['key_hash', 'key_prefix']
  }
});
generatedHandlers['create_api_keys'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('api_keys').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_api_keys',
  description: 'Update an existing record in api_keys',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      key_hash: { type: 'string' },
      key_prefix: { type: 'string' },
      name: { type: 'string' },
      is_active: { type: 'boolean' },
      expires_at: { type: 'string' },
      last_used_at: { type: 'string' },
      scopes: { type: 'array', items: { type: 'string' } },
    },
    required: ['id']
  }
});
generatedHandlers['update_api_keys'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('api_keys').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_api_keys',
  description: 'Delete a record from api_keys',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_api_keys'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('api_keys').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_api_keys',
  description: 'Get a single record from api_keys by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_api_keys'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('api_keys').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_api_keys',
  description: 'List multiple records from api_keys',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_api_keys'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('api_keys').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_backup_settings',
  description: 'Create a new record in backup_settings',
  inputSchema: {
    type: 'object',
    properties: {
      provider: { type: 'string' },
      is_enabled: { type: 'boolean' },
      frequency: { type: 'string' },
      last_backup_at: { type: 'string' },
      next_backup_at: { type: 'string' },
      access_token: { type: 'string' },
      refresh_token: { type: 'string' },
      token_expires_at: { type: 'string' },
      folder_id: { type: 'string' },
      folder_name: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_backup_settings'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('backup_settings').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_backup_settings',
  description: 'Update an existing record in backup_settings',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      provider: { type: 'string' },
      is_enabled: { type: 'boolean' },
      frequency: { type: 'string' },
      last_backup_at: { type: 'string' },
      next_backup_at: { type: 'string' },
      access_token: { type: 'string' },
      refresh_token: { type: 'string' },
      token_expires_at: { type: 'string' },
      folder_id: { type: 'string' },
      folder_name: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_backup_settings'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('backup_settings').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_backup_settings',
  description: 'Delete a record from backup_settings',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_backup_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('backup_settings').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_backup_settings',
  description: 'Get a single record from backup_settings by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_backup_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('backup_settings').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_backup_settings',
  description: 'List multiple records from backup_settings',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_backup_settings'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('backup_settings').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_supplier_services',
  description: 'Create a new record in supplier_services',
  inputSchema: {
    type: 'object',
    properties: {
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      service_name: { type: 'string' },
      description: { type: 'string' },
      pricing_type: { type: 'string' },
      hourly_rate: { type: 'number' },
      fixed_price: { type: 'number' },
      unit: { type: 'string' },
      availability: { type: 'string' },
    },
    required: ['service_name']
  }
});
generatedHandlers['create_supplier_services'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('supplier_services').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_supplier_services',
  description: 'Update an existing record in supplier_services',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      supplier_id: { type: 'string', description: 'Note: This is a Foreign Key to `suppliers.id`.<fk table=\'suppliers\' column=\'id\'/>' },
      service_name: { type: 'string' },
      description: { type: 'string' },
      pricing_type: { type: 'string' },
      hourly_rate: { type: 'number' },
      fixed_price: { type: 'number' },
      unit: { type: 'string' },
      availability: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_supplier_services'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('supplier_services').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_supplier_services',
  description: 'Delete a record from supplier_services',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_supplier_services'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_services').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_supplier_services',
  description: 'Get a single record from supplier_services by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_supplier_services'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('supplier_services').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_supplier_services',
  description: 'List multiple records from supplier_services',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_supplier_services'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('supplier_services').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_debt_payments',
  description: 'Create a new record in debt_payments',
  inputSchema: {
    type: 'object',
    properties: {
      record_type: { type: 'string' },
      record_id: { type: 'string' },
      amount: { type: 'number' },
      payment_date: { type: 'string' },
      payment_method: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['record_type', 'record_id', 'amount', 'payment_date']
  }
});
generatedHandlers['create_debt_payments'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('debt_payments').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_debt_payments',
  description: 'Update an existing record in debt_payments',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      record_type: { type: 'string' },
      record_id: { type: 'string' },
      amount: { type: 'number' },
      payment_date: { type: 'string' },
      payment_method: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_debt_payments'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('debt_payments').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_debt_payments',
  description: 'Delete a record from debt_payments',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_debt_payments'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('debt_payments').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_debt_payments',
  description: 'Get a single record from debt_payments by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_debt_payments'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('debt_payments').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_debt_payments',
  description: 'List multiple records from debt_payments',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_debt_payments'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('debt_payments').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_receivables',
  description: 'Create a new record in receivables',
  inputSchema: {
    type: 'object',
    properties: {
      debtor_name: { type: 'string' },
      debtor_phone: { type: 'string' },
      debtor_email: { type: 'string' },
      description: { type: 'string' },
      amount: { type: 'number' },
      amount_paid: { type: 'number' },
      currency: { type: 'string' },
      date_lent: { type: 'string' },
      due_date: { type: 'string' },
      status: { type: 'string' },
      category: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['debtor_name', 'amount', 'amount_paid', 'currency', 'date_lent', 'status']
  }
});
generatedHandlers['create_receivables'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('receivables').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_receivables',
  description: 'Update an existing record in receivables',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      debtor_name: { type: 'string' },
      debtor_phone: { type: 'string' },
      debtor_email: { type: 'string' },
      description: { type: 'string' },
      amount: { type: 'number' },
      amount_paid: { type: 'number' },
      currency: { type: 'string' },
      date_lent: { type: 'string' },
      due_date: { type: 'string' },
      status: { type: 'string' },
      category: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_receivables'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('receivables').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_receivables',
  description: 'Delete a record from receivables',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_receivables'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('receivables').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_receivables',
  description: 'Get a single record from receivables by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_receivables'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('receivables').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_receivables',
  description: 'List multiple records from receivables',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_receivables'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('receivables').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_bank_statement_lines',
  description: 'Create a new record in bank_statement_lines',
  inputSchema: {
    type: 'object',
    properties: {
      statement_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>' },
      line_number: { type: 'number' },
      transaction_date: { type: 'string' },
      value_date: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      amount: { type: 'number' },
      balance_after: { type: 'number' },
      raw_data: { type: 'object' },
      reconciliation_status: { type: 'string' },
      matched_source_type: { type: 'string' },
      matched_source_id: { type: 'string' },
      matched_at: { type: 'string' },
      matched_by: { type: 'string' },
      match_confidence: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['statement_id', 'transaction_date', 'amount', 'reconciliation_status']
  }
});
generatedHandlers['create_bank_statement_lines'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('bank_statement_lines').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_bank_statement_lines',
  description: 'Update an existing record in bank_statement_lines',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      statement_id: { type: 'string', description: 'Note: This is a Foreign Key to `bank_statements.id`.<fk table=\'bank_statements\' column=\'id\'/>' },
      line_number: { type: 'number' },
      transaction_date: { type: 'string' },
      value_date: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      amount: { type: 'number' },
      balance_after: { type: 'number' },
      raw_data: { type: 'object' },
      reconciliation_status: { type: 'string' },
      matched_source_type: { type: 'string' },
      matched_source_id: { type: 'string' },
      matched_at: { type: 'string' },
      matched_by: { type: 'string' },
      match_confidence: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_bank_statement_lines'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('bank_statement_lines').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_bank_statement_lines',
  description: 'Delete a record from bank_statement_lines',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_bank_statement_lines'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_statement_lines').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_bank_statement_lines',
  description: 'Get a single record from bank_statement_lines by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_bank_statement_lines'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('bank_statement_lines').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_bank_statement_lines',
  description: 'List multiple records from bank_statement_lines',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_bank_statement_lines'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('bank_statement_lines').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_accounting_tax_rates',
  description: 'Create a new record in accounting_tax_rates',
  inputSchema: {
    type: 'object',
    properties: {
      account_code: { type: 'string' },
      is_active: { type: 'boolean' },
      effective_date: { type: 'string' },
      name: { type: 'string' },
      rate: { type: 'number' },
      tax_type: { type: 'string' },
      is_default: { type: 'boolean' },
    },
    required: []
  }
});
generatedHandlers['create_accounting_tax_rates'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('accounting_tax_rates').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_accounting_tax_rates',
  description: 'Update an existing record in accounting_tax_rates',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      account_code: { type: 'string' },
      is_active: { type: 'boolean' },
      effective_date: { type: 'string' },
      name: { type: 'string' },
      rate: { type: 'number' },
      tax_type: { type: 'string' },
      is_default: { type: 'boolean' },
    },
    required: ['id']
  }
});
generatedHandlers['update_accounting_tax_rates'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('accounting_tax_rates').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_accounting_tax_rates',
  description: 'Delete a record from accounting_tax_rates',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_accounting_tax_rates'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_tax_rates').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_accounting_tax_rates',
  description: 'Get a single record from accounting_tax_rates by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_accounting_tax_rates'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_tax_rates').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_accounting_tax_rates',
  description: 'List multiple records from accounting_tax_rates',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_accounting_tax_rates'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('accounting_tax_rates').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_recurring_invoices',
  description: 'Create a new record in recurring_invoices',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      frequency: { type: 'string' },
      next_date: { type: 'string' },
      status: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_recurring_invoices'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('recurring_invoices').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_recurring_invoices',
  description: 'Update an existing record in recurring_invoices',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      frequency: { type: 'string' },
      next_date: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_recurring_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('recurring_invoices').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_recurring_invoices',
  description: 'Delete a record from recurring_invoices',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_recurring_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('recurring_invoices').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_recurring_invoices',
  description: 'Get a single record from recurring_invoices by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_recurring_invoices'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('recurring_invoices').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_recurring_invoices',
  description: 'List multiple records from recurring_invoices',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_recurring_invoices'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('recurring_invoices').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_product_categories',
  description: 'Create a new record in product_categories',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name']
  }
});
generatedHandlers['create_product_categories'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('product_categories').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_product_categories',
  description: 'Update an existing record in product_categories',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_product_categories'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('product_categories').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_product_categories',
  description: 'Delete a record from product_categories',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_product_categories'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('product_categories').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_product_categories',
  description: 'Get a single record from product_categories by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_product_categories'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('product_categories').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_product_categories',
  description: 'List multiple records from product_categories',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_product_categories'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('product_categories').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_purchase_orders',
  description: 'Create a new record in purchase_orders',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      po_number: { type: 'string' },
      date: { type: 'string' },
      due_date: { type: 'string' },
      items: { type: 'object' },
      total: { type: 'number' },
      status: { type: 'string' },
      payment_terms_id: { type: 'string', description: 'Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>' },
      notes: { type: 'string' },
    },
    required: ['po_number']
  }
});
generatedHandlers['create_purchase_orders'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('purchase_orders').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_purchase_orders',
  description: 'Update an existing record in purchase_orders',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      client_id: { type: 'string', description: 'Note: This is a Foreign Key to `clients.id`.<fk table=\'clients\' column=\'id\'/>' },
      po_number: { type: 'string' },
      date: { type: 'string' },
      due_date: { type: 'string' },
      items: { type: 'object' },
      total: { type: 'number' },
      status: { type: 'string' },
      payment_terms_id: { type: 'string', description: 'Note: This is a Foreign Key to `payment_terms.id`.<fk table=\'payment_terms\' column=\'id\'/>' },
      notes: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_purchase_orders'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('purchase_orders').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_purchase_orders',
  description: 'Delete a record from purchase_orders',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_purchase_orders'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('purchase_orders').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_purchase_orders',
  description: 'Get a single record from purchase_orders by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_purchase_orders'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('purchase_orders').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_purchase_orders',
  description: 'List multiple records from purchase_orders',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_purchase_orders'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('purchase_orders').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_accounting_plans',
  description: 'Create a new record in accounting_plans',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      country_code: { type: 'string' },
      description: { type: 'string' },
      source: { type: 'string' },
      uploaded_by: { type: 'string' },
      is_global: { type: 'boolean' },
      file_url: { type: 'string' },
      accounts_count: { type: 'number' },
      status: { type: 'string' },
    },
    required: ['name']
  }
});
generatedHandlers['create_accounting_plans'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  
  const { data, error } = await sb.from('accounting_plans').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_accounting_plans',
  description: 'Update an existing record in accounting_plans',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      country_code: { type: 'string' },
      description: { type: 'string' },
      source: { type: 'string' },
      uploaded_by: { type: 'string' },
      is_global: { type: 'boolean' },
      file_url: { type: 'string' },
      accounts_count: { type: 'number' },
      status: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_accounting_plans'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('accounting_plans').update(updates).eq('id', id);
  
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_accounting_plans',
  description: 'Delete a record from accounting_plans',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_accounting_plans'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_plans').delete().eq('id', id);
  
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_accounting_plans',
  description: 'Get a single record from accounting_plans by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_accounting_plans'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('accounting_plans').select('*').eq('id', id);
  
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_accounting_plans',
  description: 'List multiple records from accounting_plans',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_accounting_plans'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('accounting_plans').select('*');
  
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_notifications',
  description: 'Create a new record in notifications',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      message: { type: 'string' },
      title: { type: 'string' },
      is_read: { type: 'boolean' },
      read_at: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_notifications'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('notifications').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_notifications',
  description: 'Update an existing record in notifications',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      type: { type: 'string' },
      message: { type: 'string' },
      title: { type: 'string' },
      is_read: { type: 'boolean' },
      read_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_notifications'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('notifications').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_notifications',
  description: 'Delete a record from notifications',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_notifications'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('notifications').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_notifications',
  description: 'Get a single record from notifications by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_notifications'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('notifications').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_notifications',
  description: 'List multiple records from notifications',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_notifications'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('notifications').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_team_members',
  description: 'Create a new record in team_members',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string' },
      joined_at: { type: 'string' },
    },
    required: ['name', 'email']
  }
});
generatedHandlers['create_team_members'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('team_members').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_team_members',
  description: 'Update an existing record in team_members',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string' },
      joined_at: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_team_members'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('team_members').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_team_members',
  description: 'Delete a record from team_members',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_team_members'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('team_members').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_team_members',
  description: 'Get a single record from team_members by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_team_members'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('team_members').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_team_members',
  description: 'List multiple records from team_members',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_team_members'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('team_members').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};

generatedTools.push({
  name: 'create_invoice_settings',
  description: 'Create a new record in invoice_settings',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: { type: 'string' },
      color_theme: { type: 'string' },
      custom_labels: { type: 'object' },
      show_logo: { type: 'boolean' },
      show_bank_details: { type: 'boolean' },
      show_payment_terms: { type: 'boolean' },
      footer_text: { type: 'string' },
      font_family: { type: 'string' },
    },
    required: []
  }
});
generatedHandlers['create_invoice_settings'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  payload.user_id = uid;
  const { data, error } = await sb.from('invoice_settings').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'update_invoice_settings',
  description: 'Update an existing record in invoice_settings',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },
      template_id: { type: 'string' },
      color_theme: { type: 'string' },
      custom_labels: { type: 'object' },
      show_logo: { type: 'boolean' },
      show_bank_details: { type: 'boolean' },
      show_payment_terms: { type: 'boolean' },
      footer_text: { type: 'string' },
      font_family: { type: 'string' },
    },
    required: ['id']
  }
});
generatedHandlers['update_invoice_settings'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('invoice_settings').update(updates).eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};

generatedTools.push({
  name: 'delete_invoice_settings',
  description: 'Delete a record from invoice_settings',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
generatedHandlers['delete_invoice_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('invoice_settings').delete().eq('id', id);
  q = q.eq('user_id', uid);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};

generatedTools.push({
  name: 'get_invoice_settings',
  description: 'Get a single record from invoice_settings by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
generatedHandlers['get_invoice_settings'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('invoice_settings').select('*').eq('id', id);
  q = q.eq('user_id', uid);
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};

generatedTools.push({
  name: 'list_invoice_settings',
  description: 'List multiple records from invoice_settings',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
generatedHandlers['list_invoice_settings'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('invoice_settings').select('*');
  q = q.eq('user_id', uid);
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};


generatedTools.push({
  name: 'delete_client',
  description: 'Delete a client from CashPilot',
  inputSchema: {
    type: 'object',
    properties: { client_id: { type: 'string', description: 'Client UUID to delete' } },
    required: ['client_id']
  }
});
generatedHandlers['delete_client'] = async (sb: any, uid: string, args: any) => {
  const { client_id } = args;
  const { error } = await sb.from('clients').delete().eq('id', client_id).eq('user_id', uid);
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, client_id }, null, 2);
};

generatedTools.push({
  name: 'delete_invoice',
  description: 'Delete an invoice from CashPilot',
  inputSchema: {
    type: 'object',
    properties: { invoice_id: { type: 'string', description: 'Invoice UUID to delete' } },
    required: ['invoice_id']
  }
});
generatedHandlers['delete_invoice'] = async (sb: any, uid: string, args: any) => {
  const { invoice_id } = args;
  const { error } = await sb.from('invoices').delete().eq('id', invoice_id).eq('user_id', uid);
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, invoice_id }, null, 2);
};
export const generatedWriteTools = new Set(generatedTools.filter(t => t.name.startsWith('create_') || t.name.startsWith('update_') || t.name.startsWith('delete_')).map(t => t.name));
