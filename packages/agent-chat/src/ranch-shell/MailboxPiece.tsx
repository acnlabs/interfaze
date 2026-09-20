"use client";

import { useEffect, useState } from "react";
import type { GatewayClient } from "../gateway";
import type { ChatMessage, PieceHold } from "../types";
import type { RanchMessages } from "./i18n";
import { colors } from "./styles";

const MBX = "mbx:";

export function parseMailboxRefs(raw: unknown): string[] {
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [raw];
    } catch {
      items = [raw];
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const s = typeof item === "string" ? item.trim() : "";
    if (!s.startsWith(MBX)) continue;
    const id = s.slice(MBX.length).trim();
    if (!id || id.includes("/") || id.includes("..") || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function pieceFromMetadata(meta: ChatMessage["metadata"]): PieceHold | null {
  const raw = meta?.piece;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const holdId = typeof rec.hold_id === "string" ? rec.hold_id.trim() : "";
  if (!holdId) return null;
  const status = typeof rec.status === "string" ? rec.status : "";
  const occupied = rec.occupied === true || status === "held";
  const amount = Number(rec.amount);
  return {
    hold_id: holdId,
    hop_id: typeof rec.hop_id === "string" ? rec.hop_id : undefined,
    claimed: Number.isFinite(Number(rec.claimed)) ? Number(rec.claimed) : undefined,
    attachments: Number.isFinite(Number(rec.attachments))
      ? Number(rec.attachments)
      : undefined,
    billable: Number.isFinite(Number(rec.billable)) ? Number(rec.billable) : undefined,
    unit_credits: Number.isFinite(Number(rec.unit_credits))
      ? Number(rec.unit_credits)
      : undefined,
    amount: Number.isFinite(amount) ? amount : undefined,
    status,
    occupied,
    reject_deadline:
      typeof rec.reject_deadline === "string" ? rec.reject_deadline : null,
  };
}

function MailboxFile({
  chatId,
  attachmentId,
  client,
}: {
  chatId: string;
  attachmentId: string;
  client: GatewayClient;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [kind, setKind] = useState<"image" | "video" | "other">("other");

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void client
      .fetchChatFile(chatId, attachmentId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        const t = (blob.type || "").toLowerCase();
        setKind(t.startsWith("video/") ? "video" : t.startsWith("image/") ? "image" : "other");
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, chatId, attachmentId]);

  if (!src) return null;
  if (kind === "video") {
    return (
      <video
        src={src}
        controls
        playsInline
        style={{ display: "block", maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={{ display: "block", maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
    />
  );
}

export function MailboxPiece({
  chatId,
  message,
  client,
  t,
}: {
  chatId: string;
  message: ChatMessage;
  client: GatewayClient;
  t: RanchMessages;
}) {
  const refs = parseMailboxRefs(message.attachments);
  const [piece, setPiece] = useState<PieceHold | null>(() => pieceFromMetadata(message.metadata));

  useEffect(() => {
    setPiece(pieceFromMetadata(message.metadata));
  }, [message.message_id, message.metadata]);

  if (refs.length === 0 && !piece) return null;

  const amount = piece?.amount && piece.amount > 0 ? piece.amount : null;
  let statusLine: string | null = null;
  if (piece?.status === "captured") statusLine = t.pieceCaptured;
  else if (piece?.status === "held" && amount != null) statusLine = t.pieceHeld(amount);

  return (
    <div style={{ width: "100%" }}>
      {refs.map((id) => (
        <MailboxFile key={id} chatId={chatId} attachmentId={id} client={client} />
      ))}
      {statusLine ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
            paddingLeft: 4,
            fontSize: 11,
            lineHeight: 1.35,
            color: colors.muted,
            flexWrap: "wrap",
          }}
        >
          <span>{statusLine}</span>
        </div>
      ) : null}
    </div>
  );
}
