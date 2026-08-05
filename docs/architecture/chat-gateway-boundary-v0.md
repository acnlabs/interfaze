# Chat Gateway 模块边界 v0

**Status:** **Accepted**（随 Chat Shell PRD；工程切片进行中）  
**Date:** 2026-08-01 · **Code:** `chat_acl.py` · `GET /api/chat/health` · chats create/participants ACL  
**Audience:** Backend / Frontend / BFF  
**Non-goals:** Labs Concierge 工具矩阵（见 [labs-concierge-prd-v0](../product/labs-concierge-prd-v0.md)）；agent runtime 管控

> **一句话：** Chat Gateway = 人侧会话账本 + ACL + 实时推送 + 将消息投递到 **ACN 已注册 agent**；不负责业务工具白名单，也不按 OpenClaw/Hermes 分叉。

---

## 1. 归属与非归属

| 属于 Chat Gateway | 不属于（边界外） |
|---|---|
| `POST/GET /api/chats*`、participants、messages | Labs Concierge Tool Adapter |
| Thread API（可保留；UI 可降级） | Workspace 文件/Git/Sandbox |
| `WS /ws`（subscribe `chat_id`） | 按框架的 runtime 配置面板 |
| `GET /api/chat/health`（待加） | subnet/org 完整管理 UI（PRD D8 stretch） |
| `GET /api/chat/agents/search`（待加，ACL 过滤） | `/api/ai_chat` 作为新 Host 唯一入口 |
| D9 ACL；§ 投递闭环 | 平台双官方 agent 部署剧本 |

**代码落点（现网 → 演进）：**

| 能力 | 现网 | Gateway v0 |
|---|---|---|
| 会话/消息 | `backend/app/api/chats.py` · `chat_service.py` | **保留为 canonical** |
| Thread / Topics | `api/threads.py` · `thread_service.py` · UI 主时间线分段 | **保留**。产品句：话题 = 主时间线分段标签（默认不离主时间线）；Topics 列表 = 目录；过滤视图次要。Agent writeback 继承最近相关用户消息的 `thread_id`（含 `null`），见 `ChatService.resolve_agent_writeback_thread_id`。 |
| WS | `backend/app/websocket/` | 保留 |
| Agent 调用 | `chat_service._notify_agent` → `UnifiedAgentGateway` | **ACN 路径为 Shell 验收路径**；见 §3 |
| Stream 旁路 | `api/ai_chat.py`（`/api/chat/stream`） | **遗留**：须带 `chatId` 落库或逐步并入 chats 发送 |

UI 包：`@acnlabs/agent-chat` → `packages/agent-chat`（**`RanchChatShell`** = ranch 列表/会话/建聊 chrome + Gateway；最小 `AgentChatShell` 仅 Labs assistant 过渡）。独立产品 **Interfaze**（仓库 `interfaze/` · interfaze.io）。

---

## 2. 与 UnifiedAgentGateway 的关系

现网已有 [unified-agent-gateway.md](./unified-agent-gateway.md)：`local` / `acn` / `sys` 适配器。

| 层 | 职责 |
|---|---|
| **Chat Gateway（本文件）** | 人侧 IM：鉴权、ACL、持久化、WS、error code |
| **UnifiedAgentGateway** | 出站调用适配；Shell 产品只验收 **ACN Adapter** 路径 |

**Shell v0 锁定：**

- 新建会话参与者 `agent_id` 必须是 **ACN 可解析 id**（裸 uuid 或 `acn:uuid`，入库前 normalize 为 ACN id）。  
- **不**为 OpenClaw / Hermes 增加 Gateway 分支。  
- `local:` / `sys:` 可继续服务 ranch 遗留场景，但 **不计入** Chat Shell Acceptance；新 Host（AgentPlanet / 独立站）默认只暴露 ACN 选人。

---

## 3. 投递闭环（锁定选型）

对齐 PRD §4.3.1。v0 **采用现网已验证形状**，不先上独立 webhook 总线。

```text
User → POST /api/chats/{id}/messages
         → 持久化 messages（canonical）
         → ACL 已在建会话/加参与者时校验
         → 投递策略（§4）选出 target agent_ids
         → UnifiedAgentGateway.call_agent[_stream]（ACN Adapter）
         → 回程内容 _save_message_with_id / send_message
         → event_publisher → WS 推前端
```

| 项 | v0 锁定 |
|---|---|
| 人 → agent | 先落库再出站；出站经 **ACN Adapter**（A2A `role/parts` + `metadata.agentplanet.chat_id`） |
| agent → 人（同步） | 同请求链若带回**真实正文** → 落库为 `sender=agent` + WS |
| Mode B / inbox ACK | `delivery_mode=relay` 且正文为 `accepted`（或 `inbox`）→ **系统送达态**，**禁止**当作 agent 气泡；等待 `POST /api/chats/{id}/agent-messages` 回写 |
| 异步 writeback | 见下 §3.1（`agent-messages` + 出站 metadata）；**禁止** Interfaze 直连 OpenClaw |
| 幂等 | 客户端 `client_message_id`（可后续加字段）或 stream 预设 `message_id` 防双写 |
| 失败码 | `agent_unreachable`；壳挂 → `chat/health` 失败；回写非参与者 → `agent_not_participant` |

### 3.1 Agent → 人 writeback 契约（Mode B / 异步宿主）

```text
人消息落库
  → ACN Adapter internal/send
       message.metadata.agentplanet = {
         chat_id, message_id, from_user,
         reply_channel: "agentplanet.chat",
         reply_path: "/api/chats/{chat_id}/agent-messages",
         history_path, info_path   # group/workspace
       }
  → Mode B: 同步仅 ACK → delivery 态；等待异步回写
  → 宿主 wake / 推理完成后:

    # 1) mint ACN agent JWT (acn_* key → POST {ACN}/oauth/token)
    POST {AGENTPLANET_API}/api/chats/{chat_id}/agent-messages
Authorization: Bearer <ACN agent JWT>   # sub = agent_id；≠ Internal Token
Body:   { "content": "<最终回复正文>" }

  → 校验 JWT sub 已是该 chat 的 active agent participant
  → 落库 sender_type=agent, deliver=false（不回投 ACN）
  → WS message.new → Interfaze
```

**宿主侧最小责任（任意 runtime）：** 从 wake/`raw` 里取出 `metadata.agentplanet.chat_id`；有则用 **ACN agent JWT** 回写；无则忽略（非 Chat 流量，如 Task invite）。

**Agent 作者完整说明（框架无关）：** [chat-agent-writeback-v0.md](./chat-agent-writeback-v0.md)。

---

## 4. 群聊投递策略（锁定）

| 规则 | v0 |
|---|---|
| 消息含 `@agent_id`（mentions） | **必达** 被提及的 agent |
| 无 @ | **不**默认广播全员 agent（避免群噪与费用爆炸） |
| 配置预留 | `chat.metadata.broadcast_unmentioned_agents`（默认 `false`）供后续打开 |
| 仅 1:1 direct | 无 @ 也投递唯一对方 agent |
| 出站上下文（group/workspace） | **成员摘要 + 近期原文 transcript** 写入 A2A text；不够再经 `info_path` / `history_path`（ACN agent JWT）拉取。摘要非默认。私聊仍为单句原文。 |

与现网 `ai_chat`「无 @ 用 body.agent_id / @all」对齐方式：Shell UI 在 1:1 不依赖 @；群聊引导用户 @ 或提供「问全员」显式动作（映射为 mentions=全体 agent）。

---

## 5. ACL 强制点（D9）

在以下入口调用同一 `assert_can_chat_with_agent(user_id, agent_id)`：

1. `POST /api/chats/direct`  
2. `POST /api/chats/group`（每个 agent 参与者）  
3. `POST /api/chats/{id}/participants`  
4. `GET /api/chat/agents/search`（结果过滤）

允许当且仅当：

- 用户为 agent **owner**；或  
- 存在对该用户的 **显式邀请**；或  
- ACN **公开可发现**（无字段则 v0 仅前两条）。

拒绝：`chat_forbidden` / `agent_not_found`（见 PRD §5.1）。

---

## 6. 主发送路径 vs 遗留 stream（D11）

| 路径 | 状态 | 规则 |
|---|---|---|
| `POST /api/chats/{id}/messages` | **canonical** | 新 Host / Shell 必用 |
| WS `/ws` | **canonical 实时** | subscribe `chat_id` |
| `POST /api/chat/stream`（ai_chat） | **legacy** | 若保留：强制 `chatId`，助手消息写入同一 chat；文档标注勿作唯一入口 |
| 新 Host | — | 禁止「只接 ai_chat、不落 chats」 |

---

## 7. Health 与鉴权

| 端点/机制 | 含义 |
|---|---|
| `GET /api/chat/health` | DB +（可选）ACN `/ready` 探针；**不**表示某个 agent 在线 |
| 用户鉴权 | Global：Auth0 JWT；CN Host：BFF 校验微信 JWT 后调 Gateway |
| 独立站 | 同 PRD D10：Auth0（+ 可选微信） |

---

## 8. 与 Concierge / Host 插件槽

```text
Chat Gateway  ──会话──►  ACN agent（含 Concierge agent_id）
     │
     └──（旁路，非 Gateway 核心）Host Tool Adapter
              create_task / collab_match / …
```

Tool Adapter 挂在 Labs/Host 路由，**读写任务不进** `messages` 账本核心；可在确认后往会话贴一条系统摘要消息（可选 UX）。

---

## 9. 工程切片（实现顺序）

1. ~~`assert_can_chat_with_agent` + direct/group/participants 挂载 + 测试~~ **done**（`app/services/chat_acl.py`）  
2. ~~确认 ACN Adapter 投递/回程在 1:1 可测（mock）~~ **done**（`send_message` → `_notify_agent` → UnifiedAgentGateway；`test_chat_delivery.py`）  
3. ~~群聊 mentions 必达 + 无 @ 不广播~~ **done**（`chat_delivery.resolve_agent_delivery_targets`；direct 无 @ 也投递 peer）  
4. ~~`GET /api/chat/health` + error code 对齐~~ **done**（`app/api/chat_gateway.py`）  
5. ~~`ai_chat` legacy 注释与 chatId 告警~~ **done**（硬强制 chatId 留给配置开关，避免打断 ranch）  
6. ~~UI 抽包 + AgentPlanet 嵌入~~ **done（过渡）**：`packages/agent-chat`；`AgentChatHost`  
7. ~~联调 smoke~~ **done**：`deploy-cn/smoke-chat-gateway.sh`  
8. ~~WS 实时~~ **done（壳侧）**：`connectChatSocket` + subscribe `chat_id`  
9. ~~群聊 UI 最小入口~~ **done**：壳内 1:1 / Group 切换；发送 @ 首位 agent

---

## 10. 开放但已足够开工

| 项 | 状态 |
|---|---|
| 回程 = 同链 stream/sync **或** §3.1 writeback | **已锁**（§3 / §3.1） |
| 群聊无 @ 不广播 | **已锁**（§4） |
| Mode B ACK ≠ 回复 | **done**（Adapter `delivery_ack` + system 送达态） |
| 宿主 writeback 接入（Comiclaw 等） | 契约已锁；实现在各 runtime |
| `client_message_id` 字段 | 可在实现 PR 加 |
| 包从 ranch 搬 `packages/` 的 PR 切分 | 实现时定，不挡 Gateway |

**本文 Accepted 条件：** 与 Chat Shell PRD 无冲突即可随 Shell 工程一并视为边界 SoT；若实现中改回程模型，须先改本文再改代码。
