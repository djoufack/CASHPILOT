import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Hoisted mock for activeCompanyId ───────────────────────────────────────
const { mockActiveCompanyId } = vi.hoisted(() => ({
  mockActiveCompanyId: { current: 'comp-1' },
}));

vi.mock('@/hooks/useActiveCompanyId', () => ({
  useActiveCompanyId: vi.fn(() => mockActiveCompanyId.current),
}));

// ── Import under test ──────────────────────────────────────────────────────
import { useCompanyScope } from '@/hooks/useCompanyScope';

describe('useCompanyScope', () => {
  beforeEach(() => {
    mockActiveCompanyId.current = 'comp-1';
  });

  it('returns activeCompanyId, applyCompanyScope, and withCompanyScope', () => {
    const { result } = renderHook(() => useCompanyScope());

    expect(result.current.activeCompanyId).toBe('comp-1');
    expect(typeof result.current.applyCompanyScope).toBe('function');
    expect(typeof result.current.withCompanyScope).toBe('function');
  });

  // ---------- applyCompanyScope ----------

  it('applyCompanyScope adds eq filter to query', () => {
    const { result } = renderHook(() => useCompanyScope());

    const mockQuery = { eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis() };
    const scoped = result.current.applyCompanyScope(mockQuery);

    expect(mockQuery.eq).toHaveBeenCalledWith('company_id', 'comp-1');
    expect(scoped).toBe(mockQuery);
  });

  it('applyCompanyScope uses custom column name', () => {
    const { result } = renderHook(() => useCompanyScope());

    const mockQuery = { eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis() };
    result.current.applyCompanyScope(mockQuery, { column: 'org_id' });

    expect(mockQuery.eq).toHaveBeenCalledWith('org_id', 'comp-1');
  });

  it('applyCompanyScope with includeUnassigned uses or filter', () => {
    const { result } = renderHook(() => useCompanyScope());

    const mockQuery = { eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis() };
    result.current.applyCompanyScope(mockQuery, { includeUnassigned: true });

    expect(mockQuery.or).toHaveBeenCalledWith('company_id.is.null,company_id.eq.comp-1');
  });

  it('applyCompanyScope returns query unchanged when no activeCompanyId', () => {
    mockActiveCompanyId.current = null;

    const { result } = renderHook(() => useCompanyScope());

    const mockQuery = { eq: vi.fn(), or: vi.fn() };
    const scoped = result.current.applyCompanyScope(mockQuery);

    expect(mockQuery.eq).not.toHaveBeenCalled();
    expect(mockQuery.or).not.toHaveBeenCalled();
    expect(scoped).toBe(mockQuery);
  });

  // ---------- withCompanyScope ----------

  it('withCompanyScope adds company_id to payload', () => {
    const { result } = renderHook(() => useCompanyScope());

    const payload = { amount: 100 };
    const scoped = result.current.withCompanyScope(payload);

    expect(scoped).toEqual({ amount: 100, company_id: 'comp-1' });
  });

  it('withCompanyScope does not overwrite existing company_id', () => {
    const { result } = renderHook(() => useCompanyScope());

    const payload = { amount: 100, company_id: 'existing-id' };
    const scoped = result.current.withCompanyScope(payload);

    expect(scoped.company_id).toBe('existing-id');
  });

  it('withCompanyScope uses custom column name', () => {
    const { result } = renderHook(() => useCompanyScope());

    const payload = { amount: 100 };
    const scoped = result.current.withCompanyScope(payload, { column: 'org_id' });

    expect(scoped.org_id).toBe('comp-1');
    expect(scoped.company_id).toBeUndefined();
  });

  it('withCompanyScope returns payload unchanged when no activeCompanyId', () => {
    mockActiveCompanyId.current = null;

    const { result } = renderHook(() => useCompanyScope());

    const payload = { amount: 100 };
    const scoped = result.current.withCompanyScope(payload);

    expect(scoped).toEqual({ amount: 100 });
    expect(scoped.company_id).toBeUndefined();
  });

  it('withCompanyScope handles empty payload', () => {
    const { result } = renderHook(() => useCompanyScope());

    const scoped = result.current.withCompanyScope();

    expect(scoped).toEqual({ company_id: 'comp-1' });
  });
});
