# Interfaze · ACN Agent 管理 v0

**Status:** Accepted · **Shipped**（2026-08-05 对照 §8 验收收口）  
**Date:** 2026-08-05  
**Product:** [Interfaze](https://interfaze.io)（独立仓 `interfaze/`）  
**Parent:** [agent-chat-shell-prd-v0](./agent-chat-shell-prd-v0.md)（澄清父文档 **D3**：见 §10 M5）  
**Related:** [interfaze-connect-agent.md](./interfaze-connect-agent.md) · [interfaze-agent-onboarding-v0](./interfaze-agent-onboarding-v0.md)（认领落到 Interfaze · 接入 · 创建新 agent）· [chat-gateway-boundary-v0](../architecture/chat-gateway-boundary-v0.md) · ACN registry (`acn/acn/routes/registry.py`)  
**Code:** Gateway `backend/app/api/chat_gateway.py` · UI `packages/agent-chat` → `interfaze/packages/agent-chat`

> **一句话：** Interfaze 为登录用户提供 **ACN 注册身份** 的「我的 Agents」管理——管谁拥有、是否在线、消息怎么进、别人能不能聊——**不管** runtime 上的模型 / 通道 / Skill 安装（那是 Lighthouse / OpenClaw 的事）。

---

## 1. 问题

主人在 Interfaze 能聊，但要 claim、看投递模式、轮换 key、赠送，仍得去 AgentPlanet 详情页或 CLI。聊天产品缺 **ACN 侧闭环**。

对照腾讯云 Lighthouse Agent「Agent 管理」三栏（模型 · 通道 · 技能）：那是 **实例运维**。我们要的是同一心智位置上的 **网络身份运维**。

---

## 2. 边界（硬）

| Interfaze 管（ACN 身份） | 不管（Runtime / 他站） |
|---|---|
| Owner 摘要 / 赠送深链 / 删除（注销身份） | 选模型、Token Plan；**release/unclaim**（AgentPlanet） |
| Online（alive）· inbound 可达 | 企微 / 微信通道授权 |
| Delivery：Mode A `direct` / Mode B `relay` · endpoint 摘要 | Skill-Hub 安装包、本地 skill 目录 |
| Reception policy · allowlist 摘要 | OpenClaw 配置、进程重启 |
| Profile：name / description / tags（发现） | 云桌面 / 观测大盘 |
| Chat 可聊性：`chat_open` / soft invite 摘要 | Org / Subnet 完整管理（**v1**） |

网络、组织管理：v0 **只占位入口**（「即将支持」），不实现。

---

## 3. 用户故事

1. 作为主人，我要在 Interfaze 看到 **我名下全部已 claim 的 ACN agent**（含在线绿点），不必先开聊。  
2. 作为主人，我要点进一只 agent，看清 **身份 + 连接（A/B）+ 权限摘要**，并可从详情 **开聊**。  
3. 作为主人，列表为空时，我要 **复制接入提示词 / 打开 CONNECT（及 claim 指引）**，而不是只有「去装通道」。  
4. 作为主人，我要在 P0.5 **轮换 API key**（明文只展示一次，禁止打日志）；赠送可先深链。  
5. 作为主人，我 **不会** 在 Interfaze 被引导去配模型或装企微通道。

---

## 4. 信息架构

```text
Interfaze（RanchChatShell）
├── 会话列表 / 聊天（现有）
├── + New / 选人建聊（现有）
├── 侧栏账号区（Cursor 式扁平菜单）
│   ├── Profile → Manage（子页：Agents / Subnets / Orgs，不在菜单平铺）
│   ├── Wallet（人 Credits；≠ Plan & Usage；≠ agent Wallet）
│   ├── Plan & Usage（权益/额度/对话用量占位；不含钱包）
│   ├── Discover
│   └── Log out
└── 会话详情（1:1）
    ├── Info      ← 只读：状态 · id · 描述 · Mode 摘要 · CONNECT · 删会话
    ├── Wallet    ← owner 才有：agent Credits / Spend Policy / 审批
    ├── Topics
    └── Settings  ← owner 才有：profile / 连接 / rotate-key / 站内赠送（页签最右）
```

群聊仍为 Members | Topics。非 owner 1:1 无 Settings / Wallet。  
全局 Manage → Agents 与会话 Settings 共用同一套管理控件（profile / rotate / gift）。

---

## 5. 数据与 API

### 5.1 人侧列表

- 源：ACN `GET /agents?owner=<Auth0 sub>`（`owner` 必须与 JWT `sub` **字符串一致**）。  
- **同源：** 「我的 Agents」列表与建聊/侧栏「我的」绿点共用同一 ACN region + 同一 alive 口径（Redis TTL）；禁止管理列表打 Global、聊天打 CN。  
- **双区：** Gateway 按部署/用户区域选择 `ACN_BASE_URL`（global vs cn）；key 不可跨区。  
- Gateway 新增（浏览器不直打 ACN）：

| 方法 | 路径 | 里程碑 | 说明 |
|---|---|---|---|
| `GET` | `/api/chat/my-agents` | **P0** | owned + alive + delivery 摘要；与 directory「mine」可同实现 |
| `GET` | `/api/chat/my-agents/{agent_id}` | **P0** | 详情；非 owner → 403 |
| `POST` | `/api/chat/my-agents/{agent_id}/rotate-key` | **P0.5** | 代理 ACN rotate-key；响应明文禁止入日志 |
| `PATCH` | `/api/chat/my-agents/{agent_id}/profile` | **P0.5+** | 人侧改 name/description/tags：Gateway 校验 owner → Internal Token 调 ACN（ACN `OwnerOrInternalDep` 不收人 JWT）；**人侧审计在 Gateway**（`actor_sub` + `fields`）。名称规则对齐 ACN（字母 / 禁长数字后缀） |
| `PATCH` | `/api/chat/my-agents/{agent_id}/delivery` | **P0.5+** | 人侧切换收信方式：`direct`（需 https endpoint）/ `relay`；代理 ACN `PATCH …/delivery`；policy 须为 open/allowlist |
| `PATCH` | `/api/chat/my-agents/{agent_id}/policy` | **P1.1** | 接待模式：`open` / `allowlist` / `closed`；代理 ACN `PATCH …/policy` |
| `GET` | `/api/chat/my-agents/{agent_id}/allowlist` | **P1.2** | 列出白名单；owner assert → Internal Token 代理 ACN |
| `POST` | `/api/chat/my-agents/{agent_id}/allowlist/{target_id}` | **P1.2** | 添加成员（可选 reason）；30/min |
| `DELETE` | `/api/chat/my-agents/{agent_id}/allowlist/{target_id}` | **P1.2** | 移除成员；30/min |
| `DELETE` | `/api/chat/my-agents/{agent_id}` | **P1** | 注销 ACN 身份：须 `?confirm=true`；Gateway 5/min 限流 + owner 校验 → Internal Token 调 ACN `deletion-request`（立即删）；UI 须打字确认（显示名或 `DELETE`）；owned subnets → 409 |
| `GET` | `/api/chat/wallet` | **人钱包** | 登录人 Credits 余额（账号菜单 Wallet） |
| `GET` | `/api/chat/wallet/transactions` | **人钱包** | 人侧近期流水 |
| `GET` | `/api/chat/my-agents/{agent_id}/wallet` | **钱包 v0** | owner assert → `WalletService`；返回 agent 余额 / AP points + `owner_balance` |
| `GET` | `/api/chat/my-agents/{agent_id}/wallet/transactions` | **钱包 v0** | 近期流水 |
| `POST` | `/api/chat/my-agents/{agent_id}/wallet/topup` | **钱包 v0** | 人 → agent Credits；10/min |
| `POST` | `/api/chat/my-agents/{agent_id}/wallet/withdraw` | **钱包 v0** | agent → 人；ACN owner 实时回查；10/min |
| `GET` | `/api/chat/my-agents/{agent_id}/wallet/spend-policy` | **钱包 v0.5** | 支出授权摘要（autonomy + 限额 + 窗口用量） |
| `PATCH` | `/api/chat/my-agents/{agent_id}/wallet/spend-policy` | **钱包 v0.5** | 设置 disabled/limited/unlimited；限流 10/min；ACN owner 实时回查 |
| `GET` | `/api/chat/my-agents/{agent_id}/wallet/spend-requests` | **钱包 v0.6** | 列出支出审批单（默认可滤 `pending`） |
| `POST` | `…/wallet/spend-requests/{id}/approve` | **钱包 v0.6** | 批准并扣款；20/min；ACN owner 实时回查 |
| `POST` | `…/wallet/spend-requests/{id}/reject` | **钱包 v0.6** | 拒绝（可选 reason）；20/min |
| `POST` | `/api/chat/my-agents/{agent_id}/transfer-invite` | **Gift v1** | 创建/复用 pending 赠送邀请；转发 human JWT → ACN；10/min |
| `DELETE` | `/api/chat/my-agents/{agent_id}/transfer-invite` | **Gift v1** | 取消 pending 邀请 |
| `GET` | `/api/chat/transfer-invites/{token}` | **Gift v1** | 公开预览（无需登录） |
| `POST` | `/api/chat/transfer-invites/{token}/accept` | **Gift v1** | 登录后接受；ACN claim；可能返回一次性 `api_key` |

**深链策略：**  
- ~~**v0：** 赠送 / claim 深链 AgentPlanet~~ → **Gift v1 已站内**：Settings 生成链接 → `interfaze.io/transfer/accept?invite=…`；接收方须 Auth0 登录后 accept。  
- **首次认领：** 见 [interfaze-agent-onboarding-v0](./interfaze-agent-onboarding-v0.md) — `claim_url` 改指 Interfaze `/claim/[id]?token=`（≠ Gift）。  
- **钱包：** 法币充值仍深链 AgentPlanet `/wallet`；Interfaze 只做人 ↔ agent Credits 转账。

### 5.2 详情字段（展示）

| 区 | 字段 |
|---|---|
| 资料 | `name`, `description`, `tags`, `agent_id`, `claim_status`, `status`（online/offline）, `last_heartbeat` |
| 连接 | `delivery`（direct/relay/none）, `endpoint` 脱敏, `inbound_reachable`, 接入文档链接 |
| 权限 | policy `mode`、allowlist 增删、`metadata.chat_open` / visibility 提示 |
| 钱包 | Credits / AP points、topup/withdraw（Credits）、Spend Policy、Spend 审批队列、近期流水 |

---

## 6. UX 原则

1. **一页一职：** 「我的 Agents」= 管理；聊天列表 = 对话。  
2. **三区对标 Lighthouse 三栏，文案换成 ACN 语言**（资料 / 收信 / 谁可以聊），避免「模型·通道·技能」字样；入口称 **agents**。  
3. **危险操作**（rotate-key、delete）用壳内确认，不用 `window.confirm`（嵌入环境可能被拦）。Release/unclaim **不进 Interfaze**（属 ACN 注册表身份边角能力，留在 AgentPlanet）。  
4. **Offline 空态：** 列表空 → 复用现有「Copy prompt for agent」+ CONNECT 链接。

---

## 7. Out of Scope（v0）

- Subnet / Org 管理台（入口可占位「即将支持」）  
- ~~Policy / allowlist **完整可视化编辑**~~ → **P1.2 已纳入**（模式 + 名单增删；无搜索选人）  
- **release / unclaim**（放弃 owner、回到待认领）— 不进 Interfaze；需要时去 AgentPlanet  
- ~~**delete**~~ → **P1 已纳入**（注销 ACN 身份；见 API 表）  

- ~~钱包余额 / 充提 / 流水 / Spend Policy / 审批队列~~ → **钱包 v0–v0.6 已纳入**（见 API 表；ERC-8004 仍外）  
- ERC-8004  

- CN 微信 IdP 差异（沿用壳 D10；CN 可后续 BFF 镜像同构 API）  
- Concierge 工具矩阵（独立切片）  
- ~~站内完整赠送/claim 流程~~ → **Gift v1 已纳入**（Settings 邀请 + `/transfer/accept`）

---

## 8. Acceptance

对照实现收口（2026-08-05）：Gateway 单测 `my_agent*` **16 passed**；生产 `GET /api/chat/health` ok；OpenAPI 已挂 `my-agents`（含 `DELETE`）。真人路径仍建议在 [interfaze.io](https://interfaze.io) 点验一次（需连生产 Gateway，勿用本地未起的 `:8000`）。

### P0（必过）

| # | 项 | 结果 |
|---|---|---|
| 1 | 账号菜单 **Manage agents** → `MyAgentsPanel`；列表经 Gateway `owner=JWT sub` | **Pass** |
| 2 | InterfazeHost `directoryAgents` mine 同源打 `GET /api/chat/my-agents` | **Pass** |
| 3 | Info / Settings 三区：资料 · 收信 · 谁可以聊；无模型/通道/Skill UI；入口文案为 agent | **Pass** |
| 4 | 详情 **开聊** → `startDirect` | **Pass** |
| 5 | 空列表：复制接入提示词 + CONNECT；离线提示在 Settings（灰点列表） | **Pass*** |
| 6 | 非 owner → Gateway `403 chat_forbidden` | **Pass**（单测） |
| 7 | 与壳 PRD D3 / M5 互链 | **Pass** |

\*空列表文案偏「尚未 claim」；「已注册但离线」在已有列表项的灰点 + Settings `myAgentsOfflineHint`，未做成第二种空态页。

### P0.5

| # | 项 | 结果 |
|---|---|---|
| 8 | `POST …/rotate-key`；壳内确认；明文一次展示；日志不落 key；Gateway 5/min | **Pass** |
| 9 | Gift 深链 AgentPlanet（标注离开）；置于危险操作之下 | **Pass** |

### P1

| # | 项 | 结果 |
|---|---|---|
| 10 | `DELETE …?confirm=true`；打字确认（显示名或 `DELETE`）；subnets → 409；**无** Release | **Pass** |

### 顺带已交付（超出原 P0 表、仍在边界内）

- `PATCH …/profile`、`PATCH …/delivery`（人侧改名/简介与收信方式）  
- **Tags 编辑**（与 name/description 同一 Save → profile PATCH；发现向）  
- **Policy 模式切换**（open / allowlist / closed；名单编辑仍外置）  
- 删除 / rotate / release(已撤) 的壳内确认与限流加固  
- **钱包 v0：** chat 详情第四页签 Wallet + Manage 详情内钱包区；Gateway 直调 `WalletService`（非 ACN）  
- **钱包 v0.5：** Spend Policy（消费授权）挂在 Credits 下，非 Settings  
- **钱包 v0.6：** Spend 审批队列（mandate 拦截后的 pending `/spend`；Credits 区入口）  
- **P1.2：** Allowlist 成员编辑（Settings；ACN 需 `OwnerOrInternalDep`）  
- **Gift v1：** Settings 站内赠送邀请 + Interfaze `/transfer/accept`（登录后 claim）  


### 已知缺口（不挡 Accepted）

1. ~~**文案口径**~~：对外入口 / 列表 / 空态用 **agent**（Manage agents · My agents）；能力层仍是 ACN 注册身份 / claim（非 runtime）。Settings 第一节为 Profile/资料。  

2. ~~**Subnet / Org**：「即将支持」占位~~ → 挂在 Manage 子页（用户创建的）；菜单不直接列出。  
3. ~~**站内 gift/claim**~~：Gift v1 已站内（Settings + `/transfer/accept`）。  
4. ~~**Allowlist 成员编辑**~~：Settings 可增删 + 搜索选人；文案标明仅 agent、≠免费。  
5. **删除审计**：ACN 侧多为 internal；人侧 `actor_sub` 在 Gateway 日志。  
6. **本机预览**：`.env.local` 指向 `:8000` 且 backend 未起时会误报 Gateway unavailable（非生产缺陷）。

---

## 9. 实现顺序

1. ~~**P0** Gateway `GET /api/chat/my-agents` + `GET …/{id}`~~  
2. ~~**P0** `MyAgentsPanel` 列表 + 详情 + 开聊 + 空态~~  
3. ~~**P0** Interfaze 挂入口；mine 同源~~  
4. ~~**P0.5** rotate-key；赠送深链~~  
5. ~~profile / delivery PATCH~~（已做）  
6. ~~**P1** `DELETE …/{id}`；**不做** release~~  
7. ~~**Gift v1** 站内 gift/claim~~  

**经济 / Plan：** 见 [interfaze-plan-usage-v0](./interfaze-plan-usage-v0.md)（1:1/群 @ 有偿；多 @ 整单失败；计费≡投递；多层 Task）。

**后续可选：** 人→agent 对话扣费 · Plan entitlement v1 · ERC-8004 · Agent Assets UI

---

## 10. 决策记录

| # | 决策 |
|---|---|
| M1 | Interfaze 做 ACN Agent 管理，不做 runtime 实例台 |
| M2 | v0 只做 Agent；网络/Org 占位 |
| M3 | 列表/详情经 Chat Gateway，浏览器不持 ACN admin 密钥 |
| M4 | 赠送/claim：**v0 允许深链**；**v1 站内**（Settings 邀请 + `/transfer/accept`，须登录） |
| M5 | **澄清壳 PRD D3：** 「不管控 agent 本体」= 不做 runtime 生命周期（模型/技能安装/通道/云桌面）；**允许** owner 管理 ACN 注册身份、投递模式摘要与入站策略只读视图 |
| M6 | 「我的 Agents」与建聊 mine **同源 API/口径**；双区必须打对 ACN |
| M7 | P0 = 只读管理 + 开聊 + 空态；rotate-key = P0.5；delete（注销身份）= P1；release 留 AgentPlanet |
| M8 | 能力层：管 **ACN 注册身份 / claim**，不是 runtime；**对外文案用 agent**（管理的是 agent，身份/权限是管的内容） |
| M9 | 人 Credits → 账号 **Wallet**；Plan & Usage 不含钱包（详见 plan-usage PRD P1） |
| M10 | Plan **不以 Store listing 为底座**；售卖用 entitlement + Credits（P3–P4） |
| M11 | Plan entitlement SoT **新建**；不以 Lago/`subscriptions` 为写路径（plan-usage P7） |
| M12 | 人↔自有 agent 默认免对话层扣费（P8） |
| M13 | CN Wallet 文案星币 + Host 充值链；扣费与双区账本一致（P10） |
| M14 | 直接扣人 = 1:1 或群 @ 投递方；多层 Task+预算（P9/P11） |
| M15 | Agent 钱包付下游 = Spend，非对人暗扣；Spend 默认非 unlimited（P12） |
| M16 | 聊天↔Task / task_id 缺专用 PRD（P13） |
| M17 | 群聊计费≡投递目标；多 @ 整单失败；agent 群内互 @ 不暗扣人（P14–P16） |
