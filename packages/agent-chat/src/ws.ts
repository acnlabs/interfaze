/** Minimal Chat Gateway WebSocket client (/ws subscribe chat_id). */

export type ChatWsEvent = {
  type: string;
  chat_id?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
};

function toWsBase(httpBase: string): string {
  if (httpBase.startsWith("https://")) return `wss://${httpBase.slice("https://".length)}`;
  if (httpBase.startsWith("http://")) return `ws://${httpBase.slice("http://".length)}`;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return httpBase;
}

export type ChatSocket = {
  subscribe: (chatId: string) => void;
  unsubscribe: (chatId: string) => void;
  close: () => void;
};

export function connectChatSocket(options: {
  gatewayBaseUrl: string;
  token: string | null;
  onEvent: (ev: ChatWsEvent) => void;
  onStatus?: (status: "connecting" | "open" | "closed" | "error") => void;
}): ChatSocket {
  const base = toWsBase(options.gatewayBaseUrl.replace(/\/+$/, ""));
  const q = options.token ? `?token=${encodeURIComponent(options.token)}` : "";
  const url = `${base}/ws${q}`;
  options.onStatus?.("connecting");

  let ws: WebSocket | null = null;
  const pending = new Set<string>();
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const clearReconnect = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const attach = (socket: WebSocket) => {
    socket.onopen = () => {
      attempt = 0;
      options.onStatus?.("open");
      pending.forEach((chatId) => {
        socket.send(JSON.stringify({ action: "subscribe", chat_id: chatId }));
      });
    };

    socket.onmessage = (msg) => {
      try {
        const data = JSON.parse(String(msg.data)) as ChatWsEvent;
        options.onEvent(data);
      } catch {
        /* ignore */
      }
    };

    socket.onerror = () => options.onStatus?.("error");
    socket.onclose = () => {
      if (closed) {
        options.onStatus?.("closed");
        return;
      }
      options.onStatus?.("closed");
      // Mode B writebacks arrive seconds later; keep the socket alive across drops.
      const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 4));
      attempt += 1;
      clearReconnect();
      reconnectTimer = setTimeout(() => {
        if (closed) return;
        options.onStatus?.("connecting");
        try {
          ws = new WebSocket(url);
          attach(ws);
        } catch {
          options.onStatus?.("error");
        }
      }, delay);
    };
  };

  try {
    ws = new WebSocket(url);
    attach(ws);
  } catch {
    options.onStatus?.("error");
    return {
      subscribe: () => undefined,
      unsubscribe: () => undefined,
      close: () => undefined,
    };
  }

  return {
    subscribe(chatId: string) {
      pending.add(chatId);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "subscribe", chat_id: chatId }));
      }
    },
    unsubscribe(chatId: string) {
      pending.delete(chatId);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "unsubscribe", chat_id: chatId }));
      }
    },
    close() {
      closed = true;
      clearReconnect();
      pending.clear();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    },
  };
}
