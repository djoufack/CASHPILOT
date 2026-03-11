import { HttpError } from './billing.ts';

export type AccountingProvider = 'xero' | 'quickbooks';

export type TokenPayload = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  scope: string | null;
  expiresAt: string | null;
  raw: Record<string, unknown>;
};

type ProviderConfig = {
  provider: AccountingProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
};

const textEncoder = new TextEncoder();

const requireEnv = (key: string) => {
  const value = (Deno.env.get(key) || '').trim();
  if (!value) {
    throw new HttpError(500, `Missing ${key}`);
  }
  return value;
};

const optionalEnv = (key: string, fallback: string) => {
  const value = (Deno.env.get(key) || '').trim();
  return value || fallback;
};

export const normalizeProvider = (value: unknown): AccountingProvider => {
  const provider = String(value || '').trim().toLowerCase();
  if (provider !== 'xero' && provider !== 'quickbooks') {
    throw new HttpError(400, 'Unsupported accounting provider');
  }
  return provider;
};

export const getProviderConfig = (provider: AccountingProvider): ProviderConfig => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  if (provider === 'xero') {
    return {
      provider,
      clientId: requireEnv('XERO_CLIENT_ID'),
      clientSecret: requireEnv('XERO_CLIENT_SECRET'),
      redirectUri: optionalEnv('XERO_REDIRECT_URI', `${supabaseUrl}/functions/v1/accounting-oauth-callback?provider=xero`),
      authorizeUrl: 'https://login.xero.com/identity/connect/authorize',
      tokenUrl: 'https://identity.xero.com/connect/token',
      scopes: optionalEnv('XERO_SCOPES', 'offline_access accounting.transactions accounting.contacts accounting.settings')
        .split(/\s+/)
        .filter(Boolean),
    };
  }

  return {
    provider,
    clientId: requireEnv('QUICKBOOKS_CLIENT_ID'),
    clientSecret: requireEnv('QUICKBOOKS_CLIENT_SECRET'),
    redirectUri: optionalEnv('QUICKBOOKS_REDIRECT_URI', `${supabaseUrl}/functions/v1/accounting-oauth-callback?provider=quickbooks`),
    authorizeUrl: optionalEnv('QUICKBOOKS_AUTHORIZE_URL', 'https://appcenter.intuit.com/connect/oauth2'),
    tokenUrl: optionalEnv('QUICKBOOKS_TOKEN_URL', 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'),
    scopes: optionalEnv('QUICKBOOKS_SCOPES', 'com.intuit.quickbooks.accounting')
      .split(/\s+/)
      .filter(Boolean),
  };
};

export const buildAuthorizationUrl = (provider: AccountingProvider, state: string) => {
  const config = getProviderConfig(provider);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
  });

  return `${config.authorizeUrl}?${params.toString()}`;
};

const asBasicAuth = (clientId: string, clientSecret: string) => {
  const credentials = `${clientId}:${clientSecret}`;
  return `Basic ${btoa(credentials)}`;
};

const parseTokenResponse = (json: Record<string, unknown>): TokenPayload => {
  const accessToken = String(json.access_token || '').trim();
  if (!accessToken) {
    throw new HttpError(502, 'OAuth token exchange failed: missing access token');
  }

  const expiresIn = Number(json.expires_in || 0);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + (expiresIn * 1000)).toISOString()
    : null;

  return {
    accessToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    tokenType: json.token_type ? String(json.token_type) : null,
    scope: json.scope ? String(json.scope) : null,
    expiresAt,
    raw: json,
  };
};

const parseJsonSafe = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const exchangeAuthorizationCode = async (
  provider: AccountingProvider,
  code: string,
): Promise<TokenPayload> => {
  const config = getProviderConfig(provider);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (provider === 'xero') {
    headers.Authorization = asBasicAuth(config.clientId, config.clientSecret);
  } else {
    headers.Authorization = asBasicAuth(config.clientId, config.clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new HttpError(502, `OAuth token exchange failed (${provider})`);
  }

  return parseTokenResponse(payload as Record<string, unknown>);
};

export const refreshAccessToken = async (
  provider: AccountingProvider,
  refreshToken: string,
): Promise<TokenPayload> => {
  const config = getProviderConfig(provider);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    Authorization: asBasicAuth(config.clientId, config.clientSecret),
  };

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new HttpError(502, `OAuth token refresh failed (${provider})`);
  }

  return parseTokenResponse(payload as Record<string, unknown>);
};

export const resolveXeroTenant = async (accessToken: string) => {
  const response = await fetch('https://api.xero.com/connections', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok || !Array.isArray(payload) || payload.length === 0) {
    throw new HttpError(502, 'Unable to resolve Xero tenant');
  }

  const firstTenant = payload[0] as Record<string, unknown>;
  const tenantId = String(firstTenant.tenantId || '').trim();
  if (!tenantId) {
    throw new HttpError(502, 'Xero tenant id missing in OAuth connection payload');
  }

  return {
    tenantId,
    tenantName: firstTenant.tenantName ? String(firstTenant.tenantName) : null,
    connection: firstTenant,
  };
};

export const resolveQuickBooksCompany = async (accessToken: string, realmId: string) => {
  if (!realmId) {
    throw new HttpError(400, 'QuickBooks realmId is required');
  }

  const companyInfoUrl = `https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=75`;
  const response = await fetch(companyInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new HttpError(502, 'Unable to resolve QuickBooks company info');
  }

  const companyName = String(
    (payload as Record<string, unknown>)?.CompanyInfo?.CompanyName
      || (payload as Record<string, unknown>)?.companyInfo?.companyName
      || '',
  ).trim() || null;

  return {
    realmId,
    companyName,
    companyInfo: payload,
  };
};

export const computeProofHmac = async (secret: string, content: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(content));
  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};
