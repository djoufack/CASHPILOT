
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, CheckCircle2, Lock, Globe2, PenSquare } from 'lucide-react';
import { useCompanySecuritySettings } from '@/hooks/useCompanySecuritySettings';

const SecuritySettings = () => {
  const { getMFAStatus, enrollMFA, verifyMFA, unenrollMFA } = useAuth();
  const { t } = useTranslation();
  const {
    loading: governanceLoading,
    saving: governanceSaving,
    securitySettings,
    esignSettings,
    saveSecuritySettings,
    saveESignSettings,
  } = useCompanySecuritySettings();

  const [mfaStatus, setMfaStatus] = useState({ enabled: false, factors: [] });
  const [enrollData, setEnrollData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('idle'); // 'idle' | 'enrolling' | 'verifying' | 'success'
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [governanceForm, setGovernanceForm] = useState({
    sso_enforced: false,
    sso_provider: 'none',
    saml_entry_point: '',
    saml_issuer: '',
    saml_certificate: '',
    oidc_issuer: '',
    oidc_client_id: '',
    allowed_email_domains: '',
    session_timeout_minutes: 480,
    mfa_required: false,
    ip_allowlist: '',
    audit_webhook_url: '',
  });
  const [esignForm, setESignForm] = useState({
    provider: 'native',
    mode: 'redirect',
    provider_account_id: '',
    webhook_secret: '',
  });

  useEffect(() => {
    setGovernanceForm({
      sso_enforced: !!securitySettings.sso_enforced,
      sso_provider: securitySettings.sso_provider || 'none',
      saml_entry_point: securitySettings.saml_entry_point || '',
      saml_issuer: securitySettings.saml_issuer || '',
      saml_certificate: securitySettings.saml_certificate || '',
      oidc_issuer: securitySettings.oidc_issuer || '',
      oidc_client_id: securitySettings.oidc_client_id || '',
      allowed_email_domains: Array.isArray(securitySettings.allowed_email_domains)
        ? securitySettings.allowed_email_domains.join(', ')
        : '',
      session_timeout_minutes: Number(securitySettings.session_timeout_minutes || 480),
      mfa_required: !!securitySettings.mfa_required,
      ip_allowlist: Array.isArray(securitySettings.ip_allowlist)
        ? securitySettings.ip_allowlist.join(', ')
        : '',
      audit_webhook_url: securitySettings.audit_webhook_url || '',
    });
  }, [securitySettings]);

  useEffect(() => {
    setESignForm({
      provider: esignSettings.provider || 'native',
      mode: esignSettings.mode || 'redirect',
      provider_account_id: esignSettings.provider_account_id || '',
      webhook_secret: esignSettings.webhook_secret || '',
    });
  }, [esignSettings]);

  const loadMFAStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const status = await getMFAStatus();
      setMfaStatus(status);
    } catch (err) {
      console.error('Failed to load MFA status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getMFAStatus]);

  useEffect(() => {
    loadMFAStatus();
  }, [loadMFAStatus]);

  const handleEnroll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await enrollMFA();
      setEnrollData(data);
      setStep('enrolling');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!enrollData || !verifyCode) return;
    setIsLoading(true);
    setError(null);
    try {
      await verifyMFA(enrollData.id, verifyCode);
      setStep('success');
      setVerifyCode('');
      setEnrollData(null);
      await loadMFAStatus();
      // Reset to idle after brief success display
      setTimeout(() => setStep('idle'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnenroll = async (factorId) => {
    setIsLoading(true);
    setError(null);
    try {
      await unenrollMFA(factorId);
      await loadMFAStatus();
      setStep('idle');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!enrollData?.totp?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollData.totp.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = enrollData.totp.secret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCancel = () => {
    setStep('idle');
    setEnrollData(null);
    setVerifyCode('');
    setError(null);
  };

  const parseCsv = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const handleSaveGovernance = async () => {
    setError(null);
    try {
      await saveSecuritySettings({
        ...governanceForm,
        allowed_email_domains: parseCsv(governanceForm.allowed_email_domains),
        ip_allowlist: parseCsv(governanceForm.ip_allowlist),
        session_timeout_minutes: Number(governanceForm.session_timeout_minutes || 480),
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveESign = async () => {
    setError(null);
    try {
      await saveESignSettings({
        ...esignForm,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <Helmet><title>{t('pages.securitySettings', 'Security Settings')} | CashPilot</title></Helmet>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
          {t('security.title', 'Security Settings')}
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          {t('security.subtitle', 'Manage your account security and two-factor authentication.')}
        </p>
      </div>

      {/* MFA Status Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {mfaStatus.enabled ? (
              <ShieldCheck className="w-6 h-6 text-green-400" />
            ) : (
              <Shield className="w-6 h-6 text-gray-400" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t('security.mfa.title', 'Two-Factor Authentication (TOTP)')}
              </h2>
              <p className="text-sm text-gray-400">
                {mfaStatus.enabled
                  ? t('security.mfa.enabled', 'Your account is protected with two-factor authentication.')
                  : t('security.mfa.disabled', 'Add an extra layer of security to your account.')}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              mfaStatus.enabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            {mfaStatus.enabled
              ? t('security.mfa.statusEnabled', 'Enabled')
              : t('security.mfa.statusDisabled', 'Disabled')}
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Idle State - Show Enable/Disable button */}
        {step === 'idle' && !mfaStatus.enabled && (
          <button
            onClick={handleEnroll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('security.mfa.enable', 'Enable MFA')}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {t('security.mfa.enable', 'Enable MFA')}
          </button>
        )}

        {step === 'idle' && mfaStatus.enabled && (
          <div className="space-y-3">
            {mfaStatus.factors.map((factor) => (
              <div
                key={factor.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {factor.friendly_name || t('security.mfa.authenticatorApp')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t('security.mfa.addedOn', 'Added on')} {new Date(factor.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnenroll(factor.id)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={t('security.mfa.disable', 'Disable MFA')}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldOff className="w-4 h-4" />
                  )}
                  {t('security.mfa.disable', 'Disable')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Enrolling State - Show QR Code and Secret */}
        {step === 'enrolling' && enrollData && (
          <div className="space-y-6 mt-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-base font-semibold text-white mb-4">
                {t('security.mfa.scanQR', 'Scan this QR code with your authenticator app')}
              </h3>

              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="bg-white p-4 rounded-xl">
                  <img
                    src={enrollData.totp.qr_code}
                    alt={t('mfa.qrCodeAlt', 'MFA QR Code - scan with authenticator app')}
                    className="w-48 h-48"
                  />
                </div>
              </div>

              {/* Secret Key */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">
                  {t('security.mfa.secretKey', 'Or enter this secret key manually:')}
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-orange-400 font-mono text-sm break-all">
                    {enrollData.totp.secret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm shrink-0"
                    title={t('security.mfa.copySecret', 'Copy secret')}
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Verification Code Input */}
              <form onSubmit={handleVerify}>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('security.mfa.enterCode', 'Enter the 6-digit code from your authenticator app:')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    autoFocus
                    autoComplete="one-time-code"
                    aria-label={t('mfa.codeInput', 'TOTP verification code')}
                  />
                  <button
                    type="submit"
                    disabled={verifyCode.length !== 6 || isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {t('security.mfa.verify', 'Verify')}
                  </button>
                </div>
              </form>

              {/* Cancel Button */}
              <button
                onClick={handleCancel}
                className="mt-4 text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                {t('security.mfa.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <p className="text-green-400 text-sm font-medium">
              {t('security.mfa.success', 'Two-factor authentication has been enabled successfully!')}
            </p>
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('security.enterprise.title', 'Enterprise access governance')}
            </h2>
            <p className="text-sm text-gray-400">
              {t('security.enterprise.subtitle', 'Configure SSO/SAML policy, domain restrictions and session controls.')}
            </p>
          </div>
        </div>

        {governanceLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.loading', 'Chargement...')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-gray-300 space-y-2">
                <span className="block">SSO enforced</span>
                <input
                  type="checkbox"
                  checked={governanceForm.sso_enforced}
                  onChange={(event) => setGovernanceForm((prev) => ({ ...prev, sso_enforced: event.target.checked }))}
                  className="h-4 w-4"
                />
              </label>

              <label className="text-sm text-gray-300 space-y-2">
                <span className="block">SSO provider</span>
                <select
                  value={governanceForm.sso_provider}
                  onChange={(event) => setGovernanceForm((prev) => ({ ...prev, sso_provider: event.target.value }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="none">None</option>
                  <option value="saml">SAML</option>
                  <option value="oidc">OIDC</option>
                </select>
              </label>

              <label className="text-sm text-gray-300 space-y-2">
                <span className="block">Allowed email domains (CSV)</span>
                <input
                  value={governanceForm.allowed_email_domains}
                  onChange={(event) => setGovernanceForm((prev) => ({ ...prev, allowed_email_domains: event.target.value }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  placeholder="example.com, subsidiary.eu"
                />
              </label>

              <label className="text-sm text-gray-300 space-y-2">
                <span className="block">Session timeout (minutes)</span>
                <input
                  type="number"
                  min={15}
                  max={1440}
                  value={governanceForm.session_timeout_minutes}
                  onChange={(event) => setGovernanceForm((prev) => ({ ...prev, session_timeout_minutes: event.target.value }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>

              <label className="text-sm text-gray-300 space-y-2">
                <span className="block">MFA required</span>
                <input
                  type="checkbox"
                  checked={governanceForm.mfa_required}
                  onChange={(event) => setGovernanceForm((prev) => ({ ...prev, mfa_required: event.target.checked }))}
                  className="h-4 w-4"
                />
              </label>

              <label className="text-sm text-gray-300 space-y-2">
                <span className="block">IP allowlist (CIDR, CSV)</span>
                <input
                  value={governanceForm.ip_allowlist}
                  onChange={(event) => setGovernanceForm((prev) => ({ ...prev, ip_allowlist: event.target.value }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  placeholder="203.0.113.0/24, 198.51.100.0/24"
                />
              </label>
            </div>

            {governanceForm.sso_provider === 'saml' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-gray-300 space-y-2">
                  <span className="block">SAML entry point</span>
                  <input
                    value={governanceForm.saml_entry_point}
                    onChange={(event) => setGovernanceForm((prev) => ({ ...prev, saml_entry_point: event.target.value }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm text-gray-300 space-y-2">
                  <span className="block">SAML issuer</span>
                  <input
                    value={governanceForm.saml_issuer}
                    onChange={(event) => setGovernanceForm((prev) => ({ ...prev, saml_issuer: event.target.value }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm text-gray-300 space-y-2 md:col-span-2">
                  <span className="block">SAML certificate (PEM)</span>
                  <textarea
                    rows={4}
                    value={governanceForm.saml_certificate}
                    onChange={(event) => setGovernanceForm((prev) => ({ ...prev, saml_certificate: event.target.value }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </label>
              </div>
            )}

            {governanceForm.sso_provider === 'oidc' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-gray-300 space-y-2">
                  <span className="block">OIDC issuer</span>
                  <input
                    value={governanceForm.oidc_issuer}
                    onChange={(event) => setGovernanceForm((prev) => ({ ...prev, oidc_issuer: event.target.value }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm text-gray-300 space-y-2">
                  <span className="block">OIDC client id</span>
                  <input
                    value={governanceForm.oidc_client_id}
                    onChange={(event) => setGovernanceForm((prev) => ({ ...prev, oidc_client_id: event.target.value }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </label>
              </div>
            )}

            <label className="text-sm text-gray-300 space-y-2 block">
              <span className="block">Audit webhook URL</span>
              <input
                value={governanceForm.audit_webhook_url}
                onChange={(event) => setGovernanceForm((prev) => ({ ...prev, audit_webhook_url: event.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </label>

            <button
              onClick={handleSaveGovernance}
              disabled={governanceSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-60"
            >
              {governanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe2 className="w-4 h-4" />}
              Save enterprise governance
            </button>
          </>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <PenSquare className="w-6 h-6 text-emerald-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('security.esign.title', 'E-signature provider policy')}
            </h2>
            <p className="text-sm text-gray-400">
              {t('security.esign.subtitle', 'Select native signature mode or route quotes through Yousign/DocuSign.')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-gray-300 space-y-2">
            <span className="block">Provider</span>
            <select
              value={esignForm.provider}
              onChange={(event) => setESignForm((prev) => ({ ...prev, provider: event.target.value }))}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="native">Native</option>
              <option value="yousign">Yousign</option>
              <option value="docusign">DocuSign</option>
            </select>
          </label>

          <label className="text-sm text-gray-300 space-y-2">
            <span className="block">Mode</span>
            <select
              value={esignForm.mode}
              onChange={(event) => setESignForm((prev) => ({ ...prev, mode: event.target.value }))}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="redirect">Redirect</option>
              <option value="embedded">Embedded</option>
            </select>
          </label>

          <label className="text-sm text-gray-300 space-y-2">
            <span className="block">Provider account id</span>
            <input
              value={esignForm.provider_account_id}
              onChange={(event) => setESignForm((prev) => ({ ...prev, provider_account_id: event.target.value }))}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </label>

          <label className="text-sm text-gray-300 space-y-2">
            <span className="block">Webhook secret</span>
            <input
              type="password"
              value={esignForm.webhook_secret}
              onChange={(event) => setESignForm((prev) => ({ ...prev, webhook_secret: event.target.value }))}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </label>
        </div>

        <button
          onClick={handleSaveESign}
          disabled={governanceSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-60"
        >
          {governanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenSquare className="w-4 h-4" />}
          Save e-signature policy
        </button>
      </div>
    </div>
  );
};

export default SecuritySettings;
