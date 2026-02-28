import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { Globe, Save, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

const PeppolSettings = () => {
  const { t } = useTranslation();
  const { company, saveCompany, loading } = useCompany();
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [form, setForm] = useState({
    peppol_endpoint_id: '',
    peppol_scheme_id: '0208',
    scrada_company_id: '',
    scrada_api_key: '',
    scrada_password: '',
  });

  useEffect(() => {
    if (company) {
      setForm({
        peppol_endpoint_id: company.peppol_endpoint_id || '',
        peppol_scheme_id: company.peppol_scheme_id || '0208',
        scrada_company_id: company.scrada_company_id || '',
        scrada_api_key: company.scrada_api_key || '',
        scrada_password: company.scrada_password || '',
      });
    }
  }, [company]);

  const handleSave = async () => {
    const success = await saveCompany({
      ...company,
      ...form,
      peppol_ap_provider: 'scrada',
    });
    if (success) {
      toast({ title: t('peppol.scradaConnectionOk'), description: t('messages.success.settingsSaved') });
    }
  };

  const handleTestConnection = async () => {
    if (!form.scrada_company_id || !form.scrada_api_key || !form.scrada_password) {
      toast({ title: t('peppol.scradaConnectionFailed'), description: 'Remplissez les 3 champs Scrada.', variant: 'destructive' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Save first so credentials are in DB, then test via Edge Function-like proxy
      // For now, test by checking if we can reach Scrada directly
      const response = await fetch(
        `https://api.scrada.be/v1/company/${form.scrada_company_id}`,
        {
          method: 'GET',
          headers: {
            'X-API-KEY': form.scrada_api_key,
            'X-PASSWORD': form.scrada_password,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        setTestResult({ success: true });
        toast({ title: t('peppol.scradaConnectionOk'), className: 'bg-green-600 border-none text-white' });
      } else {
        setTestResult({ success: false });
        toast({ title: t('peppol.scradaConnectionFailed'), description: `HTTP ${response.status}`, variant: 'destructive' });
      }
    } catch (err) {
      setTestResult({ success: false });
      toast({ title: t('peppol.scradaConnectionFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
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
          <p className="text-xs text-white/40 mt-1">
            Belgique : numéro d'entreprise BCE/KBO (10 chiffres)
          </p>
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

        <p className="text-xs text-white/40">
          {t('peppol.scradaHelp')}
        </p>

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
            {t('peppol.scradaTestConnection')}
          </Button>
          {testResult && (
            <span className={`flex items-center gap-1 text-xs ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.success
                ? <><CheckCircle className="w-4 h-4" /> {t('peppol.scradaConnectionOk')}</>
                : <><XCircle className="w-4 h-4" /> {t('peppol.scradaConnectionFailed')}</>
              }
            </span>
          )}
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
        <Save className="w-4 h-4 mr-2" />
        {t('common.save')}
      </Button>
    </div>
  );
};

export default PeppolSettings;
