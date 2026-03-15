import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwtToken = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwtToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing required field: token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the invitation by token
    const { data: invitation, error: inviteError } = await supabase
      .from('accountant_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found or already processed' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase.from('accountant_invitations').update({ status: 'rejected' }).eq('id', invitation.id);

      return new Response(JSON.stringify({ error: 'This invitation has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user's email matches the invitation
    if (user.email?.toLowerCase() !== invitation.accountant_email.toLowerCase()) {
      return new Response(
        JSON.stringify({
          error: 'Email mismatch. Please sign in with the email address the invitation was sent to.',
          expected_email: invitation.accountant_email,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if access already exists
    const { data: existingAccess } = await supabase
      .from('accountant_access')
      .select('id, is_active')
      .eq('accountant_user_id', user.id)
      .eq('company_id', invitation.company_id)
      .maybeSingle();

    if (existingAccess) {
      // Reactivate if inactive, update permissions
      await supabase
        .from('accountant_access')
        .update({
          is_active: true,
          permissions: invitation.permissions,
        })
        .eq('id', existingAccess.id);
    } else {
      // Create new access entry
      const { error: accessError } = await supabase.from('accountant_access').insert({
        accountant_user_id: user.id,
        company_id: invitation.company_id,
        user_id: invitation.user_id,
        permissions: invitation.permissions,
        is_active: true,
      });

      if (accessError) {
        throw accessError;
      }
    }

    // Update the invitation status
    const { error: updateError } = await supabase
      .from('accountant_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      throw updateError;
    }

    // Log to audit
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'accountant_invitation_accepted',
      details: {
        resource: 'accountant_invitation',
        new_data: {
          invitation_id: invitation.id,
          company_id: invitation.company_id,
          owner_user_id: invitation.user_id,
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        company_id: invitation.company_id,
        permissions: invitation.permissions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Accountant accept error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
