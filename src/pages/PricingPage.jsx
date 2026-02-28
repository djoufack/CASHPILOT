import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useCredits } from '@/hooks/useCredits';
import { createCheckoutSession, redirectToCheckout as redirectToCreditCheckout, formatPrice } from '@/services/stripeService';
import { useToast } from '@/components/ui/use-toast';
import {
  Coins, Zap, Star, TrendingUp, Crown,
  Check, X, ArrowRight, Wallet, Sparkles,
  CreditCard, ChevronDown, Shield, Lock,
  RotateCcw, HelpCircle
} from 'lucide-react';
import { CREDIT_COSTS, CREDIT_CATEGORIES, CREDIT_COST_LABELS } from '@/hooks/useCreditsGuard';

const PLAN_ICONS = {
  free: Coins,
  starter: Zap,
  pro: Star,
  business: TrendingUp,
  enterprise: Crown,
};

const PLAN_COLORS = {
  free: { text: 'text-gray-400', bg: 'bg-gray-400', border: 'border-gray-600', glow: '' },
  starter: { text: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-500/50', glow: '' },
  pro: { text: 'text-orange-400', bg: 'bg-orange-400', border: 'border-orange-500/60', glow: 'shadow-lg shadow-orange-500/10' },
  business: { text: 'text-purple-400', bg: 'bg-purple-400', border: 'border-purple-500/50', glow: '' },
  enterprise: { text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-500/50', glow: '' },
};

const PLAN_TARGETS = {
  free: 'pricing.target.free',
  starter: 'pricing.target.starter',
  pro: 'pricing.target.pro',
  business: 'pricing.target.business',
  enterprise: 'pricing.target.enterprise',
};

const PricingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { plans, currentPlan, subscriptionStatus, subscribing, subscribe } = useSubscription();
  const { packages, credits, availableCredits } = useCredits();
  const { toast } = useToast();
  const [purchasing, setPurchasing] = useState(null);
  const [showCreditCosts, setShowCreditCosts] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'annual'
  const [openFaq, setOpenFaq] = useState(null);

  // Handle return from Stripe
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast({
        title: t('pricing.success'),
        description: t('pricing.subscriptionActivated'),
      });
    } else if (status === 'cancelled') {
      toast({
        title: t('pricing.cancelled'),
        description: t('pricing.checkoutCancelled'),
        variant: 'destructive',
      });
    }
  }, [searchParams, toast, t]);

  const handleSubscribe = (planSlug) => {
    if (!user) {
      navigate(`/signup?redirect=/pricing&plan=${planSlug}`);
      return;
    }
    if (planSlug === 'free') return;
    if (planSlug === 'enterprise') {
      window.location.href = 'mailto:contact@cashpilot.tech?subject=Enterprise Plan';
      return;
    }
    subscribe(planSlug);
  };

  const handleBuyCredits = async (pkg) => {
    if (!user) {
      navigate('/signup?redirect=/pricing');
      return;
    }
    setPurchasing(pkg.id);
    try {
      const session = await createCheckoutSession({
        priceId: pkg.stripe_price_id,
        credits: pkg.credits,
        userId: user.id,
        customerEmail: user.email,
        successUrl: `${window.location.origin}/pricing?status=success`,
        cancelUrl: `${window.location.origin}/pricing?status=cancelled`,
      });
      if (session.url) {
        redirectToCreditCheckout(session.url);
      }
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setPurchasing(null);
    }
  };

  const isCurrentPlan = (slug) => {
    if (!currentPlan) return slug === 'free';
    return currentPlan.slug === slug && subscriptionStatus === 'active';
  };

  const formatPlanPrice = (priceCents) => {
    if (priceCents === 0) return t('pricing.free');
    if (billingPeriod === 'annual') {
      // Annual = 10 months of monthly price
      const annualMonthly = (priceCents * 10) / 12;
      return `${(annualMonthly / 100).toFixed(2)} €`;
    }
    return `${(priceCents / 100).toFixed(2)} €`;
  };

  const getAnnualTotal = (priceCents) => {
    if (priceCents === 0) return null;
    return `${((priceCents * 10) / 100).toFixed(2)} €/${t('pricing.year')}`;
  };

  const getCostPerCredit = (priceCents, creditsPerMonth) => {
    if (priceCents === 0 || creditsPerMonth === 0) return null;
    const effective = billingPeriod === 'annual' ? (priceCents * 10) / 12 : priceCents;
    return ((effective / creditsPerMonth) / 100).toFixed(3);
  };

  const PACKAGE_ICONS = [Coins, Zap, Star, TrendingUp];

  const FAQ_ITEMS = [
    { q: 'pricing.faq.q1', a: 'pricing.faq.a1' },
    { q: 'pricing.faq.q2', a: 'pricing.faq.a2' },
    { q: 'pricing.faq.q3', a: 'pricing.faq.a3' },
    { q: 'pricing.faq.q4', a: 'pricing.faq.a4' },
    { q: 'pricing.faq.q5', a: 'pricing.faq.a5' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Navigation bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 text-white font-bold text-xl hover:text-orange-400 transition-colors"
            onClick={(e) => { e.preventDefault(); navigate('/'); }}
          >
            <Wallet className="w-6 h-6 text-orange-500" />
            CashPilot
          </a>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/app')}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
              >
                {t('pricing.goToApp')}
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors text-sm"
                >
                  {t('pricing.login')}
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  {t('pricing.signup')}
                  <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            {t('pricing.subtitle')}
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-[#0f1528] rounded-full p-1.5 border border-gray-700/50">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('pricing.monthly')}
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingPeriod === 'annual'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('pricing.annual')}
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">
                -2 {t('pricing.monthsFree')}
              </span>
            </button>
          </div>
        </div>

        {/* User current balance (if logged in) */}
        {user && (
          <div className="mb-10 max-w-md mx-auto bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-lg border border-orange-500/30 p-4 text-center">
            <p className="text-sm text-gray-400">{t('credits.balance')}</p>
            <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">
              {availableCredits}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('credits.free')}: {credits.free_credits} | {t('subscription.subCredits')}: {credits.subscription_credits || 0} | {t('credits.paid')}: {credits.paid_credits}
            </p>
          </div>
        )}

        {/* ================================ */}
        {/* SUBSCRIPTION PLANS               */}
        {/* ================================ */}
        <section className="mb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {plans.map((plan, index) => {
              const Icon = PLAN_ICONS[plan.slug] || Coins;
              const colors = PLAN_COLORS[plan.slug] || PLAN_COLORS.free;
              const isCurrent = isCurrentPlan(plan.slug);
              const isPopular = plan.slug === 'pro';
              const features = plan.features || [];
              const costPerCredit = getCostPerCredit(plan.price_cents, plan.credits_per_month);
              const annualTotal = billingPeriod === 'annual' ? getAnnualTotal(plan.price_cents) : null;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-[#0f1528]/80 backdrop-blur-sm rounded-2xl border p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                    isPopular
                      ? `${colors.border} ring-2 ring-orange-500/30 ${colors.glow}`
                      : isCurrent
                        ? 'border-green-500/50 ring-1 ring-green-500/30'
                        : 'border-gray-700/50 hover:border-gray-600'
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.5s ease-out both',
                  }}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg shadow-orange-500/30">
                      <Sparkles className="w-3 h-3" /> {t('pricing.popular')}
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
                      {t('pricing.currentPlan')}
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="flex items-center gap-2 mb-1 mt-2">
                    <div className={`p-1.5 rounded-lg bg-gray-800/80`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                  </div>

                  {/* Target audience */}
                  <p className="text-xs text-gray-500 italic mb-4">
                    {t(PLAN_TARGETS[plan.slug] || 'pricing.target.free')}
                  </p>

                  {/* Price */}
                  <div className="mb-1">
                    <span className="text-3xl font-bold text-white">{formatPlanPrice(plan.price_cents)}</span>
                    {plan.price_cents > 0 && (
                      <span className="text-gray-500 text-sm">/{t('pricing.month')}</span>
                    )}
                  </div>

                  {/* Annual total or cost per credit */}
                  <div className="mb-4 min-h-[2.5rem]">
                    {annualTotal && (
                      <p className="text-xs text-gray-500">
                        {annualTotal}
                      </p>
                    )}
                    {costPerCredit && (
                      <p className={`text-xs ${colors.text} font-medium`}>
                        {costPerCredit} €/{t('credits.credit')}
                      </p>
                    )}
                  </div>

                  {/* Credits badge */}
                  <div className={`text-center py-2 rounded-lg bg-gray-800/50 border border-gray-700/30 mb-4`}>
                    <span className={`text-lg font-bold ${colors.text}`}>
                      {plan.credits_per_month.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">{t('pricing.creditsPerMonth')}</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-5 flex-1">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className={`w-4 h-4 ${colors.text} mt-0.5 flex-shrink-0`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {/* Show crossed-out features on Free plan */}
                    {plan.slug === 'free' && (
                      <>
                        <li className="flex items-start gap-2 text-sm text-gray-600 line-through">
                          <X className="w-4 h-4 text-gray-700 mt-0.5 flex-shrink-0" />
                          <span>{t('pricing.noFeature.reports')}</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-600 line-through">
                          <X className="w-4 h-4 text-gray-700 mt-0.5 flex-shrink-0" />
                          <span>{t('pricing.noFeature.support')}</span>
                        </li>
                      </>
                    )}
                  </ul>

                  {/* CTA button */}
                  <button
                    onClick={() => handleSubscribe(plan.slug)}
                    disabled={isCurrent || subscribing === plan.slug || plan.slug === 'free'}
                    className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isCurrent
                        ? 'bg-green-500/20 text-green-400 cursor-default'
                        : plan.slug === 'free'
                          ? 'bg-gray-800/50 text-gray-500 cursor-default'
                          : plan.slug === 'enterprise'
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                            : isPopular
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25'
                              : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {subscribing === plan.slug
                      ? '...'
                      : isCurrent
                        ? t('pricing.currentPlan')
                        : plan.slug === 'free'
                          ? t('pricing.freePlan')
                          : plan.slug === 'enterprise'
                            ? t('pricing.contactUs')
                            : t('pricing.subscribe')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================ */}
        {/* TRUST BADGES                     */}
        {/* ================================ */}
        <section className="mb-20">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span>{t('pricing.trust.stripe')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-500" />
              <span>{t('pricing.trust.gdpr')}</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-500" />
              <span>{t('pricing.trust.cancel')}</span>
            </div>
          </div>
        </section>

        {/* ================================ */}
        {/* CREDIT PACKS (one-time)          */}
        {/* ================================ */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            {t('pricing.creditPacks')}
          </h2>
          <p className="text-gray-400 text-center mb-8">{t('pricing.creditPacksDesc')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {packages.map((pkg, index) => {
              const Icon = PACKAGE_ICONS[index % PACKAGE_ICONS.length];
              const pricePerCredit = (pkg.price_cents / pkg.credits / 100).toFixed(3);
              const savings = index > 0
                ? Math.round((1 - (pkg.price_cents / pkg.credits) / (packages[0]?.price_cents / packages[0]?.credits)) * 100)
                : 0;
              return (
                <div
                  key={pkg.id}
                  className={`bg-[#0f1528]/80 backdrop-blur-sm rounded-2xl border p-5 flex flex-col transition-all hover:-translate-y-1 ${
                    index === 1 ? 'border-orange-500/50 ring-1 ring-orange-500/30' : 'border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-5 h-5 text-orange-400" />
                    <h4 className="font-semibold text-white">{pkg.name}</h4>
                    {savings > 0 && (
                      <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">
                        -{savings}%
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400 mb-1">
                    {pkg.credits.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">{t('credits.creditsLabel')}</p>
                  <p className="text-lg font-semibold text-white mb-1">{formatPrice(pkg.price_cents, pkg.currency)}</p>
                  <p className="text-xs text-gray-500 mb-4">{pricePerCredit} €/{t('credits.credit')}</p>
                  <button
                    onClick={() => handleBuyCredits(pkg)}
                    disabled={purchasing === pkg.id}
                    className="mt-auto w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    {purchasing === pkg.id ? '...' : t('credits.buy')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================ */}
        {/* CREDIT COSTS TABLE               */}
        {/* ================================ */}
        <section className="max-w-4xl mx-auto mb-20">
          <button
            onClick={() => setShowCreditCosts(!showCreditCosts)}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <span className="font-medium">{t('credits.whatCosts')}</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${showCreditCosts ? 'rotate-180' : ''}`} />
          </button>

          {showCreditCosts && (
            <div className="bg-[#0f1528]/80 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 space-y-5">
              {/* Financial Statements */}
              <div>
                <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-2">
                  {t('credits.categories.financialStatements')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {CREDIT_CATEGORIES.FINANCIAL_STATEMENTS.map(key => (
                    <div key={key} className="flex justify-between p-2 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                      <span className="text-orange-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commercial Documents */}
              <div>
                <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2">
                  {t('credits.categories.commercialDocuments')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {CREDIT_CATEGORIES.COMMERCIAL_DOCUMENTS.map(key => (
                    <div key={key} className="flex justify-between p-2 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                      <span className="text-blue-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analytical Reports */}
              <div>
                <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
                  {t('credits.categories.analyticalReports')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {CREDIT_CATEGORIES.ANALYTICAL_REPORTS.map(key => (
                    <div key={key} className="flex justify-between p-2 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                      <span className="text-purple-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Free */}
              <div className="pt-3 border-t border-gray-700">
                <div className="flex justify-between p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                  <span className="text-gray-300">{t('credits.costs.htmlPreview')}</span>
                  <span className="text-green-400 font-semibold">{t('credits.free')}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ================================ */}
        {/* FAQ                              */}
        {/* ================================ */}
        <section className="max-w-3xl mx-auto mb-20">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <HelpCircle className="w-6 h-6 text-orange-400" />
              <h2 className="text-2xl font-bold text-white">{t('pricing.faq.title')}</h2>
            </div>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <div
                key={index}
                className="bg-[#0f1528]/80 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <span className="font-medium text-white text-sm">{t(item.q)}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ml-2 ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-400 leading-relaxed">{t(item.a)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            {t('pricing.footer')}
          </p>
        </div>
      </div>

      {/* CSS animation keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default PricingPage;
