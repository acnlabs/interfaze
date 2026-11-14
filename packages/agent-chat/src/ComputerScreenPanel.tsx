"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RanchLocale } from "./ranch-shell/i18n";
import { colors } from "./ranch-shell/styles";
import {
  SCREEN_AWAY_PAUSE_MS,
  holdScreenAway,
  screenAwayHeld,
  screenLiveNeedsRefresh,
  screenMinutesLeft,
  screenSliceEnded,
  screenStayAwake,
  screenStreamRetries,
  subscribeScreenAway,
} from "./computerScreenLive";
import { screenLiveBox, screenPoint } from "./computerScreenPoint";

const copy = {
  en: {
    close: "Close",
    loadFailed: "Couldn’t load this computer.",
    unpaid: "Computer time is unpaid. Add credits, then open the screen again.",
    sliceEnded: "These 30 minutes are up.",
    pausedAway: "The screen paused.",
    minutesLeft: "{min} min left",
    open: "Open computer screen",
    opening: "Opening…",
    screen: "Screen",
    noScreen: "This computer has no screen yet.",
  },
  zh: {
    close: "关闭",
    loadFailed: "这台电脑暂时读不出来。",
    unpaid: "这台电脑的使用时间没付上。充进星币后再打开。",
    sliceEnded: "这 30 分钟用完了。",
    pausedAway: "画面已暂停。",
    minutesLeft: "还剩 {min} 分钟",
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

const pauseAfter = new Map<string, number>();

function armScreenPause(
  computerId: string,
  gatewayBaseUrl: string,
  getAccessToken: () => Promise<string | null>,
) {
  const previous = pauseAfter.get(computerId);
  if (previous) window.clearTimeout(previous);
  const timer = window.setTimeout(() => {
    pauseAfter.delete(computerId);
    holdScreenAway(computerId);
    void authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/pause`, {
      method: "POST",
    }).catch(() => undefined);
  }, SCREEN_AWAY_PAUSE_MS);
  pauseAfter.set(computerId, timer);
}

function disarmScreenPause(computerId: string) {
  const previous = pauseAfter.get(computerId);
  if (previous) window.clearTimeout(previous);
  pauseAfter.delete(computerId);
}

async function streamScreen(
  gatewayBaseUrl: string,
  getAccessToken: () => Promise<string | null>,
  computerId: string,
): Promise<Response> {
  const path = `/api/computers/${computerId}/screen/stream`;
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
  onUnpaid,
  onRequestOpen,
}: {
  computerId: string;
  label: string;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  locale: RanchLocale;
  onClose: () => void;
  chatId?: string | null;
  embedded?: boolean;
  onUnpaid?: () => void;
  onRequestOpen?: (run: () => void) => void;
}) {
  const t = copy[locale] ?? copy.en;
  const frameRef = useRef<HTMLDivElement>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pane, setPane] = useState<{ width: number; height: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [secondsMarkedAt, setSecondsMarkedAt] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const rememberLeft = (seconds: unknown) => {
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) return;
    const marked = Date.now();
    setSecondsLeft(Math.max(0, Math.floor(seconds)));
    setSecondsMarkedAt(marked);
    setNowMs(marked);
  };

  useEffect(() => {
    return () => {
      if (picture) URL.revokeObjectURL(picture);
    };
  }, [picture]);

  useEffect(() => {
    setLive(null);
    setSecondsLeft(null);
  }, [computerId]);

  useEffect(() => {
    disarmScreenPause(computerId);
    return () => {
      armScreenPause(computerId, gatewayBaseUrl, getAccessToken);
    };
  }, [computerId, gatewayBaseUrl, getAccessToken]);

  useEffect(() => {
    return subscribeScreenAway(() => {
      if (!screenAwayHeld(computerId)) return;
      setLive(null);
      setSecondsLeft(null);
      setNote(t.pausedAway);
    });
  }, [computerId, t.pausedAway]);

  useEffect(() => {
    if (secondsLeft == null) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    const waking = { current: false };
    const wake = async () => {
      if (waking.current || stopped || screenAwayHeld(computerId) || !screenStayAwake(document.visibilityState)) return;
      waking.current = true;
      try {
        const kept = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/keep`, {
          method: "POST",
        });
        if (stopped) return;
        if (kept.status === 402) {
          setLive(null);
          setSecondsLeft(null);
          setNote(t.unpaid);
          onUnpaid?.();
          return;
        }
        if (kept.status === 409) {
          const detail = (await kept.json().catch(() => null)) as { detail?: unknown } | null;
          if (screenSliceEnded(kept.status, detail?.detail)) {
            holdScreenAway(computerId);
            setLive(null);
            setSecondsLeft(null);
            setNote(t.sliceEnded);
          }
          return;
        }
        if (!kept.ok) return;
        const keptBody = (await kept.json()) as { screen?: boolean; seconds_left?: unknown };
        if (stopped) return;
        rememberLeft(keptBody.seconds_left);
        if (keptBody.screen !== false && !screenLiveNeedsRefresh(live)) return;
        const res = await streamScreen(gatewayBaseUrl, getAccessToken, computerId);
        if (stopped) return;
        if (!res.ok) {
          setLive(null);
          setNote(t.loadFailed);
          return;
        }
        const body = (await res.json()) as { url?: string };
        const url = typeof body.url === "string" ? body.url : "";
        if (url.startsWith("https://") && !/\s/.test(url) && url.includes("password=")) {
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
      if (!screenStayAwake(document.visibilityState)) {
        armScreenPause(computerId, gatewayBaseUrl, getAccessToken);
        return;
      }
      if (screenAwayHeld(computerId)) {
        setLive(null);
        setSecondsLeft(null);
        setNote(t.pausedAway);
        return;
      }
      disarmScreenPause(computerId);
      void wake();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [computerId, gatewayBaseUrl, getAccessToken, live, onUnpaid, t.loadFailed, t.pausedAway, t.sliceEnded, t.unpaid]);

  const showPicture = useCallback(async () => {
    const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen`);
    if (res.status === 409) {
      const detail = (await res.json().catch(() => null)) as { detail?: unknown } | null;
      setPicture((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setNote(screenSliceEnded(res.status, detail?.detail) ? t.sliceEnded : t.noScreen);
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
  }, [computerId, gatewayBaseUrl, getAccessToken, t.noScreen, t.sliceEnded]);

  const openScreen = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const opened = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen`, {
        method: "POST",
      });
      if (opened.status === 402) {
        onUnpaid?.();
        setNote(t.unpaid);
        return;
      }
      if (opened.status === 409) {
        const detail = (await opened.json().catch(() => null)) as { detail?: unknown } | null;
        if (screenSliceEnded(opened.status, detail?.detail)) {
          holdScreenAway(computerId);
          setLive(null);
          setSecondsLeft(null);
          setNote(t.sliceEnded);
          return;
        }
        throw new Error(String(opened.status));
      }
      if (!opened.ok) throw new Error(String(opened.status));
      const openedBody = (await opened.json().catch(() => null)) as { seconds_left?: unknown } | null;
      rememberLeft(openedBody?.seconds_left);
      const res = await streamScreen(gatewayBaseUrl, getAccessToken, computerId);
      if (res.ok) {
        const body = (await res.json()) as { url?: string };
        const url = typeof body.url === "string" ? body.url : "";
        if (url.startsWith("https://") && !/\s/.test(url) && url.includes("password=")) {
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
  }, [chatId, computerId, gatewayBaseUrl, getAccessToken, onUnpaid, showPicture, t.loadFailed, t.sliceEnded, t.unpaid]);

  useEffect(() => {
    if (screenAwayHeld(computerId)) {
      setLive(null);
      setSecondsLeft(null);
      setNote(t.pausedAway);
      return;
    }
    void openScreen();
  }, [openScreen, computerId, t.pausedAway]);

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

  const deskBox = () => {
    const box = screenLiveBox(pane, false);
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

  const minutesLeft =
    live && secondsLeft != null ? screenMinutesLeft(secondsLeft, secondsMarkedAt, nowMs) : null;

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
            style={{ ...deskBox(), border: 0 }}
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
            style={{ ...deskBox(), objectFit: "contain", cursor: "crosshair" }}
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
              <button
                type="button"
                onClick={() => {
                  const run = () => void openScreen();
                  if (onRequestOpen) onRequestOpen(run);
                  else run();
                }}
              >
                {t.open}
              </button>
            ) : null}
          </div>
        )}
        {minutesLeft != null ? (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 2,
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 12,
              lineHeight: "16px",
              pointerEvents: "none",
            }}
          >
            {t.minutesLeft.replace("{min}", String(minutesLeft))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
