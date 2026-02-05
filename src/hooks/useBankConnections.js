import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useBankConnections = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setConnections(data || []);
    } catch (err) {
      console.error('fetchConnections error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const initiateConnection = async (institutionId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gocardless-auth`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create-requisition',
            userId: user.id,
            institutionId,
            redirectUrl: `${window.location.origin}/app/bank-callback`,
          }),
        }
      );
      const data = await response.json();
      if (data.link) {
        window.open(data.link, '_blank');
      }
      return data;
    } catch (err) {
      console.error('initiateConnection error:', err);
      throw err;
    }
  };

  const completeConnection = async (requisitionId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gocardless-auth`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'complete-requisition',
            userId: user.id,
            requisitionId,
          }),
        }
      );
      const data = await response.json();
      await fetchConnections();
      return data;
    } catch (err) {
      console.error('completeConnection error:', err);
      throw err;
    }
  };

  const disconnectBank = async (connectionId) => {
    try {
      await supabase
        .from('bank_connections')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', connectionId)
        .eq('user_id', user.id);
      await fetchConnections();
    } catch (err) {
      console.error('disconnectBank error:', err);
      throw err;
    }
  };

  const totalBalance = connections
    .filter(c => c.status === 'active' && c.account_balance != null)
    .reduce((sum, c) => sum + parseFloat(c.account_balance), 0);

  return {
    connections,
    loading,
    initiateConnection,
    completeConnection,
    disconnectBank,
    totalBalance,
    refresh: fetchConnections,
  };
};
