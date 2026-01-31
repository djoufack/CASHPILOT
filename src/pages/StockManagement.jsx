
import React, { useState, useEffect } from 'react';
import { useStockAlerts, useStockHistory } from '@/hooks/useStockHistory';
import { useProducts, useProductCategories } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Search, Plus, Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const StockManagement = () => {
  const { alerts, fetchAlerts, resolveAlert } = useStockAlerts();
  const { getProductHistory, addHistoryEntry, loading: historyLoading } = useStockHistory();
  const { products, loading, createProduct, updateProduct, deleteProduct, fetchProducts } = useProducts();
  const { categories } = useProductCategories();

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

  // Add product dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: '', sku: '', category_id: '', unit_price: '', purchase_price: '',
    unit: 'pièce', stock_quantity: '0', min_stock_level: '5', description: ''
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchSearch = !searchTerm ||
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    return matchSearch && matchCategory;
  });

  // Stats
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level).length;
  const outOfStockCount = products.filter(p => p.stock_quantity <= 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);

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

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Gestion du Stock</h1>
          <p className="text-gray-400">Gérez votre inventaire, alertes et mouvements de stock.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white w-[200px]"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Toutes catégories" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4 mr-2" /> Nouveau produit
              </Button>
            </DialogTrigger>
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
                    <Label>Prix de vente (€)</Label>
                    <Input type="number" className="bg-gray-800 border-gray-700" value={newProduct.unit_price}
                      onChange={e => setNewProduct(p => ({ ...p, unit_price: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix d'achat (€)</Label>
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
      </div>

      {/* Stats Cards */}
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
            <div className="text-2xl font-bold text-green-400">{totalValue.toFixed(2)} €</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
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

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="inventory">Inventaire</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="adjustments">Ajustements</TabsTrigger>
        </TabsList>

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
                    {filteredProducts.map(product => (
                      <TableRow key={product.id} className="border-gray-800">
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell className="text-gray-400">{product.sku || '—'}</TableCell>
                        <TableCell className="text-gray-400">{product.category?.name || '—'}</TableCell>
                        <TableCell className="text-right">{product.unit_price?.toFixed(2)} €</TableCell>
                        <TableCell className="text-right text-gray-400">{product.purchase_price?.toFixed(2)} €</TableCell>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <Select value={historyProductId || ''} onValueChange={v => loadHistory(v)}>
              <SelectTrigger className="w-[300px] bg-gray-800 border-gray-700 text-white">
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
      </Tabs>
    </div>
  );
};

export default StockManagement;
