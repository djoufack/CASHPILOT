type InternalAuthOptions = {
  secretHeaderName?: string;
  secretEnvName?: string;
};

const DEFAULT_SECRET_HEADER = 'x-scheduler-secret';
const DEFAULT_SECRET_ENV = 'INTERNAL_SCHEDULER_SECRET';

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
};

export const isAuthorizedInternalRequest = (
  req: Request,
  options: InternalAuthOptions = {},
) => {
  const secretHeaderName = options.secretHeaderName || DEFAULT_SECRET_HEADER;
  const secretEnvName = options.secretEnvName || DEFAULT_SECRET_ENV;

  const configuredSecret = (Deno.env.get(secretEnvName) || '').trim();
  const receivedSecret = (req.headers.get(secretHeaderName) || '').trim();

  if (configuredSecret && receivedSecret && timingSafeEqual(receivedSecret, configuredSecret)) {
    return true;
  }

  const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!serviceRoleKey) {
    return false;
  }

  const apiKeyHeader = (req.headers.get('apikey') || req.headers.get('x-api-key') || '').trim();
  if (apiKeyHeader && timingSafeEqual(apiKeyHeader, serviceRoleKey)) {
    return true;
  }

  const authorization = (req.headers.get('authorization') || '').trim();
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (bearerToken && timingSafeEqual(bearerToken, serviceRoleKey)) {
    return true;
  }

  return false;
};

export const unauthorizedInternalRequestResponse = (
  corsHeaders: Record<string, string>,
  options: InternalAuthOptions = {},
) => {
  const secretHeaderName = options.secretHeaderName || DEFAULT_SECRET_HEADER;
  const secretEnvName = options.secretEnvName || DEFAULT_SECRET_ENV;
  return new Response(
    JSON.stringify({
      error: `Unauthorized internal invocation. Provide ${secretHeaderName} matching ${secretEnvName}.`,
    }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
};

