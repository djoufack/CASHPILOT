import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProductCategories, useProducts } from '@/hooks/useProducts';
import { useServiceCategories, useServices } from '@/hooks/useServices';
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
import { Plus, Pencil, Trash2, Package, Wrench, Tag, FolderOpen, Sparkles } from 'lucide-react';

const CategoriesPage = () => {
  const { t } = useTranslation();

  const { categories: productCategories, createCategory: createProductCat, updateCategory: updateProductCat, deleteCategory: deleteProductCat } = useProductCategories();
  const { categories: serviceCategories, createCategory: createServiceCat, updateCategory: updateServiceCat, deleteCategory: deleteServiceCat } = useServiceCategories();
  const { products } = useProducts();
  const { services } = useServices();

  // Separate form state per tab
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');

  // Edit dialog state
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState(null);

  // Delete dialog state
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  // Items dialog state
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [itemsDialogCategory, setItemsDialogCategory] = useState(null);
  const [itemsDialogType, setItemsDialogType] = useState(null);

  const productCountsByCategory = useMemo(() => {
    const counts = {};
    (products || []).forEach(p => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    return counts;
  }, [products]);

  const serviceCountsByCategory = useMemo(() => {
    const counts = {};
    (services || []).forEach(s => {
      if (s.category_id) counts[s.category_id] = (counts[s.category_id] || 0) + 1;
    });
    return counts;
  }, [services]);

  const handleCreateProduct = async () => {
    if (!productName.trim()) return;
    try {
      await createProductCat(productName.trim(), productDesc.trim());
      setProductName('');
      setProductDesc('');
    } catch (err) { /* toast in hook */ }
  };

  const handleCreateService = async () => {
    if (!serviceName.trim()) return;
    try {
      await createServiceCat(serviceName.trim(), serviceDesc.trim());
      setServiceName('');
      setServiceDesc('');
    } catch (err) { /* toast in hook */ }
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
    } catch (err) { /* toast in hook */ }
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
    } catch (err) { /* toast in hook */ }
  };

  const openItems = (category, type) => {
    setItemsDialogCategory(category);
    setItemsDialogType(type);
    setShowItemsDialog(true);
  };

  const getDeleteCount = () => {
    if (!deletingCategory) return 0;
    if (deleteType === 'product') return productCountsByCategory[deletingCategory.id] || 0;
    return serviceCountsByCategory[deletingCategory.id] || 0;
  };

  const getItemsForCategory = () => {
    if (!itemsDialogCategory) return [];
    if (itemsDialogType === 'product') return (products || []).filter(p => p.category_id === itemsDialogCategory.id);
    return (services || []).filter(s => s.category_id === itemsDialogCategory.id);
  };

  // 3D button styles
  const btn3dPrimary = `
    bg-gradient-to-b from-orange-400 to-orange-600
    shadow-[0_4px_0_0_#c2410c,0_6px_12px_rgba(234,88,12,0.35)]
    hover:shadow-[0_2px_0_0_#c2410c,0_3px_8px_rgba(234,88,12,0.3)]
    hover:translate-y-[2px]
    active:shadow-[0_0px_0_0_#c2410c,0_1px_4px_rgba(234,88,12,0.2)]
    active:translate-y-[4px]
    transition-all duration-150 ease-out
    text-white font-semibold
    border-0
  `.replace(/\n/g, ' ').trim();

  const btn3dGhost = `
    bg-gradient-to-b from-gray-700 to-gray-800
    shadow-[0_3px_0_0_#1f2937,0_4px_8px_rgba(0,0,0,0.3)]
    hover:shadow-[0_1px_0_0_#1f2937,0_2px_4px_rgba(0,0,0,0.2)]
    hover:translate-y-[2px]
    active:shadow-none active:translate-y-[3px]
    transition-all duration-150 ease-out
    border-0
  `.replace(/\n/g, ' ').trim();

  const btn3dDanger = `
    bg-gradient-to-b from-red-500 to-red-700
    shadow-[0_4px_0_0_#991b1b,0_6px_12px_rgba(220,38,38,0.35)]
    hover:shadow-[0_2px_0_0_#991b1b,0_3px_8px_rgba(220,38,38,0.3)]
    hover:translate-y-[2px]
    active:shadow-[0_0px_0_0_#991b1b,0_1px_4px_rgba(220,38,38,0.2)]
    active:translate-y-[4px]
    transition-all duration-150 ease-out
    text-white font-semibold
    border-0
  `.replace(/\n/g, ' ').trim();

  const btn3dOutline = `
    bg-gradient-to-b from-gray-800 to-gray-900
    shadow-[0_3px_0_0_#111827,0_4px_8px_rgba(0,0,0,0.4)]
    hover:shadow-[0_1px_0_0_#111827,0_2px_4px_rgba(0,0,0,0.3)]
    hover:translate-y-[2px]
    active:shadow-none active:translate-y-[3px]
    transition-all duration-150 ease-out
    border border-gray-600 text-gray-300
    hover:text-white hover:border-gray-500
  `.replace(/\n/g, ' ').trim();

  // Premium input style
  const inputPremium = "bg-gray-800/80 border-gray-600/50 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 rounded-lg backdrop-blur-sm";

  const renderCategoryRows = (categories, counts, type) => (
    categories.map((cat, index) => {
      const count = counts[cat.id] || 0;
      return (
        <TableRow
          key={cat.id}
          className="border-gray-800/50 hover:bg-gray-800/30 transition-colors duration-200"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <TableCell className="text-white font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 shadow-[0_0_6px_rgba(251,146,60,0.4)]" />
              {cat.name}
            </div>
          </TableCell>
          <TableCell className="text-gray-400 max-w-[200px] truncate">{cat.description || '—'}</TableCell>
          <TableCell className="text-center">
            <Badge
              variant={count > 0 ? 'default' : 'secondary'}
              className={`cursor-pointer transition-all duration-200 ${
                count > 0
                  ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-300 border border-orange-500/30 hover:from-orange-500/30 hover:to-amber-500/30 hover:shadow-[0_0_12px_rgba(251,146,60,0.2)]'
                  : 'bg-gray-800/50 text-gray-500 border border-gray-700/50'
              }`}
              onClick={() => count > 0 && openItems(cat, type)}
            >
              {t('categories.itemCount', { count })}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <button
                className={`p-2 rounded-lg text-gray-400 hover:text-white ${btn3dGhost}`}
                onClick={() => openEdit(cat, type)}
                title={t('categories.editCategory')}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                className="p-2 rounded-lg text-red-400 hover:text-white bg-gradient-to-b from-red-900/50 to-red-950/80 shadow-[0_3px_0_0_#450a0a,0_4px_8px_rgba(127,29,29,0.3)] hover:shadow-[0_1px_0_0_#450a0a,0_2px_4px_rgba(127,29,29,0.2)] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all duration-150 ease-out border border-red-800/30"
                onClick={() => openDelete(cat, type)}
                title={t('categories.deleteCategory')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </TableCell>
        </TableRow>
      );
    })
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header with gradient accent */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
        <div className="absolute -top-2 right-12 w-16 h-16 bg-purple-500/10 rounded-full blur-xl" />
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_4px_0_0_#c2410c,0_8px_20px_rgba(234,88,12,0.3)]">
            <Tag className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              {t('categories.title')}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {t('categories.productCategories')} & {t('categories.serviceCategories')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards with glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-950/90 border border-gray-700/40 backdrop-blur-xl p-6 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors duration-500" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 shadow-[inset_0_1px_0_rgba(59,130,246,0.2)]">
              <Package className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">{t('categories.productCategories')}</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-blue-100 bg-clip-text text-transparent">{productCategories.length}</p>
            </div>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-950/90 border border-gray-700/40 backdrop-blur-xl p-6 transition-all duration-300 hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.08)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors duration-500" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 shadow-[inset_0_1px_0_rgba(168,85,247,0.2)]">
              <Wrench className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">{t('categories.serviceCategories')}</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-purple-100 bg-clip-text text-transparent">{serviceCategories.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs with premium styling */}
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="bg-gray-900/80 border border-gray-700/40 backdrop-blur-xl rounded-xl p-1 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
          <TabsTrigger
            value="products"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-b data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-[0_3px_0_0_#c2410c,0_4px_12px_rgba(234,88,12,0.3)]"
          >
            <Package className="h-4 w-4" />
            {t('categories.productCategories')}
          </TabsTrigger>
          <TabsTrigger
            value="services"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-b data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-[0_3px_0_0_#c2410c,0_4px_12px_rgba(234,88,12,0.3)]"
          >
            <Wrench className="h-4 w-4" />
            {t('categories.serviceCategories')}
          </TabsTrigger>
        </TabsList>

        {/* === Product Categories Tab === */}
        <TabsContent value="products" className="mt-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/95 to-gray-950/95 border border-gray-700/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {/* Card inner glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-600/50 to-transparent" />

            <div className="p-6 border-b border-gray-800/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-orange-400" />
                {t('categories.productCategories')}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Add form */}
              <div className="flex gap-4 items-end p-4 rounded-xl bg-gray-800/30 border border-gray-700/30">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-gray-300 text-xs font-medium uppercase tracking-wider">
                    {t('categories.categoryName')} <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    autoFocus
                    placeholder={t('categories.categoryName') + ' *'}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className={inputPremium}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProduct()}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-gray-300 text-xs font-medium uppercase tracking-wider">
                    {t('categories.categoryDescription')} <span className="text-gray-600 text-[10px] normal-case">(optionnel)</span>
                  </Label>
                  <Input
                    placeholder={t('categories.categoryDescription') + '...'}
                    value={productDesc}
                    onChange={(e) => setProductDesc(e.target.value)}
                    className={inputPremium}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProduct()}
                  />
                </div>
                <button
                  className={`shrink-0 px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm ${
                    productName.trim()
                      ? btn3dPrimary
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50 shadow-none'
                  }`}
                  onClick={handleCreateProduct}
                  disabled={!productName.trim()}
                >
                  <Plus className="h-4 w-4" />
                  {t('categories.addCategory')}
                </button>
              </div>

              {productCategories.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex p-4 rounded-2xl bg-gray-800/30 border border-gray-700/30 mb-4">
                    <FolderOpen className="h-12 w-12 text-gray-600" />
                  </div>
                  <p className="text-gray-500 font-medium">{t('categories.noCategories')}</p>
                  <p className="text-gray-600 text-sm mt-1">Commencez par ajouter une cat&eacute;gorie</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-700/40 overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800/50 bg-gray-800/40 hover:bg-gray-800/40">
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider">{t('categories.categoryName')}</TableHead>
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider">{t('categories.categoryDescription')}</TableHead>
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider text-center">{t('categories.associatedProducts')}</TableHead>
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderCategoryRows(productCategories, productCountsByCategory, 'product')}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* === Service Categories Tab === */}
        <TabsContent value="services" className="mt-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/95 to-gray-950/95 border border-gray-700/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-600/50 to-transparent" />

            <div className="p-6 border-b border-gray-800/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                {t('categories.serviceCategories')}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Add form */}
              <div className="flex gap-4 items-end p-4 rounded-xl bg-gray-800/30 border border-gray-700/30">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-gray-300 text-xs font-medium uppercase tracking-wider">
                    {t('categories.categoryName')} <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    placeholder={t('categories.categoryName') + ' *'}
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className={inputPremium}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateService()}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-gray-300 text-xs font-medium uppercase tracking-wider">
                    {t('categories.categoryDescription')} <span className="text-gray-600 text-[10px] normal-case">(optionnel)</span>
                  </Label>
                  <Input
                    placeholder={t('categories.categoryDescription') + '...'}
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                    className={inputPremium}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateService()}
                  />
                </div>
                <button
                  className={`shrink-0 px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm ${
                    serviceName.trim()
                      ? btn3dPrimary
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50 shadow-none'
                  }`}
                  onClick={handleCreateService}
                  disabled={!serviceName.trim()}
                >
                  <Plus className="h-4 w-4" />
                  {t('categories.addCategory')}
                </button>
              </div>

              {serviceCategories.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex p-4 rounded-2xl bg-gray-800/30 border border-gray-700/30 mb-4">
                    <FolderOpen className="h-12 w-12 text-gray-600" />
                  </div>
                  <p className="text-gray-500 font-medium">{t('categories.noCategories')}</p>
                  <p className="text-gray-600 text-sm mt-1">Commencez par ajouter une cat&eacute;gorie</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-700/40 overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800/50 bg-gray-800/40 hover:bg-gray-800/40">
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider">{t('categories.categoryName')}</TableHead>
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider">{t('categories.categoryDescription')}</TableHead>
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider text-center">{t('categories.associatedServices')}</TableHead>
                        <TableHead className="text-gray-400 font-semibold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderCategoryRows(serviceCategories, serviceCountsByCategory, 'service')}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog - Premium */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="bg-gradient-to-br from-gray-900 to-gray-950 border-gray-700/40 text-white sm:max-w-md shadow-[0_16px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Pencil className="h-4 w-4 text-orange-400" />
              {t('categories.editCategory')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300 text-xs font-medium uppercase tracking-wider">{t('categories.categoryName')}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputPremium}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 text-xs font-medium uppercase tracking-wider">{t('categories.categoryDescription')}</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-gray-800/80 border-gray-600/50 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 rounded-lg backdrop-blur-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              className={`px-4 py-2.5 rounded-xl text-sm ${btn3dOutline}`}
              onClick={() => setEditingCategory(null)}
            >
              {t('buttons.cancel')}
            </button>
            <button
              className={`px-5 py-2.5 rounded-xl text-sm ${
                editName.trim() ? btn3dPrimary : 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none'
              }`}
              onClick={handleEdit}
              disabled={!editName.trim()}
            >
              {t('buttons.save')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog - Premium */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 to-gray-950 border-gray-700/40 text-white shadow-[0_16px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              {t('categories.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-relaxed">
              {getDeleteCount() > 0
                ? t('categories.deleteConfirmMessage', { count: getDeleteCount() })
                : t('categories.deleteConfirmEmpty')
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <button
              className={`px-4 py-2.5 rounded-xl text-sm ${btn3dOutline}`}
              onClick={() => setDeletingCategory(null)}
            >
              {t('buttons.cancel')}
            </button>
            <button
              className={`px-5 py-2.5 rounded-xl text-sm ${btn3dDanger}`}
              onClick={handleDelete}
            >
              {t('categories.deleteCategory')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Items Dialog - Premium */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 to-gray-950 border-gray-700/40 text-white sm:max-w-lg shadow-[0_16px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          <DialogHeader>
            <DialogTitle className="text-xl">
              {itemsDialogType === 'product' ? t('categories.associatedProducts') : t('categories.associatedServices')}
              {itemsDialogCategory && (
                <span className="text-orange-400 ml-1">— {itemsDialogCategory.name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
            {getItemsForCategory().map(item => (
              <div key={item.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3 border border-gray-700/30 hover:bg-gray-800/70 transition-colors duration-200">
                <div>
                  <p className="text-white font-medium">
                    {itemsDialogType === 'product' ? item.product_name : item.service_name}
                  </p>
                  {itemsDialogType === 'product' && item.sku && (
                    <p className="text-xs text-gray-500 mt-0.5">SKU: {item.sku}</p>
                  )}
                  {itemsDialogType === 'service' && item.pricing_type && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.pricing_type}</p>
                  )}
                </div>
                <span className="text-orange-300 text-sm font-medium bg-orange-500/10 px-3 py-1 rounded-lg border border-orange-500/20">
                  {itemsDialogType === 'product'
                    ? (item.unit_price ? `${Number(item.unit_price).toFixed(2)} €` : '—')
                    : (item.hourly_rate ? `${Number(item.hourly_rate).toFixed(2)} €/h` : item.fixed_price ? `${Number(item.fixed_price).toFixed(2)} €` : '—')
                  }
                </span>
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
