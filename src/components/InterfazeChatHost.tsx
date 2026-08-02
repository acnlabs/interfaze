"use client";

import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { AgentChatShell } from "@acnlabs/agent-chat";
import { AUTH0_AUDIENCE, isAuth0Configured } from "@/lib/auth0";
import { getGatewayBaseUrl } from "@/lib/gateway";

/**
 * Interfaze standalone host — full Chat Shell (1:1 / Group / picker).
 * Not the Labs Concierge assistant embed.
 */
export default function InterfazeChatHost() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const gatewayBaseUrl = getGatewayBaseUrl();

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

  return (
    <AgentChatShell
      variant="shell"
      mode="full"
      hideLauncher
      open
      gatewayBaseUrl={gatewayBaseUrl}
      getAccessToken={tokenGetter}
      allowAgentPicker
      allowGroupChat
      showGatewayStatus
      title="Interfaze"
    />
  );
}
