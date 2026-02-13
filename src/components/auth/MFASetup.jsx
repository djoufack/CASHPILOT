import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

/**
 * MFASetup - TOTP enrollment component
 * Handles the full MFA enrollment flow: enroll -> show QR -> verify first code -> success
 *
 * @param {Function} onComplete - Called when MFA setup is completed successfully
 * @param {Function} onCancel - Called when user cancels the setup
 */
const MFASetup = ({ onComplete, onCancel }) => {
  const { enrollMFA, verifyMFA } = useAuth();
  const { t } = useTranslation();

  const [step, setStep] = useState('idle'); // 'idle' | 'loading' | 'qr' | 'verifying' | 'success'
  const [enrollData, setEnrollData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleStartEnroll = async () => {
    setStep('loading');
    setError(null);
    try {
      const data = await enrollMFA();
      setEnrollData(data);
      setStep('qr');
    } catch (err) {
      setError(err.message);
      setStep('idle');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!enrollData || verifyCode.length !== 6) return;

    setStep('verifying');
    setError(null);
    try {
      await verifyMFA(enrollData.id, verifyCode);
      setStep('success');
      setVerifyCode('');
      setEnrollData(null);
      // Notify parent after brief success display
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);
    } catch (err) {
      setError(err.message || t('mfa.invalidCode', 'Invalid code. Please try again.'));
      setStep('qr');
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
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
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
    if (onCancel) onCancel();
  };

  // Success state
  if (step === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 space-y-4"
      >
        <ShieldCheck className="w-16 h-16 text-green-400" />
        <h3 className="text-xl font-bold text-white">
          {t('mfa.success', 'Two-factor authentication enabled!')}
        </h3>
        <p className="text-gray-400 text-sm text-center">
          {t('mfa.successDesc', 'Your account is now protected with TOTP-based two-factor authentication.')}
        </p>
      </motion.div>
    );
  }

  // Idle state - start button
  if (step === 'idle' || step === 'loading') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-orange-400" />
          <div>
            <h3 className="text-base font-semibold text-white">
              {t('mfa.setup', 'Set up two-factor authentication')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('mfa.setupDesc', 'Use an authenticator app like Google Authenticator or Authy to generate verification codes.')}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleStartEnroll}
          disabled={step === 'loading'}
          className="bg-orange-500 hover:bg-orange-600 text-white"
          aria-label={t('mfa.enable', 'Enable MFA')}
        >
          {step === 'loading' ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('mfa.enrolling', 'Setting up...')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>{t('mfa.enable', 'Enable MFA')}</span>
            </div>
          )}
        </Button>
      </div>
    );
  }

  // QR code & verification step
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-[#0f1528]/80 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-[#e8eaf0]">
            {t('mfa.scanQR', 'Scan this QR code with your authenticator app')}
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label={t('common.cancel', 'Cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code */}
        {enrollData?.totp?.qr_code && (
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <img
                src={enrollData.totp.qr_code}
                alt={t('mfa.qrCodeAlt', 'MFA QR Code - scan with authenticator app')}
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        {/* Secret Key */}
        {enrollData?.totp?.secret && (
          <div className="mb-6">
            <Label className="block text-sm text-gray-400 mb-2">
              {t('mfa.secretKey', 'Or enter this secret key manually:')}
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-[#0a0e1a] border border-gray-700 rounded-lg text-orange-400 font-mono text-sm break-all">
                {enrollData.totp.secret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySecret}
                className="border-gray-700 text-gray-300 hover:bg-gray-700 shrink-0"
                aria-label={t('mfa.copySecret', 'Copy secret key')}
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2 overflow-hidden"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification Code Input */}
        <form onSubmit={handleVerify}>
          <Label htmlFor="mfa-setup-code" className="block text-sm text-gray-400 mb-2">
            {t('mfa.enterCode', 'Enter the 6-digit code from your authenticator app:')}
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="mfa-setup-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="flex-1 bg-[#0a0e1a] border-gray-700 text-[#e8eaf0] text-center text-lg font-mono tracking-widest focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              autoFocus
              autoComplete="one-time-code"
              aria-label={t('mfa.codeInput', 'TOTP verification code')}
              disabled={step === 'verifying'}
            />
            <Button
              type="submit"
              disabled={verifyCode.length !== 6 || step === 'verifying'}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {step === 'verifying' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span className="ml-2">
                {t('mfa.confirm', 'Confirm')}
              </span>
            </Button>
          </div>
        </form>

        {/* Cancel */}
        <button
          type="button"
          onClick={handleCancel}
          className="mt-4 text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
    </motion.div>
  );
};

export default MFASetup;
