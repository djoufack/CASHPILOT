import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { resolveAccountingCurrency } from '@/utils/accountingCurrency';

export const OBLIGATION_LOOKAHEAD_DAYS = 7;

const DUE_BUCKET_PRIORITY = {
  overdue: 0,
  due_today: 1,
  due_soon: 2,
  upcoming: 3,
  unscheduled: 4,
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

export const parseDueDate = (value) => {
  if (!value) return null;

  try {
    const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

export const getDueBucket = (value, lookaheadDays = OBLIGATION_LOOKAHEAD_DAYS) => {
  const dueDate = parseDueDate(value);
  if (!dueDate) {
    return 'unscheduled';
  }

  const daysUntilDue = differenceInCalendarDays(startOfDay(dueDate), startOfDay(new Date()));

  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'due_today';
  if (daysUntilDue <= lookaheadDays) return 'due_soon';
  return 'upcoming';
};

export const formatDueDate = (value, locale = 'fr-FR') => {
  const dueDate = parseDueDate(value);
  return dueDate ? dueDate.toLocaleDateString(locale) : 'Sans echeance';
};

export const formatMoney = (amount, currency = 'EUR', locale = 'fr-FR') => {
  const numericValue = Number(amount || 0);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch {
    return `${numericValue.toFixed(2)} ${currency}`;
  }
};

export const isOpenCustomerInvoice = (invoice) => {
  const status = normalizeStatus(invoice?.status);
  const paymentStatus = normalizeStatus(invoice?.payment_status);
  const balanceDue = Number(invoice?.balance_due);

  if (status === 'draft' || status === 'cancelled' || status === 'paid') return false;
  if (paymentStatus === 'paid' || paymentStatus === 'overpaid') return false;
  if (Number.isFinite(balanceDue)) return balanceDue > 0;

  return Number(invoice?.total_ttc || 0) > 0;
};

export const isOpenSupplierInvoice = (invoice) => {
  const paymentStatus = normalizeStatus(invoice?.payment_status);
  return paymentStatus !== 'paid' && paymentStatus !== 'cancelled';
};

const createSummary = (items, category) => {
  const categoryItems = items.filter((item) => item.category === category);
  const overdueItems = categoryItems.filter((item) => item.dueBucket === 'overdue');
  const dueSoonItems = categoryItems.filter((item) => ['due_today', 'due_soon'].includes(item.dueBucket));

  return {
    count: categoryItems.length,
    overdueCount: overdueItems.length,
    dueSoonCount: dueSoonItems.length,
    amount: categoryItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    overdueAmount: overdueItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  };
};

export const sortObligations = (items) => {
  return [...items].sort((left, right) => {
    const duePriorityDelta = (DUE_BUCKET_PRIORITY[left.dueBucket] ?? 99) - (DUE_BUCKET_PRIORITY[right.dueBucket] ?? 99);
    if (duePriorityDelta !== 0) return duePriorityDelta;

    const leftDate = parseDueDate(left.dueDate);
    const rightDate = parseDueDate(right.dueDate);
    const leftTimestamp = leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER;
    const rightTimestamp = rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER;

    if (leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;

    return String(left.title || '').localeCompare(String(right.title || ''));
  });
};

export const buildNotificationPayloads = (snapshot, options = {}) => {
  const { locale = 'fr-FR' } = options;
  const receivablesLabel = formatMoney(snapshot.summary.receivables.amount, snapshot.currency, locale);
  const payablesLabel = formatMoney(snapshot.summary.payables.amount, snapshot.currency, locale);

  const payloads = [];

  if (snapshot.summary.receivables.count > 0) {
    payloads.push({
      type: 'obligation_receivables',
      title: 'Factures clients impayees',
      message: snapshot.summary.receivables.overdueCount > 0
        ? `${snapshot.summary.receivables.count} facture(s) client impayee(s), dont ${snapshot.summary.receivables.overdueCount} en retard. ${receivablesLabel} a encaisser.`
        : `${snapshot.summary.receivables.count} facture(s) client encore impayee(s). ${receivablesLabel} a encaisser.`,
    });
  }

  if (snapshot.summary.payables.count > 0) {
    payloads.push({
      type: 'obligation_payables',
      title: 'Factures fournisseurs a payer',
      message: snapshot.summary.payables.overdueCount > 0
        ? `${snapshot.summary.payables.count} facture(s) fournisseur a traiter, dont ${snapshot.summary.payables.overdueCount} en retard. ${payablesLabel} a payer.`
        : `${snapshot.summary.payables.count} facture(s) fournisseur en attente. ${payablesLabel} a payer.`,
    });
  }

  if (snapshot.summary.quoteTasks.count > 0) {
    payloads.push({
      type: 'obligation_quotes',
      title: 'Devis a preparer',
      message: snapshot.summary.quoteTasks.overdueCount > 0
        ? `${snapshot.summary.quoteTasks.count} tache(s) demandent encore un devis, dont ${snapshot.summary.quoteTasks.overdueCount} deja en retard.`
        : `${snapshot.summary.quoteTasks.count} tache(s) demandent encore un devis.`,
    });
  }

  return payloads;
};

export const fetchObligationSnapshot = async (supabase, userId, options = {}) => {
  const { lookaheadDays = OBLIGATION_LOOKAHEAD_DAYS, locale = 'fr-FR' } = options;

  if (!supabase || !userId) {
    return {
      currency: 'EUR',
      obligations: [],
      summary: {
        receivables: { count: 0, overdueCount: 0, dueSoonCount: 0, amount: 0, overdueAmount: 0 },
        payables: { count: 0, overdueCount: 0, dueSoonCount: 0, amount: 0, overdueAmount: 0 },
        quoteTasks: { count: 0, overdueCount: 0, dueSoonCount: 0, amount: 0, overdueAmount: 0 },
      },
    };
  }

  const [
    { data: invoiceData, error: invoiceError },
    { data: companyData },
    { data: supplierRows, error: supplierError },
    { data: ownedProjectRows, error: ownedProjectError },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        due_date,
        status,
        payment_status,
        total_ttc,
        balance_due,
        client:clients(id, company_name, contact_name)
      `)
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('company')
      .select('accounting_currency')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('suppliers')
      .select('id, company_name')
      .eq('user_id', userId),
    supabase
      .from('projects')
      .select('id, name, client_id')
      .eq('user_id', userId),
  ]);

  if (invoiceError) throw invoiceError;
  if (supplierError) throw supplierError;
  if (ownedProjectError) throw ownedProjectError;

  const supplierIds = [...new Set((supplierRows || []).map((supplier) => supplier.id).filter(Boolean))];
  const supplierNamesById = new Map((supplierRows || []).map((supplier) => [supplier.id, supplier.company_name]));
  const { data: supplierInvoiceData, error: supplierInvoiceError } = supplierIds.length
    ? await supabase
        .from('supplier_invoices')
        .select(`
          id,
          invoice_number,
          due_date,
          payment_status,
          total_amount,
          total_ttc,
          supplier_id,
          supplier:suppliers(id, company_name)
        `)
        .in('supplier_id', supplierIds)
        .order('due_date', { ascending: true, nullsFirst: false })
    : { data: [], error: null };

  if (supplierInvoiceError) throw supplierInvoiceError;

  let quoteTaskRows = [];
  try {
    const ownedProjectIds = [...new Set((ownedProjectRows || []).map((project) => project.id).filter(Boolean))];
    if (ownedProjectIds.length > 0) {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, name, description, status, due_date, created_at, quote_id, requires_quote, project_id')
        .eq('requires_quote', true)
        .in('project_id', ownedProjectIds)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      quoteTaskRows = data || [];
    }
  } catch (error) {
    const isMissingColumnError = ['42703', 'PGRST204'].includes(error?.code);
    if (!isMissingColumnError) {
      throw error;
    }
  }

  const projectRows = ownedProjectRows || [];
  const clientIds = [...new Set(projectRows.map((project) => project.client_id).filter(Boolean))];
  const { data: clientRows, error: clientError } = clientIds.length
    ? await supabase
        .from('clients')
        .select('id, company_name, contact_name')
        .in('id', clientIds)
    : { data: [], error: null };

  if (clientError) throw clientError;

  const projectsById = new Map((projectRows || []).map((project) => [project.id, project]));
  const clientsById = new Map((clientRows || []).map((client) => [client.id, client]));
  const currency = resolveAccountingCurrency(companyData);

  const customerObligations = (invoiceData || [])
    .filter(isOpenCustomerInvoice)
    .map((invoice) => {
      const clientName = invoice.client?.company_name || invoice.client?.contact_name || 'Client';
      const dueBucket = getDueBucket(invoice.due_date, lookaheadDays);
      const amount = Number(invoice.balance_due ?? invoice.total_ttc ?? 0);

      return {
        id: `receivable:${invoice.id}`,
        entityId: invoice.id,
        category: 'receivable',
        title: invoice.invoice_number || 'Facture client',
        subtitle: clientName,
        dueDate: invoice.due_date,
        dueBucket,
        amount,
        amountLabel: formatMoney(amount, currency, locale),
        href: '/app/invoices',
        ctaLabel: 'Ouvrir les factures',
      };
    });

  const supplierObligations = (supplierInvoiceData || [])
    .filter(isOpenSupplierInvoice)
    .map((invoice) => {
      const supplierName = invoice.supplier?.company_name || supplierNamesById.get(invoice.supplier_id) || 'Fournisseur';
      const dueBucket = getDueBucket(invoice.due_date, lookaheadDays);
      const amount = Number(invoice.total_amount ?? invoice.total_ttc ?? 0);

      return {
        id: `payable:${invoice.id}`,
        entityId: invoice.id,
        category: 'payable',
        title: invoice.invoice_number || 'Facture fournisseur',
        subtitle: supplierName,
        dueDate: invoice.due_date,
        dueBucket,
        amount,
        amountLabel: formatMoney(amount, currency, locale),
        href: '/app/supplier-invoices',
        ctaLabel: 'Ouvrir les achats',
      };
    });

  const quoteTaskObligations = quoteTaskRows
    .filter((task) => !task.quote_id)
    .filter((task) => !['completed', 'cancelled'].includes(normalizeStatus(task.status)))
    .map((task) => {
      const project = projectsById.get(task.project_id);
      const client = project?.client_id ? clientsById.get(project.client_id) : null;
      const dueBucket = getDueBucket(task.due_date, lookaheadDays);
      const taskTitle = task.title || task.name || 'Devis a preparer';
      const projectLabel = project?.name || 'Projet';
      const clientLabel = client?.company_name || client?.contact_name || null;

      return {
        id: `quote-task:${task.id}`,
        entityId: task.id,
        category: 'quote_task',
        title: taskTitle,
        subtitle: clientLabel ? `${projectLabel} - ${clientLabel}` : projectLabel,
        dueDate: task.due_date,
        dueBucket,
        amount: 0,
        amountLabel: null,
        href: project?.id ? `/app/projects/${project.id}` : '/app/quotes',
        ctaLabel: project?.id ? 'Ouvrir le projet' : 'Ouvrir les devis',
      };
    });

  const obligations = sortObligations([
    ...customerObligations,
    ...supplierObligations,
    ...quoteTaskObligations,
  ]);

  return {
    currency,
    obligations,
    summary: {
      receivables: createSummary(obligations, 'receivable'),
      payables: createSummary(obligations, 'payable'),
      quoteTasks: createSummary(obligations, 'quote_task'),
    },
  };
};
