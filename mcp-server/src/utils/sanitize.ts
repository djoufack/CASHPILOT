/**
 * Sanitize text to prevent XSS - adapted from src/hooks/useInvoices.js
 */
export function sanitizeText(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '');
}

/**
 * Escape XML special characters - from src/services/exportFacturX.js
 */
export function escapeXml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date to Factur-X format (YYYYMMDD)
 */
export function formatDateFacturX(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Format amount to 2 decimal places
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
}
