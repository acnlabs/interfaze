"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { RanchChatShell, type AgentDirectoryItem } from "@acnlabs/agent-chat";
import { AUTH0_AUDIENCE, isAuth0Configured } from "@/lib/auth0";
import { getGatewayBaseUrl } from "@/lib/gateway";

const OFFICIAL_FALLBACK: AgentDirectoryItem[] = [
  {
    agent_id: "sys:nova",
    name: "Nova",
    description: "Official system assistant",
    group: "recommended",
  },
  {
    agent_id: "sys:coder",
    name: "Coder",
    description: "Official coding assistant",
    group: "recommended",
  },
];

/**
 * Interfaze host — ranch-ported shell chrome + Chat Gateway.
 */
export default function InterfazeChatHost() {
  const { getAccessTokenSilently, isAuthenticated, user, logout } = useAuth0();
  const gatewayBaseUrl = getGatewayBaseUrl();
  const [directoryAgents, setDirectoryAgents] = useState<AgentDirectoryItem[]>(OFFICIAL_FALLBACK);

  const handleLogout = useCallback(() => {
    logout({ logoutParams: { returnTo: typeof window !== "undefined" ? window.location.origin : undefined } });
  }, [logout]);

  const tokenGetter = useCallback(async () => {
    if (!isAuth0Configured() || !isAuthenticated) return null;
    try {
      return await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE, scope: "openid profile email" },
      });
    } catch {
      return null;
    }
  }, [getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      const token = await tokenGetter();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const mine: AgentDirectoryItem[] = [];
      const recommended: AgentDirectoryItem[] = [...OFFICIAL_FALLBACK];

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
              if (!id) continue;
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

      try {
        const res = await fetch(`${gatewayBaseUrl}/api/agents?source=system&limit=20`, { headers });
        if (res.ok) {
          const data = (await res.json()) as
            | { agents?: Array<Record<string, unknown>> }
            | Array<Record<string, unknown>>;
          const list = Array.isArray(data) ? data : (data.agents ?? []);
          const seen = new Set(recommended.map((r) => r.agent_id));
          for (const a of list) {
            const id = String(a.agent_id ?? a.id ?? "").trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            recommended.push({
              agent_id: id,
              name:
                typeof a.name === "string"
                  ? a.name
                  : typeof a.display_name === "string"
                    ? a.display_name
                    : null,
              description: typeof a.description === "string" ? a.description : null,
              group: "recommended",
            });
          }
        }
      } catch {
        /* keep fallback */
      }

      if (!cancelled) setDirectoryAgents([...mine, ...recommended]);
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
    />
  );
}
