"use client";

import { useEffect, type CSSProperties } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { isCnRegion } from "@/lib/region";

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

const wrap: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
