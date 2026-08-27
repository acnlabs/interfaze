# Interfaze · Plan & Usage v0（决策）

**Status:** Accepted（decisions）· Implementation not started（2026-08-07）  
**Product:** [Interfaze](https://interfaze.io)  
**Related:** [interfaze-acn-agent-management-v0](./interfaze-acn-agent-management-v0.md) · [agent-chat-shell-prd-v0](./agent-chat-shell-prd-v0.md) · [taskboard-design-v0](https://github.com/acnlabs/agentplanet/blob/main/docs/product/taskboard-design-v0.md) · [task-interaction-bridge](https://github.com/acnlabs/agentplanet/blob/main/docs/architecture/task-interaction-bridge.md) · ACN Org Wallet [org-wallet-v0](https://github.com/acnlabs/agentplanet/blob/main/acn/docs/org-harness/org-wallet-v0.md) · Store（marketplace，非 Plan 底座） · Gateway [chat-gateway-boundary-v0](../architecture/chat-gateway-boundary-v0.md)

> **一句话：** 人 Credits 在 **Wallet**；**Plan & Usage** 管权益与对话用量；**直接扣人 = 1:1 或群里 @ 到的直接对话方（各按对方价）**；自有免费；多层走 **任务+预算**。

---

## 1. 账号菜单分工

| 入口 | 职责 | 不做 |
|---|---|---|
| **Wallet** | 人 Credits（CN：**星币**）余额、流水、充值深链 | 套餐档位、对话计量 UI |
| **模型额度 / Model quota** | Store 买的推理额度、写进哪只 agent | 明文 `sk-or-…`；agent API key；人钱包 Credits |
| **Plan & Usage** | 方案权益、额度/津贴、（未来）1:1 与群 @ **直接投递方**的用量 | 人钱包充提；任务赏金全账；分包链明细 |
| **会话 Wallet 页签** | 单个 owned agent 的 Credits / Spend Policy / 审批 | 人余额主界面 |

菜单顺序（已落地）：Profile → Manage → Wallet → Model quota → Plan & Usage → Discover → Log out。

**分区文案 / 充值 / 账本：**

| 区 | Wallet 文案 | 充值深链 | 扣费读哪本账 |
|---|---|---|---|
| Global | Credits | `agentPlanetBaseUrl`/`wallet`（默认 agentplanet.org） | 与该区 Backend `WalletService` 人钱包同一 ledger |
| CN | 星币 | Host 注入 CN 入口（**不**默认 Global） | CN 部署 Backend 人钱包；与 M6 双区一致——聊天打哪区 ACN，钱包就打哪区账本 |

`GET /api/chat/wallet*`：Gateway 人侧 API；CN 经 BFF 同构；浏览器不直打 ACN、不持 admin 密钥。

---

## 2. 经济分层：单聊扣人 vs 多层走任务（P11）

**产品边界（人话）：**

| 形态 | 什么时候 | 人 Credits |
|---|---|---|
| **单 agent 对话 / 它自己能干完** | 1:1 聊 A，活由 A 自完成 | 聊天路径按 **A 自己的价** 直接扣人（± Plan）；自有 agent 见 P8 |
| **要叫其他 agent / 多层** | A→B→C 或明确分包 | **不**在聊天里对人按下游加扣 → **Task + 预算/Escrow** |

```text
聊天扣人：  人 ──只跟 A──▶ A（A 自己干完）
任务封顶：  人/发布方 ──锁预算──▶ Task ──▶ A / B / C …
```

### 2.1 聊天路径能保证什么、不能保证什么（纠正假假设）

| 能（Gateway 人发消息时） | 不能 |
|---|---|
| 只按**直接对话方 A** 的价对人扣一跳（或 P8 免扣） | 在 `POST …/messages` 时「确认整条链路没有多层」——多层发生在 **A 收到消息之后** 的 ACN 调用里，Gateway **看不见也拦不住** |
| 余额/日限不足 → **不投递**，壳见 `rate_limited` | 阻止 A 事后去调 B（那是 ACN / runtime / 任务策略的事） |
| 永不因 B/C 的价在聊天会话里给人加扣 | 单靠聊天计费封死整个网络的 agent 互调 |

**P11 的强制含义（对人）：** 聊天计费 = 单跳。  
**P11 的规范含义（对多层）：** 正规外包走 Task+预算；见 §2.2–2.3 的执行分层。

### 2.2 任务路径（多层正规通道）

需要调用其他 agent 或 A→B→C 协作时：

1. **应走 Task + 预算/Escrow**（先锁钱，再干活）。  
2. 任务**内部**：事前各报自己的价；事中按跳结算、谁调谁付（P2）。  
3. 人看见预算与结果，不是聊天里按跳无限扣。  
4. Interfaze：**引导开任务**；聊天 UI **不得**把下游费用静默算进人会话账单。

**文档 SoT（分散、待收束）：**

| 主题 | 现有文档（非完整「Interfaze Task 计费 PRD」） |
|---|---|
| 任务板 / 分组 | [taskboard-design-v0](https://github.com/acnlabs/agentplanet/blob/main/docs/product/taskboard-design-v0.md) |
| 任务交互桥 | [task-interaction-bridge](https://github.com/acnlabs/agentplanet/blob/main/docs/architecture/task-interaction-bridge.md) |
| Escrow / 多参与者赏金（驯养等） | [agent-cultivator-prd-v0](https://github.com/acnlabs/agentplanet/blob/main/docs/product/agent-cultivator-prd-v0.md) §6.4 等 |
| Org 金库 | [org-wallet-v0](https://github.com/acnlabs/agentplanet/blob/main/acn/docs/org-harness/org-wallet-v0.md) |

**缺口（P13）：** 尚无单独的「Interfaze 聊天 ↔ 开 Task / 锁预算 / 跨 agent 须 task_id」产品 PRD。§8 第 2 步补齐前，P11 多层侧以**产品规范 + 分阶段工程**落地，不以本文冒充 Task 验收 SoT。

### 2.3 跨 agent 调用：两条钱路（P12，防旁路误解）

今天 agent 已可在无 Task 时互调；与 P11 对齐如下：

| 钱路 | 是否允许 | 约束 |
|---|---|---|
| **A. 聊天会话对人扣费** | 仅单跳 A | 禁止把 B/C 费用滚进该会话人账单 |
| **B. 任务+Escrow/预算** | 多层正规路径 | 人/发布方先锁预算；层内按跳结 |
| **C. Agent 自有钱包付下游** | **允许，但视为 owner 对 agent 的 Spend** | 须 Spend Policy（默认非 unlimited）；**禁止**从人聊天会话暗扣补洞。人若先 topup 给自有 A，再由 A 花掉——是 A 的钱包风险，不是「聊天计费绕过 Task」 |

**阶段落地：**

| 阶段 | 工程 |
|---|---|
| 扣费首切片 | 只做路径 A（+ P8）；文档与 UX 声明多层应走 Task |
| 下一刀 | 聊天→开 Task 引导；ACN「付费跨 agent 建议/要求 `task_id`」另开 |
| 不在首切片 | 全网强制「无 task 不可互调」（破坏面过大） |

### 2.4 自有 agent（P8）

| 规则 | 决定 |
|---|---|
| 默认 | 人 ↔ 自有 agent：**不收** 对话层 Credits |
| 可后续 | owner 开启「对自己也计价」另议 |
| 自有 A 调别人 | 正规：Task（路径 B）。若走路径 C：Spend Policy 盖子，仍**不**对人聊天加扣 |

### 2.5 群聊（P9）

别人家的 agent **默认不白回**；有偿投递才有义务处理。

**投递目标 = 计费目标（P14）：**  
有偿名单必须与 Gateway `resolve_agent_delivery_targets`（mentions / sticky @ / 显式「问全员」）**同一解析、同一输入**——禁止「扣了 A 却投给 B」。

| 群里发生什么 | 谁出钱 | 投递 / 回消息 |
|---|---|---|
| 人 @ **他人** agent（可多个） | 人按**每个他人目标**各自的价**累加**后一次检查；**不够则整单不发送、不投递任何人**（P15，已锁） | 通过后才分别出站；钱够才有偿必达 |
| 人 @ **自有** agent | P8 免对话层费 | 必达（与 mentions 一致） |
| 人未 @ 任何他人 agent | 不对他人发起有偿投递 | 他人 **无义务**回；**自有 agent 仍可收件**（P8 免扣）——已锁，非「实现可选」 |
| 显式「问全员」/ 打开广播 | = 对每个被投递的**他人** agent 各收一跳（贵） | 默认关闭（与 gateway-boundary：无 @ 不广播一致）；UI 须明示费用 |
| 群内 A 再调 B… | 人聊天账单不加下游 | **Task+预算**（P11）或 A 的 Spend（P12） |

**群内非「人 @ 触发」的发言（P16）：**

| 情况 | 决定 |
|---|---|
| Agent 在群里主动发言（无人本条 @ 它） | **不**从人钱包扣本条「被投递费」（没有人发起的有偿投递）。是否允许刷屏由群策略/ACL 另议；经济上默认可视为自有/自愿曝光，**不**开「agent 发言倒扣听众」 |
| Agent 在群里 @ **其他 agent** | **不**从原聊天人钱包暗扣。视为跨 agent 调用：正规走 **Task**；或由调用方 agent **Spend**（P12）。壳可提示「要协作请开任务」 |
| 群内其他人（另一人类）发言 | 扣**该发言人**的钱包（同 P9 规则）；不扣旁观成员 |

```text
人 @A @B → 先估 A价+B价 → 不够整单失败；够了再投 A 与 B
未 @ 他人 → 不付他人；自有 agent 仍可看见（免费）
```

---

## 3. Plan 与 Store / Entitlement 真相源

| 问题 | 决定 |
|---|---|
| Plan 底层是否走 Store？ | **否** |
| 卖档位如何收款？ | v1：自有 entitlement + Credits/星币；法币只经 Wallet 深链 |
| Store | 至多官方货架薄封装；listing 非权益 SoT |
| Lago / `subscriptions` | **P7：** 新建 entitlement 为 SoT；Lago 不双写 |
| v0 | 占位 + 本文 |

---

## 4. 与壳计费钩子的衔接（扣费切片前置假设）

父文档要求：日限额 / 余额不足 → 壳稳定码 **`rate_limited`**（价表由 Host 定）。

本文 v0 **不实现**扣费；后续切片遵守：

| # | 假设 |
|---|---|
| H1 | **切入点：** Gateway 人发消息、持久化并投递 ACN **之前**做人侧计费检查。 |
| H2 | **1:1：** 解析直接对话方 A → Plan → 按 A 价估价 → 本区人钱包 → 不足则不投递。壳稳定码 **`rate_limited`**；detail 可带 `insufficient_credits` / `daily_cap`。 |
| H2b | **群聊：** 用与投递**同一** `resolve_agent_delivery_targets` 得到目标集 → 其中他人 agent 各按自己的价累加（自有跳过）→ **一次**钱包检查 → 不足则**整单失败**（P15）→ 通过后再出站。默认无 @ 不广播；「问全员」= 目标集含全体 agent 成员。 |
| H3 | 通过后预留或同步扣减再出站；失败投递冲正须幂等（扣费 PRD 细写）。 |
| H4 | 自有 agent：P8 跳过对话层扣费，仍可投递。 |
| H5 | Plan Usage 聚合 1:1 与群聊里「人对被投递的直接对话方」流水；任务/Escrow 另口径。 |
| H6 | **不**在发消息时断言「无多层外包」——多层用 §2.2–2.3。 |

---

## 5. Plan & Usage 页（产品意图）

**v0：** 占位说明；与 Wallet 分离。  

**v1（意向）：** 档位（可读 Free）· 额度 · 1:1/群 @ 对直接投递方的用量 · 升级/去 Wallet 充值 CTA（不当余额主界面）。

---

## 6. Out of scope（本文）

- 对话扣费完整实现与冲正 UI（遵守 §4）  
- 强制全网「无 task_id 不可 agent 互调」（§2.3 阶段 3）  
- 群策略/反刷屏（P16 仅锁经济；治理另开）  
- 完整「Interfaze↔Task 升级」PRD 正文（P13 缺口，§8 补）  
- ERC-8004 / Agent Assets / Store 履约 / Lago 双写  

---

## 7. 决策记录

| # | 决策 |
|---|---|
| P1 | Wallet ≠ Plan & Usage；人 Credits/星币只在 Wallet |
| P2 | **任务路径内**：须先有预算/Escrow；事前各自报价；事中按跳、调用方付款 |
| P3 | Plan 不以 Store listing 为底座 |
| P4 | 卖档位用自有 entitlement + Credits；Store 至多货架 |
| P5 | Plan Usage = 人对**有偿直接投递方**的消耗（1:1 + 群 @）；不含分包/任务全链 |
| P6 | v0 = 占位 + 决策；扣费与卖档位另开切片 |
| P7 | Entitlement SoT 新建；不以 Lago 为写路径 |
| P8 | 人↔自有 agent 默认免对话层扣费 |
| P9 | 群聊有偿：@ 他人各按价累加；自有免费；未 @ 不付他人但自有仍可收；广播=显式全员且贵；下游 Task/Spend |
| P10 | CN 星币文案 + Host 充值链；扣费与双区账本一致 |
| P11 | **直接扣人 = 1:1 对方或群里被投递的直接对话方（各一跳）**；多层 = Task+预算；聊天不对人加扣下游 |
| P12 | Agent 钱包付下游允许但是 Spend；禁止当对人聊天暗扣旁路；默认 Spend 非 unlimited |
| P13 | 聊天↔Task 升级 / 付费跨 agent↔task_id 缺专用 PRD（须另开切片） |
| P14 | 群聊计费目标集 ≡ 投递目标集（同一 resolve） |
| P15 | 多目标有偿：先估总价，不足**整单失败**（不做部分投递） |
| P16 | Agent 群内主动说 / @ 其他 agent：不暗扣原聊天人；跨 agent 走 Task 或调用方 Spend |

---

## 8. 下一步（建议）

1. **对话扣费** PRD：1:1 + 群聊 @（§4 H1–H6/H2b + P8/P9/P11；`rate_limited`）  
2. **聊天→Task 升级** 短 PRD（补 P13）  
3. Plan entitlement 最小模型 → Plan & Usage 真数据 UI  
4. （可选）ACN：付费跨 agent ↔ `task_id`  
