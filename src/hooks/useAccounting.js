
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useAccounting = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // --- Chart of Accounts ---
  const [accounts, setAccounts] = useState([]);

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .select('*')
        .order('account_code', { ascending: true });
      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, [user]);

  const createAccount = async (accountData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .insert([{ ...accountData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setAccounts(prev => [...prev, data].sort((a, b) => a.account_code.localeCompare(b.account_code)));
      toast({ title: "Success", description: "Account created successfully" });
      return data;
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateAccount = async (id, updates) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setAccounts(prev => prev.map(a => a.id === id ? data : a));
      toast({ title: "Success", description: "Account updated successfully" });
      return data;
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id) => {
    try {
      const { error } = await supabase.from('accounting_chart_of_accounts').delete().eq('id', id);
      if (error) throw error;
      setAccounts(prev => prev.filter(a => a.id !== id));
      toast({ title: "Succès", description: "Compte supprimé" });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const bulkCreateAccounts = async (accountsArray) => {
    if (!user || !accountsArray?.length) return { count: 0 };
    setLoading(true);
    try {
      const payload = accountsArray.map(a => ({
        ...a,
        user_id: user.id
      }));

      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .upsert(payload, { onConflict: 'user_id,account_code', ignoreDuplicates: false })
        .select();

      if (error) throw error;
      await fetchAccounts();
      toast({ title: "Succès", description: `${data?.length || 0} comptes importés` });
      return { count: data?.length || 0 };
    } catch (err) {
      toast({ title: "Erreur d'import", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // --- Mappings ---
  const [mappings, setMappings] = useState([]);

  const fetchMappings = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('accounting_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMappings(data || []);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  const createMapping = async (mappingData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_mappings')
        .insert([{ ...mappingData, user_id: user.id }])
        .select()
        .single();
      if (error) throw error;
      setMappings(prev => [data, ...prev]);
      toast({ title: "Success", description: "Mapping created" });
      return data;
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = async (id, updates) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_mappings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setMappings(prev => prev.map(m => m.id === id ? data : m));
      toast({ title: "Succès", description: "Mapping mis à jour" });
      return data;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deleteMapping = async (id) => {
    try {
      const { error } = await supabase.from('accounting_mappings').delete().eq('id', id);
      if (error) throw error;
      setMappings(prev => prev.filter(m => m.id !== id));
      toast({ title: "Succès", description: "Mapping supprimé" });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // --- Tax Rates ---
  const [taxRates, setTaxRates] = useState([]);

  const fetchTaxRates = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('accounting_tax_rates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTaxRates(data || []);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  const createTaxRate = async (taxData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_tax_rates')
        .insert([{ ...taxData, user_id: user.id }])
        .select()
        .single();
      if (error) throw error;
      setTaxRates(prev => [data, ...prev]);
      toast({ title: "Success", description: "Tax Rate created" });
      return data;
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateTaxRate = async (id, updates) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_tax_rates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setTaxRates(prev => prev.map(t => t.id === id ? data : t));
      toast({ title: "Succès", description: "Taux mis à jour" });
      return data;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deleteTaxRate = async (id) => {
    try {
      const { error } = await supabase.from('accounting_tax_rates').delete().eq('id', id);
      if (error) throw error;
      setTaxRates(prev => prev.filter(t => t.id !== id));
      toast({ title: "Succès", description: "Taux supprimé" });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // --- Entries (Dashboard) ---
  const [entries, setEntries] = useState([]);
  
  const fetchEntries = useCallback(async () => {
    if(!user) return;
    try {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
       console.error(err);
    }
  }, [user]);

  return {
    loading,
    accounts, fetchAccounts, createAccount, updateAccount, deleteAccount, bulkCreateAccounts,
    mappings, fetchMappings, createMapping, updateMapping, deleteMapping,
    taxRates, fetchTaxRates, createTaxRate, updateTaxRate, deleteTaxRate,
    entries, fetchEntries
  };
};
