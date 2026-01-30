
import { format, parseISO, isValid } from 'date-fns';

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
