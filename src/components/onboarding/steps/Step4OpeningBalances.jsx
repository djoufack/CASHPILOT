import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, PiggyBank, HelpCircle } from 'lucide-react';

const BALANCE_FIELDS = [
  {
    key: 'bank_balance',
    labelKey: 'onboarding.balances.bankBalance',
    label: 'Solde actuel de votre compte bancaire professionnel',
    tooltip: 'Le montant disponible sur votre compte bancaire business aujourd\'hui.',
    placeholder: '5 000',
  },
  {
    key: 'receivables',
    labelKey: 'onboarding.balances.receivables',
    label: 'Montant total des factures clients impayées',
    tooltip: 'Combien vos clients vous doivent au total ? Additionnez toutes les factures non réglées.',
    placeholder: '2 500',
  },
  {
    key: 'payables',
    labelKey: 'onboarding.balances.payables',
    label: 'Montant total des factures fournisseurs impayées',
    tooltip: 'Combien devez-vous à vos fournisseurs ? Additionnez toutes les factures que vous n\'avez pas encore payées.',
    placeholder: '1 200',
  },
  {
    key: 'equity_capital',
    labelKey: 'onboarding.balances.equityCapital',
    label: 'Capital de votre entreprise',
    tooltip: 'Le montant du capital social inscrit dans les statuts de votre société. Pour un auto-entrepreneur, laissez 0.',
    placeholder: '10 000',
  },
  {
    key: 'loan_balance',
    labelKey: 'onboarding.balances.loanBalance',
    label: 'Emprunt en cours ? Montant restant dû',
    tooltip: 'Si vous avez un prêt professionnel, indiquez le capital restant à rembourser.',
    placeholder: '0',
  },
  {
    key: 'fixed_assets',
    labelKey: 'onboarding.balances.fixedAssets',
    label: 'Valeur estimée du matériel professionnel',
    tooltip: 'Ordinateurs, mobilier, véhicules, machines... Estimez la valeur totale actuelle.',
    placeholder: '3 000',
  },
];

const Step4OpeningBalances = ({ onNext, onBack, wizardData, updateWizardData }) => {
  const { t } = useTranslation();
  const [balances, setBalances] = useState(wizardData.openingBalances || {});
  const [showTooltip, setShowTooltip] = useState(null);

  const handleChange = (key, value) => {
    const numValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    setBalances(prev => ({ ...prev, [key]: numValue }));
  };

  const handleNext = () => {
    updateWizardData('openingBalances', balances);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <PiggyBank className="w-8 h-8 text-green-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">
          {t('onboarding.balances.title', 'Vos soldes actuels')}
        </h2>
        <p className="text-gray-400 text-sm">
          {t('onboarding.balances.subtitle', 'Ces montants permettront de démarrer votre comptabilité. Tous les champs sont optionnels.')}
        </p>
      </div>

      <div className="space-y-4">
        {BALANCE_FIELDS.map(field => (
          <div key={field.key} className="space-y-1">
            <div className="flex items-center gap-2">
              <Label className="text-gray-300 text-xs flex-1">
                {t(field.labelKey, field.label)}
              </Label>
              <button
                type="button"
                onClick={() => setShowTooltip(showTooltip === field.key ? null : field.key)}
                className="text-gray-500 hover:text-gray-300"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            {showTooltip === field.key && (
              <p className="text-xs text-blue-400/80 bg-blue-500/10 rounded px-3 py-2">
                {field.tooltip}
              </p>
            )}
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={balances[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="bg-gray-800/50 border-gray-700 text-white pr-10"
                placeholder={field.placeholder}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">EUR</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('onboarding.back', 'Retour')}
        </Button>
        <Button onClick={handleNext} className="bg-orange-500 hover:bg-orange-600 text-white">
          {t('onboarding.next', 'Suivant')} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default Step4OpeningBalances;
