import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { safeError } from '../utils/errors.js';

/**
 * Company-level financial tools.
 *
 * These tools return data scoped to a specific COMPANY (société)
 * owned by the user — NOT to a client (external customer).
 *
 * A user may own multiple companies (1 main + N portfolio).
 * Each company has its own invoices, expenses, suppliers, etc.
 */
export function registerCompanyFinanceTools(server: McpServer) {

  // ── 1. list_user_companies ──────────────────────────────────
  server.tool(
    'list_user_companies',
    'List all companies (sociétés) owned by the current user. Returns company_id, name, country, currency. Use these IDs to scope other company-finance tools.',
    {},
    async () => {
      const userId = getUserId();
      const { data, error } = await supabase
        .from('company')
        .select('id, company_name, company_type, country, currency, created_at')
        .eq('user_id', userId)
        .order('created_at');

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list user companies') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          count: data?.length ?? 0,
          companies: (data ?? []).map(c => ({
            company_id: c.id,
            name: c.company_name,
            type: c.company_type,
            country: c.country,
            currency: c.currency,
          }))
        }, null, 2) }]
      };
    }
  );

  // ── 2. get_company_kpis ─────────────────────────────────────
  server.tool(
    'get_company_kpis',
    'Get KPIs for a specific company (société): revenue, expenses, margin, pending invoices. Unlike get_dashboard_kpis which aggregates ALL companies, this returns data for ONE company.',
    {
      company_id: z.string().uuid().describe('The company UUID (from list_user_companies)')
    },
    async ({ company_id }) => {
      const userId = getUserId();
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const today = now.toISOString().split('T')[0];

      const [invoicesRes, paidRes, expensesRes, pendingRes] = await Promise.all([
        supabase.from('invoices').select('total_ttc')
          .eq('user_id', userId).eq('company_id', company_id)
          .gte('date', monthStart).lte('date', today),
        supabase.from('invoices').select('total_ttc')
          .eq('user_id', userId).eq('company_id', company_id)
          .gte('date', monthStart).in('status', ['paid']),
        supabase.from('expenses').select('amount')
          .eq('user_id', userId).eq('company_id', company_id)
          .gte('created_at', monthStart).lte('created_at', today),
        supabase.from('invoices').select('total_ttc')
          .eq('user_id', userId).eq('company_id', company_id)
          .in('payment_status', ['unpaid', 'partial'])
      ]);

      const sum = (rows: any[], field: string) =>
        (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r[field] || '0'), 0);

      const totalBilled = sum(invoicesRes.data ?? [], 'total_ttc');
      const totalPaid = sum(paidRes.data ?? [], 'total_ttc');
      const totalExpenses = sum(expensesRes.data ?? [], 'amount');
      const totalPending = sum(pendingRes.data ?? [], 'total_ttc');

      const r = (n: number) => Math.round(n * 100) / 100;

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          company_id,
          month: monthStart.substring(0, 7),
          revenue_billed: r(totalBilled),
          revenue_collected: r(totalPaid),
          expenses: r(totalExpenses),
          margin: r(totalPaid - totalExpenses),
          total_pending_all_time: r(totalPending),
          invoices_this_month: invoicesRes.data?.length ?? 0
        }, null, 2) }]
      };
    }
  );

  // ── 3. get_company_cash_flow ────────────────────────────────
  server.tool(
    'get_company_cash_flow',
    'Get monthly cash flow for a specific company (société): income, expenses, net per month.',
    {
      company_id: z.string().uuid().describe('The company UUID'),
      months: z.number().optional().describe('Number of months to analyze (default 6)')
    },
    async ({ company_id, months }) => {
      const userId = getUserId();
      const periodMonths = months ?? 6;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - periodMonths);
      const startStr = startDate.toISOString().split('T')[0];

      const [invoicesRes, expensesRes] = await Promise.all([
        supabase.from('invoices').select('total_ttc, date, status')
          .eq('user_id', userId).eq('company_id', company_id)
          .in('status', ['paid', 'sent']).gte('date', startStr),
        supabase.from('expenses').select('amount, created_at')
          .eq('user_id', userId).eq('company_id', company_id)
          .gte('created_at', startStr)
      ]);

      const monthlyData: Record<string, { month: string; income: number; expenses: number; net: number }> = {};
      const now = new Date();
      for (let i = periodMonths; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { month: key, income: 0, expenses: 0, net: 0 };
      }

      for (const inv of invoicesRes.data ?? []) {
        const key = inv.date?.substring(0, 7);
        if (key && monthlyData[key]) monthlyData[key].income += parseFloat(inv.total_ttc || '0');
      }

      for (const exp of expensesRes.data ?? []) {
        const key = exp.created_at?.substring(0, 7);
        if (key && monthlyData[key]) monthlyData[key].expenses += parseFloat(exp.amount || '0');
      }

      const data = Object.values(monthlyData).map(m => ({
        ...m,
        income: Math.round(m.income * 100) / 100,
        expenses: Math.round(m.expenses * 100) / 100,
        net: Math.round((m.income - m.expenses) * 100) / 100
      }));

      const totalIn = data.reduce((s, m) => s + m.income, 0);
      const totalOut = data.reduce((s, m) => s + m.expenses, 0);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          company_id,
          monthly: data,
          summary: {
            total_income: Math.round(totalIn * 100) / 100,
            total_expenses: Math.round(totalOut * 100) / 100,
            net: Math.round((totalIn - totalOut) * 100) / 100
          }
        }, null, 2) }]
      };
    }
  );

  // ── 4. get_company_financial_summary ────────────────────────
  server.tool(
    'get_company_financial_summary',
    'Get a full financial snapshot for a specific company: invoices breakdown, expenses by category, supplier invoices, receivables, payables.',
    {
      company_id: z.string().uuid().describe('The company UUID')
    },
    async ({ company_id }) => {
      const userId = getUserId();

      const [invRes, expRes, sinvRes, recRes, payRes, suppRes, clientRes] = await Promise.all([
        supabase.from('invoices').select('id, total_ttc, status, payment_status')
          .eq('user_id', userId).eq('company_id', company_id),
        supabase.from('expenses').select('id, amount, category')
          .eq('user_id', userId).eq('company_id', company_id),
        supabase.from('supplier_invoices').select('id, total_ttc, payment_status')
          .eq('user_id', userId).eq('company_id', company_id),
        supabase.from('receivables').select('id, amount, amount_paid, status')
          .eq('user_id', userId).eq('company_id', company_id),
        supabase.from('payables').select('id, amount, amount_paid, status')
          .eq('user_id', userId).eq('company_id', company_id),
        supabase.from('suppliers').select('id')
          .eq('user_id', userId).eq('company_id', company_id),
        supabase.from('clients').select('id')
          .eq('user_id', userId).eq('company_id', company_id)
      ]);

      const r = (n: number) => Math.round(n * 100) / 100;
      const sumField = (rows: any[], field: string) =>
        r((rows ?? []).reduce((s: number, row: any) => s + parseFloat(row[field] || '0'), 0));

      // Invoices breakdown
      const invoices = invRes.data ?? [];
      const invByStatus: Record<string, { count: number; total: number }> = {};
      for (const inv of invoices) {
        const st = inv.payment_status || inv.status || 'unknown';
        if (!invByStatus[st]) invByStatus[st] = { count: 0, total: 0 };
        invByStatus[st].count++;
        invByStatus[st].total += parseFloat(inv.total_ttc || '0');
      }
      for (const k of Object.keys(invByStatus)) invByStatus[k].total = r(invByStatus[k].total);

      // Expenses by category
      const expenses = expRes.data ?? [];
      const expByCat: Record<string, { count: number; total: number }> = {};
      for (const exp of expenses) {
        const cat = exp.category || 'other';
        if (!expByCat[cat]) expByCat[cat] = { count: 0, total: 0 };
        expByCat[cat].count++;
        expByCat[cat].total += parseFloat(exp.amount || '0');
      }
      for (const k of Object.keys(expByCat)) expByCat[k].total = r(expByCat[k].total);

      // Receivables
      const receivables = recRes.data ?? [];
      const recTotal = sumField(receivables, 'amount');
      const recPaid = sumField(receivables, 'amount_paid');

      // Payables
      const payables = payRes.data ?? [];
      const payTotal = sumField(payables, 'amount');
      const payPaid = sumField(payables, 'amount_paid');

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          company_id,
          counts: {
            clients: clientRes.data?.length ?? 0,
            suppliers: suppRes.data?.length ?? 0,
            invoices: invoices.length,
            expenses: expenses.length,
            supplier_invoices: sinvRes.data?.length ?? 0,
            receivables: receivables.length,
            payables: payables.length,
          },
          invoices_breakdown: invByStatus,
          total_invoiced: sumField(invoices, 'total_ttc'),
          expenses_by_category: expByCat,
          total_expenses: sumField(expenses, 'amount'),
          supplier_invoices_total: sumField(sinvRes.data ?? [], 'total_ttc'),
          receivables: { total: recTotal, collected: recPaid, outstanding: r(recTotal - recPaid) },
          payables: { total: payTotal, paid: payPaid, outstanding: r(payTotal - payPaid) },
        }, null, 2) }]
      };
    }
  );

  // ── 5. get_company_profit_and_loss ──────────────────────────
  server.tool(
    'get_company_profit_and_loss',
    'Profit & Loss (compte de résultat) for a specific company, based on its accounting entries.',
    {
      company_id: z.string().uuid().describe('The company UUID'),
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ company_id, start_date, end_date }) => {
      const userId = getUserId();

      const { data, error } = await supabase
        .from('accounting_entries')
        .select('account_code, account_name, debit, credit, entry_date')
        .eq('user_id', userId)
        .eq('company_id', company_id)
        .gte('entry_date', start_date)
        .lte('entry_date', end_date);

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'company P&L') }] };

      const r = (n: number) => Math.round(n * 100) / 100;
      const accounts: Record<string, { code: string; name: string; debit: number; credit: number }> = {};

      for (const e of data ?? []) {
        const code = e.account_code || '';
        if (!accounts[code]) accounts[code] = { code, name: e.account_name || code, debit: 0, credit: 0 };
        accounts[code].debit += parseFloat(e.debit || '0');
        accounts[code].credit += parseFloat(e.credit || '0');
      }

      // Revenue: class 7 (credit - debit)
      const revenueAccounts = Object.values(accounts)
        .filter(a => a.code.startsWith('7'))
        .map(a => ({ code: a.code, name: a.name, amount: r(a.credit - a.debit) }))
        .sort((a, b) => a.code.localeCompare(b.code));

      // Expenses: class 6 (debit - credit)
      const expenseAccounts = Object.values(accounts)
        .filter(a => a.code.startsWith('6'))
        .map(a => ({ code: a.code, name: a.name, amount: r(a.debit - a.credit) }))
        .sort((a, b) => a.code.localeCompare(b.code));

      const totalRevenue = r(revenueAccounts.reduce((s, a) => s + a.amount, 0));
      const totalExpenses = r(expenseAccounts.reduce((s, a) => s + a.amount, 0));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          company_id,
          period: { start: start_date, end: end_date },
          revenue: { accounts: revenueAccounts, total: totalRevenue },
          expenses: { accounts: expenseAccounts, total: totalExpenses },
          net_result: r(totalRevenue - totalExpenses),
          profitable: totalRevenue > totalExpenses
        }, null, 2) }]
      };
    }
  );

  // ── 6. get_company_balance_sheet ────────────────────────────
  server.tool(
    'get_company_balance_sheet',
    'Balance sheet (bilan) for a specific company at a given date, based on its accounting entries.',
    {
      company_id: z.string().uuid().describe('The company UUID'),
      date: z.string().optional().describe('Cut-off date (YYYY-MM-DD), default today')
    },
    async ({ company_id, date }) => {
      const userId = getUserId();
      const cutoff = date || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('accounting_entries')
        .select('account_code, account_name, debit, credit')
        .eq('user_id', userId)
        .eq('company_id', company_id)
        .lte('entry_date', cutoff);

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'company balance sheet') }] };

      const r = (n: number) => Math.round(n * 100) / 100;
      const accounts: Record<string, { code: string; name: string; balance: number }> = {};

      for (const e of data ?? []) {
        const code = e.account_code || '';
        if (!accounts[code]) accounts[code] = { code, name: e.account_name || code, balance: 0 };
        accounts[code].balance += parseFloat(e.debit || '0') - parseFloat(e.credit || '0');
      }

      const all = Object.values(accounts);

      // Assets: class 1-5 with debit balance
      const assets = all
        .filter(a => /^[1-5]/.test(a.code) && a.balance > 0)
        .map(a => ({ code: a.code, name: a.name, balance: r(a.balance) }))
        .sort((a, b) => a.code.localeCompare(b.code));

      // Liabilities: class 1-5 with credit balance
      const liabilities = all
        .filter(a => /^[1-5]/.test(a.code) && a.balance < 0)
        .map(a => ({ code: a.code, name: a.name, balance: r(Math.abs(a.balance)) }))
        .sort((a, b) => a.code.localeCompare(b.code));

      const totalAssets = r(assets.reduce((s, a) => s + a.balance, 0));
      const totalLiabilities = r(liabilities.reduce((s, a) => s + a.balance, 0));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          company_id,
          date: cutoff,
          assets: { accounts: assets, total: totalAssets },
          liabilities: { accounts: liabilities, total: totalLiabilities },
          balanced: Math.abs(totalAssets - totalLiabilities) < 0.01
        }, null, 2) }]
      };
    }
  );

  // ── 7. compare_companies_kpis ───────────────────────────────
  server.tool(
    'compare_companies_kpis',
    'Compare KPIs across all companies (sociétés) of the user: revenue, expenses, margin side by side. Useful for portfolio analysis.',
    {
      start_date: z.string().optional().describe('Start date (YYYY-MM-DD), default first day of current month'),
      end_date: z.string().optional().describe('End date (YYYY-MM-DD), default today')
    },
    async ({ start_date, end_date }) => {
      const userId = getUserId();
      const now = new Date();
      const sDate = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const eDate = end_date || now.toISOString().split('T')[0];

      // Get all companies
      const { data: companies, error: compError } = await supabase
        .from('company')
        .select('id, company_name, country, currency')
        .eq('user_id', userId)
        .order('created_at');

      if (compError) return { content: [{ type: 'text' as const, text: safeError(compError, 'compare companies') }] };

      // Get all invoices and expenses in period
      const [invRes, expRes] = await Promise.all([
        supabase.from('invoices').select('company_id, total_ttc, status, payment_status')
          .eq('user_id', userId).gte('date', sDate).lte('date', eDate),
        supabase.from('expenses').select('company_id, amount')
          .eq('user_id', userId).gte('created_at', sDate).lte('created_at', eDate)
      ]);

      const r = (n: number) => Math.round(n * 100) / 100;

      const results = (companies ?? []).map(c => {
        const compInvoices = (invRes.data ?? []).filter(i => i.company_id === c.id);
        const compExpenses = (expRes.data ?? []).filter(e => e.company_id === c.id);

        const revenue = compInvoices.reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);
        const paidRevenue = compInvoices
          .filter(i => i.payment_status === 'paid' || i.status === 'paid')
          .reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);
        const expenses = compExpenses.reduce((s, e) => s + parseFloat(e.amount || '0'), 0);

        return {
          company_id: c.id,
          name: c.company_name,
          country: c.country,
          currency: c.currency,
          revenue_billed: r(revenue),
          revenue_collected: r(paidRevenue),
          expenses: r(expenses),
          margin: r(paidRevenue - expenses),
          invoices_count: compInvoices.length,
          expenses_count: compExpenses.length,
        };
      });

      const totals = {
        revenue_billed: r(results.reduce((s, c) => s + c.revenue_billed, 0)),
        revenue_collected: r(results.reduce((s, c) => s + c.revenue_collected, 0)),
        expenses: r(results.reduce((s, c) => s + c.expenses, 0)),
        margin: r(results.reduce((s, c) => s + c.margin, 0)),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          period: { start: sDate, end: eDate },
          companies: results,
          totals,
          company_count: results.length
        }, null, 2) }]
      };
    }
  );
}
