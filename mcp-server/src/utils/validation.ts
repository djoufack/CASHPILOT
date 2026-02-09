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
