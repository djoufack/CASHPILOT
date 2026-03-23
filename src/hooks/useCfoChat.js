import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const CFO_REQUEST_TIMEOUT_MS = 45_000;

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

async function callCfoAgent(body, accessToken, timeoutMs = CFO_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${supabaseUrl}/functions/v1/cfo-agent`, {
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

function isAbortError(error) {
  return error instanceof Error && error.name === 'AbortError';
}

export const useCfoChat = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [healthScore, setHealthScore] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const sendMessage = useCallback(
    async (text) => {
      if (!user || !text.trim() || !activeCompanyId) return;

      const userMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        let accessToken = await getFreshAccessToken();
        if (!accessToken) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'Session expirée. Veuillez vous reconnecter.',
              timestamp: new Date().toISOString(),
              isError: true,
            },
          ]);
          return;
        }

        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const body = {
          question: text.trim(),
          company_id: activeCompanyId,
          history,
        };

        let response = await callCfoAgent(body, accessToken);

        // Recover seamlessly from expired JWT.
        if (response.status === 401) {
          accessToken = await getFreshAccessToken();
          if (!accessToken) {
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: 'Session expirée. Veuillez vous reconnecter.',
                timestamp: new Date().toISOString(),
                isError: true,
              },
            ]);
            return;
          }
          response = await callCfoAgent(body, accessToken);
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('CFO Agent error:', response.status, errorText);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                response.status === 401
                  ? 'Session expirée. Veuillez vous reconnecter.'
                  : `Erreur serveur (${response.status}). Veuillez réessayer.`,
              timestamp: new Date().toISOString(),
              isError: true,
            },
          ]);
          return;
        }

        const data = await response.json();

        if (data.error) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `Erreur: ${data.error}`,
              timestamp: new Date().toISOString(),
              isError: true,
            },
          ]);
          return;
        }

        if (data.answer) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data.answer,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        if (data.health_score) {
          setHealthScore(data.health_score);
        }

        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (err) {
        console.error('CFO Chat error:', err);
        const connectionErrorMessage = isAbortError(err)
          ? `La requete CFO a expire apres ${Math.round(CFO_REQUEST_TIMEOUT_MS / 1000)}s. Veuillez reessayer.`
          : 'Erreur de connexion au serveur. Veuillez réessayer.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: connectionErrorMessage,
            timestamp: new Date().toISOString(),
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeCompanyId, user, messages]
  );

  const loadHistory = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase
        .from('cfo_chat_history')
        .select('id, role, content, tool_calls, created_at')
        .order('created_at', { ascending: true })
        .limit(50);

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) {
        console.error('Load CFO history error:', error);
        return;
      }

      if (data && data.length > 0) {
        setMessages(
          data.map((row) => ({
            role: row.role,
            content: row.content,
            timestamp: row.created_at,
            toolCalls: row.tool_calls,
          }))
        );
      }
    } catch (err) {
      console.error('Load CFO history error:', err);
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  const clearHistory = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase.from('cfo_chat_history').delete();

      query = applyCompanyScope(query);

      await query;
      setMessages([]);
      setHealthScore(null);
      setSuggestions([]);
    } catch (err) {
      console.error('Clear CFO history error:', err);
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  useEffect(() => {
    if (user && activeCompanyId) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  return {
    messages,
    loading,
    healthScore,
    suggestions,
    sendMessage,
    loadHistory,
    clearHistory,
  };
};
