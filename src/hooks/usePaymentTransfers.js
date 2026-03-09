import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export function usePaymentTransfers() {
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTransfers = useCallback(async (filters = {}) => {
    if (!user) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('payment_transfers')
        .select('*, source:company_payment_instruments!payment_transfers_source_instrument_id_fkey(id, label, instrument_type, currency), destination:company_payment_instruments!payment_transfers_destination_instrument_id_fkey(id, label, instrument_type, currency)')
        .eq('user_id', user.id)
        .order('transfer_date', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });
      if (filters.source_instrument_id) {
        query = query.eq('source_instrument_id', filters.source_instrument_id);
      }
      if (filters.destination_instrument_id) {
        query = query.eq('destination_instrument_id', filters.destination_instrument_id);
      }
      if (filters.date_from) {
        query = query.gte('transfer_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('transfer_date', filters.date_to);
      }
      const { data, error } = await query;
      if (error) throw error;
      setTransfers(data || []);
      return data || [];
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, applyCompanyScope, toast, t]);

  const createTransfer = useCallback(async (transferData) => {
    if (!user) return null;
    try {
      const {
        source_instrument_id,
        destination_instrument_id,
        amount,
        currency,
        fee_amount = 0,
        fee_instrument_id,
        transfer_date,
        description,
        reference,
      } = transferData;

      if (source_instrument_id === destination_instrument_id) {
        toast({ variant: 'destructive', title: t('common.error'), description: t('financialInstruments.sameInstrumentError') });
        return null;
      }

      // Generate transfer_group_id
      const transferGroupId = crypto.randomUUID();

      // 1. Create outflow transaction on source instrument
      const outflowPayload = withCompanyScope({
        payment_instrument_id: source_instrument_id,
        transaction_kind: 'transfer_out',
        flow_direction: 'outflow',
        amount,
        currency,
        transaction_date: transfer_date || new Date().toISOString().split('T')[0],
        description: description || 'Transfer out',
        reference,
        transfer_group_id: transferGroupId,
        status: 'completed',
        user_id: user.id,
      });
      const { data: outflowTx, error: outErr } = await supabase
        .from('payment_transactions')
        .insert([outflowPayload])
        .select()
        .single();
      if (outErr) throw outErr;

      // 2. Create inflow transaction on destination instrument
      const inflowPayload = withCompanyScope({
        payment_instrument_id: destination_instrument_id,
        transaction_kind: 'transfer_in',
        flow_direction: 'inflow',
        amount,
        currency,
        transaction_date: transfer_date || new Date().toISOString().split('T')[0],
        description: description || 'Transfer in',
        reference,
        transfer_group_id: transferGroupId,
        status: 'completed',
        user_id: user.id,
      });
      const { data: inflowTx, error: inErr } = await supabase
        .from('payment_transactions')
        .insert([inflowPayload])
        .select()
        .single();
      if (inErr) throw inErr;

      // 3. If fee_amount > 0, create fee transaction
      let feeTx = null;
      if (fee_amount > 0) {
        const feePayload = withCompanyScope({
          payment_instrument_id: fee_instrument_id || source_instrument_id,
          transaction_kind: 'fee',
          flow_direction: 'outflow',
          amount: fee_amount,
          currency,
          transaction_date: transfer_date || new Date().toISOString().split('T')[0],
          description: 'Transfer fee',
          reference,
          transfer_group_id: transferGroupId,
          status: 'completed',
          user_id: user.id,
        });
        const { data: feeData, error: feeErr } = await supabase
          .from('payment_transactions')
          .insert([feePayload])
          .select()
          .single();
        if (feeErr) throw feeErr;
        feeTx = feeData;
      }

      // 4. Create payment_transfers record
      const transferPayload = withCompanyScope({
        source_instrument_id,
        destination_instrument_id,
        amount,
        currency,
        fee_amount,
        transfer_date: transfer_date || new Date().toISOString().split('T')[0],
        description,
        reference,
        transfer_group_id: transferGroupId,
        outflow_transaction_id: outflowTx.id,
        inflow_transaction_id: inflowTx.id,
        fee_transaction_id: feeTx?.id || null,
        status: 'completed',
        user_id: user.id,
      });
      const { data: transfer, error: transferErr } = await supabase
        .from('payment_transfers')
        .insert([transferPayload])
        .select()
        .single();
      if (transferErr) throw transferErr;

      toast({ title: t('common.success'), description: t('financialInstruments.transferCreated') });
      return transfer;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, withCompanyScope, toast, t]);

  const cancelTransfer = useCallback(async (transferId) => {
    if (!user) return false;
    try {
      // Get the transfer to find linked transactions
      const { data: transfer, error: fetchErr } = await supabase
        .from('payment_transfers')
        .select('*')
        .eq('id', transferId)
        .eq('user_id', user.id)
        .single();
      if (fetchErr) throw fetchErr;

      // Cancel all linked transactions
      const txIds = [
        transfer.outflow_transaction_id,
        transfer.inflow_transaction_id,
        transfer.fee_transaction_id,
      ].filter(Boolean);

      if (txIds.length > 0) {
        await supabase
          .from('payment_transactions')
          .update({ status: 'cancelled' })
          .in('id', txIds)
          .eq('user_id', user.id);
      }

      // Cancel the transfer itself
      const { error } = await supabase
        .from('payment_transfers')
        .update({ status: 'cancelled' })
        .eq('id', transferId)
        .eq('user_id', user.id);
      if (error) throw error;

      toast({ title: t('common.success'), description: t('financialInstruments.transferCancelled') });
      await fetchTransfers();
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return false;
    }
  }, [user, fetchTransfers, toast, t]);

  return { transfers, loading, fetchTransfers, createTransfer, cancelTransfer };
}
