import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase, getUserId, getCompanyId } from '../supabase.js';
import { safeError } from '../utils/errors.js';
import { validateDate, optionalDate } from '../utils/validation.js';
import { getCached, setCache, invalidateCache } from '../utils/cache.js';

const COLS_ACCOUNTING_ENTRIES =
  'id, transaction_date, account_code, description, debit, credit, entry_ref, journal, source_type, source_id, reference_type, reference_id, is_auto, created_at';

export function registerAccountingTools(server: McpServer) {
  server.tool(
    'get_chart_of_accounts',
    'Get the chart of accounts, optionally filtered by category',
    {
      category: z.string().optional().describe('Filter by category: asset, liability, equity, revenue, expense'),
    },
    async ({ category }) => {
      const cacheKey = `coa:${getUserId()}` + (category ? `:${category}` : '');
      const cached = getCached<any>(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('accounting_chart_of_accounts')
        .select('*')
        .eq('user_id', getUserId())
        .order('account_code', { ascending: true });

      if (category) {
        const safeCategory = category.replace(/[|,().]/g, '\\$&');
        query = query.or(`account_category.eq.${safeCategory},account_type.eq.${safeCategory}`);
      }

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get chart of accounts') }] };

      const result = {
        content: [{ type: 'text' as const, text: `${data?.length ?? 0} accounts.\n${JSON.stringify(data, null, 2)}` }],
      };
      setCache(cacheKey, result, 60_000);
      return result;
    }
  );

  server.tool(
    'get_accounting_entries',
    'Get accounting journal entries with optional filters',
    {
      start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
      account_code: z.string().optional().describe('Filter by account code'),
      limit: z.number().optional().describe('Max results (default 100)'),
    },
    async ({ start_date, end_date, account_code, limit }) => {
      const validStart = optionalDate(start_date);
      const validEnd = optionalDate(end_date);
      if (start_date && !validStart)
        return {
          content: [{ type: 'text' as const, text: "Parameter 'start_date' must be a valid date (YYYY-MM-DD)" }],
        };
      if (end_date && !validEnd)
        return { content: [{ type: 'text' as const, text: "Parameter 'end_date' must be a valid date (YYYY-MM-DD)" }] };

      let query = supabase
        .from('accounting_entries')
        .select(COLS_ACCOUNTING_ENTRIES)
        .eq('user_id', getUserId())
        .order('transaction_date', { ascending: false })
        .limit(limit ?? 100);

      if (validStart) query = query.gte('transaction_date', validStart);
      if (validEnd) query = query.lte('transaction_date', validEnd);
      if (account_code) query = query.eq('account_code', account_code);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get accounting entries') }] };

      return {
        content: [{ type: 'text' as const, text: `${data?.length ?? 0} entries.\n${JSON.stringify(data, null, 2)}` }],
      };
    }
  );

  server.tool(
    'get_trial_balance',
    'Get trial balance: sum of debits and credits per account',
    {
      date: z.string().optional().describe('Cut-off date (YYYY-MM-DD), default today'),
    },
    async ({ date }) => {
      const validDate = optionalDate(date);
      if (date && !validDate)
        return { content: [{ type: 'text' as const, text: "Parameter 'date' must be a valid date (YYYY-MM-DD)" }] };
      const cutoff = validDate ?? new Date().toISOString().split('T')[0];

      const [entriesRes, accountsRes] = await Promise.all([
        supabase
          .from('accounting_entries')
          .select('account_code, debit, credit')
          .eq('user_id', getUserId())
          .lte('transaction_date', cutoff),
        supabase.from('accounting_chart_of_accounts').select('account_code, account_name').eq('user_id', getUserId()),
      ]);

      const { data, error } = entriesRes;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get trial balance') }] };

      const nameMap: Record<string, string> = {};
      for (const acc of accountsRes.data ?? []) {
        nameMap[acc.account_code] = acc.account_name || '';
      }

      const balances: Record<
        string,
        { account_code: string; account_name: string; total_debit: number; total_credit: number; balance: number }
      > = {};

      for (const entry of data ?? []) {
        const code = entry.account_code;
        if (!balances[code]) {
          balances[code] = {
            account_code: code,
            account_name: nameMap[code] || '',
            total_debit: 0,
            total_credit: 0,
            balance: 0,
          };
        }
        balances[code].total_debit += parseFloat(entry.debit || '0');
        balances[code].total_credit += parseFloat(entry.credit || '0');
      }

      const result = Object.values(balances)
        .map((b) => ({
          ...b,
          balance: Math.round((b.total_debit - b.total_credit) * 100) / 100,
          total_debit: Math.round(b.total_debit * 100) / 100,
          total_credit: Math.round(b.total_credit * 100) / 100,
        }))
        .sort((a, b) => a.account_code.localeCompare(b.account_code));

      const totalDebit = result.reduce((s, b) => s + b.total_debit, 0);
      const totalCredit = result.reduce((s, b) => s + b.total_credit, 0);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                accounts: result,
                total_debit: Math.round(totalDebit * 100) / 100,
                total_credit: Math.round(totalCredit * 100) / 100,
                balanced: Math.abs(totalDebit - totalCredit) < 0.01,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'get_tax_summary',
    'Get VAT/tax summary for a period: output VAT vs input VAT',
    {
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)'),
    },
    async ({ start_date, end_date }) => {
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

      const [invoicesRes, expensesRes, taxRatesRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_ht, total_ttc, tax_rate, date')
          .eq('user_id', getUserId())
          .gte('date', start_date)
          .lte('date', end_date),
        supabase
          .from('expenses')
          .select('amount, date, category')
          .eq('user_id', getUserId())
          .gte('date', start_date)
          .lte('date', end_date),
        supabase.from('accounting_tax_rates').select('*').eq('user_id', getUserId()),
      ]);

      const outputVat = (invoicesRes.data ?? []).reduce(
        (s, i) => s + (parseFloat(i.total_ttc || '0') - parseFloat(i.total_ht || '0')),
        0
      );
      const totalRevenue = (invoicesRes.data ?? []).reduce((s, i) => s + parseFloat(i.total_ht || '0'), 0);
      const totalExpenses = (expensesRes.data ?? []).reduce((s, e) => s + parseFloat(e.amount || '0'), 0);
      // Estimate input VAT (simplified: assume 20% average on expenses)
      const defaultRate = taxRatesRes.data?.find((t) => t.is_default)?.rate ?? 20;
      const estimatedInputVat = totalExpenses * (defaultRate / (100 + defaultRate));

      const summary = {
        period: { start: start_date, end: end_date },
        revenue_ht: Math.round(totalRevenue * 100) / 100,
        output_vat: Math.round(outputVat * 100) / 100,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        estimated_input_vat: Math.round(estimatedInputVat * 100) / 100,
        vat_payable: Math.round((outputVat - estimatedInputVat) * 100) / 100,
        invoice_count: invoicesRes.data?.length ?? 0,
        expense_count: expensesRes.data?.length ?? 0,
        tax_rates: taxRatesRes.data ?? [],
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.tool(
    'init_accounting',
    'Initialize accounting chart of accounts for a country (FR, BE, or OHADA)',
    {
      country: z.string().describe('Country code: FR (France), BE (Belgium), OHADA (West Africa)'),
    },
    async ({ country }) => {
      // Check if already initialized
      const { data: settings } = await supabase
        .from('user_accounting_settings')
        .select('*')
        .eq('user_id', getUserId())
        .single();

      if (settings?.is_initialized) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Accounting already initialized for country: ${settings.country}. To reinitialize, reset the settings first.`,
            },
          ],
        };
      }

      // Create or update settings
      await supabase
        .from('user_accounting_settings')
        .upsert(
          { user_id: getUserId(), country: country.toUpperCase(), is_initialized: true },
          { onConflict: 'user_id' }
        );

      // Auto-copy chart of accounts from SYSCOHADA template if available
      const countryUpper = country.toUpperCase();
      let copiedCount = 0;
      const companyId = await getCompanyId();

      // Map country names/codes to SYSCOHADA country_code
      const ohadaMap: Record<string, string> = {
        OHADA: 'CM',
        CM: 'CM',
        CI: 'CI',
        SN: 'SN',
        GA: 'GA',
        CG: 'CG',
        BF: 'BF',
        ML: 'ML',
        NE: 'NE',
        TD: 'TD',
        BJ: 'BJ',
        TG: 'TG',
        GW: 'GW',
        GQ: 'GQ',
        CF: 'CF',
        KM: 'KM',
      };
      const syscohadaCode = ohadaMap[countryUpper];

      // Load PCG/PCMN from local JSON files for FR/BE
      const pcgFileMap: Record<string, string> = { FR: 'pcg-france.json', BE: 'pcg-belge.json' };
      const pcgFile = pcgFileMap[countryUpper];
      if (pcgFile && copiedCount === 0) {
        try {
          // Resolve path relative to project root (mcp-server runs from project root via tsx)
          const projectRoot = process.cwd();
          const filePath = join(projectRoot, 'src', 'data', pcgFile);
          const raw = readFileSync(filePath, 'utf-8');
          const accounts: any[] = JSON.parse(raw);
          if (accounts.length > 0) {
            const rows = accounts.map((a: any) => ({
              user_id: getUserId(),
              company_id: companyId,
              account_code: a.account_code,
              account_name: a.account_name,
              account_type: a.account_type || 'other',
              account_category: a.account_category || 'other',
              parent_code: a.parent_code || null,
              is_active: true,
            }));
            const { error: insertErr } = await supabase
              .from('accounting_chart_of_accounts')
              .upsert(rows, { onConflict: 'company_id,account_code', ignoreDuplicates: true });
            if (!insertErr) copiedCount = rows.length;
          }
        } catch (e: any) {
          console.error(`[init_accounting] Failed to load ${pcgFile}:`, e?.message);
        }
      }

      if (syscohadaCode) {
        const { data: templates } = await supabase
          .from('syscohada_chart_templates')
          .select('account_code, account_name, account_type, account_class, parent_code, is_active')
          .eq('country_code', syscohadaCode);

        if (templates && templates.length > 0) {
          const rows = templates.map((t: any) => ({
            user_id: getUserId(),
            company_id: companyId,
            account_code: t.account_code,
            account_name: t.account_name,
            account_type: t.account_type,
            account_category:
              t.account_class <= 1
                ? 'equity'
                : t.account_class === 2
                  ? 'fixed_assets'
                  : t.account_class === 3
                    ? 'inventory'
                    : t.account_class === 4
                      ? 'receivables_payables'
                      : t.account_class === 5
                        ? 'cash'
                        : t.account_class === 6
                          ? 'expense'
                          : t.account_class === 7
                            ? 'revenue'
                            : 'special',
            parent_code: t.parent_code,
            is_active: t.is_active,
          }));
          const { error: insertErr } = await supabase
            .from('accounting_chart_of_accounts')
            .upsert(rows, { onConflict: 'company_id,account_code', ignoreDuplicates: true });
          if (!insertErr) copiedCount = rows.length;
        }
      }

      // Also create default accounting mappings if none exist
      const { data: existingMappings } = await supabase
        .from('accounting_mappings')
        .select('id')
        .eq('user_id', getUserId())
        .limit(1);

      let mappingsCount = 0;
      if (!existingMappings || existingMappings.length === 0) {
        const defaultMappings = [
          { source_type: 'invoice', source_category: 'product', debit_account_code: '411', credit_account_code: '701' },
          { source_type: 'invoice', source_category: 'service', debit_account_code: '411', credit_account_code: '706' },
          { source_type: 'invoice', source_category: 'mixed', debit_account_code: '411', credit_account_code: '701' },
          {
            source_type: 'payment',
            source_category: 'bank_transfer',
            debit_account_code: '521',
            credit_account_code: '411',
          },
          { source_type: 'payment', source_category: 'check', debit_account_code: '513', credit_account_code: '411' },
          { source_type: 'payment', source_category: 'cash', debit_account_code: '571', credit_account_code: '411' },
          {
            source_type: 'payment',
            source_category: 'mobile_money',
            debit_account_code: '521',
            credit_account_code: '411',
          },
          { source_type: 'payment', source_category: 'card', debit_account_code: '521', credit_account_code: '411' },
          { source_type: 'expense', source_category: 'rent', debit_account_code: '6222', credit_account_code: '521' },
          {
            source_type: 'expense',
            source_category: 'utilities',
            debit_account_code: '6051',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'equipment',
            debit_account_code: '241',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'professional_services',
            debit_account_code: '632',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'software',
            debit_account_code: '634',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'office_supplies',
            debit_account_code: '6055',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'insurance',
            debit_account_code: '625',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'transport',
            debit_account_code: '618',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'marketing',
            debit_account_code: '627',
            credit_account_code: '521',
          },
          {
            source_type: 'expense',
            source_category: 'bank_fees',
            debit_account_code: '631',
            credit_account_code: '521',
          },
          { source_type: 'expense', source_category: 'general', debit_account_code: '65', credit_account_code: '521' },
          {
            source_type: 'supplier_invoice',
            source_category: 'service',
            debit_account_code: '604',
            credit_account_code: '401',
          },
          {
            source_type: 'supplier_invoice',
            source_category: 'product',
            debit_account_code: '601',
            credit_account_code: '401',
          },
          {
            source_type: 'credit_note',
            source_category: 'general',
            debit_account_code: '701',
            credit_account_code: '411',
          },
        ].map((m) => ({
          ...m,
          user_id: getUserId(),
          mapping_name: `${m.source_type}:${m.source_category}`,
          is_active: true,
        }));

        const { error: mapErr } = await supabase.from('accounting_mappings').insert(defaultMappings);
        if (!mapErr) mappingsCount = defaultMappings.length;
      }

      invalidateCache('coa:');

      return {
        content: [
          {
            type: 'text' as const,
            text: `Accounting initialized for ${countryUpper}. ${copiedCount > 0 ? `${copiedCount} accounts copied from SYSCOHADA template.` : 'No template found for this country — load chart of accounts manually.'} ${mappingsCount > 0 ? `${mappingsCount} default accounting mappings created.` : ''}`,
          },
        ],
      };
    }
  );

  server.tool(
    'run_accounting_audit',
    'Run a comprehensive accounting audit. Returns score, grade, and detailed check results for balance/coherence, fiscal compliance, and anomaly detection.',
    {
      period_start: z.string().describe('Start date (YYYY-MM-DD)'),
      period_end: z.string().describe('End date (YYYY-MM-DD)'),
      categories: z
        .array(z.string())
        .optional()
        .describe('Categories to audit: balance, fiscal, anomalies (default: all)'),
    },
    async ({ period_start, period_end, categories }) => {
      try {
        validateDate(period_start, 'period_start');
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: e.message }] };
      }
      try {
        validateDate(period_end, 'period_end');
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: e.message }] };
      }

      try {
        const { getAccessToken, getSupabaseUrl } = await import('../supabase.js');
        const token = getAccessToken();
        const url = getSupabaseUrl();

        const response = await fetch(`${url}/functions/v1/audit-comptable`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ period_start, period_end, categories }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          return {
            content: [
              { type: 'text' as const, text: safeError(err.error || response.statusText, 'run accounting audit') },
            ],
          };
        }

        const result = await response.json();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: safeError(err, 'run accounting audit') }] };
      }
    }
  );
}
