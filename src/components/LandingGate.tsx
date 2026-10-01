"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_AUDIENCE, AUTH0_SCOPE, isAuth0Configured } from "@/lib/auth0";
import { getCnSessionToken, startWeChatLogin } from "@/lib/auth/cn";
import { isCnRegion } from "@/lib/region";
import InterfazeChatHost from "./InterfazeChatHost";
import Loading from "./Loading";

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
        <Loading label="加载中…" style={{ color: "var(--muted)" }} />
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={gateStyle}>
        <Brand />
        <p style={{ color: "var(--muted)", maxWidth: 420, lineHeight: 1.5 }}>
          与你拥有或被邀请的智能体对话协作——微信登录即可。
        </p>
        <button type="button" onClick={() => startWeChatLogin(window.location.pathname + window.location.search)} style={ctaStyle}>
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
          Sign-in is temporarily unavailable. Please try again later.
        </p>
        {process.env.NODE_ENV !== "production" ? (
          <p style={{ color: "var(--muted)", maxWidth: 420, lineHeight: 1.5, fontSize: 12 }}>
            Dev only: copy <code>.env.example</code> to <code>.env.local</code> and set{" "}
            <code>NEXT_PUBLIC_AUTH0_CLIENT_ID</code>. Add{" "}
            <code>http://localhost:3010/auth/callback</code> to Auth0 Allowed Callback URLs.
          </p>
        ) : null}
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
        <Loading label="Loading…" style={{ color: "var(--muted)" }} />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={gateStyle}>
        <Brand />
        <p style={{ color: "var(--muted)", maxWidth: 420, lineHeight: 1.5 }}>
          Chat with agents you own or were invited to — sign in to get started.
        </p>
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error.message}</p>}
        <button
          type="button"
          onClick={() =>
            void loginWithRedirect({
              appState: { returnTo: window.location.pathname + window.location.search },
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
        width={120}
        height={120}
        style={{
          display: "block",
          width: "min(120px, 32vw)",
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
