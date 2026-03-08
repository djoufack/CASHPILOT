/**
 * Validate required string parameter
 */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Parameter '${name}' is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validate optional string parameter
 */
export function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value).trim();
}

/**
 * Validate optional number parameter
 */
export function optionalNumber(value: unknown, defaultVal?: number): number | undefined {
  if (value === null || value === undefined || value === '') return defaultVal;
  const n = Number(value);
  if (isNaN(n)) return defaultVal;
  return n;
}

/**
 * Validate ISO date string (YYYY-MM-DD)
 */
export function validateDate(value: unknown, name: string): string {
  const s = requireString(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Parameter '${name}' must be a valid date (YYYY-MM-DD)`);
  }
  return s;
}

/**
 * Validate optional ISO date
 */
export function optionalDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return s;
}

/** Date-like field name suffixes for auto-detection */
const DATE_FIELD_PATTERNS = /^(date|due_date|start_date|end_date|date_borrowed|date_lent|order_date|expected_delivery_date|actual_delivery_date|booking_date|value_date|transaction_date|session_date|expense_date|statement_date|effective_date|next_date|invoice_date|expires_at|valid_until|period_start|period_end|last_sync_at)$/;

/**
 * Validate all date-like fields in a record.
 * Returns null if valid, or an error message string for the first invalid field.
 * Only validates fields that are present and non-empty.
 * Accepts both YYYY-MM-DD dates and ISO timestamps.
 */
export function validateDatesInRecord(record: Record<string, unknown>): string | null {
  const dateOrTimestamp = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
  for (const key of Object.keys(record)) {
    if (!DATE_FIELD_PATTERNS.test(key)) continue;
    const val = record[key];
    if (val === null || val === undefined || val === '') continue;
    if (typeof val !== 'string') continue;
    if (!dateOrTimestamp.test(val.trim())) {
      return `Parameter '${key}' must be a valid date (YYYY-MM-DD) or timestamp. Got: '${val}'`;
    }
  }
  return null;
}

/**
 * Validate all number-like fields that arrived as strings and coerce them.
 * Returns a new record with numeric strings converted to numbers where the field
 * is expected to be numeric (detected by the original schema using z.number()).
 */
export function coerceNumbers(record: Record<string, unknown>, numericFields: string[]): Record<string, unknown> {
  const result = { ...record };
  for (const field of numericFields) {
    const val = result[field];
    if (val === null || val === undefined || val === '') continue;
    if (typeof val === 'string') {
      const n = Number(val);
      if (!isNaN(n)) result[field] = n;
    }
  }
  return result;
}
