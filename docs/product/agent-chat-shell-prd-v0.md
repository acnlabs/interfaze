# Interfaze（Agent Chat Shell）PRD v0

**Product name:** **Interfaze** · **Domain:** [interfaze.io](https://interfaze.io)  
**Status:** **Accepted** · 2026-08-01（审核修订后收口）· **命名锁定:** 2026-08-02  
**Date:** 2026-08-01 · **Accepted:** 2026-08-01  
**Audience:** 产品 / Frontend / Backend / BFF / ACN / 生态应用（ComicLaw、AgentPlanet 等）  
**Depends on:** ACN Registry · A2A / communication ·（可选）Subnet / Org API  
**Implementation base:** `ranch/` Chat UI · `backend` `chats` / `threads` / WebSocket · [comiclaw-studio](https://github.com/acnlabs/comiclaw-studio) ChatWidget + `/api/chat`  
**Code:** 可嵌入包 `packages/agent-chat`（`@acnlabs/agent-chat`；**UI 真源 = ranch chrome → `RanchChatShell`**，早期最小 `AgentChatShell` 为过渡/Labs assistant）· 独立仓 [`interfaze/`](../../interfaze)（GitHub：`acnlabs/interfaze` · interfaze.io）
**UX reference:** [腾讯云 Lighthouse Agent](https://developer.cloud.tencent.com/article/2714680)（对话 / Agent 群聊 / 侧栏+主区形态；**不**抄其 runtime 托管闭环）  
**Host examples:** [Labs Concierge](./labs-concierge-prd-v0.md)（AgentPlanet 官方客户 agent 场景）  
**Tracking:** Interfaze / Chat Shell 需独立议题（或改写既有议题标题）；[AgentPlanet#18](https://github.com/acnlabs/AgentPlanet/issues/18) / [backend#56](https://github.com/acnlabs/Agentplanet-backend/issues/56) 原 Concierge 口径，应拆分或改链到本文 + Concierge 切片

> **一句话：** **Interfaze** 提供可嵌入、可独立（interfaze.io）的人侧对话壳，使用户能与**经 ACL 允许的、已注册到 ACN 的智能体**单聊或群聊协作；壳**框架无关**，只认 ACN 注册身份，不管控 agent 内部 runtime。

---

## 0. 已锁定决策（v0）

| # | 决策 | 说明 |
|---|---|---|
| D1 | Chat Shell ≠ 平台官方双 agent | 主智能体 / 客户智能体是各 Host **部署与联调**配置；不进本 PRD Acceptance |
| D2 | 框架无关 | 不区分 OpenClaw / Hermes / 其他；唯一条件是 **ACN 已注册** 且可按 ACN 契约收发 |
| D3 | 暂不管控 agent 本体 | 不做模型/技能/通道/云桌面等「管 agent 生命周期」；那是开放能力另轨 |
| D4 | 底座演进，不另起炉灶 | UI 从 `ranch` 抽出可嵌入包；Gateway = 硬化现有 `backend` chats/threads/WS + ACN 路由 |
| D5 | 群聊进首版 | **迁稳** ranch 已有群聊，对端改为 ACN agent；不是从零重做，也不做复杂自动编排 |
| D6 | 嵌入形态 | **侧屏 + 全屏** 同一组件（覆盖 Web / 移动体验） |
| D7 | Workspace 降级为可选上下文 | Workspace 不是 Chat 的父项目；会话可独立于 Workspace 存在 |
| D8 | v0「组网」= 多 agent 群聊 | subnet/org **薄入口为 stretch**，不进 v0 Acceptance；先交付群聊即协作边界 |
| D9 | 联系 ACL | 可建聊对象 ⊆ **本人 owner** ∪ **显式邀请** ∪ **ACN 现规下公开可发现**；禁止无约束全网私信扫号 |
| D10 | 独立站 IdP | 复用 AgentPlanet **Global Auth0**；CN 场景可复用**微信 JWT**；不新造第三套账号体系 |
| D11 | 主发送路径 | **持久化与权限以 `/api/chats` 消息为准**；stream 为同会话附带通道（收敛 `/api/ai_chat`，见 §4.5） |
| D12 | 产品命名 | 独立 Chat 产品名 **Interfaze**，域名 **interfaze.io**；应用仓库 **`interfaze`**（workspace 并列目录，与 `acn`/`ranch`/`backend` 同惯例）；工程包暂名 `@acnlabs/agent-chat` |

---

## 1. Problem Statement

ACN 已提供注册、通信、组织与子网能力，但人侧缺少统一、可复用的对话与群聊壳：

- AgentPlanet 现网前端几乎无 IM；早期能力沉在 `ranch` + `backend`，与 Workspace 缠在一起，未产品化为生态组件。
- ComicLaw Studio 已自研对话能力，形态正确，但是应用内实现，难被其他应用复用。
- 用户期望：在生态任一平台与该平台智能体交互；在平台无关（独立）场景下，与自有 / 他人 ACN agent 交互，并自建网络与群。

若不抽层，各应用将继续各写一套 Proxy + Widget，群聊与 ACN 身份也无法统一。

## 2. Solution

1. **Agent Chat Shell**：可嵌入组件（侧屏 / 全屏）+ 可独立站使用（D10 IdP）。  
2. **Chat Gateway**：人侧鉴权、会话/消息/群聊持久化、WS 实时、§4.3.1 人↔ACN 投递闭环（密钥不出浏览器）。  
3. **对端硬条件**：ACN 已注册 **且** 通过 D9 ACL；Host 可注入默认 agent；选人器默认开放（Host 可关）。  
4. **参照三角**：ranch+backend（实现底座）· ComicLaw Studio（嵌入与 stream）· Lighthouse（群聊协作 UX，忽略其买镜像/管 runtime）。

```text
Host App 或独立站
    │ 侧屏 | 全屏
    ▼
Chat Shell（UI 包）
    │
    ▼
Chat Gateway（backend 清晰模块，可二期拆服务）
    │ 1:1 / 群 · 会话 · WS
    ▼
ACN：ACL 内已注册 agent ·（stretch）subnet / org
```

## 3. User Stories

### 3.1 对话与群聊

1. As a 登录用户, I want 与 ACL 允许的 ACN 已注册 agent 单聊（自有 / 受邀 / 公开可发现）, so that 不依赖某一产品站点的专用助手。  
2. As a 登录用户, I want 创建群聊并加入多名 ACN agent（及人）, so that 能多方协作（复用 ranch 群聊能力）。  
3. As a 登录用户, I want 在群内看到各参与者消息与基本状态, so that 知道谁在响应。  
4. As a 用户, I want 新开/清空/切换会话且按账号隔离, so that 上下文不串号。  
5. As a 用户, I want 流式回复与基础 Markdown 展示, so that 体验不低于现有 ranch / ComicLaw。

### 3.2 平台嵌入 vs 独立

6. As a Host 集成方, I want 以侧屏模式嵌入 Chat Shell, so that 桌面主站可边浏览边聊。  
7. As a Host 集成方 / 移动用户, I want 全屏模式, so that 小屏与专注会话可用同一组件。  
8. As a Host, I want 注入默认 agent、品牌与可选业务上下文（如 `task_id`）, so that 平台官方助手开箱即用，且用户仍可改连其他 ACN agent（除非 Host 关闭选人器）。  
9. As a 独立站用户, I want 用 Auth0（或 CN 微信 JWT）登录并与自有 ACN agent 交互、建群, so that Chat 本身可独立使用且无第三套账号。

### 3.3 组网

10. As a 用户, I want 用多 agent 群聊形成协作边界, so that v0 不必先懂 subnet/org CLI。（**D8：subnet/org 薄入口为 stretch**）  
11. As a 用户, I want 在选人器中按 ACL 挑选其他已注册 ACN agent 加入会话/群, so that 发现与邀请不绑死单一平台目录。

### 3.4 安全与成本

12. As a 平台, I want 浏览器永不持有 agent runtime / Gateway 密钥, so that 泄露面可控。  
13. As a 平台, I want 人侧会话与工具代理可审计（谁、哪会话、哪 agent）, so that 出问题可追。  
14. As a 用户, I want 对话消耗可接日限额 / 余额钩子（Host 可配置）, so that 算力成本可控。  
15. As a 用户, I want Gateway 或上游不可用时有明确降级, so that 知道是壳挂了还是某 agent 挂了。

### 3.5 非目标用户故事（明确不做）

- ~~管控 agent 的模型、技能安装、通道绑定、云桌面~~ → 开放能力 / 各 runtime 自有面板。  
- ~~在 Chat 内实现平台双官方 agent 部署~~ → Host 运维文档。

## 4. Implementation Decisions

### 4.1 模块

| 模块 | 职责 | v0 落点 |
|---|---|---|
| **Chat Shell UI** | 列表、1:1、群聊、侧屏/全屏、上下文条 | **`packages/agent-chat`**（`@acnlabs/agent-chat`）已落地最小可嵌入壳；ranch 全量侧栏为后续迁入源 |
| **Chat Gateway** | 鉴权、chats/threads/messages、WS、ACN 路由 | `backend` 现有 chats/threads/websocket **硬化边界**；实现 §4.3.1 投递闭环 |
| **ACN Adapter** | 解析注册、ACL、发消息、回程入库 | 调 ACN registry + communication / A2A（或统一投递端口）；**无框架分支** |
| **Host SDK / 嵌入 API** | `mode=side|full`、默认 agent、auth、context | 文档 + 组件 props；ComicLaw / AgentPlanet 为前两个宿主 |
| **独立站** | 无业务页的纯 Chat Host | 最小 Next（或等价）壳 + D10 IdP；可与首个 Host 嵌入并行 |
| **CN BFF（Host 注记）** | 微信 JWT → Gateway | AgentPlanet CN 经现有 BFF 反代 Gateway，与商店鉴权一致；Shell 本身不实现微信登录 |

### 4.2 与现有代码的关系

| 资产 | 处置 |
|---|---|
| `ranch` GlobalChatSidebar / 群聊 / Thread | **迁移源**：拆包、去 Workspace 强耦合、修嵌入 API |
| `backend` `/api/chats` · threads · `/ws` | **Gateway 内核**：保留模型；补 ACN agent 参与者语义与路由清晰化 |
| `backend` `/api/ai_chat` | 收敛为 Gateway 上流式出口之一，或标记遗留并逐步并入 chats 发送路径 |
| ComicLaw Studio ChatWidget | **嵌入与 stream UX 参照**；契约对齐后可改为消费同一 Shell/Gateway |
| Workspace | 可选 `context.workspace_id`；创建会话**不强制**先有 Workspace |
| Labs Concierge | Host 插件：默认 agent + 业务工具白名单，见 [concierge PRD](./labs-concierge-prd-v0.md) |

### 4.3 对端、ACL 与参与者模型（v0）

- 会话参与者：`user`（平台人类账号，与现网 `ChatParticipant` 对齐）与 `agent`（ACN `agent_id`）。  
- **建聊 / 加群 ACL（D9）** — 仅当目标 agent 满足之一才允许写入参与者：  
  1. 当前用户为该 agent 的 **owner**（或平台等价「自有」判定）；或  
  2. 已存在针对该用户/会话的 **显式邀请**；或  
  3. ACN **现规下公开可发现**（随 registry visibility；无公开字段则 v0 仅 1+2）。  
  拒绝时返回 `chat_forbidden` / `agent_not_found`（见 §5），**禁止**无约束枚举全网私信。  
- 选人器搜索结果必须套用同一 ACL（不得展示不可建聊的 id 为可点）。  
- **不**在 Gateway 内识别「这是 OpenClaw 还是 Hermes」。  
- Host 预置官方 agent = 配置项，不是单独产品线。  
- **Thread / Topics（产品句）**：**话题 = 同一会话主时间线上的分段标签；默认不离开主时间线。Topics 列表是目录，不是默认聊天页。**  
  - 底层仍用现有 Thread API（`thread_id`）；`/topic` 创建 Thread 后留在主时间线，用横线分隔 + 发送上下文芯片打标。  
  - **过滤视图**（只看某一话题）为次要入口，仅从 Topics 目录进入；时间线上的 `#` 分隔线不进入过滤页。  
  - 关闭发送上下文（芯片 × / 退出过滤）后，新消息 `thread_id = null`；agent 回写继承**最近一条相关用户消息**的 `thread_id`（含 null），不得跨过主时间线去捡旧话题。  
  - v0 UI 可降级（不展示话题仍须消息进默认线程/主时间线），不阻塞 Acceptance。

### 4.3.1 投递闭环（人 ↔ ACN agent）

v0 **必须**打通下列闭环；遗留的 agent-system / 按框架分支路径标记 deprecated，不得作为新 Host 默认。

| 方向 | v0 约定 |
|---|---|
| **人 → agent** | 用户消息先写入 `messages`（`/api/chats/{id}/messages`），再由 Gateway **ACN Adapter** 投递到目标 `agent_id`（ACN communication / A2A 或统一投递端口）。**无** OpenClaw/Hermes 专用分支。群聊投递：**@ 必达**；**无 @ 不默认广播**全员 agent（与 chat-gateway-boundary §4 一致）。显式「问全员」才扩成全体 mentions。计费与投递目标同一解析，见 [interfaze-plan-usage-v0](./interfaze-plan-usage-v0.md) P9/P14/P15。 |
| **agent → 人** | agent 经 ACN 回程（webhook / Gateway 拉取 / A2A 回调，实现选定一种）→ **规范化写入同一 `chat_id` 的 `messages`**（`sender` = 该 `agent_id`）→ 经现有 **`WS /ws` subscribe `chat_id`** 推前端。Stream 若存在，必须关联同一 `chat_id` / message id，避免双账本。宿主契约见 [chat-agent-writeback-v0](../architecture/chat-agent-writeback-v0.md)。 |
| **失败区分** | `GET /api/chat/health` 只表示 **Gateway/壳**；单 agent 不可达用消息级/发送级错误：`agent_unreachable`（与 `agent_not_found`、`chat_forbidden` 区分）。UI 文案须能说清「壳挂了」vs「这个 agent 离线」。 |
| **幂等** | 同一客户端发送 id / 上游回执 id 重放不得产生重复用户可见消息。 |

### 4.4 嵌入 API（示意）

```ts
<AgentChatShell
  mode="side" | "full"
  auth={/* Host 会话：Auth0 / 微信 JWT（经 BFF） */}
  defaultAgentIds?: string[]      // Host 官方/推荐，可空
  allowAgentPicker?: boolean      // 默认 true；Host 可关
  context?: { task_id?; board_id?; workspace_id?; ... }
  gatewayBaseUrl={/* Chat Gateway；CN 可为 BFF 同源前缀 */}
  locale?: string
  onClose?: () => void
/>
```

事件打开（参照 ComicLaw `CHAT_OPEN_EVENT`）由 Host 自行桥接。

### 4.5 API 契约与主发送路径（D11）

**人可见主路径（锁定）：**

1. 列表/会话/参与者/历史：`/api/chats*`（已有，演进）。  
2. 发送：`POST /api/chats/{id}/messages` → 持久化 → ACN 投递（§4.3.1）。  
3. 实时：`WS /ws` subscribe `chat_id`。  
4. Stream（打字机）：作为**同会话附带通道**（可继续兼容 Vercel AI Data Stream 形态），但 **canonical 消息以 chats 表为准**；`/api/ai_chat` 标记遗留并逐步并入「chats 发送 + stream 附加」，禁止新 Host 只接 `ai_chat` 不落库。

其余：

- Thread API（已有）— 见 §4.3。  
- `GET /api/chat/health` — Gateway/壳可用性。  
- `GET /api/chat/agents/search` — 薄封装 ACN 发现 + **D9 ACL 过滤**，供选人器。  

Host 业务工具代理（如 Concierge `create_task`）**不属于** Shell 核心；由 Host 在 Gateway 旁路或 agent 自身 skill 提供。

### 4.6 与 Lighthouse 的同与不同

| | Lighthouse Agent | 本 Chat Shell |
|---|---|---|
| 对话 / Agent 群聊 | 有 | 有（ranch 底座） |
| 多框架表面 | 支持 OpenClaw、Hermes 等 | **表面也不区分**——只认 ACN |
| 买实例 / 配模型技能通道 / 云桌面 | 核心 | **Out** |
| 网络身份 | 云厂商实例与 IM 通道 | ACN registry + subnet/org |
| 分发 | 一站式站内 | **组件嵌入 + 可独立** |

## 5. Testing Decisions

### 5.1 稳定 error code（v0 最小集）

| Code | 何时 |
|---|---|
| `unauthorized` | 未登录 / 令牌无效（HTTP 401） |
| `agent_not_found` | ACN 无此注册或不可解析 |
| `chat_forbidden` | 注册存在但未过 D9 ACL |
| `agent_unreachable` | 投递失败 / 超时 / agent 离线（壳仍健康） |
| `rate_limited` | 日限额或速率限制 |
| `chat_health_down` | `GET /api/chat/health` 失败（壳/Gateway 不可用） |

### 5.2 行为测

- 未登录 → 401；串号隔离；清空会话后不可见旧消息。  
- owner / 邀请 / 公开可发现 建聊成功；其它 → `chat_forbidden` 或 `agent_not_found`。  
- 1:1 与群聊：人消息落库 →（mock）ACN 投递；agent 回程落库 → WS 推送。  
- health down vs `agent_unreachable` 文案可区分。  
- `mode=side|full` 冒烟；独立站 Auth0（或测试 IdP）登录冒烟。  
- Gateway 单测不依赖真实 LLM / 真实 OpenClaw / Hermes。  
- Prior art：`backend/tests/test_chats.py`、ranch 验证记录、ComicLaw `/api/chat`、`docs/features/chat/*`。

## 6. Out of Scope（v0）

- Agent 内部管控（模型、技能市场、通道、云桌面、观测大盘）。  
- 平台双官方 agent 的部署与联调剧本（Host 运维）。  
- Labs Concierge 业务工具矩阵（见 Concierge PRD；挂在 Shell 之上）。  
- subnet/org 完整管理 UI（D8 stretch；不等于群聊）。  
- A5 短名单重排、Org 多步 wave 编排 UI。  
- 将 Chat 做成第二个 ACN Kernel。  
- 一次重写所有 Workspace 文件/Git 能力。  
- 新造独立于 Auth0/微信的第三套账号体系。

## 7. 工程顺序（建议）

1. **定界落地**：本 PRD Accepted；backend Gateway 模块边界文档（含 §4.3.1 投递/回程选型）。  
2. **ACL + ACN 投递闭环**：D9 校验可测；人→agent→人回程入库 + WS。  
3. **主路径收敛**：新流量走 `/api/chats`；`ai_chat` 遗留标记。  
4. **UI 抽包**：`packages/agent-chat`（或 ranch 导出过渡）；侧屏 + 全屏；去 Workspace 强依赖。  
5. **群聊迁稳**：现有群聊在新包 + Gateway 上回归。  
6. **宿主接入**：AgentPlanet 嵌入（CN 经 BFF）；ComicLaw 契约对齐。  
7. **Interfaze 独立仓最小壳**（`interfaze/` → interfaze.io）+ D10 IdP（可与 6 并行）。  
8. **（后置）** Host 业务工具 / Concierge；subnet/org 薄入口（D8 stretch）。

## 8. Acceptance（v0 完成标准）

1. 登录用户可与 **D9 ACL 允许** 的 ACN 已注册 agent 完成多轮 1:1（含 §4.3.1 回程落库；上游 agent 在线时）。  
2. 登录用户可创建群聊、添加多名 ACN agent、收发消息（迁稳 ranch；非演示假数据）。  
3. 同一 Shell 支持 **侧屏** 与 **全屏**，并被至少一个 Host（建议 AgentPlanet）嵌入。  
4. **Interfaze** 独立使用路径存在（interfaze.io / 仓库 `interfaze`）：Auth0（或 CN 微信 JWT）登录后，无 Labs/ComicLaw 业务页也可聊自有 agent 并建群。  
5. Gateway / Shell **无**按 agent 框架的分支逻辑；浏览器 Network 无 runtime/Gateway 密钥。  
6. `GET /api/chat/health` 可表达壳不可用；与 `agent_unreachable` 对用户可区分。  
7. Workspace 非创建会话的前置条件。  
8. 未过 ACL 的建聊返回 `chat_forbidden` 或 `agent_not_found`；无「任意扫全网私信」入口。

## 9. Further Notes

- **Gateway 边界 SoT：** [chat-gateway-boundary-v0](../architecture/chat-gateway-boundary-v0.md)（投递闭环、群聊 @ 策略、ACL 挂载点、与 UnifiedAgentGateway 关系）。
- **Topics 心智（Interfaze / RanchChatShell）：** 见 §4.3 Thread / Topics 产品句——时间线分段为主，Topics 目录次之，过滤页再次之；`@` 管投递，话题管归属，二者正交。
- **主人接 Interfaze（人话）：** [interfaze-connect-agent.md](./interfaze-connect-agent.md)。  
- **ACN Agent 管理（非 runtime）：** [interfaze-acn-agent-management-v0.md](./interfaze-acn-agent-management-v0.md)——「我的 Agents」管身份/连接/权限，不管模型·通道·Skill 安装。  
- 计费钩子 v0 只要求**可接**（日限额/余额 → `rate_limited`），具体 Credits/星币价表由 Host 定。Interfaze 账号经济与扣费前置假设见 [interfaze-plan-usage-v0](./interfaze-plan-usage-v0.md)（§4）。  
- D8：subnet/org 链接触发器二期加粗；v0 验收不依赖其完成。  
- [Labs Concierge](./labs-concierge-prd-v0.md) 仅描述 **AgentPlanet 官方客户 agent + 业务工具**，对话壳验收以本文为准。  
- 请将 #18 / #56 **拆分或改标题**：Shell（父）与 Concierge 工具（子）分开跟踪，避免按旧「平行 `/api/labs/chat` IM」开工。  
- 实现建议**新开工程对话/PR**，与 Labs A4/hybrid 观察期、Concierge 工具切片可并行，但模块边界以本文 + Gateway 边界文档为准。
