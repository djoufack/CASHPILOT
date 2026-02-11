import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useAIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text) => {
    if (!user || !text.trim()) return;

    const userMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Build context from last 10 messages for conversation continuity
      const context = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chatbot`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id, message: text, context }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Chatbot HTTP error:', response.status, errorText);
        if (response.status === 401) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Session expirée. Veuillez vous reconnecter.',
            timestamp: new Date().toISOString(),
            isError: true,
          }]);
          return;
        }
        if (response.status === 402) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Crédits insuffisants pour utiliser le chatbot IA. Rechargez vos crédits pour continuer.',
            timestamp: new Date().toISOString(),
            isError: true,
          }]);
          return;
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Erreur serveur (${response.status}). Veuillez réessayer.`,
          timestamp: new Date().toISOString(),
          isError: true,
        }]);
        return;
      }

      const data = await response.json();

      if (data.error === 'insufficient_credits') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Crédits insuffisants pour utiliser le chatbot IA. Rechargez vos crédits pour continuer.',
          timestamp: new Date().toISOString(),
          isError: true,
        }]);
      } else if (data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Erreur: ${data.error}`,
          timestamp: new Date().toISOString(),
          isError: true,
        }]);
      } else if (data.reply) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Réponse inattendue du serveur. Veuillez réessayer.',
          timestamp: new Date().toISOString(),
          isError: true,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erreur de connexion au serveur. Veuillez réessayer.',
        timestamp: new Date().toISOString(),
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [user, messages]);

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearChat };
};
