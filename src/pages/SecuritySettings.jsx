
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, CheckCircle2 } from 'lucide-react';

const SecuritySettings = () => {
  const { getMFAStatus, enrollMFA, verifyMFA, unenrollMFA } = useAuth();
  const { t } = useTranslation();

  const [mfaStatus, setMfaStatus] = useState({ enabled: false, factors: [] });
  const [enrollData, setEnrollData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('idle'); // 'idle' | 'enrolling' | 'verifying' | 'success'
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    setIsLoading(true);
    try {
      const status = await getMFAStatus();
      setMfaStatus(status);
    } catch (err) {
      console.error('Failed to load MFA status:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
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
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Idle State - Show Enable/Disable button */}
        {step === 'idle' && !mfaStatus.enabled && (
          <button
            onClick={handleEnroll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      {factor.friendly_name || 'TOTP Authenticator'}
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
                    alt="MFA QR Code"
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
    </div>
  );
};

export default SecuritySettings;
