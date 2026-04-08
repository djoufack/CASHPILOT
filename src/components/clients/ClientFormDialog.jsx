import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, MapPin, FileText, CreditCard, Globe, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const ClientFormDialog = ({
  isOpen,
  onOpenChange,
  editingClient,
  formData,
  setFormData,
  onSubmit,
  countryOptions,
  currencyOptions,
  peppolChecking,
  peppolResult,
  checkRegistration,
  resetPeppolCheck,
  t: tProp,
}) => {
  const { t: tHook } = useTranslation();
  const t = tProp || tHook;
  const hasLookupInput = Boolean(
    String(formData.vat_number || '').trim() || String(formData.company_name || '').trim()
  );

  const handleAutoDetectPeppol = async () => {
    const payload = {
      query_type: formData.vat_number ? 'vat_number' : 'company_name',
      vat_number: formData.vat_number || '',
      company_name: formData.company_name || '',
      country: formData.country || '',
    };
    const data = await checkRegistration(payload);
    if (data?.registered && data?.peppolId) {
      const [scheme, endpoint] = String(data.peppolId).split(':', 2);
      if (endpoint) {
        setFormData({
          ...formData,
          peppol_endpoint_id: endpoint,
          peppol_scheme_id: scheme || formData.peppol_scheme_id || '0208',
          electronic_invoicing_enabled: true,
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[90%] md:max-w-2xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gradient">
            {editingClient ? t('clients.editClient') : t('clients.addClient')}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={onSubmit} className="space-y-6 mt-4">
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
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
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
                      onChange={(e) => {
                        setFormData({ ...formData, peppol_endpoint_id: e.target.value });
                        resetPeppolCheck();
                      }}
                      placeholder="0123456789"
                      className="bg-gray-700 border-gray-600 text-white w-full"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!formData.peppol_endpoint_id || peppolChecking}
                      onClick={() =>
                        checkRegistration(
                          formData.peppol_endpoint_id.includes(':')
                            ? formData.peppol_endpoint_id
                            : `${formData.peppol_scheme_id || '0208'}:${formData.peppol_endpoint_id}`
                        )
                      }
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                    >
                      {peppolChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : t('peppol.checkPeppol')}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-gray-400">Recherche auto possible via TVA ou nom de societe.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasLookupInput || peppolChecking}
                      onClick={handleAutoDetectPeppol}
                      className="border-orange-500/40 text-orange-300 hover:bg-orange-500/10"
                    >
                      {peppolChecking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t('peppol.autoDetect', 'Auto-detect')
                      )}
                    </Button>
                  </div>
                  {peppolResult && (
                    <span
                      className={`flex items-center gap-1 text-xs ${peppolResult.registered ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {peppolResult.registered ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> {t('peppol.checkRegistered')}
                          {peppolResult.peppolId ? ` (${peppolResult.peppolId})` : ''}
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> {t('peppol.checkNotRegistered')}
                        </>
                      )}
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
                onClick={() => onOpenChange(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto"
              >
                {t('buttons.cancel')}
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto text-lg py-5">
                {t('buttons.save')}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ClientFormDialog;
