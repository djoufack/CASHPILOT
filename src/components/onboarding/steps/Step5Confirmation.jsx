import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { initializeAccounting } from '@/services/accountingInitService';
import { ArrowLeft, CheckCircle2, Loader2, Rocket, Building2, FileText, PiggyBank } from 'lucide-react';

const OPENING_BALANCE_ACCOUNTS = {
  FR: { bank_balance: '512', receivables: '411', payables: '401', equity_capital: '101', loan_balance: '164', fixed_assets: '218' },
  BE: { bank_balance: '550', receivables: '400', payables: '440', equity_capital: '100', loan_balance: '174', fixed_assets: '230' },
  OHADA: { bank_balance: '521', receivables: '411', payables: '401', equity_capital: '101', loan_balance: '162', fixed_assets: '215' },
};

const DEBIT_FIELDS = ['bank_balance', 'receivables', 'fixed_assets'];

const Step5Confirmation = ({ onComplete, onBack, wizardData }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [planName, setPlanName] = useState('');
  const [initializing, setInitializing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlanName = async () => {
      if (!wizardData.selectedPlanId || !supabase) return;
      const { data } = await supabase
        .from('accounting_plans')
        .select('name, country_code')
        .eq('id', wizardData.selectedPlanId)
        .single();
      if (data) setPlanName(data.name);
    };
    fetchPlanName();
  }, [wizardData.selectedPlanId]);

  const balanceEntries = Object.entries(wizardData.openingBalances || {})
    .filter(([, val]) => val && parseFloat(val) > 0);

  const handleLaunch = async () => {
    if (!user) return;
    setInitializing(true);
    setError(null);

    try {
      // 1. Initialize chart of accounts, mappings, tax rates
      const country = wizardData.selectedPlanCountry || 'FR';
      setProgress(t('onboarding.confirm.progressAccounts', 'Chargement du plan comptable...'));
      const result = await initializeAccounting(user.id, country);

      if (!result.success) {
        throw new Error(result.error || 'Initialization failed');
      }

      // 2. Generate opening balance journal entries if any
      if (balanceEntries.length > 0) {
        setProgress(t('onboarding.confirm.progressBalances', 'Création des écritures d\'ouverture...'));
        await insertOpeningBalances(user.id, country, wizardData.openingBalances);
      }

      setProgress(t('onboarding.confirm.progressDone', 'Configuration terminée !'));

      // Brief pause so user sees success
      await new Promise(r => setTimeout(r, 800));
      onComplete();
    } catch (err) {
      console.error('Onboarding init error:', err);
      setError(err.message);
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <Rocket className="w-8 h-8 text-orange-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">
          {t('onboarding.confirm.title', 'Tout est prêt !')}
        </h2>
        <p className="text-gray-400 text-sm">
          {t('onboarding.confirm.subtitle', 'Vérifiez le récapitulatif et lancez la configuration.')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="space-y-3">
        {/* Company */}
        {wizardData.companyInfo?.company_name && (
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-4">
            <Building2 className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">{wizardData.companyInfo.company_name}</p>
              <p className="text-gray-500 text-xs">
                {[wizardData.companyInfo.city, wizardData.companyInfo.country].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Plan */}
        {planName && (
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-4">
            <FileText className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">{planName}</p>
              <p className="text-gray-500 text-xs">
                {t('onboarding.confirm.planSelected', 'Plan comptable sélectionné')}
              </p>
            </div>
          </div>
        )}

        {/* Balances */}
        {balanceEntries.length > 0 && (
          <div className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-4">
            <PiggyBank className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium">
                {t('onboarding.confirm.balancesCount', {
                  count: balanceEntries.length,
                  defaultValue: '{{count}} solde(s) renseigné(s)',
                })}
              </p>
              <div className="text-gray-500 text-xs mt-1 space-y-0.5">
                {balanceEntries.map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span>{t(`onboarding.balances.${key}`, key)}</span>
                    <span className="text-gray-400">{parseFloat(val).toLocaleString('fr-FR')} EUR</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress / Error */}
      {initializing && (
        <div className="flex items-center gap-3 bg-blue-500/10 rounded-xl p-4">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
          <p className="text-blue-400 text-sm">{progress}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={initializing} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('onboarding.back', 'Retour')}
        </Button>
        <Button
          onClick={handleLaunch}
          disabled={initializing}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {initializing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Rocket className="w-4 h-4 mr-2" />
          )}
          {t('onboarding.confirm.launch', 'Lancer la configuration')}
        </Button>
      </div>
    </div>
  );
};

async function insertOpeningBalances(userId, country, balances) {
  if (!supabase) return;

  const accounts = OPENING_BALANCE_ACCOUNTS[country] || OPENING_BALANCE_ACCOUNTS.FR;
  const entries = [];
  const today = new Date().toISOString().split('T')[0];

  for (const [key, value] of Object.entries(balances)) {
    const amount = parseFloat(value);
    if (!amount || amount <= 0) continue;

    const accountCode = accounts[key];
    if (!accountCode) continue;

    const isDebit = DEBIT_FIELDS.includes(key);

    entries.push({
      user_id: userId,
      date: today,
      description: `À Nouveau - ${key.replace(/_/g, ' ')}`,
      debit_account: isDebit ? accountCode : '890',
      credit_account: isDebit ? '890' : accountCode,
      amount,
      reference_type: 'opening_balance',
      reference_id: null,
    });
  }

  if (entries.length === 0) return;

  const { error } = await supabase.from('accounting_entries').insert(entries);
  if (error) {
    console.error('Error inserting opening balances:', error.message);
    throw new Error(`Opening balances error: ${error.message}`);
  }
}

export default Step5Confirmation;
