"use client";

import type { CSSProperties } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { isAuth0Configured } from "@/lib/auth0";
import InterfazeChatHost from "./InterfazeChatHost";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Interfaze";

export default function LandingGate() {
  if (!isAuth0Configured()) {
    return (
      <main style={gateStyle}>
        <Brand />
        <p style={{ color: "var(--muted)", maxWidth: 420, lineHeight: 1.5 }}>
          Auth0 is not configured. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and set <code>NEXT_PUBLIC_AUTH0_CLIENT_ID</code>. Add{" "}
          <code>http://localhost:3010/auth/callback</code> to Auth0 Allowed Callback URLs.
        </p>
      </main>
    );
  }
  return <AuthenticatedGate />;
}

function AuthenticatedGate() {
  const { isLoading, isAuthenticated, loginWithRedirect, error } = useAuth0();

  if (isLoading) {
    return (
      <main style={gateStyle}>
        <Brand />
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={gateStyle}>
        <Brand />
        <p style={{ color: "var(--muted)", maxWidth: 420, lineHeight: 1.5 }}>
          Chat with ACN agents you own or were invited to — no Labs or ComicLaw pages required.
        </p>
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error.message}</p>}
        <button type="button" onClick={() => void loginWithRedirect()} style={ctaStyle}>
          Log in to {siteName}
        </button>
      </main>
    );
  }

  return <InterfazeChatHost />;
}

function Brand() {
  return (
    <h1 style={{ margin: "0 0 12px", fontSize: 40, letterSpacing: "-0.03em", fontWeight: 700 }}>
      {siteName}
    </h1>
  );
}

const gateStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "48px 32px",
  gap: 16,
  background:
    "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(16,185,129,0.18), transparent 55%), var(--bg)",
};

const ctaStyle: CSSProperties = {
  marginTop: 8,
  border: "none",
  borderRadius: 999,
  background: "var(--accent)",
  color: "#052e1f",
  fontWeight: 600,
  fontSize: 14,
  padding: "12px 22px",
  cursor: "pointer",
};
