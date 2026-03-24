import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { safeError } from '../utils/errors.js';

/** Helper: apply optional company_id filter to a Supabase query builder */
function withCompany<T extends { eq: (col: string, val: string) => T }>(qb: T, companyId?: string): T {
  return companyId ? qb.eq('company_id', companyId) : qb;
}

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_cash_flow',
    'Get monthly cash flow data: income, expenses, net balance. Optionally scoped to a single company.',
    {
      months: z.number().optional().describe('Number of months to analyze (default 6)'),
      company_id: z
        .string()
        .uuid()
        .optional()
        .describe('Scope to a single company (from list_user_companies). If omitted, aggregates all companies.'),
    },
    async ({ months, company_id }) => {
      const userId = getUserId();
      const periodMonths = months ?? 6;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - periodMonths);
      const startStr = startDate.toISOString().split('T')[0];

      const [invoicesRes, expensesRes] = await Promise.all([
        withCompany(
          supabase
            .from('invoices')
            .select('total_ttc, date, status')
            .eq('user_id', userId)
            .in('status', ['paid', 'sent'])
            .gte('date', startStr),
          company_id
        ),
        withCompany(
          supabase
            .from('expenses')
            .select('amount, created_at, category')
            .eq('user_id', userId)
            .gte('created_at', startStr),
          company_id
        ),
      ]);

      // Group by month
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

      const data = Object.values(monthlyData).map((m) => ({
        ...m,
        income: Math.round(m.income * 100) / 100,
        expenses: Math.round(m.expenses * 100) / 100,
        net: Math.round((m.income - m.expenses) * 100) / 100,
      }));

      const totalIn = data.reduce((s, m) => s + m.income, 0);
      const totalOut = data.reduce((s, m) => s + m.expenses, 0);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                company_id: company_id ?? 'all',
                monthly: data,
                summary: {
                  total_income: Math.round(totalIn * 100) / 100,
                  total_expenses: Math.round(totalOut * 100) / 100,
                  net: Math.round((totalIn - totalOut) * 100) / 100,
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

  server.tool(
    'get_dashboard_kpis',
    'Get key performance indicators: revenue this month, pending invoices, expenses, margin. Accepts an optional company_id to scope to one company; otherwise aggregates all companies of the user.',
    {
      company_id: z
        .string()
        .uuid()
        .optional()
        .describe('Scope to a single company (from list_user_companies). If omitted, aggregates all companies.'),
    },
    async ({ company_id }) => {
      const userId = getUserId();
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const today = now.toISOString().split('T')[0];

      const [invoicesRes, paidRes, expensesRes, pendingRes, paymentsRes] = await Promise.all([
        // All invoices this month (billed)
        withCompany(
          supabase
            .from('invoices')
            .select('total_ttc')
            .eq('user_id', userId)
            .gte('date', monthStart)
            .lte('date', today),
          company_id
        ),
        // Paid invoices this month (collected via invoice status)
        withCompany(
          supabase
            .from('invoices')
            .select('total_ttc')
            .eq('user_id', userId)
            .gte('date', monthStart)
            .in('status', ['paid']),
          company_id
        ),
        // Expenses this month
        withCompany(
          supabase
            .from('expenses')
            .select('amount')
            .eq('user_id', userId)
            .gte('created_at', monthStart)
            .lte('created_at', today),
          company_id
        ),
        // Pending invoices (all time)
        withCompany(
          supabase
            .from('invoices')
            .select('total_ttc')
            .eq('user_id', userId)
            .in('payment_status', ['unpaid', 'partial']),
          company_id
        ),
        // Actual payments received this month (from payments table)
        withCompany(
          supabase
            .from('payments')
            .select('amount')
            .eq('user_id', userId)
            .gte('payment_date', monthStart)
            .lte('payment_date', today),
          company_id
        ),
      ]);

      const totalBilled = (invoicesRes.data ?? []).reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);
      const totalPaidInvoices = (paidRes.data ?? []).reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);
      const totalPayments = (paymentsRes.data ?? []).reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
      const totalExpenses = (expensesRes.data ?? []).reduce((s, e) => s + parseFloat(e.amount || '0'), 0);
      const totalPending = (pendingRes.data ?? []).reduce((s, i) => s + parseFloat(i.total_ttc || '0'), 0);

      // Use whichever is larger: paid invoices or actual payments — avoids under-reporting
      const revenueCollected = Math.max(totalPaidInvoices, totalPayments);

      const kpis = {
        company_id: company_id ?? 'all',
        month: monthStart.substring(0, 7),
        revenue_billed: Math.round(totalBilled * 100) / 100,
        revenue_collected: Math.round(revenueCollected * 100) / 100,
        revenue_collected_from_invoices: Math.round(totalPaidInvoices * 100) / 100,
        revenue_collected_from_payments: Math.round(totalPayments * 100) / 100,
        expenses: Math.round(totalExpenses * 100) / 100,
        margin: Math.round((revenueCollected - totalExpenses) * 100) / 100,
        total_pending_all_time: Math.round(totalPending * 100) / 100,
        invoices_this_month: invoicesRes.data?.length ?? 0,
        payments_this_month: paymentsRes.data?.length ?? 0,
        expenses_this_month: expensesRes.data?.length ?? 0,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(kpis, null, 2) }],
      };
    }
  );

  server.tool(
    'get_top_clients',
    'Get top clients ranked by total revenue. Optionally scoped to a single company.',
    {
      limit: z.number().optional().describe('Number of clients to return (default 10)'),
      company_id: z
        .string()
        .uuid()
        .optional()
        .describe('Scope to a single company (from list_user_companies). If omitted, aggregates all companies.'),
    },
    async ({ limit, company_id }) => {
      const userId = getUserId();
      let qb = supabase
        .from('invoices')
        .select('total_ttc, client_id, client:clients(id, company_name, email)')
        .eq('user_id', userId)
        .in('status', ['paid', 'sent'])
        .not('client_id', 'is', null);
      if (company_id) qb = qb.eq('company_id', company_id);

      const { data, error } = await qb;

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get top clients') }] };

      const clientTotals: Record<
        string,
        { client_id: string; company_name: string; email: string; total_revenue: number; invoice_count: number }
      > = {};

      for (const inv of data ?? []) {
        const client = inv.client as { id: string; company_name: string; email: string } | null;
        if (!client) continue;
        if (!clientTotals[client.id]) {
          clientTotals[client.id] = {
            client_id: client.id,
            company_name: client.company_name,
            email: client.email,
            total_revenue: 0,
            invoice_count: 0,
          };
        }
        clientTotals[client.id].total_revenue += parseFloat(inv.total_ttc || '0');
        clientTotals[client.id].invoice_count++;
      }

      const ranked = Object.values(clientTotals)
        .map((c) => ({ ...c, total_revenue: Math.round(c.total_revenue * 100) / 100 }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit ?? 10);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(ranked, null, 2) }],
      };
    }
  );
}
