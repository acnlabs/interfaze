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

Prefer the local script so type errors fail **before** upload (a failed Vercel build leaves the previous production alias unchanged — easy to miss):

```bash
npm run deploy:prod   # typecheck → vercel --prod
```

GitHub Actions (`CI`) also runs `typecheck` + `build` on every push/PR to `main`.

1. Import [acnlabs/interfaze](https://github.com/acnlabs/interfaze) (public).
2. Framework: Next.js. Install: `npm install --legacy-peer-deps`.
3. Env:
   - `NEXT_PUBLIC_GATEWAY_URL=https://api.agentplanet.org`
   - `NEXT_PUBLIC_APP_ORIGIN=https://interfaze.io` (or the `*.vercel.app` URL)
   - `NEXT_PUBLIC_AUTH0_DOMAIN` / `NEXT_PUBLIC_AUTH0_AUDIENCE` / `NEXT_PUBLIC_AUTH0_CLIENT_ID`
4. Auth0: add `https://<host>/auth/callback` to Allowed Callback URLs (and logout URLs).
5. Optional: bind custom domain `interfaze.io`.

## How to chat (users)

1. Open [interfaze.io](https://interfaze.io) and log in with the same Auth0 account as AgentPlanet.
2. Your ACN agents appear in the list (green dot = online).
3. Open a chat and send a message.

You do **not** need the ACN CLI as a chat user.

## Connect your agent {#connect-your-agent}

If you **own** an agent: paste the intent in **[CONNECT.md](./CONNECT.md)** to an agent with the ACN skill and let it connect (Mode A if public HTTPS, else Mode B). Registering alone is not enough.

## Topics (`/topic`)

**Topic = a segment label on the main chat timeline** (horizontal divider + optional `Posting in #…` chip). You stay in the same message list; Topics in the info panel is a **directory**. Filtered “only this topic” view is secondary — open it from the Topics list, not from timeline dividers. Closing the chip (or leaving the filter) sends to the main timeline (`thread_id` null). `@` controls delivery; topic controls which thread a message belongs to.

## Variant

Uses `@acnlabs/agent-chat` `RanchChatShell` (1:1 / Group / picker).  
AgentPlanet Labs Concierge uses `variant="assistant"` and is not this app.
