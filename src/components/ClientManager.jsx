
import React from "react";
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useClients } from '@/hooks/useClients';
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
import { COUNTRIES } from '@/constants/countries';
import { SUPPORTED_CURRENCIES } from '@/utils/currencyService';
import { Plus, Edit, Trash2, Search, Building2, MapPin, FileText, CreditCard, Download } from 'lucide-react';
import { exportToCSV, exportToExcel } from '@/utils/exportService';
import { motion } from 'framer-motion';
import { validateEmail } from '@/utils/validation';
import { Currency } from '@/types';

const ClientManager = () => {
  const { t } = useTranslation();
  const { clients, loading, createClient, updateClient, deleteClient } = useClients();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
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
    // Notes
    notes: ''
  };
  const [formData, setFormData] = useState(emptyFormData);

  // Format currency options for SearchableSelect
  const currencyOptions = useMemo(() =>
    SUPPORTED_CURRENCIES.map(c => ({
      value: c.code,
      label: `${c.symbol} ${c.code} - ${c.name}`
    })),
    []
  );

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
    
    if (!validateEmail(formData.email)) {
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

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (clientToDelete) {
      await deleteClient(clientToDelete.id);
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const filteredClients = clients.filter(client =>
    (client.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportList = (format) => {
    if (!filteredClients || filteredClients.length === 0) return;
    const exportData = filteredClients.map(c => ({
      'Company Name': c.company_name || '',
      'Contact Name': c.contact_name || '',
      'Email': c.email || '',
      'Phone': c.phone || '',
      'Address': c.address || '',
      'City': c.city || '',
      'Country': c.country || '',
      'VAT Number': c.vat_number || '',
      'Currency': c.preferred_currency || '',
    }));
    if (format === 'csv') {
      exportToCSV(exportData, 'clients');
    } else {
      exportToExcel(exportData, 'clients');
    }
  };

  return (
    <div className="space-y-6">
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
          {filteredClients.length > 0 && (
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

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('clients.noClients')}</div>
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
                    {t('clients.preferredCurrency')}
                  </th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {t('clients.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredClients.map((client) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenDialog(client)}
                  >
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gradient">
                      {client.company_name}
                      {/* Mobile Only Details */}
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
                      <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(client)}
                          className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(client)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
                        {COUNTRIES.map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
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
            <AlertDialogTitle>{t('clients.deleteClient')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('clients.confirmDelete')} {t('clients.deleteWarning')}
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
              {t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientManager;
