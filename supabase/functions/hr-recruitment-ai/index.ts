import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const jsonRes = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
const errRes = (msg: string, status = 400) => jsonRes({ error: msg }, status);

const requireEnv = (name: string): string => {
  const v = Deno.env.get(name)?.trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

// -- Anthropic helpers -------------------------------------------------------

async function callClaude(apiKey: string, system: string, user: string, maxTokens = 2048): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('[hr-ai] Claude error:', res.status, t);
    throw new Error(`Claude API ${res.status}`);
  }
  const text = (await res.json())?.content?.[0]?.text;
  if (!text) throw new Error('Empty Claude response');
  return text;
}

async function callClaudeJSON<T>(apiKey: string, system: string, user: string, maxTokens = 2048): Promise<T> {
  const raw = await callClaude(apiKey, system, user, maxTokens);
  return JSON.parse(
    raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
  ) as T;
}

// -- Fetch application with candidate + position ----------------------------

async function fetchApplication(supabase: ReturnType<typeof createServiceClient>, applicationId: string) {
  const { data, error } = await supabase
    .from('hr_applications')
    .select(
      `id, hr_candidates(id, first_name, last_name, email, resume_parsed), hr_positions(id, title, department, description, requirements, skills_required)`
    )
    .eq('id', applicationId)
    .maybeSingle();
  if (error || !data) {
    console.error('[hr-ai] app fetch:', error);
    return null;
  }
  return data;
}

// -- Action: parse_cv --------------------------------------------------------

async function handleParseCV(
  supabase: ReturnType<typeof createServiceClient>,
  apiKey: string,
  fileUrl: string,
  candidateId: string
): Promise<Response> {
  if (!fileUrl || !candidateId) return errRes('file_url and candidate_id are required');

  const docRes = await fetch(fileUrl);
  if (!docRes.ok) return errRes(`Failed to fetch document: ${docRes.status}`, 502);

  const ct = docRes.headers.get('content-type') || '';
  let docText: string;
  if (ct.includes('text') || ct.includes('json')) {
    docText = await docRes.text();
  } else {
    const bytes = new Uint8Array(await docRes.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    docText = `[Binary document, base64]\n${btoa(bin)}`;
  }

  const sys = `You are an expert HR CV parser. Extract structured data and return ONLY valid JSON:
{"name":"","email":"","phone":"","skills":[],"experience":[{"title":"","company":"","duration":"","description":""}],"education":[{"degree":"","institution":"","year":""}],"languages":[],"certifications":[]}
Use empty string/array for missing fields. No markdown fences.`;

  const parsed = await callClaudeJSON(apiKey, sys, `Parse this CV:\n\n${docText.slice(0, 30000)}`, 2048);

  const { error } = await supabase.from('hr_candidates').update({ resume_parsed: parsed }).eq('id', candidateId);
  if (error) {
    console.error('[hr-ai] update hr_candidates:', error);
    return errRes('Failed to save parsed CV', 500);
  }

  return jsonRes({ success: true, data: parsed });
}

// -- Action: score_candidate -------------------------------------------------

async function handleScoreCandidate(
  supabase: ReturnType<typeof createServiceClient>,
  apiKey: string,
  applicationId: string
): Promise<Response> {
  if (!applicationId) return errRes('application_id is required');

  const app = await fetchApplication(supabase, applicationId);
  if (!app) return errRes('Application not found', 404);
  const { hr_candidates: cand, hr_positions: pos } = app as any;
  if (!cand || !pos) return errRes('Candidate or position data missing', 422);

  const sys = `You are an expert HR talent assessor. Score a candidate 0-100 for a position.
Return ONLY valid JSON: {"score":<0-100>,"summary":"2-3 sentences","strengths":["..."],"gaps":["..."]}
0-30=poor, 31-50=below avg, 51-70=average, 71-85=good, 86-100=excellent. No markdown fences.`;

  const user = `POSITION: ${pos.title} (${pos.department || 'N/A'})
Description: ${pos.description || 'N/A'}
Requirements: ${JSON.stringify(pos.requirements || [])}
Skills: ${JSON.stringify(pos.skills_required || [])}

CANDIDATE: ${cand.first_name || ''} ${cand.last_name || ''}
Resume: ${JSON.stringify(cand.resume_parsed || {})}`;

  const result = await callClaudeJSON<{ score: number; summary: string; strengths: string[]; gaps: string[] }>(
    apiKey,
    sys,
    user,
    1024
  );
  result.score = Math.max(0, Math.min(100, Math.round(result.score)));

  const { error } = await supabase
    .from('hr_applications')
    .update({ ai_score: result.score, ai_summary: result.summary })
    .eq('id', applicationId);
  if (error) {
    console.error('[hr-ai] update hr_applications:', error);
    return errRes('Failed to save score', 500);
  }

  return jsonRes({ success: true, data: result });
}

// -- Action: generate_questions ----------------------------------------------

async function handleGenerateQuestions(
  supabase: ReturnType<typeof createServiceClient>,
  apiKey: string,
  applicationId: string,
  interviewType: string
): Promise<Response> {
  if (!applicationId) return errRes('application_id is required');
  const type = (interviewType || 'technical').toLowerCase();

  const app = await fetchApplication(supabase, applicationId);
  if (!app) return errRes('Application not found', 404);
  const { hr_candidates: cand, hr_positions: pos } = app as any;
  if (!cand || !pos) return errRes('Candidate or position data missing', 422);

  const sys = `You are an expert HR interviewer. Generate 5-8 tailored interview questions.
Return ONLY valid JSON: {"questions":[{"question":"","category":"technical|behavioral|situational|cultural_fit","difficulty":"easy|medium|hard","rationale":""}]}
Tailor to interview type, position, and candidate background. No markdown fences.`;

  const user = `Interview type: ${type}

POSITION: ${pos.title} (${pos.department || 'N/A'})
Description: ${pos.description || 'N/A'}
Requirements: ${JSON.stringify(pos.requirements || [])}
Skills: ${JSON.stringify(pos.skills_required || [])}

CANDIDATE: ${cand.first_name || ''} ${cand.last_name || ''}
Resume: ${JSON.stringify(cand.resume_parsed || {})}`;

  const result = await callClaudeJSON<{
    questions: Array<{ question: string; category: string; difficulty: string; rationale: string }>;
  }>(apiKey, sys, user, 2048);

  // Persist to latest interview session for this application
  const { data: session } = await supabase
    .from('hr_interview_sessions')
    .select('id')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session?.id) {
    const { error } = await supabase
      .from('hr_interview_sessions')
      .update({ ai_suggested_questions: result.questions })
      .eq('id', session.id);
    if (error) console.error('[hr-ai] update hr_interview_sessions:', error);
  }

  return jsonRes({ success: true, data: result });
}

// -- Main handler ------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errRes('Method not allowed', 405);

  // ENF-2 / Security: require a valid authenticated user before any HR AI action.
  try {
    await requireAuthenticatedUser(req);
  } catch {
    return errRes('Unauthorized', 401);
  }

  try {
    const apiKey = requireEnv('ANTHROPIC_API_KEY');
    const supabase = createServiceClient();
    const payload = await req.json();
    const { action } = payload;

    switch (action) {
      case 'parse_cv':
        return await handleParseCV(supabase, apiKey, payload.file_url, payload.candidate_id);
      case 'score_candidate':
        return await handleScoreCandidate(supabase, apiKey, payload.application_id);
      case 'generate_questions':
        return await handleGenerateQuestions(supabase, apiKey, payload.application_id, payload.interview_type);
      default:
        return errRes(`Unknown action: ${action}. Valid: parse_cv, score_candidate, generate_questions`);
    }
  } catch (err) {
    console.error('[hr-ai] error:', err);
    return errRes(err instanceof Error ? err.message : 'Internal server error', 500);
  }
});
