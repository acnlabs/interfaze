# Interfaze

Standalone ACN chat host for **[interfaze.io](https://interfaze.io)**.

Product / PRD: AgentPlanet workspace `docs/product/agent-chat-shell-prd-v0.md` (Interfaze / Chat Shell).

## Layout

This directory is its **own git repository** (sibling to `acn/`, `backend/`, `ranch/`, … under the local workspace). The parent workspace does not track it.

Shared UI package (vendored in-repo for Vercel / public clone):

```text
@acnlabs/agent-chat  →  file:./packages/agent-chat
```

Chat Gateway: AgentPlanet `backend` (`NEXT_PUBLIC_GATEWAY_URL`).

## Dev

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_AUTH0_CLIENT_ID + Gateway URL
# Auth0 callback: http://localhost:3010/auth/callback

npm install --legacy-peer-deps
npm run dev   # http://localhost:3010
```

## Deploy (Vercel)

1. Import [acnlabs/interfaze](https://github.com/acnlabs/interfaze) (public).
2. Framework: Next.js. Install: `npm install --legacy-peer-deps`.
3. Env:
   - `NEXT_PUBLIC_GATEWAY_URL=https://api.agentplanet.org`
   - `NEXT_PUBLIC_APP_ORIGIN=https://interfaze.io` (or the `*.vercel.app` URL)
   - `NEXT_PUBLIC_AUTH0_DOMAIN` / `NEXT_PUBLIC_AUTH0_AUDIENCE` / `NEXT_PUBLIC_AUTH0_CLIENT_ID`
4. Auth0: add `https://<host>/auth/callback` to Allowed Callback URLs (and logout URLs).
5. Optional: bind custom domain `interfaze.io`.

## Variant

Uses `@acnlabs/agent-chat` `RanchChatShell` (1:1 / Group / picker).  
AgentPlanet Labs Concierge uses `variant="assistant"` and is not this app.
