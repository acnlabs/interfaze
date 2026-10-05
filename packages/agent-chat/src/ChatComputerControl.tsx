"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { RanchLocale } from "./ranch-shell/i18n";
import { btnGhost, colors } from "./ranch-shell/styles";

function IconMonitor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function headerIconStyle(on: boolean): CSSProperties {
  return {
    ...btnGhost,
    width: 28,
    height: 28,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: on ? colors.accentSoft : "transparent",
    borderColor: on ? colors.accent : colors.border,
  };
}
import { chatComputerLabel, computerName, extraIndex, type ComputerNameRow } from "./computerLabel";

type ChatPlace = {
  place: "agent" | "cloud";
  computer_id: string | null;
  is_default: boolean | null;
  has_disk: boolean;
  can_bind: boolean;
};

const copy = {
  en: {
    agentSentence: "This private chat is on the agent's own machine.",
    cloudSentence: (name: string) => `This chat is on ${name}.`,
    bind: "Use this",
    open: "Open screen",
    kept: "This chat already has files, so it stays on its computer.",
    failed: "This computer could not be read.",
    missing: "That computer is not available.",
  },
  zh: {
    agentSentence: "这场私聊在 Agent 自己的机器上。",
    cloudSentence: (name: string) => `这场聊天在${name}。`,
    bind: "用这台",
    open: "打开屏幕",
    kept: "这场聊天已经有文件，目录留在原来的电脑上。",
    failed: "这台电脑暂时读不出来。",
    missing: "没有这台电脑。",
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

export function ChatComputerControl({
  chatId,
  gatewayBaseUrl,
  getAccessToken,
  locale,
  onOpenScreen,
}: {
  chatId: string;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  locale: RanchLocale;
  onOpenScreen: (computerId: string, label: string) => void;
}) {
  const t = copy[locale] ?? copy.en;
  const [place, setPlace] = useState<ChatPlace | null>(null);
  const [computers, setComputers] = useState<ComputerNameRow[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [placeRes, listRes] = await Promise.all([
      authed(gatewayBaseUrl, getAccessToken, `/api/chats/${encodeURIComponent(chatId)}/computer`),
      authed(gatewayBaseUrl, getAccessToken, "/api/computers"),
    ]);
    if (placeRes.status === 404) {
      setPlace(null);
      return;
    }
    if (!placeRes.ok) throw new Error(String(placeRes.status));
    setPlace((await placeRes.json()) as ChatPlace);
    if (listRes.ok) {
      const body = (await listRes.json()) as { computers?: ComputerNameRow[] };
      setComputers(Array.isArray(body.computers) ? body.computers : []);
    }
  }, [chatId, gatewayBaseUrl, getAccessToken]);

  useEffect(() => {
    let gone = false;
    setMenuOpen(false);
    setNote(null);
    load().catch(() => {
      if (!gone) setPlace(null);
    });
    return () => {
      gone = true;
    };
  }, [load]);

  if (!place) return null;

  const nth = place.computer_id ? extraIndex(computers, place.computer_id) : 0;
  const label = chatComputerLabel(place.place, place.is_default, nth, locale);
  let extraCount = 0;

  const bind = async (computerId: string) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await authed(
        gatewayBaseUrl,
        getAccessToken,
        `/api/chats/${encodeURIComponent(chatId)}/computer`,
        { method: "POST", body: JSON.stringify({ computer_id: computerId }) },
      );
      if (res.status === 409) {
        setNote(t.kept);
        return;
      }
      if (res.status === 404) {
        setNote(t.missing);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch {
      setNote(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={headerIconStyle(menuOpen)}
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-label={label}
        title={label}
      >
        <IconMonitor />
      </button>
      {menuOpen ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 6,
            width: 280,
            zIndex: 40,
            background: colors.panel,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: 13 }}>
            {place.place === "agent" ? t.agentSentence : t.cloudSentence(label)}
          </p>
          {place.can_bind
            ? computers.map((row) => {
                const rowIndex = row.is_default ? 0 : extraCount++;
                if (row.computer_id === place.computer_id) return null;
                return (
                  <button
                    key={row.computer_id}
                    type="button"
                    style={{ ...btnGhost, textAlign: "left" }}
                    disabled={busy}
                    onClick={() => void bind(row.computer_id)}
                  >
                    {t.bind} · {computerName(row.is_default, rowIndex, locale)}
                  </button>
                );
              })
            : null}
          {place.place === "cloud" && place.computer_id ? (
            <button
              type="button"
              style={btnGhost}
              onClick={() => {
                setMenuOpen(false);
                onOpenScreen(place.computer_id as string, label);
              }}
            >
              {t.open}
            </button>
          ) : null}
          {note ? <p style={{ margin: 0, color: colors.danger, fontSize: 12 }}>{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
