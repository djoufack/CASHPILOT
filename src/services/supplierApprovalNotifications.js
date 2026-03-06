import { supabase } from '@/lib/supabase';

/**
 * Notify finance approvers when a supplier invoice requires approval.
 * Errors are surfaced to the caller so UI can decide between blocking/non-blocking behavior.
 */
export const notifyPendingSupplierApproval = async ({ invoiceId, action = 'pending_created' }) => {
  if (!invoiceId) {
    throw new Error('invoiceId is required');
  }

  const { data, error } = await supabase.functions.invoke('supplier-approval-notifications', {
    body: {
      invoiceId,
      action,
    },
  });

  if (error) throw error;
  return data || { success: true, notifiedUsers: 0, emailedUsers: 0 };
};

export default {
  notifyPendingSupplierApproval,
};
