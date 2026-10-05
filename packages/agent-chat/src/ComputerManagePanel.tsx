"use client";

import { useCallback, useEffect, useState } from "react";
import type { RanchLocale } from "./ranch-shell/i18n";
import { colors } from "./ranch-shell/styles";
import { computerName, type ComputerNameRow } from "./computerLabel";

type ComputerRow = ComputerNameRow & {
  status: string;
  has_disk: boolean;
};

const copy = {
  en: {
    title: "Manage computers",
    close: "Close",
    hint: "New chats use the default computer. Another computer costs 100 credits and does not take new chats on its own.",
    empty: "No computer yet. One is created when a chat needs a place to work.",
    open: "Open another",
    opening: "Opening…",
    short: "Not enough credits. No computer was opened.",
    failed: "The computer list could not be loaded.",
    files: "Has files",
    emptyDisk: "No files yet",
    idle: "Idle",
    running: "On",
  },
  zh: {
    title: "管理电脑",
    close: "关闭",
    hint: "新对话进默认电脑。再开一台要 100 积分，也不会自动接新对话。",
    empty: "还没有电脑。有对话需要干活时，会有一台。",
    open: "再开一台",
    opening: "正在开…",
    short: "积分不够，没有新开电脑。",
    failed: "电脑列表暂时读不出来。",
    files: "已有文件",
    emptyDisk: "还没有文件",
    idle: "空闲",
    running: "开着",
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

function statusLabel(status: string, t: (typeof copy)[RanchLocale]): string {
  if (status === "idle") return t.idle;
  if (status === "running") return t.running;
  return status;
}

export function ComputerManagePanel({
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
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const res = await authed(gatewayBaseUrl, getAccessToken, "/api/computers");
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { computers?: ComputerRow[] };
    setComputers(Array.isArray(body.computers) ? body.computers : []);
  }, [gatewayBaseUrl, getAccessToken]);

  useEffect(() => {
    let gone = false;
    loadList().catch(() => {
      if (!gone) setNote(t.failed);
    });
    return () => {
      gone = true;
    };
  }, [loadList, t.failed]);

  const openAnother = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await authed(gatewayBaseUrl, getAccessToken, "/api/computers", { method: "POST" });
      if (res.status === 402) {
        setNote(t.short);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      await loadList();
    } catch {
      setNote(t.failed);
    } finally {
      setBusy(false);
    }
  };

  let extraCount = 0;

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
        {computers.map((row) => {
          const nth = row.is_default ? 0 : extraCount++;
          return (
            <div
              key={row.computer_id}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <strong>{computerName(row.is_default, nth, locale)}</strong>
              <span style={{ color: colors.muted, fontSize: 12 }}>
                {statusLabel(row.status, t)} · {row.has_disk ? t.files : t.emptyDisk}
              </span>
            </div>
          );
        })}
        <button type="button" disabled={busy} onClick={() => void openAnother()}>
          {busy ? t.opening : t.open}
        </button>
        {note ? <p style={{ margin: 0, color: colors.danger, fontSize: 13 }}>{note}</p> : null}
      </div>
    </div>
  );
}
