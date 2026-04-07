import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const parseRpcResult = <T>(payload: T | T[] | null) => (Array.isArray(payload) ? payload[0] : payload);

const requireFirstEnv = (...names: string[]): string => {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) {
      return value;
    }
  }

  throw new HttpError(500, `Server misconfigured: missing ${names.join(' | ')}`);
};

const resolveSupabaseUrl = () => requireFirstEnv('CASHPILOT_SUPABASE_URL', 'SUPABASE_URL');
const resolveAnonKey = () => requireFirstEnv('CASHPILOT_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
const resolveServiceRoleKey = () => requireFirstEnv('CASHPILOT_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');

export const createServiceClient = () => createClient(resolveSupabaseUrl(), resolveServiceRoleKey());

export const createAuthClient = (authHeader: string) =>
  createClient(resolveSupabaseUrl(), resolveAnonKey(), { global: { headers: { Authorization: authHeader } } });

type CreditCostRow = {
  cost?: number | string | null;
};

type BillingRpcArgsMap = {
  user_has_entitlement: {
    p_feature_key: string;
    target_user_id: string;
  };
  consume_user_credits: {
    target_user_id: string;
    amount: number;
    description: string;
  };
  refund_user_credits: {
    target_user_id: string;
    refund_free_credits: number;
    refund_subscription_credits: number;
    refund_paid_credits: number;
    description: string;
  };
};

type BillingRpcResultMap = {
  user_has_entitlement: boolean | null;
  consume_user_credits: CreditConsumptionResult | CreditConsumptionResult[] | null;
  refund_user_credits: unknown;
};

type BillingRpcClient = {
  rpc<FnName extends keyof BillingRpcArgsMap>(
    fn: FnName,
    args: BillingRpcArgsMap[FnName]
  ): Promise<{ data: BillingRpcResultMap[FnName]; error: unknown }>;
};

const extractBearerToken = (authHeader: string) => {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new HttpError(401, 'Missing authorization');
  }

  return token;
};

export const requireAuthenticatedUser = async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing authorization');
  }

  const token = extractBearerToken(authHeader);
  const response = await fetch(`${resolveSupabaseUrl()}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: resolveAnonKey(),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || payload?.error || payload?.error_description || 'Unauthorized';
    throw new HttpError(401, message);
  }

  const user = await response.json().catch(() => null);
  if (!user?.id) {
    throw new HttpError(401, 'Unauthorized');
  }

  return user;
};

export const resolveCreditCost = async (
  supabase: ReturnType<typeof createClient>,
  operationCode: string
): Promise<number> => {
  const { data, error } = await supabase
    .from('credit_costs')
    .select('cost')
    .eq('operation_code', operationCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const cost = Number((data as CreditCostRow | null)?.cost);
  if (!Number.isFinite(cost) || cost <= 0) {
    throw new HttpError(500, `Missing active credit configuration for ${operationCode}`);
  }

  return cost;
};

export const requireEntitlement = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  featureKey: string
) => {
  const billingSupabase = supabase as unknown as BillingRpcClient;
  const { data, error } = await billingSupabase.rpc('user_has_entitlement', {
    p_feature_key: featureKey,
    target_user_id: userId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(403, 'feature_not_included');
  }
};

type CreditConsumptionResult = {
  success: boolean;
  free_credits: number;
  subscription_credits: number;
  paid_credits: number;
  total_used: number;
  available_credits: number;
  deducted_free_credits: number;
  deducted_subscription_credits: number;
  deducted_paid_credits: number;
};

export const consumeCredits = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  description: string
) => {
  const billingSupabase = supabase as unknown as BillingRpcClient;
  const { data, error } = await billingSupabase.rpc('consume_user_credits', {
    target_user_id: userId,
    amount,
    description,
  });

  if (error) {
    throw error;
  }

  const result = parseRpcResult<CreditConsumptionResult>(data);
  if (!result?.success) {
    throw new HttpError(402, 'insufficient_credits');
  }

  return result;
};

export const refundCredits = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  deduction: Partial<CreditConsumptionResult> | null | undefined,
  description: string
) => {
  if (!deduction) {
    return;
  }

  const billingSupabase = supabase as unknown as BillingRpcClient;
  const { error } = await billingSupabase.rpc('refund_user_credits', {
    target_user_id: userId,
    refund_free_credits: deduction.deducted_free_credits || 0,
    refund_subscription_credits: deduction.deducted_subscription_credits || 0,
    refund_paid_credits: deduction.deducted_paid_credits || 0,
    description,
  });

  if (error) {
    throw error;
  }
};
