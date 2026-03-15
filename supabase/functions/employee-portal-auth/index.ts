import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user } = await requireAuthenticatedUser(req);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createAuthClient(authHeader);

    // Look up portal access for this user
    const { data: portalAccess, error: portalError } = await supabase
      .from('employee_portal_access')
      .select(
        `
        id,
        company_id,
        employee_id,
        access_level,
        is_active,
        last_login_at
      `
      )
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (portalError) {
      throw new HttpError(500, `Failed to query portal access: ${portalError.message}`);
    }

    if (!portalAccess || portalAccess.length === 0) {
      return new Response(
        JSON.stringify({
          authenticated: true,
          has_portal_access: false,
          user_id: user.id,
          message: 'No active employee portal access found for this user.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch employee details for each access record
    const employeeIds = portalAccess.map((a) => a.employee_id);
    const { data: employees, error: empError } = await supabase
      .from('hr_employees')
      .select('id, first_name, last_name, full_name, work_email, job_title, status, hire_date, company_id')
      .in('id', employeeIds);

    if (empError) {
      throw new HttpError(500, `Failed to fetch employee records: ${empError.message}`);
    }

    const employeeMap = new Map((employees || []).map((e) => [e.id, e]));

    // Fetch company names
    const companyIds = [...new Set(portalAccess.map((a) => a.company_id))];
    const { data: companies } = await supabase.from('company').select('id, company_name').in('id', companyIds);

    const companyMap = new Map((companies || []).map((c) => [c.id, c.company_name]));

    // Build permissions response
    const permissions = portalAccess.map((access) => {
      const employee = employeeMap.get(access.employee_id);
      return {
        portal_access_id: access.id,
        company_id: access.company_id,
        company_name: companyMap.get(access.company_id) || null,
        employee_id: access.employee_id,
        employee: employee || null,
        access_level: access.access_level,
        last_login_at: access.last_login_at,
        capabilities: {
          view_own_leaves: true,
          request_leave: true,
          view_own_payslips: true,
          view_own_expenses: true,
          submit_expense: true,
          view_personal_info: true,
          approve_leaves: access.access_level === 'manager' || access.access_level === 'admin',
          approve_expenses: access.access_level === 'manager' || access.access_level === 'admin',
          manage_portal_users: access.access_level === 'admin',
        },
      };
    });

    // Update last_login_at using service client for reliability
    const serviceClient = createServiceClient();
    await serviceClient
      .from('employee_portal_access')
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_active', true);

    return new Response(
      JSON.stringify({
        authenticated: true,
        has_portal_access: true,
        user_id: user.id,
        permissions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
