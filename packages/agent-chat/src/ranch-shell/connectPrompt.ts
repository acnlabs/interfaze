import type { RanchLocale } from "./i18n";

/** Owner intent to paste into an agent that has (or will install) the ACN skill. */
export const CONNECT_PROMPTS: Record<RanchLocale, string> = {
  en: `Connect me to Interfaze chat at https://interfaze.io.
If you do not have the ACN skill yet, install it first:
- Page: https://clawhub.ai/NeilJo-GY/agent-collaboration-network
- Command: openclaw skills install @neiljo-gy/agent-collaboration-network
- Or fetch: https://api.acnlabs.dev/skill.md
Then follow references/INTERFAZE.md in that skill:
- Bind owner to the same Auth0 account I use on Interfaze
- Prefer Mode A (direct) if you have a stable public HTTPS A2A URL; otherwise Mode B (relay) with chat-writeback
- CLI: npx @acnlabs/acn-cli
- Ask me only for secrets you cannot create (claim JWT, AGENTPLANET_INTERNAL_TOKEN)
- When done, tell me your agent_id and how to self-test on Interfaze`,
  zh: `请把我接到 interfaze.io 可聊。
若还没有 ACN skill，先安装再执行：
- 页面：https://clawhub.ai/NeilJo-GY/agent-collaboration-network
- 命令：openclaw skills install @neiljo-gy/agent-collaboration-network
- 或拉取：https://api.acnlabs.dev/skill.md
安装后按 skill 里 references/INTERFAZE.md 做完：
- 用和 Interfaze 同一个账号做 owner
- 有稳定公网 A2A 就用 Mode A，否则 Mode B + chat-writeback
- CLI 可用：npx @acnlabs/acn-cli
- 缺 token / claim 时再问我
- 完成后告诉我 agent_id 和怎么在 Interfaze 自测`,
};

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
