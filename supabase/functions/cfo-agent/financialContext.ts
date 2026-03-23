type RawInvoice = {
  id?: string | null;
  client_id?: string | null;
  invoice_number?: string | null;
  total_ttc?: number | string | null;
  balance_due?: number | string | null;
  payment_status?: string | null;
  due_date?: string | null;
};

type RawClient = {
  id?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
};

export type InvoiceClientView = {
  id: string | null;
  client_id: string | null;
  client_name: string | null;
  invoice_number: string | null;
  total_ttc: number;
  balance_due: number;
  payment_status: string;
  due_date: string | null;
};

export type ClientFinancialSummary = {
  client_id: string;
  client_name: string;
  invoice_count: number;
  revenue_ttc: number;
  unpaid_ttc: number;
  overdue_count: number;
  payment_rate: number;
};

export type ClientFinancialBreakdown = {
  topClientsByRevenue: ClientFinancialSummary[];
  unassignedInvoicesCount: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeInvoiceClientView(
  invoices: RawInvoice[] = [],
  clients: RawClient[] = []
): InvoiceClientView[] {
  const clientNameById = new Map<string, string>();
  for (const client of clients) {
    if (typeof client?.id !== 'string' || !client.id) continue;
    const name = String(client?.company_name || client?.contact_name || client?.email || 'Client inconnu');
    clientNameById.set(client.id, name);
  }

  return invoices.map((invoice) => {
    const clientId = typeof invoice?.client_id === 'string' && invoice.client_id ? invoice.client_id : null;
    return {
      id: typeof invoice?.id === 'string' ? invoice.id : null,
      client_id: clientId,
      client_name: clientId ? clientNameById.get(clientId) || 'Client inconnu' : null,
      invoice_number: typeof invoice?.invoice_number === 'string' ? invoice.invoice_number : null,
      total_ttc: round2(toNumber(invoice?.total_ttc)),
      balance_due: round2(toNumber(invoice?.balance_due)),
      payment_status: String(invoice?.payment_status || 'unknown'),
      due_date: typeof invoice?.due_date === 'string' ? invoice.due_date : null,
    };
  });
}

export function buildClientFinancialBreakdown(
  invoicesWithClient: InvoiceClientView[] = [],
  now: Date = new Date()
): ClientFinancialBreakdown {
  const byClient = new Map<string, ClientFinancialSummary>();
  let unassignedInvoicesCount = 0;

  for (const row of invoicesWithClient) {
    if (!row.client_id) {
      unassignedInvoicesCount += 1;
      continue;
    }

    const current = byClient.get(row.client_id) || {
      client_id: row.client_id,
      client_name: row.client_name || 'Client inconnu',
      invoice_count: 0,
      revenue_ttc: 0,
      unpaid_ttc: 0,
      overdue_count: 0,
      payment_rate: 0,
    };

    const dueDate = row.due_date ? new Date(row.due_date) : null;
    const isOverdue = Boolean(dueDate && dueDate < now && row.payment_status !== 'paid');

    current.invoice_count += 1;
    current.revenue_ttc = round2(current.revenue_ttc + toNumber(row.total_ttc));
    current.unpaid_ttc = round2(current.unpaid_ttc + toNumber(row.balance_due));
    if (isOverdue) current.overdue_count += 1;

    byClient.set(row.client_id, current);
  }

  const topClientsByRevenue = Array.from(byClient.values())
    .map((summary) => {
      const paid = Math.max(0, summary.revenue_ttc - summary.unpaid_ttc);
      const paymentRate = summary.revenue_ttc > 0 ? (paid / summary.revenue_ttc) * 100 : 0;
      return {
        ...summary,
        payment_rate: Math.round(paymentRate * 10) / 10,
      };
    })
    .sort((a, b) => b.revenue_ttc - a.revenue_ttc)
    .slice(0, 10);

  return {
    topClientsByRevenue,
    unassignedInvoicesCount,
  };
}
