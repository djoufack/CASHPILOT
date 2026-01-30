
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Package, ShoppingCart, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="bg-gray-800 border-gray-700 shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </CardContent>
  </Card>
);

const SupplierStats = () => {
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    totalProducts: 0,
    lowStock: 0,
    pendingOrders: 0,
    overdueInvoices: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      // 1. Suppliers
      const { count: suppliersCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
      
      // 2. Products & Low Stock
      const { data: products } = await supabase.from('supplier_products').select('stock_quantity, min_stock_level');
      const totalProducts = products?.length || 0;
      const lowStock = products?.filter(p => p.stock_quantity <= p.min_stock_level).length || 0;

      // 3. Pending Orders
      const { count: pendingOrders } = await supabase.from('supplier_orders').select('*', { count: 'exact', head: true }).eq('order_status', 'pending');

      // 4. Overdue Invoices (rough check on status, ideally check due_date too)
      const { count: overdueInvoices } = await supabase.from('supplier_invoices').select('*', { count: 'exact', head: true }).eq('payment_status', 'overdue');

      setStats({
        totalSuppliers: suppliersCount || 0,
        totalProducts,
        lowStock,
        pendingOrders: pendingOrders || 0,
        overdueInvoices: overdueInvoices || 0
      });
    };

    fetchStats();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
      <StatCard 
        title="Total Suppliers" 
        value={stats.totalSuppliers} 
        icon={Users} 
        color="text-blue-500" 
      />
      <StatCard 
        title="Total Products" 
        value={stats.totalProducts} 
        icon={Package} 
        color="text-green-500" 
      />
      <StatCard 
        title="Low Stock Items" 
        value={stats.lowStock} 
        icon={AlertTriangle} 
        color="text-red-500" 
        subtext="Requires attention"
      />
      <StatCard 
        title="Pending Orders" 
        value={stats.pendingOrders} 
        icon={ShoppingCart} 
        color="text-yellow-500" 
      />
      <StatCard 
        title="Overdue Invoices" 
        value={stats.overdueInvoices} 
        icon={FileText} 
        color="text-orange-500" 
      />
    </div>
  );
};

export default SupplierStats;
