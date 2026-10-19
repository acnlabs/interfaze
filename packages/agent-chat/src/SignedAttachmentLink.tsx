"use client";

import { useEffect, useRef, useState } from "react";

/** Re-authorize every download instead of navigating an expired signed URL. */
export function SignedAttachmentLink({ endpoint, getAccessToken, name, onError, preparingLabel = "Preparing download…",
  saveAsBlob = false, label = name, failedLabel = "Download failed. Please retry.", downloadEndpoint, compact = false }: {
  endpoint: string;
  getAccessToken: () => Promise<string | null>;
  name: string;
  onError: () => void;
  preparingLabel?: string;
  saveAsBlob?: boolean;
  label?: string;
  failedLabel?: string;
  /** Host-owned same-origin authenticated download route, when configured. */
  downloadEndpoint?: string;
  compact?: boolean;
}) {
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current?.abort(); };
  }, []);
  async function download() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFailed(false);
    let phase = "token";
    let status: number | null = null;
    let reason = "operation_failed";
    let timedOut = false;
    const expire = () => { timedOut = true; controller.abort(); };
    let timeout = setTimeout(expire, 10_000);
    let rejectAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error("Download cancelled or timed out"));
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
    });
    try {
      await Promise.race([aborted, (async () => {
      const token = await getAccessToken();
      if (controller.signal.aborted) throw new Error("Download cancelled or timed out");
      if (!token) { reason = "missing_token"; throw new Error("Login required"); }
      if (downloadEndpoint && (!downloadEndpoint.startsWith("/") || downloadEndpoint.startsWith("//") || /[\\\x00-\x20\x7f]/.test(downloadEndpoint))) {
        reason = "invalid_download_endpoint"; throw new Error("Invalid download endpoint");
      }
      phase = downloadEndpoint ? "same-origin-file-request" : "authorization-request";
      const response = await fetch(downloadEndpoint || endpoint, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      status = response.status ?? null;
      if (!response.ok) {
        reason = "http_error";
        if (downloadEndpoint) {
          const problem = await response.json().catch(() => null);
          const allowed = ["attachment_authorization_rejected", "attachment_storage_host_not_allowed", "attachment_storage_unavailable",
            "attachment_too_large", "attachment_authorization_unreachable", "attachment_metadata_invalid", "attachment_storage_unreachable",
            "download_gateway_not_configured", "not_authenticated", "invalid_attachment"];
          if (allowed.includes(problem?.error)) reason = problem.error;
        }
        throw new Error("Download unavailable");
      }
      let downloadUrl: string | undefined;
      let file: Response | undefined;
      if (downloadEndpoint) {
        file = response;
      } else {
      phase = "authorization-body";
      const body: unknown = await response.json();
      if (controller.signal.aborted) throw new Error("Download cancelled or timed out");
      phase = "signed-url";
      reason = "invalid_signed_url";
      if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string" ||
          new URL(body.url).protocol !== "https:") { reason = "invalid_signed_url"; throw new Error("Invalid download URL"); }
      reason = "operation_failed";
      downloadUrl = body.url;
      if (saveAsBlob) {
        // Do not send the platform bearer token to the object-storage host.
        phase = "file-request";
        status = null;
        file = await fetch(body.url, { signal: controller.signal, credentials: "omit" });
        status = file.status ?? null;
        if (!file.ok) { reason = "http_error"; throw new Error("File download unavailable"); }
      }
      }
      phase = "save-setup";
      const link = document.createElement("a");
      let objectUrl: string | undefined;
      if (file) {
        clearTimeout(timeout);
        timeout = setTimeout(expire, 60_000);
        phase = "file-body";
        const blob = await file.blob();
        if (controller.signal.aborted) throw new Error("Download cancelled or timed out");
        if (blob.size === 0) { reason = "empty_file"; throw new Error("Empty file response"); }
        phase = "blob-url";
        objectUrl = URL.createObjectURL(blob);
      }
      phase = "save-trigger";
      link.href = objectUrl || downloadUrl!;
      link.download = name;
      link.rel = "noreferrer";
      try {
        if (objectUrl) document.body.appendChild(link);
        link.click();
      } finally {
        if (objectUrl) {
          link.remove();
          // Give the browser time to consume the blob before releasing it.
          setTimeout(() => URL.revokeObjectURL(objectUrl!), 60_000);
        }
      }
      })()]);
    } catch (error) {
      if (mounted.current) {
        if (process.env.NODE_ENV === "development") {
          // Never log the exception object/message: browser fetch errors can
          // contain signed URLs, bearer data, or account-specific context.
          const name = error instanceof Error ? error.name : "UnknownError";
          const errorType = ["Error", "TypeError", "SyntaxError", "AbortError", "SecurityError", "NotAllowedError"].includes(name) ? name : "OtherError";
          console.warn("[attachment-download] " + JSON.stringify({
            phase, status, errorType,
            reason: timedOut ? "timeout" : controller.signal.aborted ? "cancelled"
              : reason !== "operation_failed" ? reason
              : errorType === "TypeError" && ["authorization-request", "file-request", "same-origin-file-request", "file-body"].includes(phase) ? "transport_or_policy"
              : errorType === "SyntaxError" ? "invalid_json" : "operation_failed",
          }));
        }
        setFailed(true); onError();
      }
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", rejectAbort);
      if (mounted.current) setBusy(false);
      pending.current = null;
    }
  }
  if (compact) {
    return <button type="button" disabled={busy} aria-busy={busy} aria-label={label === name ? name : `${label}: ${name}`} title={failed ? failedLabel : label} onClick={() => void download()}
      style={{ width: 32, height: 32, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#0b0d12", color: "#e8eef5",
        cursor: busy ? "wait" : "pointer", fontSize: 16, lineHeight: 1 }}>
      {busy ? "…" : "↓"}
    </button>;
  }
  return <button type="button" disabled={busy} aria-busy={busy} aria-label={label === name ? name : `${label}: ${name}`} onClick={() => void download()}
    style={{ fontSize: 13, color: "inherit", textDecoration: "underline", wordBreak: "break-all",
      background: "none", border: 0, padding: "8px 0", minHeight: 44, textAlign: "left", maxWidth: "100%",
      cursor: busy ? "wait" : "pointer" }}>
      {label}
      {busy ? <span role="status" style={{ display: "block", fontSize: 11, opacity: 0.75, textDecoration: "none" }}>{preparingLabel}</span> : null}
      {!busy && failed ? <span role="alert" style={{ display: "block", fontSize: 11 }}>{failedLabel}</span> : null}
    </button>;
}
