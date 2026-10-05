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
    watch: "Watch",
    shot: "Refresh picture",
    type: "Type",
    placeholder: "Type here, then click the picture",
    hint: "This is the same computer. Opening the screen keeps the files that are already there.",
    noScreen: "This computer has no screen yet.",
  },
  zh: {
    close: "关闭",
    loadFailed: "这台电脑暂时读不出来。",
    open: "打开屏幕",
    opening: "正在打开…",
    watch: "看画面",
    shot: "刷新画面",
    type: "输入",
    placeholder: "写在这里，再点画面",
    hint: "还是这一台电脑。打开屏幕时，已经在上面的文件会留着。",
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
  const [text, setText] = useState("");
  const [point, setPoint] = useState<{ x: number; y: number }>({ x: 512, y: 384 });
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

  const openScreen = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(String(res.status));
      await showPicture();
    } catch {
      setNote(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const watchScreen = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/stream`);
      if (res.status === 409) {
        setLive(null);
        setNote(t.noScreen);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { url?: string };
      const url = typeof body.url === "string" ? body.url : "";
      if (!url.startsWith("https://") || /\s/.test(url) || !url.includes("password=")) {
        setLive(null);
        setNote(t.noScreen);
        return;
      }
      setLive(url);
    } catch {
      setNote(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const sendPointer = async (next: { x: number; y: number }, typed: string | null) => {
    setPoint(next);
    setBusy(true);
    try {
      const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${computerId}/screen/pointer`, {
        method: "POST",
        body: JSON.stringify({ x: next.x, y: next.y, text: typed || null }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (typed) setText("");
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
      <div style={{ padding: 14, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{t.hint}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={busy} onClick={() => void openScreen()}>
            {busy ? t.opening : t.open}
          </button>
          <button type="button" disabled={busy} onClick={() => void watchScreen()}>
            {t.watch}
          </button>
          <button type="button" disabled={busy} onClick={() => void showPicture().catch(() => setNote(t.loadFailed))}>
            {t.shot}
          </button>
        </div>
        {live ? (
          <iframe
            src={live}
            title={t.watch}
            referrerPolicy="no-referrer"
            style={{ width: "100%", maxWidth: 640, height: 480, border: 0, borderRadius: 8, background: "#000" }}
          />
        ) : null}
        {picture ? (
          <img
            src={picture}
            alt={label}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const next = screenPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
              if (next) void sendPointer(next, null);
            }}
            style={{ width: "100%", maxWidth: 640, background: "#000", borderRadius: 8, cursor: "crosshair" }}
          />
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const typed = text.trim();
            if (!typed) return;
            void sendPointer(point, typed.slice(0, 80));
          }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            value={text}
            maxLength={80}
            placeholder={t.placeholder}
            onChange={(event) => setText(event.target.value)}
            style={{ flex: 1, background: colors.panel, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 8 }}
          />
          <button type="submit" disabled={busy || !text.trim()}>
            {t.type}
          </button>
        </form>
        {note ? <p style={{ margin: 0, color: colors.danger, fontSize: 13 }}>{note}</p> : null}
      </div>
    </div>
  );
}
