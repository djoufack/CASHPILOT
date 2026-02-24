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
const systemColumns = ['id', 'created_at', 'updated_at', 'deleted_at', 'user_id'];

function mapTypeToZod(prop: any): string {
    const t = prop.type;
    if (t === 'string') return 'z.string()';
    if (t === 'integer') return 'z.number().int()';
    if (t === 'number') return 'z.number()';
    if (t === 'boolean') return 'z.boolean()';
    if (t === 'array') return 'z.array(z.any())';
    if (t === 'object') return 'z.record(z.any())';
    return 'z.any()';
}

async function fetchSchema() {
    const res = await fetch(SUPABASE_URL + '/rest/v1/?apikey=' + SUPABASE_ANON_KEY);
    const json = await res.json();

    let out = "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';\n";
    out += "import { z } from 'zod';\n";
    out += "import { supabase, getUserId } from '../supabase.js';\n\n";
    out += "export function registerGeneratedCrudTools(server: McpServer) {\n";

    for (const [tableName, definition] of Object.entries((json.definitions || {}) as Record<string, any>)) {
        if (excludedTables.includes(tableName)) continue;
        if (definition.type !== 'object' || !definition.properties) continue;

        const properties = definition.properties;
        const requiredCols = definition.required || [];
        const columns = Object.keys(properties).filter(c => !systemColumns.includes(c));
        if (columns.length === 0) continue;

        const hasUserId = !!properties['user_id'];
        const hasId = !!properties['id'];

        // 1. CREATE
        out += "\n  server.tool(\n";
        out += "    'create_" + tableName + "',\n";
        out += "    'Create a new record in " + tableName + "',\n";
        out += "    {\n";
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const prop = properties[col];
            const isRequired = requiredCols.includes(col);
            const zType = mapTypeToZod(prop);
            let descCode = '';
            if (prop.description) {
                let cleanDesc = prop.description.replace(/'/g, "\\'");
                cleanDesc = cleanDesc.replace(/[\r\n]+/g, ' ');
                descCode = ".describe('" + cleanDesc + "')";
            }
            const opt = isRequired ? '' : '.optional()';
            out += "      " + col + ": " + zType + opt + descCode + (i < columns.length - 1 ? "," : "") + "\n";
        }
        out += "    },\n";
        out += "    async (args) => {\n";
        out += "      const payload = { ...args } as Record<string, any>;\n";
        if (hasUserId) out += "      payload.user_id = getUserId();\n";
        out += "      const { data, error } = await supabase.from('" + tableName + "').insert([payload]).select().single();\n";
        out += "      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into " + tableName + ": ' + error.message }] };\n";
        out += "      return { content: [{ type: 'text' as const, text: 'Successfully created " + tableName + " record:\\n' + JSON.stringify(data, null, 2) }] };\n";
        out += "    }\n";
        out += "  );\n";

        // Only generate UPDATE/DELETE/GET if the table has an 'id' primary key
        if (hasId) {
            // 2. UPDATE
            out += "\n  server.tool(\n";
            out += "    'update_" + tableName + "',\n";
            out += "    'Update an existing record in " + tableName + "',\n";
            out += "    {\n";
            out += "      id: z.string().describe('Record UUID to update'),\n";
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const prop = properties[col];
                const zType = mapTypeToZod(prop);
                let descCode = '';
                if (prop.description) {
                    let cleanDesc = prop.description.replace(/'/g, "\\'");
                    cleanDesc = cleanDesc.replace(/[\r\n]+/g, ' ');
                    descCode = ".describe('" + cleanDesc + "')";
                }
                out += "      " + col + ": " + zType + ".optional()" + descCode + (i < columns.length - 1 ? "," : "") + "\n";
            }
            out += "    },\n";
            out += "    async (args) => {\n";
            out += "      const { id, ...updates } = args;\n";
            out += "      let query = supabase.from('" + tableName + "').update(updates).eq('id', id);\n";
            if (hasUserId) out += "      query = query.eq('user_id', getUserId());\n";
            out += "      const { data, error } = await query.select().single();\n";
            out += "      if (error) return { content: [{ type: 'text' as const, text: 'Error updating " + tableName + ": ' + error.message }] };\n";
            out += "      return { content: [{ type: 'text' as const, text: 'Successfully updated " + tableName + " record:\\n' + JSON.stringify(data, null, 2) }] };\n";
            out += "    }\n";
            out += "  );\n";

            // 3. DELETE
            out += "\n  server.tool(\n";
            out += "    'delete_" + tableName + "',\n";
            out += "    'Delete a record from " + tableName + "',\n";
            out += "    {\n";
            out += "      id: z.string().describe('Record UUID to delete')\n";
            out += "    },\n";
            out += "    async ({ id }) => {\n";
            out += "      let query = supabase.from('" + tableName + "').delete().eq('id', id);\n";
            if (hasUserId) out += "      query = query.eq('user_id', getUserId());\n";
            out += "      const { error } = await query;\n";
            out += "      if (error) return { content: [{ type: 'text' as const, text: 'Error deleting from " + tableName + ": ' + error.message }] };\n";
            out += "      return { content: [{ type: 'text' as const, text: 'Successfully deleted record ' + id + ' from " + tableName + "' }] };\n";
            out += "    }\n";
            out += "  );\n";

            // 4. GET (Single)
            out += "\n  server.tool(\n";
            out += "    'get_" + tableName + "',\n";
            out += "    'Get a single record from " + tableName + " by ID',\n";
            out += "    {\n";
            out += "      id: z.string().describe('Record UUID to fetch')\n";
            out += "    },\n";
            out += "    async ({ id }) => {\n";
            out += "      let query = supabase.from('" + tableName + "').select('*').eq('id', id);\n";
            if (hasUserId) out += "      query = query.eq('user_id', getUserId());\n";
            out += "      const { data, error } = await query.single();\n";
            out += "      if (error) return { content: [{ type: 'text' as const, text: 'Error fetching from " + tableName + ": ' + error.message }] };\n";
            out += "      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };\n";
            out += "    }\n";
            out += "  );\n";
        }

        // 5. LIST
        out += "\n  server.tool(\n";
        out += "    'list_" + tableName + "',\n";
        out += "    'List multiple records from " + tableName + "',\n";
        out += "    {\n";
        out += "      limit: z.number().optional().describe('Maximum number of records to return (default 50)'),\n";
        out += "      offset: z.number().optional().describe('Number of records to skip (default 0)')\n";
        out += "    },\n";
        out += "    async ({ limit = 50, offset = 0 }) => {\n";
        out += "      let query = supabase.from('" + tableName + "').select('*');\n";
        if (hasUserId) out += "      query = query.eq('user_id', getUserId());\n";
        out += "      const { data, error } = await query.range(offset, offset + limit - 1).limit(limit);\n";
        out += "      if (error) return { content: [{ type: 'text' as const, text: 'Error listing " + tableName + ": ' + error.message }] };\n";
        out += "      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };\n";
        out += "    }\n";
        out += "  );\n";
    }

    out += "}\n";

    const outPath = path.join(process.cwd(), 'src', 'tools', 'generated_crud.ts');
    fs.writeFileSync(outPath, out);
    console.log('Successfully generated', outPath);
}

fetchSchema().catch(console.error);
