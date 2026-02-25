// AUTO-GENERATED CRUD TOOLS FOR EDGE FUNCTION
export const generatedTools: any[] = [];
export const generatedHandlers: Record<string, any> = {};

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
