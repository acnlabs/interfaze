/** A user bubble Host parked as inbox-queued, plus the messages around it. */
export type QueuedDeliveryMessage = {
  message_id: string;
  sender_type: string;
  sender_id: string;
  created_at: string;
};

function bareAgentId(id: string): string {
  return id.replace(/^acn:/i, "").trim().toLowerCase();
}

function laterAgentIds(
  messages: readonly QueuedDeliveryMessage[],
  message: QueuedDeliveryMessage,
): Set<string> {
  const at = Date.parse(message.created_at);
  if (!Number.isFinite(at)) return new Set();
  const ids = new Set<string>();
  for (const other of messages) {
    if (other.message_id === message.message_id) continue;
    if (other.sender_type !== "agent") continue;
    const t = Date.parse(other.created_at);
    if (!Number.isFinite(t) || t <= at) continue;
    const id = bareAgentId(other.sender_id);
    if (id) ids.add(id);
  }
  return ids;
}

/** Same rollup as Host ``_aggregate_delivery``: delivered > sent > queued > all-failed > pending. */
export function aggregateDelivery(byAgent: Record<string, string>): string {
  const values = new Set(Object.values(byAgent));
  if (values.size === 0) return "pending";
  if (values.has("delivered")) return "delivered";
  if (values.has("sent")) return "sent";
  if (values.has("queued")) return "queued";
  if ([...values].every((status) => status === "failed")) return "failed";
  return "pending";
}

/**
 * Inbox ACK stores ``queued`` and waits for writeback, but writeback does not
 * clear that field. Once a later agent message exists, show that hop as delivered.
 * Only the agent that actually spoke is upgraded, so a silent group peer stays queued.
 */
export function settleQueuedDelivery(
  messages: readonly QueuedDeliveryMessage[],
  message: QueuedDeliveryMessage,
  delivery: string | null,
  byAgent: Record<string, string> | null,
): { delivery: string | null; byAgent: Record<string, string> | null } {
  const replied = laterAgentIds(messages, message);
  if (replied.size === 0) return { delivery, byAgent };

  if (byAgent && Object.keys(byAgent).length > 0) {
    const next: Record<string, string> = { ...byAgent };
    let changed = false;
    for (const [id, status] of Object.entries(next)) {
      if (status === "queued" && replied.has(bareAgentId(id))) {
        next[id] = "delivered";
        changed = true;
      }
    }
    if (!changed) return { delivery, byAgent };
    return { delivery: aggregateDelivery(next), byAgent: next };
  }

  if (delivery === "queued") return { delivery: "delivered", byAgent };
  return { delivery, byAgent };
}
