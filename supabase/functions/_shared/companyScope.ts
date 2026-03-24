import { createAuthClient, HttpError } from './billing.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
};

export const resolveActiveCompanyId = async (
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  requestedCompanyId: unknown
) => {
  const explicitCompanyId = normalizeUuid(requestedCompanyId);
  if (explicitCompanyId) return explicitCompanyId;

  const { data: preference, error: preferenceError } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (preferenceError && preferenceError.code !== '42P01') {
    throw preferenceError;
  }

  const preferredCompanyId = normalizeUuid(preference?.active_company_id);
  if (preferredCompanyId) return preferredCompanyId;

  const { data: firstCompany, error: firstCompanyError } = await supabase
    .from('company')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstCompanyError) {
    throw firstCompanyError;
  }

  return firstCompany?.id || null;
};

export const getScopedCompany = async <T = Record<string, unknown>>(
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  selectColumns: string,
  requestedCompanyId?: unknown
) => {
  const companyId = await resolveActiveCompanyId(supabase, userId, requestedCompanyId);
  if (!companyId) {
    throw new HttpError(404, 'Company profile not found');
  }

  const { data: company, error: companyError } = await supabase
    .from('company')
    .select(selectColumns)
    .eq('user_id', userId)
    .eq('id', companyId)
    .maybeSingle();

  if (companyError) {
    throw companyError;
  }
  if (!company) {
    throw new HttpError(404, 'Company profile not found');
  }

  return { company: company as T, companyId };
};
