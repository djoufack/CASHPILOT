
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useSupplierReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    spending: [],
    orders: [],
    delivery: [],
    products: []
  });

  const generateReports = async (period = 'month', supplierId = null) => {
    if (!user) return;
    setLoading(true);
    try {
      // Mocking complex aggregation logic which usually happens on backend or requires many queries
      // In a real app, this would be an Edge Function.
      // Here we will fetch raw data and aggregate in JS for demonstration.
      
      let query = supabase.from('supplier_orders').select('*, items:supplier_order_items(*)');
      
      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }
      
      const { data: orders, error } = await query;
      
      if (error) throw error;
      
      // 1. Spending over time
      const spendingMap = {};
      orders.forEach(o => {
        const date = o.order_date?.split('T')[0] || o.created_at.split('T')[0];
        const month = date.substring(0, 7); // YYYY-MM
        spendingMap[month] = (spendingMap[month] || 0) + (o.total_amount || 0);
      });
      
      const spending = Object.entries(spendingMap).map(([date, amount]) => ({ date, amount }));
      
      // 2. Orders count
      const ordersCount = orders.length;
      
      // 3. Delivery Performance (Mocked as we might not have actual_delivery_date populated often)
      const delivery = orders.filter(o => o.actual_delivery_date).map(o => {
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
        totalSpent: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        delivery
      });

    } catch (err) {
      console.error("Report generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    reportData,
    generateReports
  };
};
