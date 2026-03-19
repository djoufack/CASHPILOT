import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { useCreditsGuard, CREDIT_COSTS, CREDIT_COST_LABELS } from '@/hooks/useCreditsGuard';
import { readFunctionErrorData } from '@/utils/supabaseFunctionErrors';
import { Globe, Save, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

const withTimeout = async (factory, timeoutMs = 30000, message = null) => {
  let timeoutId = null;
  try {
    return await Promise.race([
      factory(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message || `La requête a expiré après ${Math.round(timeoutMs / 1000)}s.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const invokeFunctionWithTimeout = async (name, options, timeoutMs = 30000, timeoutMessage = null) => {
  return withTimeout(
    () => supabase.functions.invoke(name, options),
    timeoutMs,
    timeoutMessage || `La requete ${name} a expire apres ${Math.round(timeoutMs / 1000)}s.`
  );
};

const PEPPOL_SAVE_TIMEOUT_MS = 45000;
const PEPPOL_CONFIGURE_TIMEOUT_MS = 45000;

const PeppolSettings = () => {
  const { t } = useTranslation();
  const { company, fetchCompany, loading } = useCompany();
  const { toast } = useToast();
  const { openCreditsModal, modalProps } = useCreditsGuard();
  const [testing, setTesting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [form, setForm] = useState({
    peppol_endpoint_id: '',
    peppol_scheme_id: '0208',
    scrada_company_id: '',
    scrada_api_key: '',
    scrada_password: '',
  });

  const refreshCompanySilently = async () => {
    try {
      await withTimeout(() => fetchCompany(), 15000);
    } catch (refreshError) {
      console.warn('[PeppolSettings] company refresh skipped:', refreshError?.message || refreshError);
    }
  };

  useEffect(() => {
    if (company) {
      setForm({
        peppol_endpoint_id: company.peppol_endpoint_id || '',
        peppol_scheme_id: company.peppol_scheme_id || '0208',
        scrada_company_id: company.scrada_company_id || '',
        scrada_api_key: '',
        scrada_password: '',
      });
    }
  }, [company]);

  const saveCompanyPeppolProfile = async () => {
    if (!company?.id) {
      throw new Error('Company profile is required before saving Peppol settings.');
    }

    const payload = {
      company_id: company.id,
      peppol_endpoint_id: String(form.peppol_endpoint_id || '').trim(),
      peppol_scheme_id: String(form.peppol_scheme_id || '0208').trim() || '0208',
      peppol_ap_provider: 'scrada',
      scrada_company_id: String(form.scrada_company_id || '').trim() || null,
    };

    const { error } = await invokeFunctionWithTimeout(
      'peppol-save-credentials',
      { body: payload },
      PEPPOL_SAVE_TIMEOUT_MS,
      "L'enregistrement des parametres Peppol a expire."
    );
    if (error) throw error;

    void refreshCompanySilently();
    return true;
  };

  const saveScradaCredentials = async () => {
    if (!company?.id) {
      throw new Error('Company profile is required before saving Scrada credentials.');
    }

    const payload = {
      company_id: company.id,
      scrada_company_id: String(form.scrada_company_id || '').trim(),
      scrada_api_key: String(form.scrada_api_key || ''),
      scrada_password: String(form.scrada_password || ''),
    };

    const { error } = await invokeFunctionWithTimeout(
      'peppol-save-credentials',
      { body: payload },
      PEPPOL_SAVE_TIMEOUT_MS,
      "L'enregistrement des identifiants Scrada a expire."
    );

    if (error) throw error;
    void refreshCompanySilently();
  };

  const handleSave = async () => {
    const hasSecretInput = Boolean(form.scrada_api_key || form.scrada_password);

    if (hasSecretInput && (!form.scrada_company_id || !form.scrada_api_key || !form.scrada_password)) {
      toast({
        title: t('peppol.scradaConnectionFailed'),
        description: 'Remplissez les 3 champs Scrada.',
        variant: 'destructive',
      });
      return;
    }

    setSavingSettings(true);
    try {
      const success = await saveCompanyPeppolProfile();
      if (!success) return;

      if (hasSecretInput) {
        await saveScradaCredentials();
        setForm((prev) => ({ ...prev, scrada_api_key: '', scrada_password: '' }));
      }

      toast({ title: t('peppol.scradaConnectionOk'), description: t('messages.success.settingsSaved') });
    } catch (err) {
      const details = await readFunctionErrorData(err);
      toast({
        title: t('peppol.scradaConnectionFailed'),
        description: details?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    const hasSecretInput = Boolean(form.scrada_api_key || form.scrada_password);

    if (hasSecretInput && (!form.scrada_company_id || !form.scrada_api_key || !form.scrada_password)) {
      toast({
        title: t('peppol.scradaConnectionFailed'),
        description: 'Remplissez les 3 champs Scrada.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasSecretInput && !company?.has_scrada_credentials) {
      toast({
        title: t('peppol.scradaConnectionFailed'),
        description: 'Ajoutez d abord vos identifiants Scrada.',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const saved = await saveCompanyPeppolProfile();
      if (!saved) {
        setTestResult({ success: false });
        return;
      }

      if (hasSecretInput) {
        await saveScradaCredentials();
        setForm((prev) => ({ ...prev, scrada_api_key: '', scrada_password: '' }));
      }

      const { data, error } = await invokeFunctionWithTimeout(
        'peppol-configure',
        {
          body: { company_id: company?.id || null },
        },
        PEPPOL_CONFIGURE_TIMEOUT_MS,
        'La validation Scrada a expire.'
      );
      if (error) throw error;

      setTestResult({ success: true });
      toast({
        title: t('peppol.scradaConnectionOk'),
        description: data?.charged
          ? `${t(CREDIT_COST_LABELS.PEPPOL_CONFIGURATION_OK)}: ${CREDIT_COSTS.PEPPOL_CONFIGURATION_OK} ${t('credits.creditsLabel')}.`
          : t('messages.success.settingsSaved'),
        className: 'bg-green-600 border-none text-white',
      });
    } catch (err) {
      const details = await readFunctionErrorData(err);
      setTestResult({ success: false });
      if (details?.error === 'insufficient_credits') {
        openCreditsModal(CREDIT_COSTS.PEPPOL_CONFIGURATION_OK, t(CREDIT_COST_LABELS.PEPPOL_CONFIGURATION_OK));
        return;
      }

      toast({
        title: t('peppol.scradaConnectionFailed'),
        description: (() => {
          const message = (details?.error || err.message || '').toLowerCase();
          if (message.includes('timed out') || message.includes('expir')) {
            return "Scrada ne répond pas à temps. Vérifiez l'état du compte Scrada (vérification en cours) ou réessayez.";
          }
          return details?.error || err.message;
        })(),
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <CreditsGuardModal {...modalProps} />
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-semibold text-white">{t('peppol.settings')}</h3>
      </div>

      {/* Company Peppol Identity */}
      <div className="space-y-4 bg-white/5 rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-medium text-white/80">{t('peppol.companyEndpoint')}</h4>

        <div>
          <label className="text-sm text-white/60">{t('peppol.endpointId')}</label>
          <Input
            value={form.peppol_endpoint_id}
            onChange={(e) => setForm({ ...form, peppol_endpoint_id: e.target.value })}
            placeholder="0123456789"
            className="bg-white/5 border-white/10 mt-1"
          />
          <p className="text-xs text-white/40 mt-1">Belgique : numéro d'entreprise BCE/KBO (10 chiffres)</p>
        </div>

        <div>
          <label className="text-sm text-white/60">{t('peppol.schemeId')}</label>
          <select
            value={form.peppol_scheme_id}
            onChange={(e) => setForm({ ...form, peppol_scheme_id: e.target.value })}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm mt-1"
          >
            <option value="0208">0208 - BE (BCE/KBO)</option>
            <option value="0009">0009 - FR (SIRET)</option>
            <option value="0088">0088 - EAN/GLN</option>
          </select>
        </div>
      </div>

      {/* Scrada Credentials */}
      <div className="space-y-4 bg-white/5 rounded-lg p-4 border border-emerald-500/20">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-emerald-400">Scrada — Access Point Peppol</h4>
          <a
            href="https://my.scrada.be"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            {t('peppol.scradaSignupLink')} <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <p className="text-xs text-white/40">{t('peppol.scradaHelp')}</p>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
          <p className="text-xs text-emerald-300">
            {t('peppolPage.creditPolicy.settingsValidationHint', {
              credits: CREDIT_COSTS.PEPPOL_CONFIGURATION_OK,
              unit: t('credits.creditsLabel'),
              defaultValue: `Le test de validation facture ${CREDIT_COSTS.PEPPOL_CONFIGURATION_OK} ${t('credits.creditsLabel')} uniquement apres une validation reussie.`,
            })}
          </p>
          <p className="text-xs text-white/40">
            {t(
              'peppolPage.creditPolicy.settingsSavedFreeHint',
              "L'enregistrement simple des champs ne consomme pas de credits."
            )}
          </p>
        </div>

        <div>
          <label className="text-sm text-white/60">{t('peppol.scradaCompanyId')}</label>
          <Input
            value={form.scrada_company_id}
            onChange={(e) => setForm({ ...form, scrada_company_id: e.target.value })}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="bg-white/5 border-white/10 mt-1 font-mono text-xs"
          />
        </div>

        <div>
          <label className="text-sm text-white/60">{t('peppol.scradaApiKey')}</label>
          <Input
            type="password"
            value={form.scrada_api_key}
            onChange={(e) => setForm({ ...form, scrada_api_key: e.target.value })}
            placeholder="••••••••"
            className="bg-white/5 border-white/10 mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-white/60">{t('peppol.scradaPassword')}</label>
          <Input
            type="password"
            value={form.scrada_password}
            onChange={(e) => setForm({ ...form, scrada_password: e.target.value })}
            placeholder="••••••••"
            className="bg-white/5 border-white/10 mt-1"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleTestConnection}
            disabled={testing || !form.scrada_company_id}
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {t('peppolPage.creditPolicy.sendlessConfigButton', {
              testLabel: t('peppol.scradaTestConnection'),
              credits: CREDIT_COSTS.PEPPOL_CONFIGURATION_OK,
              unit: t('credits.creditsLabel'),
              defaultValue: `${t('peppol.scradaTestConnection')} (${CREDIT_COSTS.PEPPOL_CONFIGURATION_OK} ${t('credits.creditsLabel')})`,
            })}
          </Button>
          {testResult && (
            <span
              className={`flex items-center gap-1 text-xs ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle className="w-4 h-4" /> {t('peppol.scradaConnectionOk')}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" /> {t('peppol.scradaConnectionFailed')}
                </>
              )}
            </span>
          )}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={loading || savingSettings || testing}
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        {t('common.save')}
      </Button>
    </div>
  );
};

export default PeppolSettings;
