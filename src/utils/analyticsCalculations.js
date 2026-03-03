
import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';

const roundMetric = (value, decimals = 2) => Number((Number(value) || 0).toFixed(decimals));

const parseDateValue = (value) => {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

const getInvoiceTotal = (invoice) => Number(invoice?.total_ttc ?? invoice?.total ?? 0);

const getInvoiceBalanceDue = (invoice) => {
  const rawBalance = invoice?.balance_due;
  if (rawBalance == null || rawBalance === '') {
    const total = getInvoiceTotal(invoice);
    const paymentStatus = invoice?.payment_status;
    if (paymentStatus === 'paid' || paymentStatus === 'overpaid') {
      return 0;
    }
    return total;
  }
  return Number(rawBalance || 0);
};

const isInvoiceCollected = (invoice) => {
  return invoice?.status === 'paid' || invoice?.payment_status === 'paid' || invoice?.payment_status === 'overpaid';
};

const isInvoiceBooked = (invoice) => {
  return invoice?.status && !['draft', 'cancelled'].includes(invoice.status);
};

const isInvoiceOverdue = (invoice, referenceDate = new Date()) => {
  const dueDate = parseDateValue(invoice?.due_date);
  if (!dueDate) return false;
  return differenceInCalendarDays(referenceDate, dueDate) > 0 && getInvoiceBalanceDue(invoice) > 0;
};

export const aggregateRevenueByMonth = (invoices) => {
  if (!invoices || invoices.length === 0) return [];

  const revenueMap = {};

  invoices.forEach(inv => {
    if (inv.status === 'paid' && (inv.date || inv.created_at)) {
      const dateStr = inv.date || inv.created_at;
      const date = parseISO(dateStr);
      if (isValid(date)) {
        const monthKey = format(date, 'MMM yyyy'); // e.g., "Jan 2024"
        // Store sort key to order correctly later if needed, but simplistic approach first
        if (!revenueMap[monthKey]) {
            revenueMap[monthKey] = 0;
        }
        revenueMap[monthKey] += Number(inv.total || 0);
      }
    }
  });

  return Object.entries(revenueMap).map(([name, value]) => ({
    name,
    value
  }));
};

export const aggregateExpensesByMonth = (expenses) => {
  if (!expenses || expenses.length === 0) return [];

  const expenseMap = {};

  expenses.forEach(exp => {
    if (exp.date || exp.created_at) {
      const dateStr = exp.date || exp.created_at;
      const date = parseISO(dateStr);
      if (isValid(date)) {
        const monthKey = format(date, 'MMM yyyy');
        if (!expenseMap[monthKey]) {
          expenseMap[monthKey] = 0;
        }
        expenseMap[monthKey] += Number(exp.amount || 0);
      }
    }
  });

  return Object.entries(expenseMap).map(([name, value]) => ({
    name,
    value
  }));
};

export const aggregateRevenueByClient = (invoices) => {
  if (!invoices || invoices.length === 0) return [];

  const clientMap = {};

  invoices.forEach(inv => {
    if (inv.status === 'paid') {
      const clientName = inv.client?.company_name || 'Unknown Client';
      if (!clientMap[clientName]) {
        clientMap[clientName] = 0;
      }
      clientMap[clientName] += Number(inv.total || 0);
    }
  });

  return Object.entries(clientMap).map(([name, value]) => ({
    name,
    value
  }));
};

export const aggregateProjectPerformance = (timesheets, invoices) => {
  if ((!timesheets || timesheets.length === 0) && (!invoices || invoices.length === 0)) {
    return [];
  }

  const projectMap = {};

  // Aggregate Hours from Timesheets
  if (timesheets) {
    timesheets.forEach(ts => {
      const projectName = ts.project?.name || 'Unassigned';
      if (!projectMap[projectName]) {
        projectMap[projectName] = { hours: 0, revenue: 0 };
      }
      // duration_minutes to hours
      projectMap[projectName].hours += (ts.duration_minutes || 0) / 60;
    });
  }

  // Aggregate Revenue from Invoices (if linked to project)
  // Note: This relies on invoices having a project_id or some link. 
  // If not available, revenue will stay 0 for project-specific view.
  if (invoices) {
    invoices.forEach(inv => {
      if (inv.status === 'paid' && inv.project_id) {
        // We need a way to map ID to name. 
        // Without a projects list passed in, we might assume invoice has project name snapshot
        // or we try to match with timesheet project names if possible.
        // For now, we'll use a placeholder or skip if strict mapping isn't possible.
        // Assuming inv.project_name exists or we just rely on hours for now if data is missing.
        const projectName = inv.project?.name || inv.project_name || 'Unassigned'; 
         if (!projectMap[projectName]) {
            projectMap[projectName] = { hours: 0, revenue: 0 };
        }
        projectMap[projectName].revenue += Number(inv.total || 0);
      }
    });
  }

  return Object.entries(projectMap).map(([name, stats]) => ({
    name,
    hours: Number(stats.hours.toFixed(1)),
    revenue: Number(stats.revenue.toFixed(2))
  }));
};

export const formatChartData = (revenueData, expensesData) => {
  // Combine revenue and expenses into single array for LineChart
  const allMonths = new Set([...revenueData.map(d => d.name), ...expensesData.map(d => d.name)]);
  
  // Sort months chronologically
  const sortedMonths = Array.from(allMonths).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA - dateB;
  });

  return sortedMonths.map(month => {
    const rev = revenueData.find(d => d.name === month);
    const exp = expensesData.find(d => d.name === month);
    return {
      name: month,
      revenue: rev ? rev.value : 0,
      expenses: exp ? exp.value : 0
    };
  });
};

export const computeExecutiveMetrics = (invoices = [], expenses = [], timesheets = []) => {
  const bookedRevenue = invoices
    .filter(isInvoiceBooked)
    .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);

  const collectedRevenue = invoices
    .filter(isInvoiceCollected)
    .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);

  const outstandingReceivables = invoices
    .filter(invoice => getInvoiceBalanceDue(invoice) > 0 && invoice?.status !== 'cancelled')
    .reduce((sum, invoice) => sum + getInvoiceBalanceDue(invoice), 0);

  const overdueReceivables = invoices
    .filter(invoice => isInvoiceOverdue(invoice))
    .reduce((sum, invoice) => sum + getInvoiceBalanceDue(invoice), 0);

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense?.amount || 0), 0);

  const totalHours = timesheets.reduce((sum, timesheet) => sum + (Number(timesheet?.duration_minutes || 0) / 60), 0);
  const billableHours = timesheets
    .filter(timesheet => timesheet?.billable !== false)
    .reduce((sum, timesheet) => sum + (Number(timesheet?.duration_minutes || 0) / 60), 0);
  const invoicedHours = timesheets
    .filter(timesheet => timesheet?.invoice_id || timesheet?.status === 'invoiced')
    .reduce((sum, timesheet) => sum + (Number(timesheet?.duration_minutes || 0) / 60), 0);

  const weightedRateBase = timesheets.reduce((sum, timesheet) => {
    const hours = Number(timesheet?.duration_minutes || 0) / 60;
    const rate = Number(timesheet?.service?.hourly_rate || timesheet?.project?.hourly_rate || 0);
    return sum + (hours * rate);
  }, 0);

  const collectionRate = bookedRevenue > 0 ? (collectedRevenue / bookedRevenue) * 100 : 0;
  const billableUtilization = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
  const invoicingCoverage = billableHours > 0 ? (invoicedHours / billableHours) * 100 : 0;
  const averageBillableRate = billableHours > 0 ? weightedRateBase / billableHours : 0;
  const grossMargin = collectedRevenue - totalExpenses;
  const grossMarginPct = collectedRevenue > 0 ? (grossMargin / collectedRevenue) * 100 : 0;

  return {
    bookedRevenue: roundMetric(bookedRevenue),
    collectedRevenue: roundMetric(collectedRevenue),
    outstandingReceivables: roundMetric(outstandingReceivables),
    overdueReceivables: roundMetric(overdueReceivables),
    totalExpenses: roundMetric(totalExpenses),
    grossMargin: roundMetric(grossMargin),
    grossMarginPct: roundMetric(grossMarginPct, 1),
    totalHours: roundMetric(totalHours, 1),
    billableHours: roundMetric(billableHours, 1),
    invoicedHours: roundMetric(invoicedHours, 1),
    collectionRate: roundMetric(collectionRate, 1),
    billableUtilization: roundMetric(billableUtilization, 1),
    invoicingCoverage: roundMetric(invoicingCoverage, 1),
    averageBillableRate: roundMetric(averageBillableRate),
  };
};

export const aggregateReceivablesAging = (invoices = [], referenceDate = new Date()) => {
  const buckets = {
    current: 0,
    '1-30': 0,
    '31-60': 0,
    '61+': 0,
  };

  invoices.forEach(invoice => {
    const balanceDue = getInvoiceBalanceDue(invoice);
    if (balanceDue <= 0 || invoice?.status === 'cancelled') return;

    const dueDate = parseDateValue(invoice?.due_date);
    if (!dueDate) {
      buckets.current += balanceDue;
      return;
    }

    const daysLate = differenceInCalendarDays(referenceDate, dueDate);
    if (daysLate <= 0) {
      buckets.current += balanceDue;
    } else if (daysLate <= 30) {
      buckets['1-30'] += balanceDue;
    } else if (daysLate <= 60) {
      buckets['31-60'] += balanceDue;
    } else {
      buckets['61+'] += balanceDue;
    }
  });

  return [
    { name: 'À terme', value: roundMetric(buckets.current), tone: '#3B82F6' },
    { name: '1-30 j', value: roundMetric(buckets['1-30']), tone: '#F59E0B' },
    { name: '31-60 j', value: roundMetric(buckets['31-60']), tone: '#F97316' },
    { name: '61+ j', value: roundMetric(buckets['61+']), tone: '#EF4444' },
  ];
};

export const aggregateReceivablesWatchlist = (invoices = [], limit = 6, referenceDate = new Date()) => {
  return invoices
    .filter(invoice => isInvoiceOverdue(invoice, referenceDate))
    .map(invoice => {
      const dueDate = parseDateValue(invoice?.due_date);
      const amount = getInvoiceBalanceDue(invoice);
      const daysOverdue = dueDate ? differenceInCalendarDays(referenceDate, dueDate) : 0;

      return {
        id: invoice.id,
        invoiceNumber: invoice?.invoice_number || invoice?.id || '—',
        clientName: invoice?.client?.company_name || 'Client inconnu',
        dueDate: dueDate ? format(dueDate, 'dd/MM/yyyy') : '—',
        daysOverdue,
        amount: roundMetric(amount),
      };
    })
    .sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return b.amount - a.amount;
    })
    .slice(0, limit);
};

export const aggregateClientConcentration = (invoices = [], limit = 5) => {
  const clientMap = {};

  invoices
    .filter(isInvoiceBooked)
    .forEach(invoice => {
      const clientName = invoice?.client?.company_name || 'Client inconnu';
      clientMap[clientName] = (clientMap[clientName] || 0) + getInvoiceTotal(invoice);
    });

  const rows = Object.entries(clientMap)
    .map(([name, value]) => ({ name, value: roundMetric(value) }))
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return rows.slice(0, limit).map(row => ({
    ...row,
    share: total > 0 ? roundMetric((row.value / total) * 100, 1) : 0,
  }));
};
