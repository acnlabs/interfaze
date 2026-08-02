"use client";

import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const { isLoading, isAuthenticated, error } = useAuth0();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (error) return;
    if (isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, error, router]);

  if (error) {
    return (
      <main style={{ padding: 48 }}>
        <h1>Interfaze</h1>
        <p style={{ color: "#f87171" }}>{error.message}</p>
        <a href="/">Back</a>
      </main>
    );
  }

  return (
    <main style={{ padding: 48, color: "#a1a1aa" }}>
      Completing sign-in…
    </main>
  );
}
