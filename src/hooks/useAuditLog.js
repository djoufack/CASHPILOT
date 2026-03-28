import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

const normalizeAction = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const resolveAdminSeverity = (action) => {
  const normalized = normalizeAction(action);
  if (normalized.includes('delete') || normalized.includes('role') || normalized.includes('security')) {
    return 'critical';
  }
  if (normalized.includes('archive') || normalized.includes('disable') || normalized.includes('restore')) {
    return 'warning';
  }
  return 'info';
};

export const useAuditLog = () => {
  const { user } = useAuth();
  const activeCompanyId = useActiveCompanyId();

  const logAction = async (action, resource, oldData, newData, options = {}) => {
    if (!user || !supabase) return;

    try {
      const normalizedAction = normalizeAction(action);
      const isAdminAction = normalizedAction.startsWith('admin_');
      const correlationId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : undefined;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action,
        details: {
          resource,
          old_data: oldData ?? null,
          new_data: newData ?? null,
          correlation_id: correlationId || null,
        },
      });

      if (isAdminAction && activeCompanyId) {
        const tracePayload = {
          user_id: user.id,
          company_id: activeCompanyId,
          action,
          resource: String(resource || 'unknown'),
          severity: resolveAdminSeverity(action),
          operation_status: options.operationStatus || 'success',
          correlation_id: correlationId,
          old_data: oldData ?? null,
          new_data: newData ?? null,
          metadata: {
            source: options.source || 'ui',
            note: options.note || null,
          },
        };

        await supabase.from('admin_operation_traces').insert(tracePayload);
      }
    } catch (err) {
      console.error('Failed to create audit log:', err);
    }
  };

  return { logAction };
};
