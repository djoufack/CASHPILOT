import React, { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { ToastAction } from '@/components/ui/toast';

const CACHE_KEY = 'cashpilot_audit_cache';

/**
 * Real-time accounting guard.
 * Subscribes to `accounting_health` table via Supabase Realtime.
 * Shows toast notifications when entries are validated or imbalanced,
 * with clear guidance so the user knows what to do.
 * Invalidates audit cache so the health widget refreshes.
 */
export const useAccountingGuard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`accounting-health-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounting_health',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const health = payload.new;
          if (!health) return;

          if (health.is_balanced) {
            toast({
              title: t('accounting_guard.validated', 'Ecritures validees'),
              description: t('accounting_guard.balanced_detail', 'L\'equilibre debit/credit est verifie pour {{ref}}. Votre comptabilite reste conforme.', { ref: health.last_entry_ref }),
              duration: 4000,
            });
          } else {
            toast({
              title: t('accounting_guard.warning_title', 'Verification necessaire'),
              description: t('accounting_guard.imbalance_guidance', 'Un desequilibre a ete detecte sur {{ref}}. Pas de panique — lancez un audit pour identifier et corriger le probleme.', { ref: health.last_entry_ref }),
              variant: 'destructive',
              duration: 12000,
              action: React.createElement(
                ToastAction,
                {
                  altText: t('accounting_guard.see_audit', 'Voir l\'audit'),
                  onClick: () => { window.location.href = '/app/audit-comptable'; },
                },
                t('accounting_guard.see_audit', 'Voir l\'audit')
              ),
            });
          }

          // Invalidate audit cache so the health widget refreshes
          localStorage.removeItem(CACHE_KEY);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, toast, t]);
};
