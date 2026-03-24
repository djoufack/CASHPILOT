import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { safeError } from '../utils/errors.js';

export function registerCfoTools(server: McpServer) {
  server.tool(
    'cfo_health_score',
    "Calculate the financial health score (0-100) for the current user's active company",
    {
      company_id: z.string().optional().describe('Company ID (uses first company if omitted)'),
    },
    async ({ company_id }) => {
      const userId = getUserId();

      // Resolve company
      let resolvedCompanyId = company_id;
      if (!resolvedCompanyId) {
        const { data: pref } = await supabase
          .from('user_company_preferences')
          .select('active_company_id')
          .eq('user_id', userId)
          .maybeSingle();
        resolvedCompanyId = pref?.active_company_id;

        if (!resolvedCompanyId) {
          const { data: companies } = await supabase.from('company').select('id').eq('user_id', userId).limit(1);
          resolvedCompanyId = companies?.[0]?.id;
        }
      }

      if (!resolvedCompanyId) {
        return { content: [{ type: 'text' as const, text: 'No company found for current user.' }] };
      }

      // Fetch financial data
      const [invoicesRes, expensesRes, paymentsRes, clientsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_ttc, status, payment_status, balance_due, due_date')
          .eq('company_id', resolvedCompanyId),
        supabase.from('expenses').select('amount').eq('company_id', resolvedCompanyId),
        supabase.from('payments').select('amount').eq('company_id', resolvedCompanyId),
        supabase.from('clients').select('id').eq('company_id', resolvedCompanyId),
      ]);

      const invoices = invoicesRes.data || [];
      const expenses = expensesRes.data || [];
      const payments = paymentsRes.data || [];

      const totalRevenue = invoices
        .filter((i) => ['paid', 'sent', 'overdue'].includes(i.status || ''))
        .reduce((sum, i) => sum + parseFloat(i.total_ttc || '0'), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
      const overdueCount = invoices.filter(
        (i) => i.due_date && new Date(i.due_date) < new Date() && i.payment_status !== 'paid'
      ).length;
      const clientCount = clientsRes.data?.length || 0;

      // Compute score
      let score = 50;
      const factors: Record<string, { value: number; impact: number; label: string }> = {};

      const margin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
      const profitImpact = Math.min(20, Math.max(-20, margin * 0.5));
      score += profitImpact;
      factors.profitability = {
        value: Math.round(margin * 10) / 10,
        impact: Math.round(profitImpact),
        label: 'Net margin (%)',
      };

      const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;
      const collectionImpact = Math.min(15, Math.max(-10, (collectionRate - 50) * 0.3));
      score += collectionImpact;
      factors.collection = {
        value: Math.round(collectionRate * 10) / 10,
        impact: Math.round(collectionImpact),
        label: 'Collection rate (%)',
      };

      const overdueRatio = invoices.length > 0 ? (overdueCount / invoices.length) * 100 : 0;
      const overdueImpact = Math.max(-20, -overdueRatio * 0.5);
      score += overdueImpact;
      factors.overdue = { value: overdueCount, impact: Math.round(overdueImpact), label: 'Overdue invoices' };

      const diversImpact = Math.min(10, clientCount * 1.5);
      score += diversImpact;
      factors.diversification = {
        value: clientCount,
        impact: Math.round(diversImpact),
        label: 'Client diversification',
      };

      const netResult = totalRevenue - totalExpenses;
      const cashImpact = netResult >= 0 ? 5 : -5;
      score += cashImpact;
      factors.cashPosition = {
        value: Math.round(netResult * 100) / 100,
        impact: cashImpact,
        label: 'Net cash position',
      };

      const finalScore = Math.max(0, Math.min(100, Math.round(score)));

      // Save to DB
      await supabase.from('cfo_health_scores').insert({
        user_id: userId,
        company_id: resolvedCompanyId,
        score: finalScore,
        factors,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                score: finalScore,
                status: finalScore >= 70 ? 'excellent' : finalScore >= 40 ? 'moderate' : 'critical',
                factors,
                summary: {
                  total_revenue: Math.round(totalRevenue * 100) / 100,
                  total_expenses: Math.round(totalExpenses * 100) / 100,
                  net_result: Math.round(netResult * 100) / 100,
                  total_paid: Math.round(totalPaid * 100) / 100,
                  overdue_invoices: overdueCount,
                  client_count: clientCount,
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
    'cfo_risk_analysis',
    'Analyze financial risks: client concentration, overdue invoices, cash position',
    {
      company_id: z.string().optional().describe('Company ID (uses first company if omitted)'),
    },
    async ({ company_id }) => {
      const userId = getUserId();

      let resolvedCompanyId = company_id;
      if (!resolvedCompanyId) {
        const { data: pref } = await supabase
          .from('user_company_preferences')
          .select('active_company_id')
          .eq('user_id', userId)
          .maybeSingle();
        resolvedCompanyId = pref?.active_company_id;

        if (!resolvedCompanyId) {
          const { data: companies } = await supabase.from('company').select('id').eq('user_id', userId).limit(1);
          resolvedCompanyId = companies?.[0]?.id;
        }
      }

      if (!resolvedCompanyId) {
        return { content: [{ type: 'text' as const, text: 'No company found for current user.' }] };
      }

      const [invoicesRes, clientsRes, companyRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_ttc, status, payment_status, balance_due, due_date, client_id, client:clients(company_name)')
          .eq('company_id', resolvedCompanyId),
        supabase.from('clients').select('id, company_name').eq('company_id', resolvedCompanyId),
        supabase.from('company').select('currency').eq('id', resolvedCompanyId).single(),
      ]);
      const companyCurrency = companyRes.data?.currency || 'EUR';

      const invoices = invoicesRes.data || [];
      const totalRevenue = invoices
        .filter((i) => ['paid', 'sent', 'overdue'].includes(i.status || ''))
        .reduce((sum, i) => sum + parseFloat(i.total_ttc || '0'), 0);

      // Client concentration
      const clientTotals: Record<string, { name: string; total: number; count: number }> = {};
      for (const inv of invoices) {
        if (!inv.client_id) continue;
        if (!clientTotals[inv.client_id]) {
          const clientName = (inv.client as any)?.company_name || 'Unknown';
          clientTotals[inv.client_id] = { name: clientName, total: 0, count: 0 };
        }
        clientTotals[inv.client_id].total += parseFloat(inv.total_ttc || '0');
        clientTotals[inv.client_id].count++;
      }

      const sortedClients = Object.entries(clientTotals)
        .map(([id, data]) => ({
          client_id: id,
          ...data,
          total: Math.round(data.total * 100) / 100,
          share: totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      // Overdue invoices
      const overdueInvoices = invoices
        .filter((i) => i.due_date && new Date(i.due_date) < new Date() && i.payment_status !== 'paid')
        .map((i) => ({
          total_ttc: parseFloat(i.total_ttc || '0'),
          due_date: i.due_date,
          days_overdue: Math.floor((Date.now() - new Date(i.due_date!).getTime()) / 86400000),
          client: (i.client as any)?.company_name || 'Unknown',
        }))
        .sort((a, b) => b.days_overdue - a.days_overdue);

      const risks: Array<{ type: string; severity: string; message: string }> = [];
      if (sortedClients.length > 0 && sortedClients[0].share > 50) {
        risks.push({
          type: 'client_concentration',
          severity: sortedClients[0].share > 80 ? 'critical' : 'warning',
          message: `Top client (${sortedClients[0].name}) represents ${sortedClients[0].share}% of revenue`,
        });
      }
      if (overdueInvoices.length > 0) {
        const totalOverdue = overdueInvoices.reduce((s, i) => s + i.total_ttc, 0);
        risks.push({
          type: 'overdue_invoices',
          severity: overdueInvoices.length >= 5 ? 'critical' : 'warning',
          message: `${overdueInvoices.length} overdue invoice(s) totaling ${totalOverdue.toFixed(2)} ${companyCurrency}`,
        });
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                risks,
                client_concentration: sortedClients.slice(0, 5),
                overdue_invoices: overdueInvoices.slice(0, 10),
                total_revenue: Math.round(totalRevenue * 100) / 100,
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
    'cfo_recommendations',
    'Get strategic financial recommendations based on current data',
    {
      company_id: z.string().optional().describe('Company ID (uses first company if omitted)'),
    },
    async ({ company_id }) => {
      const userId = getUserId();

      let resolvedCompanyId = company_id;
      if (!resolvedCompanyId) {
        const { data: pref } = await supabase
          .from('user_company_preferences')
          .select('active_company_id')
          .eq('user_id', userId)
          .maybeSingle();
        resolvedCompanyId = pref?.active_company_id;

        if (!resolvedCompanyId) {
          const { data: companies } = await supabase.from('company').select('id').eq('user_id', userId).limit(1);
          resolvedCompanyId = companies?.[0]?.id;
        }
      }

      if (!resolvedCompanyId) {
        return { content: [{ type: 'text' as const, text: 'No company found for current user.' }] };
      }

      const [invoicesRes, expensesRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_ttc, status, payment_status, due_date, date')
          .eq('company_id', resolvedCompanyId),
        supabase.from('expenses').select('amount, category').eq('company_id', resolvedCompanyId),
        supabase.from('payments').select('amount').eq('company_id', resolvedCompanyId),
      ]);

      const invoices = invoicesRes.data || [];
      const expenses = expensesRes.data || [];
      const payments = paymentsRes.data || [];

      const totalRevenue = invoices
        .filter((i) => ['paid', 'sent', 'overdue'].includes(i.status || ''))
        .reduce((sum, i) => sum + parseFloat(i.total_ttc || '0'), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
      const overdueCount = invoices.filter(
        (i) => i.due_date && new Date(i.due_date) < new Date() && i.payment_status !== 'paid'
      ).length;

      const margin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
      const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

      const recommendations: Array<{ priority: string; category: string; title: string; detail: string }> = [];

      if (overdueCount > 0) {
        recommendations.push({
          priority: 'high',
          category: 'collections',
          title: 'Accelerate invoice collections',
          detail: `${overdueCount} invoice(s) are overdue. Implement automated payment reminders and consider early payment discounts.`,
        });
      }

      if (margin < 10) {
        recommendations.push({
          priority: 'high',
          category: 'profitability',
          title: 'Improve profit margins',
          detail: `Current margin is ${margin.toFixed(1)}%. Review pricing strategy and identify cost reduction opportunities.`,
        });
      }

      if (collectionRate < 70) {
        recommendations.push({
          priority: 'medium',
          category: 'cash_flow',
          title: 'Improve cash collection',
          detail: `Collection rate is ${collectionRate.toFixed(1)}%. Consider shorter payment terms or deposit requirements.`,
        });
      }

      // Expense category analysis
      const categoryTotals: Record<string, number> = {};
      for (const exp of expenses) {
        const cat = exp.category || 'other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(exp.amount || '0');
      }
      const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
      if (topCategory && totalExpenses > 0 && topCategory[1] / totalExpenses > 0.4) {
        recommendations.push({
          priority: 'medium',
          category: 'cost_optimization',
          title: `Review ${topCategory[0]} expenses`,
          detail: `Category "${topCategory[0]}" represents ${((topCategory[1] / totalExpenses) * 100).toFixed(1)}% of total expenses. Consider renegotiating or finding alternatives.`,
        });
      }

      if (recommendations.length === 0) {
        recommendations.push({
          priority: 'low',
          category: 'general',
          title: 'Financial health looks good',
          detail: 'No critical issues detected. Continue monitoring KPIs and maintain current practices.',
        });
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                recommendations,
                metrics: {
                  total_revenue: Math.round(totalRevenue * 100) / 100,
                  total_expenses: Math.round(totalExpenses * 100) / 100,
                  margin: Math.round(margin * 10) / 10,
                  collection_rate: Math.round(collectionRate * 10) / 10,
                  overdue_count: overdueCount,
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
}
