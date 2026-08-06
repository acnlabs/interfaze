"use client";

import { useAuth0 } from "@auth0/auth0-react";

/**
 * Auth0 redirect landing. Navigation after login is handled by
 * Auth0Provider ``onRedirectCallback`` (honors ``appState.returnTo``).
 */
export default function AuthCallbackPage() {
  const { isLoading, error } = useAuth0();

  if (error) {
    return (
      <main style={{ padding: 48 }}>
        <img
          src="/logo.png"
          alt="Interfaze"
          width={120}
          height={120}
          style={{ display: "block", width: 120, height: "auto", marginBottom: 16 }}
        />
        <p style={{ color: "#f87171" }}>{error.message}</p>
        <a href="/">Back</a>
      </main>
    );
  }

  return (
    <main style={{ padding: 48, color: "#a1a1aa" }}>
      {isLoading ? "Completing sign-in…" : "Redirecting…"}
    </main>
  );
}
