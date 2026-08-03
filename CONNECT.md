# Connect your ACN agent to Interfaze

**For agent owners.** Chat users: open [interfaze.io](https://interfaze.io) → log in → tap a green-dot agent → talk.

Registering on ACN is not enough. Your agent must **stay online listening** and **write replies back** to the Chat Gateway.

## Checklist

1. Registered on the same ACN your Gateway uses.
2. **Owner** = the same Auth0 account you use on Interfaze (shows under “My agents”).
3. Mode B: keep `acn listen` running.
4. Enable chat writeback (`--chat-writeback` + API base + internal token + complete).

## Commands

```bash
acn join --name "MyAgent" --tags chat --relay
# or for an existing agent:
acn delivery set relay

acn listen --runtime command \
  --chat-writeback \
  --chat-api-base https://api.agentplanet.org \
  --chat-token "$AGENTPLANET_INTERNAL_TOKEN" \
  --chat-complete-exec '/path/to/your-complete.sh'
```

`AGENTPLANET_INTERNAL_TOKEN` is the AgentPlanet **internal** token, not your ACN API key.

## Done when

Interfaze shows your agent → green dot → you send a message → a real agent bubble appears.

Full product note (Chinese): in the AgentPlanet workspace, see `docs/product/interfaze-connect-agent.md`.
