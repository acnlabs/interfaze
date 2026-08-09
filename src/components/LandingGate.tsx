"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_AUDIENCE, AUTH0_SCOPE, isAuth0Configured } from "@/lib/auth0";
import { getCnSessionToken, startWeChatLogin } from "@/lib/auth/cn";
import { isCnRegion } from "@/lib/region";
import InterfazeChatHost from "./InterfazeChatHost";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? (isCnRegion() ? "界面" : "Interfaze");

export default function LandingGate() {
  if (isCnRegion()) return <CnLandingGate />;
  return <GlobalLandingGate />;
}

function CnLandingGate() {
  const [hydrated, setHydrated] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getCnSessionToken()));
    setHydrated(true);
    const onStorage = () => setAuthed(Boolean(getCnSessionToken()));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!hydrated) {
    return (
      <main style={gateStyle}>
        <Brand />
        <p style={{ color: "var(--muted)" }}>加载中…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={gateStyle}>
        <Brand />
        <p style={{ color: "var(--muted)", maxWidth: 420, lineHeight: 1.5 }}>
          与你拥有或被邀请的 ACN 智能体对话协作——微信登录即可。
        </p>
        <button type="button" onClick={() => startWeChatLogin("/")} style={ctaStyle}>
          微信登录
        </button>
      </main>
    );
  }

  return <InterfazeChatHost />;
}

function GlobalLandingGate() {
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
        <button
          type="button"
          onClick={() =>
            void loginWithRedirect({
              authorizationParams: {
                audience: AUTH0_AUDIENCE,
                scope: AUTH0_SCOPE,
              },
            })
          }
          style={ctaStyle}
        >
          Log in to {siteName}
        </button>
      </main>
    );
  }

  return <InterfazeChatHost />;
}

function Brand() {
  return (
    <div style={{ margin: "0 0 8px" }}>
      <img
        src="/logo.png"
        alt={siteName}
        width={220}
        height={220}
        style={{
          display: "block",
          width: "min(220px, 56vw)",
          height: "auto",
          objectFit: "contain",
        }}
      />
    </div>
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
    "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(34,211,238,0.14), transparent 55%), var(--bg)",
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
