export const DEFAULT_SCRADA_TIMEOUT_MS = 15_000;

export const parseScradaTimeoutMs = (raw: string | null | undefined) => {
  const parsed = Number(raw ?? DEFAULT_SCRADA_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SCRADA_TIMEOUT_MS;
  }
  return Math.floor(parsed);
};

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Scrada request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
