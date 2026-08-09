"use client";

import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import type { ReactNode } from "react";
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  AUTH0_SCOPE,
  isAuth0Configured,
} from "@/lib/auth0";
import { isCnRegion } from "@/lib/region";

function onRedirectCallback(appState?: AppState) {
  const raw = typeof appState?.returnTo === "string" ? appState.returnTo : "/";
  const returnTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  window.location.replace(returnTo);
}

export default function InterfazeProviders({ children }: { children: ReactNode }) {
  // CN uses WeChat JWT — no Auth0Provider (hooks must not run without it).
  if (isCnRegion() || !isAuth0Configured()) {
    return <>{children}</>;
  }

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
      useRefreshTokensFallback
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
}
