import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export function useInstrumentCards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCards = useCallback(async (instrumentId) => {
    if (!user || !instrumentId) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_instrument_cards')
        .select('*')
        .eq('instrument_id', instrumentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCards(data || []);
      return data || [];
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  const createCard = useCallback(async (instrumentId, cardData) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('payment_instrument_cards')
        .insert([{ instrument_id: instrumentId, ...cardData }])
        .select()
        .single();
      if (error) throw error;
      toast({ title: t('common.success'), description: t('financialInstruments.cardCreated') });
      await fetchCards(instrumentId);
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, fetchCards, toast, t]);

  const updateCard = useCallback(async (id, instrumentId, updates) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('payment_instrument_cards')
        .update(updates)
        .eq('id', id)
        .eq('instrument_id', instrumentId)
        .select()
        .single();
      if (error) throw error;
      toast({ title: t('common.success'), description: t('common.updated') });
      await fetchCards(instrumentId);
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, fetchCards, toast, t]);

  const deleteCard = useCallback(async (id, instrumentId) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('payment_instrument_cards')
        .delete()
        .eq('id', id)
        .eq('instrument_id', instrumentId);
      if (error) throw error;
      toast({ title: t('common.success'), description: t('common.deleted') });
      await fetchCards(instrumentId);
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return false;
    }
  }, [user, fetchCards, toast, t]);

  return { cards, loading, fetchCards, createCard, updateCard, deleteCard };
}
