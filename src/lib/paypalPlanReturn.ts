"use client";

import { useEffect, useRef, useState } from "react";
import { getGatewayBaseUrl } from "@/lib/gateway";

/** Same-window ping so Plan & Usage can refetch after capture. */
export const PLAN_ACTIVATED_EVENT = "interfaze:plan-activated";

function stripPaypalQuery() {
  const sp = new URLSearchParams(window.location.search);
  for (const key of ["paypal", "token", "PayerID"]) sp.delete(key);
  const q = sp.toString();
  window.history.replaceState(
    null,
    "",
    q ? `${window.location.pathname}?${q}` : window.location.pathname,
  );
}

/**
 * After PayPal approve, land on `/?account=plan&paypal=success&token=…`.
 * Capture here (chat host) so we never bounce through `/subscribe`.
 */
export function usePaypalPlanReturn(opts: {
  getAccessToken: () => Promise<string | null>;
  gatewayBaseUrl?: string;
  enabled: boolean;
}): "plan" | null {
  const [panel, setPanel] = useState<"plan" | null>(null);
  const gateway = opts.gatewayBaseUrl || getGatewayBaseUrl();
  const doneRef = useRef<string | null>(null);
  const inflightRef = useRef<string | null>(null);
  const { getAccessToken, enabled } = opts;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const paypal = (sp.get("paypal") || "").toLowerCase();
    const orderId = (sp.get("token") || "").trim();

    if (paypal === "cancel") {
      setPanel("plan");
      stripPaypalQuery();
      return;
    }
    if (paypal !== "success" || !orderId) return;
    setPanel("plan");
    if (!enabled) return;
    if (doneRef.current === orderId) return;
    if (inflightRef.current === orderId) return;
    inflightRef.current = orderId;
    let cancelled = false;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          inflightRef.current = null;
          return;
        }
        const res = await fetch(`${gateway}/api/users/me/wallet/paypal/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ order_id: orderId }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          status?: string;
          detail?: string;
        };
        if (!res.ok) {
          throw new Error(body.detail || `Capture failed (${res.status})`);
        }
        if (cancelled) return;
        doneRef.current = orderId;
        stripPaypalQuery();
        window.dispatchEvent(new Event(PLAN_ACTIVATED_EVENT));
      } catch {
        if (!cancelled) stripPaypalQuery();
      } finally {
        if (inflightRef.current === orderId) inflightRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      if (inflightRef.current === orderId) inflightRef.current = null;
    };
  }, [enabled, getAccessToken, gateway]);

  return panel;
}
