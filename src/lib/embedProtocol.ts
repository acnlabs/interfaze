/** postMessage contract for Interfaze /embed (docs/product/interfaze-embed-v0.md). */

export const EMBED_READY = "interfaze:ready";
export const EMBED_RESIZE = "interfaze:resize";
export const EMBED_ERROR = "interfaze:error";
export const EMBED_CONTEXT = "interfaze:context";
export const EMBED_INIT = "interfaze:init";

export type EmbedToParent =
  | { type: typeof EMBED_READY; height: number; chatId: string; agentId: string }
  | { type: typeof EMBED_RESIZE; height: number }
  | { type: typeof EMBED_ERROR; code: string; message: string };

export type EmbedFromParent = {
  type: typeof EMBED_INIT | typeof EMBED_CONTEXT;
  token?: string;
  [key: string]: unknown;
};

export function postToParent(message: EmbedToParent, targetOrigin: string): void {
  if (typeof window === "undefined" || window.parent === window) return;
  const origin = targetOrigin.trim();
  if (!origin || origin === "*") return;
  try {
    window.parent.postMessage(message, origin);
  } catch {
    /* ignore */
  }
}
