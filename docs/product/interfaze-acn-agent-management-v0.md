# Interfaze · ACN Agent 管理 v0

**Status:** Draft · Ready for implementation  
**Date:** 2026-08-05  
**Product:** [Interfaze](https://interfaze.io)（独立仓 `interfaze/`）  
**Parent:** [agent-chat-shell-prd-v0](./agent-chat-shell-prd-v0.md)  
**Related:** [interfaze-connect-agent.md](./interfaze-connect-agent.md) · [chat-gateway-boundary-v0](../architecture/chat-gateway-boundary-v0.md) · ACN registry (`acn/acn/routes/registry.py`)

> **一句话：** Interfaze 为登录用户提供 **ACN 注册身份** 的「我的 Agents」管理——管谁拥有、是否在线、消息怎么进、别人能不能聊——**不管** runtime 上的模型 / 通道 / Skill 安装（那是 Lighthouse / OpenClaw 的事）。

---

## 1. 问题

主人在 Interfaze 能聊，但要 claim、看投递模式、轮换 key、赠送，仍得去 AgentPlanet 详情页或 CLI。聊天产品缺 **ACN 侧闭环**。

对照腾讯云 Lighthouse Agent「Agent 管理」三栏（模型 · 通道 · 技能）：那是 **实例运维**。我们要的是同一心智位置上的 **网络身份运维**。

---

## 2. 边界（硬）

| Interfaze 管（ACN） | 不管（Runtime / 他站） |
|---|---|
| Owner / claim / 赠送 / release / 删除 | 选模型、Token Plan |
| Online（alive）· inbound 可达 | 企微 / 微信通道授权 |
| Delivery：Mode A `direct` / Mode B `relay` · endpoint 摘要 | Skill-Hub 安装包、本地 skill 目录 |
| Reception policy · allowlist 摘要 | OpenClaw 配置、进程重启 |
| Profile：name / description / tags（发现） | 云桌面 / 观测大盘 |
| Chat 可聊性：`chat_open` / soft invite 摘要 | Org / Subnet 完整管理（**v1**） |

网络、组织管理：v0 **只占位入口**（「即将支持」），不实现。

---

## 3. 用户故事

1. 作为主人，我要在 Interfaze 看到 **我名下全部 ACN agent**（含在线绿点），不必先开聊。  
2. 作为主人，我要点进一只 agent，看清 **身份 + 连接（A/B）+ 权限摘要**。  
3. 作为主人，我要 **复制接入提示词 / 打开 CONNECT 指南**，让 agent 自己补 Mode A/B。  
4. 作为主人，我要 **轮换 API key**（明文只展示一次）或跳转 **赠送**。  
5. 作为主人，我 **不会** 在 Interfaze 被引导去配模型或装企微通道。

---

## 4. 信息架构

```text
Interfaze（RanchChatShell）
├── 会话列表 / 聊天（现有）
├── + New / 选人建聊（现有）
└── 我的 Agents（新）          ← 账号区或侧栏入口
    ├── 列表：name · 绿点 · Mode 徽章 · 短 id
    └── 详情（三区，对标「设置」但语义是 ACN）
        ├── 身份 Identity
        ├── 连接 Connect（delivery / endpoint / 接入指引）
        └── 权限与操作 Access（policy 摘要 · rotate-key · gift · release）
```

会话内 Agent Info 页可链到「在我的 Agents 中管理」，避免两套编辑器。

---

## 5. 数据与 API

### 5.1 人侧列表

- 源：ACN `GET /agents?owner=<Auth0 sub>`（或 Backend 已有 analytics/search 代理）。  
- Gateway 建议新增（避免浏览器直打 ACN 密钥边界）：

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/chat/my-agents` | 当前用户 owned agents + alive + delivery 摘要 |
| `GET` | `/api/chat/my-agents/{agent_id}` | 详情（须 assert owner） |
| `POST` | `/api/chat/my-agents/{agent_id}/rotate-key` | 代理 ACN rotate-key，owner JWT |
| `PATCH` | `/api/chat/my-agents/{agent_id}/profile` | 可选 v0.1：改 name/description/tags |

赠送 / claim 可 **深链** 现有 AgentPlanet 页（`/transfer/…`、`/claim/…`），v0 不重做完整赠送 UI。

### 5.2 详情字段（展示）

| 区 | 字段 |
|---|---|
| 身份 | `name`, `description`, `tags`, `agent_id`, `claim_status`, `status`（online/offline）, `last_heartbeat` |
| 连接 | `delivery`（direct/relay/none）, `endpoint` 脱敏, `inbound_reachable`, 接入文档链接 |
| 权限 | policy `mode`, allowlist 条数（可选）, `metadata.chat_open` / visibility 提示 |

---

## 6. UX 原则

1. **一页一职：** 「我的 Agents」= 管理；聊天列表 = 对话。  
2. **三区对标 Lighthouse 三栏，文案换成 ACN 语言**（身份 / 连接 / 权限），避免「模型·通道·技能」字样。  
3. **危险操作**（rotate-key、release、delete）用壳内确认，不用 `window.confirm`（嵌入环境可能被拦）。  
4. **Offline 空态：** 列表空 → 复用现有「Copy prompt for agent」+ CONNECT 链接。

---

## 7. Out of Scope（v0）

- Subnet / Org 管理台  
- Policy / allowlist 完整可视化编辑器（v0 只读摘要 + 「用 CLI / 让 agent 改」）  
- Spend mandate / 钱包 / ERC-8004  
- CN 微信 IdP 差异（沿用 D10；CN 可后续 BFF 镜像）  
- Concierge 工具矩阵（独立切片）

---

## 8. Acceptance

1. 登录 Interfaze 后，侧栏/账号区可进入 **我的 Agents**，列表 = 当前 Auth0 用户 own 的 ACN agents，绿点与聊天列表一致口径（alive）。  
2. 详情三区可见：身份、连接（含 Mode A/B）、权限摘要；无模型/通道/Skill-Hub UI。  
3. 空列表可一键复制接入提示词。  
4. Owner 可对名下 agent 触发 rotate-key（或明确「暂不可用」）；非 owner 打开详情 403/隐藏。  
5. 文档与壳 PRD 互链；与 Lighthouse 边界写进本文 §2。

---

## 9. 实现顺序

1. Gateway `GET /api/chat/my-agents`（+ 可选 detail）  
2. `packages/agent-chat`：`MyAgentsPanel` 列表 + 详情三区（只读为主）  
3. Interfaze 挂入口；rotate-key / 赠送深链  
4. （可选）profile PATCH、policy 只读加强  

---

## 10. 决策记录

| # | 决策 |
|---|---|
| M1 | Interfaze 做 ACN Agent 管理，不做 runtime 实例台 |
| M2 | v0 只做 Agent；网络/Org 占位 |
| M3 | 列表/详情经 Chat Gateway，浏览器不持 ACN admin 密钥 |
| M4 | 赠送/claim 可深链 AgentPlanet，不阻塞 v0 列表详情 |
