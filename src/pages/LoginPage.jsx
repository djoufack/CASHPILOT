import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Copy,
  ArrowUpRight,
  ChevronLeft,
  TrendingUp,
  ShieldCheck,
  Globe2,
  Building2,
} from 'lucide-react';
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

  const marketingHighlights = [
    {
      title: t('auth.campaignHighlightRealtime', 'Pilotage en temps reel'),
      subtitle: t('auth.campaignHighlightRealtimeDesc', 'Vision cash, ventes, depenses, KPI en direct'),
      icon: TrendingUp,
    },
    {
      title: t('auth.campaignHighlightCompliance', 'Conformite & securite'),
      subtitle: t('auth.campaignHighlightComplianceDesc', 'RGPD, audit trail, gouvernance administrateur'),
      icon: ShieldCheck,
    },
    {
      title: t('auth.campaignHighlightGlobal', 'Multi-pays & multi-activites'),
      subtitle: t('auth.campaignHighlightGlobalDesc', 'Belgique, FR, OHADA, equipe distribuee'),
      icon: Globe2,
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
        className: 'bg-green-500 border-none text-white',
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
        className: 'bg-green-500 border-none text-white',
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
        className: 'bg-green-500 border-none text-white',
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
    <div className="relative min-h-[100dvh] min-h-screen overflow-x-hidden overflow-y-auto bg-[#020712] px-3 py-4 sm:px-6 sm:py-8">
      <Helmet>
        <title>{t('pages.login', 'Login')} | CashPilot</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-[-10%] h-[35rem] w-[35rem] rounded-full bg-[#ff6a00]/18 blur-[130px]" />
        <div className="absolute bottom-[-9rem] right-[-10%] h-[32rem] w-[32rem] rounded-full bg-[#00d1ff]/16 blur-[130px]" />
        <motion.div
          animate={{ x: [0, 14, 0], y: [0, -8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[24%] left-[43%] h-28 w-28 rounded-full border border-cyan-300/25"
        />
        <motion.div
          animate={{ x: [0, -18, 0], y: [0, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[58%] left-[8%] h-16 w-16 rounded-full border border-amber-300/25"
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1380px] grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:gap-7">
        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative overflow-hidden rounded-[2rem] border border-slate-700/40 bg-gradient-to-br from-slate-950/95 via-[#071228]/95 to-[#1a0f07]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:p-8 lg:p-10"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full border border-cyan-400/25" />
          <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full border border-amber-300/20" />

          <div className="relative z-10 space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
              <Sparkles className="h-3.5 w-3.5" />
              Campaign Login Experience
            </span>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[3rem] lg:leading-[1.03]">
                CashPilot transforme la connexion en experience premium.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-[15px]">
                Suivi financier intelligent, execution rapide, gouvernance totale: votre cockpit se lance des
                l&apos;authentification. Une signature produit pensee pour la performance, concue par DMG MANAGEMENT
                BELGIUM.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {marketingHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    whileHover={{ y: -4 }}
                    className="rounded-2xl border border-slate-700/65 bg-slate-950/55 p-4"
                  >
                    <Icon className="h-5 w-5 text-amber-300" />
                    <h3 className="mt-3 text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.subtitle}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/45 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
              >
                <ChevronLeft className="h-4 w-4" />
                Retour landing CashPilot
              </Link>
              <a
                href="https://www.dmgmanagement.tech"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20"
              >
                <Building2 className="h-4 w-4" />
                DMG MANAGEMENT BELGIUM
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="relative w-full space-y-4"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <div className="flex items-center justify-between rounded-2xl border border-slate-700/50 bg-slate-950/80 px-4 py-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('auth.backToLanding', 'Retour a la landing')}
            </Link>
            <LanguageSwitcher variant="segmented" />
          </div>

          <div className="relative rounded-3xl bg-[#060b21]/85 p-1 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-[#0c1f4f]/85 via-[#1d2f6f]/80 to-[#4b1f74]/80 p-[1px] opacity-80" />

            <div className="relative z-10 rounded-[22px] bg-gradient-to-br from-[#07112d]/96 via-[#101e49]/95 to-[#2f1858]/94 p-6 sm:p-8">
              <div className="mb-7 text-center">
                <h2 className="mb-2 text-4xl font-bold tracking-tight text-white">{t('app.name')}</h2>
                <p className="text-sm text-gray-400">{t('auth.welcomeBack')}</p>
              </div>

              <div className="relative mb-8 flex rounded-lg bg-gray-900/50 p-1">
                <button className="relative z-10 flex-1 rounded-md py-2 text-sm font-medium text-white transition-colors">
                  {t('auth.signIn')}
                  <div className="absolute inset-0 -z-10 rounded-md bg-gray-800 shadow-sm" />
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="relative z-10 flex-1 rounded-md py-2 text-sm font-medium text-gray-400 transition-colors hover:text-gray-200"
                >
                  {t('auth.signUp')}
                </button>
              </div>

              {success ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center space-y-4 py-8"
                >
                  <CheckCircle2 className="h-16 w-16 animate-pulse text-green-500" />
                  <h3 className="text-xl font-bold text-white">{t('mfa.loginSuccess', 'Login successful')}</h3>
                  <p className="text-sm text-gray-400">{t('mfa.redirecting')}</p>
                </motion.div>
              ) : mfaRequired ? (
                <MFAVerifyStep onVerify={handleMFAVerify} onCancel={handleMFACancel} isLoading={loading} />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <AnimatePresence>
                    {errors.form && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="flex items-start gap-2 overflow-hidden rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                      >
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{errors.form}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-gray-700 bg-gray-900/50 text-white focus:border-orange-500"
                      placeholder="name@company.com"
                      disabled={loading}
                    />
                    {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-gray-300">
                        {t('auth.password')}
                      </Label>
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
                        className="border-gray-700 bg-gray-900/50 pr-10 text-white focus:border-orange-500"
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
                    className="mt-6 w-full bg-orange-500 py-2 font-bold text-white hover:bg-orange-600"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
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
            transition={{ delay: 0.22 }}
            className="rounded-2xl border border-slate-700/55 bg-[#030914]/90 p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-gray-300">
                <Sparkles className="h-3 w-3 text-amber-400" />
                {t('auth.demoTitle', 'Essayer sans inscription')}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
            </div>

            <p className="mb-4 text-center text-[11px] text-gray-400">
              {t('auth.demoSubtitle', 'Cliquez sur un compte pour vous connecter instantanement')}
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.region}
                  type="button"
                  onClick={() => handleDemoLogin(account)}
                  className="group relative w-full rounded-2xl bg-gradient-to-br from-amber-400/70 via-orange-300/40 to-sky-500/70 p-[1px] transition-all duration-300 hover:from-amber-300 hover:via-orange-300 hover:to-sky-400"
                >
                  <div className="relative h-full rounded-[15px] bg-[#060a12] px-3 py-3.5 text-left transition-colors duration-300 hover:bg-[#0a111d]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg leading-none shadow-inner">
                        {account.flag}
                      </div>
                      <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-200/90">
                        {t(account.tagKey)}
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <p className="text-xs font-semibold text-white transition-colors group-hover:text-amber-100">
                        {t(account.labelKey)}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-gray-400">{account.email}</p>
                    </div>

                    <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-slate-600/60 bg-slate-800/40 px-2 py-1 text-[10px] font-medium text-slate-200 transition-colors group-hover:border-amber-300/40 group-hover:bg-amber-300/10 group-hover:text-amber-100">
                      {t('auth.demoQuickFill', 'Pré-remplir')}
                      <ArrowUpRight className="h-3 w-3" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {demoAccounts.map((account) => (
                <div
                  key={`credentials-${account.region}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-800/70 bg-gray-950/70 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-amber-300/80">
                      {t(account.labelKey)} · {t(account.tagKey)}
                    </div>
                    <div className="truncate font-mono text-[11px] text-gray-300">
                      {account.email} / {account.password}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyDemoCredentials(account)}
                    className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-gray-900/70 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                    aria-label={`Copier les identifiants ${account.region}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-3 text-center text-[11px] text-gray-400">
              Connectez-vous puis ouvrez <span className="font-mono text-gray-300">/app/pilotage</span>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
