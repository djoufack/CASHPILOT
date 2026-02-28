import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSupplierOrders } from '@/hooks/useSupplierOrders';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { useStockAlerts } from '@/hooks/useStockHistory';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import { useAuth } from '@/context/AuthContext';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Search,
  Loader2,
  Package,
  CheckCircle,
  AlertTriangle,
  Truck,
  ClipboardCheck,
} from 'lucide-react';

const emptyItem = {
  supplier_product_id: '',
  supplier_product_name: '',
  quantity: 1,
  unit_price: 0,
  user_product_id: '',
};

const PurchasesPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { orders, loading, fetchOrders, createOrder, updateOrderStatus, deleteOrder } = useSupplierOrders();
  const { suppliers } = useSuppliers();
  const { products } = useProducts();
  const { alerts, fetchAlerts } = useStockAlerts();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingSupplierProducts, setLoadingSupplierProducts] = useState(false);

  // Receive confirmation
  const [receiveOrderId, setReceiveOrderId] = useState(null);

  // Pagination
  const pagination = usePagination({ pageSize: 20 });

  // Fetch stock alerts on mount
  useEffect(() => {
    if (user) fetchAlerts();
  }, [user]);

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      order.supplier?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.order_status === filterStatus;
    const matchesSupplier = filterSupplier === 'all' || order.supplier_id === filterSupplier;
    return matchesSearch && matchesStatus && matchesSupplier;
  });

  // Update pagination when filtered results change
  useEffect(() => {
    pagination.setTotalCount(filteredOrders.length);
  }, [filteredOrders.length]);

  const paginatedOrders = filteredOrders.slice(pagination.from, pagination.to + 1);

  // Fetch supplier products when supplier changes in create dialog
  const fetchSupplierProducts = useCallback(async (supplierId) => {
    if (!supplierId) {
      setSupplierProducts([]);
      return;
    }
    setLoadingSupplierProducts(true);
    try {
      const { data, error } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('product_name', { ascending: true });

      if (error) throw error;
      setSupplierProducts(data || []);
    } catch (err) {
      console.error('Error fetching supplier products:', err);
      setSupplierProducts([]);
    } finally {
      setLoadingSupplierProducts(false);
    }
  }, []);

  // Open create dialog
  const handleOpenCreate = () => {
    setSelectedSupplierId('');
    setOrderNumber(`CF-${Date.now()}`);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setExpectedDeliveryDate('');
    setItems([{ ...emptyItem }]);
    setSupplierProducts([]);
    setIsCreateOpen(true);
  };

  // Handle supplier change in create form
  const handleSupplierChange = (supplierId) => {
    setSelectedSupplierId(supplierId);
    setItems([{ ...emptyItem }]);
    fetchSupplierProducts(supplierId);
  };

  // Item management
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill unit price when selecting a supplier product
    if (field === 'supplier_product_id' && value) {
      const sp = supplierProducts.find(p => p.id === value);
      if (sp) {
        newItems[index].unit_price = sp.unit_price || 0;
        newItems[index].supplier_product_name = sp.product_name || '';
      }
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { ...emptyItem }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate grand total
  const grandTotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  }, 0);

  // Create order
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedSupplierId) return;

    setSubmitting(true);
    try {
      await createOrder(
        {
          supplier_id: selectedSupplierId,
          order_number: orderNumber,
          order_date: orderDate,
          expected_delivery_date: expectedDeliveryDate || null,
          total_amount: grandTotal,
          order_status: 'draft',
        },
        items.map(i => ({
          product_id: i.supplier_product_id || null,
          quantity: parseFloat(i.quantity) || 0,
          unit_price: parseFloat(i.unit_price) || 0,
          total_price: (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0),
          user_product_id: i.user_product_id || null,
        }))
      );
      setIsCreateOpen(false);
      toast({ title: t('purchases.orderCreated') });
    } catch {
      // Error handled by hook toast
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm order (draft -> confirmed)
  const handleConfirm = async (id) => {
    try {
      await updateOrderStatus(id, 'confirmed');
    } catch {
      // Error handled by hook
    }
  };

  // Delete order
  const handleDelete = async (id) => {
    try {
      await deleteOrder(id);
    } catch {
      // Error handled by hook
    }
  };

  // Mark received
  const handleReceive = async () => {
    if (!receiveOrderId) return;
    try {
      const { error } = await supabase
        .from('supplier_orders')
        .update({
          order_status: 'received',
          actual_delivery_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', receiveOrderId);

      if (!error) {
        fetchOrders();
        toast({ title: t('purchases.orderReceived') });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReceiveOrderId(null);
    }
  };

  // Status badge styling
  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-500/20 text-gray-400',
      pending: 'bg-gray-500/20 text-gray-400',
      confirmed: 'bg-blue-500/20 text-blue-400',
      received: 'bg-green-500/20 text-green-400',
      delivered: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };

    const labels = {
      draft: t('purchases.draft'),
      pending: t('purchases.pending'),
      confirmed: t('purchases.confirmed'),
      received: t('purchases.received'),
      delivered: t('purchases.received'),
      cancelled: t('purchases.cancelled'),
    };

    return (
      <Badge className={`${styles[status] || styles.draft} border-0`}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <>
      <Helmet>
        <title>{t('purchases.title')} - CashPilot</title>
      </Helmet>
      <CreditsGuardModal {...modalProps} />

      <div className="container mx-auto p-4 md:p-8 min-h-screen text-white space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                {t('purchases.title')}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {alerts.length > 0 && (
              <Link to="/app/stock">
                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 cursor-pointer flex items-center gap-1.5 px-3 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {alerts.length} {t('purchases.stockAlerts')}
                </Badge>
              </Link>
            )}
            <Button
              onClick={handleOpenCreate}
              className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="mr-2 h-4 w-4" /> {t('purchases.newOrder')}
            </Button>
          </div>
        </div>

        {/* Filters bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-4"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder={t('purchases.searchPlaceholder')}
                className="pl-9 bg-gray-900 border-gray-800 text-white w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px] bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder={t('purchases.status')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all" className="text-white hover:bg-gray-800">{t('purchases.status')} — All</SelectItem>
                <SelectItem value="draft" className="text-white hover:bg-gray-800">{t('purchases.draft')}</SelectItem>
                <SelectItem value="confirmed" className="text-white hover:bg-gray-800">{t('purchases.confirmed')}</SelectItem>
                <SelectItem value="received" className="text-white hover:bg-gray-800">{t('purchases.received')}</SelectItem>
                <SelectItem value="cancelled" className="text-white hover:bg-gray-800">{t('purchases.cancelled')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-full md:w-[200px] bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder={t('purchases.supplier')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all" className="text-white hover:bg-gray-800">{t('purchases.supplier')} — All</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-white hover:bg-gray-800">
                    {s.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Orders table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-8 md:p-12 text-center"
          >
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gray-800 rounded-full">
                <Package className="w-12 h-12 text-orange-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gradient mb-2">{t('purchases.noOrders')}</h3>
            <p className="text-gray-400 mb-6">{t('purchases.noOrdersDesc')}</p>
            <Button
              onClick={handleOpenCreate}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Plus className="w-4 h-4 mr-2" /> {t('purchases.newOrder')}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-400">{t('purchases.orderNumber')}</TableHead>
                    <TableHead className="text-gray-400">{t('purchases.supplier')}</TableHead>
                    <TableHead className="text-gray-400">{t('purchases.orderDate')}</TableHead>
                    <TableHead className="text-gray-400">{t('purchases.expectedDelivery')}</TableHead>
                    <TableHead className="text-gray-400">{t('purchases.status')}</TableHead>
                    <TableHead className="text-gray-400 text-right">{t('purchases.totalAmount')}</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium text-gradient">
                        {order.order_number || '—'}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {order.supplier?.company_name || '—'}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {order.order_date
                          ? new Date(order.order_date).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {order.expected_delivery_date
                          ? new Date(order.expected_delivery_date).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.order_status)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-white">
                        {formatCurrency(order.total_amount || 0, company?.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {order.order_status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConfirm(order.id)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                title={t('purchases.markConfirmed')}
                              >
                                <ClipboardCheck className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(order.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {order.order_status === 'confirmed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReceiveOrderId(order.id)}
                              className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                              title={t('purchases.markReceived')}
                            >
                              <Truck className="w-4 h-4" />
                            </Button>
                          )}
                          {(order.order_status === 'received' || order.order_status === 'delivered') && (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t border-white/10">
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                pageSize={pagination.pageSize}
                pageSizeOptions={pagination.pageSizeOptions}
                hasNextPage={pagination.hasNextPage}
                hasPrevPage={pagination.hasPrevPage}
                onNextPage={pagination.nextPage}
                onPrevPage={pagination.prevPage}
                onGoToPage={pagination.goToPage}
                onChangePageSize={pagination.changePageSize}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Create Order Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {t('purchases.newOrder')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-5">
            {/* Supplier */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('purchases.supplier')} *</Label>
              <Select
                value={selectedSupplierId}
                onValueChange={handleSupplierChange}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder={t('purchases.selectSupplier')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id} className="text-white hover:bg-gray-700">
                      {supplier.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Order number + dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">{t('purchases.orderNumber')}</Label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('purchases.orderDate')}</Label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('purchases.expectedDelivery')}</Label>
                <Input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <Label className="text-gray-300">{t('purchases.items')}</Label>
              {items.map((item, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Supplier product */}
                    <div className="space-y-1">
                      <Label className="text-gray-500 text-xs">{t('purchases.selectProduct')}</Label>
                      <Select
                        value={item.supplier_product_id}
                        onValueChange={(val) => handleItemChange(index, 'supplier_product_id', val)}
                        disabled={!selectedSupplierId || loadingSupplierProducts}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <SelectValue placeholder={
                            loadingSupplierProducts
                              ? 'Loading...'
                              : t('purchases.selectProduct')
                          } />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {supplierProducts.map(sp => (
                            <SelectItem key={sp.id} value={sp.id} className="text-white hover:bg-gray-700">
                              {sp.product_name} {sp.sku ? `(${sp.sku})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Stock product (user product) */}
                    <div className="space-y-1">
                      <Label className="text-gray-500 text-xs">{t('purchases.stockProduct')}</Label>
                      <Select
                        value={item.user_product_id}
                        onValueChange={(val) => handleItemChange(index, 'user_product_id', val)}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <SelectValue placeholder={t('purchases.stockProduct')} />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-white hover:bg-gray-700">
                              {p.product_name} ({p.stock_quantity ?? 0} in stock)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-gray-600">{t('purchases.stockProductHelp')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <Label className="text-gray-500 text-xs">{t('purchases.quantity')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-500 text-xs">{t('purchases.unitPrice')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-500 text-xs">{t('purchases.totalPrice')}</Label>
                      <div className="h-10 flex items-center px-3 bg-gray-800/50 border border-gray-700 rounded-md text-gray-300 text-sm">
                        {formatCurrency(
                          (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
                          company?.currency
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('purchases.addItem')}
              </Button>
            </div>

            {/* Grand total */}
            <div className="bg-gray-800/50 rounded-lg p-4 flex justify-between items-center">
              <span className="text-gray-400 font-medium">{t('purchases.totalAmount')}</span>
              <span className="text-gradient font-bold text-lg">
                {formatCurrency(grandTotal, company?.currency)}
              </span>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                {t('purchases.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={submitting || !selectedSupplierId}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {t('purchases.newOrder')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Confirmation AlertDialog */}
      <AlertDialog open={!!receiveOrderId} onOpenChange={(open) => !open && setReceiveOrderId(null)}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 to-gray-950 border-gray-700/40 text-white shadow-[0_16px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-400" />
              {t('purchases.confirmReceive')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-relaxed">
              {t('purchases.confirmReceiveDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent">
              {t('purchases.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReceive}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('purchases.markReceived')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PurchasesPage;
