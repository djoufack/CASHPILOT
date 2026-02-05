import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useAnomalyDetection = () => {
  const { user } = useAuth();
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  const detectAnomalies = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-anomaly-detect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );
      const data = await response.json();
      if (data.anomalies) {
        setAnomalies(data.anomalies);
        setLastScan(new Date().toISOString());
      }
    } catch (err) {
      console.error('detectAnomalies error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const dismissAnomaly = useCallback((index) => {
    setAnomalies(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { anomalies, loading, lastScan, detectAnomalies, dismissAnomaly };
};
