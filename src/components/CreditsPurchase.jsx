
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/context/AuthContext';
import { createCheckoutSession, redirectToCheckout, formatPrice } from '@/services/stripeService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CreditCard, Coins, TrendingUp, Zap, Star } from 'lucide-react';
import { format } from 'date-fns';

const PACKAGE_ICONS = [Coins, Zap, Star, TrendingUp];

const CreditsPurchase = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { credits, availableCredits, packages, transactions, fetchTransactions, loading } = useCredits();
  const { toast } = useToast();
  const [purchasing, setPurchasing] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const handlePurchase = async (pkg) => {
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

  return (
    <div className="space-y-6">
      {/* Credits balance */}
      <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-lg border border-orange-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">{t('credits.balance')}</p>
            <p className="text-4xl font-bold text-gradient mt-1">{availableCredits}</p>
            <p className="text-xs text-gray-500 mt-1">
              {t('credits.free')}: {credits.free_credits} | {t('credits.paid')}: {credits.paid_credits} | {t('credits.used')}: {credits.total_used}
            </p>
          </div>
          <Coins className="w-12 h-12 text-orange-400 opacity-50" />
        </div>
      </div>

      {/* Credit packages */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('credits.buyCredits')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg, index) => {
            const Icon = PACKAGE_ICONS[index % PACKAGE_ICONS.length];
            const pricePerCredit = (pkg.price_cents / pkg.credits / 100).toFixed(3);
            return (
              <div key={pkg.id} className="bg-gray-800 rounded-lg border border-gray-700 p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-orange-400" />
                  <h4 className="font-semibold text-white">{pkg.name}</h4>
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

      {/* What costs credits */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="text-lg font-semibold mb-3">{t('credits.whatCosts')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between p-2 bg-gray-700/50 rounded">
            <span className="text-gray-300">{t('credits.costPdfExport')}</span>
            <span className="text-orange-400 font-semibold">1 {t('credits.credit')}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-700/50 rounded">
            <span className="text-gray-300">{t('credits.costHtmlPreview')}</span>
            <span className="text-orange-400 font-semibold">1 {t('credits.credit')}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-700/50 rounded">
            <span className="text-gray-300">{t('credits.costReceipt')}</span>
            <span className="text-orange-400 font-semibold">1 {t('credits.credit')}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-700/50 rounded">
            <span className="text-gray-300">{t('credits.costReport')}</span>
            <span className="text-orange-400 font-semibold">2 {t('credits.credit')}s</span>
          </div>
        </div>
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
