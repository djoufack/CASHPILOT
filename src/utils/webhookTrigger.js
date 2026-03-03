import { supabase } from '@/lib/supabase';

/**
 * Trigger a webhook event silently (never throws, never blocks the caller).
 * @param {string} event - Event name like 'invoice.created'
 * @param {object} payload - Event payload data
 */
export async function triggerWebhook(event, payload) {
  try {
    await supabase.functions.invoke('webhooks', {
      body: { event, payload },
    });
  } catch (err) {
    // Webhooks must never block the main action
    console.warn('[webhook] trigger failed silently:', event, err?.message);
  }
}
