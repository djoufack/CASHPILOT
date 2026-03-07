import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const APPROVER_ROLES = ['admin', 'accountant'];

type SupplierInvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  total_ttc: number | null;
  approval_status: string | null;
  company_id: string | null;
  supplier_name_extracted: string | null;
  supplier?: { company_name?: string | null } | null;
};

const normalizeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const insertNotifications = async (
  supabase: ReturnType<typeof createClient>,
  rows: Array<Record<string, unknown>>,
) => {
  const minimalRows = rows.map((row) => ({
    user_id: row.user_id,
    type: row.type,
    message: row.message,
  }));

  const attempts: Array<Array<Record<string, unknown>>> = [
    rows.map((row) => ({ ...row, is_read: false })),
    rows.map((row) => ({ ...row, read: false })),
    minimalRows,
    minimalRows.map((row) => ({ ...row, is_read: false })),
    minimalRows.map((row) => ({ ...row, read: false })),
  ];

  let lastError: unknown = null;
  for (const payload of attempts) {
    const { error } = await supabase.from('notifications').insert(payload);
    if (!error) return;
    lastError = error;
  }

  throw lastError;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment is not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.invoiceId || '').trim();
    const action = String(body?.action || 'pending_created').trim();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('supplier_invoices')
      .select(`
        id,
        invoice_number,
        invoice_date,
        total_amount,
        total_ttc,
        approval_status,
        company_id,
        supplier_name_extracted,
        supplier:suppliers(company_name)
      `)
      .eq('id', invoiceId)
      .single<SupplierInvoiceRow>();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Supplier invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: actorCompanyId } = await supabase.rpc('resolve_preferred_company_id', { p_user_id: user.id });
    if (invoice.company_id && actorCompanyId && actorCompanyId !== invoice.company_id) {
      return new Response(JSON.stringify({ error: 'Forbidden: cross-company access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipients = new Set<string>();
    if (invoice.company_id) {
      const { data: companyOwner } = await supabase
        .from('company')
        .select('user_id')
        .eq('id', invoice.company_id)
        .maybeSingle<{ user_id?: string | null }>();

      if (companyOwner?.user_id && companyOwner.user_id !== user.id) {
        recipients.add(companyOwner.user_id);
      }
    }

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', APPROVER_ROLES);

    for (const roleRow of roleRows || []) {
      if (!roleRow?.user_id || roleRow.user_id === user.id) continue;

      const { data: roleCompanyId } = await supabase.rpc('resolve_preferred_company_id', {
        p_user_id: roleRow.user_id,
      });

      if (!invoice.company_id || roleCompanyId === invoice.company_id) {
        recipients.add(roleRow.user_id);
      }
    }

    const recipientIds = Array.from(recipients);
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notifiedUsers: 0, emailedUsers: 0, reason: 'no_targets' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supplierName = invoice.supplier?.company_name || invoice.supplier_name_extracted || 'Supplier';
    const amount = normalizeAmount(invoice.total_ttc ?? invoice.total_amount);
    const invoiceLabel = invoice.invoice_number || invoice.id;

    const title = 'Supplier approval required';
    const message = `Invoice ${invoiceLabel} (${supplierName}) is pending approval for ${amount.toFixed(2)} EUR.`;

    await insertNotifications(
      supabase,
      recipientIds.map((recipientId) => ({
        user_id: recipientId,
        type: 'supplier_approval_pending',
        title,
        message,
      })),
    );

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    let emailedUsers = 0;
    if (resendApiKey) {
      const emails: string[] = [];
      for (const recipientId of recipientIds) {
        const { data: recipientUser, error: recipientUserError } = await supabase.auth.admin.getUserById(recipientId);
        if (recipientUserError) continue;
        const email = recipientUser?.user?.email;
        if (email) emails.push(email);
      }

      const uniqueEmails = Array.from(new Set(emails));
      if (uniqueEmails.length > 0) {
        const subject = `[CashPilot] ${title}`;
        const html = `
          <p>Hello,</p>
          <p>${message}</p>
          <p>Action: <strong>${action}</strong></p>
          <p>Date: ${new Date().toISOString()}</p>
        `;

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CashPilot <noreply@cashpilot.app>',
            to: uniqueEmails,
            subject,
            html,
            text: `${message}\nAction: ${action}`,
          }),
        });

        if (resendResponse.ok) {
          emailedUsers = uniqueEmails.length;
        } else {
          const resendErrorText = await resendResponse.text();
          console.error('[supplier-approval-notifications] resend_error', resendErrorText);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifiedUsers: recipientIds.length,
        emailedUsers,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[supplier-approval-notifications] error', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
