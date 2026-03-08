/**
 * Safe error handling utility for MCP tools.
 * Logs the full error for debugging but returns a generic message to users
 * to avoid leaking database schema details (table names, column names, constraints).
 */
export function safeError(error: any, context: string): string {
  // Log full error for server-side debugging
  console.error(`[${context}]`, error?.message || error);
  // Return generic message to user — no raw DB details
  return `Operation failed: ${context}. Please try again or check your input.`;
}
