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
import { chatComputerLabel, extraIndex, type ComputerNameRow } from "./computerLabel";

type ChatPlace = {
  place: "agent" | "cloud";
  computer_id: string | null;
  is_default: boolean | null;
  has_disk: boolean;
  can_bind: boolean;
};

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
  screenOpenId,
  onOpenScreen,
}: {
  chatId: string;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  locale: RanchLocale;
  screenOpenId: string | null;
  onOpenScreen: (computerId: string, label: string) => void;
}) {
  const [place, setPlace] = useState<ChatPlace | null>(null);
  const [computers, setComputers] = useState<ComputerNameRow[]>([]);

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
  const openable = place.place === "cloud" && !!place.computer_id;
  const on = openable && screenOpenId === place.computer_id;

  return (
    <button
      type="button"
      style={headerIconStyle(on)}
      aria-pressed={openable ? on : undefined}
      aria-label={label}
      title={label}
      onClick={() => {
        if (openable && place.computer_id) onOpenScreen(place.computer_id, label);
      }}
    >
      <IconMonitor />
    </button>
  );
}
