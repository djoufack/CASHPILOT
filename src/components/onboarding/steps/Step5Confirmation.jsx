import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { initializeAccounting } from '@/services/accountingInitService';
import { ArrowLeft, CheckCircle2, Loader2, Rocket, Building2, FileText, PiggyBank, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OPENING_BALANCE_ACCOUNTS = {
  FR: { bank_balance: '512', receivables: '411', payables: '401', equity_capital: '101', loan_balance: '164', fixed_assets: '218' },
  BE: { bank_balance: '550', receivables: '400', payables: '440', equity_capital: '100', loan_balance: '174', fixed_assets: '230' },
  OHADA: { bank_balance: '521', receivables: '411', payables: '401', equity_capital: '101', loan_balance: '162', fixed_assets: '215' },
};

const DEBIT_FIELDS = ['bank_balance', 'receivables', 'fixed_assets'];

// Simple confetti particle component
const ConfettiParticle = ({ index }) => {
  const colors = ['#DAA520', '#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899'];
  const color = colors[index % colors.length];
  const left = Math.random() * 100;
  const delay = Math.random() * 0.5;
  const duration = 1.5 + Math.random() * 1;
  const size = 4 + Math.random() * 6;
  const rotation = Math.random() * 360;

  return (
    <motion.div
      initial={{ opacity: 1, y: -20, x: 0, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, 200, 400],
        x: [0, (Math.random() - 0.5) * 100],
        rotate: [0, rotation, rotation * 2],
      }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: 0,
        width: size,
        height: size,
        background: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      }}
    />
  );
};

const Step5Confirmation = ({ onComplete, onBack, wizardData }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [planName, setPlanName] = useState('');
  const [initializing, setInitializing] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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

  const handleLaunch = useCallback(async () => {
    if (!user) return;
    setInitializing(true);
    setError(null);
    setProgressPercent(10);

    try {
      const country = wizardData.selectedPlanCountry || 'FR';

      setProgress(t('onboarding.confirm.progressAccounts', 'Chargement du plan comptable...'));
      setProgressPercent(30);
      const result = await initializeAccounting(user.id, country);

      if (!result.success) {
        throw new Error(result.error || 'Initialization failed');
      }

      setProgressPercent(60);

      if (balanceEntries.length > 0) {
        setProgress(t('onboarding.confirm.progressBalances', "Creation des ecritures d'ouverture..."));
        setProgressPercent(80);
        await insertOpeningBalances(user.id, country, wizardData.openingBalances);
      }

      setProgress(t('onboarding.confirm.progressDone', 'Configuration terminee !'));
      setProgressPercent(100);
      setSuccess(true);

      // Brief pause so user sees the success animation
      await new Promise(r => setTimeout(r, 2000));
      onComplete();
    } catch (err) {
      console.error('Onboarding init error:', err);
      setError(err.message);
      setInitializing(false);
      setProgressPercent(0);
    }
  }, [user, wizardData, balanceEntries.length, t, onComplete]);

  const selectedCurrency = wizardData.companyInfo?.currency || 'EUR';

  return (
    <div className="space-y-6 relative overflow-hidden" role="region" aria-label={t('onboarding.confirm.title', 'Tout est pret !')}>
      {/* Confetti animation on success */}
      {success && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
              style={{ background: 'rgba(34, 197, 94, 0.15)' }}
            >
              <PartyPopper className="w-10 h-10" style={{ color: '#22C55E' }} />
            </motion.div>
            <h2 className="text-2xl font-bold" style={{ color: '#e8eaf0' }}>
              {t('onboarding.confirm.successTitle', 'Votre comptabilite est prete !')}
            </h2>
            <p style={{ color: '#8b92a8' }}>
              {t('onboarding.confirm.successMessage', 'Redirection vers votre tableau de bord...')}
            </p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-center space-y-1">
              <div
                className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center"
                style={{ background: 'rgba(218, 165, 32, 0.15)' }}
              >
                <Rocket className="w-6 h-6" style={{ color: '#DAA520' }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: '#e8eaf0' }}>
                {t('onboarding.confirm.title', 'Tout est pret !')}
              </h2>
              <p className="text-sm" style={{ color: '#8b92a8' }}>
                {t('onboarding.confirm.subtitle', 'Verifiez le recapitulatif et lancez la configuration.')}
              </p>
            </div>

            {/* Summary cards */}
            <div className="space-y-3 mt-6">
              {/* Company */}
              {wizardData.companyInfo?.company_name && (
                <div
                  className="flex items-center gap-3 rounded-xl p-4"
                  style={{ background: 'rgba(15, 21, 40, 0.5)', border: '1px solid #1e293b' }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(218, 165, 32, 0.15)' }}
                  >
                    <Building2 className="w-4 h-4" style={{ color: '#DAA520' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#e8eaf0' }}>{wizardData.companyInfo.company_name}</p>
                    <p className="text-xs" style={{ color: '#8b92a8' }}>
                      {[wizardData.companyInfo.city, wizardData.companyInfo.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" style={{ color: '#22C55E' }} />
                </div>
              )}

              {/* Plan */}
              {planName && (
                <div
                  className="flex items-center gap-3 rounded-xl p-4"
                  style={{ background: 'rgba(15, 21, 40, 0.5)', border: '1px solid #1e293b' }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(59, 130, 246, 0.15)' }}
                  >
                    <FileText className="w-4 h-4" style={{ color: '#3B82F6' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#e8eaf0' }}>{planName}</p>
                    <p className="text-xs" style={{ color: '#8b92a8' }}>
                      {t('onboarding.confirm.planSelected', 'Plan comptable selectionne')}
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" style={{ color: '#22C55E' }} />
                </div>
              )}

              {/* Balances */}
              {balanceEntries.length > 0 && (
                <div
                  className="flex items-start gap-3 rounded-xl p-4"
                  style={{ background: 'rgba(15, 21, 40, 0.5)', border: '1px solid #1e293b' }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(34, 197, 94, 0.15)' }}
                  >
                    <PiggyBank className="w-4 h-4" style={{ color: '#22C55E' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#e8eaf0' }}>
                      {t('onboarding.confirm.balancesCount', {
                        count: balanceEntries.length,
                        defaultValue: '{{count}} solde(s) renseigne(s)',
                      })}
                    </p>
                    <div className="text-xs mt-1 space-y-0.5" style={{ color: '#8b92a8' }}>
                      {balanceEntries.map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span>{t(`onboarding.balances.${key}`, key)}</span>
                          <span style={{ color: '#e8eaf0' }}>
                            {parseFloat(val).toLocaleString('fr-FR')} {selectedCurrency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-1" style={{ color: '#22C55E' }} />
                </div>
              )}
            </div>

            {/* Progress indicator */}
            {initializing && (
              <div className="mt-4 space-y-3">
                <div
                  className="flex items-center gap-3 rounded-xl p-4"
                  style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                >
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: '#3B82F6' }} />
                  <p className="text-sm" style={{ color: '#93C5FD' }}>{progress}</p>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.5)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #DAA520, #22C55E)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="mt-4 rounded-xl p-4"
                style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                role="alert"
              >
                <p className="text-sm" style={{ color: '#FCA5A5' }}>{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={onBack}
                disabled={initializing}
                className="hover:text-[#e8eaf0] focus:ring-2 focus:ring-[#DAA520]/40"
                style={{ color: '#8b92a8' }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> {t('onboarding.back', 'Retour')}
              </Button>
              <Button
                onClick={handleLaunch}
                disabled={initializing}
                className="text-white font-medium focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e1a] focus:ring-[#DAA520]"
                style={{ background: 'linear-gradient(135deg, #DAA520, #22C55E)' }}
              >
                {initializing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t('onboarding.confirm.initializing', 'Configuration...')}
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    {t('onboarding.confirm.launch', 'Lancer la configuration')}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      description: `A Nouveau - ${key.replace(/_/g, ' ')}`,
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
