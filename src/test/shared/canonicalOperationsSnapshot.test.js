import { describe, expect, it } from 'vitest';
import {
  buildCanonicalOperationsSnapshot,
  EMPTY_CANONICAL_OPERATIONS_SNAPSHOT,
} from '@/shared/canonicalOperationsSnapshot';

describe('canonicalOperationsSnapshot', () => {
  it('computes supplier and purchase amounts from canonical fallbacks', () => {
    const snapshot = buildCanonicalOperationsSnapshot({
      suppliers: [
        { id: 'sup-1', status: 'active' },
        { id: 'sup-2', status: 'inactive' },
      ],
      products: [
        { id: 'prod-1', stock_quantity: 5, min_stock_level: 10 },
        { id: 'prod-2', stock_quantity: 0, min_stock_level: 1 },
      ],
      supplierOrders: [
        { id: 'ord-1', order_status: 'pending', total_amount: 500 },
        { id: 'ord-2', order_status: 'received', total_ttc: 220 },
        { id: 'ord-3', order_status: 'cancelled', amount: 80 },
      ],
      supplierInvoices: [
        { id: 'sinv-1', payment_status: 'overdue', total_amount: 300 },
        { id: 'sinv-2', payment_status: 'pending', total_ttc: 120 },
        { id: 'sinv-3', payment_status: 'paid', amount: 50 },
      ],
    });

    expect(snapshot.suppliers.totalSuppliers).toBe(2);
    expect(snapshot.suppliers.activeSuppliers).toBe(1);
    expect(snapshot.suppliers.inactiveSuppliers).toBe(1);
    expect(snapshot.suppliers.lowStockProducts).toBe(2);
    expect(snapshot.suppliers.outOfStockProducts).toBe(1);
    expect(snapshot.suppliers.overdueInvoices).toBe(1);
    expect(snapshot.suppliers.overdueInvoicesAmount).toBe(300);

    expect(snapshot.purchases.totalOrders).toBe(3);
    expect(snapshot.purchases.totalAmount).toBe(800);
    expect(snapshot.purchases.openOrdersCount).toBe(1);
    expect(snapshot.purchases.openOrdersAmount).toBe(500);
    expect(snapshot.purchases.deliveredOrders).toBe(1);
    expect(snapshot.purchases.deliveredAmount).toBe(220);
    expect(snapshot.purchases.cancelledOrders).toBe(1);
    expect(snapshot.purchases.cancelledAmount).toBe(80);
  });

  it('counts only syncable bank connections in total balance', () => {
    const snapshot = buildCanonicalOperationsSnapshot({
      bankConnections: [
        { id: 'b-1', status: 'active', account_id: 'a-1', account_balance: 1000, account_currency: 'EUR' },
        { id: 'b-2', status: 'active', account_id: null, account_balance: 400, account_currency: 'EUR' },
        { id: 'b-3', status: 'pending', account_id: 'a-3', account_balance: 300, account_currency: 'USD' },
      ],
    });

    expect(snapshot.bank.totalConnections).toBe(3);
    expect(snapshot.bank.activeConnections).toBe(2);
    expect(snapshot.bank.pendingConnections).toBe(1);
    expect(snapshot.bank.syncableConnections).toBe(1);
    expect(snapshot.bank.totalBalance).toBe(1000);
    expect(snapshot.bank.balanceCurrencies).toEqual(['EUR']);
    expect(snapshot.bank.syncableConnectionIds).toEqual(['b-1']);
  });

  it('covers zero-first-finite fallback amounts and unknown statuses', () => {
    const snapshot = buildCanonicalOperationsSnapshot({
      supplierOrders: [
        { id: 'ord-zero', order_status: null, total_amount: 0, total_ttc: null, total: null, amount: null },
      ],
      supplierInvoices: [
        { id: 'sinv-zero', payment_status: null, total_amount: 0, total_ttc: null, total: null, amount: null },
      ],
      bankConnections: [
        { id: 'b-active-eur', status: 'active', account_id: 'acc-eur', account_balance: 100, account_currency: 'eur' },
        { id: 'b-active-usd', status: 'active', account_id: 'acc-usd', account_balance: 50, account_currency: 'usd' },
        {
          id: 'b-active-null-balance',
          status: 'active',
          account_id: 'acc-null',
          account_balance: null,
          account_currency: 'eur',
        },
        { id: 'b-revoked', status: 'revoked', account_id: 'acc-r', account_balance: 10, account_currency: 'eur' },
        { id: 'b-expired', status: 'expired', account_id: 'acc-x', account_balance: 10, account_currency: 'eur' },
        { id: 'b-error', status: 'error', account_id: 'acc-e', account_balance: 10, account_currency: 'eur' },
      ],
    });

    expect(snapshot.purchases.totalAmount).toBe(0);
    expect(snapshot.purchases.statusCounts.unknown).toBe(1);
    expect(snapshot.suppliers.supplierInvoices.totalAmount).toBe(0);
    expect(snapshot.suppliers.supplierInvoices.statusCounts.unknown).toBe(1);

    expect(snapshot.bank.totalConnections).toBe(6);
    expect(snapshot.bank.revokedConnections).toBe(1);
    expect(snapshot.bank.expiredConnections).toBe(1);
    expect(snapshot.bank.errorConnections).toBe(1);
    expect(snapshot.bank.syncableConnections).toBe(3);
    expect(snapshot.bank.balanceByCurrency).toEqual({ EUR: 100, USD: 50 });
    expect(snapshot.bank.balanceCurrencies).toEqual(['EUR', 'USD']);
    expect(snapshot.bank.hasMixedCurrencies).toBe(true);
    expect(snapshot.bank.syncableConnectionIds).toEqual(['b-active-eur', 'b-active-usd', 'b-active-null-balance']);
  });

  it('returns canonical empty shape when called without input', () => {
    const snapshot = buildCanonicalOperationsSnapshot();
    expect(snapshot).toEqual(EMPTY_CANONICAL_OPERATIONS_SNAPSHOT);
  });
});
