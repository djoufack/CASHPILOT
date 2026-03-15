import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createAuthClient,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
} from '../_shared/billing.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const CREDIT_COST = 2;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_MESSAGES = 10;
const HR_RATE_LIMIT = { maxRequests: 40, windowMs: 15 * 60 * 1000, keyPrefix: 'ai-hr-chatbot' };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HrAction = 'get_leave_balance' | 'request_leave' | 'get_payslip_info' | 'ask_hr_faq' | 'chat';

interface HrRequest {
  action: HrAction;
  message: string;
  employee_id?: string;
  leave_type_id?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  context?: Array<{ role: string; content: string }>;
}

const sanitize = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim();
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveActiveCompanyId = async (
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  requestedCompanyId: unknown
): Promise<string | null> => {
  if (typeof requestedCompanyId === 'string' && UUID_REGEX.test(requestedCompanyId)) {
    return requestedCompanyId;
  }
  const { data } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.active_company_id || null;
};

const resolveEmployeeId = async (
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  companyId: string | null
): Promise<string | null> => {
  let query = supabase
    .from('hr_employees')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (companyId) query = query.eq('company_id', companyId);
  const { data } = await query;
  return data?.id || null;
};

// ---- Action handlers ----

const handleGetLeaveBalance = async (
  supabase: ReturnType<typeof createAuthClient>,
  employeeId: string,
  companyId: string | null
) => {
  let query = supabase
    .from('hr_leave_requests')
    .select('id, leave_type_id, start_date, end_date, total_days, status, hr_leave_types(name, is_paid)')
    .eq('employee_id', employeeId)
    .in('status', ['approved', 'validated']);
  if (companyId) query = query.eq('company_id', companyId);
  const { data: usedLeaves, error } = await query;

  if (error) throw new HttpError(500, `Failed to fetch leave data: ${error.message}`);

  const leavesByType: Record<string, { name: string; is_paid: boolean; used_days: number }> = {};
  for (const lr of usedLeaves || []) {
    const leaveType = (lr as any).hr_leave_types;
    const typeName = leaveType?.name || 'Inconnu';
    if (!leavesByType[typeName]) {
      leavesByType[typeName] = { name: typeName, is_paid: leaveType?.is_paid ?? true, used_days: 0 };
    }
    leavesByType[typeName].used_days += toNumber(lr.total_days);
  }

  // Fetch leave types for the company to show all categories
  let typesQuery = supabase.from('hr_leave_types').select('id, name, is_paid');
  if (companyId) typesQuery = typesQuery.eq('company_id', companyId);
  const { data: leaveTypes } = await typesQuery;

  const balances = (leaveTypes || []).map((lt) => {
    const used = leavesByType[lt.name]?.used_days || 0;
    return {
      leave_type: lt.name,
      is_paid: lt.is_paid,
      used_days: used,
      // Note: statutory annual allowance defaults; real allocation table would override
      statutory_allowance: lt.is_paid ? 25 : null,
      remaining: lt.is_paid ? Math.max(0, 25 - used) : null,
    };
  });

  return {
    success: true,
    data: { employee_id: employeeId, balances },
    message: `Soldes de conges recuperes (${balances.length} type(s)).`,
  };
};

const handleRequestLeave = async (
  supabase: ReturnType<typeof createAuthClient>,
  employeeId: string,
  companyId: string | null,
  payload: HrRequest
) => {
  const { leave_type_id, start_date, end_date, reason } = payload;
  if (!leave_type_id || !start_date || !end_date) {
    throw new HttpError(400, 'leave_type_id, start_date et end_date sont requis.');
  }
  if (!UUID_REGEX.test(leave_type_id)) throw new HttpError(400, 'leave_type_id invalide.');

  const startDt = new Date(start_date);
  const endDt = new Date(end_date);
  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime()) || endDt < startDt) {
    throw new HttpError(400, 'Dates invalides (end_date doit etre >= start_date).');
  }

  const diffMs = endDt.getTime() - startDt.getTime();
  const totalDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

  const insertData: Record<string, unknown> = {
    employee_id: employeeId,
    leave_type_id,
    start_date,
    end_date,
    total_days: totalDays,
    status: 'submitted',
    reason: sanitize(reason) || null,
  };
  if (companyId) insertData.company_id = companyId;

  const { data, error } = await supabase
    .from('hr_leave_requests')
    .insert(insertData)
    .select('id, status, start_date, end_date, total_days')
    .single();

  if (error) throw new HttpError(500, `Erreur creation demande: ${error.message}`);

  return {
    success: true,
    data,
    message: `Demande de conge soumise (${totalDays} jour(s), du ${start_date} au ${end_date}).`,
  };
};

const handleGetPayslipInfo = async (
  supabase: ReturnType<typeof createAuthClient>,
  employeeId: string,
  companyId: string | null
) => {
  // Fetch latest payroll variable items for the employee
  let query = supabase
    .from('hr_payroll_variable_items')
    .select(
      'item_code, item_label, item_category, quantity, rate, amount, currency, hr_payroll_periods(period_start, period_end, status)'
    )
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (companyId) query = query.eq('company_id', companyId);

  const { data: items, error } = await query;
  if (error) throw new HttpError(500, `Erreur recuperation bulletin: ${error.message}`);

  // Fetch active contract for salary reference
  let contractQuery = supabase
    .from('hr_employee_contracts')
    .select('contract_type, pay_basis, hourly_rate, monthly_salary, start_date, end_date, status')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (companyId) contractQuery = contractQuery.eq('company_id', companyId);

  const { data: contract } = await contractQuery;

  // Group items by period
  const periods: Record<string, { period: string; items: unknown[]; total: number }> = {};
  for (const item of items || []) {
    const period = (item as any).hr_payroll_periods;
    const key = period ? `${period.period_start}_${period.period_end}` : 'unknown';
    if (!periods[key]) {
      periods[key] = {
        period: period ? `${period.period_start} - ${period.period_end}` : 'Inconnu',
        items: [],
        total: 0,
      };
    }
    periods[key].items.push({
      label: item.item_label,
      category: item.item_category,
      amount: toNumber(item.amount),
    });
    periods[key].total += toNumber(item.amount);
  }

  return {
    success: true,
    data: {
      employee_id: employeeId,
      active_contract: contract || null,
      payroll_periods: Object.values(periods).slice(0, 3),
    },
    message: 'Informations de paie recuperees.',
  };
};

const handleAskHrFaq = async (
  anthropicKey: string,
  message: string,
  companyId: string | null,
  supabase: ReturnType<typeof createAuthClient>
) => {
  // Fetch company-specific HR policies if any exist (from hr_surveys or custom tables)
  let policyContext = '';
  if (companyId) {
    const { data: surveys } = await supabase
      .from('hr_surveys')
      .select('title, questions')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .limit(5);
    if (surveys && surveys.length > 0) {
      policyContext = `\nEnquetes RH actives de l'entreprise:\n${surveys.map((s) => `- ${s.title}`).join('\n')}`;
    }
  }

  const systemPrompt = `Tu es un assistant RH expert en droit du travail francais et belge.
Reponds aux questions RH de maniere precise, en citant les articles de loi quand pertinent.
Domaines: conges, contrats, paie, formation, securite, bien-etre au travail, RGPD.
Si la question necessite un conseil juridique personnalise, recommande de consulter un juriste.
${policyContext}
Reponds en francais, de maniere concise et professionnelle.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[ai-hr-chatbot] Anthropic API error:', response.status, errText);
    throw new HttpError(502, 'Erreur du service IA.');
  }

  const result = await response.json();
  const reply = result.content?.[0]?.text || "Desole, je n'ai pas pu repondre.";

  return { success: true, data: { reply }, message: 'Reponse FAQ RH generee.' };
};

// ---- Intent detection via Claude ----

const detectIntent = async (anthropicKey: string, message: string): Promise<HrAction> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      system: `Classify the user's HR intent into exactly one of these categories. Reply with ONLY the category name, nothing else.
Categories:
- get_leave_balance (checking remaining leave days, vacation balance)
- request_leave (asking to take time off, submit leave request)
- get_payslip_info (salary, payslip, pay stub, compensation details)
- ask_hr_faq (general HR questions about policies, rights, regulations)
- chat (general conversation, greetings, unclear intent)`,
      messages: [{ role: 'user', content: message }],
    }),
  });

  if (!response.ok) return 'chat';

  const result = await response.json();
  const intent = (result.content?.[0]?.text || 'chat').trim().toLowerCase() as HrAction;
  const validActions: HrAction[] = ['get_leave_balance', 'request_leave', 'get_payslip_info', 'ask_hr_faq', 'chat'];
  return validActions.includes(intent) ? intent : 'chat';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceClient = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scopedSupabase = createAuthClient(authHeader);
    const authUser = await requireAuthenticatedUser(req);
    resolvedUserId = authUser.id;

    const payload: HrRequest = await req.json();
    const message = sanitize(payload.message);
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message requis.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ error: `Message trop long (max ${MAX_MESSAGE_LENGTH} car.)` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const rateCheck = checkRateLimit(`${HR_RATE_LIMIT.keyPrefix}:${resolvedUserId}`, HR_RATE_LIMIT);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck, corsHeaders);

    const companyId = await resolveActiveCompanyId(scopedSupabase, resolvedUserId, (payload as any).activeCompanyId);
    const employeeId =
      payload.employee_id && UUID_REGEX.test(payload.employee_id)
        ? payload.employee_id
        : await resolveEmployeeId(scopedSupabase, resolvedUserId, companyId);

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new HttpError(500, 'ANTHROPIC_API_KEY not configured');

    // Determine action: explicit or detect via Claude
    let action: HrAction = payload.action || 'chat';
    if (action === 'chat') {
      action = await detectIntent(anthropicKey, message);
    }

    // Actions requiring employee context
    if (['get_leave_balance', 'request_leave', 'get_payslip_info'].includes(action) && !employeeId) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          message: 'Aucun profil employe trouve pour cet utilisateur. Contactez votre administrateur RH.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    creditConsumption = await consumeCredits(serviceClient, resolvedUserId, CREDIT_COST, 'AI HR Chatbot');

    let result: { success: boolean; data: unknown; message: string };

    switch (action) {
      case 'get_leave_balance':
        result = await handleGetLeaveBalance(scopedSupabase, employeeId!, companyId);
        break;
      case 'request_leave':
        result = await handleRequestLeave(scopedSupabase, employeeId!, companyId, payload);
        break;
      case 'get_payslip_info':
        result = await handleGetPayslipInfo(scopedSupabase, employeeId!, companyId);
        break;
      case 'ask_hr_faq':
        result = await handleAskHrFaq(anthropicKey, message, companyId, scopedSupabase);
        break;
      default:
        result = await handleAskHrFaq(anthropicKey, message, companyId, scopedSupabase);
        break;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(serviceClient, resolvedUserId, creditConsumption, 'AI HR Chatbot - error');
      } catch {
        /* ignore secondary failures */
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    console.error('[ai-hr-chatbot] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        message: error instanceof HttpError ? error.message : 'Erreur interne du serveur.',
      }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
