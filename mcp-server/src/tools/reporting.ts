import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';

export function registerReportingTools(server: McpServer) {

  // ── 1. get_profit_and_loss ────────────────────────────────
  server.tool(
    'get_profit_and_loss',
    'Generate a Profit & Loss statement (income statement) for a period. Groups revenue and expense accounts with subtotals.',
    {
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ start_date, end_date }) => {
      const userId = getUserId();

      const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select('account_code, debit, credit')
        .eq('user_id', userId)
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const { data: accounts } = await supabase
        .from('accounting_chart_of_accounts')
        .select('account_code, account_name, account_type, account_category')
        .eq('user_id', userId);

      const categoryMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      for (const acc of accounts ?? []) {
        categoryMap[acc.account_code] = acc.account_category || acc.account_type || 'other';
        nameMap[acc.account_code] = acc.account_name || '';
      }

      const accountTotals: Record<string, { code: string; name: string; category: string; debit: number; credit: number }> = {};
      for (const e of entries ?? []) {
        const code = e.account_code;
        if (!accountTotals[code]) {
          accountTotals[code] = {
            code,
            name: nameMap[code] || '',
            category: categoryMap[code] || (code.startsWith('7') ? 'revenue' : code.startsWith('6') ? 'expense' : 'other'),
            debit: 0,
            credit: 0
          };
        }
        accountTotals[code].debit += parseFloat(e.debit || '0');
        accountTotals[code].credit += parseFloat(e.credit || '0');
      }

      const allAccounts = Object.values(accountTotals);
      const revenueAccounts = allAccounts.filter(a => a.category === 'revenue');
      const expenseAccounts = allAccounts.filter(a => a.category === 'expense');

      const totalRevenue = revenueAccounts.reduce((s, a) => s + (a.credit - a.debit), 0);
      const totalExpenses = expenseAccounts.reduce((s, a) => s + (a.debit - a.credit), 0);
      const netResult = totalRevenue - totalExpenses;

      const round = (n: number) => Math.round(n * 100) / 100;
      const formatAccounts = (accs: typeof allAccounts) =>
        accs.map(a => ({ code: a.code, name: a.name, amount: round(a.category === 'revenue' ? a.credit - a.debit : a.debit - a.credit) }))
          .sort((a, b) => a.code.localeCompare(b.code));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          period: { start: start_date, end: end_date },
          revenue: { accounts: formatAccounts(revenueAccounts), total: round(totalRevenue) },
          expenses: { accounts: formatAccounts(expenseAccounts), total: round(totalExpenses) },
          net_result: round(netResult),
          profitable: netResult > 0
        }, null, 2) }]
      };
    }
  );

  // ── 2. get_balance_sheet ──────────────────────────────────
  server.tool(
    'get_balance_sheet',
    'Generate a Balance Sheet (bilan) at a given date. Shows assets, liabilities, and equity.',
    {
      date: z.string().optional().describe('Cut-off date (YYYY-MM-DD), default today')
    },
    async ({ date }) => {
      const cutoff = date ?? new Date().toISOString().split('T')[0];
      const userId = getUserId();

      const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select('account_code, debit, credit')
        .eq('user_id', userId)
        .lte('transaction_date', cutoff);

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const { data: accounts } = await supabase
        .from('accounting_chart_of_accounts')
        .select('account_code, account_name, account_type, account_category')
        .eq('user_id', userId);

      const categoryMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      for (const acc of accounts ?? []) {
        categoryMap[acc.account_code] = acc.account_category || acc.account_type || 'other';
        nameMap[acc.account_code] = acc.account_name || '';
      }

      const accountTotals: Record<string, { code: string; name: string; category: string; balance: number }> = {};
      for (const e of entries ?? []) {
        const code = e.account_code;
        if (!accountTotals[code]) {
          const fallback = code.startsWith('1') ? 'equity'
            : (code.startsWith('2') || code.startsWith('3') || code.startsWith('5')) ? 'asset'
            : code.startsWith('4') ? 'liability' : 'other';
          accountTotals[code] = {
            code,
            name: nameMap[code] || '',
            category: categoryMap[code] || fallback,
            balance: 0
          };
        }
        accountTotals[code].balance += parseFloat(e.debit || '0') - parseFloat(e.credit || '0');
      }

      const allAccounts = Object.values(accountTotals);
      const round = (n: number) => Math.round(n * 100) / 100;
      const format = (accs: typeof allAccounts) =>
        accs.map(a => ({ code: a.code, name: a.name, balance: round(Math.abs(a.balance)) }))
          .sort((a, b) => a.code.localeCompare(b.code));

      const assets = allAccounts.filter(a => a.category === 'asset');
      const liabilities = allAccounts.filter(a => a.category === 'liability');
      const equity = allAccounts.filter(a => a.category === 'equity');

      const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
      const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);
      const totalEquity = equity.reduce((s, a) => s + Math.abs(a.balance), 0);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          date: cutoff,
          assets: { accounts: format(assets), total: round(totalAssets) },
          liabilities: { accounts: format(liabilities), total: round(totalLiabilities) },
          equity: { accounts: format(equity), total: round(totalEquity) },
          balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
        }, null, 2) }]
      };
    }
  );

  // ── 3. get_aging_report ───────────────────────────────────
  server.tool(
    'get_aging_report',
    'Generate an aging report for receivables or payables. Shows amounts in 30/60/90/120+ day buckets.',
    {
      type: z.enum(['receivables', 'payables']).describe('Report type: receivables (client debts) or payables (supplier debts)'),
      as_of_date: z.string().optional().describe('Reference date (YYYY-MM-DD), default today')
    },
    async ({ type, as_of_date }) => {
      const asOf = as_of_date ?? new Date().toISOString().split('T')[0];
      const asOfMs = new Date(asOf).getTime();
      const userId = getUserId();

      if (type === 'receivables') {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_ttc, due_date, date, status, client:clients(company_name)')
          .eq('user_id', userId)
          .in('status', ['sent', 'overdue'])
          .in('payment_status', ['unpaid', 'partial']);

        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

        const buckets = { current: [] as any[], days_30: [] as any[], days_60: [] as any[], days_90: [] as any[], days_120_plus: [] as any[] };

        for (const inv of invoices ?? []) {
          const dueDate = inv.due_date || inv.date;
          const daysPast = Math.floor((asOfMs - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const item = {
            invoice_number: inv.invoice_number,
            client: (inv.client as any)?.company_name || 'N/A',
            amount: parseFloat(inv.total_ttc) || 0,
            due_date: dueDate,
            days_overdue: Math.max(0, daysPast)
          };

          if (daysPast <= 0) buckets.current.push(item);
          else if (daysPast <= 30) buckets.days_30.push(item);
          else if (daysPast <= 60) buckets.days_60.push(item);
          else if (daysPast <= 90) buckets.days_90.push(item);
          else buckets.days_120_plus.push(item);
        }

        const sum = (arr: any[]) => Math.round(arr.reduce((s: number, i: any) => s + i.amount, 0) * 100) / 100;

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            type: 'receivables',
            as_of: asOf,
            summary: {
              current: sum(buckets.current),
              '1_30_days': sum(buckets.days_30),
              '31_60_days': sum(buckets.days_60),
              '61_90_days': sum(buckets.days_90),
              '90_plus_days': sum(buckets.days_120_plus),
              total: sum([...buckets.current, ...buckets.days_30, ...buckets.days_60, ...buckets.days_90, ...buckets.days_120_plus])
            },
            details: buckets
          }, null, 2) }]
        };
      } else {
        const { data: payables, error } = await supabase
          .from('payables')
          .select('id, creditor_name, amount, amount_paid, due_date, date_borrowed, status')
          .eq('user_id', userId)
          .in('status', ['pending', 'partial', 'overdue']);

        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

        const buckets = { current: [] as any[], days_30: [] as any[], days_60: [] as any[], days_90: [] as any[], days_120_plus: [] as any[] };

        for (const p of payables ?? []) {
          const dueDate = p.due_date || p.date_borrowed;
          const daysPast = Math.floor((asOfMs - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const remaining = (parseFloat(p.amount) || 0) - (parseFloat(p.amount_paid) || 0);
          const item = {
            creditor: p.creditor_name,
            amount_due: Math.round(remaining * 100) / 100,
            due_date: dueDate,
            days_overdue: Math.max(0, daysPast)
          };

          if (daysPast <= 0) buckets.current.push(item);
          else if (daysPast <= 30) buckets.days_30.push(item);
          else if (daysPast <= 60) buckets.days_60.push(item);
          else if (daysPast <= 90) buckets.days_90.push(item);
          else buckets.days_120_plus.push(item);
        }

        const sum = (arr: any[]) => Math.round(arr.reduce((s: number, i: any) => s + i.amount_due, 0) * 100) / 100;

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            type: 'payables',
            as_of: asOf,
            summary: {
              current: sum(buckets.current),
              '1_30_days': sum(buckets.days_30),
              '31_60_days': sum(buckets.days_60),
              '61_90_days': sum(buckets.days_90),
              '90_plus_days': sum(buckets.days_120_plus),
              total: sum([...buckets.current, ...buckets.days_30, ...buckets.days_60, ...buckets.days_90, ...buckets.days_120_plus])
            },
            details: buckets
          }, null, 2) }]
        };
      }
    }
  );
}
