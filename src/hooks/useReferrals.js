
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export const useReferrals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReferralCode = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data } = await supabase
        .from('user_credits')
        .select('referral_code')
        .eq('user_id', user.id)
        .single();

      if (data?.referral_code) {
        setReferralCode(data.referral_code);
      }
    } catch (err) {
      console.error('Error fetching referral code:', err);
    }
  }, [user]);

  const fetchReferrals = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', user.id)
        .order('created_at', { ascending: false });

      setReferrals(data || []);
    } catch (err) {
      console.error('Error fetching referrals:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReferralCode();
    fetchReferrals();
  }, [fetchReferralCode, fetchReferrals]);

  /**
   * Apply a referral code during signup or from settings.
   * Awards 25 credits to both the referrer and the new user.
   */
  const applyReferralCode = async (code) => {
    if (!user || !supabase || !code) return false;

    // Don't allow self-referral
    if (code === referralCode) {
      toast({
        title: t('common.error'),
        description: t('referrals.selfReferral'),
        variant: 'destructive'
      });
      return false;
    }

    try {
      // Find the referrer by code
      const { data: referrerData, error: findError } = await supabase
        .from('user_credits')
        .select('user_id, referral_code')
        .eq('referral_code', code.toUpperCase())
        .single();

      if (findError || !referrerData) {
        toast({
          title: t('common.error'),
          description: t('referrals.invalidCode'),
          variant: 'destructive'
        });
        return false;
      }

      // Check if already referred
      const { data: myCredits } = await supabase
        .from('user_credits')
        .select('referred_by')
        .eq('user_id', user.id)
        .single();

      if (myCredits?.referred_by) {
        toast({
          title: t('common.error'),
          description: t('referrals.alreadyReferred'),
          variant: 'destructive'
        });
        return false;
      }

      const referrerUserId = referrerData.user_id;
      const BONUS = 25;

      // Create referral record
      await supabase.from('referrals').insert({
        referrer_user_id: referrerUserId,
        referred_user_id: user.id,
        referral_code: code.toUpperCase(),
        status: 'completed',
        bonus_credited: true,
        completed_at: new Date().toISOString()
      });

      // Credit the referrer
      const { data: referrerCredits } = await supabase
        .from('user_credits')
        .select('free_credits')
        .eq('user_id', referrerUserId)
        .single();

      await supabase.from('user_credits')
        .update({ free_credits: (referrerCredits?.free_credits || 0) + BONUS })
        .eq('user_id', referrerUserId);

      await supabase.from('credit_transactions').insert({
        user_id: referrerUserId,
        type: 'bonus',
        amount: BONUS,
        description: `Referral bonus — new user joined`
      });

      // Credit the referred user (me)
      const { data: myCurrentCredits } = await supabase
        .from('user_credits')
        .select('free_credits')
        .eq('user_id', user.id)
        .single();

      await supabase.from('user_credits')
        .update({
          free_credits: (myCurrentCredits?.free_credits || 0) + BONUS,
          referred_by: code.toUpperCase()
        })
        .eq('user_id', user.id);

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        type: 'bonus',
        amount: BONUS,
        description: `Referral bonus — used code ${code.toUpperCase()}`
      });

      toast({
        title: t('common.success'),
        description: t('referrals.bonusApplied', { amount: BONUS })
      });

      return true;
    } catch (err) {
      console.error('Error applying referral:', err);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  const getReferralLink = () => {
    if (!referralCode) return '';
    return `${window.location.origin}/signup?ref=${referralCode}`;
  };

  const completedCount = referrals.filter(r => r.status === 'completed').length;
  const totalBonusEarned = completedCount * 25;

  return {
    referralCode,
    referrals,
    loading,
    applyReferralCode,
    getReferralLink,
    completedCount,
    totalBonusEarned,
    fetchReferrals
  };
};
