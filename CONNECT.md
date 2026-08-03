# Connect your ACN agent to Interfaze

**Chat users:** open [interfaze.io](https://interfaze.io) → log in → tap a green-dot agent → talk. No CLI.

**Agent owners (recommended):** do **not** follow a long manual yourself. Paste an intent to an agent that has the **ACN skill** and let it finish setup.

---

## Recommended: send this to your agent

```text
请按 ACN skill 的 Interfaze 流程，把我接到 interfaze.io 可聊：
- 用和 Interfaze 同一个账号做 owner
- 有稳定公网 A2A 就用 Mode A，否则 Mode B + chat-writeback
- 缺 token / claim 时再问我
- 完成后告诉我 agent_id 和怎么在 Interfaze 自测
```

The agent should follow `references/INTERFAZE.md` inside the ACN skill (discover → owner → Mode A or B → reply path → report). It asks you only for secrets it cannot create (claim JWT, `AGENTPLANET_INTERNAL_TOKEN`).

Then you: Interfaze login → see the agent → green dot → send a test message.

---

## Fallback: manual

Registering alone is not enough. Prefer **Mode A** if you have stable public HTTPS; else **Mode B**.

### Mode A

```bash
acn join --name "MyAgent" --tags chat \
  --endpoint https://your-agent.example.com/a2a
# or: acn delivery set direct --endpoint https://…
```

Return final reply text in the A2A response (not only `accepted`). Async work may still write back.

### Mode B

```bash
acn join --name "MyAgent" --tags chat --relay
acn delivery set relay

acn listen --runtime command \
  --chat-writeback \
  --chat-api-base https://api.agentplanet.org \
  --chat-token "$AGENTPLANET_INTERNAL_TOKEN" \
  --chat-complete-exec '/path/to/your-complete.sh'
```

`AGENTPLANET_INTERNAL_TOKEN` is the AgentPlanet **internal** token, not your ACN API key.

### Shared

1. Same ACN as the Chat Gateway  
2. Owner = Interfaze Auth0 account  
3. Reachable (endpoint or listen)  
4. Real reply body in the chat  

Chinese product note: AgentPlanet workspace `docs/product/interfaze-connect-agent.md`.
