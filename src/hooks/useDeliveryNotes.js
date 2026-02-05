import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

export const useDeliveryNotes = () => {
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const fetchDeliveryNotes = async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          *,
          client:clients(id, company_name, contact_name, email, preferred_currency),
          invoice:invoices(id, invoice_number, total_ttc),
          items:delivery_note_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliveryNotes(data || []);
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501') {
        setDeliveryNotes([]);
        return;
      }
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const createDeliveryNote = async (deliveryData, items = []) => {
    if (!user || !supabase) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const number = deliveryData.delivery_note_number || `DN-${Date.now()}`;

      const { data, error } = await supabase
        .from('delivery_notes')
        .insert([{ ...deliveryData, delivery_note_number: number, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          delivery_note_id: data.id,
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit || 'pcs'
        }));

        const { error: itemError } = await supabase
          .from('delivery_note_items')
          .insert(itemsToInsert);

        if (itemError) throw itemError;
      }

      logAction('create', 'delivery_note', null, data);

      setDeliveryNotes([{ ...data, items }, ...deliveryNotes]);
      toast({ title: t('common.success'), description: t('deliveryNotes.created') });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryNote = async (id, data) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { data: updated, error } = await supabase
        .from('delivery_notes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldDeliveryNote = deliveryNotes.find(dn => dn.id === id);
      logAction('update', 'delivery_note', oldDeliveryNote || null, updated);

      setDeliveryNotes(deliveryNotes.map(dn => dn.id === id ? { ...dn, ...updated } : dn));
      toast({ title: t('common.success'), description: t('deliveryNotes.updated') });
      return updated;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteDeliveryNote = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      await supabase.from('delivery_note_items').delete().eq('delivery_note_id', id);
      const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
      if (error) throw error;

      const deletedDeliveryNote = deliveryNotes.find(dn => dn.id === id);
      logAction('delete', 'delivery_note', deletedDeliveryNote || { id }, null);

      setDeliveryNotes(deliveryNotes.filter(dn => dn.id !== id));
      toast({ title: t('common.success'), description: t('deliveryNotes.deleted') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryNotes();
  }, [user]);

  return {
    deliveryNotes,
    loading,
    error,
    fetchDeliveryNotes,
    createDeliveryNote,
    updateDeliveryNote,
    deleteDeliveryNote
  };
};
