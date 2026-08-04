"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import type { ReactNode } from "react";
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  AUTH0_SCOPE,
  isAuth0Configured,
} from "@/lib/auth0";

export default function InterfazeProviders({ children }: { children: ReactNode }) {
  if (!isAuth0Configured()) {
    return <>{children}</>;
  }

  // Prefer the actual browser origin so *.vercel.app keeps working while
  // interfaze.io DNS is propagating; APP_ORIGIN is SSR/fallback only.
  const origin =
    (typeof window !== "undefined" ? window.location.origin : null) ||
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/+$/, "") ||
    "http://localhost:3010";

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: `${origin}/auth/callback`,
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPE,
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      // If refresh token is missing/expired, fall back to silent iframe auth.
      useRefreshTokensFallback
    >
      {children}
    </Auth0Provider>
  );
}
