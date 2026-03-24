import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useReferenceData } from '@/contexts/ReferenceDataContext';
import { resolveAccountingCurrency } from '@/utils/accountingCurrency';
import { Loader2, Upload, Trash2, Camera, Building2, MapPin, CreditCard } from 'lucide-react';

const EMPTY_COMPANY_FORM = {
  company_name: '',
  company_type: 'freelance',
  registration_number: '',
  tax_id: '',
  address: '',
  city: '',
  postal_code: '',
  country: '',
  currency: 'EUR',
  phone: '',
  email: '',
  website: '',
  bank_name: '',
  bank_account: '',
  iban: '',
  swift: '',
};

const CompanySettings = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { company, loading, saving, uploading, saveCompany, uploadLogo, deleteLogo } = useCompany();
  const { countryOptions, currencyOptions, loading: referenceLoading } = useReferenceData();

  const logoInputRef = useRef(null);
  const [createNewMode, setCreateNewMode] = useState(searchParams.get('create') === '1');

  const [formData, setFormData] = useState(EMPTY_COMPANY_FORM);

  useEffect(() => {
    const requestedCreateMode = searchParams.get('create') === '1';
    if (requestedCreateMode && !createNewMode) {
      setCreateNewMode(true);
      setFormData(EMPTY_COMPANY_FORM);
    }
  }, [createNewMode, searchParams]);

  useEffect(() => {
    if (company && !createNewMode) {
      setFormData({
        company_name: company.company_name || '',
        company_type: company.company_type || 'freelance',
        registration_number: company.registration_number || '',
        tax_id: company.tax_id || '',
        address: company.address || '',
        city: company.city || '',
        postal_code: company.postal_code || '',
        country: company.country || '',
        currency: resolveAccountingCurrency(company),
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        bank_name: company.bank_name || '',
        bank_account: company.bank_account || '',
        iban: company.iban || '',
        swift: company.swift || '',
      });
    }
  }, [company, createNewMode]);

  const clearCreateQueryParam = () => {
    if (searchParams.get('create') !== '1') {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('create');
    setSearchParams(nextSearchParams, { replace: true });
  };

  const resetFormForNewCompany = () => {
    setCreateNewMode(true);
    setFormData(EMPTY_COMPANY_FORM);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await saveCompany(formData, { forceCreate: createNewMode });
    if (success) {
      setCreateNewMode(false);
      clearCreateQueryParam();
    }
  };

  const handleLogoChange = async (e) => {
    if (e.target.files?.[0]) {
      await uploadLogo(e.target.files[0]);
      e.target.value = null;
    }
  };

  if (loading || referenceLoading) {
    return (
      <div className="p-12 flex flex-col justify-center items-center h-full gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-orange-400" />
        <p className="text-gray-400">Chargement des informations société...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
        <CardHeader>
          <CardTitle>{createNewMode ? 'Nouvelle societe' : 'Informations de la societe'}</CardTitle>
          <CardDescription className="text-gray-400">
            Ces informations apparaitront sur vos factures, devis et documents commerciaux.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {company && (
            <div className="flex flex-wrap gap-2">
              {!createNewMode ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFormForNewCompany}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Creer une nouvelle societe
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateNewMode(false);
                    clearCreateQueryParam();
                  }}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Modifier la societe active
                </Button>
              )}
            </div>
          )}

          {/* Logo Section */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 border-b border-gray-800 pb-8">
            <div className="relative group">
              <Avatar
                className="h-28 w-28 border-4 border-gray-800 shadow-lg cursor-pointer transition-all duration-300 group-hover:border-orange-500/50 rounded-xl"
                onClick={() => logoInputRef.current?.click()}
              >
                <AvatarImage src={company?.logo_url} className={`object-contain ${uploading ? 'opacity-50' : ''}`} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-3xl font-bold rounded-xl">
                  {formData.company_name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              {uploading ? (
                <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              ) : (
                <div
                  className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gradient mb-1">Logo de l'entreprise</h3>
                <p className="text-sm text-gray-400">
                  Ce logo apparaîtra sur vos factures et devis. JPG, PNG, SVG. Max 5MB.
                </p>
              </div>
              <div className="flex gap-4">
                <Button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Upload...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" /> Upload Logo
                    </>
                  )}
                </Button>
                {company?.logo_url && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm('Supprimer le logo ?')) deleteLogo();
                    }}
                    disabled={uploading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoChange}
                  disabled={uploading}
                />
              </div>
            </div>
          </div>

          {/* General Info */}
          <div>
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Informations générales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nom de la société *</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  placeholder="Ma Société SAS"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_type">Type de structure</Label>
                <Select value={formData.company_type} onValueChange={(val) => handleSelectChange('company_type', val)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="freelance">Freelance / Auto-entrepreneur</SelectItem>
                    <SelectItem value="company">Société (SAS, SARL, EURL...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t('profileSettings.accountingCurrencyLabel')}</Label>
                <SearchableSelect
                  options={currencyOptions}
                  value={formData.currency}
                  onValueChange={(val) => handleSelectChange('currency', val)}
                  placeholder="Sélectionner une devise"
                  searchPlaceholder="Rechercher une devise..."
                  emptyMessage="Aucune devise trouvée"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500">{t('profileSettings.accountingCurrencyHelp')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration_number">SIRET / N° d'enregistrement</Label>
                <Input
                  id="registration_number"
                  name="registration_number"
                  value={formData.registration_number}
                  onChange={handleChange}
                  placeholder="123 456 789 00012"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">N° de TVA intracommunautaire</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  value={formData.tax_id}
                  onChange={handleChange}
                  placeholder="FR 12 345678901"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp_email">Email de la société</Label>
                <Input
                  id="comp_email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@masociete.fr"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp_phone">Téléphone</Label>
                <Input
                  id="comp_phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+33 1 23 45 67 89"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Site web</Label>
                <Input
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://www.masociete.fr"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Adresse
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="comp_address">Adresse</Label>
                <Input
                  id="comp_address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="123 Rue de la République"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp_city">Ville</Label>
                <Input
                  id="comp_city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Paris"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp_postal_code">Code postal</Label>
                <Input
                  id="comp_postal_code"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="75001"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp_country">Pays</Label>
                <Select value={formData.country} onValueChange={(val) => handleSelectChange('country', val)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Sélectionner" />
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

          {/* Bank Details */}
          <div>
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Coordonnées bancaires
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Ces informations apparaîtront au bas de vos factures pour faciliter les paiements.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Nom de la banque</Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                  placeholder="BNP Paribas"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_account">N° de compte</Label>
                <Input
                  id="bank_account"
                  name="bank_account"
                  value={formData.bank_account}
                  onChange={handleChange}
                  placeholder="00012345678"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  name="iban"
                  value={formData.iban}
                  onChange={handleChange}
                  placeholder="FR76 1234 5678 9012 3456 7890 123"
                  className="bg-gray-800 border-gray-700 text-white font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swift">BIC / SWIFT</Label>
                <Input
                  id="swift"
                  name="swift"
                  value={formData.swift}
                  onChange={handleChange}
                  placeholder="BNPAFRPP"
                  className="bg-gray-800 border-gray-700 text-white font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end pt-6 border-t border-gray-800 bg-gray-900/50">
          <Button
            type="submit"
            disabled={saving || uploading}
            className="bg-orange-500 hover:bg-orange-600 text-white min-w-[180px] shadow-lg shadow-orange-900/20"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Enregistrement...
              </>
            ) : createNewMode ? (
              'Creer la societe'
            ) : (
              'Enregistrer la societe'
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default CompanySettings;
