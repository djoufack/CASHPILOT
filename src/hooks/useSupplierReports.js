
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const toDateOnly = (value) => {
  if (!value) return null;

  const rawDate = value.includes('T') ? value.split('T')[0] : value;
  const parsed = new Date(`${rawDate}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const useSupplierReports = () => {
  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState({
    spending: [],
    orders: [],
    delivery: [],
    products: [],
    ordersCount: 0,
    totalSpent: 0,
    onTimeRate: 0,
  });

  const generateReports = useCallback(async (period = 'month', supplierId = null) => {
    if (!user) {
      setReportData({
        spending: [],
        orders: [],
        delivery: [],
        products: [],
        ordersCount: 0,
        totalSpent: 0,
        onTimeRate: 0,
      });
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let ordersQuery = supabase
        .from('supplier_orders')
        .select('id, supplier_id, order_number, order_date, expected_delivery_date, actual_delivery_date, order_status, total_amount, created_at');

      let invoicesQuery = supabase
        .from('supplier_invoices')
        .select('id, supplier_id, invoice_number, invoice_date, total_amount, total_ttc, created_at');

      ordersQuery = applyCompanyScope(ordersQuery);
      invoicesQuery = applyCompanyScope(invoicesQuery);

      if (supplierId) {
        ordersQuery = ordersQuery.eq('supplier_id', supplierId);
        invoicesQuery = invoicesQuery.eq('supplier_id', supplierId);
      }

      const [
        { data: orders, error: ordersError },
        { data: invoices, error: invoicesError },
      ] = await Promise.all([ordersQuery, invoicesQuery]);

      if (ordersError) {
        console.warn('Supplier orders unavailable for reports:', ordersError.message);
      }

      if (invoicesError) {
        console.warn('Supplier invoices unavailable for reports:', invoicesError.message);
      }

      if (ordersError && invoicesError) {
        throw ordersError;
      }

      const safeOrders = orders || [];
      const safeInvoices = invoices || [];
      const spendingSource = safeInvoices.length > 0 ? safeInvoices : safeOrders;

      // 1. Spending over time
      const spendingMap = {};
      spendingSource.forEach((entry) => {
        const date =
          entry.invoice_date?.split('T')[0] ||
          entry.order_date?.split('T')[0] ||
          entry.created_at?.split('T')[0];

        if (!date) return;

        const month = date.substring(0, 7); // YYYY-MM
        const amount = Number(entry.total_amount || entry.total_ttc || 0);
        spendingMap[month] = (spendingMap[month] || 0) + amount;
      });

      const spending = Object.entries(spendingMap)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 2. Orders count
      const ordersCount = safeOrders.length;

      // 3. Delivery Performance
      let onTimeCount = 0;
      const delivery = safeOrders
        .filter((order) => order.actual_delivery_date && order.expected_delivery_date)
        .map((order) => {
          const expected = toDateOnly(order.expected_delivery_date);
          const actual = toDateOnly(order.actual_delivery_date);

          if (!expected || !actual) {
            return null;
          }

          const varianceDays = Math.round((actual.getTime() - expected.getTime()) / DAY_IN_MS);
          let timing = 'onTime';

          if (varianceDays < 0) {
            timing = 'early';
          } else if (varianceDays > 0) {
            timing = 'late';
          } else {
            onTimeCount += 1;
          }

          return {
            order: order.order_number,
            varianceDays,
            timing,
          };
        })
        .filter(Boolean);

      const onTimeRate = delivery.length > 0
        ? Math.round((onTimeCount / delivery.length) * 100)
        : 0;

      setReportData({
        spending,
        ordersCount,
        totalSpent: spendingSource.reduce(
          (sum, entry) => sum + Number(entry.total_amount || entry.total_ttc || 0),
          0,
        ),
        orders: safeOrders,
        delivery,
        onTimeRate,
        products: [],
      });

    } catch (err) {
      console.error("Report generation failed:", err);
      setError(err.message || 'Failed to generate reports');
      setReportData({
        spending: [],
        orders: [],
        delivery: [],
        products: [],
        ordersCount: 0,
        totalSpent: 0,
        onTimeRate: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user]);

  return {
    loading,
    error,
    reportData,
    generateReports
  };
};
