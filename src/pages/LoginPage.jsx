import { lazy, Suspense, useState } from 'react';
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

const Login3DBackground = lazy(() => import('@/components/Login3DBackground'));

/* ── Animation variants (DMG design system) ── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

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
  const [demoLoadingRegion, setDemoLoadingRegion] = useState(null);

  /* ── Demo accounts (server-side access) ── */
  const demoAccounts = [
    {
      region: 'FR',
      flag: '\u{1F1EB}\u{1F1F7}',
      email: 'pilotage.fr.demo@cashpilot.cloud',
      labelKey: 'auth.demoRegionFR',
      tagKey: 'auth.demoTagFR',
    },
    {
      region: 'BE',
      flag: '\u{1F1E7}\u{1F1EA}',
      email: 'pilotage.be.demo@cashpilot.cloud',
      labelKey: 'auth.demoRegionBE',
      tagKey: 'auth.demoTagBE',
    },
    {
      region: 'OHADA',
      flag: '\u{1F30D}',
      email: 'pilotage.ohada.demo@cashpilot.cloud',
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

  /* ── Auth handlers (100% preserved) ── */
  const handleDemoLogin = async (account) => {
    setErrors({});
    setDemoLoadingRegion(account.region);
    try {
      const { data, error } = await supabase.functions.invoke('demo-login-access', {
        body: { region: account.region },
      });

      if (error) {
        const payload = error.context?.json ? await error.context.json().catch(() => null) : null;
        const serverMessage = String(payload?.error || error.message || '');
        throw new Error(serverMessage || 'Unable to launch demo access.');
      }

      const redirectUrl = String(data?.redirectUrl || '').trim();
      if (!redirectUrl) {
        throw new Error('Unable to launch demo access.');
      }

      window.location.assign(redirectUrl);
    } catch (demoError) {
      const message = String(demoError?.message || '').toLowerCase();
      let description = t('auth.demoAccessFailed', 'Impossible de lancer la session demo. Reessayez dans un instant.');

      if (message.includes('temporarily disabled')) {
        description = t(
          'auth.demoAccessDisabled',
          'Le mode demo est temporairement desactive. Merci de reessayer plus tard.'
        );
      } else if (message.includes('too many demo access attempts') || message.includes('rate')) {
        description = t(
          'auth.demoAccessRateLimited',
          'Trop de tentatives demo detectees. Merci de patienter quelques minutes.'
        );
      }

      toast({
        title: t('auth.demoAccessErrorTitle', 'Acces demo indisponible'),
        description,
        variant: 'destructive',
      });
      setErrors({ form: description });
    } finally {
      setDemoLoadingRegion(null);
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

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = (factorsData?.totp || []).filter((f) => f.status === 'verified');

      if (totpFactors.length > 0) {
        setMfaRequired(true);
        setMfaFactorId(totpFactors[0].id);
        setLoading(false);
        return;
      }

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
    await supabase.auth.signOut();
  };

  /* ── Render ── */
  return (
    <div
      className="relative min-h-[100dvh] min-h-screen overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-6 sm:py-8"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(123,97,255,0.13) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 80% 110%, rgba(255,214,125,0.08) 0%, transparent 55%), #06070e',
        fontFamily: "'Space Grotesk', 'Avenir Next', 'Trebuchet MS', sans-serif",
      }}
    >
      <Helmet>
        <title>{t('pages.login', 'Login')} | CashPilot</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      {/* ── 3D Constellation Background ── */}
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(123,97,255,0.18) 0%, rgba(10,10,30,0.95) 70%)',
            }}
          />
        }
      >
        <Login3DBackground />
      </Suspense>

      {/* ── Floating Orbs (DMG signature) ── */}
      <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden="true">
        <div
          className="absolute -top-28 left-[-12%] h-[30rem] w-[30rem] rounded-full opacity-60 blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(123,97,255,0.35) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-20 right-[-8%] h-[26rem] w-[26rem] rounded-full opacity-50 blur-[110px]"
          style={{ background: 'radial-gradient(circle, rgba(255,218,120,0.3) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[40%] left-[55%] h-[18rem] w-[18rem] rounded-full opacity-30 blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(126,154,255,0.24) 0%, transparent 70%)' }}
        />
      </div>

      {/* ── Main Content (z-[2] to sit above 3D + orbs) ── */}
      <div className="relative z-[2] mx-auto grid w-full max-w-[1380px] grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:gap-7">
        {/* ═══ LEFT: Marketing Campaign Panel ═══ */}
        <motion.section
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative overflow-hidden rounded-[2rem] border border-violet-200/10 p-6 shadow-[0_30px_100px_rgba(3,6,15,0.5)] sm:p-8 lg:p-10"
          style={{
            background: 'linear-gradient(165deg, rgba(11,16,35,0.82), rgba(9,13,28,0.9))',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full border border-violet-300/15" />
          <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full border border-amber-300/10" />

          <div className="relative z-10 space-y-7">
            {/* Badge */}
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200/14 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-violet-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Campaign Login Experience
            </motion.span>

            {/* Heading */}
            <motion.div variants={fadeUp} className="space-y-3">
              <h1
                className="text-3xl font-bold leading-tight sm:text-4xl lg:text-[3rem] lg:leading-[1.05]"
                style={{
                  background: 'linear-gradient(125deg, #ffd67d 0%, #d3a4ff 52%, #8f7eff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                CashPilot transforme la connexion en experience premium.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-[#9aa7cc] sm:text-[15px]">
                Suivi financier intelligent, execution rapide, gouvernance totale: votre cockpit se lance des
                l&apos;authentification. Une signature produit pensee pour la performance, concue par DMG MANAGEMENT
                BELGIUM.
              </p>
            </motion.div>

            {/* Feature cards */}
            <motion.div variants={stagger} className="grid gap-3 sm:grid-cols-3">
              {marketingHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    variants={fadeUp}
                    whileHover={{ y: -4, borderColor: 'rgba(123,97,255,0.25)' }}
                    className="group rounded-2xl border border-violet-200/10 p-4 transition-all duration-300"
                    style={{ background: 'linear-gradient(165deg, rgba(11,16,35,0.75), rgba(9,13,28,0.88))' }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200/16 bg-violet-500/12 text-violet-200 transition-colors group-hover:bg-violet-500/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#9aa7cc]">{item.subtitle}</p>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Navigation links */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-500/18 hover:shadow-[0_8px_20px_rgba(123,97,255,0.2)]"
              >
                <ChevronLeft className="h-4 w-4" />
                Retour landing CashPilot
              </Link>
              <a
                href="https://www.dmgmanagement.tech"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/8 px-4 py-2 text-sm font-semibold text-amber-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-400/15 hover:shadow-[0_8px_20px_rgba(255,214,125,0.15)]"
              >
                <Building2 className="h-4 w-4" />
                DMG MANAGEMENT BELGIUM
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </motion.div>
          </div>
        </motion.section>

        {/* ═══ RIGHT: Auth Form Column ═══ */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative w-full space-y-4"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {/* Top bar */}
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-between rounded-2xl border border-violet-200/10 px-4 py-3"
            style={{
              background: 'linear-gradient(165deg, rgba(11,16,35,0.7), rgba(9,13,28,0.85))',
              backdropFilter: 'blur(16px)',
            }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#9aa7cc] transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('auth.backToLanding', 'Retour a la landing')}
            </Link>
            <LanguageSwitcher variant="segmented" />
          </motion.div>

          {/* ── Auth Card (glassmorphism) ── */}
          <motion.div
            variants={scaleIn}
            className="relative rounded-[1.6rem] p-[1px] shadow-[0_30px_80px_rgba(3,6,15,0.6)]"
          >
            {/* Gradient border */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[1.6rem] opacity-70"
              style={{
                background:
                  'linear-gradient(135deg, rgba(123,97,255,0.25), rgba(159,118,255,0.12) 50%, rgba(255,202,114,0.18))',
              }}
            />

            <div
              className="relative z-10 rounded-[calc(1.6rem-1px)] p-6 sm:p-8"
              style={{
                background: 'linear-gradient(165deg, rgba(11,16,35,0.92), rgba(13,17,34,0.96))',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Logo + Title */}
              <div className="mb-7 text-center">
                <h2
                  className="mb-2 text-4xl font-bold tracking-tight"
                  style={{
                    background: 'linear-gradient(125deg, #ffd67d 0%, #d3a4ff 52%, #8f7eff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {t('app.name')}
                </h2>
                <p className="text-sm text-[#9aa7cc]">{t('auth.welcomeBack')}</p>
              </div>

              {/* Sign In / Sign Up tabs */}
              <div className="relative mb-8 flex rounded-xl bg-violet-500/8 p-1">
                <button className="relative z-10 flex-1 rounded-lg py-2 text-sm font-medium text-white transition-colors">
                  {t('auth.signIn')}
                  <div className="absolute inset-0 -z-10 rounded-lg bg-violet-500/20 shadow-[0_2px_12px_rgba(123,97,255,0.2)]" />
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="relative z-10 flex-1 rounded-lg py-2 text-sm font-medium text-[#9aa7cc] transition-colors hover:text-white"
                >
                  {t('auth.signUp')}
                </button>
              </div>

              {/* ── Form / MFA / Success (auth logic 100% preserved) ── */}
              {success ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center space-y-4 py-8"
                >
                  <CheckCircle2 className="h-16 w-16 animate-pulse text-green-500" />
                  <h3 className="text-xl font-bold text-white">{t('mfa.loginSuccess', 'Login successful')}</h3>
                  <p className="text-sm text-[#9aa7cc]">{t('mfa.redirecting')}</p>
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
                        className="flex items-start gap-2 overflow-hidden rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                      >
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{errors.form}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs uppercase tracking-wider text-[#9aa7cc]">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-xl border-violet-200/14 bg-black/20 text-white placeholder:text-[#5a6488] focus:border-violet-400/40 focus:ring-violet-400/20"
                      placeholder="name@company.com"
                      disabled={loading}
                    />
                    {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs uppercase tracking-wider text-[#9aa7cc]">
                        {t('auth.password')}
                      </Label>
                      <Link to="/forgot-password" className="text-xs text-violet-300 hover:text-violet-200">
                        {t('auth.forgotPassword') || 'Mot de passe oublié?'}
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-xl border-violet-200/14 bg-black/20 pr-10 text-white placeholder:text-[#5a6488] focus:border-violet-400/40 focus:ring-violet-400/20"
                        placeholder="••••••••"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6488] hover:text-white"
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
                    className="mt-6 h-12 w-full rounded-xl border border-violet-200/20 font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(92,66,214,0.48)]"
                    style={{ background: 'linear-gradient(120deg, #7564ff, #9f76ff 50%, #ffca72)' }}
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
          </motion.div>

          {/* ═══ Demo Accounts Section (100% preserved functionality) ═══ */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="rounded-2xl border border-violet-200/10 p-4 sm:p-5"
            style={{
              background: 'linear-gradient(165deg, rgba(11,16,35,0.7), rgba(9,13,28,0.85))',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Divider label */}
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[#9aa7cc]">
                <Sparkles className="h-3 w-3 text-amber-300" />
                {t('auth.demoTitle', 'Essayer sans inscription')}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
            </div>

            <p className="mb-4 text-center text-[11px] text-[#7a88ac]">
              {t('auth.demoSubtitle', 'Cliquez sur un compte pour vous connecter instantanement')}
            </p>

            {/* Demo account cards */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.region}
                  type="button"
                  onClick={() => handleDemoLogin(account)}
                  disabled={loading || Boolean(demoLoadingRegion)}
                  className="group relative w-full rounded-2xl p-[1px] transition-all duration-300"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(123,97,255,0.4), rgba(159,118,255,0.2) 50%, rgba(255,202,114,0.35))',
                  }}
                >
                  <div
                    className="relative h-full rounded-[15px] px-3 py-3.5 text-left transition-all duration-300 group-hover:shadow-[0_8px_24px_rgba(123,97,255,0.15)]"
                    style={{ background: 'linear-gradient(165deg, rgba(11,16,35,0.95), rgba(9,13,28,0.98))' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-200/15 bg-violet-500/8 text-lg leading-none shadow-inner">
                        {account.flag}
                      </div>
                      <span className="inline-flex items-center rounded-full border border-violet-200/14 bg-violet-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-violet-200/90">
                        {t(account.tagKey)}
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <p className="text-xs font-semibold text-white transition-colors group-hover:text-violet-100">
                        {t(account.labelKey)}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-[#7a88ac]">{account.email}</p>
                    </div>

                    <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-violet-200/14 bg-violet-500/8 px-2 py-1 text-[10px] font-medium text-violet-200 transition-all group-hover:border-violet-300/25 group-hover:bg-violet-500/15 group-hover:text-white">
                      {demoLoadingRegion === account.region ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('auth.demoLaunchingAccess', 'Connexion...')}
                        </>
                      ) : (
                        <>
                          {t('auth.demoInstantAccess', 'Acces instantane')}
                          <ArrowUpRight className="h-3 w-3" />
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-3 text-center text-[11px] text-[#7a88ac]">
              {t(
                'auth.demoAccessHint',
                'Connexion securee via lien unique, sans mot de passe expose dans le frontend.'
              )}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
