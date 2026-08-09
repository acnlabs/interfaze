"use client";

import { Suspense, useEffect, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  exchangeWeChatCode,
  parseTokenFromCallback,
  setCnSession,
  verifyCnSessionWithBff,
} from "@/lib/auth/cn";

function WeChatCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const returnToRaw = searchParams.get("return_to") || "/";
      const returnTo =
        returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "/";
      const code = searchParams.get("code");

      try {
        // Prefer OAuth code → BFF exchange (no client-trusted JWT).
        if (code) {
          const session = await exchangeWeChatCode(code);
          setCnSession(session.access_token, session.user);
          router.replace(returnTo);
          return;
        }

        // BFF 302 redirect lands with `#token=` — verify signature via BFF before persist.
        const token = parseTokenFromCallback(window.location.search, window.location.hash);
        if (token) {
          const user = await verifyCnSessionWithBff(token);
          if (!user) {
            setError("登录凭证无效，请重试");
            return;
          }
          setCnSession(token, user);
          // Drop fragment so the JWT is not left in the address bar / history.
          if (typeof history !== "undefined") {
            history.replaceState(null, "", window.location.pathname + window.location.search);
          }
          router.replace(returnTo);
          return;
        }

        setError("未收到登录凭证，请重新登录");
      } catch (e) {
        setError(e instanceof Error ? e.message : "微信登录失败");
      }
    };
    void run();
  }, [searchParams, router]);

  if (error) {
    return (
      <main style={wrap}>
        <p style={{ color: "#f87171", marginBottom: 16 }}>{error}</p>
        <a href="/" style={{ color: "var(--accent)" }}>
          返回首页
        </a>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <p style={{ color: "var(--muted)" }}>正在登录…</p>
    </main>
  );
}

export default function WeChatCallbackPage() {
  return (
    <Suspense
      fallback={
        <main style={wrap}>
          <p style={{ color: "var(--muted)" }}>正在登录…</p>
        </main>
      }
    >
      <WeChatCallbackInner />
    </Suspense>
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
