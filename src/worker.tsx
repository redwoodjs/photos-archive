import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Photos } from "@/app/pages/Photos";
import * as auth from "@/lib/auth";
import * as googlePhotosPicker from "@/lib/google-photos-picker";
import { ENV, type Env } from "@/lib/env";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  async ({ ctx, request }) => {
    const url = new URL(request.url);

    if (url.pathname === "/auth/google") {
      return await handleAuthStart(request, ENV);
    }

    if (url.pathname === "/auth/callback") {
      return await handleAuthCallback(request, ENV);
    }

    if (url.pathname === "/api/test-photos") {
      return await handleTestPhotos(request, ENV);
    }

    if (url.pathname === "/auth/clear") {
      return await handleClearAuth(request, ENV);
    }

    if (url.pathname === "/auth/revoke") {
      return await handleRevokeAuth(request, ENV);
    }

    if (url.pathname === "/api/picker/session" && request.method === "POST") {
      return await handleCreatePickerSession(request, ENV);
    }

    if (url.pathname === "/api/picker/callback") {
      return await handlePickerCallback(request, ENV);
    }

    if (
      url.pathname.startsWith("/api/picker/session/") &&
      url.pathname.endsWith("/status")
    ) {
      const sessionId = url.pathname.split("/")[4];
      return await handleGetPickerSessionStatus(request, ENV, sessionId);
    }

    if (
      url.pathname.startsWith("/api/picker/session/") &&
      url.pathname.endsWith("/media")
    ) {
      const sessionId = url.pathname.split("/")[4];
      return await handleGetPickerSessionMedia(request, ENV, sessionId);
    }
  },
  ({ ctx }) => {
    ctx;
  },
  render(Document, [
    route("/", () => {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/photos",
        },
      });
    }),
    route("/photos", Photos),
  ]),
]);

async function handleAuthStart(request: Request, env: Env): Promise<Response> {
  try {
    const state = crypto.randomUUID();
    const authUrl = await auth.getAuthUrl(env, state);

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      },
    });
    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Authentication failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleAuthCallback(
  request: Request,
  env: Env
): Promise<Response> {
  console.log(`[AUTH] handleAuthCallback called`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error(`[AUTH] OAuth error in callback: ${error}`);
    return new Response(JSON.stringify({ error: `OAuth error: ${error}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!code) {
    console.error(`[AUTH] Missing authorization code in callback`);
    return new Response(
      JSON.stringify({ error: "Missing authorization code" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const cookies = request.headers.get("Cookie") || "";
  const stateCookie = cookies
    .split(";")
    .find((c) => c.trim().startsWith("oauth_state="));
  const storedState = stateCookie?.split("=")[1];

  console.log(
    `[AUTH] State validation: received=${state}, stored=${storedState}`
  );

  if (!state || state !== storedState) {
    console.error(`[AUTH] State parameter mismatch`);
    return new Response(JSON.stringify({ error: "Invalid state parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const tokens = await auth.exchangeCodeForTokens(code, env);

    const userId = "default";
    await auth.storeTokens(env.TOKENS, userId, tokens);

    console.log(`[AUTH] Auth callback successful, redirecting to /photos`);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/photos",
        "Set-Cookie": `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      },
    });
  } catch (error) {
    console.error(`[AUTH] Auth callback error:`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Token exchange failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleClearAuth(request: Request, env: Env): Promise<Response> {
  try {
    const userId = "default";
    await env.TOKENS.delete(`tokens:${userId}`);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/photos",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to clear authentication",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleRevokeAuth(request: Request, env: Env): Promise<Response> {
  try {
    const userId = "default";
    const tokens = await auth.getTokens(env.TOKENS, userId);

    if (tokens?.access_token) {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`,
        {
          method: "POST",
        }
      );
    }

    await env.TOKENS.delete(`tokens:${userId}`);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/photos",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to revoke authentication",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleTestPhotos(request: Request, env: Env): Promise<Response> {
  console.log(`[AUTH] handleTestPhotos called`);

  try {
    const userId = "default";
    const accessToken = await auth.getValidAccessToken(env.TOKENS, userId, env);

    if (!accessToken) {
      console.log(`[AUTH] handleTestPhotos: Not authenticated, returning 401`);
      return new Response(
        JSON.stringify({
          error: "Not authenticated. Please visit /auth/google first.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[AUTH] handleTestPhotos: Authenticated with valid access token`
    );
    return new Response(
      JSON.stringify({
        success: true,
        message: "Authenticated with Google Photos Picker API",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`[AUTH] handleTestPhotos error:`, error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Authentication check failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleCreatePickerSession(
  request: Request,
  env: Env
): Promise<Response> {
  console.log(`[AUTH] handleCreatePickerSession called`);

  try {
    const userId = "default";
    const accessToken = await auth.getValidAccessToken(env.TOKENS, userId, env);

    if (!accessToken) {
      console.log(
        `[AUTH] handleCreatePickerSession: Not authenticated, returning 401`
      );
      return new Response(
        JSON.stringify({
          error: "Not authenticated. Please visit /auth/google first.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[AUTH] handleCreatePickerSession: Have valid access token`);

    const session = await googlePhotosPicker.createPickerSession(accessToken);

    await env.TOKENS.put(
      `picker_session:${session.id}`,
      JSON.stringify({
        sessionId: session.id,
        userId,
        createdAt: Date.now(),
        status: "pending",
      }),
      { expirationTtl: 3600 }
    );

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        pickerUri: session.pickerUri,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create picker session",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handlePickerCallback(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing session_id parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const sessionData = await env.TOKENS.get(`picker_session:${sessionId}`);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Session not found or expired" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await env.TOKENS.put(
      `picker_session:${sessionId}`,
      JSON.stringify({
        ...JSON.parse(sessionData),
        status: "completed",
        completedAt: Date.now(),
      }),
      { expirationTtl: 3600 }
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/photos?session_id=${sessionId}`,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to process picker callback",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleGetPickerSessionStatus(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  console.log(
    `[AUTH] handleGetPickerSessionStatus called for session: ${sessionId}`
  );

  try {
    const userId = "default";
    const accessToken = await auth.getValidAccessToken(env.TOKENS, userId, env);

    if (!accessToken) {
      console.log(
        `[AUTH] handleGetPickerSessionStatus: Not authenticated, returning 401`
      );
      return new Response(
        JSON.stringify({
          error: "Not authenticated",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[AUTH] handleGetPickerSessionStatus: Have valid access token`);

    const session = await googlePhotosPicker.getPickerSession(
      accessToken,
      sessionId
    );

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        mediaItemsSet: session.mediaItemsSet || false,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get picker session status",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleGetPickerSessionMedia(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  console.log(
    `[AUTH] handleGetPickerSessionMedia called for session: ${sessionId}`
  );

  try {
    const userId = "default";
    const accessToken = await auth.getValidAccessToken(env.TOKENS, userId, env);

    if (!accessToken) {
      console.log(
        `[AUTH] handleGetPickerSessionMedia: Not authenticated, returning 401`
      );
      return new Response(
        JSON.stringify({
          error: "Not authenticated",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[AUTH] handleGetPickerSessionMedia: Have valid access token`);

    const url = new URL(request.url);
    const pageToken = url.searchParams.get("pageToken") || undefined;

    const mediaItems = await googlePhotosPicker.getSessionMediaItems(
      accessToken,
      sessionId,
      pageToken
    );

    await env.TOKENS.put(
      `selected_media:${sessionId}`,
      JSON.stringify({
        mediaItems: mediaItems.mediaItems,
        selectedAt: Date.now(),
      }),
      { expirationTtl: 86400 }
    );

    return new Response(JSON.stringify(mediaItems), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get picker session media",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
