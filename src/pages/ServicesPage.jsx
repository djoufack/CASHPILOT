
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices, useServiceCategories } from '@/hooks/useServices';
import { useCompany } from '@/hooks/useCompany';
import { getCurrencySymbol } from '@/utils/currencyService';
import { exportToCSV, exportToExcel } from '@/utils/exportService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Trash2, Edit2, Download, Briefcase, Clock, DollarSign, Tag } from 'lucide-react';

const ServicesPage = () => {
  const { t } = useTranslation();
  const { services, loading, createService, updateService, deleteService } = useServices();
  const { categories, createCategory, deleteCategory } = useServiceCategories();
  const { company } = useCompany();

  const currencySymbol = getCurrencySymbol(company?.currency || 'EUR');

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const emptyService = {
    service_name: '',
    description: '',
    category_id: '',
    pricing_type: 'hourly',
    hourly_rate: '',
    fixed_price: '',
    unit_price: '',
    unit: 'heure',
    is_active: true,
  };

  const [formData, setFormData] = useState(emptyService);

  // Filter services
  const filteredServices = services.filter(s => {
    if (!searchTerm) return true;
    return s.service_name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Stats
  const totalServices = services.length;
  const activeServices = services.filter(s => s.is_active).length;
  const byType = {
    hourly: services.filter(s => s.pricing_type === 'hourly').length,
    fixed: services.filter(s => s.pricing_type === 'fixed').length,
    per_unit: services.filter(s => s.pricing_type === 'per_unit').length,
  };

  // Rate display helper
  const getRate = (service) => {
    switch (service.pricing_type) {
      case 'hourly':
        return `${(service.hourly_rate || 0).toFixed(2)} ${currencySymbol}/h`;
      case 'fixed':
        return `${(service.fixed_price || 0).toFixed(2)} ${currencySymbol}`;
      case 'per_unit':
        return `${(service.unit_price || 0).toFixed(2)} ${currencySymbol}/${service.unit || 'u'}`;
      default:
        return '—';
    }
  };

  const getPricingTypeBadge = (type) => {
    switch (type) {
      case 'hourly':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{t('services.hourly')}</Badge>;
      case 'fixed':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">{t('services.fixed')}</Badge>;
      case 'per_unit':
        return <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">{t('services.perUnit')}</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  // Open edit dialog
  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      service_name: service.service_name || '',
      description: service.description || '',
      category_id: service.category_id || '',
      pricing_type: service.pricing_type || 'hourly',
      hourly_rate: service.hourly_rate ?? '',
      fixed_price: service.fixed_price ?? '',
      unit_price: service.unit_price ?? '',
      unit: service.unit || 'heure',
      is_active: service.is_active ?? true,
    });
    setShowAddDialog(true);
  };

  // Open add dialog
  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData(emptyService);
    setShowAddDialog(true);
  };

  // Submit create or update
  const handleSubmit = async () => {
    const payload = {
      service_name: formData.service_name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      pricing_type: formData.pricing_type,
      hourly_rate: formData.pricing_type === 'hourly' ? parseFloat(formData.hourly_rate) || 0 : null,
      fixed_price: formData.pricing_type === 'fixed' ? parseFloat(formData.fixed_price) || 0 : null,
      unit_price: formData.pricing_type === 'per_unit' ? parseFloat(formData.unit_price) || 0 : null,
      unit: formData.unit || 'heure',
      is_active: formData.is_active,
    };

    try {
      if (editingService) {
        await updateService(editingService.id, payload);
      } else {
        await createService(payload);
      }
      setShowAddDialog(false);
      setEditingService(null);
      setFormData(emptyService);
    } catch (err) {
      // Error handled by hook toast
    }
  };

  // Add category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(newCategoryName.trim());
      setNewCategoryName('');
    } catch (err) {
      // Error handled by hook toast
    }
  };

  // Export
  const handleExportList = (format) => {
    if (!filteredServices || filteredServices.length === 0) return;
    const exportData = filteredServices.map(s => ({
      [t('services.serviceName')]: s.service_name || '',
      [t('services.categories')]: s.category?.name || '',
      [t('services.pricingType')]: s.pricing_type || '',
      [t('services.hourlyRate')]: s.hourly_rate || '',
      [t('services.fixedPrice')]: s.fixed_price || '',
      [t('services.unitPrice')]: s.unit_price || '',
      [t('services.unit')]: s.unit || '',
      'Status': s.is_active ? t('services.active') : t('services.inactive'),
    }));
    if (format === 'csv') {
      exportToCSV(exportData, 'services');
    } else {
      exportToExcel(exportData, 'services');
    }
  };

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{t('services.title')}</h1>
          <p className="text-gray-400">{t('services.title')} - {t('services.totalServices')}: {totalServices}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {filteredServices.length > 0 && (
            <>
              <Button
                onClick={() => handleExportList('csv')}
                size="sm"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                title="Export CSV"
              >
                <Download className="w-4 h-4 mr-1" />
                CSV
              </Button>
              <Button
                onClick={() => handleExportList('xlsx')}
                size="sm"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                title="Export Excel"
              >
                <Download className="w-4 h-4 mr-1" />
                Excel
              </Button>
            </>
          )}
          <Button onClick={handleOpenAdd} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" /> {t('services.addService')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">{t('services.totalServices')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">{totalServices}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">{t('services.activeServices')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{activeServices}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">{t('services.byType')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 text-sm">
              <span className="text-blue-400"><Clock className="inline w-3 h-3 mr-1" />{byType.hourly}</span>
              <span className="text-purple-400"><DollarSign className="inline w-3 h-3 mr-1" />{byType.fixed}</span>
              <span className="text-teal-400"><Tag className="inline w-3 h-3 mr-1" />{byType.per_unit}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="services">{t('services.title')}</TabsTrigger>
          <TabsTrigger value="categories">{t('services.categories')}</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('services.serviceName') + '...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-gray-800 border-gray-700 text-white w-[300px]"
              />
            </div>
          </div>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              {filteredServices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                  <p>{t('services.noServices')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400">{t('services.serviceName')}</TableHead>
                      <TableHead className="text-gray-400">{t('services.categories')}</TableHead>
                      <TableHead className="text-gray-400">{t('services.pricingType')}</TableHead>
                      <TableHead className="text-gray-400 text-right">Rate/Price</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map(service => (
                      <TableRow key={service.id} className="border-gray-800">
                        <TableCell className="font-medium">{service.service_name}</TableCell>
                        <TableCell className="text-gray-400">{service.category?.name || '—'}</TableCell>
                        <TableCell>{getPricingTypeBadge(service.pricing_type)}</TableCell>
                        <TableCell className="text-right">{getRate(service)}</TableCell>
                        <TableCell>
                          {service.is_active
                            ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{t('services.active')}</Badge>
                            : <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{t('services.inactive')}</Badge>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white"
                              onClick={() => handleEdit(service)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                              onClick={() => deleteService(service.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-4">
          <Card className="bg-gray-900 border-gray-800 max-w-lg">
            <CardHeader>
              <CardTitle>{t('services.categories')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t('services.addCategory') + '...'}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {categories.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">{t('services.noServices')}</p>
              ) : (
                <div className="space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-200">{cat.name}</span>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                        onClick={() => deleteCategory(cat.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Service Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingService ? t('services.editService') : t('services.addService')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('services.serviceName')} *</Label>
              <Input className="bg-gray-800 border-gray-700" value={formData.service_name}
                onChange={e => setFormData(p => ({ ...p, service_name: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>{t('services.description')}</Label>
              <Textarea className="bg-gray-800 border-gray-700" value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('services.categories')}</Label>
                <Select value={formData.category_id} onValueChange={v => setFormData(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('services.pricingType')}</Label>
                <Select value={formData.pricing_type} onValueChange={v => setFormData(p => ({ ...p, pricing_type: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="hourly">{t('services.hourly')}</SelectItem>
                    <SelectItem value="fixed">{t('services.fixed')}</SelectItem>
                    <SelectItem value="per_unit">{t('services.perUnit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.pricing_type === 'hourly' && (
              <div className="space-y-2">
                <Label>{t('services.hourlyRate')} ({currencySymbol})</Label>
                <Input type="number" className="bg-gray-800 border-gray-700" value={formData.hourly_rate}
                  onChange={e => setFormData(p => ({ ...p, hourly_rate: e.target.value }))} />
              </div>
            )}

            {formData.pricing_type === 'fixed' && (
              <div className="space-y-2">
                <Label>{t('services.fixedPrice')} ({currencySymbol})</Label>
                <Input type="number" className="bg-gray-800 border-gray-700" value={formData.fixed_price}
                  onChange={e => setFormData(p => ({ ...p, fixed_price: e.target.value }))} />
              </div>
            )}

            {formData.pricing_type === 'per_unit' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('services.unitPrice')} ({currencySymbol})</Label>
                  <Input type="number" className="bg-gray-800 border-gray-700" value={formData.unit_price}
                    onChange={e => setFormData(p => ({ ...p, unit_price: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('services.unit')}</Label>
                  <Input className="bg-gray-800 border-gray-700" value={formData.unit}
                    onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))} />
                </div>
              </div>
            )}

            {formData.pricing_type !== 'per_unit' && (
              <div className="space-y-2">
                <Label>{t('services.unit')}</Label>
                <Input className="bg-gray-800 border-gray-700" value={formData.unit}
                  onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))} />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>{t('services.active')}</Label>
              <Switch checked={formData.is_active}
                onCheckedChange={v => setFormData(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleSubmit}
              disabled={!formData.service_name || loading}>
              {editingService ? t('buttons.save') : t('services.addService')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesPage;
