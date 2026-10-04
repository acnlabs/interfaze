"use client";

import { useEffect, useRef, useState } from "react";

/** Re-authorize every download instead of navigating an expired signed URL. */
export function SignedAttachmentLink({ endpoint, getAccessToken, name, onError }: {
  endpoint: string;
  getAccessToken: () => Promise<string | null>;
  name: string;
  onError: () => void;
}) {
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current?.abort(); };
  }, []);
  async function download() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const token = await getAccessToken();
      if (controller.signal.aborted) return;
      if (!token) throw new Error("Login required");
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      if (!response.ok) throw new Error("Download unavailable");
      const body: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string" ||
          new URL(body.url).protocol !== "https:") throw new Error("Invalid download URL");
      const link = document.createElement("a");
      link.href = body.url;
      link.download = name;
      link.rel = "noreferrer";
      link.click();
    } catch {
      if (mounted.current) onError();
    } finally {
      clearTimeout(timeout);
      if (mounted.current) setBusy(false);
      pending.current = null;
    }
  }
  return <button type="button" disabled={busy} onClick={() => void download()}
    style={{ fontSize: 13, color: "inherit", textDecoration: "underline", wordBreak: "break-all",
      background: "none", border: 0, padding: 0, cursor: "pointer" }}>{name}</button>;
}
