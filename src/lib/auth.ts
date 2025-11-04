export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
}

export interface Env {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}

export async function getAuthUrl(env: Env, state?: string): Promise<string> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing Google OAuth configuration");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/photoslibrary.readonly",
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
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google OAuth configuration");
  }

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
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

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
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth configuration");
  }

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
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

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
  await kv.put(`tokens:${userId}`, JSON.stringify(tokens));
}

export async function getTokens(
  kv: KVNamespace,
  userId: string
): Promise<TokenData | null> {
  const data = await kv.get(`tokens:${userId}`);
  if (!data) {
    return null;
  }
  return JSON.parse(data) as TokenData;
}

export async function getValidAccessToken(
  kv: KVNamespace,
  userId: string,
  env: Env
): Promise<string | null> {
  const tokens = await getTokens(kv, userId);
  if (!tokens) {
    return null;
  }

  if (tokens.expires_at > Date.now() + 60000) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    return null;
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refresh_token, env);
    const updatedTokens: TokenData = {
      ...tokens,
      access_token: refreshed.access_token,
      expires_in: refreshed.expires_in,
      expires_at: refreshed.expires_at,
    };
    await storeTokens(kv, userId, updatedTokens);
    return refreshed.access_token;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return null;
  }
}
