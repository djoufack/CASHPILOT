import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const parseRpcResult = <T>(payload: T | T[] | null) => Array.isArray(payload) ? payload[0] : payload;

const requireEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new HttpError(500, `Server misconfigured: missing ${name}`);
  }

  return value;
};

export const createServiceClient = () => createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
);

export const createAuthClient = (authHeader: string) => createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_ANON_KEY'),
  { global: { headers: { Authorization: authHeader } } },
);

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
  const supabaseAdmin = createServiceClient();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new HttpError(401, error?.message || 'Unauthorized');
  }

  return user;
};

export const resolveCreditCost = async (
  supabase: ReturnType<typeof createClient>,
  operationCode: string,
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

  const cost = Number(data?.cost);
  if (!Number.isFinite(cost) || cost <= 0) {
    throw new HttpError(500, `Missing active credit configuration for ${operationCode}`);
  }

  return cost;
};

export const requireEntitlement = async (supabase: ReturnType<typeof createClient>, userId: string, featureKey: string) => {
  const { data, error } = await supabase.rpc('user_has_entitlement', {
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
  description: string,
) => {
  const { data, error } = await supabase.rpc('consume_user_credits', {
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
  description: string,
) => {
  if (!deduction) {
    return;
  }

  const { error } = await supabase.rpc('refund_user_credits', {
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
