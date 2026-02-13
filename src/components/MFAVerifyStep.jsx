import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * MFAVerifyStep - Login-flow MFA verification component
 * Displayed during login when a user has an active TOTP factor.
 *
 * @param {Function} onVerify - Async function receiving the 6-digit TOTP code
 * @param {Function} onCancel - Called when user cancels the MFA step
 * @param {boolean} isLoading - External loading state
 */
const MFAVerifyStep = ({ onVerify, onCancel, isLoading = false }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const { t } = useTranslation();
  const inputRef = useRef(null);

  // TOTP validity countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 30 - (now % 30);
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) {
      setError(t('mfa.codeLengthError', 'The code must be exactly 6 digits'));
      return;
    }
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.message || t('mfa.invalidCode', 'Invalid code. Please try again.'));
    }
  };

  const handleCodeChange = (e) => {
    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  const countdownProgress = (countdown / 30) * 100;
  const countdownColor = countdown <= 5 ? 'bg-red-500' : countdown <= 10 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <Shield className="w-12 h-12 text-orange-500 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-lg font-bold text-white">
          {t('mfa.verify', 'MFA Verification')}
        </h3>
        <p className="text-gray-400 text-sm mt-1">
          {t('mfa.verifyDesc', 'Enter the code from your authenticator app')}
        </p>
      </div>

      {/* TOTP Timer */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{t('mfa.codeValidity', 'Code validity')}</span>
          <span className={countdown <= 5 ? 'text-red-400 font-medium' : ''}>
            {countdown}s
          </span>
        </div>
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${countdownColor} rounded-full`}
            initial={false}
            animate={{ width: `${countdownProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" role="form" aria-label={t('mfa.verifyFormLabel', 'MFA verification form')}>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-start gap-2 overflow-hidden"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <Label htmlFor="mfa-code" className="text-gray-300">
            {t('mfa.sixDigitCode', '6-digit code')}
          </Label>
          <Input
            ref={inputRef}
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={handleCodeChange}
            className="bg-gray-900/50 border-gray-700 text-white text-center text-2xl tracking-[0.5em] focus:border-orange-500"
            placeholder="000000"
            autoComplete="one-time-code"
            disabled={isLoading}
            aria-label={t('mfa.codeInput', 'TOTP verification code')}
            aria-describedby="mfa-code-help"
          />
          <p id="mfa-code-help" className="text-xs text-gray-500">
            {t('mfa.codeHelp', 'Open your authenticator app and enter the current 6-digit code.')}
          </p>
        </div>

        <Button
          type="submit"
          disabled={isLoading || code.length !== 6}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2"
          aria-label={t('mfa.verifyButton', 'Verify code')}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span>{t('mfa.verifying', 'Verifying...')}</span>
            </div>
          ) : (
            t('mfa.verifyButton', 'Verify')
          )}
        </Button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-gray-400 hover:text-gray-200 text-sm py-2 transition-colors"
            aria-label={t('common.cancel', 'Cancel')}
          >
            {t('common.cancel', 'Cancel')}
          </button>
        )}
      </form>
    </motion.div>
  );
};

export default MFAVerifyStep;
