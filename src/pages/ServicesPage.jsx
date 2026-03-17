import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useServices, useServiceCategories } from '@/hooks/useServices';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrencySymbol } from '@/utils/currencyService';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { formatNumber } from '@/utils/calculations';
import { exportToCSV, exportToExcel } from '@/utils/exportService';
import { validateServiceCatalogPayload, isGenericServiceName } from '@/utils/serviceCatalogQuality';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  Briefcase,
  Clock,
  DollarSign,
  Tag,
  AlertTriangle,
  Eye,
  FolderKanban,
  Receipt,
  Loader2,
} from 'lucide-react';

const ServicesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { services, loading, createService, updateService, deleteService } = useServices();
  const { categories, createCategory, deleteCategory } = useServiceCategories();
  const { company } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCurrency = resolveAccountingCurrency(company);
  const clientServicesTitle = t('services.clientServicesTitle', 'Prestations clients');
  const clientServicesSubtitle = t(
    'services.clientServicesSubtitle',
    'Catalogue des prestations vendues aux clients. Les services fournisseurs se gèrent dans chaque fiche fournisseur.'
  );

  const currencySymbol = getCurrencySymbol(companyCurrency);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [viewingService, setViewingService] = useState(null);
  const [serviceInsights, setServiceInsights] = useState(null);
  const [serviceInsightsLoading, setServiceInsightsLoading] = useState(false);
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
  const filteredServices = services.filter((s) => {
    if (!searchTerm) return true;
    return s.service_name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Stats
  const totalServices = services.length;
  const activeServices = services.filter((s) => s.is_active).length;
  const byType = {
    hourly: services.filter((s) => s.pricing_type === 'hourly').length,
    fixed: services.filter((s) => s.pricing_type === 'fixed').length,
    per_unit: services.filter((s) => s.pricing_type === 'per_unit').length,
  };

  const qualitySnapshot = useMemo(() => {
    const reviewThresholdMs = 90 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const stalePrices = services.filter((service) => {
      if (!service?.updated_at) return true;
      const updatedAtMs = new Date(service.updated_at).getTime();
      if (!Number.isFinite(updatedAtMs)) return true;
      return nowMs - updatedAtMs > reviewThresholdMs;
    }).length;

    const genericNames = services.filter((service) => isGenericServiceName(service?.service_name)).length;
    const uncategorized = services.filter((service) => !service?.category_id).length;

    return {
      stalePrices,
      genericNames,
      uncategorized,
      hasAlerts: stalePrices > 0 || genericNames > 0 || uncategorized > 0,
    };
  }, [services]);

  // Rate display helper
  const getRate = (service) => {
    switch (service.pricing_type) {
      case 'hourly':
        return `${formatNumber(service.hourly_rate || 0)} ${currencySymbol}/h`;
      case 'fixed':
        return `${formatNumber(service.fixed_price || 0)} ${currencySymbol}`;
      case 'per_unit':
        return `${formatNumber(service.unit_price || 0)} ${currencySymbol}/${service.unit || 'u'}`;
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

  const formatDateTime = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('fr-FR');
  };

  const getMoneyFromLine = (line) => {
    const directTotal = Number(line?.total);
    if (Number.isFinite(directTotal)) return directTotal;
    return Number(line?.quantity || 0) * Number(line?.unit_price || 0);
  };

  const getTaskLabel = (task) => task?.title || task?.name || 'Sans titre';

  const fetchServiceInsights = async (service) => {
    if (!service?.id || !supabase || !user) {
      setServiceInsights(null);
      return;
    }

    const safeQuery = async (runner) => {
      try {
        const { data, error } = await runner();
        if (error) {
          console.warn('ServicesPage detail query warning:', error.message);
          return [];
        }
        return data || [];
      } catch (error) {
        console.warn('ServicesPage detail query failed:', error?.message || error);
        return [];
      }
    };

    setServiceInsightsLoading(true);
    setServiceInsights(null);

    const _svcResults = await Promise.allSettled([
      safeQuery(() =>
        supabase
          .from('tasks')
          .select(
            'id,title,name,status,estimated_hours,due_date,updated_at,project_id,project:projects(id,name,status)'
          )
          .eq('service_id', service.id)
          .order('updated_at', { ascending: false })
          .limit(25)
      ),
      safeQuery(() =>
        supabase
          .from('timesheets')
          .select(
            'id,date,duration_minutes,billable,status,invoice_id,hourly_rate,project_id,project:projects(id,name)'
          )
          .eq('service_id', service.id)
          .order('date', { ascending: false })
          .limit(50)
      ),
      safeQuery(() =>
        supabase
          .from('invoice_items')
          .select(
            'id,invoice_id,description,quantity,unit_price,total,item_type,created_at,invoice:invoices(id,invoice_number,date,payment_status,currency)'
          )
          .eq('service_id', service.id)
          .order('created_at', { ascending: false })
          .limit(50)
      ),
    ]);

    _svcResults.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`ServicesPage insight fetch ${i} failed:`, r.reason);
    });

    const tasksData = _svcResults[0].status === 'fulfilled' ? _svcResults[0].value : [];
    const timesheetsData = _svcResults[1].status === 'fulfilled' ? _svcResults[1].value : [];
    const invoiceItemsData = _svcResults[2].status === 'fulfilled' ? _svcResults[2].value : [];

    const projectMap = new Map();
    [...tasksData, ...timesheetsData].forEach((entry) => {
      const project = entry?.project;
      if (project?.id && !projectMap.has(project.id)) {
        projectMap.set(project.id, project);
      }
    });
    const linkedProjects = Array.from(projectMap.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    );

    const completedTaskCount = tasksData.filter((task) =>
      ['done', 'completed', 'closed'].includes(String(task?.status || '').toLowerCase())
    ).length;
    const totalHours = timesheetsData.reduce((sum, row) => sum + Number(row?.duration_minutes || 0) / 60, 0);
    const billableHours = timesheetsData
      .filter((row) => row?.billable !== false)
      .reduce((sum, row) => sum + Number(row?.duration_minutes || 0) / 60, 0);
    const invoiceIds = new Set(invoiceItemsData.map((line) => line?.invoice_id).filter(Boolean));
    const billedAmount = invoiceItemsData.reduce((sum, line) => sum + getMoneyFromLine(line), 0);
    const latestInvoiceDate =
      invoiceItemsData
        .map((line) => line?.invoice?.date || line?.created_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null;

    setServiceInsights({
      tasks: tasksData,
      timesheets: timesheetsData,
      invoiceItems: invoiceItemsData,
      linkedProjects,
      summary: {
        linkedProjectsCount: linkedProjects.length,
        tasksCount: tasksData.length,
        completedTaskCount,
        timesheetsCount: timesheetsData.length,
        totalHours,
        billableHours,
        invoiceLinesCount: invoiceItemsData.length,
        invoicesCount: invoiceIds.size,
        billedAmount,
        latestInvoiceDate,
      },
    });
    setServiceInsightsLoading(false);
  };

  const handleViewService = async (service) => {
    setViewingService(service);
    await fetchServiceInsights(service);
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

  const handleDeleteService = async (service) => {
    const confirmed = window.confirm(
      t(
        'services.confirmDelete',
        'Supprimer cette prestation client ? Cette action desactive la prestation dans le catalogue.'
      )
    );
    if (!confirmed) return;
    await deleteService(service.id);
    if (viewingService?.id === service.id) {
      setViewingService(null);
      setServiceInsights(null);
    }
  };

  const openProjectDetails = (projectId) => {
    if (!projectId) return;
    setViewingService(null);
    setServiceInsights(null);
    setServiceInsightsLoading(false);
    navigate(`/app/projects/${projectId}`);
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

    const qualityCheck = validateServiceCatalogPayload(payload, { context: 'client' });
    if (!qualityCheck.valid) {
      toast({
        title: t('common.error', 'Erreur'),
        description: qualityCheck.errors[0],
        variant: 'destructive',
      });
      return;
    }

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
      // Error toast handled by useServices hook; log for debugging
      console.error('Failed to save service:', err);
    }
  };

  // Add category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(newCategoryName.trim());
      setNewCategoryName('');
    } catch (err) {
      // Error toast handled by useServices hook; log for debugging
      console.error('Failed to create category:', err);
    }
  };

  // Export
  const handleExportList = (format) => {
    if (!filteredServices || filteredServices.length === 0) return;
    const exportData = filteredServices.map((s) => ({
      [t('services.serviceName')]: s.service_name || '',
      [t('services.categories')]: s.category?.name || '',
      [t('services.pricingType')]: s.pricing_type || '',
      [t('services.hourlyRate')]: s.hourly_rate || '',
      [t('services.fixedPrice')]: s.fixed_price || '',
      [t('services.unitPrice')]: s.unit_price || '',
      [t('services.unit')]: s.unit || '',
      Status: s.is_active ? t('services.active') : t('services.inactive'),
    }));
    if (format === 'csv') {
      exportToCSV(exportData, 'services');
    } else {
      exportToExcel(exportData, 'services');
    }
  };

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <Helmet>
        <title>{clientServicesTitle} | CashPilot</title>
      </Helmet>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{clientServicesTitle}</h1>
          <p className="text-gray-400">{clientServicesSubtitle}</p>
          <p className="text-gray-500 text-sm mt-1">
            {t('services.totalServices')}: {totalServices}
          </p>
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
              <span className="text-blue-400">
                <Clock className="inline w-3 h-3 mr-1" />
                {byType.hourly}
              </span>
              <span className="text-purple-400">
                <DollarSign className="inline w-3 h-3 mr-1" />
                {byType.fixed}
              </span>
              <span className="text-teal-400">
                <Tag className="inline w-3 h-3 mr-1" />
                {byType.per_unit}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            Fiabilite du catalogue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-gray-400">
            Verifiez regulierement vos services pour limiter les erreurs de facturation et proteger la marge.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge
              className={
                qualitySnapshot.uncategorized > 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-green-500/20 text-green-300 border-green-500/30'
              }
            >
              Categories manquantes: {qualitySnapshot.uncategorized}
            </Badge>
            <Badge
              className={
                qualitySnapshot.genericNames > 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-green-500/20 text-green-300 border-green-500/30'
              }
            >
              Noms trop generiques: {qualitySnapshot.genericNames}
            </Badge>
            <Badge
              className={
                qualitySnapshot.stalePrices > 0
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                  : 'bg-green-500/20 text-green-300 border-green-500/30'
              }
            >
              Prix a revoir (+90j): {qualitySnapshot.stalePrices}
            </Badge>
          </div>
          {qualitySnapshot.hasAlerts ? (
            <p className="text-orange-300">
              Action recommandee: corriger les services en anomalie et verifier les ecritures dans Finance &gt;
              Comptabilite.
            </p>
          ) : (
            <p className="text-green-300">Aucune anomalie detectee sur les controles de base.</p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="services">{clientServicesTitle}</TabsTrigger>
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
                    {filteredServices.map((service) => (
                      <TableRow key={service.id} className="border-gray-800">
                        <TableCell className="font-medium">{service.service_name}</TableCell>
                        <TableCell className="text-gray-400">{service.category?.name || '—'}</TableCell>
                        <TableCell>{getPricingTypeBadge(service.pricing_type)}</TableCell>
                        <TableCell className="text-right">{getRate(service)}</TableCell>
                        <TableCell>
                          {service.is_active ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              {t('services.active')}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              {t('services.inactive')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-400 hover:text-blue-300"
                              onClick={() => handleViewService(service)}
                              title={t('common.view', 'Visualiser')}
                              aria-label={t('common.view', 'Visualiser')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              onClick={() => handleEdit(service)}
                              title={t('common.edit', 'Modifier')}
                              aria-label={t('common.edit', 'Modifier')}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => handleDeleteService(service)}
                              title={t('common.delete', 'Supprimer')}
                              aria-label={t('common.delete', 'Supprimer')}
                            >
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
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {categories.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">{t('services.noServices')}</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-200">{cat.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => deleteCategory(cat.id)}
                      >
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
            <DialogTitle>{editingService ? t('services.editService') : t('services.addService')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('services.serviceName')} *</Label>
              <Input
                className="bg-gray-800 border-gray-700"
                value={formData.service_name}
                onChange={(e) => setFormData((p) => ({ ...p, service_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('services.description')}</Label>
              <Textarea
                className="bg-gray-800 border-gray-700"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('services.categories')}</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="—" />
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
                <Label>{t('services.pricingType')}</Label>
                <Select
                  value={formData.pricing_type}
                  onValueChange={(v) => setFormData((p) => ({ ...p, pricing_type: v }))}
                >
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
                <Label>
                  {t('services.hourlyRate')} ({currencySymbol})
                </Label>
                <Input
                  type="number"
                  className="bg-gray-800 border-gray-700"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData((p) => ({ ...p, hourly_rate: e.target.value }))}
                />
              </div>
            )}

            {formData.pricing_type === 'fixed' && (
              <div className="space-y-2">
                <Label>
                  {t('services.fixedPrice')} ({currencySymbol})
                </Label>
                <Input
                  type="number"
                  className="bg-gray-800 border-gray-700"
                  value={formData.fixed_price}
                  onChange={(e) => setFormData((p) => ({ ...p, fixed_price: e.target.value }))}
                />
              </div>
            )}

            {formData.pricing_type === 'per_unit' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {t('services.unitPrice')} ({currencySymbol})
                  </Label>
                  <Input
                    type="number"
                    className="bg-gray-800 border-gray-700"
                    value={formData.unit_price}
                    onChange={(e) => setFormData((p) => ({ ...p, unit_price: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('services.unit')}</Label>
                  <Input
                    className="bg-gray-800 border-gray-700"
                    value={formData.unit}
                    onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {formData.pricing_type !== 'per_unit' && (
              <div className="space-y-2">
                <Label>{t('services.unit')}</Label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  value={formData.unit}
                  onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>{t('services.active')}</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleSubmit}
              disabled={!formData.service_name || loading}
            >
              {editingService ? t('buttons.save') : t('services.addService')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Service Dialog */}
      <Dialog
        open={!!viewingService}
        onOpenChange={(open) => {
          if (!open) {
            setViewingService(null);
            setServiceInsights(null);
            setServiceInsightsLoading(false);
          }
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-400" />
              {t('common.view', 'Visualiser')} - {viewingService?.service_name}
            </DialogTitle>
          </DialogHeader>

          {serviceInsightsLoading ? (
            <div className="py-16 flex items-center justify-center text-gray-400">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Chargement des details...
            </div>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-gray-800 border-gray-700">
                <TabsTrigger value="overview">Vue generale</TabsTrigger>
                <TabsTrigger value="project" className="flex items-center gap-1">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Projet associe
                </TabsTrigger>
                <TabsTrigger value="billing" className="flex items-center gap-1">
                  <Receipt className="h-3.5 w-3.5" />
                  Facturation
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-gray-950 border-gray-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-300">Informations generales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Nom</span>
                        <span className="font-medium text-right">{viewingService?.service_name || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Categorie</span>
                        <span className="font-medium text-right">{viewingService?.category?.name || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Type de tarification</span>
                        <span className="font-medium text-right">
                          {viewingService?.pricing_type === 'hourly'
                            ? 'Horaire'
                            : viewingService?.pricing_type === 'fixed'
                              ? 'Forfaitaire'
                              : "A l'unite"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Tarif</span>
                        <span className="font-medium text-right">{viewingService ? getRate(viewingService) : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Statut</span>
                        <span>
                          {viewingService?.is_active ? (
                            <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Actif</Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Inactif</Badge>
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-950 border-gray-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-300">Cycle de vie</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Cree le</span>
                        <span className="font-medium text-right">{formatDateTime(viewingService?.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Derniere mise a jour</span>
                        <span className="font-medium text-right">{formatDateTime(viewingService?.updated_at)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Projets lies</span>
                        <span className="font-medium text-right">
                          {serviceInsights?.summary?.linkedProjectsCount || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Lignes facture</span>
                        <span className="font-medium text-right">
                          {serviceInsights?.summary?.invoiceLinesCount || 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-950 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-300">Description</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-300">
                    {viewingService?.description?.trim() || 'Aucune description renseignee.'}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="project" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="bg-gray-950 border-gray-800">
                    <CardContent className="py-4">
                      <p className="text-xs text-gray-400 uppercase">Projets associes</p>
                      <p className="text-2xl font-bold text-blue-300 mt-1">
                        {serviceInsights?.summary?.linkedProjectsCount || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-950 border-gray-800">
                    <CardContent className="py-4">
                      <p className="text-xs text-gray-400 uppercase">Taches associees</p>
                      <p className="text-2xl font-bold text-orange-300 mt-1">
                        {serviceInsights?.summary?.tasksCount || 0}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Terminees: {serviceInsights?.summary?.completedTaskCount || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-950 border-gray-800">
                    <CardContent className="py-4">
                      <p className="text-xs text-gray-400 uppercase">Feuilles de temps</p>
                      <p className="text-2xl font-bold text-green-300 mt-1">
                        {formatNumber(serviceInsights?.summary?.totalHours || 0)} h
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Facturables: {formatNumber(serviceInsights?.summary?.billableHours || 0)} h
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-950 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-300">Projets relies a cette prestation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(serviceInsights?.linkedProjects?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">Aucun projet associe pour le moment.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {serviceInsights.linkedProjects.map((project) => (
                          <Button
                            key={project.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-full border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                            onClick={() => openProjectDetails(project.id)}
                            title="Ouvrir le projet"
                          >
                            {project.name || 'Projet sans nom'}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gray-950 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-300">Dernieres taches utilisant cette prestation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(serviceInsights?.tasks?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">Aucune tache reliee a cette prestation.</p>
                    ) : (
                      serviceInsights.tasks.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="rounded border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-medium text-gray-100">{getTaskLabel(task)}</p>
                            <p className="text-xs text-gray-400">
                              Projet:{' '}
                              {task?.project?.id ? (
                                <button
                                  type="button"
                                  className="text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
                                  onClick={() => openProjectDetails(task.project.id)}
                                >
                                  {task?.project?.name || 'Projet'}
                                </button>
                              ) : (
                                <span>{task?.project?.name || '—'}</span>
                              )}{' '}
                              • MAJ: {formatDateTime(task?.updated_at)}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-gray-700 text-gray-300 capitalize">
                            {task?.status || 'inconnu'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="billing" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Card className="bg-gray-950 border-gray-800">
                    <CardContent className="py-4">
                      <p className="text-xs text-gray-400 uppercase">Factures impactees</p>
                      <p className="text-2xl font-bold text-purple-300 mt-1">
                        {serviceInsights?.summary?.invoicesCount || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-950 border-gray-800">
                    <CardContent className="py-4">
                      <p className="text-xs text-gray-400 uppercase">Lignes facture</p>
                      <p className="text-2xl font-bold text-orange-300 mt-1">
                        {serviceInsights?.summary?.invoiceLinesCount || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-950 border-gray-800 md:col-span-2">
                    <CardContent className="py-4">
                      <p className="text-xs text-gray-400 uppercase">Montant facture (estimatif)</p>
                      <p className="text-2xl font-bold text-green-300 mt-1">
                        {formatNumber(serviceInsights?.summary?.billedAmount || 0)} {currencySymbol}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Derniere facture: {formatDateTime(serviceInsights?.summary?.latestInvoiceDate)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-950 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-300">Dernieres lignes de facturation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(serviceInsights?.invoiceItems?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">Aucune ligne de facture client reliee a cette prestation.</p>
                    ) : (
                      serviceInsights.invoiceItems.slice(0, 6).map((line) => (
                        <div
                          key={line.id}
                          className="rounded border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-medium text-gray-100">
                              {line.description || viewingService?.service_name || 'Ligne service'}
                            </p>
                            <p className="text-xs text-gray-400">
                              Facture: {line?.invoice?.invoice_number || '—'} • Date:{' '}
                              {formatDateTime(line?.invoice?.date || line?.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-300">
                              {formatNumber(getMoneyFromLine(line))} {currencySymbol}
                            </p>
                            <p className="text-xs text-gray-400">Qté {formatNumber(line?.quantity || 0)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesPage;
