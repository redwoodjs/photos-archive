import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Photos } from "@/app/pages/Photos";
import * as auth from "@/lib/auth";
import * as googlePhotos from "@/lib/google-photos";
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
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(JSON.stringify({ error: `OAuth error: ${error}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!code) {
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

  if (!state || state !== storedState) {
    return new Response(JSON.stringify({ error: "Invalid state parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const tokens = await auth.exchangeCodeForTokens(code, env);

    const userId = "default";
    await auth.storeTokens(env.TOKENS, userId, tokens);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/photos",
        "Set-Cookie": `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      },
    });
  } catch (error) {
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
  try {
    const userId = "default";
    const accessToken = await auth.getValidAccessToken(env.TOKENS, userId, env);

    if (!accessToken) {
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

    const albums = await googlePhotos.listAlbums(accessToken, undefined, 5);

    return new Response(
      JSON.stringify({
        success: true,
        albums: albums.albums,
        message: `Successfully connected to Google Photos API. Found ${albums.albums.length} album(s).`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "API test failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
