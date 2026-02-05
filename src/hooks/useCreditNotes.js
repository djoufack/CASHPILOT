import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

export const useCreditNotes = () => {
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const fetchCreditNotes = async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          client:clients(id, company_name, contact_name, email, preferred_currency),
          invoice:invoices(id, invoice_number, total_ttc),
          items:credit_note_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCreditNotes(data || []);
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501') {
        setCreditNotes([]);
        return;
      }
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const createCreditNote = async (creditNoteData, items = []) => {
    if (!user || !supabase) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const number = creditNoteData.credit_note_number || `CN-${Date.now()}`;

      const { data, error } = await supabase
        .from('credit_notes')
        .insert([{ ...creditNoteData, credit_note_number: number, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      // Insert items if any
      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          credit_note_id: data.id,
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice || item.unit_price),
          amount: Number(item.quantity) * Number(item.unitPrice || item.unit_price)
        }));

        const { error: itemError } = await supabase
          .from('credit_note_items')
          .insert(itemsToInsert);

        if (itemError) throw itemError;
      }

      logAction('create', 'credit_note', null, data);

      setCreditNotes([{ ...data, items }, ...creditNotes]);
      toast({ title: t('common.success'), description: t('creditNotes.created') });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCreditNote = async (id, data) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { data: updated, error } = await supabase
        .from('credit_notes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldCreditNote = creditNotes.find(cn => cn.id === id);
      logAction('update', 'credit_note', oldCreditNote || null, updated);

      setCreditNotes(creditNotes.map(cn => cn.id === id ? { ...cn, ...updated } : cn));
      toast({ title: t('common.success'), description: t('creditNotes.updated') });
      return updated;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCreditNote = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      // Delete items first
      await supabase.from('credit_note_items').delete().eq('credit_note_id', id);
      const { error } = await supabase.from('credit_notes').delete().eq('id', id);
      if (error) throw error;

      const deletedCreditNote = creditNotes.find(cn => cn.id === id);
      logAction('delete', 'credit_note', deletedCreditNote || { id }, null);

      setCreditNotes(creditNotes.filter(cn => cn.id !== id));
      toast({ title: t('common.success'), description: t('creditNotes.deleted') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, [user]);

  return {
    creditNotes,
    loading,
    error,
    fetchCreditNotes,
    createCreditNote,
    updateCreditNote,
    deleteCreditNote
  };
};
