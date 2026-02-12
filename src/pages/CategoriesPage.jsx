import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProductCategories } from '@/hooks/useProducts';
import { useProducts } from '@/hooks/useProducts';
import { useServiceCategories } from '@/hooks/useServices';
import { useServices } from '@/hooks/useServices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Package, Wrench, Tag, FolderOpen } from 'lucide-react';

const CategoriesPage = () => {
  const { t } = useTranslation();

  const { categories: productCategories, createCategory: createProductCat, updateCategory: updateProductCat, deleteCategory: deleteProductCat } = useProductCategories();
  const { categories: serviceCategories, createCategory: createServiceCat, updateCategory: updateServiceCat, deleteCategory: deleteServiceCat } = useServiceCategories();
  const { products } = useProducts();
  const { services } = useServices();

  // Form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Edit dialog state
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState(null); // 'product' | 'service'

  // Delete dialog state
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  // Items dialog state
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [itemsDialogCategory, setItemsDialogCategory] = useState(null);
  const [itemsDialogType, setItemsDialogType] = useState(null);

  // Compute counts
  const productCountsByCategory = useMemo(() => {
    const counts = {};
    (products || []).forEach(p => {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const serviceCountsByCategory = useMemo(() => {
    const counts = {};
    (services || []).forEach(s => {
      if (s.category_id) {
        counts[s.category_id] = (counts[s.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [services]);

  // Handlers
  const handleCreate = async (type) => {
    if (!newName.trim()) return;
    try {
      if (type === 'product') {
        await createProductCat(newName.trim(), newDescription.trim());
      } else {
        await createServiceCat(newName.trim(), newDescription.trim());
      }
      setNewName('');
      setNewDescription('');
    } catch (err) {
      // Error handled by hook toast
    }
  };

  const openEdit = (category, type) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditDescription(category.description || '');
    setEditType(type);
  };

  const handleEdit = async () => {
    if (!editingCategory || !editName.trim()) return;
    try {
      if (editType === 'product') {
        await updateProductCat(editingCategory.id, editName.trim(), editDescription.trim());
      } else {
        await updateServiceCat(editingCategory.id, editName.trim(), editDescription.trim());
      }
      setEditingCategory(null);
    } catch (err) {
      // Error handled by hook toast
    }
  };

  const openDelete = (category, type) => {
    setDeletingCategory(category);
    setDeleteType(type);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    try {
      if (deleteType === 'product') {
        await deleteProductCat(deletingCategory.id);
      } else {
        await deleteServiceCat(deletingCategory.id);
      }
      setDeletingCategory(null);
    } catch (err) {
      // Error handled by hook toast
    }
  };

  const openItems = (category, type) => {
    setItemsDialogCategory(category);
    setItemsDialogType(type);
    setShowItemsDialog(true);
  };

  const getItemsForCategory = () => {
    if (!itemsDialogCategory) return [];
    if (itemsDialogType === 'product') {
      return (products || []).filter(p => p.category_id === itemsDialogCategory.id);
    }
    return (services || []).filter(s => s.category_id === itemsDialogCategory.id);
  };

  const getDeleteCount = () => {
    if (!deletingCategory) return 0;
    if (deleteType === 'product') return productCountsByCategory[deletingCategory.id] || 0;
    return serviceCountsByCategory[deletingCategory.id] || 0;
  };

  // Shared category table component
  const CategoryTable = ({ categories, counts, type }) => (
    <div className="space-y-4">
      {/* Create form */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-gray-400 text-xs">{t('categories.categoryName')}</Label>
          <Input
            placeholder={t('categories.addCategory') + '...'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate(type)}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-gray-400 text-xs">{t('categories.categoryDescription')}</Label>
          <Input
            placeholder={t('categories.categoryDescription') + '...'}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate(type)}
          />
        </div>
        <Button
          className="bg-orange-500 hover:bg-orange-600 shrink-0"
          onClick={() => handleCreate(type)}
          disabled={!newName.trim()}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('categories.addCategory')}
        </Button>
      </div>

      {/* Table */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t('categories.noCategories')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">{t('categories.categoryName')}</TableHead>
                <TableHead className="text-gray-400">{t('categories.categoryDescription')}</TableHead>
                <TableHead className="text-gray-400 text-center">
                  {type === 'product' ? t('categories.associatedProducts') : t('categories.associatedServices')}
                </TableHead>
                <TableHead className="text-gray-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => {
                const count = counts[cat.id] || 0;
                return (
                  <TableRow key={cat.id} className="border-gray-800">
                    <TableCell className="text-white font-medium">{cat.name}</TableCell>
                    <TableCell className="text-gray-400 max-w-[200px] truncate">
                      {cat.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={count > 0 ? 'default' : 'secondary'}
                        className={`cursor-pointer ${count > 0 ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-gray-800 text-gray-500'}`}
                        onClick={() => count > 0 && openItems(cat, type)}
                      >
                        {t('categories.itemCount', { count })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white"
                          onClick={() => openEdit(cat, type)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => openDelete(cat, type)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Tag className="h-7 w-7 text-orange-400" />
            {t('categories.title')}
          </h1>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">{t('categories.productCategories')}</p>
                <p className="text-2xl font-bold text-white">{productCategories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Wrench className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">{t('categories.serviceCategories')}</p>
                <p className="text-2xl font-bold text-white">{serviceCategories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('categories.productCategories')}
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            {t('categories.serviceCategories')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">{t('categories.productCategories')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryTable categories={productCategories} counts={productCountsByCategory} type="product" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">{t('categories.serviceCategories')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryTable categories={serviceCategories} counts={serviceCountsByCategory} type="service" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('categories.editCategory')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('categories.categoryName')}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('categories.categoryDescription')}</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => setEditingCategory(null)}>
              {t('buttons.cancel')}
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleEdit} disabled={!editName.trim()}>
              {t('buttons.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('categories.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {getDeleteCount() > 0
                ? t('categories.deleteConfirmMessage', { count: getDeleteCount() })
                : t('categories.deleteConfirmEmpty')
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:bg-gray-800">
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              {t('categories.deleteCategory')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Items Dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {itemsDialogType === 'product' ? t('categories.associatedProducts') : t('categories.associatedServices')}
              {itemsDialogCategory && ` — ${itemsDialogCategory.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
            {getItemsForCategory().map(item => (
              <div key={item.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white font-medium">
                    {itemsDialogType === 'product' ? item.product_name : item.service_name}
                  </p>
                  {itemsDialogType === 'product' && item.sku && (
                    <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                  )}
                  {itemsDialogType === 'service' && item.pricing_type && (
                    <p className="text-xs text-gray-500">{item.pricing_type}</p>
                  )}
                </div>
                {itemsDialogType === 'product' && (
                  <span className="text-gray-400 text-sm">
                    {item.unit_price ? `${Number(item.unit_price).toFixed(2)} €` : '—'}
                  </span>
                )}
                {itemsDialogType === 'service' && (
                  <span className="text-gray-400 text-sm">
                    {item.hourly_rate ? `${Number(item.hourly_rate).toFixed(2)} €/h` : item.fixed_price ? `${Number(item.fixed_price).toFixed(2)} €` : '—'}
                  </span>
                )}
              </div>
            ))}
            {getItemsForCategory().length === 0 && (
              <p className="text-gray-500 text-center py-4">{t('categories.noCategories')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoriesPage;
