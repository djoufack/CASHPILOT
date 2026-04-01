import { buildClientFinancialBreakdown, normalizeInvoiceClientView } from './financialContext.ts';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
};

export const formatMoney = (value: number) =>
  `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;

/** Gather financial data for CFO analysis */
export const gatherFinancialContext = async (supabase: any, companyId: string, userId?: string) => {
  const [invoicesRes, expensesRes, paymentsRes, clientsRes, companyRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, client_id, invoice_number, total_ttc, total_ht, status, payment_status, balance_due, date, due_date')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('expenses')
      .select('id, description, amount, category, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('payments')
      .select('id, amount, payment_date, payment_method')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('clients')
      .select('id, company_name, contact_name, email')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('company').select('id, company_name').eq('id', companyId).maybeSingle(),
  ]);

  const invoices = invoicesRes.data || [];
  const expenses = expensesRes.data || [];
  const payments = paymentsRes.data || [];
  const clients = clientsRes.data || [];
  const invoicesWithClient = normalizeInvoiceClientView(invoices, clients);
  const clientBreakdown = buildClientFinancialBreakdown(invoicesWithClient);

  const totalRevenue = invoices
    .filter((i) => ['paid', 'sent', 'overdue'].includes(i.status || ''))
    .reduce((sum, i) => sum + toNumber(i.total_ttc), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const totalPaid = payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
  const overdueInvoices = invoices.filter(
    (i) => i.due_date && new Date(i.due_date) < new Date() && i.payment_status !== 'paid'
  );
  const unpaidTotal = invoices
    .filter((i) => i.payment_status !== 'paid')
    .reduce((sum, i) => sum + toNumber(i.balance_due || i.total_ttc), 0);

  let workingCapitalKpis: {
    dso: number | null;
    dpo: number | null;
    dio: number | null;
    ccc: number | null;
  } | null = null;

  if (userId) {
    const { data: pilotageRatios, error: pilotageError } = await supabase.rpc('f_pilotage_ratios', {
      p_user_id: userId,
      p_company_id: companyId,
      p_start_date: null,
      p_end_date: null,
      p_region: 'france',
    });

    if (!pilotageError) {
      const activity = pilotageRatios?.activity || {};
      const dso = toNullableNumber(activity.dso);
      const dpo = toNullableNumber(activity.dpo);
      const dio = toNullableNumber(activity.stockRotationDays);
      const ccc = toNullableNumber(activity.ccc);

      const hasMetric = [dso, dpo, dio, ccc].some((metric) => metric !== null);
      if (hasMetric) {
        workingCapitalKpis = { dso, dpo, dio, ccc };
      }
    }
  }

  return {
    companyName: companyRes.data?.company_name || 'Entreprise',
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netResult: Math.round((totalRevenue - totalExpenses) * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      unpaidTotal: Math.round(unpaidTotal * 100) / 100,
      overdueCount: overdueInvoices.length,
      clientCount: clients.length,
      invoiceCount: invoices.length,
    },
    recentInvoices: invoices.slice(0, 10),
    recentExpenses: expenses.slice(0, 10),
    overdueInvoices: overdueInvoices.slice(0, 10),
    topClients: clients.slice(0, 10),
    invoicesWithClient: invoicesWithClient.slice(0, 20),
    topClientsByRevenue: clientBreakdown.topClientsByRevenue.slice(0, 10),
    unassignedInvoicesCount: clientBreakdown.unassignedInvoicesCount,
    workingCapitalKpis,
  };
};
