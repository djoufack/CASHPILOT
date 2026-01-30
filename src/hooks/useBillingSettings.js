
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

// Mock data for initial UI dev since backend tables might not exist yet
const MOCK_BILLING = {
  company_name: '',
  address: '',
  city: '',
  postal_code: '',
  country: '',
  vat_number: '',
  siret: ''
};

const MOCK_PAYMENT_METHODS = [
  { id: 1, brand: 'Visa', last4: '4242', exp_month: 12, exp_year: 2024, is_default: true }
];

const MOCK_INVOICES = [
  { id: 1, date: '2023-11-01', amount: 29.00, status: 'paid', pdf_url: '#' },
  { id: 2, date: '2023-10-01', amount: 29.00, status: 'paid', pdf_url: '#' }
];

export const useBillingSettings = () => {
  const { user } = useAuth();
  const [billingInfo, setBillingInfo] = useState(MOCK_BILLING);
  const [paymentMethods, setPaymentMethods] = useState(MOCK_PAYMENT_METHODS);
  const [invoices, setInvoices] = useState(MOCK_INVOICES);
  const [subscription, setSubscription] = useState({ plan: 'Pro', price: 29.00, interval: 'month', next_billing: '2023-12-01' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // In a real app, use useEffect to fetch data from Supabase here
  // For now, we simulate fetching

  const updateBilling = async (data) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setBillingInfo(data);
      setLoading(false);
      toast({ title: "Billing Updated", description: "Your billing information has been saved." });
    }, 1000);
  };

  const addPaymentMethod = async (cardDetails) => {
    setLoading(true);
    setTimeout(() => {
      const newCard = { 
        id: Date.now(), 
        brand: 'Mastercard', 
        last4: cardDetails.number.slice(-4), 
        exp_month: 12, 
        exp_year: 2025, 
        is_default: false 
      };
      setPaymentMethods([...paymentMethods, newCard]);
      setLoading(false);
      toast({ title: "Card Added", description: "New payment method added successfully." });
    }, 1000);
  };

  const deletePaymentMethod = async (id) => {
    setPaymentMethods(prev => prev.filter(pm => pm.id !== id));
    toast({ title: "Card Removed", description: "Payment method has been removed." });
  };

  const setDefaultPaymentMethod = async (id) => {
    setPaymentMethods(prev => prev.map(pm => ({ ...pm, is_default: pm.id === id })));
    toast({ title: "Default Updated", description: "Default payment method updated." });
  };

  const cancelSubscription = async () => {
    setLoading(true);
    setTimeout(() => {
        setSubscription(null); // Or status: cancelled
        setLoading(false);
        toast({ title: "Subscription Cancelled", description: "Your subscription has been cancelled." });
    }, 1000);
  };

  return {
    billingInfo,
    paymentMethods,
    invoices,
    subscription,
    loading,
    updateBilling,
    addPaymentMethod,
    deletePaymentMethod,
    setDefaultPaymentMethod,
    cancelSubscription
  };
};
