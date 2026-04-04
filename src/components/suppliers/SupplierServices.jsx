import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSupplierServices } from '@/hooks/useSupplierServices';
import { validateServiceCatalogPayload, isGenericServiceName } from '@/utils/serviceCatalogQuality';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { exportSupplierServicePDF, exportSupplierServiceHTML } from '@/services/exportSupplierRecords';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/dateLocale';
import { formatDisplayCurrency } from '@/utils/displayFormatting';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Eye, Pencil, Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const EMPTY_FORM = {
  service_name: '',
  pricing_type: 'hourly',
  hourly_rate: '',
  fixed_price: '',
  unit: 'hour',
};

const SupplierServices = ({ supplierId, supplier }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { company } = useCompany();
  const { settings: invoiceSettings } = useInvoiceSettings();
  const { services, loading, createService, updateService, deleteService } = useSupplierServices(supplierId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingService, setViewingService] = useState(null);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const qualitySnapshot = useMemo(() => {
    const genericNames = services.filter((service) => isGenericServiceName(service?.service_name)).length;
    const missingPrice = services.filter((service) => {
      if (service.pricing_type === 'hourly') return !(Number(service.hourly_rate) > 0);
      if (service.pricing_type === 'fixed') return !(Number(service.fixed_price) > 0);
      return false;
    }).length;
    return {
      genericNames,
      missingPrice,
      hasAlerts: genericNames > 0 || missingPrice > 0,
    };
  }, [services]);

  const currency = supplier?.currency || company?.accounting_currency || 'EUR';

  const formatMoney = (value) =>
    formatDisplayCurrency(value, { currency, fallback: '0,00', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingServiceId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditingServiceId(service.id);
    setFormData({
      service_name: service.service_name || '',
      pricing_type: service.pricing_type || 'hourly',
      hourly_rate: service.hourly_rate ?? '',
      fixed_price: service.fixed_price ?? '',
      unit: service.unit || 'hour',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qualityCheck = validateServiceCatalogPayload(formData, { context: 'supplier' });
    if (!qualityCheck.valid) {
      toast({
        title: t('common.error', 'Erreur'),
        description: qualityCheck.errors[0],
        variant: 'destructive',
      });
      return;
    }

    if (editingServiceId) {
      await updateService(editingServiceId, formData);
    } else {
      await createService(formData);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = async (service) => {
    const confirmed = window.confirm(t('suppliers.services.confirmDelete', 'Supprimer ce service fournisseur ?'));
    if (!confirmed) return;
    await deleteService(service.id);
  };

  const handleExportPdf = async (service) => {
    try {
      await exportSupplierServicePDF(service, supplier, company, invoiceSettings);
    } catch (error) {
      toast({
        title: t('common.error', 'Erreur'),
        description: error?.message || t('common.exportError', "Echec de l'export PDF"),
        variant: 'destructive',
      });
    }
  };

  const handleExportHtml = async (service) => {
    try {
      await exportSupplierServiceHTML(service, supplier, company, invoiceSettings);
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
        <div>
          <h3 className="text-lg font-semibold text-gradient">
            {t('suppliers.services.vendorCatalog', 'Catalogue des services fournisseur')}
          </h3>
          <p className="text-sm text-gray-400">
            {t('suppliers.services.vendorCatalogSubtitle', 'Services achetes aupres de ce fournisseur (cote achats).')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge
              className={
                qualitySnapshot.genericNames > 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-green-500/20 text-green-300 border-green-500/30'
              }
            >
              Noms generiques: {qualitySnapshot.genericNames}
            </Badge>
            <Badge
              className={
                qualitySnapshot.missingPrice > 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-green-500/20 text-green-300 border-green-500/30'
              }
            >
              Prix manquants/invalides: {qualitySnapshot.missingPrice}
            </Badge>
          </div>
          {qualitySnapshot.hasAlerts && (
            <p className="text-xs text-orange-300 mt-2">
              Corrigez ces services pour eviter des erreurs d achat/facture fournisseur.
            </p>
          )}
        </div>
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" /> {t('suppliers.services.addService')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>
                {editingServiceId
                  ? t('suppliers.services.editService', 'Modifier le service')
                  : t('suppliers.services.addService')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('suppliers.services.serviceName')}</Label>
                <Input
                  value={formData.service_name}
                  onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                  required
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('suppliers.services.pricingType')}</Label>
                <Select
                  value={formData.pricing_type}
                  onValueChange={(val) => setFormData({ ...formData, pricing_type: val })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="hourly">{t('suppliers.services.hourlyRate')}</SelectItem>
                    <SelectItem value="fixed">{t('suppliers.services.fixedPrice')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.pricing_type === 'hourly' ? (
                <div className="space-y-2">
                  <Label>{t('suppliers.services.hourlyRate')}</Label>
                  <Input
                    type="number"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t('suppliers.services.fixedPrice')}</Label>
                  <Input
                    type="number"
                    value={formData.fixed_price}
                    onChange={(e) => setFormData({ ...formData, fixed_price: e.target.value })}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('suppliers.services.unit')}</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="bg-gray-700 border-gray-600"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">
                {editingServiceId ? t('common.save', 'Enregistrer') : t('suppliers.services.saveService')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!viewingService} onOpenChange={(open) => !open && setViewingService(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t('common.view', 'Visualiser')} - {viewingService?.service_name}
            </DialogTitle>
          </DialogHeader>
          {viewingService && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400">Tarification</p>
                  <p className="font-semibold capitalize">{viewingService.pricing_type}</p>
                </div>
                <div>
                  <p className="text-gray-400">Prix</p>
                  <p className="font-semibold">
                    {viewingService.pricing_type === 'hourly'
                      ? `${formatMoney(viewingService.hourly_rate)} / h`
                      : formatMoney(viewingService.fixed_price)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Unité</p>
                  <p className="font-semibold">{viewingService.unit || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Créé le</p>
                  <p className="font-semibold">
                    {viewingService.created_at ? formatDate(viewingService.created_at) : '-'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="border-gray-700" onClick={() => handleExportPdf(viewingService)}>
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" className="border-gray-700" onClick={() => handleExportHtml(viewingService)}>
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
              <TableHead className="text-gray-400">{t('suppliers.services.serviceName')}</TableHead>
              <TableHead className="text-gray-400">{t('suppliers.services.pricing')}</TableHead>
              <TableHead className="text-gray-400">{t('suppliers.services.ratePrice')}</TableHead>
              <TableHead className="text-gray-400">{t('suppliers.services.unit')}</TableHead>
              <TableHead className="text-right text-gray-400">{t('suppliers.services.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                  {t('loading.data', 'Chargement des donnees...')}
                </TableCell>
              </TableRow>
            )}
            {services.map((service) => (
              <TableRow key={service.id} className="border-gray-800">
                <TableCell className="font-medium text-gradient">{service.service_name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-orange-500/30 text-orange-400 capitalize">
                    {service.pricing_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-300">
                  {service.pricing_type === 'hourly'
                    ? `${formatMoney(service.hourly_rate)} / h`
                    : formatMoney(service.fixed_price)}
                </TableCell>
                <TableCell className="text-gray-400">{service.unit}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300"
                      onClick={() => setViewingService(service)}
                      title="Visualiser"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-orange-400 hover:text-orange-300"
                      onClick={() => openEditModal(service)}
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-400 hover:text-purple-300"
                      onClick={() => handleExportPdf(service)}
                      title="Export PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cyan-400 hover:text-cyan-300"
                      onClick={() => handleExportHtml(service)}
                      title="Export HTML"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(service)}
                      className="text-red-400 hover:text-red-300"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && services.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                  {t('suppliers.services.noServices')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SupplierServices;
