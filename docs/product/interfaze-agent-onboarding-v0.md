# Interfaze · Agent 接入 / 创建 / 认领 v0

**Status:** Draft · **Ready to implement P0**（P1/P2 须先满足本文门禁再开工）  
**Date:** 2026-08-19 · **Rev:** 2026-08-19 审核修订  
**Canonical:** 本文件（`docs/product/interfaze-agent-onboarding-v0.md`）。`interfaze/docs/product/` 若有副本须同步，冲突以本文件为准。  
**Product:** [Interfaze](https://interfaze.io)（独立仓 `interfaze/`）  
**Parent:** [interfaze-acn-agent-management-v0](./interfaze-acn-agent-management-v0.md)  
**Related:** [interfaze-connect-agent.md](./interfaze-connect-agent.md) · Gift v1（`/transfer/accept`）· ACN `POST /agents/join` · [agent-cultivator-prd-v0](./agent-cultivator-prd-v0.md) §6.1b AgentMother  
**Code:** Gateway `backend/app/api/chat_gateway.py` · UI `packages/agent-chat` + `interfaze/` · ACN `acn/acn/routes/registry.py`

> **一句话：** Interfaze 是人拥有一只可聊 agent 的主入口。两条动作——**接入已有**与**创建新的**——都在站内认领，认领成功后开聊。

---

## 0. 已锁定决策

| # | 决策 |
|---|---|
| D1 | 认领必须登录 **与 Interfaze 同一账号**（全球 Auth0 / 中国区微信）。「我的 Agents」只认这个 owner。 |
| D2 | 首次认领 ≠ Gift。Gift 仍是 `/transfer/accept?invite=`（已有主人转让）。首次认领是 `unclaimed → owner`，走 `/claim/[id]?token=`。 |
| D3 | 自己认领：持有 `token` 的人先到先得 + 一次性。邀请别人接入：**不把 claim token 放进分享链接**；分享的是 join 落地页。 |
| D4 | Interfaze 认领页 **不要求** 发推 / 发朋友圈（AgentPlanet 页上的分享只是 UI，ACN 不强制）。 |
| D5 | 两条并列入口，不按「有没有旧 agent」分支：**接入已有** · **创建新的**。空态和「我的 Agents」列表顶栏都露出。 |
| D6 | 创建 = 消费级一键（名字 + 可选一句话）→ AgentMother 部署 → ACN 注册 → 当前账号自动认领 → 开聊。不搬 AM 控制台。 |
| D7 | 邀请奖励（人→人、合格事件）= **P3**，本文件不实现。P1 只做邀请对象与归因，不发钱。 |
| D8 | 不把 `FRONTEND_BASE_URL` 整站改成 Interfaze。认领 URL 单独用 `INTERFAZE_BASE_URL`。删除确认等仍走 AgentPlanet。 |
| D9 | ACN `POST /agents/{id}/claim` **不是**幂等。已 `CLAIMED` 会 `ValueError`。主人重复点认领由 **Gateway 短回路**处理，禁止「原样转发 ACN 并当幂等」。 |
| D10 | 人侧邀请归因的权威在 **Host**。Agent 只能带 Host 签发的 `invite` code；**禁止** agent 自报 `owner` / `sub`。自己用自己的码记 `self`，P3 排除。 |
| D11 | **禁止**用 `POST /agents/join/internal` 创建用户可见 agent（该入口写死 `visibility=test`，供探针用）。P2 走受控 join，visibility 显式 `real` 或产品选定的非 `test` 值。 |
| D12 | P2 认领不得依赖「工单开始时那张人 JWT 还活着」。异步部署要用 **ACN internal 按 `owner_sub` 绑定**（仅 Host），或部署足够快时在**同一登录请求内**同步认领。Internal 绑定必须带 **该工单 join 时存下的 verification_code**，禁止「只要 internal + 任意 agent_id」乱绑。 |
| D13 | P0 验收与投递解耦：认领成功 + 「我的」可见 + 能建 1:1 即可。第一条回复走 CONNECT 既有验收，不挡认领上线。 |
| D14 | P2 v0 额度：同一 region 每账号最多 **3** 只由本路径创建的托管 agent（含工单中的 queued/deploying）。超则拒。付费扩容以后接 Plan，本切片不售卖。仅 `5/min` API 限流不够。 |

---

## 1. 问题

主产品是 Interfaze，但人走到「拥有一只可聊的 agent」仍被切开：

1. `acn join` 返回的 `claim_url` 落在 AgentPlanet `/claim/[id]?token=`。认领完还要自己找回 Interfaze 才能聊。  
2. Interfaze 空态只有「复制给 agent 的提示词」。接入没有落地页，也不能分享；创建新 agent 不存在。  
3. Gift v1 已站内，但那是转让，不是首次认领，也不是创建。

---

## 2. 用户故事（按切片）

1. **P0 接入后认领：** 作为主人，我的 agent 加入 ACN 后给我的链接打开就是 Interfaze；登录后认领，然后进入与它的会话（投递未就绪也不回滚认领）。  
2. **P1 接入 / 邀请：** 作为主人，我可以在 Interfaze 复制提示词、复制/出示链接或二维码，把自己或别人的已有 agent 接入；别人打开的是落地页，不是 claim token。  
3. **P2 创建新的：** 作为主人，我可以在 Interfaze 创建一只新的托管 agent（即使我已经有别的 agent）；创建完成后已经是我的，直接开聊。

---

## 3. 信息架构

```text
Interfaze
├── /claim/[id]?token=          P0  首次认领（须登录）
├── /join?invite=               P1  接入落地页（提示词 + 链接/码；可未登录看）
├── /transfer/accept?invite=    已有 Gift（勿复用）
└── 壳内
    ├── 空态：接入已有 · 创建新的
    └── 我的 Agents 顶栏：同样两个动作（有列表也不藏）
```

认领成功默认落点：**开聊**（建 1:1 或进入已有 1:1），不是管理台。会话可建、agent 尚未 inbound 可达时，用现有 unreachable / 送达态，不回滚认领。

---

## 4. P0 — 认领落到 Interfaze

**目标：** 已有 `claim_url` 流量进入 Interfaze，认领后能进「我的」并打开 1:1。不依赖 AgentMother，不依赖邀请系统，不依赖 agent 当时在线。

**上线顺序：** Interfaze `/claim` 页 + Gateway 就绪之后，再改各区 ACN 的 `INTERFAZE_BASE_URL`。未设该变量时 `claim_url` 仍走 `FRONTEND_BASE_URL`（AgentPlanet），避免新链 404。

### 4.1 ACN：只改 claim 主机，不改路径形状

现网契约（测试钉死，禁止再改成 path token）：

```text
<origin>/claim/<agent_id>?token=<urlencoded>
```

| 区 | `claim_url` origin（设了 `INTERFAZE_BASE_URL` 之后） |
|---|---|
| global | `https://interfaze.io` |
| cn | `https://interfaze.acnlabs.cn` |

实现：

- ACN 新增设置 `INTERFAZE_BASE_URL`。有值：`claim_url` = `{INTERFAZE_BASE_URL}/claim/{id}?token=`。无值：保持今天的 `FRONTEND_BASE_URL`（回滚开关）。  
- **不要**改 `FRONTEND_BASE_URL`。它仍服务 AgentPlanet 人页（含 `confirm-delete`）。  
- `acn/tests/routes/test_join_claim_url_shape.py`：增加「设置了 Interfaze origin」用例；路径与 `?token=` 不变；未设置时仍钉旧主机行为。  
- Skill / CLI 文案：把「发给主人的浏览器链接」说成 Interfaze，不要再写 AgentPlanet Labs。

### 4.2 AgentPlanet / Labs：旧链 302（不是 301）

`/claim/[id]` 是客户端页，**不能**在 React 里做 HTTP 重定向。

| 站点 | 做法 |
|---|---|
| `agentplanet/frontend` | `next.config` 或 middleware：`/claim/:id` → 同区 Interfaze `/claim/:id`，**保留 query** |
| `acn-labs/frontend`（若仍对外） | 同样一条，不要漏 |

规则：

- 用 **302 或 307**，不要 301/308（永久缓存；改回 AgentPlanet 或换域会卡住）。  
- 不要在 AgentPlanet 再做认领表单，也不要 `useEffect` 里 JS 跳转冒充重定向（仍 200，token 继续打到旧站）。  
- Token 会进 `Location`；这是既有 query-token 模型，不在本切片改契约。

### 4.3 Interfaze 页 `/claim/[id]`

对齐 Gift 页（`interfaze/src/app/transfer/accept/page.tsx`）：登录回跳、双区、错误码，**不要**复用 Gift 的 invite token。`returnTo` 必须含 path + query（token），且为同站相对路径（现有 Auth0 / 微信回跳已限制 `returnTo` 不以 `//` 开头）。

| 状态 | 行为 |
|---|---|
| 未登录 | 登录（全球 Auth0 / CN 微信），`returnTo` = 当前认领 URL（含 `token`） |
| 无 `token` | 无效链接；给「去接入」而不是回 AgentPlanet |
| 预览：未认领 | 显示名字 / 简介；主按钮「认领并开聊」 |
| 预览：已被自己认领 | 成功态；主按钮开聊（走 GET `is_owner`，不必再 POST） |
| 预览：已被别人认领 | 「已被认领」；**不暴露**主人身份 |
| 认领成功 | 主按钮开聊；可次要「管理这只 agent」 |
| POST 失败 | 再 GET 预览；若已是自己的 → 当成功（短回路，见 4.4） |

**不要：** 发推、朋友圈、回 Labs、在浏览器里直打 ACN。

### 4.4 Gateway（浏览器不直打 ACN）

与 Gift 同一原则：人 JWT 进 Gateway，Gateway 转 ACN。

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| `GET` | `/api/chat/claim/{agent_id}` | 可选登录 | 预览：`name` / `description` / `claim_status` / `is_owner`（仅当 JWT 且 `owners_match`）/ `token_present`（query 是否带 token，**不回显 token**） |
| `POST` | `/api/chat/claim/{agent_id}` | 须登录 | 见下方短回路；限流 **10/min** |

预览可匿名（打开链接要能看到名字）。认领必须登录。`owners_match` 口径与 `chat_acl.py` 相同（`sub` / `user-{sub}`）。

**POST 短回路（必须按此实现，禁止「只转发 ACN」）：**

```text
1. GET ACN agent
2. 若 claim_status=claimed 且 owners_match(caller, owner)
     → 200 { success: true, already_owned: true }   // 不调 ACN claim
3. 若 claimed 且非主人
     → 409 already_claimed（不暴露 owner）
4. 否则转发人 JWT + verification_code → ACN POST /agents/{id}/claim
5. ACN 400（已领 / token 无效）→ 再读 agent，主人则同 2，否则把错误原样/映射返回
```

ACN 侧已领取会抛错，token 用过即清空。重复点击只能靠 Gateway 步骤 2，不能靠 ACN。

成功响应：

```json
{ "success": true, "agent_id": "…", "already_owned": false }
```

首次认领不返回 `api_key`（key 已在 agent 侧）。Gift 转让仍可返回一次性 key，两套响应不要混。

### 4.5 开聊

认领成功后：

1. 若已有与该 `agent_id` 的 1:1 → 进入。  
2. 否则 `POST /api/chats` 建 1:1 再进入（ACL：主人 `owners_match` 即可，不要求当时 inbound 可达）。  
3. 深链建议：`/?agent={id}`（或现网已有的会话深链）。P0 可先回壳并打开该会话；**默认文案是开聊**。  
4. 投递失败用现有 `agent_unreachable` / Mode B 送达态；**不**当作认领失败。

### 4.6 P0 验收

1. 新 `acn join` 在设置了 `INTERFAZE_BASE_URL` 后，`claim_url` 主机是 Interfaze，路径仍是 `/claim/{id}?token=`；未设置时仍指向 AgentPlanet。  
2. 打开该 URL → 登录 → 认领 → 该 agent 出现在「我的 Agents」→ 能建/进入 1:1。不要求第一条 agent 回复。  
3. 旧 `/claim/{id}?token=`（`agentplanet/frontend` 与仍对外的 `acn-labs/frontend`）→ **302/307** 到同区 Interfaze，query 仍在。  
4. 别人已认领 → 不暴露 owner；自己已认领 → GET 即成功态，再 POST 走短回路 200 `already_owned`。  
5. 未登录不能认领。浏览器网络面板没有直打 ACN `/claim`。  
6. `FRONTEND_BASE_URL` 仍指向 AgentPlanet；删除确认链不指向 Interfaze。

### 4.7 P0 非目标

Gift、邀请奖励、二维码、创建托管、发推验证、release/unclaim、改 claim token 契约、保证 join 后立即能回消息。

---

## 5. P1 — 接入落地页（提示词 + 链接 / 码）

**目标：** 「接入已有 agent」产品化；链接可分享。注册仍由 **agent 执行**；链接不代替 `join`。

**开工门禁：** P0 认领页已在对应区上线（否则 agent 加入后主人仍可能被送到旧站）。

### 5.1 两个对象，不要合成一个 URL

| 对象 | 谁用 | 里面有什么 | 没有什么 |
|---|---|---|---|
| **Join invite** | 人打开 / 分享 / 印码；agent 带码 join | Host 签发的 code | claim token、`sub`、owner |
| **Claim URL** | 只给这只 agent 的主人 | `agent_id` + 一次性 token | 不进公开码 |

公开分享认领 token = 谁先点谁领走。P1 **禁止**把 `claim_url` 画进二维码或「邀请好友」卡片。

Agent 加入后把 `claim_url` 给 **它的主人**（对话里、CLI 输出），不写进邀请页。

### 5.2 页面 `/join`

- Query：`invite`（Host 签发的人侧码）。无码时仍可当「接入说明」页（复制通用 CONNECT 提示词）。  
- 未登录可看：说明 + 复制提示词 + 二维码（当前页 URL）+（P2 起且 D14 已满足）「创建新的」。  
- 提示词必须带上 invite，例如 `acn join … --invite <code>`，或 skill 指示「join 时带上这段 invite」。提示词与 API **不得**让 agent 填写主人 `sub`。  
- 已登录额外：显示「这是我发出的邀请」或「我是被邀请来接入的」；发出人可再复制链接。

「我的 Agents」空态 / 顶栏「接入已有」：

1. 若无自己的 invite → Gateway 发一张。  
2. 跳转 `/join?invite=` 或壳内同一面板（复制提示词 / 复制链接 / 出示码）。

### 5.3 归因（Host 权威，D10）

```text
人  --POST /join-invites-->  Host 签发 code（映射 issuer_sub，TTL 30d）
agent --join?invite=code-->  ACN 只把 invite code 写入 metadata.join_invite
                             （可原样存；禁止相信 body 里的 owner/sub）
Host  --join 后核对-->       查自己的码：issuer_sub、redeeming agent_id
                             issuer == 即将认领的人 → kind=self
                             否则 kind=referred（P3 才发奖）
```

实现要点：

- ACN 已有 `?ref={agent_id}`（agent→agent）。P1 的 `invite=` 是人侧码，两套并存；Interfaze 分享只用 `invite=`。  
- ACN **不**解析、不写入人 `sub`。没有「ACN 调 Host 换 sub」也可以：Host 在 claim 成功 webhook / Gateway 认领短回路里，用 `metadata.join_invite` 反查自己的表。  
- Agent 漏带 invite：无归因，不发明默认邀请人。  
- Agent 瞎填 invite：Host 查无此码 → 忽略，不记 referred。  
- 一人同时一张有效码（创建即复用）。P1 不强制「指定接收人才能看页」——页是说明书；**认领**仍必须登录（D1）。

### 5.4 Gateway

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| `POST` | `/api/chat/join-invites` | 须登录 | 创建或复用自己未过期的 invite；**10/min** |
| `GET` | `/api/chat/join-invites/{code}` | 公开 | 预览：发出人昵称、过期、`redeemed_count`（不要列出 agent_id 列表给匿名） |

ACN：`POST /agents/join` 可收 `invite`（query 或 body）。只存 code，不存人 id。

### 5.5 P1 验收

1. 空态 / 顶栏能拿到稳定 `/join?invite=` 链接和二维码。  
2. 提示词含同一 invite；agent 用它 join 后，**Host** 能用 code 反查出发出人；ACN metadata 只有 code。  
3. 邀请页 **没有** claim token；请求体没有主人 `sub`。  
4. 自己的 agent 用自己的码 join，Host 记 `self`，不进入 P3 发放队列。  
5. 不发奖励。

### 5.6 P1 非目标

发钱、指定接收人强制绑定、改 CONNECT 协议、Mode A/B 向导重做（仍用现有 skill / CONNECT.md）。

---

## 6. P2 — 创建新的托管 agent

**目标：** 在 Interfaze 创建一只 **新的** 托管 agent 并成为主人。与「现在有没有旧 agent」无关。

**开工门禁（同时满足）：**

1. P0 认领/短回路已在对应区可用（创建失败回退「重试认领」要走同一套）。  
2. D14：v0 每账号每区最多 3 只本路径托管 agent，Host 强制。  
3. D11 + D12：受控 join + 不依赖过期人 JWT 的认领路径已有（见 6.3）。  
4. AM 适配器已对到现网，禁止用假 `agent_id` 给前端。

### 6.1 产品句

一键生出一只属于我的、能立刻打开会话的新 agent。不是「你还没有所以才创建」。投递未就绪不回滚认领。

### 6.2 UX

入口（都要有，有列表也不藏「创建」）：

- 空态主按钮之一：「创建新 agent」  
- 「我的 Agents」列表顶栏：「创建」  
- `/join` 页次要 CTA：「没有可接入的？创建一只新的」（P2 且 D14 已满足才亮）

向导（一屏）：

1. 名字（必填，规则对齐 ACN profile：能读、禁空、禁纯自动生成后缀）。  
2. 一句话简介（可选）。  
3. 提交 → 进度：部署 → 注册 → 认领 → 开聊。  
4. 失败：可重试；不要留下「已认领但没 runtime」的孤儿而不提示。

**不要：** 蓝图货架、persona 工作台、选云厂商、上架 Store、驯养师台、让人复制 `claim_url`、让浏览器看见托管 `acn_*`。

### 6.3 编排（Host 拥有，AM 是适配器）

工单路径 **不要** 挂在 `/api/chat/my-agents/{agent_id}` 下（现网已有该 GET，`jobs` 会被当成 agent_id）。

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/chat/agent-create-jobs` | 须登录；body `{name, description?}`；API **5/min** + **D14 额度**；返回 `{job_id}` |
| `GET` | `/api/chat/agent-create-jobs/{job_id}` | 仅工单主人；`queued \| deploying \| joining \| claiming \| ready \| failed` + `agent_id?` + `error?` |

```text
人 JWT → POST /api/chat/agent-create-jobs
         → Host 扣额度 / 建工单（queued）
         → AgentMother 部署托管实例（适配器）
         → 受控 join（见下，禁止 join/internal）
         → Host 认领（见下，禁止假设原 JWT 仍有效）
         → 工单 ready { agent_id }
         → 前端开聊
```

**Join（D11）：** 不要 `POST /agents/join/internal`（写死 `visibility=test`）。用 Host `X-Internal-Token` 调公开 join 的受控变体，或扩展 internal join **允许调用方传入 `visibility`**（缺省仍 `test`，以免探针改坏）。用户创建的 agent：`visibility=real` 或产品选定的非 `test` 私有值，**不得**是 `test`。

**认领（D12），二选一，工单里写死用了哪条：**

| 路径 | 何时用 | 做法 |
|---|---|---|
| A. 同步认领 | 部署+join 能在该 HTTP 请求内完成 | 用**本请求**人 JWT + join 返回的 `verification_code`（code 只留 Host 内存，不回浏览器） |
| B. Internal 绑定 | 部署异步、JWT 会过期 | ACN 新增仅 Internal 的绑定：`owner_sub` + **本工单保存的 verification_code**（join 响应写入 job 行，不回浏览器）。禁止只凭 internal + `agent_id` 绑定任意未领 agent。**不是**把人 JWT 存进 Redis |

P2 默认按 **B** 设计（AM 部署几乎一定异步）。路径 A 只许当适配器 SLA 保证同请求完成。  
「重试认领」：Host 用 B（internal 绑定当前工单主人），不要让人再贴 token。

约束：

- 创建时已登录 → **隐式认领**，人不见 token。  
- 托管实例的 `acn_*` 由 AM / 运营方持有（现网转让改钥队列已按这个模型）。  
- 浏览器不拿托管 API key。  
- 双区：工单打对当前用户的 ACN region；key 不跨区。  
- AM 适配器是边界。本仓库已有：认领、改钥队列、Store 履约里的 AM 卖家。P2 先定 Host 工单 + 适配器接口；AM HTTP 细节以 AM 现网为准，**禁止**在 Interfaze 里假造一个本机 runtime。

适配器最小接口（实现时对照 AM，而不是先发明第二套）：

```text
create_hosted(name, description, owner_sub, region) → {instance_id}
await_ready(instance_id) → {acn_agent_id} | 由 Host 代受控 join
```

若 AM 已 join（非 test visibility）：Host 只做认领/绑定。若 AM 只交实例：Host 受控 join 再绑定。前端只认 `ready` + `agent_id`。

### 6.4 失败与孤儿

| 失败点 | 处理 |
|---|---|
| 超额度 | 不建工单；`402` 或 `429` + 产品文案 |
| AM 部署失败 | 工单 `failed`；退额度（若已扣）；可重试；不 claim |
| join 失败 | 工单 `failed`；AM 侧按适配器约定回收或标脏 |
| claim/绑定失败 | 工单 `failed`，带 `agent_id`（若已有）；「重试认领」走 D12-B |
| 认领成功但投递未就绪 | 仍开聊；会话里用现有 unreachable / 送达态，不回滚认领 |

### 6.5 P2 验收

1. 已有 agent 的用户仍能在列表顶栏创建另一只。  
2. 空态「创建」与「接入」并列，文案不是「你还没有 agent」。  
3. 成功后该 agent 在「我的 Agents」，owner = 当前用户，并能建 1:1。不要求第一条回复。  
4. 全程无 claim 链接、无托管 API key 出现在浏览器。  
5. `visibility` 不是 `test`；`GET /agents` 默认列表按产品决定是否可见，但 **不会**被 `cleanup_test_agents` 的 test 语义误伤。  
6. 工单 JWT 过期后「重试认领」仍能把同一只绑到原主人。  
7. 第 4 只本路径托管被拒（402/429）；限流与双区打对。

### 6.6 P2 非目标

AM 蓝图 / persona / Store 上架、自托管「帮我在本机装 OpenClaw」、邀请奖励、把创建伪装成 Gift、用 `join/internal` 现网行为创建用户 agent。

---

## 7. P3（本文件不实现）

人→人邀请奖励。建议合格事件：`被邀人认领成功 + 第一次真实对话成功`（托管可再加实例存活）。只奖 join 会刷空号。结算对象是 Interfaze 用户，不是 agent。只处理 Host 表里 `kind=referred` 的行；`self` 与无效码不发。

---

## 8. 边界

| Interfaze 做 | 不做 |
|---|---|
| 首次认领页、开聊、接入落地页、创建新托管 agent | 发推才能认领 |
| 人侧 join invite（无 claim token；Host 归因） | 用分享码代替 agent `join`；信 agent 自报的人 id |
| claim_url 指向本站 | 把 `FRONTEND_BASE_URL` 整站改掉 |
| AM 一键创建 + 隐式认领 | AM 控制台、驯养师、Store；`join/internal` 探针入口 |
| Gift 继续走 `/transfer/accept` | 把首次认领并进 Gift |

AgentPlanet / Labs：旧认领 **302/307**；世界 / Labs / Store / 驯养仍在。  
ACN：身份、token、join/claim；不做人钱包、不做人邀请表（最多存 invite code）。  
AgentMother：托管制造；不做人会话壳。

---

## 9. 实现顺序

| 切片 | 改动面 | 依赖 |
|---|---|---|
| **P0** | ACN `INTERFAZE_BASE_URL`（可关）；Gateway 短回路；Interfaze `/claim/[id]`；两处前端 302/307；开聊深链 | 页就绪后再拨 origin |
| **P1** | Host join-invite；`/join`；空态/顶栏接入；提示词带 invite；ACN 只存 code | P0 认领页已在 |
| **P2** | `agent-create-jobs`；AM 适配器；受控 join；internal 绑定；额度；空态/顶栏创建 | P0 + D11 + D12 + D14 |
| **P3** | 合格事件发奖 | P1 且 Host `kind=referred` |

建议工程顺序：P0 单独可上。P1 在 P0 之后。P2 不依赖 `/join` 页，但依赖 P0 与门禁，**不可**与未修的 join/internal、人 JWT 认领并行开工。P3 必须在 P0+P1 之后。

---

## 10. 风险

| 风险 | 处理 |
|---|---|
| 公开 claim token 被抢领 | P0 保持先到先得（自己认领）；P1 分享只用 join invite |
| 改 `FRONTEND_BASE_URL` 打断删除确认 | D8：只改 claim 主机 |
| 双区点错网 | Gateway / ACN / Interfaze origin 同一 region；key 不跨区 |
| 先拨 `INTERFAZE_BASE_URL` 页未上 | 未设则回退 AgentPlanet；先页后拨号 |
| 301 永久缓存 | D：只用 302/307 |
| ACN claim 非幂等 | D9 短回路 |
| `join/internal` → test | D11 |
| 异步 JWT 过期 | D12 |
| AM 未就绪就做 P2 UI | 门禁 4；不可对用户露出假 agent_id |
| 创建刷量 / 成本 | D14 额度；P3 不在创建瞬间发奖 |
| agent 伪造邀请人 | D10；Host 查码 |

---

## 11. 文档与文案同步（随 P0）

- ACN skill：`claim_url` 发给主人，打开的是 Interfaze。  
- [interfaze-connect-agent.md](./interfaze-connect-agent.md) / CONNECT：认领落点改为 Interfaze。  
- `packages/agent-chat` 空态：P1 起不再只剩一颗「复制提示词」。  
- 父文档 [interfaze-acn-agent-management-v0](./interfaze-acn-agent-management-v0.md)：深链策略从「claim 曾指向 AgentPlanet」改为本文。  
- `acn/.env.production.example`、`deploy-cn/acn.env.example`：补充 `INTERFAZE_BASE_URL` 注释（与 `FRONTEND_BASE_URL` 分工）。
