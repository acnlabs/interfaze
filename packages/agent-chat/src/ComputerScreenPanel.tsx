"use client";

import { useCallback, useEffect, useState } from "react";
import type { RanchLocale } from "./ranch-shell/i18n";
import { colors } from "./ranch-shell/styles";
import { screenPoint } from "./computerScreenPoint";

const copy = {
  en: {
    close: "Close",
    loadFailed: "Couldn’t load this computer.",
    open: "Open screen",
    opening: "Opening…",
    screen: "Screen",
    noScreen: "This computer has no screen yet.",
  },
  zh: {
    close: "关闭",
    loadFailed: "这台电脑暂时读不出来。",
    open: "打开屏幕",
    opening: "正在打开…",
    screen: "画面",
    noScreen: "这台电脑还没有屏幕。",
  },
} as const;

async function authed(
  gatewayBaseUrl: string,
  getAccessToken: () => Promise<string | null>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const base = gatewayBaseUrl.replace(/\/+$/, "");
  return fetch(`${base}${path}`, { ...init, headers });
}

export function ComputerScreenPanel({
  computerId,
  label,
  gatewayBaseUrl,
  getAccessToken,
  locale,
  onClose,
}: {
  computerId: string;
  label: string;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  locale: RanchLocale;
  onClose: () => void;
}) {
  const t = copy[locale] ?? copy.en;
  const [picture, setPicture] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (picture) URL.revokeObjectURL(picture);
    };
  }, [picture]);

  useEffect(() => {
    setLive(null);
  }, [computerId]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      void authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/keep`, {
        method: "POST",
      }).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [computerId, gatewayBaseUrl, getAccessToken, live]);

  const showPicture = useCallback(async () => {
    const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen`);
    if (res.status === 409) {
      setPicture((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setNote(t.noScreen);
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setPicture((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setNote(null);
  }, [computerId, gatewayBaseUrl, getAccessToken, t.noScreen]);

  const openScreen = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const opened = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen`, {
        method: "POST",
      });
      if (!opened.ok) throw new Error(String(opened.status));
      const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/stream`);
      if (res.ok) {
        const body = (await res.json()) as { url?: string };
        const url = typeof body.url === "string" ? body.url : "";
        if (url.startsWith("https://") && !/\s/.test(url) && url.includes("password=")) {
          setLive(url);
          return;
        }
      }
      setLive(null);
      await showPicture();
    } catch {
      setNote(t.loadFailed);
    } finally {
      setBusy(false);
    }
  }, [computerId, gatewayBaseUrl, getAccessToken, showPicture, t.loadFailed]);

  useEffect(() => {
    void openScreen();
  }, [openScreen]);

  const sendPointer = async (next: { x: number; y: number }) => {
    setBusy(true);
    try {
      const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/pointer`, {
        method: "POST",
        body: JSON.stringify({ x: next.x, y: next.y, text: null }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await showPicture();
    } catch {
      setNote(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: colors.bg,
        color: colors.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <strong style={{ flex: 1 }}>{label}</strong>
        <button type="button" onClick={onClose} style={{ background: "transparent", color: colors.muted, border: 0 }}>
          {t.close}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#000" }}>
        {live ? (
          <iframe
            src={live}
            title={t.screen}
            referrerPolicy="no-referrer"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "#000" }}
          />
        ) : picture ? (
          <img
            src={picture}
            alt={label}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const next = screenPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
              if (next) void sendPointer(next);
            }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000", cursor: "crosshair" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              color: colors.muted,
            }}
          >
            <p style={{ margin: 0 }}>{busy ? t.opening : note}</p>
            {!busy && note ? (
              <button type="button" onClick={() => void openScreen()}>
                {t.open}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
