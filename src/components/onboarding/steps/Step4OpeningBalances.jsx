import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, PiggyBank, HelpCircle, MinusCircle } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '@/utils/currencyService';

const BALANCE_FIELDS = [
  {
    key: 'bank_balance',
    labelKey: 'onboarding.balances.bankBalance',
    label: 'Quel est le solde actuel de votre compte bancaire ?',
    tooltip: 'Le montant disponible sur votre compte bancaire business aujourd\'hui.',
    placeholder: '5 000',
    accountFR: '512', accountBE: '550',
  },
  {
    key: 'receivables',
    labelKey: 'onboarding.balances.receivables',
    label: 'Avez-vous des factures clients impayees ? Montant total ?',
    tooltip: 'Combien vos clients vous doivent au total ? Additionnez toutes les factures non reglees.',
    placeholder: '2 500',
    accountFR: '411', accountBE: '400',
  },
  {
    key: 'payables',
    labelKey: 'onboarding.balances.payables',
    label: 'Avez-vous des factures fournisseurs impayees ? Montant total ?',
    tooltip: 'Combien devez-vous a vos fournisseurs ? Additionnez toutes les factures que vous n\'avez pas encore payees.',
    placeholder: '1 200',
    accountFR: '401', accountBE: '440',
  },
  {
    key: 'equity_capital',
    labelKey: 'onboarding.balances.equityCapital',
    label: 'Quel est le capital de votre societe ?',
    tooltip: 'Le montant du capital social inscrit dans les statuts de votre societe. Pour un auto-entrepreneur, laissez 0.',
    placeholder: '10 000',
    accountFR: '101', accountBE: '100',
  },
  {
    key: 'loan_balance',
    labelKey: 'onboarding.balances.loanBalance',
    label: 'Avez-vous un emprunt en cours ? Solde restant ?',
    tooltip: 'Si vous avez un pret professionnel, indiquez le capital restant a rembourser.',
    placeholder: '0',
    accountFR: '164', accountBE: '174',
  },
  {
    key: 'fixed_assets',
    labelKey: 'onboarding.balances.fixedAssets',
    label: 'Valeur estimee de votre materiel/mobilier ?',
    tooltip: 'Ordinateurs, mobilier, vehicules, machines... Estimez la valeur totale actuelle.',
    placeholder: '3 000',
    accountFR: '218', accountBE: '215',
  },
];

const Step4OpeningBalances = ({ onNext, onBack, wizardData, updateWizardData }) => {
  const { t } = useTranslation();
  const [balances, setBalances] = useState(wizardData.openingBalances || {});
  const [skippedFields, setSkippedFields] = useState({});
  const [showTooltip, setShowTooltip] = useState(null);

  const selectedCurrency = wizardData.companyInfo?.currency || 'EUR';
  const currencySymbol = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency)?.symbol || selectedCurrency;

  const handleChange = (key, value) => {
    const numValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    setBalances(prev => ({ ...prev, [key]: numValue }));
    // Un-skip if user starts typing
    if (skippedFields[key]) {
      setSkippedFields(prev => ({ ...prev, [key]: false }));
    }
  };

  const toggleSkip = (key) => {
    setSkippedFields(prev => {
      const newSkipped = { ...prev, [key]: !prev[key] };
      if (newSkipped[key]) {
        // Clear the value when skipping
        setBalances(prevBal => ({ ...prevBal, [key]: '' }));
      }
      return newSkipped;
    });
  };

  const handleNext = () => {
    // Filter out skipped fields
    const filteredBalances = { ...balances };
    Object.keys(skippedFields).forEach(key => {
      if (skippedFields[key]) delete filteredBalances[key];
    });
    updateWizardData('openingBalances', filteredBalances);
    onNext();
  };

  return (
    <div className="space-y-6" role="form" aria-label={t('onboarding.balances.title', 'Vos soldes actuels')}>
      <div className="text-center space-y-1">
        <div
          className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center"
          style={{ background: 'rgba(34, 197, 94, 0.15)' }}
        >
          <PiggyBank className="w-6 h-6" style={{ color: '#22C55E' }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: '#e8eaf0' }}>
          {t('onboarding.balances.title', 'Vos soldes actuels')}
        </h2>
        <p className="text-sm" style={{ color: '#8b92a8' }}>
          {t('onboarding.balances.subtitle', 'Ces montants permettront de demarrer votre comptabilite. Tous les champs sont optionnels.')}
        </p>
        {selectedCurrency !== 'EUR' && (
          <p className="text-xs pt-1" style={{ color: '#3B82F6' }}>
            {t('onboarding.balances.currencyNote', `Devise: ${currencySymbol} ${selectedCurrency}`)}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {BALANCE_FIELDS.map(field => {
          const isSkipped = skippedFields[field.key];

          return (
            <div
              key={field.key}
              className="space-y-1.5 rounded-xl p-3 transition-all"
              style={{
                background: isSkipped ? 'rgba(15, 21, 40, 0.2)' : 'rgba(15, 21, 40, 0.4)',
                border: `1px solid ${isSkipped ? 'rgba(30, 41, 59, 0.3)' : '#1e293b'}`,
                opacity: isSkipped ? 0.5 : 1,
              }}
            >
              <div className="flex items-center gap-2">
                <Label className="text-xs flex-1" style={{ color: isSkipped ? '#4b5563' : '#8b92a8' }}>
                  {t(field.labelKey, field.label)}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowTooltip(showTooltip === field.key ? null : field.key)}
                  className="shrink-0 focus:outline-none focus:ring-1 focus:ring-[#DAA520]/50 rounded"
                  style={{ color: '#8b92a8' }}
                  aria-label={t('onboarding.balances.helpFor', `Aide pour ${field.label}`)}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>

              {showTooltip === field.key && (
                <p
                  className="text-xs rounded px-3 py-2"
                  style={{ color: '#93C5FD', background: 'rgba(59, 130, 246, 0.08)' }}
                  role="tooltip"
                >
                  {field.tooltip}
                </p>
              )}

              {!isSkipped && (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={balances[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="pr-16 text-sm border focus:ring-2 focus:ring-[#DAA520]/40 focus:border-[#DAA520]/60 transition-all"
                    style={{ background: 'rgba(10, 14, 26, 0.5)', borderColor: '#1e293b', color: '#e8eaf0' }}
                    placeholder={field.placeholder}
                    aria-label={t(field.labelKey, field.label)}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                    style={{ color: '#4b5563' }}
                  >
                    {selectedCurrency}
                  </span>
                </div>
              )}

              {/* "I don't know / Fill later" toggle */}
              <button
                type="button"
                onClick={() => toggleSkip(field.key)}
                className="flex items-center gap-1.5 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#DAA520]/50 rounded px-1"
                style={{ color: isSkipped ? '#DAA520' : '#4b5563' }}
              >
                <MinusCircle className="w-3 h-3" />
                {isSkipped
                  ? t('onboarding.balances.fillNow', 'Remplir maintenant')
                  : t('onboarding.balances.skipField', 'Je ne sais pas / Je remplirai plus tard')
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* Advanced mode link */}
      <div className="text-center">
        <p className="text-xs" style={{ color: '#4b5563' }}>
          {t('onboarding.balances.advancedHint', 'Besoin de preciser plus de comptes ?')}{' '}
          <span style={{ color: '#DAA520', cursor: 'pointer' }}>
            {t('onboarding.balances.advancedLink', 'Importez un CSV apres la configuration.')}
          </span>
        </p>
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
          className="text-white font-medium focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e1a] focus:ring-[#DAA520]"
          style={{ background: 'linear-gradient(135deg, #DAA520, #22C55E)' }}
        >
          {t('onboarding.next', 'Suivant')} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default Step4OpeningBalances;
