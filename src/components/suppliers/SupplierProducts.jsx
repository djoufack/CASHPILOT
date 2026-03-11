import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSupplierProducts } from '@/hooks/useSupplierProducts';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { exportSupplierProductPDF, exportSupplierProductHTML } from '@/services/exportSupplierRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertTriangle, Download, Eye, Pencil, FileText } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY_FORM = {
  product_name: '',
  category_id: '',
  sku: '',
  unit_price: '',
  stock_quantity: 0,
  min_stock_level: 5,
};

const SupplierProducts = ({ supplierId, supplier }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { company } = useCompany();
  const { settings: invoiceSettings } = useInvoiceSettings();
  const { products, categories, loading, createProduct, updateProduct, deleteProduct } = useSupplierProducts(supplierId);
  const { importFromSupplier } = useProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const currency = supplier?.currency || company?.accounting_currency || 'EUR';

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  };

  const getStockSnapshot = (product) => {
    const stock = Number(product?.stock_quantity || 0);
    const minStock = Number(product?.min_stock_level || 0);
    if (stock <= 0) return { label: 'Rupture', className: 'bg-red-500/20 text-red-300 border-red-500/40', reorderQty: Math.max(minStock, 1) };
    if (stock <= minStock) return { label: 'Stock bas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', reorderQty: Math.max(minStock - stock, 1) };
    return { label: 'Stock OK', className: 'bg-green-500/20 text-green-300 border-green-500/40', reorderQty: 0 };
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingProductId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProductId(product.id);
    setFormData({
      product_name: product.product_name || '',
      category_id: product.category_id || '',
      sku: product.sku || '',
      unit_price: product.unit_price ?? '',
      stock_quantity: product.stock_quantity ?? 0,
      min_stock_level: product.min_stock_level ?? 5,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingProductId) {
      await updateProduct(editingProductId, formData);
    } else {
      await createProduct(formData);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = async (product) => {
    const confirmed = window.confirm(
      t('supplierProducts.confirmDelete', 'Supprimer ce produit fournisseur ?'),
    );
    if (!confirmed) return;
    await deleteProduct(product.id);
  };

  const handleExportPdf = async (product) => {
    try {
      await exportSupplierProductPDF(product, supplier, company, invoiceSettings);
    } catch (error) {
      toast({
        title: t('common.error', 'Erreur'),
        description: error?.message || t('common.exportError', "Echec de l'export PDF"),
        variant: 'destructive',
      });
    }
  };

  const handleExportHtml = async (product) => {
    try {
      await exportSupplierProductHTML(product, supplier, company, invoiceSettings);
    } catch (error) {
      toast({
        title: t('common.error', 'Erreur'),
        description: error?.message || t('common.exportError', "Echec de l'export HTML"),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gradient">{t('supplierProducts.title')}</h3>
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" /> {t('supplierProducts.addProduct')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>
                {editingProductId ? t('supplierProducts.editProduct', 'Modifier le produit') : t('supplierProducts.addProduct')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('supplierProducts.productName')}</Label>
                <Input
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  required
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierProducts.category')}</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(val) => setFormData({ ...formData, category_id: val })}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600">
                      <SelectValue placeholder={t('supplierProducts.selectCategory')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierProducts.sku')}</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierProducts.unitPrice')}</Label>
                  <Input
                    type="number"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierProducts.stock')}</Label>
                  <Input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierProducts.minStock')}</Label>
                  <Input
                    type="number"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-green-600">
                {editingProductId ? t('common.save', 'Enregistrer') : t('supplierProducts.saveProduct')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!viewingProduct} onOpenChange={(open) => !open && setViewingProduct(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('common.view', 'Visualiser')} - {viewingProduct?.product_name}</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400">{t('supplierProducts.sku')}</p>
                  <p className="font-semibold">{viewingProduct.sku || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('supplierProducts.price')}</p>
                  <p className="font-semibold">{formatMoney(viewingProduct.unit_price)}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('supplierProducts.stock')}</p>
                  <p className="font-semibold">{viewingProduct.stock_quantity ?? 0}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('supplierProducts.minStock')}</p>
                  <p className="font-semibold">{viewingProduct.min_stock_level ?? 0}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400">Situation stock</p>
                  <Badge variant="outline" className={getStockSnapshot(viewingProduct).className}>
                    {getStockSnapshot(viewingProduct).label}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="border-gray-700" onClick={() => handleExportPdf(viewingProduct)}>
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" className="border-gray-700" onClick={() => handleExportHtml(viewingProduct)}>
                  <FileText className="w-4 h-4 mr-2" /> HTML
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="rounded-md border border-gray-800 bg-gray-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800">
              <TableHead className="text-gray-400">{t('supplierProducts.product')}</TableHead>
              <TableHead className="text-gray-400">{t('supplierProducts.sku')}</TableHead>
              <TableHead className="text-gray-400">{t('supplierProducts.category')}</TableHead>
              <TableHead className="text-gray-400">{t('supplierProducts.price')}</TableHead>
              <TableHead className="text-gray-400">{t('supplierProducts.stock')}</TableHead>
              <TableHead className="text-gray-400">Situation stock</TableHead>
              <TableHead className="text-gray-400">Etat reappr.</TableHead>
              <TableHead className="text-right text-gray-400">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                  {t('loading.data', 'Chargement des donnees...')}
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => {
              const stockSnapshot = getStockSnapshot(product);
              return (
                <TableRow key={product.id} className="border-gray-800">
                  <TableCell className="font-medium text-gradient">{product.product_name}</TableCell>
                  <TableCell className="text-gray-400 text-xs">{product.sku}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                      {product.category?.name || t('supplierProducts.uncategorized')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">{formatMoney(product.unit_price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={stockSnapshot.label !== 'Stock OK' ? 'text-red-400 font-bold' : 'text-green-400'}>
                        {product.stock_quantity}
                      </span>
                      {stockSnapshot.label !== 'Stock OK' && <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={stockSnapshot.className}>
                      {stockSnapshot.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {stockSnapshot.reorderQty > 0 ? `Commander ${stockSnapshot.reorderQty}` : 'RAS'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300" onClick={() => setViewingProduct(product)} title="Visualiser">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300" onClick={() => openEditModal(product)} title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300" onClick={() => handleExportPdf(product)} title="Export PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" onClick={() => handleExportHtml(product)} title="Export HTML">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => importFromSupplier({ ...product, supplier_id: supplierId })}
                        className="text-green-400 hover:text-green-300"
                        title={t('supplierProducts.importToStock')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product)}
                        className="text-red-400 hover:text-red-300"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && products.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-6">{t('supplierProducts.noProducts')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SupplierProducts;
