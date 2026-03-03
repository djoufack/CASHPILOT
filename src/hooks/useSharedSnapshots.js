import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const generateShareToken = () => {
  const random = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const buildSharedSnapshotUrl = (token) => {
  if (typeof window === 'undefined') {
    return `/shared/${token}`;
  }

  return `${window.location.origin}/shared/${token}`;
};

export const useSharedSnapshots = (snapshotType) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    if (!user || !snapshotType) {
      setSnapshots([]);
      return [];
    }

    setLoading(true);
    try {
      let query = supabase
        .from('dashboard_snapshots')
        .select('id, title, share_token, is_public, created_at, expires_at, snapshot_type')
        .eq('user_id', user.id)
        .eq('snapshot_type', snapshotType)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;

      const nextSnapshots = data || [];
      setSnapshots(nextSnapshots);
      return nextSnapshots;
    } catch (error) {
      console.error('Error fetching shared snapshots:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, snapshotType, toast, user]);

  const createSnapshot = useCallback(async ({ title, snapshotData, expiresAt = null }) => {
    if (!user || !snapshotType) return null;

    setLoading(true);
    try {
      const payload = withCompanyScope({
        user_id: user.id,
        snapshot_type: snapshotType,
        title,
        share_token: generateShareToken(),
        snapshot_data: snapshotData,
        is_public: true,
        expires_at: expiresAt,
      });

      const { data, error } = await supabase
        .from('dashboard_snapshots')
        .insert(payload)
        .select('id, title, share_token, is_public, created_at, expires_at, snapshot_type')
        .single();

      if (error) throw error;

      setSnapshots((previous) => [data, ...previous]);
      return data;
    } catch (error) {
      console.error('Error creating shared snapshot:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [snapshotType, toast, user, withCompanyScope]);

  const revokeSnapshot = useCallback(async (snapshotId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('dashboard_snapshots')
        .update({ is_public: false, expires_at: new Date().toISOString() })
        .eq('id', snapshotId);

      if (error) throw error;

      setSnapshots((previous) => previous.map((snapshot) => (
        snapshot.id === snapshotId
          ? { ...snapshot, is_public: false, expires_at: new Date().toISOString() }
          : snapshot
      )));
    } catch (error) {
      console.error('Error revoking shared snapshot:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const snapshotLinks = useMemo(() => snapshots.map((snapshot) => ({
    ...snapshot,
    shareUrl: buildSharedSnapshotUrl(snapshot.share_token),
  })), [snapshots]);

  return {
    snapshots: snapshotLinks,
    loading,
    fetchSnapshots,
    createSnapshot,
    revokeSnapshot,
    buildShareUrl: buildSharedSnapshotUrl,
  };
};
