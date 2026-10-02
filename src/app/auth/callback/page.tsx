"use client";

import { useEffect, type CSSProperties } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { isCnRegion } from "@/lib/region";
import Loading from "@/components/Loading";

/**
 * Auth0 redirect landing (Global).
 * CN builds have no Auth0Provider — never call useAuth0 there.
 */
export default function AuthCallbackPage() {
  if (isCnRegion()) return <CnAuthCallbackFallback />;
  return <GlobalAuthCallback />;
}

function CnAuthCallbackFallback() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return (
    <main style={wrap}>
      <p style={{ color: "var(--muted)" }}>正在跳转…</p>
      <a href="/" style={{ color: "var(--accent)", marginTop: 12 }}>
        返回首页
      </a>
    </main>
  );
}

function GlobalAuthCallback() {
  const { isLoading, error } = useAuth0();

  if (error) {
    return (
      <main style={wrap}>
        <img
          src="/logo.png"
          alt="Interfaze"
          width={120}
          height={120}
          style={{ display: "block", width: 120, height: "auto", marginBottom: 16 }}
        />
        <p
          style={{
            color: "var(--danger)",
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 420,
            textAlign: "center",
          }}
        >
          {error.message}
        </p>
        <a
          href="/"
          style={{
            marginTop: 16,
            padding: "10px 20px",
            borderRadius: 8,
            background: "var(--accent, #3b82f6)",
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Back to Interfaze
        </a>
      </main>
    );
  }

  return (
    <main style={{ ...wrap, color: "#a1a1aa" }}>
      <Loading label={isLoading ? "Completing sign-in…" : "Redirecting…"} />
    </main>
  );
}

const wrap: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
