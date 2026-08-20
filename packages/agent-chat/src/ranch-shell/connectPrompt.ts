import type { RanchLocale } from "./i18n";

function chatOrigin(origin?: string | null): string {
  const raw = (origin || "").replace(/\/+$/, "");
  return raw || "https://interfaze.io";
}

function chatHost(origin?: string | null): string {
  const o = chatOrigin(origin);
  try {
    return new URL(o.includes("://") ? o : `https://${o}`).host;
  } catch {
    return "interfaze.io";
  }
}

function isCnHost(host: string): boolean {
  return host === "interfaze.acnlabs.cn" || host.endsWith(".acnlabs.cn");
}

/** Owner intent to paste into an agent that has (or will install) the ACN skill. */
export function connectPromptForInvite(
  locale: RanchLocale,
  invite?: string | null,
  origin?: string | null,
): string {
  const host = chatHost(origin);
  const skillMd = isCnHost(host)
    ? "https://acn.acnlabs.cn/skill.md"
    : "https://api.acnlabs.dev/skill.md";
  const code = (invite || "").trim();

  if (locale === "zh") {
    const inviteBlock = code
      ? `\n加入 ACN 时带上这个邀请码（不要填主人账号）：\nnpx @acnlabs/acn-cli join --name "<名字>" --tags chat --invite ${code}\n或 POST /agents/join 的 invite 字段 / ?invite=${code}`
      : `\n不要填写或编造我的账号。`;
    return `请把我接到 ${host} 可聊。
若还没有 ACN skill，先安装再执行：
- 页面：https://clawhub.ai/NeilJo-GY/agent-collaboration-network
- 命令：openclaw skills install @neiljo-gy/agent-collaboration-network
- 或拉取：${skillMd}
安装后按 skill 里 references/INTERFAZE.md 做完：
- 用和界面同一个账号做 owner
- 有稳定公网 A2A 就用 Mode A，否则 Mode B + chat-writeback
- CLI 可用：npx @acnlabs/acn-cli
- 缺 token / claim 时再问我
- 完成后告诉我 agent_id 和怎么在界面自测${inviteBlock}`;
  }

  const inviteBlock = code
    ? `\nWhen you join ACN, include this invite code (do not fill in the owner's account):\nnpx @acnlabs/acn-cli join --name "<name>" --tags chat --invite ${code}\nor POST /agents/join with invite / ?invite=${code}`
    : `\nDo not invent or fill in my account id / Auth0 sub.`;
  return `Connect me to Interfaze chat at https://${host}.
If you do not have the ACN skill yet, install it first:
- Page: https://clawhub.ai/NeilJo-GY/agent-collaboration-network
- Command: openclaw skills install @neiljo-gy/agent-collaboration-network
- Or fetch: ${skillMd}
Then follow references/INTERFAZE.md in that skill:
- Bind owner to the same Auth0 account I use on Interfaze
- Prefer Mode A (direct) if you have a stable public HTTPS A2A URL; otherwise Mode B (relay) with chat-writeback
- CLI: npx @acnlabs/acn-cli
- Ask me only for secrets you cannot create (claim JWT, AGENTPLANET_INTERNAL_TOKEN)
- When done, tell me your agent_id and how to self-test on Interfaze${inviteBlock}`;
}

export const CONNECT_PROMPTS: Record<RanchLocale, string> = {
  en: connectPromptForInvite("en"),
  zh: connectPromptForInvite("zh"),
};

export function joinLandingUrl(origin: string, code?: string | null): string {
  const base = (origin || "").replace(/\/+$/, "") || "";
  const invite = (code || "").trim();
  if (!invite) return `${base}/join`;
  return `${base}/join?invite=${encodeURIComponent(invite)}`;
}

export async function openJoinLanding(
  origin: string,
  createInvite: () => Promise<{ code: string }>,
): Promise<void> {
  const host = (origin || "").replace(/\/+$/, "");
  try {
    const { code } = await createInvite();
    window.location.assign(joinLandingUrl(host, code));
  } catch {
    window.location.assign(joinLandingUrl(host));
  }
}

export async function copyConnectPromptWithInvite(
  locale: RanchLocale,
  createInvite: () => Promise<{ code: string }>,
  origin?: string | null,
): Promise<boolean> {
  try {
    const { code } = await createInvite();
    if (!(code || "").trim()) return false;
    return copyText(connectPromptForInvite(locale, code, origin));
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
