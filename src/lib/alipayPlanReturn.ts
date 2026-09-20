"use client";

import { useEffect, useRef, useState } from "react";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { PLAN_ACTIVATED_EVENT } from "@/lib/paypalPlanReturn";

const ALIPAY_RETURN_KEYS = [
  "alipay",
  "out_trade_no",
  "trade_no",
  "total_amount",
  "seller_id",
  "charset",
  "sign",
  "sign_type",
  "timestamp",
  "method",
  "auth_app_id",
  "version",
  "app_id",
];

function stripAlipayQuery() {
  const sp = new URLSearchParams(window.location.search);
  for (const key of ALIPAY_RETURN_KEYS) sp.delete(key);
  const q = sp.toString();
  window.history.replaceState(
    null,
    "",
    q ? `${window.location.pathname}?${q}` : window.location.pathname,
  );
}

/**
 * After Alipay page-pay, land on `/?account=plan&alipay=success&out_trade_no=…`.
 * Capture here (chat host) so we never bounce through `/subscribe`.
 */
export function useAlipayPlanReturn(opts: {
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
    const alipay = (sp.get("alipay") || "").toLowerCase();
    const outTradeNo = (sp.get("out_trade_no") || "").trim();

    if (alipay !== "success" || !outTradeNo) return;
    setPanel("plan");
    if (!enabled) return;
    if (doneRef.current === outTradeNo) return;
    if (inflightRef.current === outTradeNo) return;
    inflightRef.current = outTradeNo;
    let cancelled = false;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          inflightRef.current = null;
          return;
        }
        const res = await fetch(`${gateway}/api/users/me/wallet/alipay/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ out_trade_no: outTradeNo }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          status?: string;
          detail?: string;
        };
        if (!res.ok) {
          throw new Error(body.detail || `Capture failed (${res.status})`);
        }
        if (cancelled) return;
        doneRef.current = outTradeNo;
        stripAlipayQuery();
        window.dispatchEvent(new Event(PLAN_ACTIVATED_EVENT));
      } catch {
        if (!cancelled) stripAlipayQuery();
      } finally {
        if (inflightRef.current === outTradeNo) inflightRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      if (inflightRef.current === outTradeNo) inflightRef.current = null;
    };
  }, [enabled, getAccessToken, gateway]);

  return panel;
}
