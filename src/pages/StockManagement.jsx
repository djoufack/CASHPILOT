import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useStockAlerts, useStockHistory } from '@/hooks/useStockHistory';
import { useProducts, useProductCategories } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useInventoryWarehouses, useInventoryLots } from '@/hooks/useInventoryWarehouses';
import { useCompany } from '@/hooks/useCompany';
import { getCurrencySymbol } from '@/utils/currencyService';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { formatNumber } from '@/utils/calculations';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Package,
  Search,
  Plus,
  Trash2,
  Download,
  FileText,
  Wallet,
  TrendingUp,
  Target,
  BarChart3,
  Eye,
  Pencil,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { exportStockListPDF, exportStockListHTML } from '@/services/exportListsPDF';
import { buildStockValuationDashboard } from '@/services/stockValuationAnalytics';
import { buildWarehouseLotSummary } from '@/services/inventoryWarehouseLotInsights';
import { buildReplenishmentRecommendations } from '@/services/stockReplenishmentRecommendations';
import ExportButton from '@/components/ExportButton';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';

const DEFAULT_NEW_PRODUCT = {
  product_name: '',
  sku: '',
  category_id: '',
  supplier_id: '',
  unit_price: '',
  purchase_price: '',
  unit: 'pièce',
  stock_quantity: '0',
  min_stock_level: '5',
  description: '',
  inventory_tracking_enabled: true,
};

const DEFAULT_PRODUCT_EDIT_FORM = {
  product_name: '',
  sku: '',
  category_id: '',
  supplier_id: '',
  unit: 'pièce',
  description: '',
  inventory_tracking_enabled: true,
  unit_price: '0',
  purchase_price: '0',
  stock_quantity: '0',
  min_stock_level: '5',
};

const DEFAULT_PRODUCT_PRICING_FORM = {
  unit_price: '0',
  purchase_price: '0',
  stock_quantity: '0',
  min_stock_level: '5',
  inventory_tracking_enabled: true,
};

const DEFAULT_WAREHOUSE_FORM = {
  warehouse_code: '',
  warehouse_name: '',
  description: '',
  is_default: false,
};

const DEFAULT_LOT_FORM = {
  product_id: '',
  warehouse_id: '',
  lot_number: '',
  serial_number: '',
  quantity: '',
  received_at: '',
  expiry_date: '',
  notes: '',
};

const buildProductEditForm = (product) => ({
  product_name: product?.product_name || '',
  sku: product?.sku || '',
  category_id: product?.category_id || '',
  supplier_id: product?.supplier_id || '',
  unit: product?.unit || 'pièce',
  description: product?.description || '',
  inventory_tracking_enabled: product?.inventory_tracking_enabled !== false,
  unit_price: String(product?.unit_price ?? 0),
  purchase_price: String(product?.purchase_price ?? 0),
  stock_quantity: String(product?.stock_quantity ?? 0),
  min_stock_level: String(product?.min_stock_level ?? 5),
});

const buildProductPricingForm = (product) => ({
  unit_price: String(product?.unit_price ?? 0),
  purchase_price: String(product?.purchase_price ?? 0),
  stock_quantity: String(product?.stock_quantity ?? 0),
  min_stock_level: String(product?.min_stock_level ?? 5),
  inventory_tracking_enabled: product?.inventory_tracking_enabled !== false,
});

const parseNumericField = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const StockManagement = () => {
  const { t } = useTranslation();
  const { alerts, fetchAlerts, resolveAlert } = useStockAlerts();
  const { getProductHistory, addHistoryEntry, getStockValuationContext, loading: historyLoading } = useStockHistory();
  const { products, loading, createProduct, updateProduct, deleteProduct, fetchProducts } = useProducts();
  const { warehouses, loading: warehousesLoading, createWarehouse, updateWarehouse } = useInventoryWarehouses();
  const { lots, loading: lotsLoading, createLot } = useInventoryLots();
  const { categories } = useProductCategories();
  const { suppliers } = useSuppliers();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const companyCurrency = resolveAccountingCurrency(company);

  // Get company currency symbol
  const currencySymbol = getCurrencySymbol(companyCurrency);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // History tab state
  const [historyProductId, setHistoryProductId] = useState(null);
  const [history, setHistory] = useState([]);

  // Adjustment tab state
  const [adjProductId, setAdjProductId] = useState('');
  const [adjNewQty, setAdjNewQty] = useState('');
  const [adjReason, setAdjReason] = useState('adjustment');
  const [adjNotes, setAdjNotes] = useState('');
  const [valuationMode, setValuationMode] = useState('cost');
  const [valuationContextLoading, setValuationContextLoading] = useState(false);
  const [stockValuationContext, setStockValuationContext] = useState({
    historyEntries: [],
    supplierOrderItems: [],
  });
  const [warehouseForm, setWarehouseForm] = useState(DEFAULT_WAREHOUSE_FORM);
  const [lotForm, setLotForm] = useState(DEFAULT_LOT_FORM);

  // Add product dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProduct, setNewProduct] = useState(DEFAULT_NEW_PRODUCT);
  const [viewProduct, setViewProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState(DEFAULT_PRODUCT_EDIT_FORM);
  const [pricingProduct, setPricingProduct] = useState(null);
  const [pricingForm, setPricingForm] = useState(DEFAULT_PRODUCT_PRICING_FORM);
  const [deleteTargetProduct, setDeleteTargetProduct] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    let isActive = true;

    const loadValuationContext = async () => {
      const trackedProductIds = products
        .filter((product) => product.inventory_tracking_enabled !== false)
        .map((product) => product.id)
        .filter(Boolean);

      if (trackedProductIds.length === 0) {
        if (isActive) {
          setStockValuationContext({
            historyEntries: [],
            supplierOrderItems: [],
          });
          setValuationContextLoading(false);
        }
        return;
      }

      setValuationContextLoading(true);
      const context = await getStockValuationContext(trackedProductIds);
      if (isActive) {
        setStockValuationContext({
          historyEntries: Array.isArray(context?.historyEntries) ? context.historyEntries : [],
          supplierOrderItems: Array.isArray(context?.supplierOrderItems) ? context.supplierOrderItems : [],
        });
        setValuationContextLoading(false);
      }
    };

    loadValuationContext();

    return () => {
      isActive = false;
    };
  }, [getStockValuationContext, products]);

  const pagination = usePagination({ pageSize: 25 });
  const { setTotalCount } = pagination;

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      !searchTerm ||
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    return matchSearch && matchCategory;
  });

  useEffect(() => {
    setTotalCount(filteredProducts.length);
  }, [filteredProducts.length, setTotalCount]);

  const paginatedProducts = filteredProducts.slice(pagination.from, pagination.to + 1);
  const trackedProducts = useMemo(
    () => products.filter((product) => product.inventory_tracking_enabled !== false),
    [products]
  );
  const trackedFilteredProducts = useMemo(
    () => filteredProducts.filter((product) => product.inventory_tracking_enabled !== false),
    [filteredProducts]
  );
  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => alert.product?.inventory_tracking_enabled !== false),
    [alerts]
  );

  // Stats
  const totalProducts = products.length;
  const lowStockCount = trackedProducts.filter(
    (p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level
  ).length;
  const outOfStockCount = trackedProducts.filter((p) => p.stock_quantity <= 0).length;
  const totalValue = trackedProducts.reduce((sum, p) => sum + p.stock_quantity * p.unit_price, 0);

  const stockInsights = useMemo(() => {
    return trackedFilteredProducts.map((product) => {
      const stockQuantity = Number(product.stock_quantity || 0);
      const minStockLevel = Number(product.min_stock_level || 0);
      const purchasePrice = Number(product.purchase_price || 0);
      const unitPrice = Number(product.unit_price || 0);
      const costValue = stockQuantity * purchasePrice;
      const retailValue = stockQuantity * unitPrice;
      const potentialMargin = retailValue - costValue;
      const reorderUnits = Math.max(0, minStockLevel - stockQuantity);
      const reorderCost = reorderUnits * purchasePrice;
      const grossMarginPct = unitPrice > 0 ? ((unitPrice - purchasePrice) / unitPrice) * 100 : null;

      return {
        ...product,
        stockQuantity,
        minStockLevel,
        purchasePrice,
        unitPrice,
        costValue,
        retailValue,
        potentialMargin,
        reorderUnits,
        reorderCost,
        grossMarginPct,
      };
    });
  }, [trackedFilteredProducts]);

  const strategicStock = useMemo(() => {
    const totalCostPool = stockInsights.reduce((sum, product) => sum + product.costValue, 0);
    let runningCost = 0;

    return [...stockInsights]
      .sort((a, b) => b.costValue - a.costValue)
      .map((product) => {
        runningCost += product.costValue;
        const cumulativeShare = totalCostPool > 0 ? runningCost / totalCostPool : 0;
        const abcClass = cumulativeShare <= 0.8 ? 'A' : cumulativeShare <= 0.95 ? 'B' : 'C';
        return { ...product, abcClass, cumulativeShare };
      });
  }, [stockInsights]);

  const valuationMap = {
    cost: {
      label: t('stockManagement.valuationModes.cost'),
      metricKey: 'costValue',
      accentClass: 'text-blue-400',
    },
    retail: {
      label: t('stockManagement.valuationModes.retail'),
      metricKey: 'retailValue',
      accentClass: 'text-emerald-400',
    },
    margin: {
      label: t('stockManagement.valuationModes.margin'),
      metricKey: 'potentialMargin',
      accentClass: 'text-orange-400',
    },
  };

  const selectedValuation = valuationMap[valuationMode] || valuationMap.cost;

  const inventoryValueAtCost = strategicStock.reduce((sum, product) => sum + product.costValue, 0);
  const inventoryValueAtRetail = strategicStock.reduce((sum, product) => sum + product.retailValue, 0);
  const potentialMarginValue = strategicStock.reduce((sum, product) => sum + product.potentialMargin, 0);
  const reorderExposure = strategicStock.reduce((sum, product) => sum + product.reorderCost, 0);
  const missingPurchasePriceCount = strategicStock.filter(
    (product) => product.stockQuantity > 0 && product.purchasePrice <= 0
  ).length;
  const negativeMarginCount = strategicStock.filter(
    (product) => product.stockQuantity > 0 && product.unitPrice > 0 && product.potentialMargin < 0
  ).length;

  const highValueProducts = useMemo(() => {
    const metricKey = selectedValuation.metricKey;
    return [...strategicStock].sort((a, b) => Number(b[metricKey] || 0) - Number(a[metricKey] || 0)).slice(0, 8);
  }, [selectedValuation.metricKey, strategicStock]);

  const abcSummary = useMemo(() => {
    return ['A', 'B', 'C'].map((abcClass) => {
      const items = strategicStock.filter((product) => product.abcClass === abcClass);
      const value = items.reduce((sum, product) => sum + product.costValue, 0);
      return {
        abcClass,
        count: items.length,
        value,
        share: inventoryValueAtCost > 0 ? (value / inventoryValueAtCost) * 100 : 0,
      };
    });
  }, [inventoryValueAtCost, strategicStock]);

  const stockValuationDashboard = useMemo(() => {
    return buildStockValuationDashboard({
      products: trackedFilteredProducts,
      historyEntries: stockValuationContext.historyEntries,
      supplierOrderItems: stockValuationContext.supplierOrderItems,
    });
  }, [stockValuationContext.historyEntries, stockValuationContext.supplierOrderItems, trackedFilteredProducts]);
  const stockValuationRows = stockValuationDashboard.rows;
  const stockValuationSummary = stockValuationDashboard.summary;
  const replenishmentDashboard = useMemo(() => {
    return buildReplenishmentRecommendations({
      products: strategicStock,
      historyEntries: stockValuationContext.historyEntries,
      supplierOrderItems: stockValuationContext.supplierOrderItems,
    });
  }, [stockValuationContext.historyEntries, stockValuationContext.supplierOrderItems, strategicStock]);
  const replenishmentRecommendations = replenishmentDashboard.recommendations;
  const replenishmentSummary = replenishmentDashboard.summary;

  const warehouseLotSummary = useMemo(() => {
    return buildWarehouseLotSummary({ warehouses, lots });
  }, [lots, warehouses]);

  // Load history for selected product
  const loadHistory = async (productId) => {
    setHistoryProductId(productId);
    const data = await getProductHistory(productId);
    setHistory(data || []);
  };

  // Handle stock adjustment
  const handleAdjustment = async () => {
    if (!adjProductId || adjNewQty === '') return;
    const product = products.find((p) => p.id === adjProductId);
    if (!product || product.inventory_tracking_enabled === false) return;

    const success = await addHistoryEntry({
      productId: adjProductId,
      previousQty: product.stock_quantity,
      newQty: parseFloat(adjNewQty),
      reason: adjReason,
      notes: adjNotes,
    });

    if (success) {
      setAdjProductId('');
      setAdjNewQty('');
      setAdjNotes('');
      fetchProducts();
      fetchAlerts();
    }
  };

  // Handle add product
  const handleAddProduct = async () => {
    const inventoryTrackingEnabled = newProduct.inventory_tracking_enabled !== false;

    try {
      await createProduct({
        product_name: newProduct.product_name,
        sku: newProduct.sku || null,
        category_id: newProduct.category_id || null,
        supplier_id: newProduct.supplier_id || null,
        unit_price: parseFloat(newProduct.unit_price) || 0,
        purchase_price: parseFloat(newProduct.purchase_price) || 0,
        unit: newProduct.unit,
        stock_quantity: inventoryTrackingEnabled ? parseFloat(newProduct.stock_quantity) || 0 : 0,
        min_stock_level: inventoryTrackingEnabled ? parseFloat(newProduct.min_stock_level) || 5 : 0,
        description: newProduct.description || null,
        inventory_tracking_enabled: inventoryTrackingEnabled,
        is_active: true,
      });
      setShowAddDialog(false);
      setNewProduct(DEFAULT_NEW_PRODUCT);
    } catch (err) {
      // Error toast handled by useProducts hook; log for debugging
      console.error('Failed to add product:', err);
    }
  };

  const openEditProductDialog = (product) => {
    setEditProduct(product);
    setEditProductForm(buildProductEditForm(product));
  };

  const openPricingDialog = (product) => {
    setPricingProduct(product);
    setPricingForm(buildProductPricingForm(product));
  };

  const handleUpdateProductDetails = async () => {
    if (!editProduct) return;

    const inventoryTrackingEnabled = editProductForm.inventory_tracking_enabled !== false;

    try {
      await updateProduct(editProduct.id, {
        product_name: editProductForm.product_name,
        sku: editProductForm.sku || null,
        category_id: editProductForm.category_id || null,
        supplier_id: editProductForm.supplier_id || null,
        unit: editProductForm.unit || 'pièce',
        description: editProductForm.description || null,
        inventory_tracking_enabled: inventoryTrackingEnabled,
        unit_price: parseNumericField(editProductForm.unit_price),
        purchase_price: parseNumericField(editProductForm.purchase_price),
        stock_quantity: inventoryTrackingEnabled ? parseNumericField(editProductForm.stock_quantity) : 0,
        min_stock_level: inventoryTrackingEnabled ? parseNumericField(editProductForm.min_stock_level, 5) : 0,
      });
      setEditProduct(null);
      setEditProductForm(DEFAULT_PRODUCT_EDIT_FORM);
      fetchAlerts();
    } catch (err) {
      // Error toast handled by useProducts hook; log for debugging
      console.error('Failed to update product details:', err);
    }
  };

  const handleUpdatePricing = async () => {
    if (!pricingProduct) return;

    const inventoryTrackingEnabled = pricingForm.inventory_tracking_enabled !== false;

    try {
      await updateProduct(pricingProduct.id, {
        unit_price: parseNumericField(pricingForm.unit_price),
        purchase_price: parseNumericField(pricingForm.purchase_price),
        stock_quantity: inventoryTrackingEnabled ? parseNumericField(pricingForm.stock_quantity) : 0,
        min_stock_level: inventoryTrackingEnabled ? parseNumericField(pricingForm.min_stock_level, 5) : 0,
      });
      setPricingProduct(null);
      setPricingForm(DEFAULT_PRODUCT_PRICING_FORM);
      fetchAlerts();
    } catch (err) {
      // Error toast handled by useProducts hook; log for debugging
      console.error('Failed to update product pricing:', err);
    }
  };

  const handleDeleteProductConfirm = async () => {
    if (!deleteTargetProduct) return;

    try {
      await deleteProduct(deleteTargetProduct.id);
      setDeleteTargetProduct(null);
      fetchAlerts();
    } catch (err) {
      // Error toast handled by useProducts hook; log for debugging
      console.error('Failed to delete product:', err);
    }
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseForm.warehouse_code || !warehouseForm.warehouse_name) return;

    try {
      await createWarehouse({
        warehouse_code: warehouseForm.warehouse_code,
        warehouse_name: warehouseForm.warehouse_name,
        description: warehouseForm.description,
        is_default: warehouseForm.is_default,
      });
      setWarehouseForm(DEFAULT_WAREHOUSE_FORM);
    } catch (err) {
      console.error('Failed to create warehouse:', err);
    }
  };

  const handleCreateLot = async () => {
    if (!lotForm.product_id || !lotForm.warehouse_id || !lotForm.lot_number || lotForm.quantity === '') return;

    try {
      await createLot({
        product_id: lotForm.product_id,
        warehouse_id: lotForm.warehouse_id,
        lot_number: lotForm.lot_number,
        serial_number: lotForm.serial_number || null,
        quantity: parseNumericField(lotForm.quantity),
        received_at: lotForm.received_at || null,
        expiry_date: lotForm.expiry_date || null,
        notes: lotForm.notes || null,
      });
      setLotForm(DEFAULT_LOT_FORM);
    } catch (err) {
      console.error('Failed to create lot:', err);
    }
  };

  const getStockBadge = (product) => {
    if (product.inventory_tracking_enabled === false) {
      return (
        <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30">
          {t('stockManagement.badges.unstocked')}
        </Badge>
      );
    }
    if (product.stock_quantity <= 0)
      return <Badge variant="destructive">{t('stockManagement.badges.outOfStock')}</Badge>;
    if (product.stock_quantity <= product.min_stock_level)
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          {t('stockManagement.badges.lowStock')}
        </Badge>
      );
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{t('stockManagement.badges.ok')}</Badge>
    );
  };

  const getAbcBadge = (abcClass) => {
    if (abcClass === 'A') {
      return (
        <Badge className="bg-red-500/15 text-red-300 border border-red-500/20">
          {t('stockManagement.badges.abcA')}
        </Badge>
      );
    }
    if (abcClass === 'B') {
      return (
        <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/20">
          {t('stockManagement.badges.abcB')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/20">
        {t('stockManagement.badges.abcC')}
      </Badge>
    );
  };

  const getReplenishmentPriorityBadge = (priority) => {
    if (priority === 'critical') {
      return (
        <Badge className="bg-red-500/15 text-red-300 border border-red-500/20">
          {t('stockManagement.badges.priorityCritical')}
        </Badge>
      );
    }
    if (priority === 'high') {
      return (
        <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/20">
          {t('stockManagement.badges.priorityHigh')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/20">
        {t('stockManagement.badges.priorityPlanned')}
      </Badge>
    );
  };

  const handleExportPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_REPORT, 'Stock List PDF', async () => {
      await exportStockListPDF(filteredProducts, company);
    });
  };

  const handleExportHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Stock List HTML', () => {
      exportStockListHTML(filteredProducts, company);
    });
  };

  const productExportColumns = [
    { key: 'product_name', header: t('stockManagement.exportColumns.product'), width: 25 },
    { key: 'sku', header: t('stockManagement.exportColumns.sku'), width: 15 },
    {
      key: 'category_name',
      header: t('stockManagement.exportColumns.category'),
      width: 15,
      accessor: (p) => p.category?.name || '',
    },
    {
      key: 'supplier_name',
      header: t('stockManagement.exportColumns.supplier'),
      width: 20,
      accessor: (p) => p.supplier?.company_name || '',
    },
    { key: 'unit_price', header: t('stockManagement.exportColumns.salePrice'), type: 'currency', width: 14 },
    { key: 'purchase_price', header: t('stockManagement.exportColumns.purchasePrice'), type: 'currency', width: 14 },
    { key: 'stock_quantity', header: t('stockManagement.exportColumns.quantity'), type: 'number', width: 10 },
    { key: 'min_stock_level', header: t('stockManagement.exportColumns.minStock'), type: 'number', width: 10 },
    { key: 'unit', header: t('stockManagement.exportColumns.unit'), width: 10 },
  ];

  return (
    <>
      <Helmet>
        <title>{t('stockManagement.title', 'Stock Management')} | CashPilot</title>
      </Helmet>
      <CreditsGuardModal {...modalProps} />
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
        {/* Tabs */}
        <Tabs defaultValue="cockpit" className="w-full space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-gradient">{t('stockManagement.title', 'Stock Management')}</h1>
                <p className="text-gray-400">
                  {t('stockManagement.subtitle', 'Manage your inventory, alerts and stock movements.')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={t('common.search', 'Search...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-gray-800 border-gray-700 text-white w-full sm:w-[260px]"
                  />
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-[220px] bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={t('stockManagement.allCategories', 'All categories')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="all">{t('stockManagement.allCategories', 'All categories')}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={() => setShowAddDialog(true)} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" /> {t('stockManagement.newProduct', 'New product')}
                </Button>
              </div>
            </div>

            <div className="space-y-4 lg:self-start">
              <div className="flex gap-2 flex-wrap lg:justify-end">
                <ExportButton data={filteredProducts} columns={productExportColumns} filename="products" />
                <Button
                  onClick={handleExportPDF}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF ({CREDIT_COSTS.PDF_REPORT})
                </Button>
                <Button
                  onClick={handleExportHTML}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  HTML ({CREDIT_COSTS.EXPORT_HTML})
                </Button>
              </div>

              <TabsList className="bg-gray-900 border border-gray-800 w-full h-auto p-1 grid grid-cols-2 md:grid-cols-5 gap-1">
                <TabsTrigger value="cockpit">{t('stockManagement.tabs.cockpit', 'Stock Cockpit')}</TabsTrigger>
                <TabsTrigger value="warehouses">{t('stockManagement.tabs.warehouses')}</TabsTrigger>
                <TabsTrigger value="inventory">{t('stockManagement.tabs.inventory', 'Inventory')}</TabsTrigger>
                <TabsTrigger value="history">{t('stockManagement.tabs.history', 'History')}</TabsTrigger>
                <TabsTrigger value="adjustments">
                  {t('stockManagement.tabs.adjustments', 'Stock Management')}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="warehouses" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.warehouses.activeWarehouses')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-300">{warehouseLotSummary.totalWarehouses}</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.warehouses.lots')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-indigo-300">{warehouseLotSummary.totalLots}</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.warehouses.serializedLots')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-300">{warehouseLotSummary.totalSerialTrackedLots}</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.warehouses.trackedQuantity')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-300">
                    {formatNumber(warehouseLotSummary.totalQuantity)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white">{t('stockManagement.warehouses.title')}</CardTitle>
                  <p className="text-sm text-gray-400">{t('stockManagement.warehouses.subtitle')}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.warehouseCode')}</Label>
                      <Input
                        className="bg-gray-800 border-gray-700"
                        placeholder="MAIN"
                        value={warehouseForm.warehouse_code}
                        onChange={(event) =>
                          setWarehouseForm((current) => ({
                            ...current,
                            warehouse_code: event.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.warehouseName')}</Label>
                      <Input
                        className="bg-gray-800 border-gray-700"
                        placeholder={t('stockManagement.warehouses.warehouseName')}
                        value={warehouseForm.warehouse_name}
                        onChange={(event) =>
                          setWarehouseForm((current) => ({ ...current, warehouse_name: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('stockManagement.warehouses.description')}</Label>
                    <Input
                      className="bg-gray-800 border-gray-700"
                      placeholder={t('stockManagement.warehouses.descriptionPlaceholder')}
                      value={warehouseForm.description}
                      onChange={(event) =>
                        setWarehouseForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded border border-gray-800 bg-gray-950/50 px-3 py-2">
                    <p className="text-sm text-gray-300">{t('stockManagement.warehouses.setDefault')}</p>
                    <Switch
                      checked={warehouseForm.is_default}
                      onCheckedChange={(checked) =>
                        setWarehouseForm((current) => ({ ...current, is_default: checked }))
                      }
                    />
                  </div>
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    onClick={handleCreateWarehouse}
                    disabled={warehousesLoading || !warehouseForm.warehouse_code || !warehouseForm.warehouse_name}
                  >
                    {t('stockManagement.warehouses.createWarehouse')}
                  </Button>

                  <div className="space-y-2 pt-2">
                    {warehouses.length === 0 ? (
                      <p className="text-sm text-gray-500">{t('stockManagement.warehouses.noWarehouses')}</p>
                    ) : (
                      warehouses.map((warehouse) => (
                        <div
                          key={warehouse.id}
                          className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">
                              {warehouse.warehouse_code} - {warehouse.warehouse_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {warehouse.description || t('stockManagement.warehouses.noDescription')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {warehouse.is_default ? (
                              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                {t('stockManagement.warehouses.default')}
                              </Badge>
                            ) : null}
                            <Badge
                              className={
                                warehouse.is_active !== false
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                              }
                            >
                              {warehouse.is_active !== false
                                ? t('stockManagement.warehouses.active')
                                : t('stockManagement.warehouses.inactive')}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateWarehouse(warehouse.id, { is_active: warehouse.is_active === false })
                              }
                              disabled={warehousesLoading}
                            >
                              {warehouse.is_active !== false
                                ? t('stockManagement.warehouses.deactivate')
                                : t('stockManagement.warehouses.activate')}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white">{t('stockManagement.warehouses.lotsTitle')}</CardTitle>
                  <p className="text-sm text-gray-400">{t('stockManagement.warehouses.lotsSubtitle')}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.product')}</Label>
                      <Select
                        value={lotForm.product_id || 'none'}
                        onValueChange={(value) =>
                          setLotForm((current) => ({ ...current, product_id: value === 'none' ? '' : value }))
                        }
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700">
                          <SelectValue placeholder={t('stockManagement.warehouses.selectProduct')} />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          <SelectItem value="none">{t('stockManagement.warehouses.selectProduct')}</SelectItem>
                          {trackedProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.product_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.warehouse')}</Label>
                      <Select
                        value={lotForm.warehouse_id || 'none'}
                        onValueChange={(value) =>
                          setLotForm((current) => ({ ...current, warehouse_id: value === 'none' ? '' : value }))
                        }
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700">
                          <SelectValue placeholder={t('stockManagement.warehouses.selectWarehouse')} />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          <SelectItem value="none">{t('stockManagement.warehouses.selectWarehouse')}</SelectItem>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.warehouse_code} - {warehouse.warehouse_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.lotNumberLabel')}</Label>
                      <Input
                        className="bg-gray-800 border-gray-700"
                        placeholder="LOT-2026-0001"
                        value={lotForm.lot_number}
                        onChange={(event) => setLotForm((current) => ({ ...current, lot_number: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.serialNumberLabel')}</Label>
                      <Input
                        className="bg-gray-800 border-gray-700"
                        placeholder="SN-00001"
                        value={lotForm.serial_number}
                        onChange={(event) =>
                          setLotForm((current) => ({ ...current, serial_number: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.quantityLabel')}</Label>
                      <Input
                        type="number"
                        className="bg-gray-800 border-gray-700"
                        value={lotForm.quantity}
                        onChange={(event) => setLotForm((current) => ({ ...current, quantity: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.receptionDate')}</Label>
                      <Input
                        type="date"
                        className="bg-gray-800 border-gray-700"
                        value={lotForm.received_at}
                        onChange={(event) => setLotForm((current) => ({ ...current, received_at: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('stockManagement.warehouses.expiryDate')}</Label>
                      <Input
                        type="date"
                        className="bg-gray-800 border-gray-700"
                        value={lotForm.expiry_date}
                        onChange={(event) => setLotForm((current) => ({ ...current, expiry_date: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('stockManagement.warehouses.notes')}</Label>
                    <Input
                      className="bg-gray-800 border-gray-700"
                      placeholder={t('stockManagement.warehouses.notesTip')}
                      value={lotForm.notes}
                      onChange={(event) => setLotForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </div>
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    onClick={handleCreateLot}
                    disabled={
                      !lotForm.product_id ||
                      !lotForm.warehouse_id ||
                      !lotForm.lot_number ||
                      lotForm.quantity === '' ||
                      lotsLoading
                    }
                  >
                    {t('stockManagement.warehouses.saveLot')}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-white">{t('stockManagement.warehouses.lotsRegistry')}</CardTitle>
                <p className="text-sm text-gray-400">{t('stockManagement.warehouses.lotsRegistrySubtitle')}</p>
              </CardHeader>
              <CardContent>
                {lots.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('stockManagement.warehouses.noLots')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-800 hover:bg-transparent">
                          <TableHead className="text-gray-400">{t('stockManagement.warehouses.product')}</TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.warehouses.warehouse')}</TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.warehouses.lotNumber')}</TableHead>
                          <TableHead className="text-gray-400">
                            {t('stockManagement.warehouses.serialNumber')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.warehouses.quantity')}
                          </TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.warehouses.status')}</TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.warehouses.reception')}</TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.warehouses.expiry')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lots.slice(0, 50).map((lot) => (
                          <TableRow key={lot.id} className="border-gray-800">
                            <TableCell>
                              <div>
                                <p className="font-medium text-white">
                                  {lot.product?.product_name || t('stockManagement.warehouses.product')}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {lot.product?.sku || t('stockManagement.warehouses.noSku')}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {lot.warehouse?.warehouse_code || '--'} - {lot.warehouse?.warehouse_name || '--'}
                            </TableCell>
                            <TableCell className="text-gray-300">{lot.lot_number}</TableCell>
                            <TableCell className="text-gray-300">{lot.serial_number || '--'}</TableCell>
                            <TableCell className="text-right text-white">{formatNumber(lot.quantity || 0)}</TableCell>
                            <TableCell className="text-gray-300">{lot.status || 'active'}</TableCell>
                            <TableCell className="text-gray-300">{lot.received_at || '--'}</TableCell>
                            <TableCell className="text-gray-300">{lot.expiry_date || '--'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Adjustments Tab */}
          <TabsContent value="adjustments" className="mt-4">
            <Card className="bg-gray-900 border-gray-800 max-w-lg mx-auto">
              <CardHeader>
                <CardTitle>{t('stockManagement.manualAdjustment', 'Manual stock adjustment')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.adjustments.product')}</Label>
                  <Select value={adjProductId} onValueChange={setAdjProductId}>
                    <SelectTrigger className="bg-gray-800 border-gray-700">
                      <SelectValue placeholder={t('stockManagement.adjustments.selectProduct')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      {trackedProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_name} ({t('stockManagement.adjustments.currentQty', { qty: p.stock_quantity })})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('stockManagement.adjustments.newQuantity')}</Label>
                    <Input
                      type="number"
                      className="bg-gray-800 border-gray-700"
                      value={adjNewQty}
                      onChange={(e) => setAdjNewQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('stockManagement.adjustments.reason')}</Label>
                    <Select value={adjReason} onValueChange={setAdjReason}>
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="adjustment">
                          {t('stockManagement.adjustments.reasons.adjustment')}
                        </SelectItem>
                        <SelectItem value="reception">{t('stockManagement.adjustments.reasons.reception')}</SelectItem>
                        <SelectItem value="sale">{t('stockManagement.adjustments.reasons.sale')}</SelectItem>
                        <SelectItem value="damage">{t('stockManagement.adjustments.reasons.damage')}</SelectItem>
                        <SelectItem value="return">{t('stockManagement.adjustments.reasons.return')}</SelectItem>
                        <SelectItem value="inventory">{t('stockManagement.adjustments.reasons.inventory')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.adjustments.notes')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    placeholder={t('stockManagement.adjustments.notesPlaceholder')}
                    value={adjNotes}
                    onChange={(e) => setAdjNotes(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  onClick={handleAdjustment}
                  disabled={!adjProductId || adjNewQty === '' || historyLoading}
                >
                  {t('stockManagement.updateStock', 'Update stock')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cockpit" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.totalProducts', 'Total Products')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">{totalProducts}</div>
                  <p className="text-xs text-gray-500 mt-2">
                    {t('stockManagement.cockpit.trackedProductsCount', { count: trackedProducts.length })}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.lowStock', 'Low Stock')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-500">{lowStockCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.outOfStock', 'Out of Stock')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">{outOfStockCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('stockManagement.stockValue', 'Stock Value')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    {formatNumber(totalValue)} {currencySymbol}
                  </div>
                </CardContent>
              </Card>
            </div>

            {visibleAlerts.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{t('stockManagement.activeAlerts', 'Active Alerts')}</h3>
                <div className="grid gap-2">
                  {visibleAlerts.map((alert) => (
                    <Alert
                      key={alert.id}
                      className="bg-gray-900 border border-gray-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle
                          className={`h-5 w-5 ${alert.alert_type === 'out_of_stock' ? 'text-red-500' : 'text-yellow-500'}`}
                        />
                        <div>
                          <AlertTitle className="text-gradient">{alert.product?.product_name}</AlertTitle>
                          <AlertDescription className="text-gray-400">
                            {t('stockManagement.alerts.current', { qty: alert.product?.stock_quantity })} |{' '}
                            {t('stockManagement.alerts.min', { min: alert.product?.min_stock_level })}
                          </AlertDescription>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                        {t('stockManagement.resolve', 'Resolve')}
                      </Button>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-400" />
                    {t('stockManagement.cockpit.costValue')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">
                    {formatNumber(inventoryValueAtCost)} {currencySymbol}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{t('stockManagement.cockpit.costValueSubtitle')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    {t('stockManagement.cockpit.retailValue')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-400">
                    {formatNumber(inventoryValueAtRetail)} {currencySymbol}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{t('stockManagement.cockpit.retailValueSubtitle')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <Target className="w-4 h-4 text-orange-400" />
                    {t('stockManagement.cockpit.potentialMargin')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${potentialMarginValue >= 0 ? 'text-orange-400' : 'text-red-400'}`}
                  >
                    {formatNumber(potentialMarginValue)} {currencySymbol}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{t('stockManagement.cockpit.potentialMarginSubtitle')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    {t('stockManagement.cockpit.replenishmentBudget')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    {formatNumber(reorderExposure)} {currencySymbol}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {t('stockManagement.cockpit.replenishmentBudgetSubtitle')}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="bg-gray-900 border-gray-800 xl:col-span-2">
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-orange-400" />
                        {t('stockManagement.cockpit.strategicItems')}
                      </CardTitle>
                      <p className="text-sm text-gray-400 mt-1">
                        {t('stockManagement.cockpit.strategicItemsSubtitle')}
                      </p>
                    </div>
                    <Select value={valuationMode} onValueChange={setValuationMode}>
                      <SelectTrigger className="w-full md:w-[220px] bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="cost">{t('stockManagement.valuationModes.cost')}</SelectItem>
                        <SelectItem value="retail">{t('stockManagement.valuationModes.retail')}</SelectItem>
                        <SelectItem value="margin">{t('stockManagement.valuationModes.margin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {highValueProducts.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('stockManagement.cockpit.noProductsFilter')}</p>
                  ) : (
                    highValueProducts.map((product) => (
                      <div key={product.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-white">{product.product_name}</p>
                              {getAbcBadge(product.abcClass)}
                              {getStockBadge(product)}
                            </div>
                            <p className="text-xs text-gray-500">
                              {t('stockManagement.cockpit.skuStock', {
                                sku: product.sku || '—',
                                stock: product.stockQuantity,
                                min: product.minStockLevel,
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-semibold ${selectedValuation.accentClass}`}>
                              {formatNumber(product[selectedValuation.metricKey] || 0)} {currencySymbol}
                            </p>
                            <p className="text-xs text-gray-500">{selectedValuation.label}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
                          <div className="bg-gray-900/60 rounded-md p-3">
                            <p className="text-gray-500 text-xs uppercase tracking-wider">
                              {t('stockManagement.cockpit.unitCost')}
                            </p>
                            <p className="text-white font-medium mt-1">
                              {formatNumber(product.purchasePrice)} {currencySymbol}
                            </p>
                          </div>
                          <div className="bg-gray-900/60 rounded-md p-3">
                            <p className="text-gray-500 text-xs uppercase tracking-wider">
                              {t('stockManagement.cockpit.salePrice')}
                            </p>
                            <p className="text-white font-medium mt-1">
                              {formatNumber(product.unitPrice)} {currencySymbol}
                            </p>
                          </div>
                          <div className="bg-gray-900/60 rounded-md p-3">
                            <p className="text-gray-500 text-xs uppercase tracking-wider">
                              {t('stockManagement.cockpit.grossMargin')}
                            </p>
                            <p
                              className={`font-medium mt-1 ${product.grossMarginPct != null && product.grossMarginPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}
                            >
                              {product.grossMarginPct == null
                                ? t('stockManagement.cockpit.notCalculable')
                                : `${formatNumber(product.grossMarginPct, 1)} %`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white">{t('stockManagement.cockpit.portfolioQuality')}</CardTitle>
                  <p className="text-sm text-gray-400">{t('stockManagement.cockpit.portfolioQualitySubtitle')}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-sm text-gray-400">{t('stockManagement.cockpit.missingPurchasePrice')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{missingPurchasePriceCount}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {t('stockManagement.cockpit.missingPurchasePriceSubtitle')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-sm text-gray-400">{t('stockManagement.cockpit.riskMargins')}</p>
                    <p className="text-2xl font-bold text-red-400 mt-1">{negativeMarginCount}</p>
                    <p className="text-xs text-gray-500 mt-2">{t('stockManagement.cockpit.riskMarginsSubtitle')}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-sm text-gray-400 mb-3">{t('stockManagement.cockpit.abcMix')}</p>
                    <div className="space-y-3">
                      {abcSummary.map((row) => (
                        <div key={row.abcClass}>
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>{t('stockManagement.cockpit.abcClass', { cls: row.abcClass })}</span>
                            <span>
                              {t('stockManagement.cockpit.abcProducts', {
                                count: row.count,
                                share: formatNumber(row.share, 1),
                              })}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                            <div
                              className={`${row.abcClass === 'A' ? 'bg-red-400' : row.abcClass === 'B' ? 'bg-amber-400' : 'bg-blue-400'} h-full rounded-full`}
                              style={{ width: `${Math.min(100, row.share)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-900 border-gray-800" data-testid="stock-valuation-panel">
              <CardHeader className="pb-4">
                <CardTitle className="text-white">{t('stockManagement.cockpit.valuationTitle')}</CardTitle>
                <p className="text-sm text-gray-400">{t('stockManagement.cockpit.valuationSubtitle')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      {t('stockManagement.cockpit.fifoStock')}
                    </p>
                    <p className="text-xl font-semibold text-blue-400 mt-2">
                      {formatNumber(stockValuationSummary.totalInventoryFifo)} {currencySymbol}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      {t('stockManagement.cockpit.cmupStock')}
                    </p>
                    <p className="text-xl font-semibold text-indigo-300 mt-2">
                      {formatNumber(stockValuationSummary.totalInventoryCmup)} {currencySymbol}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      {t('stockManagement.cockpit.fifoCogs')}
                    </p>
                    <p className="text-xl font-semibold text-rose-300 mt-2">
                      {formatNumber(stockValuationSummary.totalFifoCogs)} {currencySymbol}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      {t('stockManagement.cockpit.cmupCogs')}
                    </p>
                    <p className="text-xl font-semibold text-orange-300 mt-2">
                      {formatNumber(stockValuationSummary.totalCmupCogs)} {currencySymbol}
                    </p>
                  </div>
                </div>

                {valuationContextLoading ? (
                  <p className="text-sm text-gray-500">{t('stockManagement.cockpit.valuationLoading')}</p>
                ) : stockValuationRows.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('stockManagement.cockpit.noTrackedFilter')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-800 hover:bg-transparent">
                          <TableHead className="text-gray-400">{t('stockManagement.valuationTable.product')}</TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.valuationTable.stock')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.valuationTable.fifo')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.valuationTable.cmup')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.valuationTable.gap')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.valuationTable.fifoCogs')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.valuationTable.cmupCogs')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.valuationTable.soldQty')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockValuationRows.slice(0, 12).map((row) => (
                          <TableRow key={row.productId} className="border-gray-800">
                            <TableCell>
                              <div>
                                <p className="font-medium text-white">{row.productName}</p>
                                <p className="text-xs text-gray-500">
                                  {row.sku || t('stockManagement.valuationTable.noSku')}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-white">{formatNumber(row.stockQuantity)}</TableCell>
                            <TableCell className="text-right text-blue-300">
                              {formatNumber(row.fifoInventoryValue)} {currencySymbol}
                            </TableCell>
                            <TableCell className="text-right text-indigo-200">
                              {formatNumber(row.cmupInventoryValue)} {currencySymbol}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${row.valuationGap >= 0 ? 'text-emerald-300' : 'text-red-300'}`}
                            >
                              {formatNumber(row.valuationGap)} {currencySymbol}
                            </TableCell>
                            <TableCell className="text-right text-rose-200">
                              {formatNumber(row.fifoCogs)} {currencySymbol}
                            </TableCell>
                            <TableCell className="text-right text-orange-200">
                              {formatNumber(row.cmupCogs)} {currencySymbol}
                            </TableCell>
                            <TableCell className="text-right text-gray-300">{formatNumber(row.soldQuantity)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-white">{t('stockManagement.cockpit.replenishmentTitle')}</CardTitle>
                <p className="text-sm text-gray-400">{t('stockManagement.cockpit.replenishmentSubtitle')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      {t('stockManagement.cockpit.itemsToOrder')}
                    </p>
                    <p className="text-xl font-semibold text-white mt-1">{replenishmentSummary.totalRecommendations}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      {t('stockManagement.cockpit.criticalAlerts')}
                    </p>
                    <p className="text-xl font-semibold text-red-300 mt-1">{replenishmentSummary.criticalCount}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      {t('stockManagement.cockpit.recommendedBudget')}
                    </p>
                    <p className="text-xl font-semibold text-orange-300 mt-1">
                      {formatNumber(replenishmentSummary.totalOrderValue)} {currencySymbol}
                    </p>
                  </div>
                </div>

                {replenishmentRecommendations.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('stockManagement.cockpit.noReplenishment')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-800 hover:bg-transparent">
                          <TableHead className="text-gray-400">
                            {t('stockManagement.replenishmentTable.product')}
                          </TableHead>
                          <TableHead className="text-gray-400">
                            {t('stockManagement.replenishmentTable.priority')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.replenishmentTable.stock')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.replenishmentTable.dailyConsumption')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.replenishmentTable.coverage')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.replenishmentTable.recommendedQty')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.replenishmentTable.orderDate')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.replenishmentTable.purchaseBudget')}
                          </TableHead>
                          <TableHead className="text-gray-400">
                            {t('stockManagement.replenishmentTable.action')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {replenishmentRecommendations.slice(0, 12).map((recommendation) => (
                          <TableRow key={recommendation.productId} className="border-gray-800">
                            <TableCell>
                              <div>
                                <p className="font-medium text-white">{recommendation.productName}</p>
                                <p className="text-xs text-gray-500">
                                  {recommendation.sku || t('stockManagement.replenishmentTable.noSku')}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{getReplenishmentPriorityBadge(recommendation.priority)}</TableCell>
                            <TableCell className="text-right text-white">
                              {formatNumber(recommendation.stockQuantity)}
                            </TableCell>
                            <TableCell className="text-right text-gray-300">
                              {formatNumber(recommendation.dailyDemand)}
                            </TableCell>
                            <TableCell className="text-right text-gray-300">
                              {Number.isFinite(recommendation.daysOfCover)
                                ? formatNumber(recommendation.daysOfCover)
                                : '∞'}
                            </TableCell>
                            <TableCell className="text-right text-yellow-400 font-medium">
                              {formatNumber(recommendation.reorderQuantity)}
                            </TableCell>
                            <TableCell className="text-right text-gray-300">
                              {recommendation.suggestedOrderDate}
                            </TableCell>
                            <TableCell className="text-right text-white font-medium">
                              {formatNumber(recommendation.recommendedOrderValue)} {currencySymbol}
                            </TableCell>
                            <TableCell className="text-gray-300">{recommendation.nextAction}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="mt-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-0">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                    <p>{t('stockManagement.inventory.noProducts')}</p>
                    <p className="text-sm mt-1">{t('stockManagement.inventory.noProductsSubtitle')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-800 hover:bg-transparent">
                          <TableHead className="text-gray-400">
                            {t('stockManagement.inventory.columns.product')}
                          </TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.inventory.columns.sku')}</TableHead>
                          <TableHead className="text-gray-400">
                            {t('stockManagement.inventory.columns.category')}
                          </TableHead>
                          <TableHead className="text-gray-400">
                            {t('stockManagement.inventory.columns.supplier')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.inventory.columns.salePrice')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.inventory.columns.purchasePrice')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.inventory.columns.stock')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.inventory.columns.min')}
                          </TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.inventory.columns.mode')}</TableHead>
                          <TableHead className="text-gray-400">
                            {t('stockManagement.inventory.columns.status')}
                          </TableHead>
                          <TableHead className="text-gray-400">
                            {t('stockManagement.inventory.columns.actions')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedProducts.map((product) => (
                          <TableRow key={product.id} className="border-gray-800">
                            <TableCell className="font-medium">{product.product_name}</TableCell>
                            <TableCell className="text-gray-400">{product.sku || '—'}</TableCell>
                            <TableCell className="text-gray-400">{product.category?.name || '—'}</TableCell>
                            <TableCell className="text-gray-400">{product.supplier?.company_name || '—'}</TableCell>
                            <TableCell className="text-right">
                              {formatNumber(product.unit_price || 0)} {currencySymbol}
                            </TableCell>
                            <TableCell className="text-right text-gray-400">
                              {formatNumber(product.purchase_price || 0)} {currencySymbol}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {product.inventory_tracking_enabled === false ? '—' : product.stock_quantity}
                            </TableCell>
                            <TableCell className="text-right text-gray-400">
                              {product.inventory_tracking_enabled === false ? '—' : product.min_stock_level}
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {product.inventory_tracking_enabled === false
                                ? t('stockManagement.inventory.modeUnstocked')
                                : t('stockManagement.inventory.modeStocked')}
                            </TableCell>
                            <TableCell>{getStockBadge(product)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-300 hover:text-white"
                                  onClick={() => setViewProduct(product)}
                                  title={t('stockManagement.viewDialog.title')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-300 hover:text-blue-200"
                                  onClick={() => openEditProductDialog(product)}
                                  title={t('stockManagement.viewDialog.edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-300 hover:text-amber-200"
                                  onClick={() => openPricingDialog(product)}
                                  title={t('stockManagement.pricingDialog.title')}
                                >
                                  <Wallet className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-400 hover:text-red-300"
                                  onClick={() => setDeleteTargetProduct(product)}
                                  title={t('stockManagement.deleteDialog.confirm')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <Select value={historyProductId || ''} onValueChange={(v) => loadHistory(v)}>
                <SelectTrigger className="w-full sm:w-[300px] bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder={t('stockManagement.history.selectProduct')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {trackedProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {historyProductId && (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-0">
                  {history.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">{t('stockManagement.history.noHistory')}</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-800 hover:bg-transparent">
                          <TableHead className="text-gray-400">{t('stockManagement.history.columns.date')}</TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.history.columns.before')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.history.columns.after')}
                          </TableHead>
                          <TableHead className="text-gray-400 text-right">
                            {t('stockManagement.history.columns.change')}
                          </TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.history.columns.reason')}</TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.history.columns.notes')}</TableHead>
                          <TableHead className="text-gray-400">{t('stockManagement.history.columns.by')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((h) => (
                          <TableRow key={h.id} className="border-gray-800">
                            <TableCell className="text-gray-400">
                              {new Date(h.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell className="text-right">{h.previous_quantity}</TableCell>
                            <TableCell className="text-right">{h.new_quantity}</TableCell>
                            <TableCell
                              className={`text-right font-medium ${h.change_quantity >= 0 ? 'text-green-400' : 'text-red-400'}`}
                            >
                              {h.change_quantity >= 0 ? '+' : ''}
                              {h.change_quantity}
                            </TableCell>
                            <TableCell className="text-gray-400">{h.reason}</TableCell>
                            <TableCell className="text-gray-400 text-sm">{h.notes || '—'}</TableCell>
                            <TableCell className="text-gray-400 text-sm">{h.created_by_user?.email || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('stockManagement.addProduct', 'Add a product')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.productName')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    value={newProduct.product_name}
                    onChange={(e) => setNewProduct((p) => ({ ...p, product_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.sku')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.salePrice', { currency: currencySymbol })}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700"
                    value={newProduct.unit_price}
                    onChange={(e) => setNewProduct((p) => ({ ...p, unit_price: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.purchasePrice', { currency: currencySymbol })}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700"
                    value={newProduct.purchase_price}
                    onChange={(e) => setNewProduct((p) => ({ ...p, purchase_price: e.target.value }))}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-white">{t('stockManagement.addDialog.inventoryTracking')}</Label>
                    <p className="text-sm text-gray-400">{t('stockManagement.addDialog.inventoryTrackingHint')}</p>
                  </div>
                  <Switch
                    checked={newProduct.inventory_tracking_enabled !== false}
                    onCheckedChange={(checked) =>
                      setNewProduct((p) => ({
                        ...p,
                        inventory_tracking_enabled: checked,
                        stock_quantity: checked ? p.stock_quantity : '0',
                        min_stock_level: checked ? (p.min_stock_level === '0' ? '5' : p.min_stock_level) : '0',
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.unit')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct((p) => ({ ...p, unit: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.initialStock')}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700 disabled:opacity-50"
                    value={newProduct.stock_quantity}
                    disabled={newProduct.inventory_tracking_enabled === false}
                    onChange={(e) => setNewProduct((p) => ({ ...p, stock_quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.minStock')}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700 disabled:opacity-50"
                    value={newProduct.min_stock_level}
                    disabled={newProduct.inventory_tracking_enabled === false}
                    onChange={(e) => setNewProduct((p) => ({ ...p, min_stock_level: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('stockManagement.addDialog.category')}</Label>
                <Select
                  value={newProduct.category_id}
                  onValueChange={(v) => setNewProduct((p) => ({ ...p, category_id: v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder={t('stockManagement.addDialog.noneCategory')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('stockManagement.addDialog.supplier')}</Label>
                <Select
                  value={newProduct.supplier_id || 'none'}
                  onValueChange={(v) => setNewProduct((p) => ({ ...p, supplier_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder={t('stockManagement.addDialog.noneSupplier')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="none">{t('stockManagement.addDialog.noneSupplier')}</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newProduct.inventory_tracking_enabled !== false && !newProduct.supplier_id ? (
                  <p className="text-xs text-amber-300">{t('stockManagement.addDialog.supplierRecommended')}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t('stockManagement.addDialog.description')}</Label>
                <Textarea
                  className="bg-gray-800 border-gray-700"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleAddProduct}
                disabled={
                  !newProduct.product_name ||
                  loading ||
                  (newProduct.inventory_tracking_enabled !== false && !newProduct.supplier_id)
                }
              >
                {t('common.create', 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(viewProduct)} onOpenChange={(open) => !open && setViewProduct(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('stockManagement.viewDialog.title')}</DialogTitle>
            </DialogHeader>
            {viewProduct ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.name')}</p>
                    <p className="font-medium">{viewProduct.product_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.sku')}</p>
                    <p className="font-medium">{viewProduct.sku || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.category')}</p>
                    <p className="font-medium">{viewProduct.category?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.supplier')}</p>
                    <p className="font-medium">{viewProduct.supplier?.company_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.salePrice')}</p>
                    <p className="font-medium">
                      {formatNumber(viewProduct.unit_price || 0)} {currencySymbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.purchasePrice')}</p>
                    <p className="font-medium">
                      {formatNumber(viewProduct.purchase_price || 0)} {currencySymbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.stock')}</p>
                    <p className="font-medium">
                      {viewProduct.inventory_tracking_enabled === false ? '—' : viewProduct.stock_quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t('stockManagement.viewDialog.minStock')}</p>
                    <p className="font-medium">
                      {viewProduct.inventory_tracking_enabled === false ? '—' : viewProduct.min_stock_level}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">{t('stockManagement.viewDialog.description')}</p>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{viewProduct.description || '—'}</p>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewProduct(null)}>
                {t('stockManagement.viewDialog.close')}
              </Button>
              <Button
                variant="outline"
                className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                onClick={() => {
                  if (!viewProduct) return;
                  openEditProductDialog(viewProduct);
                  setViewProduct(null);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" /> {t('stockManagement.viewDialog.edit')}
              </Button>
              <Button
                variant="outline"
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                onClick={() => {
                  if (!viewProduct) return;
                  openPricingDialog(viewProduct);
                  setViewProduct(null);
                }}
              >
                <Wallet className="w-4 h-4 mr-2" /> {t('stockManagement.viewDialog.priceQty')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(editProduct)}
          onOpenChange={(open) => {
            if (!open) {
              setEditProduct(null);
              setEditProductForm(DEFAULT_PRODUCT_EDIT_FORM);
            }
          }}
        >
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('stockManagement.editDialog.title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.productName')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    value={editProductForm.product_name}
                    onChange={(e) => setEditProductForm((prev) => ({ ...prev, product_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.sku')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    value={editProductForm.sku}
                    onChange={(e) => setEditProductForm((prev) => ({ ...prev, sku: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.salePrice', { currency: currencySymbol })}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700"
                    value={editProductForm.unit_price}
                    onChange={(e) => setEditProductForm((prev) => ({ ...prev, unit_price: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.addDialog.purchasePrice', { currency: currencySymbol })}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700"
                    value={editProductForm.purchase_price}
                    onChange={(e) => setEditProductForm((prev) => ({ ...prev, purchase_price: e.target.value }))}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-white">{t('stockManagement.editDialog.inventoryTracking')}</Label>
                    <p className="text-sm text-gray-400">{t('stockManagement.editDialog.inventoryTrackingHint')}</p>
                  </div>
                  <Switch
                    checked={editProductForm.inventory_tracking_enabled !== false}
                    onCheckedChange={(checked) =>
                      setEditProductForm((prev) => ({
                        ...prev,
                        inventory_tracking_enabled: checked,
                        stock_quantity: checked ? prev.stock_quantity : '0',
                        min_stock_level: checked ? (prev.min_stock_level === '0' ? '5' : prev.min_stock_level) : '0',
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.editDialog.unit')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    value={editProductForm.unit}
                    onChange={(e) => setEditProductForm((prev) => ({ ...prev, unit: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.editDialog.stock')}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700 disabled:opacity-50"
                    disabled={editProductForm.inventory_tracking_enabled === false}
                    value={editProductForm.stock_quantity}
                    onChange={(e) => setEditProductForm((prev) => ({ ...prev, stock_quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.editDialog.minStock')}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700 disabled:opacity-50"
                    disabled={editProductForm.inventory_tracking_enabled === false}
                    value={editProductForm.min_stock_level}
                    onChange={(e) => setEditProductForm((prev) => ({ ...prev, min_stock_level: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('stockManagement.editDialog.category')}</Label>
                <Select
                  value={editProductForm.category_id || 'none'}
                  onValueChange={(value) =>
                    setEditProductForm((prev) => ({ ...prev, category_id: value === 'none' ? '' : value }))
                  }
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder={t('stockManagement.addDialog.noneCategory')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="none">{t('stockManagement.addDialog.noneCategory')}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('stockManagement.editDialog.supplier')}</Label>
                <Select
                  value={editProductForm.supplier_id || 'none'}
                  onValueChange={(value) =>
                    setEditProductForm((prev) => ({ ...prev, supplier_id: value === 'none' ? '' : value }))
                  }
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder={t('stockManagement.addDialog.noneSupplier')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="none">{t('stockManagement.addDialog.noneSupplier')}</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('stockManagement.editDialog.description')}</Label>
                <Textarea
                  className="bg-gray-800 border-gray-700"
                  value={editProductForm.description}
                  onChange={(e) => setEditProductForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditProduct(null);
                  setEditProductForm(DEFAULT_PRODUCT_EDIT_FORM);
                }}
              >
                {t('stockManagement.editDialog.cancel')}
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleUpdateProductDetails}
                disabled={!editProductForm.product_name || loading}
              >
                {t('stockManagement.editDialog.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(pricingProduct)}
          onOpenChange={(open) => {
            if (!open) {
              setPricingProduct(null);
              setPricingForm(DEFAULT_PRODUCT_PRICING_FORM);
            }
          }}
        >
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>{t('stockManagement.pricingDialog.title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('stockManagement.pricingDialog.salePrice', { currency: currencySymbol })}</Label>
                <Input
                  type="number"
                  className="bg-gray-800 border-gray-700"
                  value={pricingForm.unit_price}
                  onChange={(e) => setPricingForm((prev) => ({ ...prev, unit_price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('stockManagement.pricingDialog.purchasePrice', { currency: currencySymbol })}</Label>
                <Input
                  type="number"
                  className="bg-gray-800 border-gray-700"
                  value={pricingForm.purchase_price}
                  onChange={(e) => setPricingForm((prev) => ({ ...prev, purchase_price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">{t('stockManagement.pricingDialog.inventoryTracking')}</Label>
                <div className="flex items-center gap-3 rounded border border-gray-800 bg-gray-900/70 px-3 py-2">
                  <Switch
                    checked={pricingForm.inventory_tracking_enabled !== false}
                    onCheckedChange={(checked) =>
                      setPricingForm((prev) => ({
                        ...prev,
                        inventory_tracking_enabled: checked,
                        stock_quantity: checked ? prev.stock_quantity : '0',
                        min_stock_level: checked ? (prev.min_stock_level === '0' ? '5' : prev.min_stock_level) : '0',
                      }))
                    }
                  />
                  <span className="text-sm text-gray-300">
                    {pricingForm.inventory_tracking_enabled !== false
                      ? t('stockManagement.pricingDialog.stocked')
                      : t('stockManagement.pricingDialog.unstocked')}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('stockManagement.pricingDialog.stockQuantity')}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700 disabled:opacity-50"
                    disabled={pricingForm.inventory_tracking_enabled === false}
                    value={pricingForm.stock_quantity}
                    onChange={(e) => setPricingForm((prev) => ({ ...prev, stock_quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stockManagement.pricingDialog.minThreshold')}</Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700 disabled:opacity-50"
                    disabled={pricingForm.inventory_tracking_enabled === false}
                    value={pricingForm.min_stock_level}
                    onChange={(e) => setPricingForm((prev) => ({ ...prev, min_stock_level: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setPricingProduct(null);
                  setPricingForm(DEFAULT_PRODUCT_PRICING_FORM);
                }}
              >
                {t('stockManagement.pricingDialog.cancel')}
              </Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleUpdatePricing} disabled={loading}>
                {t('stockManagement.pricingDialog.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(deleteTargetProduct)} onOpenChange={(open) => !open && setDeleteTargetProduct(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>{t('stockManagement.deleteDialog.title')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-300">
              {t('stockManagement.deleteDialog.message', { name: deleteTargetProduct?.product_name || '—' })}
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTargetProduct(null)}>
                {t('stockManagement.deleteDialog.cancel')}
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteProductConfirm}
                disabled={loading}
              >
                {t('stockManagement.deleteDialog.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default StockManagement;
