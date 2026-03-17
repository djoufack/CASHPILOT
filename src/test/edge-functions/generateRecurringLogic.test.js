import { describe, it, expect } from 'vitest';

// ============================================================================
// Business logic extracted from supabase/functions/generate-recurring/index.ts
// Tests: date validation, result filtering/classification, RPC param building,
// HTTP status resolution, error code mapping.
// ============================================================================

// ---------- Date validation (pattern from edge function) ----------

function isValidDateFormat(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// ---------- Result classification (logic from edge function) ----------

function classifyResults(results) {
  const generated = results.filter((r) => r.status === 'generated');
  const skipped = results.filter((r) => r.status === 'skipped_duplicate');
  const errors = results.filter((r) => r.status !== 'generated' && r.status !== 'skipped_duplicate');
  return { generated, skipped, errors };
}

// ---------- HTTP status resolution (logic from edge function) ----------

function resolveHttpStatus(generated, errors) {
  if (errors.length > 0 && generated.length > 0) return 207; // Multi-Status
  if (errors.length > 0 && generated.length === 0) return 500;
  return 200;
}

// ---------- RPC params builder (logic from edge function) ----------

function buildRpcParams(today, limit) {
  const params = { p_today: today };
  if (limit !== undefined && Number.isInteger(limit) && limit > 0) {
    params.p_limit = limit;
  }
  return params;
}

// ---------- Error status code mapping (logic from edge function) ----------

function mapErrorCode(pgCode) {
  if (pgCode === '42501') return 403; // insufficient privilege
  if (pgCode === '42883') return 501; // function not found
  return 500;
}

// ---------- Today default computation ----------

function getDefaultToday() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// Date validation
// ============================================================================
describe('generate-recurring: date validation', () => {
  it('accepts valid YYYY-MM-DD format', () => {
    expect(isValidDateFormat('2026-03-16')).toBe(true);
  });

  it('accepts January 1st', () => {
    expect(isValidDateFormat('2026-01-01')).toBe(true);
  });

  it('accepts December 31st', () => {
    expect(isValidDateFormat('2026-12-31')).toBe(true);
  });

  it('rejects ISO datetime format', () => {
    expect(isValidDateFormat('2026-03-16T12:00:00Z')).toBe(false);
  });

  it('rejects DD/MM/YYYY format', () => {
    expect(isValidDateFormat('16/03/2026')).toBe(false);
  });

  it('rejects MM-DD-YYYY format', () => {
    expect(isValidDateFormat('03-16-2026')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidDateFormat('')).toBe(false);
  });

  it('rejects plain text', () => {
    expect(isValidDateFormat('today')).toBe(false);
  });

  it('rejects partial date', () => {
    expect(isValidDateFormat('2026-03')).toBe(false);
  });

  it('produces a valid format from getDefaultToday()', () => {
    const today = getDefaultToday();
    expect(isValidDateFormat(today)).toBe(true);
  });
});

// ============================================================================
// Result classification
// ============================================================================
describe('generate-recurring: result classification', () => {
  it('correctly separates generated, skipped, and errored results', () => {
    const results = [
      { id: '1', status: 'generated' },
      { id: '2', status: 'generated' },
      { id: '3', status: 'skipped_duplicate' },
      { id: '4', status: 'error_missing_template' },
      { id: '5', status: 'generated' },
    ];
    const { generated, skipped, errors } = classifyResults(results);
    expect(generated).toHaveLength(3);
    expect(skipped).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it('handles all generated results', () => {
    const results = [
      { id: '1', status: 'generated' },
      { id: '2', status: 'generated' },
    ];
    const { generated, skipped, errors } = classifyResults(results);
    expect(generated).toHaveLength(2);
    expect(skipped).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('handles all skipped results', () => {
    const results = [
      { id: '1', status: 'skipped_duplicate' },
      { id: '2', status: 'skipped_duplicate' },
    ];
    const { generated, skipped, errors } = classifyResults(results);
    expect(generated).toHaveLength(0);
    expect(skipped).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('handles all error results', () => {
    const results = [
      { id: '1', status: 'error_invalid_amount' },
      { id: '2', status: 'error_missing_client' },
    ];
    const { generated, skipped, errors } = classifyResults(results);
    expect(generated).toHaveLength(0);
    expect(skipped).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });

  it('handles empty results array', () => {
    const { generated, skipped, errors } = classifyResults([]);
    expect(generated).toHaveLength(0);
    expect(skipped).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// HTTP status resolution
// ============================================================================
describe('generate-recurring: HTTP status resolution', () => {
  it('returns 200 when all succeed', () => {
    expect(resolveHttpStatus([{ id: 1 }], [])).toBe(200);
  });

  it('returns 200 when generated is empty and errors is empty', () => {
    expect(resolveHttpStatus([], [])).toBe(200);
  });

  it('returns 207 when some succeed and some fail (Multi-Status)', () => {
    expect(resolveHttpStatus([{ id: 1 }], [{ id: 2 }])).toBe(207);
  });

  it('returns 500 when all fail (no successes)', () => {
    expect(resolveHttpStatus([], [{ id: 1 }, { id: 2 }])).toBe(500);
  });
});

// ============================================================================
// RPC params builder
// ============================================================================
describe('generate-recurring: RPC params builder', () => {
  it('always includes p_today', () => {
    const params = buildRpcParams('2026-03-16', undefined);
    expect(params).toEqual({ p_today: '2026-03-16' });
  });

  it('includes p_limit when valid positive integer', () => {
    const params = buildRpcParams('2026-03-16', 50);
    expect(params).toEqual({ p_today: '2026-03-16', p_limit: 50 });
  });

  it('excludes p_limit when zero', () => {
    const params = buildRpcParams('2026-03-16', 0);
    expect(params).toEqual({ p_today: '2026-03-16' });
  });

  it('excludes p_limit when negative', () => {
    const params = buildRpcParams('2026-03-16', -5);
    expect(params).toEqual({ p_today: '2026-03-16' });
  });

  it('excludes p_limit when not an integer', () => {
    const params = buildRpcParams('2026-03-16', 3.5);
    expect(params).toEqual({ p_today: '2026-03-16' });
  });

  it('excludes p_limit when undefined', () => {
    const params = buildRpcParams('2026-03-16', undefined);
    expect(params.p_limit).toBeUndefined();
  });
});

// ============================================================================
// PostgreSQL error code mapping
// ============================================================================
describe('generate-recurring: PG error code mapping', () => {
  it('maps 42501 (insufficient privilege) to 403', () => {
    expect(mapErrorCode('42501')).toBe(403);
  });

  it('maps 42883 (function not found) to 501', () => {
    expect(mapErrorCode('42883')).toBe(501);
  });

  it('maps unknown codes to 500', () => {
    expect(mapErrorCode('23505')).toBe(500);
    expect(mapErrorCode('P0001')).toBe(500);
    expect(mapErrorCode(undefined)).toBe(500);
  });
});

// ============================================================================
// Response body structure validation
// ============================================================================
describe('generate-recurring: response body structure', () => {
  function buildSuccessResponse(today, results, elapsedMs) {
    const { generated, skipped, errors } = classifyResults(results);
    return {
      success: errors.length === 0,
      date: today,
      generated: generated.length,
      skipped: skipped.length,
      errors: errors.length,
      elapsed_ms: elapsedMs,
      results,
    };
  }

  it('reports success=true when no errors', () => {
    const response = buildSuccessResponse('2026-03-16', [{ id: 1, status: 'generated' }], 120);
    expect(response.success).toBe(true);
    expect(response.generated).toBe(1);
    expect(response.errors).toBe(0);
  });

  it('reports success=false when errors exist', () => {
    const response = buildSuccessResponse('2026-03-16', [{ id: 1, status: 'error_fail' }], 50);
    expect(response.success).toBe(false);
    expect(response.errors).toBe(1);
  });

  it('includes elapsed_ms', () => {
    const response = buildSuccessResponse('2026-03-16', [], 250);
    expect(response.elapsed_ms).toBe(250);
  });

  it('includes the date from input', () => {
    const response = buildSuccessResponse('2025-12-01', [], 10);
    expect(response.date).toBe('2025-12-01');
  });
});
