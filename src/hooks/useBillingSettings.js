
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const EMPTY_BILLING = {
  company_name: '',
  address: '',
  city: '',
  postal_code: '',
  country: '',
  vat_number: '',
  siret: ''
};

export const useBillingSettings = () => {
  const { user } = useAuth();
  const [billingInfo, setBillingInfo] = useState(EMPTY_BILLING);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbRecord, setDbRecord] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchBilling();
  }, [user]);

  const fetchBilling = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billing_info')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDbRecord(data);
        setBillingInfo({
          company_name: data.company_name || '',
          address: data.address || '',
          city: data.city || '',
          postal_code: data.postal_code || '',
          country: data.country || '',
          vat_number: data.vat_number || '',
          siret: data.siret || ''
        });
        if (data.plan && data.plan !== 'free') {
          setSubscription({
            plan: data.plan,
            price: data.plan_price || 0,
            interval: data.plan_interval || 'month',
            next_billing: data.next_billing_date || ''
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching billing info:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateBilling = async (data) => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const payload = { ...data, user_id: user.id };

      if (dbRecord?.id) {
        const { data: updated, error } = await supabase
          .from('billing_info')
          .update(payload)
          .eq('id', dbRecord.id)
          .select()
          .single();
        if (error) throw error;
        setDbRecord(updated);
      } else {
        const { data: created, error } = await supabase
          .from('billing_info')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setDbRecord(created);
      }

      setBillingInfo(data);
      toast({ title: "Facturation mise à jour", description: "Vos informations de facturation ont été sauvegardées." });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!dbRecord?.id || !supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('billing_info')
        .update({ plan: 'free', plan_price: 0, next_billing_date: null })
        .eq('id', dbRecord.id);

      if (error) throw error;

      setSubscription(null);
      toast({ title: "Abonnement annulé", description: "Votre abonnement a été annulé." });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return {
    billingInfo,
    paymentMethods: [],
    invoices: [],
    subscription,
    loading,
    updateBilling,
    addPaymentMethod: async () => { toast({ title: "Info", description: "L'intégration de paiement sera disponible prochainement." }); },
    deletePaymentMethod: async () => {},
    setDefaultPaymentMethod: async () => {},
    cancelSubscription
  };
};
