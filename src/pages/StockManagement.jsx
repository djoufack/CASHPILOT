
import React, { useEffect, useMemo, useState } from 'react';
import { useStockAlerts, useStockHistory } from '@/hooks/useStockHistory';
import { useProducts, useProductCategories } from '@/hooks/useProducts';
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
import { AlertTriangle, Package, Search, Plus, Trash2, Download, FileText, Wallet, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { exportStockListPDF, exportStockListHTML } from '@/services/exportListsPDF';
import ExportButton from '@/components/ExportButton';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';

const StockManagement = () => {
  const { alerts, fetchAlerts, resolveAlert } = useStockAlerts();
  const { getProductHistory, addHistoryEntry, loading: historyLoading } = useStockHistory();
  const { products, loading, createProduct, updateProduct, deleteProduct, fetchProducts } = useProducts();
  const { categories } = useProductCategories();
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

  // Add product dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: '', sku: '', category_id: '', unit_price: '', purchase_price: '',
    unit: 'pièce', stock_quantity: '0', min_stock_level: '5', description: ''
  });

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const pagination = usePagination({ pageSize: 25 });
  const { setTotalCount } = pagination;

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchSearch = !searchTerm ||
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    return matchSearch && matchCategory;
  });

  useEffect(() => {
    setTotalCount(filteredProducts.length);
  }, [filteredProducts.length, setTotalCount]);

  const paginatedProducts = filteredProducts.slice(pagination.from, pagination.to + 1);

  // Stats
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level).length;
  const outOfStockCount = products.filter(p => p.stock_quantity <= 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);

  const stockInsights = useMemo(() => {
    return filteredProducts.map(product => {
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
  }, [filteredProducts]);

  const strategicStock = useMemo(() => {
    const totalCostPool = stockInsights.reduce((sum, product) => sum + product.costValue, 0);
    let runningCost = 0;

    return [...stockInsights]
      .sort((a, b) => b.costValue - a.costValue)
      .map(product => {
        runningCost += product.costValue;
        const cumulativeShare = totalCostPool > 0 ? runningCost / totalCostPool : 0;
        const abcClass = cumulativeShare <= 0.8 ? 'A' : cumulativeShare <= 0.95 ? 'B' : 'C';
        return { ...product, abcClass, cumulativeShare };
      });
  }, [stockInsights]);

  const valuationMap = {
    cost: {
      label: 'Valeur de revient',
      metricKey: 'costValue',
      accentClass: 'text-blue-400',
    },
    retail: {
      label: 'Valeur de vente',
      metricKey: 'retailValue',
      accentClass: 'text-emerald-400',
    },
    margin: {
      label: 'Marge potentielle',
      metricKey: 'potentialMargin',
      accentClass: 'text-orange-400',
    },
  };

  const selectedValuation = valuationMap[valuationMode] || valuationMap.cost;

  const inventoryValueAtCost = strategicStock.reduce((sum, product) => sum + product.costValue, 0);
  const inventoryValueAtRetail = strategicStock.reduce((sum, product) => sum + product.retailValue, 0);
  const potentialMarginValue = strategicStock.reduce((sum, product) => sum + product.potentialMargin, 0);
  const reorderExposure = strategicStock.reduce((sum, product) => sum + product.reorderCost, 0);
  const missingPurchasePriceCount = strategicStock.filter(product => product.stockQuantity > 0 && product.purchasePrice <= 0).length;
  const negativeMarginCount = strategicStock.filter(product => product.stockQuantity > 0 && product.unitPrice > 0 && product.potentialMargin < 0).length;

  const reorderPriorities = useMemo(() => {
    return strategicStock
      .filter(product => product.reorderUnits > 0)
      .sort((a, b) => {
        if (b.reorderCost !== a.reorderCost) return b.reorderCost - a.reorderCost;
        return b.reorderUnits - a.reorderUnits;
      })
      .slice(0, 8);
  }, [strategicStock]);

  const highValueProducts = useMemo(() => {
    const metricKey = selectedValuation.metricKey;
    return [...strategicStock]
      .sort((a, b) => Number(b[metricKey] || 0) - Number(a[metricKey] || 0))
      .slice(0, 8);
  }, [selectedValuation.metricKey, strategicStock]);

  const abcSummary = useMemo(() => {
    return ['A', 'B', 'C'].map(abcClass => {
      const items = strategicStock.filter(product => product.abcClass === abcClass);
      const value = items.reduce((sum, product) => sum + product.costValue, 0);
      return {
        abcClass,
        count: items.length,
        value,
        share: inventoryValueAtCost > 0 ? (value / inventoryValueAtCost) * 100 : 0,
      };
    });
  }, [inventoryValueAtCost, strategicStock]);

  // Load history for selected product
  const loadHistory = async (productId) => {
    setHistoryProductId(productId);
    const data = await getProductHistory(productId);
    setHistory(data || []);
  };

  // Handle stock adjustment
  const handleAdjustment = async () => {
    if (!adjProductId || adjNewQty === '') return;
    const product = products.find(p => p.id === adjProductId);
    if (!product) return;

    const success = await addHistoryEntry({
      productId: adjProductId,
      previousQty: product.stock_quantity,
      newQty: parseFloat(adjNewQty),
      reason: adjReason,
      notes: adjNotes
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
    try {
      await createProduct({
        product_name: newProduct.product_name,
        sku: newProduct.sku || null,
        category_id: newProduct.category_id || null,
        unit_price: parseFloat(newProduct.unit_price) || 0,
        purchase_price: parseFloat(newProduct.purchase_price) || 0,
        unit: newProduct.unit,
        stock_quantity: parseFloat(newProduct.stock_quantity) || 0,
        min_stock_level: parseFloat(newProduct.min_stock_level) || 5,
        description: newProduct.description || null,
        is_active: true
      });
      setShowAddDialog(false);
      setNewProduct({
        product_name: '', sku: '', category_id: '', unit_price: '', purchase_price: '',
        unit: 'pièce', stock_quantity: '0', min_stock_level: '5', description: ''
      });
    } catch (err) {
      // Error handled by hook toast
    }
  };

  const getStockBadge = (product) => {
    if (product.stock_quantity <= 0) return <Badge variant="destructive">Rupture</Badge>;
    if (product.stock_quantity <= product.min_stock_level) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Stock bas</Badge>;
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">OK</Badge>;
  };

  const getAbcBadge = (abcClass) => {
    if (abcClass === 'A') {
      return <Badge className="bg-red-500/15 text-red-300 border border-red-500/20">A stratégique</Badge>;
    }
    if (abcClass === 'B') {
      return <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/20">B piloté</Badge>;
    }
    return <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/20">C long tail</Badge>;
  };

  const handleExportPDF = () => {
    guardedAction(
      CREDIT_COSTS.PDF_REPORT,
      'Stock List PDF',
      async () => {
        await exportStockListPDF(filteredProducts, company);
      }
    );
  };

  const handleExportHTML = () => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      'Stock List HTML',
      () => {
        exportStockListHTML(filteredProducts, company);
      }
    );
  };

  const productExportColumns = [
    { key: 'product_name', header: 'Produit', width: 25 },
    { key: 'sku', header: 'SKU', width: 15 },
    { key: 'category_name', header: 'Categorie', width: 15, accessor: (p) => p.category?.name || '' },
    { key: 'unit_price', header: 'Prix vente', type: 'currency', width: 14 },
    { key: 'purchase_price', header: 'Prix achat', type: 'currency', width: 14 },
    { key: 'stock_quantity', header: 'Quantite', type: 'number', width: 10 },
    { key: 'min_stock_level', header: 'Min Stock', type: 'number', width: 10 },
    { key: 'unit', header: 'Unite', width: 10 },
  ];

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="cockpit" className="w-full space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-gradient">Gestion du Stock</h1>
              <p className="text-gray-400">Gérez votre inventaire, alertes et mouvements de stock.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-gray-800 border-gray-700 text-white w-full sm:w-[260px]"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[220px] bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Toutes catégories" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button onClick={() => setShowAddDialog(true)} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4 mr-2" /> Nouveau produit
              </Button>
            </div>
          </div>

          <div className="space-y-4 lg:self-start">
            <div className="flex gap-2 flex-wrap lg:justify-end">
              <ExportButton
                data={filteredProducts}
                columns={productExportColumns}
                filename="products"
              />
              <Button onClick={handleExportPDF} size="sm" variant="outline" className="border-gray-600 hover:bg-gray-700">
                <Download className="w-4 h-4 mr-2" />
                PDF ({CREDIT_COSTS.PDF_REPORT})
              </Button>
              <Button onClick={handleExportHTML} size="sm" variant="outline" className="border-gray-600 hover:bg-gray-700">
                <FileText className="w-4 h-4 mr-2" />
                HTML ({CREDIT_COSTS.EXPORT_HTML})
              </Button>
            </div>

            <TabsList className="bg-gray-900 border border-gray-800 w-full h-auto p-1 grid grid-cols-2 md:grid-cols-4 gap-1">
              <TabsTrigger value="cockpit">Cockpit stock</TabsTrigger>
              <TabsTrigger value="inventory">Inventaire</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
              <TabsTrigger value="adjustments">Gestion stock</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Adjustments Tab */}
        <TabsContent value="adjustments" className="mt-4">
          <Card className="bg-gray-900 border-gray-800 max-w-lg mx-auto">
            <CardHeader>
              <CardTitle>Ajustement manuel du stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Produit</Label>
                <Select value={adjProductId} onValueChange={setAdjProductId}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Sélectionnez un produit..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.product_name} (actuel : {p.stock_quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nouvelle quantité</Label>
                  <Input type="number" className="bg-gray-800 border-gray-700" value={adjNewQty}
                    onChange={e => setAdjNewQty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Raison</Label>
                  <Select value={adjReason} onValueChange={setAdjReason}>
                    <SelectTrigger className="bg-gray-800 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="adjustment">Ajustement</SelectItem>
                      <SelectItem value="reception">Réception</SelectItem>
                      <SelectItem value="sale">Vente</SelectItem>
                      <SelectItem value="damage">Perte/Casse</SelectItem>
                      <SelectItem value="return">Retour</SelectItem>
                      <SelectItem value="inventory">Inventaire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input className="bg-gray-800 border-gray-700" placeholder="Notes optionnelles..."
                  value={adjNotes} onChange={e => setAdjNotes(e.target.value)} />
              </div>
              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={handleAdjustment}
                disabled={!adjProductId || adjNewQty === '' || historyLoading}>
                Mettre à jour le stock
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cockpit" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Produits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gradient">{totalProducts}</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Stock bas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{lowStockCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Rupture</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{outOfStockCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Valeur du stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{formatNumber(totalValue)} {currencySymbol}</div>
              </CardContent>
            </Card>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Alertes actives</h3>
              <div className="grid gap-2">
                {alerts.map(alert => (
                  <Alert key={alert.id} className="bg-gray-900 border border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${alert.alert_type === 'out_of_stock' ? 'text-red-500' : 'text-yellow-500'}`} />
                      <div>
                        <AlertTitle className="text-gradient">{alert.product?.product_name}</AlertTitle>
                        <AlertDescription className="text-gray-400">
                          Actuel : {alert.product?.stock_quantity} | Min : {alert.product?.min_stock_level}
                        </AlertDescription>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>Résoudre</Button>
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
                  Valeur de revient
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">
                  {formatNumber(inventoryValueAtCost)} {currencySymbol}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Base achats de votre stock filtré.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Valeur de vente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">
                  {formatNumber(inventoryValueAtRetail)} {currencySymbol}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Projection si tout le stock est vendu au tarif actuel.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-400" />
                  Marge potentielle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${potentialMarginValue >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                  {formatNumber(potentialMarginValue)} {currencySymbol}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ecart entre valeur de vente et valeur de revient.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Réappro prioritaire
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-400">
                  {formatNumber(reorderExposure)} {currencySymbol}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Budget achat à prévoir pour remettre les articles sous seuil au niveau cible.
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
                      Articles stratégiques
                    </CardTitle>
                    <p className="text-sm text-gray-400 mt-1">
                      Classement ABC et priorisation selon la valorisation choisie.
                    </p>
                  </div>
                  <Select value={valuationMode} onValueChange={setValuationMode}>
                    <SelectTrigger className="w-full md:w-[220px] bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="cost">Valeur de revient</SelectItem>
                      <SelectItem value="retail">Valeur de vente</SelectItem>
                      <SelectItem value="margin">Marge potentielle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {highValueProducts.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun produit ne correspond au filtre courant.</p>
                ) : highValueProducts.map(product => (
                  <div key={product.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white">{product.product_name}</p>
                          {getAbcBadge(product.abcClass)}
                          {getStockBadge(product)}
                        </div>
                        <p className="text-xs text-gray-500">
                          SKU: {product.sku || '—'} • Stock: {product.stockQuantity} • Seuil mini: {product.minStockLevel}
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
                        <p className="text-gray-500 text-xs uppercase tracking-wider">Coût unitaire</p>
                        <p className="text-white font-medium mt-1">{formatNumber(product.purchasePrice)} {currencySymbol}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-md p-3">
                        <p className="text-gray-500 text-xs uppercase tracking-wider">Prix de vente</p>
                        <p className="text-white font-medium mt-1">{formatNumber(product.unitPrice)} {currencySymbol}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-md p-3">
                        <p className="text-gray-500 text-xs uppercase tracking-wider">Marge brute unitaire</p>
                        <p className={`font-medium mt-1 ${product.grossMarginPct != null && product.grossMarginPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {product.grossMarginPct == null ? 'Non calculable' : `${formatNumber(product.grossMarginPct, 1)} %`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-white">Qualité du portefeuille</CardTitle>
                <p className="text-sm text-gray-400">
                  Points de vigilance sur vos articles filtrés.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <p className="text-sm text-gray-400">Coûts d'achat manquants</p>
                  <p className="text-2xl font-bold text-white mt-1">{missingPurchasePriceCount}</p>
                  <p className="text-xs text-gray-500 mt-2">Produits avec stock mais sans prix d'achat fiable.</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <p className="text-sm text-gray-400">Marges à risque</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{negativeMarginCount}</p>
                  <p className="text-xs text-gray-500 mt-2">Articles avec valeur de vente inférieure au coût d'achat.</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <p className="text-sm text-gray-400 mb-3">Mix ABC par valeur</p>
                  <div className="space-y-3">
                    {abcSummary.map(row => (
                      <div key={row.abcClass}>
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                          <span>Classe {row.abcClass}</span>
                          <span>{row.count} produit(s) • {formatNumber(row.share, 1)} %</span>
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

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-white">Priorités de réapprovisionnement</CardTitle>
              <p className="text-sm text-gray-400">
                Articles sous le seuil minimum, triés par impact d'achat.
              </p>
            </CardHeader>
            <CardContent>
              {reorderPriorities.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune priorité de réappro sur le filtre courant.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Produit</TableHead>
                        <TableHead className="text-gray-400">Classe</TableHead>
                        <TableHead className="text-gray-400 text-right">Stock</TableHead>
                        <TableHead className="text-gray-400 text-right">Min</TableHead>
                        <TableHead className="text-gray-400 text-right">Écart</TableHead>
                        <TableHead className="text-gray-400 text-right">Budget achat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reorderPriorities.map(product => (
                        <TableRow key={product.id} className="border-gray-800">
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{product.product_name}</p>
                              <p className="text-xs text-gray-500">{product.sku || 'Sans SKU'}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getAbcBadge(product.abcClass)}</TableCell>
                          <TableCell className="text-right text-white">{product.stockQuantity}</TableCell>
                          <TableCell className="text-right text-gray-400">{product.minStockLevel}</TableCell>
                          <TableCell className="text-right text-yellow-400 font-medium">{product.reorderUnits}</TableCell>
                          <TableCell className="text-right text-white font-medium">
                            {formatNumber(product.reorderCost)} {currencySymbol}
                          </TableCell>
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
                  <p>Aucun produit trouvé.</p>
                  <p className="text-sm mt-1">Créez votre premier produit ou importez depuis un catalogue fournisseur.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Produit</TableHead>
                        <TableHead className="text-gray-400">SKU</TableHead>
                        <TableHead className="text-gray-400">Catégorie</TableHead>
                        <TableHead className="text-gray-400 text-right">Prix vente</TableHead>
                        <TableHead className="text-gray-400 text-right">Prix achat</TableHead>
                        <TableHead className="text-gray-400 text-right">Stock</TableHead>
                        <TableHead className="text-gray-400 text-right">Min</TableHead>
                        <TableHead className="text-gray-400">Statut</TableHead>
                        <TableHead className="text-gray-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.map(product => (
                        <TableRow key={product.id} className="border-gray-800">
                          <TableCell className="font-medium">{product.product_name}</TableCell>
                          <TableCell className="text-gray-400">{product.sku || '—'}</TableCell>
                          <TableCell className="text-gray-400">{product.category?.name || '—'}</TableCell>
                          <TableCell className="text-right">{formatNumber(product.unit_price || 0)} {currencySymbol}</TableCell>
                          <TableCell className="text-right text-gray-400">{formatNumber(product.purchase_price || 0)} {currencySymbol}</TableCell>
                          <TableCell className="text-right font-medium">{product.stock_quantity}</TableCell>
                          <TableCell className="text-right text-gray-400">{product.min_stock_level}</TableCell>
                          <TableCell>{getStockBadge(product)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                              onClick={() => deleteProduct(product.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
            <Select value={historyProductId || ''} onValueChange={v => loadHistory(v)}>
              <SelectTrigger className="w-full sm:w-[300px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Sélectionnez un produit..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {historyProductId && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">Aucun historique pour ce produit.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Date</TableHead>
                        <TableHead className="text-gray-400 text-right">Avant</TableHead>
                        <TableHead className="text-gray-400 text-right">Après</TableHead>
                        <TableHead className="text-gray-400 text-right">Variation</TableHead>
                        <TableHead className="text-gray-400">Raison</TableHead>
                        <TableHead className="text-gray-400">Notes</TableHead>
                        <TableHead className="text-gray-400">Par</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map(h => (
                        <TableRow key={h.id} className="border-gray-800">
                          <TableCell className="text-gray-400">
                            {new Date(h.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-right">{h.previous_quantity}</TableCell>
                          <TableCell className="text-right">{h.new_quantity}</TableCell>
                          <TableCell className={`text-right font-medium ${h.change_quantity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {h.change_quantity >= 0 ? '+' : ''}{h.change_quantity}
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
            <DialogTitle>Ajouter un produit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du produit *</Label>
                <Input className="bg-gray-800 border-gray-700" value={newProduct.product_name}
                  onChange={e => setNewProduct(p => ({ ...p, product_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input className="bg-gray-800 border-gray-700" value={newProduct.sku}
                  onChange={e => setNewProduct(p => ({ ...p, sku: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prix de vente ({currencySymbol})</Label>
                <Input type="number" className="bg-gray-800 border-gray-700" value={newProduct.unit_price}
                  onChange={e => setNewProduct(p => ({ ...p, unit_price: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Prix d'achat ({currencySymbol})</Label>
                <Input type="number" className="bg-gray-800 border-gray-700" value={newProduct.purchase_price}
                  onChange={e => setNewProduct(p => ({ ...p, purchase_price: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Unité</Label>
                <Input className="bg-gray-800 border-gray-700" value={newProduct.unit}
                  onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Stock initial</Label>
                <Input type="number" className="bg-gray-800 border-gray-700" value={newProduct.stock_quantity}
                  onChange={e => setNewProduct(p => ({ ...p, stock_quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Stock min.</Label>
                <Input type="number" className="bg-gray-800 border-gray-700" value={newProduct.min_stock_level}
                  onChange={e => setNewProduct(p => ({ ...p, min_stock_level: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={newProduct.category_id} onValueChange={v => setNewProduct(p => ({ ...p, category_id: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="bg-gray-800 border-gray-700" value={newProduct.description}
                onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleAddProduct}
              disabled={!newProduct.product_name || loading}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};

export default StockManagement;
