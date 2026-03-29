import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { createCheckoutSession, redirectToCheckout, formatPrice } from '@/services/stripeService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CreditCard, Coins, TrendingUp, Zap, Star, Gift, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { CREDIT_COSTS, CREDIT_CATEGORIES, CREDIT_COST_LABELS } from '@/hooks/useCreditsGuard';
import ReferralSystem from '@/components/ReferralSystem';

const PACKAGE_ICONS = [Coins, Zap, Star, TrendingUp];

const CreditsPurchase = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { credits, availableCredits, packages, transactions, fetchTransactions, _loading, unlimitedAccess, unlimitedAccessLabel } = useCredits();
  const { currentPlan, subscriptionStatus, subscriptionCredits, currentPeriodEnd } = useSubscription();
  const { toast } = useToast();
  const [purchasing, setPurchasing] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);

  const handlePurchase = async (pkg) => {
    if (unlimitedAccess) {
      toast({
        title: 'Credits non requis',
        description: `${unlimitedAccessLabel || 'Ce compte'} dispose deja d'un acces illimite.`,
      });
      return;
    }

    setPurchasing(pkg.id);
    try {
      const session = await createCheckoutSession({
        priceId: pkg.stripe_price_id,
        credits: pkg.credits,
        userId: user.id,
        customerEmail: user.email,
      });
      if (session.url) {
        redirectToCheckout(session.url);
      } else {
        toast({
          title: t('common.error'),
          description: t('credits.checkoutError'),
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setPurchasing(null);
    }
  };

  const loadHistory = () => {
    if (!showHistory) {
      fetchTransactions();
    }
    setShowHistory(!showHistory);
  };

  const hasActiveSubscription = subscriptionStatus === 'active' && currentPlan;

  return (
    <div className="space-y-6">
      {/* Subscription banner */}
      {unlimitedAccess ? (
        <div className="bg-cyan-500/10 rounded-lg border border-cyan-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-cyan-300 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">{unlimitedAccessLabel || 'Acces illimite'}</p>
              <p className="text-xs text-cyan-100/80 mt-0.5">Tous les services et usages credits sont ouverts sans limitation.</p>
            </div>
          </div>
        </div>
      ) : hasActiveSubscription ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-orange-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">
                {t('billing.currentPlan')}: <span className="text-orange-400">{currentPlan.name}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('subscription.subCredits')}: {subscriptionCredits} / {currentPlan.credits_per_month}
                {currentPeriodEnd && (
                  <> &middot; {t('billing.renewsOn')} {format(new Date(currentPeriodEnd), 'dd/MM/yyyy')}</>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pricing')}
            className="border-gray-600 text-gray-300 hover:bg-gray-700 shrink-0"
          >
            {t('billing.changePlan')}
          </Button>
        </div>
      ) : (
        <div
          className="bg-gray-800/60 rounded-lg border border-dashed border-gray-600 p-4 flex items-center justify-between cursor-pointer hover:border-orange-500/50 transition-colors"
          onClick={() => navigate('/pricing')}
        >
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-gray-500 shrink-0" />
            <p className="text-sm text-gray-400">
              {t('billing.noPlan')} <span className="text-orange-400 font-medium">{t('billing.viewPlans')}</span>
            </p>
          </div>
        </div>
      )}

      {/* Credits balance */}
      <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-lg border border-orange-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">{t('credits.balance')}</p>
            <p className="text-4xl font-bold text-gradient mt-1">{unlimitedAccess ? 'Illimite' : availableCredits}</p>
            <p className="text-xs text-gray-500 mt-1">
              {unlimitedAccess
                ? `${unlimitedAccessLabel || 'Acces special'} · tous les services sans limite`
                : `${t('credits.free')}: ${credits.free_credits} | ${t('credits.paid')}: ${credits.paid_credits} | ${t('credits.used')}: ${credits.total_used}`}
            </p>
          </div>
          <Coins className="w-12 h-12 text-orange-400 opacity-50" />
        </div>
      </div>

      {/* Credit packages */}
      {!unlimitedAccess && (
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('credits.buyCredits')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg, index) => {
            const Icon = PACKAGE_ICONS[index % PACKAGE_ICONS.length];
            const pricePerCredit = (pkg.price_cents / pkg.credits / 100).toFixed(3);
            const savings = index > 0 ? Math.round((1 - (pkg.price_cents / pkg.credits) / (packages[0]?.price_cents / packages[0]?.credits)) * 100) : 0;
            return (
              <div key={pkg.id} className={`bg-gray-800 rounded-lg border p-5 flex flex-col ${index === 1 ? 'border-orange-500/50 ring-1 ring-orange-500/30' : 'border-gray-700'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-orange-400" />
                  <h4 className="font-semibold text-white">{pkg.name}</h4>
                  {savings > 0 && (
                    <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-semibold">
                      -{savings}%
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-gradient mb-1">{pkg.credits}</p>
                <p className="text-xs text-gray-500 mb-3">{t('credits.creditsLabel')}</p>
                <p className="text-lg font-semibold text-white mb-1">{formatPrice(pkg.price_cents, pkg.currency)}</p>
                <p className="text-xs text-gray-500 mb-4">{pricePerCredit} {pkg.currency}/{t('credits.credit')}</p>
                <Button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id}
                  className="mt-auto bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {purchasing === pkg.id ? '...' : t('credits.buy')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* What costs credits — grouped by categories */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="text-lg font-semibold mb-4">{t('credits.whatCosts')}</h3>

        <div className="space-y-5">
          {/* Financial Statements (OHADA) */}
          <div>
            <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              📊 {t('credits.categories.financialStatements')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {CREDIT_CATEGORIES.FINANCIAL_STATEMENTS.map(key => (
                <div key={key} className="flex justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                  <span className="text-orange-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Commercial Documents */}
          <div>
            <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              📄 {t('credits.categories.commercialDocuments')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {CREDIT_CATEGORIES.COMMERCIAL_DOCUMENTS.map(key => (
                <div key={key} className="flex justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                  <span className="text-blue-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Analytical Reports */}
          <div>
            <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              📈 {t('credits.categories.analyticalReports')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {CREDIT_CATEGORIES.ANALYTICAL_REPORTS.map(key => (
                <div key={key} className="flex justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                  <span className="text-purple-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Exports */}
          <div>
            <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              💾 {t('credits.categories.additionalExports')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {CREDIT_CATEGORIES.ADDITIONAL_EXPORTS.map(key => (
                <div key={key} className="flex justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                  <span className="text-cyan-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Other Actions */}
          <div>
            <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              ⚡ {t('credits.categories.other')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {CREDIT_CATEGORIES.OTHER.map(key => (
                <div key={key} className="flex justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                  <span className="text-yellow-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.credit')}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              🌐 {t('credits.categories.peppol')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {CREDIT_CATEGORIES.PEPPOL.map(key => (
                <div key={key} className="flex justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-gray-300">{t(CREDIT_COST_LABELS[key])}</span>
                  <span className="text-emerald-400 font-semibold">{CREDIT_COSTS[key]} {t('credits.creditsLabel')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Free section */}
          <div className="pt-3 border-t border-gray-700">
            <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              ✅ {t('credits.free')}
            </h4>
            <div className="flex justify-between p-2 bg-green-500/10 border border-green-500/30 rounded">
              <span className="text-gray-300">{t('credits.costs.htmlPreview')}</span>
              <span className="text-green-400 font-semibold">{t('credits.free')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Referral system */}
      <div>
        <Button
          variant="outline"
          onClick={() => setShowReferrals(!showReferrals)}
          className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20 mb-3"
        >
          <Gift className="w-4 h-4 mr-2" />
          {showReferrals ? t('referrals.hideReferrals') : t('referrals.showReferrals')}
        </Button>
        {showReferrals && <ReferralSystem />}
      </div>

      {/* Transaction history */}
      <div>
        <Button variant="outline" onClick={loadHistory} className="border-gray-600 text-gray-300 hover:bg-gray-700 mb-3">
          {showHistory ? t('credits.hideHistory') : t('credits.showHistory')}
        </Button>
        {showHistory && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500">{t('credits.noTransactions')}</p>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded text-sm">
                  <div>
                    <p className="text-white">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.created_at ? format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm') : ''}</p>
                  </div>
                  <span className={`font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditsPurchase;
