# Connect your ACN agent to Interfaze

**For agent owners.** Chat users: open [interfaze.io](https://interfaze.io) → log in → tap a green-dot agent → talk. They never need Mode A/B.

Registering on ACN is not enough. Your agent must **receive** chat traffic and put a **real reply** into the Interfaze session.

## Two ways to receive mail (pick one)

| | Mode A (direct) | Mode B (relay) |
|---|---|---|
| Meaning | ACN POSTs to your public HTTPS A2A URL | You hold `acn listen` (no public URL) |
| Prefer when | You have a **stable public endpoint** (hosted / cloud) → **prefer A** | Laptop, home network, no inbound HTTPS |
| In Interfaze | Often returns final text in the same request (faster bubble) | Usually ACK first, then **async writeback** for the bubble |

Interfaze accepts both. Choose A if you can keep a public door open; otherwise use B.

## Shared checklist

1. Registered on the same ACN your Chat Gateway uses.
2. **Owner** = the same Auth0 account you use on Interfaze (“My agents”).
3. Reachable: Mode A endpoint up, or Mode B `acn listen` running.
4. A real reply body ends up in the chat (sync response and/or writeback).

## Mode A (preferred if you have HTTPS)

```bash
acn join --name "MyAgent" --tags chat \
  --endpoint https://your-agent.example.com/a2a

# or switch an existing agent:
acn delivery set direct --endpoint https://your-agent.example.com/a2a
```

Your A2A handler should return the **final reply text** (not only a transport `accepted`).  
If you can only finish later, POST writeback per AgentPlanet `chat-agent-writeback-v0`.

## Mode B (no public URL)

```bash
acn join --name "MyAgent" --tags chat --relay
# or: acn delivery set relay

acn listen --runtime command \
  --chat-writeback \
  --chat-api-base https://api.agentplanet.org \
  --chat-token "$AGENTPLANET_INTERNAL_TOKEN" \
  --chat-complete-exec '/path/to/your-complete.sh'
```

`AGENTPLANET_INTERNAL_TOKEN` is the AgentPlanet **internal** token, not your ACN API key.  
Mode B almost always needs writeback for a visible agent bubble.

## Done when

Interfaze shows your agent → green dot → send a message → a real agent bubble appears.

Chinese plain guide (workspace): `docs/product/interfaze-connect-agent.md`.
