import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { safeError } from '../utils/errors.js';

export function registerMobileMoneyTools(server: McpServer) {
  server.tool(
    'send_mobile_money_payment',
    'Initiate a Mobile Money payment for an invoice (Orange Money, MTN MoMo, Wave, M-Pesa, Moov Money)',
    {
      invoice_id: z.string().describe('Invoice UUID'),
      provider: z.enum(['orange_money', 'mtn_momo', 'mpesa', 'wave', 'moov_money']).describe('Mobile Money provider'),
      phone_number: z.string().describe('Recipient phone number (with country code, e.g. +237...)'),
      amount: z.number().min(0).describe('Payment amount'),
      currency: z.string().optional().describe('Currency code (default XAF)'),
      company_id: z.string().describe('Company UUID'),
    },
    async ({ invoice_id, provider, phone_number, amount, currency, company_id }) => {
      try {
        // Create transaction record
        const { data: txn, error: txnErr } = await supabase
          .from('mobile_money_transactions')
          .insert({
            user_id: getUserId(),
            company_id,
            invoice_id,
            provider,
            phone_number,
            amount,
            currency: currency ?? 'XAF',
            status: 'processing',
            metadata: { initiated_by: 'mcp_tool' },
          })
          .select('id')
          .single();

        if (txnErr)
          return { content: [{ type: 'text' as const, text: safeError(txnErr, 'initiate mobile money payment') }] };

        // Simulate payment processing
        const externalRef = `${provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const isSuccess = Math.random() < 0.9;

        await supabase
          .from('mobile_money_transactions')
          .update({
            status: isSuccess ? 'completed' : 'failed',
            external_ref: externalRef,
            error_message: isSuccess ? null : 'Simulated failure',
            completed_at: isSuccess ? new Date().toISOString() : null,
          })
          .eq('id', txn.id);

        if (isSuccess) {
          // Get invoice client_id for payment record
          const { data: invoice } = await supabase
            .from('invoices')
            .select('client_id')
            .eq('id', invoice_id)
            .eq('user_id', getUserId())
            .single();

          if (invoice) {
            await supabase.from('payments').insert({
              user_id: getUserId(),
              company_id,
              invoice_id,
              client_id: invoice.client_id,
              amount,
              payment_method: `mobile_money_${provider}`,
              payment_date: new Date().toISOString().split('T')[0],
              reference: externalRef,
              notes: `Mobile Money payment via ${provider} - ${phone_number}`,
              receipt_number: `MM-${Date.now()}`,
            });
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  transaction_id: txn.id,
                  status: isSuccess ? 'completed' : 'failed',
                  external_ref: externalRef,
                  provider,
                  amount,
                  currency: currency ?? 'XAF',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: safeError(err, 'send_mobile_money_payment') }] };
      }
    }
  );

  server.tool(
    'get_mobile_money_status',
    'Get the status of a Mobile Money transaction',
    {
      transaction_id: z.string().describe('Transaction UUID'),
    },
    async ({ transaction_id }) => {
      const { data, error } = await supabase
        .from('mobile_money_transactions')
        .select('*')
        .eq('id', transaction_id)
        .eq('user_id', getUserId())
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'get mobile money status') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'send_whatsapp_invoice',
    'Send an invoice via WhatsApp with a Mobile Money payment link',
    {
      invoice_id: z.string().describe('Invoice UUID'),
      phone_number: z.string().describe('WhatsApp phone number (with country code)'),
      company_id: z.string().describe('Company UUID'),
      message_type: z
        .enum(['invoice', 'reminder', 'payment_confirmation'])
        .optional()
        .describe('Message type (default invoice)'),
    },
    async ({ invoice_id, phone_number, company_id, message_type }) => {
      try {
        // Get invoice details
        const { data: invoice, error: invErr } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_ttc, due_date, currency, client:clients(id, company_name, contact_name)')
          .eq('id', invoice_id)
          .eq('user_id', getUserId())
          .single();

        if (invErr || !invoice) {
          return {
            content: [{ type: 'text' as const, text: `Invoice not found: ${invErr?.message ?? 'unknown error'}` }],
          };
        }

        // Generate payment link token
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let token = '';
        for (let i = 0; i < 24; i++) {
          token += chars[Math.floor(Math.random() * chars.length)];
        }

        // Get active providers
        const { data: providers } = await supabase
          .from('mobile_money_providers')
          .select('provider_name')
          .eq('user_id', getUserId())
          .eq('company_id', company_id)
          .eq('is_active', true);

        const providerNames = (providers ?? []).map((p: { provider_name: string }) => p.provider_name);

        // Create payment link
        await supabase.from('mobile_payment_links').insert({
          user_id: getUserId(),
          company_id,
          invoice_id,
          token,
          providers_available: providerNames,
          amount: invoice.total_ttc,
          currency: invoice.currency ?? 'XAF',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const type = message_type ?? 'invoice';
        const clientName = invoice.client?.company_name ?? invoice.client?.contact_name ?? 'Client';
        const formattedAmount = `${invoice.total_ttc} ${invoice.currency ?? 'XAF'}`;
        const paymentUrl = `https://cashpilot.tech/pay/${token}`;

        // Record WhatsApp message
        const externalId = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const content = `Facture ${invoice.invoice_number} - ${formattedAmount} - Payer: ${paymentUrl}`;

        const { data: msg, error: msgErr } = await supabase
          .from('whatsapp_messages')
          .insert({
            user_id: getUserId(),
            company_id,
            invoice_id,
            client_id: invoice.client?.id ?? null,
            phone_number,
            message_type: type,
            content,
            status: 'sent',
            external_id: externalId,
            sent_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (msgErr) {
          return { content: [{ type: 'text' as const, text: safeError(msgErr, 'send whatsapp invoice') }] };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message_id: msg.id,
                  status: 'sent',
                  payment_link: paymentUrl,
                  client: clientName,
                  invoice_number: invoice.invoice_number,
                  amount: formattedAmount,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: safeError(err, 'send_whatsapp_invoice') }] };
      }
    }
  );
}
