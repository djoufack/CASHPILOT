import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

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
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch(`${supabaseUrl}/functions/v1/cfo-agent`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: text.trim(),
            company_id: activeCompanyId,
            history,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('CFO Agent error:', response.status, errorText);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                response.status === 401
                  ? 'Session expiree. Veuillez vous reconnecter.'
                  : `Erreur serveur (${response.status}). Veuillez reessayer.`,
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
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Erreur de connexion au serveur. Veuillez reessayer.',
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
