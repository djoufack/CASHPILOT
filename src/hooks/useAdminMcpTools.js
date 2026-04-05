import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

const TABLE = 'mcp_tools_registry';

const sortTools = (rows) =>
  [...rows].sort((a, b) => {
    const byCategory = String(a.category || '').localeCompare(String(b.category || ''));
    if (byCategory !== 0) return byCategory;
    return String(a.tool_name || '').localeCompare(String(b.tool_name || ''));
  });

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((entry) => String(entry || '').trim()).filter(Boolean))];
};

const normalizePayload = (payload = {}) => ({
  tool_name: String(payload.tool_name || '').trim(),
  display_name: String(payload.display_name || '').trim(),
  category: String(payload.category || 'general').trim() || 'general',
  source_module: String(payload.source_module || 'manual').trim() || 'manual',
  description: String(payload.description || '').trim(),
  is_active: payload.is_active !== false,
  is_generated: Boolean(payload.is_generated),
  tags: normalizeTags(payload.tags),
  metadata:
    payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {},
});

export function useAdminMcpTools() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!supabase || !user?.id) {
      setTools([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from(TABLE)
        .select('*')
        .order('category', { ascending: true })
        .order('tool_name', { ascending: true });
      if (fetchError) throw fetchError;

      setTools(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.message || 'Impossible de charger le registre MCP tools.';
      setError(message);
      toast({
        title: 'Erreur registre MCP',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.id]);

  const createTool = useCallback(
    async (payload) => {
      if (!supabase || !user?.id) {
        throw new Error('Session admin manquante.');
      }

      const normalized = normalizePayload(payload);
      if (!normalized.tool_name) {
        throw new Error('Le nom technique du tool est requis.');
      }

      const row = {
        ...normalized,
        user_id: user.id,
        last_changed_at: new Date().toISOString(),
        last_changed_by: user.id,
      };

      const { data, error: insertError } = await supabase.from(TABLE).insert(row).select('*').single();
      if (insertError) throw insertError;

      setTools((current) => sortTools([data, ...current]));
      await logAction('admin_mcp_tool_create', TABLE, null, data, { source: 'admin-mcp-tools' });

      return data;
    },
    [logAction, user?.id]
  );

  const updateTool = useCallback(
    async (toolId, updates) => {
      if (!supabase || !toolId || !user?.id) {
        throw new Error('Mise à jour impossible: contexte incomplet.');
      }

      const previous = tools.find((entry) => entry.id === toolId) || null;
      const normalized = normalizePayload({ ...(previous || {}), ...updates });

      if (!normalized.tool_name) {
        throw new Error('Le nom technique du tool est requis.');
      }

      const payload = {
        ...normalized,
        last_changed_at: new Date().toISOString(),
        last_changed_by: user.id,
      };

      const { data, error: updateError } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', toolId)
        .select('*')
        .single();
      if (updateError) throw updateError;

      setTools((current) => sortTools(current.map((entry) => (entry.id === toolId ? data : entry))));
      await logAction('admin_mcp_tool_update', TABLE, previous || { id: toolId }, data, { source: 'admin-mcp-tools' });

      return data;
    },
    [logAction, tools, user?.id]
  );

  const deleteTool = useCallback(
    async (toolId) => {
      if (!supabase || !toolId) {
        throw new Error('Suppression impossible: contexte incomplet.');
      }

      const previous = tools.find((entry) => entry.id === toolId) || null;

      const { error: deleteError } = await supabase.from(TABLE).delete().eq('id', toolId);
      if (deleteError) throw deleteError;

      setTools((current) => current.filter((entry) => entry.id !== toolId));
      await logAction('admin_mcp_tool_delete', TABLE, previous || { id: toolId }, null, { source: 'admin-mcp-tools' });
    },
    [logAction, tools]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const total = tools.length;
    const active = tools.filter((entry) => entry.is_active).length;
    const generated = tools.filter((entry) => entry.is_generated).length;
    const categories = new Set(tools.map((entry) => entry.category).filter(Boolean)).size;

    return { total, active, generated, categories };
  }, [tools]);

  return {
    tools,
    stats,
    loading,
    error,
    refresh,
    createTool,
    updateTool,
    deleteTool,
  };
}

export default useAdminMcpTools;
