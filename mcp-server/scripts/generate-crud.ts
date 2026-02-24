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

            out += "      " + col + ": " + zType + opt + descCode;
            if (i < columns.length - 1) out += ",";
            out += "\n";
        }

        out += "    },\n";
        out += "    async (args) => {\n";
        out += "      const payload = { ...args } as Record<string, any>;\n";

        if (hasUserId) {
            out += "      payload.user_id = getUserId();\n";
        }

        out += "      const { data, error } = await supabase\n";
        out += "        .from('" + tableName + "')\n";
        out += "        .insert([payload])\n";
        out += "        .select()\n";
        out += "        .single();\n";
        out += "\n      if (error) return { content: [{ type: 'text' as const, text: 'Error inserting into " + tableName + ": ' + error.message }] };\n";
        out += "      return { content: [{ type: 'text' as const, text: 'Successfully created " + tableName + " record:\\n' + JSON.stringify(data, null, 2) }] };\n";
        out += "    }\n";
        out += "  );\n";
    }

    out += "}\n";

    const outPath = path.join(process.cwd(), 'src', 'tools', 'generated_crud.ts');
    fs.writeFileSync(outPath, out);
    console.log('Successfully generated', outPath);
}

fetchSchema().catch(console.error);
