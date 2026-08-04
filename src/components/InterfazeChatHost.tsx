"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { RanchChatShell, type AgentDirectoryItem } from "@acnlabs/agent-chat";
import {
  AUTH0_AUDIENCE,
  AUTH0_SCOPE,
  clearAuth0ClientCache,
  isAuth0Configured,
} from "@/lib/auth0";
import { getGatewayBaseUrl } from "@/lib/gateway";

/**
 * Interfaze host — ranch-ported shell chrome + Chat Gateway.
 * Locale is owned by RanchChatShell (switcher + localStorage + browser fallback).
 */
export default function InterfazeChatHost() {
  const { getAccessTokenSilently, isAuthenticated, user, logout, loginWithRedirect } = useAuth0();
  const gatewayBaseUrl = getGatewayBaseUrl();
  const [directoryAgents, setDirectoryAgents] = useState<AgentDirectoryItem[]>([]);
  const reauthStarted = useRef(false);

  const handleLogout = useCallback(() => {
    clearAuth0ClientCache();
    logout({
      logoutParams: {
        returnTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
  }, [logout]);

  const handleReauth = useCallback(() => {
    if (reauthStarted.current) return;
    reauthStarted.current = true;
    clearAuth0ClientCache();
    void loginWithRedirect({
      authorizationParams: {
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPE,
        prompt: "login",
      },
      appState: {
        returnTo: typeof window !== "undefined" ? window.location.pathname : "/",
      },
    });
  }, [loginWithRedirect]);

  const tokenGetter = useCallback(async () => {
    if (!isAuth0Configured() || !isAuthenticated) return null;
    try {
      return await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
        cacheMode: "on",
      });
    } catch {
      return null;
    }
  }, [getAccessTokenSilently, isAuthenticated]);

  // If Auth0 still has a user profile but no API access token (common after
  // refresh-token expiry without offline_access), force a clean re-login.
  useEffect(() => {
    if (!isAuthenticated || !isAuth0Configured()) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
          cacheMode: "off",
        });
        if (!cancelled && !token) handleReauth();
      } catch {
        if (!cancelled) handleReauth();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently, handleReauth, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      const token = await tokenGetter();
      if (!token) return;
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      const mine: AgentDirectoryItem[] = [];
      const owner = user?.sub;
      if (owner) {
        try {
          const url = new URL(`${gatewayBaseUrl}/api/labs/analytics/agents`);
          url.searchParams.set("status", "all");
          url.searchParams.set("owner", owner);
          url.searchParams.set("limit", "50");
          const res = await fetch(url.toString(), { headers });
          if (res.ok) {
            const data = (await res.json()) as { agents?: Array<Record<string, unknown>> };
            for (const a of data.agents ?? []) {
              const id = String(a.agent_id ?? a.id ?? "").trim();
              if (!id || id.startsWith("sys:")) continue;
              mine.push({
                agent_id: id,
                name: typeof a.name === "string" ? a.name : null,
                description: typeof a.description === "string" ? a.description : null,
                group: "mine",
              });
            }
          }
        } catch {
          /* best-effort */
        }
      }

      if (!cancelled) setDirectoryAgents(mine);
    })();

    return () => {
      cancelled = true;
    };
  }, [gatewayBaseUrl, isAuthenticated, tokenGetter, user?.sub]);

  return (
    <RanchChatShell
      mode="full"
      open
      gatewayBaseUrl={gatewayBaseUrl}
      getAccessToken={tokenGetter}
      directoryAgents={directoryAgents}
      allowGroupChat
      title="Interfaze"
      connectGuideUrl="https://github.com/acnlabs/interfaze/blob/main/CONNECT.md"
      account={
        isAuthenticated && user
          ? {
              name: user.name ?? user.nickname ?? null,
              email: user.email ?? null,
              picture: user.picture ?? null,
            }
          : null
      }
      onLogout={isAuthenticated ? handleLogout : undefined}
      onReauth={isAuthenticated ? handleReauth : undefined}
    />
  );
}
