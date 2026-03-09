import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export function usePaymentInstruments() {
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope, activeCompanyId } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInstruments = useCallback(async (filters = {}) => {
    if (!user) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('company_payment_instruments')
        .select('*, payment_instrument_bank_accounts(*), payment_instrument_cards(*), payment_instrument_cash_accounts(*)')
        .eq('user_id', user.id)
        .order('label');
      query = applyCompanyScope(query, { includeUnassigned: false });
      if (filters.type) query = query.eq('instrument_type', filters.type);
      if (filters.status) query = query.eq('status', filters.status);
      else query = query.neq('status', 'archived');
      const { data, error } = await query;
      if (error) throw error;
      setInstruments(data || []);
      return data || [];
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, applyCompanyScope, toast, t]);

  const createInstrument = useCallback(async (instrumentData) => {
    if (!user) return null;
    try {
      const { bank_details, card_details, cash_details, ...hubData } = instrumentData;
      // Generate code
      const code = `${hubData.instrument_type}-${hubData.label.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}-${(activeCompanyId || '').substring(0, 8)}`;
      // Auto-generate account_code if not provided
      let accountCode = hubData.account_code;
      if (!accountCode) {
        const { data: codeData } = await supabase.rpc('generate_instrument_account_code', {
          p_company_id: activeCompanyId,
          p_instrument_type: hubData.instrument_type,
        });
        accountCode = codeData;
      }
      const journalCode = hubData.journal_code || (hubData.instrument_type === 'cash' ? 'CA' : 'BQ');
      const payload = withCompanyScope({
        ...hubData,
        code,
        account_code: accountCode,
        journal_code: journalCode,
        user_id: user.id,
        current_balance: hubData.opening_balance || 0,
      });
      const { data: instrument, error } = await supabase
        .from('company_payment_instruments')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      // Insert detail table
      if (hubData.instrument_type === 'bank_account' && bank_details) {
        const ibanMasked = bank_details.iban ? '****' + bank_details.iban.slice(-4) : null;
        await supabase.from('payment_instrument_bank_accounts').insert([{
          instrument_id: instrument.id,
          ...bank_details,
          iban_masked: ibanMasked,
          iban_encrypted: bank_details.iban || null,
        }]);
      } else if (hubData.instrument_type === 'card' && card_details) {
        await supabase.from('payment_instrument_cards').insert([{
          instrument_id: instrument.id,
          ...card_details,
        }]);
      } else if (hubData.instrument_type === 'cash' && cash_details) {
        await supabase.from('payment_instrument_cash_accounts').insert([{
          instrument_id: instrument.id,
          ...cash_details,
        }]);
      }
      toast({ title: t('common.success'), description: t('financialInstruments.created') });
      await fetchInstruments();
      return instrument;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, activeCompanyId, withCompanyScope, fetchInstruments, toast, t]);

  const updateInstrument = useCallback(async (id, updates) => {
    if (!user) return null;
    try {
      const { bank_details, card_details, cash_details, ...hubUpdates } = updates;
      const { data, error } = await supabase
        .from('company_payment_instruments')
        .update(hubUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      if (bank_details) {
        await supabase.from('payment_instrument_bank_accounts').upsert({ instrument_id: id, ...bank_details });
      }
      if (card_details) {
        await supabase.from('payment_instrument_cards').upsert({ instrument_id: id, ...card_details });
      }
      if (cash_details) {
        await supabase.from('payment_instrument_cash_accounts').upsert({ instrument_id: id, ...cash_details });
      }
      toast({ title: t('common.success'), description: t('common.updated') });
      await fetchInstruments();
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, fetchInstruments, toast, t]);

  const deleteInstrument = useCallback(async (id, force = false) => {
    if (!user) return false;
    try {
      if (!force) {
        const { count } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('payment_instrument_id', id);
        if (count > 0) {
          toast({
            variant: 'destructive',
            title: t('common.error'),
            description: `Instrument linked to ${count} transactions. Use force=true to archive.`,
          });
          return false;
        }
      }
      if (force) {
        await supabase
          .from('company_payment_instruments')
          .update({ status: 'archived', archived_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);
      } else {
        const { error } = await supabase
          .from('company_payment_instruments')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      toast({ title: t('common.success'), description: t('common.deleted') });
      await fetchInstruments();
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return false;
    }
  }, [user, fetchInstruments, toast, t]);

  return { instruments, loading, fetchInstruments, createInstrument, updateInstrument, deleteInstrument };
}
