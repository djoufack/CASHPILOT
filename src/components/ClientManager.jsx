
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReferenceData } from '@/contexts/ReferenceDataContext';
import { Plus, Edit, Trash2, Search, Building2, MapPin, FileText, CreditCard, ArchiveRestore, Archive, Globe, CheckCircle, XCircle, Loader2, Download, LayoutGrid, List } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import { motion } from 'framer-motion';
import { validateEmail } from '@/utils/validation';
import { useToast } from '@/components/ui/use-toast';
import { Currency } from '@/types';
import { usePagination } from '@/hooks/usePagination';
import { usePeppolCheck } from '@/hooks/usePeppolCheck';
import PaginationControls from '@/components/PaginationControls';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import { escapeHTML } from '@/utils/sanitize';
import DOMPurify from 'dompurify';

const ClientManager = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { clients, loading, createClient, updateClient, deleteClient, restoreClient, fetchDeletedClients } = useClients();
  const { checkRegistration, checking: peppolChecking, result: peppolResult, reset: resetPeppolCheck } = usePeppolCheck();
  const { countryOptions, currencyOptions } = useReferenceData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedClients, setArchivedClients] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const emptyFormData = {
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    // Address
    address: '',
    city: '',
    postal_code: '',
    country: '',
    // Business
    vat_number: '',
    tax_id: '',
    preferred_currency: 'EUR',
    payment_terms: '',
    // Bank
    bank_name: '',
    iban: '',
    bic_swift: '',
    // Peppol
    peppol_endpoint_id: '',
    peppol_scheme_id: '0208',
    electronic_invoicing_enabled: false,
    // Notes
    notes: ''
  };
  const [formData, setFormData] = useState(emptyFormData);

  // Format currency options for SearchableSelect
  const handleOpenDialog = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        company_name: client.company_name || '',
        contact_name: client.contact_name || '',
        email: client.email || '',
        phone: client.phone || '',
        website: client.website || '',
        address: client.address || '',
        city: client.city || '',
        postal_code: client.postal_code || '',
        country: client.country || '',
        vat_number: client.vat_number || '',
        tax_id: client.tax_id || '',
        preferred_currency: client.preferred_currency || 'EUR',
        payment_terms: client.payment_terms || '',
        bank_name: client.bank_name || '',
        iban: client.iban || '',
        bic_swift: client.bic_swift || '',
        peppol_endpoint_id: client.peppol_endpoint_id || '',
        peppol_scheme_id: client.peppol_scheme_id || '0208',
        electronic_invoicing_enabled: client.electronic_invoicing_enabled || false,
        notes: client.notes || ''
      });
    } else {
      setEditingClient(null);
      setFormData(emptyFormData);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation des champs obligatoires
    const missingFields = [];
    if (!formData.company_name?.trim()) missingFields.push(t('clients.companyName', 'Nom de l\'entreprise'));
    if (!formData.contact_name?.trim()) missingFields.push(t('clients.contactName', 'Nom du contact'));
    if (!formData.email?.trim()) missingFields.push(t('clients.email', 'Email'));

    if (missingFields.length > 0) {
      toast({
        title: t('validation.missingFields', 'Champs obligatoires manquants'),
        description: `${t('validation.pleaseComplete', 'Veuillez remplir')} : ${missingFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    if (formData.email && !validateEmail(formData.email)) {
      toast({
        title: t('validation.invalidEmail', 'Email invalide'),
        description: t('validation.invalidEmailDescription', 'Veuillez saisir une adresse email valide.'),
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
      } else {
        await createClient(formData);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleToggleArchived = async () => {
    if (!showArchived) {
      setLoadingArchived(true);
      const deleted = await fetchDeletedClients();
      setArchivedClients(deleted);
      setLoadingArchived(false);
    }
    setShowArchived(!showArchived);
  };

  const handleRestore = async (client) => {
    const restored = await restoreClient(client.id);
    if (restored) {
      setArchivedClients(archivedClients.filter(c => c.id !== client.id));
    }
  };

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const generateClientSheetHTML = (client) => {
    const companyName = escapeHTML(company?.name || company?.company_name || 'CashPilot');
    const details = [
      { label: escapeHTML(t('clients.companyName')), value: escapeHTML(client.company_name || '-') },
      { label: escapeHTML(t('clients.contactName')), value: escapeHTML(client.contact_name || '-') },
      { label: escapeHTML(t('clients.email')), value: escapeHTML(client.email || '-') },
      { label: escapeHTML(t('clients.phone', 'Téléphone')), value: escapeHTML(client.phone || '-') },
      { label: escapeHTML(t('clients.preferredCurrency')), value: escapeHTML(client.preferred_currency || '-') },
      { label: escapeHTML(t('clients.vatNumber')), value: escapeHTML(client.vat_number || '-') },
      { label: escapeHTML(t('clients.address')), value: escapeHTML(client.address || '-') },
      { label: escapeHTML(t('clients.city', 'Ville')), value: escapeHTML(client.city || '-') },
      { label: escapeHTML(t('clients.country', 'Pays')), value: escapeHTML(client.country || '-') },
      { label: 'IBAN', value: escapeHTML(client.iban || '-') },
      { label: 'BIC/SWIFT', value: escapeHTML(client.bic_swift || '-') },
      { label: escapeHTML(t('peppol.endpointId')), value: escapeHTML(client.peppol_endpoint_id || '-') },
      {
        label: escapeHTML(t('clients.createdAt', 'Créé le')),
        value: escapeHTML(client.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR') : '-'),
      },
    ];

    return `
      <div style="font-family: Arial, sans-serif; max-width: 860px; margin: 0 auto; color: #1f2937; background:#f8fafc; padding:24px;">
        <div style="background:#0f172a; color:white; border-radius:10px; padding:20px 24px; margin-bottom:18px;">
          <h1 style="margin:0; font-size:28px;">Fiche client</h1>
          <p style="margin:8px 0 0 0; color:#cbd5e1;">${escapeHTML(client.company_name || '-')}</p>
        </div>
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:18px 20px;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px 20px;">
            ${details.map((row) => `
              <div style="border-bottom:1px solid #f1f5f9; padding:8px 0;">
                <p style="margin:0; font-size:12px; color:#64748b;">${row.label}</p>
                <p style="margin:4px 0 0 0; font-size:14px; color:#0f172a; font-weight:600;">${row.value}</p>
              </div>
            `).join('')}
          </div>
          ${client.notes ? `
            <div style="margin-top:16px; border:1px solid #e2e8f0; border-radius:8px; padding:12px; background:#f8fafc;">
              <p style="margin:0; font-size:12px; color:#64748b;">Notes</p>
              <p style="margin:6px 0 0 0; font-size:14px; color:#0f172a;">${escapeHTML(client.notes)}</p>
            </div>
          ` : ''}
        </div>
        <p style="margin-top:14px; font-size:11px; color:#64748b; text-align:center;">${companyName} • ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>
    `;
  };

  const handleExportClientPDF = (client) => {
    guardedAction(
      CREDIT_COSTS.PDF_REPORT,
      t('credits.costs.pdfReport', 'Export PDF'),
      async () => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = DOMPurify.sanitize(generateClientSheetHTML(client));
        await saveElementAsPdf(wrapper, {
          margin: 0.5,
          filename: `FicheClient_${client.company_name || 'client'}_${formatDateInput()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        });
      }
    );
  };

  const handleExportClientHTML = (client) => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      () => {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fiche client</title></head><body style="margin:0;">${generateClientSheetHTML(client)}</body></html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `FicheClient_${client.company_name || 'client'}_${formatDateInput()}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    );
  };

  const handleConfirmDelete = async () => {
    if (clientToDelete) {
      await deleteClient(clientToDelete.id);
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const pagination = usePagination({ pageSize: 25 });
  const { setTotalCount } = pagination;

  const filteredClients = clients.filter(client =>
    (client.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update pagination when filtered clients change
  useEffect(() => {
    setTotalCount(filteredClients.length);
  }, [filteredClients.length, setTotalCount]);

  const paginatedClients = filteredClients.slice(pagination.from, pagination.to + 1);

  const clientExportColumns = [
    { key: 'company_name', header: t('clients.companyName'), width: 25 },
    { key: 'contact_name', header: t('clients.contactName'), width: 20 },
    { key: 'email', header: t('clients.email'), width: 25 },
    { key: 'phone', header: 'Phone', width: 18 },
    { key: 'address', header: t('clients.address'), width: 30 },
    { key: 'city', header: 'City', width: 15 },
    { key: 'country', header: 'Country', width: 10 },
    { key: 'vat_number', header: t('clients.vatNumber'), width: 20 },
    { key: 'preferred_currency', header: t('clients.preferredCurrency'), width: 10 },
    { key: 'created_at', header: 'Date', type: 'date', width: 12 },
  ];

  const renderClientActions = (client) => (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleExportClientPDF(client)}
        className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
        title="Export PDF"
      >
        <Download className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleExportClientHTML(client)}
        className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
        title="Export HTML"
      >
        <FileText className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleOpenDialog(client)}
        className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20"
        title={t('common.edit')}
      >
        <Edit className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDeleteClick(client)}
        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        title={t('common.delete')}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <CreditsGuardModal {...modalProps} />
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder={t('clients.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white w-full"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={handleToggleArchived}
              className={showArchived
                ? "bg-gray-600 hover:bg-gray-500 text-white"
                : "border-gray-600 text-gray-300 hover:bg-gray-700"
              }
            >
              <Archive className="w-4 h-4 mr-2" />
              {showArchived ? t('clients.showActive', 'Clients actifs') : t('clients.showArchived', 'Archivés')}
            </Button>
          </motion.div>
          <ExportButton
            data={filteredClients}
            columns={clientExportColumns}
            filename={t('export.filename.clients', 'clients')}
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => handleOpenDialog()}
              className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('clients.addClient')}
            </Button>
          </motion.div>
        </div>
      </div>

      {showArchived ? (
        /* --- Archived clients view --- */
        loadingArchived ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : archivedClients.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {t('clients.noArchivedClients', 'Aucun client archivé')}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      {t('clients.companyName')}
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                      {t('clients.contactName')}
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                      {t('clients.email')}
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                      {t('clients.deletedAt', 'Archivé le')}
                    </th>
                    <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                      {t('clients.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {archivedClients.map((client) => (
                    <motion.tr
                      key={client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-700/50 transition-colors opacity-60"
                    >
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-400">
                        {client.company_name}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                        {client.contact_name}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                        {client.email}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                        {new Date(client.deleted_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(client)}
                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                        >
                          <ArchiveRestore className="w-4 h-4 mr-1" />
                          {t('clients.restore', 'Restaurer')}
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('clients.noClients')}</div>
      ) : (
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <TabsList className="bg-gray-800 border border-gray-700 mb-4">
            <TabsTrigger value="list" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
              <List className="w-4 h-4 mr-2" /> {t('common.list')}
            </TabsTrigger>
            <TabsTrigger value="gallery" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
              <LayoutGrid className="w-4 h-4 mr-2" /> {t('common.gallery')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        {t('clients.companyName')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        {t('clients.contactName')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        {t('clients.email')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        {t('clients.preferredCurrency')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        {t('clients.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {paginatedClients.map((client) => (
                      <motion.tr
                        key={client.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => handleOpenDialog(client)}
                      >
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gradient">
                          {client.company_name}
                          <div className="md:hidden text-xs text-gray-400 mt-1">
                            {client.contact_name}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                          {client.contact_name}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                          {client.email}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                          {client.preferred_currency}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {renderClientActions(client)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gallery">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedClients.map((client) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gradient">{client.company_name}</p>
                      <p className="text-sm text-gray-300 mt-1">{client.contact_name || '-'}</p>
                      <p className="text-xs text-gray-400 mt-1">{client.email || '-'}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">{client.preferred_currency || '-'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                    <div className="bg-gray-900/50 rounded p-2">
                      <p className="text-gray-500">TVA</p>
                      <p className="text-gray-300 mt-1">{client.vat_number || '-'}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded p-2">
                      <p className="text-gray-500">{t('clients.phone', 'Téléphone')}</p>
                      <p className="text-gray-300 mt-1">{client.phone || '-'}</p>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-gray-700">
                    {renderClientActions(client)}
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

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
        </Tabs>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full sm:max-w-[90%] md:max-w-2xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">
              {editingClient ? t('clients.editClient') : t('clients.addClient')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              {/* --- Section: General Info --- */}
              <div>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> {t('clients.companyName')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">{t('clients.companyName')} *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      required
                      placeholder="Acme Corp"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">{t('clients.contactName')} *</Label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      required
                      placeholder="Jean Dupont"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('clients.email')} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="contact@acme.com"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+33 1 23 45 67 89"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Site web</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://www.acme.com"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                </div>
              </div>

              {/* --- Section: Address --- */}
              <div>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {t('clients.address')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address">Rue</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Rue du Commerce"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Paris"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Code postal</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      placeholder="75001"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Select value={formData.country} onValueChange={(val) => setFormData({ ...formData, country: val })}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
                        <SelectValue placeholder="Sélectionner un pays" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[300px]">
                        {countryOptions.map((country) => (
                          <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* --- Section: Business Details --- */}
              <div>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Détails commerciaux
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vat_number">{t('clients.vatNumber')}</Label>
                    <Input
                      id="vat_number"
                      value={formData.vat_number}
                      onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                      placeholder="FR 12 345678901"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">SIRET / N° enregistrement</Label>
                    <Input
                      id="tax_id"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      placeholder="123 456 789 00012"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Conditions de paiement</Label>
                    <Select
                      value={formData.payment_terms}
                      onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="immediate">Immédiat</SelectItem>
                        <SelectItem value="net_15">Net 15</SelectItem>
                        <SelectItem value="net_30">Net 30</SelectItem>
                        <SelectItem value="net_45">Net 45</SelectItem>
                        <SelectItem value="net_60">Net 60</SelectItem>
                        <SelectItem value="net_90">Net 90</SelectItem>
                        <SelectItem value="end_of_month">Fin de mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">{t('clients.preferredCurrency')}</Label>
                    <SearchableSelect
                      options={currencyOptions}
                      value={formData.preferred_currency}
                      onValueChange={(value) => setFormData({ ...formData, preferred_currency: value })}
                      placeholder="Sélectionner une devise"
                      searchPlaceholder="Rechercher une devise..."
                      emptyMessage="Aucune devise trouvée"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* --- Section: Bank Details --- */}
              <div>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Coordonnées bancaires
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Banque</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="BNP Paribas"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN</Label>
                    <Input
                      id="iban"
                      value={formData.iban}
                      onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                      placeholder="FR76 1234 5678 9012 3456 7890 123"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bic_swift">BIC / SWIFT</Label>
                    <Input
                      id="bic_swift"
                      value={formData.bic_swift}
                      onChange={(e) => setFormData({ ...formData, bic_swift: e.target.value })}
                      placeholder="BNPAFRPP"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                  </div>
                </div>
              </div>

              {/* --- Section: Peppol / E-Invoicing --- */}
              <div>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Peppol / E-Invoicing
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="peppol_endpoint_id">{t('peppol.endpointId')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="peppol_endpoint_id"
                        value={formData.peppol_endpoint_id}
                        onChange={(e) => { setFormData({ ...formData, peppol_endpoint_id: e.target.value }); resetPeppolCheck(); }}
                        placeholder="0123456789"
                        className="bg-gray-700 border-gray-600 text-white w-full"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!formData.peppol_endpoint_id || peppolChecking}
                        onClick={() => checkRegistration(formData.peppol_endpoint_id)}
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                      >
                        {peppolChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : t('peppol.checkPeppol')}
                      </Button>
                    </div>
                    {peppolResult && (
                      <span className={`flex items-center gap-1 text-xs ${peppolResult.registered ? 'text-emerald-400' : 'text-red-400'}`}>
                        {peppolResult.registered
                          ? <><CheckCircle className="w-3 h-3" /> {t('peppol.checkRegistered')}</>
                          : <><XCircle className="w-3 h-3" /> {t('peppol.checkNotRegistered')}</>
                        }
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peppol_scheme_id">{t('peppol.schemeId')}</Label>
                    <Select
                      value={formData.peppol_scheme_id}
                      onValueChange={(val) => setFormData({ ...formData, peppol_scheme_id: val })}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
                        <SelectValue placeholder="Scheme" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="0208">0208 - BE (BCE/KBO)</SelectItem>
                        <SelectItem value="0009">0009 - FR (SIRET)</SelectItem>
                        <SelectItem value="0088">0088 - EAN/GLN</SelectItem>
                        <SelectItem value="0190">0190 - NL (KVK)</SelectItem>
                        <SelectItem value="9925">9925 - BE (TVA)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="electronic_invoicing_enabled"
                        checked={formData.electronic_invoicing_enabled}
                        onChange={(e) => setFormData({ ...formData, electronic_invoicing_enabled: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="electronic_invoicing_enabled">{t('peppol.enableForClient')}</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Section: Notes --- */}
              <div>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Notes
                </h3>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes supplémentaires sur ce client..."
                  rows={3}
                  className="bg-gray-700 border-gray-600 text-white w-full"
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto"
                >
                  {t('buttons.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto text-lg py-5"
                >
                  {t('buttons.save')}
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clients.archiveClient', 'Archiver le client')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('clients.confirmArchive', 'Ce client sera archivé et n\'apparaîtra plus dans la liste. Vous pourrez le restaurer à tout moment depuis les clients archivés. Les factures et documents associés seront conservés.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto mt-0">
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              {t('buttons.archive', 'Archiver')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientManager;
