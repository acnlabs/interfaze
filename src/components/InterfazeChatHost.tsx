"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { RanchChatShell, type AgentDirectoryItem } from "@acnlabs/agent-chat";
import {
  AUTH0_AUDIENCE,
  AUTH0_SCOPE,
  clearAuth0ClientCache,
  isAuth0Configured,
  isSessionDeadAuthError,
} from "@/lib/auth0";
import { getGatewayBaseUrl } from "@/lib/gateway";

type ReauthOpts = {
  /** User clicked "Sign in again" — clear cache and force credentials UI. */
  forceLogin?: boolean;
};

/**
 * Interfaze host — ranch-ported shell chrome + Chat Gateway.
 * Locale is owned by RanchChatShell (switcher + localStorage + browser fallback).
 */
export default function InterfazeChatHost() {
  const { getAccessTokenSilently, isAuthenticated, user, logout, loginWithRedirect } = useAuth0();
  const gatewayBaseUrl = getGatewayBaseUrl();
  const [directoryAgents, setDirectoryAgents] = useState<AgentDirectoryItem[]>([]);
  const reauthStarted = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) reauthStarted.current = false;
  }, [isAuthenticated]);

  const handleLogout = useCallback(() => {
    clearAuth0ClientCache();
    logout({
      logoutParams: {
        returnTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
  }, [logout]);

  const handleReauth = useCallback(
    (opts?: ReauthOpts) => {
      if (reauthStarted.current) return;
      reauthStarted.current = true;
      const forceLogin = !!opts?.forceLogin;
      if (forceLogin) clearAuth0ClientCache();
      void loginWithRedirect({
        authorizationParams: {
          audience: AUTH0_AUDIENCE,
          scope: AUTH0_SCOPE,
          ...(forceLogin ? { prompt: "login" as const } : {}),
        },
        appState: {
          returnTo: typeof window !== "undefined" ? window.location.pathname : "/",
        },
      });
    },
    [loginWithRedirect],
  );

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

  // Ensure we have an API access token for the Gateway audience.
  // Prefer cache; only interactive reauth on unrecoverable Auth0 session errors.
  // Do NOT treat network / Chrome 3P-cookie iframe failures as logout.
  useEffect(() => {
    if (!isAuthenticated || !isAuth0Configured()) return;
    let cancelled = false;
    (async () => {
      try {
        const cached = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
          cacheMode: "on",
        });
        if (cancelled || cached) return;
      } catch (err) {
        if (cancelled) return;
        if (!isSessionDeadAuthError(err)) return;
        // Fall through — try a refresh once before soft reauth.
      }

      try {
        const refreshed = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
          cacheMode: "off",
        });
        if (cancelled || refreshed) return;
        // Empty token with no throw: session is half-broken (user but no API token).
        handleReauth({ forceLogin: false });
      } catch (err) {
        if (cancelled) return;
        if (isSessionDeadAuthError(err)) {
          handleReauth({ forceLogin: false });
        }
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
      try {
        // Same Chat Gateway surface as My Agents panel (JWT sub owner filter).
        const res = await fetch(`${gatewayBaseUrl}/api/chat/my-agents?limit=50`, {
          headers,
        });
        if (res.ok) {
          const data = (await res.json()) as {
            agents?: Array<{
              agent_id?: string;
              name?: string | null;
              description?: string | null;
            }>;
          };
          for (const a of data.agents ?? []) {
            const id = String(a.agent_id ?? "").trim();
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

      if (!cancelled) setDirectoryAgents(mine);
    })();

    return () => {
      cancelled = true;
    };
  }, [gatewayBaseUrl, isAuthenticated, tokenGetter]);

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
      agentPlanetBaseUrl="https://agentplanet.org"
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
      onReauth={
        isAuthenticated
          ? () => {
              handleReauth({ forceLogin: true });
            }
          : undefined
      }
      onOwnedAgentUpdated={(agent) => {
        setDirectoryAgents((prev) =>
          prev.map((a) =>
            a.agent_id === agent.agent_id ||
            a.agent_id.replace(/^acn:/i, "") === agent.agent_id.replace(/^acn:/i, "")
              ? {
                  ...a,
                  name: agent.name ?? a.name,
                  description: agent.description ?? a.description,
                }
              : a,
          ),
        );
      }}
      onOwnedAgentRemoved={(agentId) => {
        const bare = agentId.replace(/^acn:/i, "");
        setDirectoryAgents((prev) =>
          prev.filter((a) => {
            const id = a.agent_id.replace(/^acn:/i, "");
            return id !== bare && a.agent_id !== agentId;
          }),
        );
      }}
    />
  );
}
