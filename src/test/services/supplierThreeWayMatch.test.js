import { describe, expect, it } from 'vitest';

import {
  computeThreeWayMatchStatus,
  deriveThreeWayMatchMetrics,
  getThreeWayMatchPresentation,
  normalizeThreeWayMatchStatus,
} from '@/services/supplierThreeWayMatch';

describe('supplierThreeWayMatch', () => {
  it('normalizes unknown status to unmatched', () => {
    expect(normalizeThreeWayMatchStatus('foo')).toBe('unmatched');
    expect(normalizeThreeWayMatchStatus(null)).toBe('unmatched');
  });

  it('keeps supported statuses', () => {
    expect(normalizeThreeWayMatchStatus('matched')).toBe('matched');
    expect(normalizeThreeWayMatchStatus('mismatch')).toBe('mismatch');
    expect(normalizeThreeWayMatchStatus('partial')).toBe('partial');
    expect(normalizeThreeWayMatchStatus('pending')).toBe('pending');
    expect(normalizeThreeWayMatchStatus('unmatched')).toBe('unmatched');
  });

  it('computes matched status when deltas are within tolerance', () => {
    const status = computeThreeWayMatchStatus({
      hasLinkedOrder: true,
      orderStatus: 'received',
      amountVariance: 0.004,
      quantityVariance: 0.004,
      amountTolerance: 0.01,
      quantityTolerance: 0.01,
    });

    expect(status).toBe('matched');
  });

  it('computes partial status when order is partially received', () => {
    const status = computeThreeWayMatchStatus({
      hasLinkedOrder: true,
      orderStatus: 'partially_received',
      amountVariance: 0,
      quantityVariance: 0,
      amountTolerance: 0.01,
      quantityTolerance: 0.01,
    });

    expect(status).toBe('partial');
  });

  it('computes mismatch status when deltas exceed tolerance', () => {
    const status = computeThreeWayMatchStatus({
      hasLinkedOrder: true,
      orderStatus: 'received',
      amountVariance: 25,
      quantityVariance: 2,
      amountTolerance: 0.01,
      quantityTolerance: 0.01,
    });

    expect(status).toBe('mismatch');
  });

  it('derives normalized numeric metrics with defaults', () => {
    expect(
      deriveThreeWayMatchMetrics({
        orderedTotalAmount: '100.50',
        receivedTotalAmount: null,
        invoicedTotalAmount: undefined,
        amountVariance: '2.5',
        orderedTotalQuantity: '10',
        receivedTotalQuantity: '8',
        invoicedTotalQuantity: null,
        quantityVariance: '2',
        status: 'mismatch',
      })
    ).toEqual({
      orderedTotalAmount: 100.5,
      receivedTotalAmount: 0,
      invoicedTotalAmount: 0,
      amountVariance: 2.5,
      orderedTotalQuantity: 10,
      receivedTotalQuantity: 8,
      invoicedTotalQuantity: 0,
      quantityVariance: 2,
      status: 'mismatch',
    });
  });

  it('returns a presentation payload for each status', () => {
    expect(getThreeWayMatchPresentation('matched').tone).toBe('success');
    expect(getThreeWayMatchPresentation('mismatch').tone).toBe('danger');
    expect(getThreeWayMatchPresentation('partial').tone).toBe('warning');
    expect(getThreeWayMatchPresentation('pending').tone).toBe('info');
    expect(getThreeWayMatchPresentation('unmatched').tone).toBe('muted');
    expect(getThreeWayMatchPresentation('unknown').tone).toBe('muted');
  });
});
