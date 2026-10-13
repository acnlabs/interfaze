"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RanchLocale } from "./ranch-shell/i18n";
import { colors } from "./ranch-shell/styles";
import { screenFitRemounts, screenLiveNeedsRefresh, screenStreamRetries } from "./computerScreenLive";
import { screenLiveBox, screenPoint } from "./computerScreenPoint";

const copy = {
  en: {
    close: "Close",
    loadFailed: "Couldn’t load this computer.",
    open: "Open computer screen",
    opening: "Opening…",
    screen: "Screen",
    noScreen: "This computer has no screen yet.",
  },
  zh: {
    close: "关闭",
    loadFailed: "这台电脑暂时读不出来。",
    open: "打开电脑屏幕",
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

async function streamScreen(
  gatewayBaseUrl: string,
  getAccessToken: () => Promise<string | null>,
  computerId: string,
  query: string,
): Promise<Response> {
  const path = `/api/computers/${computerId}/screen/stream${query}`;
  const first = await authed(gatewayBaseUrl, getAccessToken, path);
  if (!screenStreamRetries(first.status, 0)) return first;
  return authed(gatewayBaseUrl, getAccessToken, path);
}

export function ComputerScreenPanel({
  computerId,
  label,
  gatewayBaseUrl,
  getAccessToken,
  locale,
  onClose,
  chatId,
  embedded = false,
}: {
  computerId: string;
  label: string;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  locale: RanchLocale;
  onClose: () => void;
  chatId?: string | null;
  embedded?: boolean;
}) {
  const t = copy[locale] ?? copy.en;
  const frameRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef<{ width: number; height: number } | null>(null);
  const fitLock = useRef(false);
  const pendingFit = useRef<{ width: number; height: number } | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pane, setPane] = useState<{ width: number; height: number } | null>(null);
  const [fillPane, setFillPane] = useState(false);

  const paneSize = (rect: DOMRect | undefined) => {
    const width = Math.round(rect?.width ?? 0);
    const height = Math.round(rect?.height ?? 0);
    if (width < 320 || height < 240 || width > 1600 || height > 1200) return null;
    return { width, height };
  };

  useEffect(() => {
    return () => {
      if (picture) URL.revokeObjectURL(picture);
    };
  }, [picture]);

  useEffect(() => {
    setLive(null);
    setFillPane(false);
  }, [computerId]);

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    const waking = { current: false };
    const wake = async () => {
      if (waking.current || stopped) return;
      waking.current = true;
      try {
        const kept = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/keep`, {
          method: "POST",
        });
        if (!kept.ok || stopped) return;
        const keptBody = (await kept.json()) as { screen?: boolean };
        if (stopped) return;
        if (keptBody.screen !== false && !screenLiveNeedsRefresh(live)) return;
        const rect = frameRef.current?.getBoundingClientRect();
        const sized = paneSize(rect);
        const query = sized ? `?width=${sized.width}&height=${sized.height}` : "";
        const res = await streamScreen(gatewayBaseUrl, getAccessToken, computerId, query);
        if (stopped) return;
        if (!res.ok) {
          setLive(null);
          setNote(t.loadFailed);
          return;
        }
        const body = (await res.json()) as { url?: string };
        const url = typeof body.url === "string" ? body.url : "";
        if (url.startsWith("https://") && !/\s/.test(url) && url.includes("password=")) {
          fittedRef.current = sized;
          setLive(url);
          setFrameKey((key) => key + 1);
          return;
        }
        setLive(null);
        setNote(t.loadFailed);
      } catch {
        return;
      } finally {
        waking.current = false;
      }
    };
    const timer = window.setInterval(() => {
      void wake();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void wake();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [computerId, gatewayBaseUrl, getAccessToken, live, t.loadFailed]);

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
      const rect = frameRef.current?.getBoundingClientRect();
      const sized = paneSize(rect);
      const query = sized ? `?width=${sized.width}&height=${sized.height}` : "";
      const res = await streamScreen(gatewayBaseUrl, getAccessToken, computerId, query);
      if (res.ok) {
        const body = (await res.json()) as { url?: string };
        const url = typeof body.url === "string" ? body.url : "";
        if (url.startsWith("https://") && !/\s/.test(url) && url.includes("password=")) {
          fittedRef.current = sized;
          setLive(url);
          if (chatId) {
            void authed(gatewayBaseUrl, getAccessToken, `/api/chats/${chatId}/computer/folder`, {
              method: "POST",
              body: JSON.stringify({ computer_id: computerId }),
            }).catch(() => undefined);
          }
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
  }, [chatId, computerId, gatewayBaseUrl, getAccessToken, showPicture, t.loadFailed]);

  useEffect(() => {
    void openScreen();
  }, [openScreen]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const applyPane = () => {
      const rect = frame.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width > 0 && height > 0) {
        setPane((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }
    };
    applyPane();
    const paneWatch = new ResizeObserver(applyPane);
    paneWatch.observe(frame);
    return () => paneWatch.disconnect();
  }, []);

  useEffect(() => {
    if (!live) return;
    const frame = frameRef.current;
    if (!frame) return;
    let timer = 0;
    const follow = (next: { width: number; height: number }) => {
      const prev = fittedRef.current;
      if (prev && Math.abs(prev.width - next.width) < 32 && Math.abs(prev.height - next.height) < 32) return;
      if (fitLock.current) {
        pendingFit.current = next;
        return;
      }
      fitLock.current = true;
      const recover = async () => {
        const rect = frameRef.current?.getBoundingClientRect();
        const sized = paneSize(rect);
        const query = sized ? `?width=${sized.width}&height=${sized.height}` : "";
        const res = await streamScreen(gatewayBaseUrl, getAccessToken, computerId, query);
        if (!res.ok) {
          setLive(null);
          setNote(t.loadFailed);
          return;
        }
        const body = (await res.json()) as { url?: string };
        const url = typeof body.url === "string" ? body.url : "";
        if (url.startsWith("https://") && !/\s/.test(url) && url.includes("password=")) {
          fittedRef.current = sized;
          setLive(url);
          setFrameKey((key) => key + 1);
          return;
        }
        setLive(null);
        setNote(t.loadFailed);
      };
      void authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/fit`, {
        method: "POST",
        body: JSON.stringify(next),
      })
        .then(async (res) => {
          if (!res.ok) return recover();
          const body = (await res.json()) as { fitted?: unknown };
          fittedRef.current = next;
          const fitted = screenFitRemounts(body);
          setFillPane(fitted);
          if (fitted) setFrameKey((key) => key + 1);
        })
        .catch(() => recover())
        .finally(() => {
          fitLock.current = false;
          const pending = pendingFit.current;
          pendingFit.current = null;
          if (pending && (pending.width !== next.width || pending.height !== next.height)) follow(pending);
        });
    };
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = paneSize(frame.getBoundingClientRect());
        if (next) follow(next);
      }, 600);
    });
    observer.observe(frame);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [computerId, gatewayBaseUrl, getAccessToken, live]);

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

  const deskBox = (fill: boolean) => {
    const box = screenLiveBox(pane, fill);
    return box
      ? {
          position: "absolute" as const,
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          background: "#000",
        }
      : { position: "absolute" as const, inset: 0, width: "100%", height: "100%", background: "#000" };
  };

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        background: colors.bg,
        color: colors.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {embedded ? null : (
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
      )}
      <div ref={frameRef} style={{ flex: 1, minHeight: 0, position: "relative", background: "#000" }}>
        {live ? (
          <iframe
            key={frameKey}
            src={live}
            title={t.screen}
            referrerPolicy="no-referrer"
            style={{ ...deskBox(fillPane), border: 0 }}
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
            style={{ ...deskBox(false), objectFit: "contain", cursor: "crosshair" }}
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
