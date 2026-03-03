import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { buildNotificationPayloads, fetchObligationSnapshot } from '@/lib/obligations';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const THROTTLE_INTERVAL_MS = 5 * 60 * 1000;
const OBLIGATION_NOTIFICATION_TYPES = [
  'obligation_receivables',
  'obligation_payables',
  'obligation_quotes',
];

const getStorageKey = (userId) => `cashpilot:obligation-sync:${userId}`;

export const useObligationNotifications = () => {
  const { user } = useAuth();
  const activeCompanyId = useActiveCompanyId();
  const syncingRef = useRef(false);

  const syncNotifications = useCallback(async () => {
    if (!user || !supabase || syncingRef.current) return;

    const storageKey = getStorageKey(user.id);
    const lastSyncAt = Number(localStorage.getItem(storageKey) || 0);

    if (Date.now() - lastSyncAt < THROTTLE_INTERVAL_MS) {
      return;
    }

    try {
      syncingRef.current = true;
      const snapshot = await fetchObligationSnapshot(supabase, user.id, { companyId: activeCompanyId });
      const payloads = buildNotificationPayloads(snapshot);

      const { data: existingRows, error: existingError } = await supabase
        .from('notifications')
        .select('id, type, title, message, is_read, created_at')
        .eq('user_id', user.id)
        .in('type', OBLIGATION_NOTIFICATION_TYPES)
        .order('created_at', { ascending: false });

      if (existingError) throw existingError;

      const latestByType = new Map();
      for (const row of existingRows || []) {
        if (!latestByType.has(row.type)) {
          latestByType.set(row.type, row);
        }
      }

      const activeTypes = new Set(payloads.map((payload) => payload.type));

      for (const payload of payloads) {
        const existing = latestByType.get(payload.type);

        if (!existing) {
          const { error } = await supabase.from('notifications').insert({
            user_id: user.id,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            is_read: false,
          });

          if (error) throw error;
          continue;
        }

        const shouldUpdateUnread = !existing.is_read && (
          existing.title !== payload.title || existing.message !== payload.message
        );

        if (shouldUpdateUnread) {
          const { error } = await supabase
            .from('notifications')
            .update({
              title: payload.title,
              message: payload.message,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (error) throw error;
          continue;
        }

        const isSameMessage = existing.title === payload.title && existing.message === payload.message;
        if (existing.is_read && !isSameMessage) {
          const { error } = await supabase.from('notifications').insert({
            user_id: user.id,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            is_read: false,
          });

          if (error) throw error;
        }
      }

      for (const [type, existing] of latestByType.entries()) {
        if (activeTypes.has(type) || existing.is_read) {
          continue;
        }

        const { error } = await supabase
          .from('notifications')
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      }

      localStorage.setItem(storageKey, String(Date.now()));
    } catch (error) {
      console.error('Failed to sync obligation notifications:', error);
    } finally {
      syncingRef.current = false;
    }
  }, [activeCompanyId, user]);

  useEffect(() => {
    if (!user) return undefined;

    syncNotifications();
    const timer = window.setInterval(syncNotifications, SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [syncNotifications, user]);

  return { syncNotifications };
};
