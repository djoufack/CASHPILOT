import fs from 'fs';
import path from 'path';

// read .env
const envFile = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
const env: Record<string, string> = {};
envFile.split(/\r?\n/).forEach(line => {
    if (!line || line.startsWith('#')) return;
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0) {
        env[key.trim()] = vals.join('=').trim();
    }
});

const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
}

const excludedTables = ['audit_log', 'profiles', 'user_roles', 'role_permissions', 'schema_migrations'];

// Whitelist: only these tables get CRUD tools generated.
// All other tables are ignored. Hand-written tools cover the rest.
const whitelistedTables = [
  'invoice_items',
  'invoice_settings',
  'expenses',
  'quotes',
  'credit_notes',
  'recurring_invoices',
  'payment_terms',
  'payment_reminder_rules',
  'suppliers',
  'services',
  'service_categories',
  'company',
  'accounting_tax_rates',
  'bank_connections',
  'bank_transactions',
  'bank_statements',
  'bank_statement_lines',
  'bank_reconciliation_sessions',
  'payables',
  'receivables',
];

const systemColumns = ['id', 'created_at', 'updated_at', 'deleted_at', 'user_id'];

function mapTypeToJsonSchema(prop: any) {
    const t = prop.type;
    if (t === 'string') return "{ type: 'string' }";
    if (t === 'integer' || t === 'number') return "{ type: 'number' }";
    if (t === 'boolean') return "{ type: 'boolean' }";
    if (t === 'array') return "{ type: 'array', items: { type: 'string' } }";
    return "{ type: 'object' }";
}

async function fetchSchema() {
    const res = await fetch(SUPABASE_URL + '/rest/v1/?apikey=' + SUPABASE_ANON_KEY);
    const json = await res.json();

    let out = "// AUTO-GENERATED CRUD TOOLS FOR EDGE FUNCTION\n";
    out += "export const generatedTools: any[] = [];\n";
    out += "export const generatedHandlers: Record<string, any> = {};\n\n";

    for (const [tableName, definition] of Object.entries((json.definitions || {}) as Record<string, any>)) {
        if (excludedTables.includes(tableName)) continue;
        if (definition.type !== 'object' || !definition.properties) continue;
        if (!whitelistedTables.includes(tableName)) continue;

        const properties = definition.properties;
        const requiredCols = definition.required || [];
        const columns = Object.keys(properties).filter(c => !systemColumns.includes(c));
        if (columns.length === 0) continue;

        const hasUserId = !!properties['user_id'];
        const hasId = !!properties['id'];

        // 1. CREATE
        const createToolName = `create_${tableName}`;
        out += `generatedTools.push({
  name: '${createToolName}',
  description: 'Create a new record in ${tableName}',
  inputSchema: {
    type: 'object',
    properties: {
`;
        const reqCreate = [];
        for (const col of columns) {
            const prop = properties[col];
            let desc = prop.description ? prop.description.replace(/'/g, "\\'").replace(/[\r\n]+/g, ' ') : '';
            let jsSchema = mapTypeToJsonSchema(prop);
            if (desc) jsSchema = jsSchema.replace(' }', `, description: '${desc}' }`);
            out += `      ${col}: ${jsSchema},\n`;
            if (requiredCols.includes(col)) reqCreate.push(`'${col}'`);
        }
        out += `    },
    required: [${reqCreate.join(', ')}]
  }
});
`;
        out += `generatedHandlers['${createToolName}'] = async (sb: any, uid: string, args: any) => {
  const payload = { ...args };
  ${hasUserId ? 'payload.user_id = uid;' : ''}
  const { data, error } = await sb.from('${tableName}').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, record: data }, null, 2);
};\n\n`;

        if (hasId) {
            // 2. UPDATE
            const updateToolName = `update_${tableName}`;
            out += `generatedTools.push({
  name: '${updateToolName}',
  description: 'Update an existing record in ${tableName}',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Record UUID to update' },\n`;
            for (const col of columns) {
                const prop = properties[col];
                let desc = prop.description ? prop.description.replace(/'/g, "\\'").replace(/[\r\n]+/g, ' ') : '';
                let jsSchema = mapTypeToJsonSchema(prop);
                if (desc) jsSchema = jsSchema.replace(' }', `, description: '${desc}' }`);
                out += `      ${col}: ${jsSchema},\n`;
            }
            out += `    },
    required: ['id']
  }
});
`;
            out += `generatedHandlers['${updateToolName}'] = async (sb: any, uid: string, args: any) => {
  const { id, ...updates } = args;
  let q = sb.from('${tableName}').update(updates).eq('id', id);
  ${hasUserId ? "q = q.eq('user_id', uid);" : ''}
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, record: data }, null, 2);
};\n\n`;

            // 3. DELETE
            const deleteToolName = `delete_${tableName}`;
            out += `generatedTools.push({
  name: '${deleteToolName}',
  description: 'Delete a record from ${tableName}',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to delete' } },
    required: ['id']
  }
});
`;
            out += `generatedHandlers['${deleteToolName}'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('${tableName}').delete().eq('id', id);
  ${hasUserId ? "q = q.eq('user_id', uid);" : ''}
  const { error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ deleted: true, id }, null, 2);
};\n\n`;

            // 4. GET
            const getToolName = `get_${tableName}`;
            out += `generatedTools.push({
  name: '${getToolName}',
  description: 'Get a single record from ${tableName} by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Record UUID to fetch' } },
    required: ['id']
  }
});
`;
            out += `generatedHandlers['${getToolName}'] = async (sb: any, uid: string, args: any) => {
  const { id } = args;
  let q = sb.from('${tableName}').select('*').eq('id', id);
  ${hasUserId ? "q = q.eq('user_id', uid);" : ''}
  const { data, error } = await q.single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ record: data }, null, 2);
};\n\n`;
        }

        // 5. LIST
        const listToolName = `list_${tableName}`;
        out += `generatedTools.push({
  name: '${listToolName}',
  description: 'List multiple records from ${tableName}',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of records to return (default 50)' },
      offset: { type: 'number', description: 'Number of records to skip (default 0)' }
    }
  }
});
`;
        out += `generatedHandlers['${listToolName}'] = async (sb: any, uid: string, args: any) => {
  const limit = Number(args.limit) || 50;
  const offset = Number(args.offset) || 0;
  let q = sb.from('${tableName}').select('*');
  ${hasUserId ? "q = q.eq('user_id', uid);" : ''}
  const { data, error } = await q.range(offset, offset + limit - 1).limit(limit);
  if (error) throw new Error(error.message);
  return JSON.stringify({ records: data, count: data?.length || 0 }, null, 2);
};\n\n`;
    }

    // Add manual aliases for delete_client and delete_invoice for Edge Function!
    out += `
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
`;

    // Add required updates for WRITE_TOOLS set
    out += `export const generatedWriteTools = new Set(generatedTools.filter(t => t.name.startsWith('create_') || t.name.startsWith('update_') || t.name.startsWith('delete_')).map(t => t.name));\n`;

    fs.writeFileSync(path.join(process.cwd(), '../supabase/functions/mcp/generated_crud.ts'), out);
    console.log('Successfully generated Supabase Edge Function CRUD tools at ../supabase/functions/mcp/generated_crud.ts');
}

fetchSchema().catch(console.error);
