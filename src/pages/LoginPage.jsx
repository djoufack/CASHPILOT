import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Sparkles, Copy, ArrowUpRight } from 'lucide-react';
import { validateEmail } from '@/utils/validation';
import { useToast } from '@/components/ui/use-toast';
import MFAVerifyStep from '@/components/MFAVerifyStep';
import { supabase } from '@/lib/supabase';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { sanitizeText } from '@/utils/sanitize';

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signIn, verifyMFA } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState(null);

  const demoAccounts = [
    {
      region: 'FR',
      flag: '\u{1F1EB}\u{1F1F7}',
      email: 'pilotage.fr.demo@cashpilot.cloud',
      password: 'PilotageFR#2026!',
      labelKey: 'auth.demoRegionFR',
      tagKey: 'auth.demoTagFR',
    },
    {
      region: 'BE',
      flag: '\u{1F1E7}\u{1F1EA}',
      email: 'pilotage.be.demo@cashpilot.cloud',
      password: 'PilotageBE#2026!',
      labelKey: 'auth.demoRegionBE',
      tagKey: 'auth.demoTagBE',
    },
    {
      region: 'OHADA',
      flag: '\u{1F30D}',
      email: 'pilotage.ohada.demo@cashpilot.cloud',
      password: 'PilotageOHADA#2026!',
      labelKey: 'auth.demoRegionOHADA',
      tagKey: 'auth.demoTagOHADA',
    },
  ];

  const handleDemoLogin = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
  };

  const copyDemoCredentials = async (account) => {
    const payload = `${account.email} / ${account.password}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      }
      toast({
        title: t('auth.demoCredentialsCopied', 'Identifiants démo copiés'),
        description: account.email,
        className: 'bg-green-500 border-none text-white'
      });
    } catch (_error) {
      toast({
        title: t('auth.copyFailed', 'Copie impossible'),
        description: t('auth.copyManualHint', 'Copiez manuellement les identifiants affichés.'),
        variant: 'destructive',
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const normalizedEmail = sanitizeText(email).trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) newErrors.email = t('validation.invalidEmail') || 'Invalid email address';
    if (!password) newErrors.password = t('auth.passwordRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const normalizedEmail = sanitizeText(email).trim().toLowerCase();
      await signIn(normalizedEmail, password);

      // Check if user has MFA enabled
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = (factorsData?.totp || []).filter((f) => f.status === 'verified');

      if (totpFactors.length > 0) {
        // MFA required - show verification step
        setMfaRequired(true);
        setMfaFactorId(totpFactors[0].id);
        setLoading(false);
        return;
      }

      // No MFA - proceed normally
      setSuccess(true);
      toast({
        title: t('mfa.loginSuccess', 'Login successful'),
        description: t('mfa.redirecting', 'Redirecting to dashboard...'),
        className: 'bg-green-500 border-none text-white'
      });

      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (error) {
      let errorMessage = error.message;

      if (error.code === 'AUTH_RATE_LIMITED') {
        errorMessage = `Too many attempts. Try again in ${error.retryAfterSeconds || 60} seconds.`;
      } else if (error.message.includes('Invalid login credentials') || error.message.includes('AuthApiError')) {
        errorMessage = t('mfa.invalidCredentials', 'Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = t('mfa.emailNotConfirmed', 'Please confirm your email before signing in.');
      } else if (error.message.includes('Network request failed')) {
        errorMessage = t('mfa.networkError', 'Network error. Check your internet connection.');
      } else {
        errorMessage = t('mfa.unexpectedError', 'An unexpected error occurred. Please try again.');
      }

      setErrors({ form: errorMessage });
      setLoading(false);
    }
  };

  const handleMFAVerify = async (code) => {
    setLoading(true);
    try {
      await verifyMFA(mfaFactorId, code);

      setSuccess(true);
      toast({
        title: t('mfa.loginSuccess', 'Login successful'),
        description: t('mfa.redirecting', 'Redirecting to dashboard...'),
        className: 'bg-green-500 border-none text-white'
      });

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const handleMFACancel = async () => {
    setMfaRequired(false);
    setMfaFactorId(null);
    // Sign out since we passed password but didn't complete MFA
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-[100dvh] min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto">
      <Helmet><title>{t('pages.login', 'Login')} | CashPilot</title></Helmet>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/20 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md space-y-6"
      >
        <div className="flex justify-end">
          <LanguageSwitcher variant="segmented" />
        </div>

        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-1">
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-yellow-500 via-amber-400 to-lime-500 opacity-50 pointer-events-none" />

          <div className="bg-gray-950/90 rounded-xl p-8 relative z-10 h-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gradient mb-2 tracking-tight">
                {t('app.name')}
              </h1>
              <p className="text-gray-400 text-sm">{t('auth.welcomeBack')}</p>
            </div>

            <div className="flex mb-8 relative bg-gray-900/50 rounded-lg p-1">
              <button className="flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 text-white">
                {t('auth.signIn')}
                <div className="absolute inset-0 bg-gray-800 rounded-md -z-10 shadow-sm" />
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 text-gray-400 hover:text-gray-200"
              >
                {t('auth.signUp')}
              </button>
            </div>

            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-8 space-y-4"
              >
                <CheckCircle2 className="w-16 h-16 text-green-500 animate-pulse" />
                <h3 className="text-xl font-bold text-white">{t('mfa.loginSuccess', 'Login successful')}</h3>
                <p className="text-gray-400 text-sm">{t('mfa.redirecting')}</p>
              </motion.div>
            ) : mfaRequired ? (
              <MFAVerifyStep
                onVerify={handleMFAVerify}
                onCancel={handleMFACancel}
                isLoading={loading}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence>
                  {errors.form && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-start gap-2 overflow-hidden"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{errors.form}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-900/50 border-gray-700 text-white focus:border-orange-500"
                    placeholder="name@company.com"
                    disabled={loading}
                  />
                  {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-gray-300">{t('auth.password')}</Label>
                    <Link to="/forgot-password" className="text-xs text-orange-400 hover:text-orange-300">
                      {t('auth.forgotPassword') || 'Mot de passe oublié?'}
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-gray-900/50 border-gray-700 text-white pr-10 focus:border-orange-500"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 mt-6"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('auth.loggingIn')}</span>
                    </div>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-1"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            <span className="text-xs text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {t('auth.demoTitle')}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
          </div>

          <p className="text-center text-[11px] text-gray-400 mb-4">
            {t('auth.demoSubtitle')}
          </p>

          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:#4b5563_transparent] snap-x snap-mandatory">
            {demoAccounts.map((account) => (
              <button
                key={account.region}
                type="button"
                onClick={() => handleDemoLogin(account)}
                className="group relative min-w-[176px] flex-1 snap-start rounded-2xl p-[1px] bg-gradient-to-br from-amber-400/70 via-orange-300/40 to-sky-500/70 hover:from-amber-300 hover:via-orange-300 hover:to-sky-400 transition-all duration-300"
              >
                <div className="relative rounded-[15px] bg-[#060a12] hover:bg-[#0a111d] px-3 py-3.5 h-full transition-colors duration-300 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 w-9 h-9 text-lg leading-none shadow-inner">
                      {account.flag}
                    </div>
                    <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-amber-200/90">
                      {t(account.tagKey)}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <p className="text-xs font-semibold text-white group-hover:text-amber-100 transition-colors">
                      {t(account.labelKey)}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400 truncate">{account.email}</p>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-slate-600/60 bg-slate-800/40 px-2 py-1 text-[10px] font-medium text-slate-200 group-hover:border-amber-300/40 group-hover:bg-amber-300/10 group-hover:text-amber-100 transition-colors">
                    {t('auth.demoQuickFill', 'Pré-remplir')}
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {demoAccounts.map((account) => (
              <div key={`credentials-${account.region}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-800/70 bg-gray-950/70 px-2.5 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-amber-300/80">
                    {t(account.labelKey)} · {t(account.tagKey)}
                  </div>
                  <div className="text-[11px] font-mono text-gray-300 truncate">
                    {account.email} / {account.password}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyDemoCredentials(account)}
                  className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-gray-900/70 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  aria-label={`Copier les identifiants ${account.region}`}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-gray-400 text-center">
            Connectez-vous puis ouvrez <span className="font-mono text-gray-300">/app/pilotage</span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
