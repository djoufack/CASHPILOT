import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const WEEKLY_BRIEFING_TIMEOUT_MS = 45_000;

async function getFreshAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (session?.access_token) return session.access_token;

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;
  return data?.session?.access_token || null;
}

async function callWeeklyBriefingEndpoint(body, accessToken, timeoutMs = WEEKLY_BRIEFING_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${supabaseUrl}/functions/v1/cfo-weekly-briefing`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useCfoWeeklyBriefing() {
  const { user } = useAuth();
  const { activeCompanyId, withCompanyScope } = useCompanyScope();
  const inFlightRef = useRef(false);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatedNow, setGeneratedNow] = useState(false);
  const [error, setError] = useState(null);

  const loadBriefing = useCallback(
    async ({ force = false } = {}) => {
      if (!user || !activeCompanyId) return null;
      if (inFlightRef.current && !force) return null;

      inFlightRef.current = true;
      setLoading(true);
      setError(null);

      try {
        let accessToken = await getFreshAccessToken();
        if (!accessToken) {
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        }

        const payload = withCompanyScope({});
        let response = await callWeeklyBriefingEndpoint(payload, accessToken);

        if (response.status === 401) {
          accessToken = await getFreshAccessToken();
          if (!accessToken) {
            throw new Error('Session expirée. Veuillez vous reconnecter.');
          }
          response = await callWeeklyBriefingEndpoint(payload, accessToken);
        }

        const responsePayload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(responsePayload?.error || responsePayload?.message || `HTTP ${response.status}`);
        }

        const normalizedPayload = responsePayload || {};
        const nextBriefing = normalizedPayload.briefing || null;
        if (!nextBriefing) {
          throw new Error('Aucun briefing hebdomadaire disponible.');
        }

        setBriefing(nextBriefing);
        setGeneratedNow(Boolean(normalizedPayload.generated_now));
        return nextBriefing;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Impossible de charger le briefing hebdomadaire.';
        setError(message);
        return null;
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [activeCompanyId, user, withCompanyScope]
  );

  useEffect(() => {
    if (user && activeCompanyId) {
      void loadBriefing();
    }
  }, [activeCompanyId, loadBriefing, user]);

  return {
    briefing,
    loading,
    error,
    generatedNow,
    loadBriefing,
    refreshBriefing: () => loadBriefing({ force: true }),
  };
}
