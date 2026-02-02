
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReferrals } from '@/hooks/useReferrals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Gift, Users, Check, Link2 } from 'lucide-react';
import { format } from 'date-fns';

const ReferralSystem = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    referralCode,
    referrals,
    loading,
    applyReferralCode,
    getReferralLink,
    completedCount,
    totalBonusEarned
  } = useReferrals();

  const [inputCode, setInputCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({ title: t('common.success'), description: t('referrals.codeCopied') });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getReferralLink());
    toast({ title: t('common.success'), description: t('referrals.linkCopied') });
  };

  const handleApplyCode = async () => {
    if (!inputCode.trim()) return;
    setApplying(true);
    const success = await applyReferralCode(inputCode.trim());
    if (success) setInputCode('');
    setApplying(false);
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      {/* Share your code */}
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">{t('referrals.shareTitle')}</h3>
            <p className="text-sm text-gray-400">{t('referrals.shareDescription')}</p>
          </div>
        </div>

        {/* Code display */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-gray-800/80 border border-gray-600 rounded-lg px-4 py-3 font-mono text-lg text-center text-orange-400 font-bold tracking-widest">
            {referralCode || '...'}
          </div>
          <Button onClick={handleCopyCode} variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        {/* Copy link */}
        <Button onClick={handleCopyLink} variant="ghost" className="w-full text-gray-400 hover:text-white hover:bg-gray-800/50" size="sm">
          <Link2 className="w-3.5 h-3.5 mr-2" />
          {t('referrals.copyLink')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
          <Users className="w-5 h-5 text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{completedCount}</p>
          <p className="text-xs text-gray-500">{t('referrals.friendsReferred')}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
          <Gift className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-400">+{totalBonusEarned}</p>
          <p className="text-xs text-gray-500">{t('referrals.creditsEarned')}</p>
        </div>
      </div>

      {/* Apply a code */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h4 className="text-sm font-semibold text-white mb-3">{t('referrals.haveCode')}</h4>
        <div className="flex gap-2">
          <Input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder={t('referrals.enterCode')}
            className="bg-gray-700 border-gray-600 text-white font-mono uppercase"
          />
          <Button
            onClick={handleApplyCode}
            disabled={applying || !inputCode.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
          >
            {applying ? '...' : t('referrals.apply')}
          </Button>
        </div>
      </div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">{t('referrals.history')}</h4>
          <div className="space-y-2">
            {referrals.map(ref => (
              <div key={ref.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded text-sm">
                <div>
                  <p className="text-white">
                    {ref.status === 'completed' ? t('referrals.friendJoined') : t('referrals.pending')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ref.created_at ? format(new Date(ref.created_at), 'dd/MM/yyyy') : ''}
                  </p>
                </div>
                <span className={`font-semibold ${ref.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {ref.status === 'completed' ? '+25' : t('referrals.pending')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralSystem;
