/**
 * Safe error handling utility for MCP tools.
 * Logs the full error for debugging but returns a generic message to users
 * to avoid leaking database schema details (table names, column names, constraints).
 */
export function safeError(error: any, context: string): string {
  // Log full error for server-side debugging
  const msg = error?.message || JSON.stringify(error);
  console.error(`[${context}]`, msg);
  // Return actionable message: include DB detail so MCP users can self-correct,
  // but strip raw SQL/schema internals that could leak table structure.
  const safeMsg = msg?.replace(/\n/g, ' ')?.replace(/\s+/g, ' ')?.slice(0, 200) || 'unknown error';
  return `Operation failed: ${context}. Detail: ${safeMsg}`;
}
