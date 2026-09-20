import type { RanchMessages } from "../i18n";
import type { TalkOpenResult } from "./types";

export function talkOpenErrorMessage(code: string, t: RanchMessages): string {
  if (code === "chat_closed") return t.faceChatClosed;
  if (code === "network") return t.faceChatOffline;
  if (code === "unauthorized") return t.faceChatUnauthorized;
  return t.faceChatFailed;
}

export async function openStudioTalk(args: {
  studioBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  agentId: string;
}): Promise<{ ok: true; data: TalkOpenResult } | { ok: false; code: string }> {
  const token = await args.getAccessToken();
  if (!token) return { ok: false, code: "unauthorized" };
  const origin = args.studioBaseUrl.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${origin}/api/user/talk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "omit",
      body: JSON.stringify({ intent: "open", agentId: args.agentId }),
    });
  } catch {
    return { ok: false, code: "network" };
  }
  const data = (await res.json().catch(() => null)) as TalkOpenResult | null;
  if (!res.ok || !data?.hostPath) {
    return { ok: false, code: data?.code || (res.status === 401 ? "unauthorized" : "failed") };
  }
  return { ok: true, data };
}
