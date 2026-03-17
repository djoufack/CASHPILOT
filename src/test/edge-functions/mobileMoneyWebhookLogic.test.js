import { describe, it, expect } from 'vitest';

// ============================================================================
// Business logic extracted from supabase/functions/mobile-money-webhook/index.ts
// Tests: status mapping, input validation, webhook processing flow
// ============================================================================

// ---------- mapProviderStatus (exact copy from edge function) ----------

function mapProviderStatus(providerStatus) {
  const statusMap = {
    SUCCESS: 'completed',
    SUCCESSFUL: 'completed',
    COMPLETED: 'completed',
    PAID: 'completed',
    FAILED: 'failed',
    DECLINED: 'failed',
    ERROR: 'failed',
    CANCELLED: 'failed',
    PENDING: 'processing',
    PROCESSING: 'processing',
    REFUNDED: 'refunded',
  };
  return statusMap[providerStatus.toUpperCase()] ?? 'processing';
}

// ---------- Input validation (logic from handler) ----------

function validateWebhookPayload(body) {
  const errors = [];
  if (!body.external_ref) errors.push('external_ref');
  if (!body.status) errors.push('status');
  return { valid: errors.length === 0, missingFields: errors };
}

// ---------- Finalized status check ----------

function isTransactionFinalized(status) {
  return status === 'completed' || status === 'refunded';
}

// ============================================================================
// mapProviderStatus()
// ============================================================================
describe('mobile-money-webhook: mapProviderStatus()', () => {
  it('maps SUCCESS to completed', () => {
    expect(mapProviderStatus('SUCCESS')).toBe('completed');
  });

  it('maps SUCCESSFUL to completed', () => {
    expect(mapProviderStatus('SUCCESSFUL')).toBe('completed');
  });

  it('maps COMPLETED to completed', () => {
    expect(mapProviderStatus('COMPLETED')).toBe('completed');
  });

  it('maps PAID to completed', () => {
    expect(mapProviderStatus('PAID')).toBe('completed');
  });

  it('maps FAILED to failed', () => {
    expect(mapProviderStatus('FAILED')).toBe('failed');
  });

  it('maps DECLINED to failed', () => {
    expect(mapProviderStatus('DECLINED')).toBe('failed');
  });

  it('maps ERROR to failed', () => {
    expect(mapProviderStatus('ERROR')).toBe('failed');
  });

  it('maps CANCELLED to failed', () => {
    expect(mapProviderStatus('CANCELLED')).toBe('failed');
  });

  it('maps PENDING to processing', () => {
    expect(mapProviderStatus('PENDING')).toBe('processing');
  });

  it('maps PROCESSING to processing', () => {
    expect(mapProviderStatus('PROCESSING')).toBe('processing');
  });

  it('maps REFUNDED to refunded', () => {
    expect(mapProviderStatus('REFUNDED')).toBe('refunded');
  });

  it('defaults unknown statuses to processing', () => {
    expect(mapProviderStatus('UNKNOWN')).toBe('processing');
    expect(mapProviderStatus('WAITING')).toBe('processing');
    expect(mapProviderStatus('IN_PROGRESS')).toBe('processing');
  });

  it('handles case-insensitive input', () => {
    expect(mapProviderStatus('success')).toBe('completed');
    expect(mapProviderStatus('Success')).toBe('completed');
    expect(mapProviderStatus('failed')).toBe('failed');
  });
});

// ============================================================================
// Webhook payload validation
// ============================================================================
describe('mobile-money-webhook: payload validation', () => {
  it('accepts valid payload with external_ref and status', () => {
    const result = validateWebhookPayload({
      external_ref: 'TXN-12345',
      status: 'SUCCESS',
      provider: 'orange',
    });
    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('rejects payload missing external_ref', () => {
    const result = validateWebhookPayload({ status: 'SUCCESS' });
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('external_ref');
  });

  it('rejects payload missing status', () => {
    const result = validateWebhookPayload({ external_ref: 'TXN-12345' });
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('status');
  });

  it('rejects completely empty payload', () => {
    const result = validateWebhookPayload({});
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('external_ref');
    expect(result.missingFields).toContain('status');
  });
});

// ============================================================================
// Transaction finalization guard
// ============================================================================
describe('mobile-money-webhook: transaction finalization guard', () => {
  it('considers completed transactions as finalized', () => {
    expect(isTransactionFinalized('completed')).toBe(true);
  });

  it('considers refunded transactions as finalized', () => {
    expect(isTransactionFinalized('refunded')).toBe(true);
  });

  it('does not consider processing transactions as finalized', () => {
    expect(isTransactionFinalized('processing')).toBe(false);
  });

  it('does not consider failed transactions as finalized', () => {
    expect(isTransactionFinalized('failed')).toBe(false);
  });

  it('does not consider pending transactions as finalized', () => {
    expect(isTransactionFinalized('pending')).toBe(false);
  });
});

// ============================================================================
// Payment record creation logic
// ============================================================================
describe('mobile-money-webhook: payment record creation', () => {
  function buildPaymentRecord(transaction, invoice, externalRef, provider) {
    return {
      user_id: transaction.user_id,
      company_id: transaction.company_id,
      invoice_id: transaction.invoice_id,
      client_id: invoice.client_id,
      amount: transaction.amount,
      payment_method: `mobile_money_${provider ?? 'unknown'}`,
      payment_date: new Date().toISOString().split('T')[0],
      reference: externalRef,
      notes: `Mobile Money webhook callback - ${externalRef}`,
    };
  }

  it('builds correct payment record with known provider', () => {
    const txn = { user_id: 'u1', company_id: 'c1', invoice_id: 'inv1', amount: 5000 };
    const inv = { client_id: 'cl1' };
    const record = buildPaymentRecord(txn, inv, 'REF-001', 'orange');

    expect(record.user_id).toBe('u1');
    expect(record.company_id).toBe('c1');
    expect(record.invoice_id).toBe('inv1');
    expect(record.client_id).toBe('cl1');
    expect(record.amount).toBe(5000);
    expect(record.payment_method).toBe('mobile_money_orange');
    expect(record.reference).toBe('REF-001');
  });

  it('defaults to "unknown" provider when not specified', () => {
    const txn = { user_id: 'u1', company_id: 'c1', invoice_id: 'inv1', amount: 1000 };
    const inv = { client_id: 'cl1' };
    const record = buildPaymentRecord(txn, inv, 'REF-002', undefined);

    expect(record.payment_method).toBe('mobile_money_unknown');
  });

  it('includes the external reference in notes', () => {
    const txn = { user_id: 'u1', company_id: 'c1', invoice_id: 'inv1', amount: 1000 };
    const inv = { client_id: 'cl1' };
    const record = buildPaymentRecord(txn, inv, 'MMO-XYZ-789', 'mtn');

    expect(record.notes).toContain('MMO-XYZ-789');
  });
});

// ============================================================================
// Transaction update logic
// ============================================================================
describe('mobile-money-webhook: transaction update fields', () => {
  function buildTransactionUpdate(mappedStatus, errorMessage, body) {
    return {
      status: mappedStatus,
      error_message: errorMessage ?? null,
      completed_at: mappedStatus === 'completed' ? new Date().toISOString() : null,
      metadata: { ...body, webhook_received_at: new Date().toISOString() },
    };
  }

  it('sets completed_at for completed status', () => {
    const update = buildTransactionUpdate('completed', null, { status: 'SUCCESS' });
    expect(update.completed_at).not.toBeNull();
    expect(update.error_message).toBeNull();
  });

  it('does not set completed_at for failed status', () => {
    const update = buildTransactionUpdate('failed', 'Insufficient funds', { status: 'FAILED' });
    expect(update.completed_at).toBeNull();
    expect(update.error_message).toBe('Insufficient funds');
  });

  it('does not set completed_at for processing status', () => {
    const update = buildTransactionUpdate('processing', null, { status: 'PENDING' });
    expect(update.completed_at).toBeNull();
  });

  it('includes webhook_received_at in metadata', () => {
    const update = buildTransactionUpdate('completed', null, { status: 'SUCCESS', provider: 'wave' });
    expect(update.metadata).toHaveProperty('webhook_received_at');
    expect(update.metadata.provider).toBe('wave');
  });
});
