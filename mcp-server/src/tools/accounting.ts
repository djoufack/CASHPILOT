import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';

export function registerAccountingTools(server: McpServer) {

  server.tool(
    'get_chart_of_accounts',
    'Get the chart of accounts, optionally filtered by category',
    {
      category: z.string().optional().describe('Filter by category: asset, liability, equity, revenue, expense')
    },
    async ({ category }) => {
      let query = supabase
        .from('accounting_chart_of_accounts')
        .select('*')
        .eq('user_id', getUserId())
        .order('account_code', { ascending: true });

      if (category) query = query.eq('account_category', category);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: `${data?.length ?? 0} accounts.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'get_accounting_entries',
    'Get accounting journal entries with optional filters',
    {
      start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
      account_code: z.string().optional().describe('Filter by account code'),
      limit: z.number().optional().describe('Max results (default 100)')
    },
    async ({ start_date, end_date, account_code, limit }) => {
      let query = supabase
        .from('accounting_entries')
        .select('*')
        .eq('user_id', getUserId())
        .order('transaction_date', { ascending: false })
        .limit(limit ?? 100);

      if (start_date) query = query.gte('transaction_date', start_date);
      if (end_date) query = query.lte('transaction_date', end_date);
      if (account_code) query = query.eq('account_code', account_code);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: `${data?.length ?? 0} entries.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  server.tool(
    'get_trial_balance',
    'Get trial balance: sum of debits and credits per account',
    {
      date: z.string().optional().describe('Cut-off date (YYYY-MM-DD), default today')
    },
    async ({ date }) => {
      const cutoff = date ?? new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('accounting_entries')
        .select('account_code, account_name, debit, credit')
        .eq('user_id', getUserId())
        .lte('transaction_date', cutoff);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const balances: Record<string, { account_code: string; account_name: string; total_debit: number; total_credit: number; balance: number }> = {};

      for (const entry of data ?? []) {
        const code = entry.account_code;
        if (!balances[code]) {
          balances[code] = { account_code: code, account_name: entry.account_name || '', total_debit: 0, total_credit: 0, balance: 0 };
        }
        balances[code].total_debit += parseFloat(entry.debit || '0');
        balances[code].total_credit += parseFloat(entry.credit || '0');
      }

      const result = Object.values(balances)
        .map(b => ({ ...b, balance: Math.round((b.total_debit - b.total_credit) * 100) / 100, total_debit: Math.round(b.total_debit * 100) / 100, total_credit: Math.round(b.total_credit * 100) / 100 }))
        .sort((a, b) => a.account_code.localeCompare(b.account_code));

      const totalDebit = result.reduce((s, b) => s + b.total_debit, 0);
      const totalCredit = result.reduce((s, b) => s + b.total_credit, 0);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ accounts: result, total_debit: Math.round(totalDebit * 100) / 100, total_credit: Math.round(totalCredit * 100) / 100, balanced: Math.abs(totalDebit - totalCredit) < 0.01 }, null, 2) }]
      };
    }
  );

  server.tool(
    'get_tax_summary',
    'Get VAT/tax summary for a period: output VAT vs input VAT',
    {
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ start_date, end_date }) => {
      const [invoicesRes, expensesRes, taxRatesRes] = await Promise.all([
        supabase.from('invoices').select('total_ht, total_ttc, tax_rate, date')
          .eq('user_id', getUserId()).gte('date', start_date).lte('date', end_date),
        supabase.from('expenses').select('amount, date, category')
          .eq('user_id', getUserId()).gte('date', start_date).lte('date', end_date),
        supabase.from('accounting_tax_rates').select('*').eq('user_id', getUserId())
      ]);

      const outputVat = (invoicesRes.data ?? []).reduce((s, i) => s + (parseFloat(i.total_ttc || '0') - parseFloat(i.total_ht || '0')), 0);
      const totalRevenue = (invoicesRes.data ?? []).reduce((s, i) => s + parseFloat(i.total_ht || '0'), 0);
      const totalExpenses = (expensesRes.data ?? []).reduce((s, e) => s + parseFloat(e.amount || '0'), 0);
      // Estimate input VAT (simplified: assume 20% average on expenses)
      const defaultRate = taxRatesRes.data?.find(t => t.is_default)?.rate ?? 20;
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
        tax_rates: taxRatesRes.data ?? []
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }]
      };
    }
  );

  server.tool(
    'init_accounting',
    'Initialize accounting chart of accounts for a country (FR, BE, or OHADA)',
    {
      country: z.string().describe('Country code: FR (France), BE (Belgium), OHADA (West Africa)')
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
          content: [{ type: 'text' as const, text: `Accounting already initialized for country: ${settings.country}. To reinitialize, reset the settings first.` }]
        };
      }

      // Create or update settings
      await supabase
        .from('user_accounting_settings')
        .upsert({ user_id: getUserId(), country: country.toUpperCase(), is_initialized: true }, { onConflict: 'user_id' });

      return {
        content: [{ type: 'text' as const, text: `Accounting initialized for ${country.toUpperCase()}. Note: Chart of accounts should be loaded via the CashPilot UI for full initialization with default accounts, mappings, and tax rates.` }]
      };
    }
  );
}
