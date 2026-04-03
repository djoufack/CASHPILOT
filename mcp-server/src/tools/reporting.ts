import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { validateDate, optionalDate } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

export function registerReportingTools(server: McpServer) {
  // ── 1. get_profit_and_loss ────────────────────────────────
  server.tool(
    'get_profit_and_loss',
    'Generate a Profit & Loss statement (income statement) for a period. Groups revenue and expense accounts with subtotals.',
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

      const userId = getUserId();

      // Call the DB RPC instead of manual aggregation
      const { data, error } = await supabase.rpc('f_income_statement', {
        p_user_id: userId,
        p_start_date: start_date,
        p_end_date: end_date,
      });

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get profit and loss') }] };

      const result = data as {
        revenueItems: { account_code: string; account_name: string; amount: number }[];
        expenseItems: { account_code: string; account_name: string; amount: number }[];
        totalRevenue: number;
        totalExpenses: number;
        netIncome: number;
      };

      const round = (n: number) => Math.round(n * 100) / 100;

      // Transform RPC response to match existing MCP response format
      const formatItems = (items: { account_code: string; account_name: string; amount: number }[]) =>
        (items ?? [])
          .map((i) => ({ code: i.account_code, name: i.account_name, amount: round(i.amount) }))
          .sort((a, b) => a.code.localeCompare(b.code));

      const totalRevenue = round(result.totalRevenue ?? 0);
      const totalExpenses = round(result.totalExpenses ?? 0);
      const netResult = round(result.netIncome ?? 0);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                period: { start: start_date, end: end_date },
                revenue: { accounts: formatItems(result.revenueItems), total: totalRevenue },
                expenses: { accounts: formatItems(result.expenseItems), total: totalExpenses },
                net_result: netResult,
                profitable: netResult > 0,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── 2. get_balance_sheet ──────────────────────────────────
  server.tool(
    'get_balance_sheet',
    'Generate a Balance Sheet (bilan) at a given date. Shows assets, liabilities, and equity.',
    {
      date: z.string().optional().describe('Cut-off date (YYYY-MM-DD), default today'),
    },
    async ({ date }) => {
      const validDate = optionalDate(date);
      if (date && !validDate)
        return { content: [{ type: 'text' as const, text: "Parameter 'date' must be a valid date (YYYY-MM-DD)" }] };
      const cutoff = validDate ?? new Date().toISOString().split('T')[0];
      const userId = getUserId();

      // Call the DB RPC instead of manual aggregation
      const { data, error } = await supabase.rpc('f_balance_sheet', {
        p_user_id: userId,
        p_end_date: cutoff,
      });

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get balance sheet') }] };

      const result = data as {
        assets: { account_code: string; account_name: string; balance: number }[];
        liabilities: { account_code: string; account_name: string; balance: number }[];
        equity: { account_code: string; account_name: string; balance: number }[];
        totalAssets: number;
        totalLiabilities: number;
        totalEquity: number;
        netIncome: number;
        balanced: boolean;
        syscohadaActif?: any;
        syscohadaPassif?: any;
      };

      const round = (n: number) => Math.round(n * 100) / 100;

      // ── Reclassify accounts with contra-normal balances ──
      // f_trial_balance uses credit-positive convention for liability/equity
      // (balance = credit - debit) and debit-positive for assets (balance = debit - credit).
      // Asset accounts (normally debit-positive) with negative balance → reclassify to liabilities.
      // Liability/equity accounts (normally credit-positive) with negative balance → reclassify to assets.
      const rawAssets = result.assets ?? [];
      const rawLiabilities = result.liabilities ?? [];
      const rawEquity = result.equity ?? [];

      // Assets with negative balance (credit > debit) → move to liabilities as reclassified
      const normalAssets = rawAssets.filter((a) => a.balance >= 0);
      const reclassifiedToLiabilities = rawAssets
        .filter((a) => a.balance < 0)
        .map((a) => ({
          account_code: a.account_code,
          account_name: `${a.account_name} (solde créditeur reclassé)`,
          balance: Math.abs(a.balance),
        }));

      // Liabilities: positive balance = credit > debit = NORMAL (credit-positive convention)
      // Negative balance = debit > credit = abnormal → reclassify to assets
      const normalLiabilities = rawLiabilities.filter((a) => a.balance >= 0);
      const reclassifiedToAssets = rawLiabilities
        .filter((a) => a.balance < 0)
        .map((a) => ({
          account_code: a.account_code,
          account_name: `${a.account_name} (solde débiteur reclassé)`,
          balance: Math.abs(a.balance),
        }));

      // Equity: positive balance = credit > debit = NORMAL (credit-positive convention)
      // Negative balance = debit > credit = abnormal → reclassify to assets
      const normalEquity = rawEquity.filter((a) => a.balance >= 0);
      const reclassifiedEquityToAssets = rawEquity
        .filter((a) => a.balance < 0)
        .map((a) => ({
          account_code: a.account_code,
          account_name: `${a.account_name} (solde débiteur reclassé)`,
          balance: Math.abs(a.balance),
        }));

      // Build final lists
      const finalAssets = [...normalAssets, ...reclassifiedToAssets, ...reclassifiedEquityToAssets];
      const finalLiabilities = [
        ...normalLiabilities.map((a) => ({ ...a, balance: a.balance })),
        ...reclassifiedToLiabilities,
      ];
      const finalEquity = normalEquity.map((a) => ({ ...a, balance: a.balance }));

      const formatItems = (items: { account_code: string; account_name: string; balance: number }[]) =>
        items
          .map((i) => ({ code: i.account_code, name: i.account_name, balance: round(i.balance) }))
          .sort((a, b) => a.code.localeCompare(b.code));

      const totalAssets = round(finalAssets.reduce((s, a) => s + a.balance, 0));
      const totalLiabilities = round(finalLiabilities.reduce((s, a) => s + a.balance, 0));
      const totalEquity = round(finalEquity.reduce((s, a) => s + a.balance, 0));
      const netResult = round(result.netIncome ?? 0);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                date: cutoff,
                assets: { accounts: formatItems(finalAssets), total: totalAssets },
                liabilities: { accounts: formatItems(finalLiabilities), total: totalLiabilities },
                equity: { accounts: formatItems(finalEquity), total: totalEquity },
                net_result: netResult,
                balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netResult)) < 0.01,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── 3. get_aging_report ───────────────────────────────────
  server.tool(
    'get_aging_report',
    'Generate an aging report for receivables or payables. Shows amounts in 30/60/90/120+ day buckets.',
    {
      type: z
        .enum(['receivables', 'payables'])
        .describe('Report type: receivables (client debts) or payables (supplier debts)'),
      as_of_date: z.string().optional().describe('Reference date (YYYY-MM-DD), default today'),
    },
    async ({ type, as_of_date }) => {
      const validAsOf = optionalDate(as_of_date);
      if (as_of_date && !validAsOf)
        return {
          content: [{ type: 'text' as const, text: "Parameter 'as_of_date' must be a valid date (YYYY-MM-DD)" }],
        };
      const asOf = validAsOf ?? new Date().toISOString().split('T')[0];
      const asOfMs = new Date(asOf).getTime();
      const userId = getUserId();

      if (type === 'receivables') {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_ttc, due_date, date, status, client:clients(company_name)')
          .eq('user_id', userId)
          .in('status', ['sent', 'overdue'])
          .in('payment_status', ['unpaid', 'partial']);

        if (error)
          return { content: [{ type: 'text' as const, text: safeError(error, 'get aging report - receivables') }] };

        const buckets = {
          current: [] as any[],
          days_30: [] as any[],
          days_60: [] as any[],
          days_90: [] as any[],
          days_120_plus: [] as any[],
        };

        for (const inv of invoices ?? []) {
          const dueDate = inv.due_date || inv.date;
          const daysPast = Math.floor((asOfMs - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const item = {
            invoice_number: inv.invoice_number,
            client: (inv.client as any)?.company_name || 'N/A',
            amount: parseFloat(inv.total_ttc) || 0,
            due_date: dueDate,
            days_overdue: Math.max(0, daysPast),
          };

          if (daysPast <= 0) buckets.current.push(item);
          else if (daysPast <= 30) buckets.days_30.push(item);
          else if (daysPast <= 60) buckets.days_60.push(item);
          else if (daysPast <= 90) buckets.days_90.push(item);
          else buckets.days_120_plus.push(item);
        }

        const sum = (arr: any[]) => Math.round(arr.reduce((s: number, i: any) => s + i.amount, 0) * 100) / 100;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  type: 'receivables',
                  as_of: asOf,
                  summary: {
                    current: sum(buckets.current),
                    '1_30_days': sum(buckets.days_30),
                    '31_60_days': sum(buckets.days_60),
                    '61_90_days': sum(buckets.days_90),
                    '90_plus_days': sum(buckets.days_120_plus),
                    total: sum([
                      ...buckets.current,
                      ...buckets.days_30,
                      ...buckets.days_60,
                      ...buckets.days_90,
                      ...buckets.days_120_plus,
                    ]),
                  },
                  details: buckets,
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        const { data: payables, error } = await supabase
          .from('payables')
          .select('id, creditor_name, amount, amount_paid, due_date, date_borrowed, status')
          .eq('user_id', userId)
          .in('status', ['pending', 'partial', 'overdue']);

        if (error)
          return { content: [{ type: 'text' as const, text: safeError(error, 'get aging report - payables') }] };

        const buckets = {
          current: [] as any[],
          days_30: [] as any[],
          days_60: [] as any[],
          days_90: [] as any[],
          days_120_plus: [] as any[],
        };

        for (const p of payables ?? []) {
          const dueDate = p.due_date || p.date_borrowed;
          const daysPast = Math.floor((asOfMs - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const remaining = (parseFloat(p.amount) || 0) - (parseFloat(p.amount_paid) || 0);
          const item = {
            creditor: p.creditor_name,
            amount_due: Math.round(remaining * 100) / 100,
            due_date: dueDate,
            days_overdue: Math.max(0, daysPast),
          };

          if (daysPast <= 0) buckets.current.push(item);
          else if (daysPast <= 30) buckets.days_30.push(item);
          else if (daysPast <= 60) buckets.days_60.push(item);
          else if (daysPast <= 90) buckets.days_90.push(item);
          else buckets.days_120_plus.push(item);
        }

        const sum = (arr: any[]) => Math.round(arr.reduce((s: number, i: any) => s + i.amount_due, 0) * 100) / 100;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  type: 'payables',
                  as_of: asOf,
                  summary: {
                    current: sum(buckets.current),
                    '1_30_days': sum(buckets.days_30),
                    '31_60_days': sum(buckets.days_60),
                    '61_90_days': sum(buckets.days_90),
                    '90_plus_days': sum(buckets.days_120_plus),
                    total: sum([
                      ...buckets.current,
                      ...buckets.days_30,
                      ...buckets.days_60,
                      ...buckets.days_90,
                      ...buckets.days_120_plus,
                    ]),
                  },
                  details: buckets,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );
}
