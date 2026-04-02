// Structured request logger for CashPilot Edge Functions
// Logs: timestamp, method, path, user_id (if available), status, duration_ms
// Safety: never logs auth headers, tokens, passwords, or request body content.

export interface RequestLog {
  timestamp: string;
  method: string;
  path: string;
  user_id?: string;
  status: number;
  duration_ms: number;
  error?: string;
}

export function logRequest(log: RequestLog): void {
  // Sanitize: never log auth headers, tokens, or body content
  console.log(
    JSON.stringify({
      level: log.status >= 500 ? 'error' : log.status >= 400 ? 'warn' : 'info',
      ...log,
    })
  );
}

export function createRequestLogger(req: Request, userId?: string) {
  const start = Date.now();
  const url = new URL(req.url);

  return {
    done: (status: number, error?: string) => {
      logRequest({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: url.pathname,
        user_id: userId,
        status,
        duration_ms: Date.now() - start,
        ...(error ? { error: error.slice(0, 200) } : {}),
      });
    },
  };
}
