
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useSupplierReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState({
    spending: [],
    orders: [],
    delivery: [],
    products: [],
    ordersCount: 0,
    totalSpent: 0
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
        .select('id, supplier_id, order_number, order_date, expected_delivery_date, actual_delivery_date, total_amount, created_at');

      let invoicesQuery = supabase
        .from('supplier_invoices')
        .select('id, supplier_id, invoice_number, invoice_date, total_amount, total_ttc, created_at');

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
        const amount = entry.total_amount || entry.total_ttc || 0;
        spendingMap[month] = (spendingMap[month] || 0) + amount;
      });

      const spending = Object.entries(spendingMap)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 2. Orders count
      const ordersCount = safeOrders.length;

      // 3. Delivery Performance (Mocked as we might not have actual_delivery_date populated often)
      const delivery = safeOrders.filter(o => o.actual_delivery_date).map(o => {
          const expected = new Date(o.expected_delivery_date);
          const actual = new Date(o.actual_delivery_date);
          const diffTime = Math.abs(actual - expected);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          return {
             order: o.order_number,
             daysLate: actual > expected ? diffDays : 0,
             daysEarly: actual < expected ? diffDays : 0
          };
      });

      setReportData({
        spending,
        ordersCount,
        totalSpent: spendingSource.reduce((sum, entry) => sum + (entry.total_amount || entry.total_ttc || 0), 0),
        orders: safeOrders,
        delivery
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
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    error,
    reportData,
    generateReports
  };
};
