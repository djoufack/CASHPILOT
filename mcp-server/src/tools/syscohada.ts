import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { validateDate } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

const OHADA_COUNTRIES = [
  'CI',
  'CM',
  'SN',
  'GA',
  'CG',
  'BF',
  'ML',
  'NE',
  'TD',
  'BJ',
  'TG',
  'GW',
  'GQ',
  'CF',
  'KM',
] as const;

export function registerSycohadaTools(server: McpServer) {
  // ── 1. export_syscohada_liasse ─────────────────────────────────
  server.tool(
    'export_syscohada_liasse',
    'Export the complete SYSCOHADA financial package (liasse fiscale): balance sheet, income statement, and TAFIRE for a given period.',
    {
      company_id: z.string().uuid().describe('Company UUID'),
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)'),
    },
    async ({ company_id, start_date, end_date }) => {
      try {
        validateDate(start_date, 'start_date');
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: e.message }] };
      }
      try {
        validateDate(end_date, 'end_date');
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: e.message }] };
      }

      const userId = getUserId();

      // Call all 3 RPCs in parallel
      const [balanceRes, incomeRes, tafireRes] = await Promise.all([
        supabase.rpc('get_syscohada_balance_sheet', {
          p_company_id: company_id,
          p_date: end_date,
        }),
        supabase.rpc('get_syscohada_income_statement', {
          p_company_id: company_id,
          p_start: start_date,
          p_end: end_date,
        }),
        supabase.rpc('get_tafire', {
          p_company_id: company_id,
          p_start: start_date,
          p_end: end_date,
        }),
      ]);

      if (balanceRes.error)
        return { content: [{ type: 'text' as const, text: safeError(balanceRes.error, 'balance sheet') }] };
      if (incomeRes.error)
        return { content: [{ type: 'text' as const, text: safeError(incomeRes.error, 'income statement') }] };
      if (tafireRes.error) return { content: [{ type: 'text' as const, text: safeError(tafireRes.error, 'TAFIRE') }] };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                liasse_fiscale_syscohada: {
                  period: { start: start_date, end: end_date },
                  company_id,
                  bilan: balanceRes.data,
                  compte_de_resultat: incomeRes.data,
                  tafire: tafireRes.data,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── 2. get_syscohada_chart ─────────────────────────────────────
  server.tool(
    'get_syscohada_chart',
    'Get the SYSCOHADA chart of accounts (plan comptable) for a specific OHADA country.',
    {
      country_code: z.enum(OHADA_COUNTRIES).describe('OHADA country code (e.g. CI, CM, SN)'),
      account_class: z.number().int().min(1).max(9).optional().describe('Filter by account class (1-9)'),
    },
    async ({ country_code, account_class }) => {
      let query = supabase
        .from('syscohada_chart_templates')
        .select('account_code, account_name, account_class, account_type, parent_code, is_active')
        .eq('country_code', country_code)
        .eq('is_active', true)
        .order('account_code', { ascending: true });

      if (account_class) {
        query = query.eq('account_class', account_class);
      }

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get SYSCOHADA chart') }] };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                country_code,
                account_count: (data || []).length,
                accounts: data || [],
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── 3. validate_syscohada_entries ──────────────────────────────
  server.tool(
    'validate_syscohada_entries',
    'Validate one or more accounting entries against SYSCOHADA rules (account class, debit/credit direction, balance check).',
    {
      entry_ids: z.array(z.string().uuid()).describe('Array of accounting entry UUIDs to validate'),
    },
    async ({ entry_ids }) => {
      const results: Array<any> = [];

      for (const entryId of entry_ids) {
        const { data, error } = await supabase.rpc('validate_syscohada_entry', {
          p_entry_id: entryId,
        });

        if (error) {
          results.push({
            entry_id: entryId,
            valid: false,
            errors: [safeError(error, 'validate entry')],
          });
        } else {
          results.push(data);
        }
      }

      const allValid = results.every((r: any) => r.valid);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                total_entries: entry_ids.length,
                all_valid: allValid,
                valid_count: results.filter((r: any) => r.valid).length,
                invalid_count: results.filter((r: any) => !r.valid).length,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
