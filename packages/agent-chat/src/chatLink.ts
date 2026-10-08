/** A chat link. It does not grant access. Only someone who can already open the chat can see it. */

export function chatPageLink(origin: string, chatId: string, blockKey?: string | null): string {
  const url = new URL("/", origin);
  url.searchParams.set("chat", chatId);
  const block = (blockKey || "").trim();
  if (block) url.searchParams.set("block", block);
  return url.toString();
}

export function chatIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get("chat")?.trim() || "";
  return id || null;
}

export function blockKeyFromSearch(search: string): string | null {
  const key = new URLSearchParams(search).get("block")?.trim() || "";
  return key || null;
}
