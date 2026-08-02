"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import type { ReactNode } from "react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN, isAuth0Configured } from "@/lib/auth0";

export default function InterfazeProviders({ children }: { children: ReactNode }) {
  if (!isAuth0Configured()) {
    return <>{children}</>;
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3010");

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: `${origin}/auth/callback`,
        audience: AUTH0_AUDIENCE,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      {children}
    </Auth0Provider>
  );
}
