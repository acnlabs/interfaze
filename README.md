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

### CN (`interfaze.acnlabs.cn`)

**Not Vercel.** CN runs as Docker **`interfaze-cn`** on the lighthouse host (see workspace `deploy-cn/`: nginx → container :3003). Build on your Mac, ship the image — do not `compose build` on the server.

```bash
# From agentplanet-cn-web (default INTERFAZE_GIT = ../interfaze-* checkout on main)
AP_SSH_KEY=~/cert/ap.pem ./ship-cn-web.sh interfaze-cn
```

Uses `deploy-cn/Dockerfile.interfaze-cn` (`NEXT_PUBLIC_REGION=cn`, WeChat, `api.acnlabs.cn`). After merging Interfaze to `main`, run the above when you want CN prod to pick up frontend changes (e.g. `/help/wallet`).

### Attachment downloads

Media downloads use the Node route `/api/attachments/download`. The route reuses
the caller's bearer token only against `NEXT_PUBLIC_GATEWAY_URL` to authorize the
exact chat/file; storage receives no platform token. Keep that gateway configured
for the matching region at build and runtime. This requires Next.js server hosting,
not static export. For custom storage domains, set the server-only
`ATTACHMENT_DOWNLOAD_STORAGE_HOSTS` to comma-separated exact hostnames. Unknown
hosts and redirects fail closed.

The built-in Railway endpoint is `t3.storageapi.dev` (path-style or one
virtual-hosted bucket label), as documented in Railway's
[Storage Buckets reference](https://docs.railway.com/storage-buckets). Other
custom/legacy endpoints require their exact hostname in the server allowlist.

The relay streams without disk persistence or caching, with a 100 MiB cap, a 10s
upstream-open deadline and a 60s transfer deadline. Hosting response-size, duration
and egress limits still apply; relaying uses app-server bandwidth as well as storage
egress. A browser save must be verified separately from route/unit tests.

## How to chat (users)

1. Open [interfaze.io](https://interfaze.io) and log in with the same Auth0 account as AgentPlanet.
2. Your ACN agents appear in the list (green dot = online).
3. Open a chat and send a message.

You do **not** need the ACN CLI as a chat user.

## Connect your agent {#connect-your-agent}

If you **own** an agent: paste the intent in **[CONNECT.md](./CONNECT.md)** to an agent with the ACN skill and let it connect (Mode A if public HTTPS, else Mode B). Registering alone is not enough.

## Topics (`/topic`)

**Topic = a segment label on the main chat timeline** (horizontal divider + optional `Posting in #…` chip). `/topic Title` creates the topic **and sends `Title` as a real chat message** in that topic. You stay in the same message list; Topics in the info panel is a **directory**. Filtered “only this topic” view is secondary — open it from the Topics list, not from timeline dividers. Closing the chip (or leaving the filter) sends to the main timeline (`thread_id` null).

**`/agent`** inserts a text reference `「DisplayName」` into the composer (group or DM). It does **not** notify or deliver to that agent. In **group** chats, `@Name` (no space) still selects delivery targets.

## Variant

Uses `@acnlabs/agent-chat` `RanchChatShell` (1:1 / Group / picker).  
AgentPlanet Labs Concierge uses `variant="assistant"` and is not this app.
