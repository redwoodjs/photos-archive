import type { Env } from "@/lib/env";

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface OAuthRefreshResponse {
  access_token: string;
  expires_in: number;
}

export async function getAuthUrl(env: Env, state?: string): Promise<string> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    access_type: "offline",
    prompt: "consent",
  });

  if (state) {
    params.set("state", state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  env: Env
): Promise<TokenData> {
  console.log(`[AUTH] exchangeCodeForTokens called with code: ${code.substring(0, 10)}...`);
  
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[AUTH] Token exchange failed: ${error}`);
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  const expiresAt = Date.now() + data.expires_in * 1000;

  console.log(`[AUTH] Token exchange successful: expires_in=${data.expires_in}s, expires_at=${new Date(expiresAt).toISOString()}, hasRefreshToken=${!!data.refresh_token}`);

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at: expiresAt,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  env: Env
): Promise<{ access_token: string; expires_in: number; expires_at: number }> {
  console.log(`[AUTH] refreshAccessToken called with refreshToken: ${refreshToken.substring(0, 10)}...`);
  
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[AUTH] Token refresh failed: ${error}`);
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = (await response.json()) as OAuthRefreshResponse;
  const expiresAt = Date.now() + data.expires_in * 1000;

  console.log(`[AUTH] Token refresh successful: expires_in=${data.expires_in}s, expires_at=${new Date(expiresAt).toISOString()}`);

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    expires_at: expiresAt,
  };
}

export async function storeTokens(
  kv: KVNamespace,
  userId: string,
  tokens: TokenData
): Promise<void> {
  console.log(`[AUTH] storeTokens called for userId: ${userId}, expires_at: ${new Date(tokens.expires_at).toISOString()}`);
  await kv.put(`tokens:${userId}`, JSON.stringify(tokens));
  console.log(`[AUTH] Tokens stored successfully for userId: ${userId}`);
}

export async function getTokens(
  kv: KVNamespace,
  userId: string
): Promise<TokenData | null> {
  console.log(`[AUTH] getTokens called for userId: ${userId}`);
  const data = await kv.get(`tokens:${userId}`);
  if (!data) {
    console.log(`[AUTH] No tokens found in KV for userId: ${userId}`);
    return null;
  }
  const tokens = JSON.parse(data) as TokenData;
  console.log(`[AUTH] Tokens retrieved from KV: expires_at=${new Date(tokens.expires_at).toISOString()}, hasRefreshToken=${!!tokens.refresh_token}`);
  return tokens;
}

export async function getValidAccessToken(
  kv: KVNamespace,
  userId: string,
  env: Env
): Promise<string | null> {
  console.log(`[AUTH] getValidAccessToken called for userId: ${userId}`);
  
  const tokens = await getTokens(kv, userId);
  if (!tokens) {
    console.log(`[AUTH] No tokens found for userId: ${userId}`);
    return null;
  }

  const now = Date.now();
  const timeUntilExpiry = tokens.expires_at - now;
  const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
  
  console.log(`[AUTH] Token status: expires_at=${new Date(tokens.expires_at).toISOString()}, timeUntilExpiry=${minutesUntilExpiry}min, hasRefreshToken=${!!tokens.refresh_token}`);

  if (tokens.expires_at > now + 60000) {
    console.log(`[AUTH] Token still valid, returning access_token`);
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    console.log(`[AUTH] Token expired and no refresh_token available`);
    return null;
  }

  console.log(`[AUTH] Token expiring soon, attempting refresh`);
  try {
    const refreshed = await refreshAccessToken(tokens.refresh_token, env);
    const updatedTokens: TokenData = {
      ...tokens,
      access_token: refreshed.access_token,
      expires_in: refreshed.expires_in,
      expires_at: refreshed.expires_at,
    };
    await storeTokens(kv, userId, updatedTokens);
    console.log(`[AUTH] Token refreshed successfully, new expires_at=${new Date(refreshed.expires_at).toISOString()}`);
    return refreshed.access_token;
  } catch (error) {
    console.error(`[AUTH] Failed to refresh token:`, error);
    return null;
  }
}
