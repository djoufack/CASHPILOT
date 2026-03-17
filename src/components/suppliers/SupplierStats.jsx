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
    const safeQuery = async (query, label) => {
      try {
        const { data, error } = await query;
        if (error) {
          console.warn(`SupplierStats: ${label} query failed:`, error.message);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn(`SupplierStats: ${label} query exception:`, err.message);
        return [];
      }
    };

    const fetchStats = async () => {
      try {
        const _statsResults = await Promise.allSettled([
          safeQuery(
            applyCompanyScope(supabase.from('suppliers').select('id, status'), { includeUnassigned: true }),
            'suppliers'
          ),
          safeQuery(
            applyCompanyScope(supabase.from('products').select('id, stock_quantity, min_stock_level'), {
              includeUnassigned: true,
            }),
            'products'
          ),
          safeQuery(
            applyCompanyScope(
              supabase.from('supplier_orders').select('id, order_status, total_amount, total_ttc, amount'),
              { includeUnassigned: true }
            ),
            'supplier_orders'
          ),
          safeQuery(
            applyCompanyScope(
              supabase.from('supplier_invoices').select('id, payment_status, total_amount, total_ttc, amount'),
              { includeUnassigned: true }
            ),
            'supplier_invoices'
          ),
        ]);

        _statsResults.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`SupplierStats fetch ${i} failed:`, r.reason);
        });

        const suppliers = _statsResults[0].status === 'fulfilled' ? _statsResults[0].value : [];
        const products = _statsResults[1].status === 'fulfilled' ? _statsResults[1].value : [];
        const supplierOrders = _statsResults[2].status === 'fulfilled' ? _statsResults[2].value : [];
        const supplierInvoices = _statsResults[3].status === 'fulfilled' ? _statsResults[3].value : [];

        const snapshot = buildCanonicalOperationsSnapshot({
          suppliers,
          products,
          supplierOrders,
          supplierInvoices,
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
      <StatCard title="Fournisseurs" value={stats.totalSuppliers} icon={Users} color="text-orange-400" />
      <StatCard title="Mes Produits" value={stats.totalProducts} icon={Package} color="text-green-500" />
      <StatCard
        title="Stock bas"
        value={stats.lowStockProducts}
        icon={AlertTriangle}
        color="text-red-500"
        subtext="Nécessite attention"
      />
      <StatCard title="Commandes en cours" value={stats.inProgressOrders} icon={ShoppingCart} color="text-yellow-500" />
      <StatCard title="Factures en retard" value={stats.overdueInvoices} icon={FileText} color="text-orange-500" />
    </div>
  );
});

export default SupplierStats;
