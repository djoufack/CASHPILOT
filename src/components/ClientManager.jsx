
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useReferenceData } from '@/contexts/ReferenceDataContext';
import { Plus, Search, Archive } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import { motion } from 'framer-motion';
import { validateEmail } from '@/utils/validation';
import { useToast } from '@/components/ui/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { usePeppolCheck } from '@/hooks/usePeppolCheck';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import { escapeHTML } from '@/utils/sanitize';
import DOMPurify from 'dompurify';

import ClientList from '@/components/clients/ClientList';
import ClientFormDialog from '@/components/clients/ClientFormDialog';
import ClientDeleteConfirm from '@/components/clients/ClientDeleteConfirm';

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

      <ClientList
        viewMode={viewMode}
        setViewMode={setViewMode}
        showArchived={showArchived}
        loadingArchived={loadingArchived}
        archivedClients={archivedClients}
        loading={loading}
        filteredClients={filteredClients}
        paginatedClients={paginatedClients}
        pagination={pagination}
        onOpenDialog={handleOpenDialog}
        onDeleteClick={handleDeleteClick}
        onRestore={handleRestore}
        onExportPDF={handleExportClientPDF}
        onExportHTML={handleExportClientHTML}
        t={t}
      />

      <ClientFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingClient={editingClient}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        countryOptions={countryOptions}
        currencyOptions={currencyOptions}
        peppolChecking={peppolChecking}
        peppolResult={peppolResult}
        checkRegistration={checkRegistration}
        resetPeppolCheck={resetPeppolCheck}
        t={t}
      />

      <ClientDeleteConfirm
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        t={t}
      />
    </div>
  );
};

export default ClientManager;
