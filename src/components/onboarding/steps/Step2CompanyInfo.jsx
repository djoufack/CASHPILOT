import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { COUNTRIES } from '@/constants/countries';
import { SUPPORTED_CURRENCIES } from '@/utils/currencyService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react';

const Step2CompanyInfo = ({ onNext, onBack, wizardData, updateWizardData }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    company_name: '',
    company_type: 'freelance',
    tax_id: '',
    address: '',
    city: '',
    postal_code: '',
    country: '',
    currency: 'EUR',
    phone: '',
    email: '',
    iban: '',
    ...wizardData.companyInfo,
  });
  const [saving, setSaving] = useState(false);

  const countryOptions = useMemo(() =>
    COUNTRIES.map(c => ({ value: c.code, label: c.label })),
    []
  );

  const currencyOptions = useMemo(() =>
    SUPPORTED_CURRENCIES.map(c => ({
      value: c.code,
      label: `${c.symbol} ${c.code} - ${c.name}`
    })),
    []
  );

  useEffect(() => {
    if (!user || !supabase) return;
    const loadCompany = async () => {
      const { data } = await supabase
        .from('company')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setForm(prev => ({ ...prev, ...data }));
      }
    };
    loadCompany();
  }, [user]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    const missingFields = [];
    if (!form.company_name?.trim()) missingFields.push(t('onboarding.company.name', "Nom de l'entreprise"));

    if (missingFields.length > 0) {
      toast({
        title: t('validation.missingFields', 'Champs obligatoires manquants'),
        description: `${t('validation.pleaseComplete', 'Veuillez remplir')} : ${missingFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (supabase && user) {
        const { error } = await supabase
          .from('company')
          .upsert({
            user_id: user.id,
            ...form,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        if (error) {
          toast({
            title: t('messages.error.companySaveFailed', 'Erreur de sauvegarde'),
            description: t('messages.error.companySaveDescription', "Impossible de sauvegarder les informations de l'entreprise. Veuillez reessayer."),
            variant: "destructive"
          });
        }
      }
      updateWizardData('companyInfo', form);
      onNext();
    } catch (err) {
      toast({
        title: t('messages.error.companySaveFailed', 'Erreur de sauvegarde'),
        description: t('messages.error.companySaveDescription', "Impossible de sauvegarder les informations de l'entreprise. Veuillez reessayer."),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Design DNA input classes
  const inputClass = 'border text-sm focus:ring-2 focus:ring-[#DAA520]/40 focus:border-[#DAA520]/60 transition-all';
  const inputStyle = { background: 'rgba(15, 21, 40, 0.5)', borderColor: '#1e293b', color: '#e8eaf0' };

  return (
    <div className="space-y-6" role="form" aria-label={t('onboarding.company.title', 'Votre entreprise')}>
      <div className="text-center space-y-1">
        <div
          className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center"
          style={{ background: 'rgba(218, 165, 32, 0.15)' }}
        >
          <Building2 className="w-6 h-6" style={{ color: '#DAA520' }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: '#e8eaf0' }}>
          {t('onboarding.company.title', 'Votre entreprise')}
        </h2>
        <p className="text-sm" style={{ color: '#8b92a8' }}>
          {t('onboarding.company.subtitle', 'Ces informations apparaitront sur vos factures et documents.')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>
            {t('onboarding.company.name', "Nom de l'entreprise")} <span className="text-red-400">*</span>
          </Label>
          <Input
            value={form.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="Ma Societe SARL"
            aria-required="true"
            aria-label={t('onboarding.company.name', "Nom de l'entreprise")}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>{t('onboarding.company.type', 'Type')}</Label>
          <Select value={form.company_type} onValueChange={(v) => handleChange('company_type', v)}>
            <SelectTrigger className={inputClass} style={inputStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="freelance">Freelance / Auto-entrepreneur</SelectItem>
              <SelectItem value="company">Societe (SARL, SAS, SA...)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>{t('onboarding.company.taxId', 'N. TVA / SIRET')}</Label>
          <Input
            value={form.tax_id}
            onChange={(e) => handleChange('tax_id', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="FR12345678901"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>{t('onboarding.company.address', 'Adresse')}</Label>
          <Input
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="12 rue de la Paix"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>{t('onboarding.company.city', 'Ville')}</Label>
          <Input
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="Paris"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>{t('onboarding.company.postalCode', 'Code postal')}</Label>
          <Input
            value={form.postal_code}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="75001"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>{t('onboarding.company.country', 'Pays')}</Label>
          <SearchableSelect
            options={countryOptions}
            value={form.country}
            onValueChange={(v) => handleChange('country', v)}
            placeholder={t('onboarding.company.selectCountry', 'Selectionner un pays')}
            searchPlaceholder="Rechercher un pays..."
            emptyMessage="Aucun pays trouve"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>{t('onboarding.company.currency', 'Devise de travail')}</Label>
          <SearchableSelect
            options={currencyOptions}
            value={form.currency}
            onValueChange={(v) => handleChange('currency', v)}
            placeholder={t('onboarding.company.selectCurrency', 'Selectionner une devise')}
            searchPlaceholder="Rechercher une devise..."
            emptyMessage="Aucune devise trouvee"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs" style={{ color: '#8b92a8' }}>IBAN</Label>
          <Input
            value={form.iban}
            onChange={(e) => handleChange('iban', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="FR76 1234 5678 9012 3456 789"
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="hover:text-[#e8eaf0] focus:ring-2 focus:ring-[#DAA520]/40"
          style={{ color: '#8b92a8' }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('onboarding.back', 'Retour')}
        </Button>
        <Button
          onClick={handleNext}
          disabled={saving}
          className="text-white font-medium focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e1a] focus:ring-[#DAA520]"
          style={{ background: 'linear-gradient(135deg, #DAA520, #22C55E)' }}
        >
          {saving
            ? t('common.saving', 'Sauvegarde...')
            : t('onboarding.next', 'Suivant')
          }
          {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
};

export default Step2CompanyInfo;
