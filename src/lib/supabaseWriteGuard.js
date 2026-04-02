import { runDataEntryGuard } from '@/utils/dataEntryGuard';

export const TABLE_ENTITY_MAP = {
  invoices: 'invoice',
  invoice_items: 'invoice_item',
  expenses: 'expense',
  payables: 'payable',
  receivables: 'receivable',
  debt_payments: 'debt_payment',
};

const toRows = (values) => {
  if (Array.isArray(values)) return values;
  return [values];
};

const fromRows = (rows, originalValue) => {
  if (Array.isArray(originalValue)) return rows;
  return rows[0] || {};
};

const buildBlockingError = ({ table, operation, report, rowIndex }) => {
  const firstIssue = report.blockingIssues?.[0];
  const message = firstIssue?.message || 'Saisie invalide.';
  const howToFix = firstIssue?.howToFix ? ` ${firstIssue.howToFix}` : '';
  const error = new Error(`[${table}.${operation}] ${message}${howToFix}`);
  error.code = 'DATA_ENTRY_GUARD';
  error.guard = {
    table,
    operation,
    rowIndex,
    report,
  };
  return error;
};

const summarizeReports = (reports = []) => {
  return reports.reduce(
    (acc, report) => {
      acc.blocking += report.blockingIssues?.length || 0;
      acc.warnings += report.warnings?.length || 0;
      acc.corrections += report.corrections?.length || 0;
      return acc;
    },
    { blocking: 0, warnings: 0, corrections: 0 }
  );
};

export const guardTableWritePayload = (table, operation, values) => {
  const entity = TABLE_ENTITY_MAP[table] || 'generic';

  const rows = toRows(values);
  const reports = [];
  const guardedRows = rows.map((row, index) => {
    const report = runDataEntryGuard({
      entity,
      operation,
      payload: row || {},
      items: [],
    });
    reports.push(report);
    if (!report.isValid) {
      throw buildBlockingError({ table, operation, report, rowIndex: index });
    }
    return report.sanitizedPayload;
  });

  return {
    guardedValues: fromRows(guardedRows, values),
    reports,
    summary: summarizeReports(reports),
  };
};

export const buildGuardEventDetail = ({ table, operation, summary, reports }) => {
  if (!summary || (summary.warnings === 0 && summary.corrections === 0 && summary.blocking === 0)) {
    return null;
  }

  const firstWarning = reports.find((report) => report.warnings?.length > 0)?.warnings?.[0] || null;
  const firstCorrection = reports.find((report) => report.corrections?.length > 0)?.corrections?.[0] || null;
  const messageParts = [];

  if (firstCorrection?.message) {
    messageParts.push(firstCorrection.message);
  }

  if (firstWarning?.message) {
    messageParts.push(firstWarning.message);
  }

  return {
    table,
    operation,
    level: summary.blocking > 0 ? 'error' : summary.warnings > 0 ? 'warning' : 'info',
    summary,
    message: messageParts.join(' ') || 'Controle de saisie applique.',
  };
};
