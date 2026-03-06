import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, FileText, Package, ShoppingCart, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import {
  buildCanonicalOperationsSnapshot,
  EMPTY_CANONICAL_OPERATIONS_SNAPSHOT,
} from '@/shared/canonicalOperationsSnapshot';

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="bg-gray-800 border-gray-700 shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-gradient">{value}</div>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </CardContent>
  </Card>
);

const SupplierStats = React.memo(() => {
  const { applyCompanyScope } = useCompanyScope();
  const [stats, setStats] = useState(() => EMPTY_CANONICAL_OPERATIONS_SNAPSHOT.suppliers);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const suppliersQuery = applyCompanyScope(
          supabase.from('suppliers').select('id, status')
        );
        const productsQuery = applyCompanyScope(
          supabase.from('products').select('id, stock_quantity, min_stock_level')
        );
        const ordersQuery = applyCompanyScope(
          supabase.from('supplier_orders').select('id, order_status, total_amount, total_ttc, amount')
        );
        const invoicesQuery = applyCompanyScope(
          supabase.from('supplier_invoices').select('id, payment_status, total_amount, total_ttc, amount')
        );

        const [suppliersRes, productsRes, ordersRes, invoicesRes] = await Promise.all([
          suppliersQuery,
          productsQuery,
          ordersQuery,
          invoicesQuery,
        ]);

        if (suppliersRes.error) throw suppliersRes.error;
        if (productsRes.error) throw productsRes.error;
        if (ordersRes.error) throw ordersRes.error;
        if (invoicesRes.error) throw invoicesRes.error;

        const snapshot = buildCanonicalOperationsSnapshot({
          suppliers: suppliersRes.data || [],
          products: productsRes.data || [],
          supplierOrders: ordersRes.data || [],
          supplierInvoices: invoicesRes.data || [],
        });

        setStats(snapshot.suppliers);
      } catch (error) {
        console.error('Error fetching supplier stats:', error);
        setStats(EMPTY_CANONICAL_OPERATIONS_SNAPSHOT.suppliers);
      }
    };

    fetchStats();
  }, [applyCompanyScope]);

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6 md:mb-8">
      <StatCard
        title="Fournisseurs"
        value={stats.totalSuppliers}
        icon={Users}
        color="text-orange-400"
      />
      <StatCard
        title="Mes Produits"
        value={stats.totalProducts}
        icon={Package}
        color="text-green-500"
      />
      <StatCard
        title="Stock bas"
        value={stats.lowStockProducts}
        icon={AlertTriangle}
        color="text-red-500"
        subtext="Nécessite attention"
      />
      <StatCard
        title="Commandes en cours"
        value={stats.inProgressOrders}
        icon={ShoppingCart}
        color="text-yellow-500"
      />
      <StatCard
        title="Factures en retard"
        value={stats.overdueInvoices}
        icon={FileText}
        color="text-orange-500"
      />
    </div>
  );
});

export default SupplierStats;
