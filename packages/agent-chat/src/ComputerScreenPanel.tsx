"use client";

import { useCallback, useEffect, useState } from "react";
import type { RanchLocale } from "./ranch-shell/i18n";
import { colors } from "./ranch-shell/styles";
import { screenPoint } from "./computerScreenPoint";

type ComputerRow = {
  computer_id: string;
  is_default: boolean;
  status: string;
  has_disk: boolean;
};

const copy = {
  en: {
    title: "Computer",
    close: "Close",
    empty: "No computer yet. One is created when a chat needs a place to work.",
    loadFailed: "Couldn’t load this computer.",
    open: "Open screen",
    opening: "Opening…",
    shot: "Refresh picture",
    type: "Type",
    placeholder: "Type here, then click the picture",
    hint: "This is the same computer. Opening the screen keeps the files that are already there.",
    noScreen: "This computer has no screen yet.",
    defaultName: "Default computer",
    extraName: "Another computer",
  },
  zh: {
    title: "电脑",
    close: "关闭",
    empty: "还没有电脑。有对话需要干活时，会有一台。",
    loadFailed: "这台电脑暂时读不出来。",
    open: "打开屏幕",
    opening: "正在打开…",
    shot: "刷新画面",
    type: "输入",
    placeholder: "写在这里，再点画面",
    hint: "还是这一台电脑。打开屏幕时，已经在上面的文件会留着。",
    noScreen: "这台电脑还没有屏幕。",
    defaultName: "默认电脑",
    extraName: "另一台电脑",
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
  gatewayBaseUrl,
  getAccessToken,
  locale,
  onClose,
}: {
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  locale: RanchLocale;
  onClose: () => void;
}) {
  const t = copy[locale] ?? copy.en;
  const [computers, setComputers] = useState<ComputerRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [point, setPoint] = useState<{ x: number; y: number }>({ x: 512, y: 384 });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const res = await authed(gatewayBaseUrl, getAccessToken, "/api/computers");
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { computers?: ComputerRow[] };
    const rows = Array.isArray(body.computers) ? body.computers : [];
    setComputers(rows);
    setSelected((current) => current ?? rows.find((row) => row.is_default)?.computer_id ?? rows[0]?.computer_id ?? null);
  }, [gatewayBaseUrl, getAccessToken]);

  useEffect(() => {
    let gone = false;
    loadList().catch(() => {
      if (!gone) setNote(t.loadFailed);
    });
    return () => {
      gone = true;
    };
  }, [loadList, t.loadFailed]);

  useEffect(() => {
    return () => {
      if (picture) URL.revokeObjectURL(picture);
    };
  }, [picture]);

  const showPicture = useCallback(async (computerId: string) => {
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
  }, [gatewayBaseUrl, getAccessToken, t.noScreen]);

  const openScreen = async () => {
    if (!selected) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${selected}/screen`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(String(res.status));
      await showPicture(selected);
    } catch {
      setNote(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const sendPointer = async (next: { x: number; y: number }, typed: string | null) => {
    if (!selected) return;
    setPoint(next);
    setBusy(true);
    try {
      const res = await authed(gatewayBaseUrl, getAccessToken, `/api/computers/${selected}/screen/pointer`, {
        method: "POST",
        body: JSON.stringify({ x: next.x, y: next.y, text: typed || null }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (typed) setText("");
      await showPicture(selected);
    } catch {
      setNote(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const current = computers.find((row) => row.computer_id === selected) ?? null;

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
        <strong style={{ flex: 1 }}>{t.title}</strong>
        <button type="button" onClick={onClose} style={{ background: "transparent", color: colors.muted, border: 0 }}>
          {t.close}
        </button>
      </div>
      <div style={{ padding: 14, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{t.hint}</p>
        {computers.length === 0 ? <p style={{ margin: 0 }}>{t.empty}</p> : null}
        {computers.length > 1 ? (
          <select
            value={selected ?? ""}
            onChange={(event) => {
              setSelected(event.target.value);
              setPicture(null);
              setNote(null);
            }}
            style={{ background: colors.panel, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 8 }}
          >
            {computers.map((row) => (
              <option key={row.computer_id} value={row.computer_id}>
                {row.is_default ? t.defaultName : t.extraName}
              </option>
            ))}
          </select>
        ) : current ? (
          <div style={{ fontSize: 13 }}>{current.is_default ? t.defaultName : t.extraName}</div>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={!selected || busy} onClick={() => void openScreen()}>
            {busy ? t.opening : t.open}
          </button>
          <button type="button" disabled={!selected || busy} onClick={() => selected && void showPicture(selected)}>
            {t.shot}
          </button>
        </div>
        {picture ? (
          <img
            src={picture}
            alt={t.title}
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
          <button type="submit" disabled={!selected || busy || !text.trim()}>
            {t.type}
          </button>
        </form>
        {note ? <p style={{ margin: 0, color: colors.danger, fontSize: 13 }}>{note}</p> : null}
      </div>
    </div>
  );
}
