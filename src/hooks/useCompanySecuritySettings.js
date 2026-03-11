import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const DEFAULT_SECURITY_SETTINGS = {
  sso_enforced: false,
  sso_provider: 'none',
  saml_entry_point: '',
  saml_issuer: '',
  saml_certificate: '',
  oidc_issuer: '',
  oidc_client_id: '',
  allowed_email_domains: [],
  session_timeout_minutes: 480,
  mfa_required: false,
  ip_allowlist: [],
  audit_webhook_url: '',
};

const DEFAULT_ESIGN_SETTINGS = {
  provider: 'native',
  mode: 'redirect',
  provider_account_id: '',
  webhook_secret: '',
};

const normalizeList = (raw) => (
  String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

export const useCompanySecuritySettings = () => {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [securitySettings, setSecuritySettings] = useState(DEFAULT_SECURITY_SETTINGS);
  const [esignSettings, setESignSettings] = useState(DEFAULT_ESIGN_SETTINGS);

  const fetchSettings = useCallback(async () => {
    if (!supabase || !user || !activeCompanyId) {
      setSecuritySettings(DEFAULT_SECURITY_SETTINGS);
      setESignSettings(DEFAULT_ESIGN_SETTINGS);
      return;
    }

    setLoading(true);
    try {
      const [{ data: securityRow }, { data: esignRow }] = await Promise.all([
        supabase
          .from('company_security_settings')
          .select('*')
          .eq('company_id', activeCompanyId)
          .maybeSingle(),
        supabase
          .from('company_esign_settings')
          .select('*')
          .eq('company_id', activeCompanyId)
          .maybeSingle(),
      ]);

      setSecuritySettings({
        ...DEFAULT_SECURITY_SETTINGS,
        ...(securityRow || {}),
        allowed_email_domains: Array.isArray(securityRow?.allowed_email_domains) ? securityRow.allowed_email_domains : [],
        ip_allowlist: Array.isArray(securityRow?.ip_allowlist) ? securityRow.ip_allowlist : [],
      });

      setESignSettings({
        ...DEFAULT_ESIGN_SETTINGS,
        ...(esignRow || {}),
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSecuritySettings = useCallback(async (partialUpdates) => {
    if (!supabase || !user || !activeCompanyId) {
      return null;
    }

    const merged = {
      ...securitySettings,
      ...(partialUpdates || {}),
    };

    const payload = {
      company_id: activeCompanyId,
      user_id: user.id,
      sso_enforced: !!merged.sso_enforced,
      sso_provider: merged.sso_provider || 'none',
      saml_entry_point: merged.saml_entry_point || null,
      saml_issuer: merged.saml_issuer || null,
      saml_certificate: merged.saml_certificate || null,
      oidc_issuer: merged.oidc_issuer || null,
      oidc_client_id: merged.oidc_client_id || null,
      allowed_email_domains: Array.isArray(merged.allowed_email_domains)
        ? merged.allowed_email_domains
        : normalizeList(merged.allowed_email_domains),
      session_timeout_minutes: Number(merged.session_timeout_minutes || 480),
      mfa_required: !!merged.mfa_required,
      ip_allowlist: Array.isArray(merged.ip_allowlist)
        ? merged.ip_allowlist
        : normalizeList(merged.ip_allowlist),
      audit_webhook_url: merged.audit_webhook_url || null,
    };

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('company_security_settings')
        .upsert(payload, { onConflict: 'company_id' })
        .select()
        .single();

      if (error) throw error;
      setSecuritySettings({
        ...DEFAULT_SECURITY_SETTINGS,
        ...data,
        allowed_email_domains: Array.isArray(data.allowed_email_domains) ? data.allowed_email_domains : [],
        ip_allowlist: Array.isArray(data.ip_allowlist) ? data.ip_allowlist : [],
      });
      return data;
    } finally {
      setSaving(false);
    }
  }, [activeCompanyId, securitySettings, user]);

  const saveESignSettings = useCallback(async (partialUpdates) => {
    if (!supabase || !user || !activeCompanyId) {
      return null;
    }

    const merged = {
      ...esignSettings,
      ...(partialUpdates || {}),
    };

    const payload = {
      company_id: activeCompanyId,
      user_id: user.id,
      provider: merged.provider || 'native',
      mode: merged.mode || 'redirect',
      provider_account_id: merged.provider_account_id || null,
      webhook_secret: merged.webhook_secret || null,
    };

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('company_esign_settings')
        .upsert(payload, { onConflict: 'company_id' })
        .select()
        .single();

      if (error) throw error;
      setESignSettings({
        ...DEFAULT_ESIGN_SETTINGS,
        ...data,
      });
      return data;
    } finally {
      setSaving(false);
    }
  }, [activeCompanyId, esignSettings, user]);

  return {
    loading,
    saving,
    securitySettings,
    esignSettings,
    fetchSettings,
    saveSecuritySettings,
    saveESignSettings,
  };
};

export default useCompanySecuritySettings;
