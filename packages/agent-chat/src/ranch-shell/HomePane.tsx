"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { formatCreditBalance, formatLedgerAmount, formatWholeCredits } from "../creditDisplay";
import type { AgentEarnings, GatewayClient, HumanWallet, PlanUsage } from "../gateway";
import type { RanchChatAccount } from "../types";
import { copyText, subnetJoinPrompt } from "./connectPrompt";
import type { RanchLocale, RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors, inputStyle } from "./styles";
import { useModalA11y } from "./useModalA11y";

type AppId = "world" | "market" | "rankings" | "tasks" | "cultivators" | "feed" | "consensus";

const MACHINE_LISTING_IDS = [
  "svc-421e75dd-4ff4-4bc5-bec3--94eda60b3b32",
  "svc-421e75dd-4ff4-4bc5-bec3--3c4846ad699d",
];

function isMachineListing(row: Record<string, unknown>): boolean {
  const id = String(row.product_id || "");
  if (MACHINE_LISTING_IDS.includes(id)) return true;
  const machine = row.machine;
  return !!machine && typeof machine === "object" && String((machine as { kind?: unknown }).kind || "") === "am_machine";
}

const HOME_APPS: { id: AppId; href: string }[] = [
  { id: "world", href: "/world" },
  { id: "cultivators", href: "/cultivators" },
  { id: "feed", href: "/feed" },
];

/** Same smoke/e2e names AgentPlanet hides on the public boards. */
const TEST_AGENT = [
  /^e2e-/i,
  /^smoke-/i,
  /^prod-tasker-/i,
  /^prod-buyer-/i,
  /^prod-seller-/i,
  /^test-wallet/i,
  /^SmokeTest/i,
  /^final-e2e/i,
  /^final-v2/i,
  /^best-effort-test/i,
  /^e2e-agent-/i,
  /^prod-agent-/i,
];

const HOME_SLOTS = 3;

function padSlots<T>(rows: T[]): Array<T | null> {
  const next: Array<T | null> = rows.slice(0, HOME_SLOTS);
  while (next.length < HOME_SLOTS) next.push(null);
  return next;
}

type BoardSeat = {
  id: string;
  name: string;
  note: string;
  metric: string;
  delta: number | null;
  launchId?: string;
  voted?: boolean;
  trial?: string;
  tickets?: number;
  owner?: boolean;
  subnetId?: string;
};

type HomeBoards = {
  campaign: BoardSeat[];
  launch: BoardSeat[];
  leaderboard: BoardSeat[];
  network: BoardSeat[];
};

type HomeOffering = { id: string; name: string; description: string; catalog: "machine" | null };
type HomeMarket = { official: HomeOffering[]; agents: HomeOffering[] };

type HomeTask = {
  id: string;
  title: string;
  description: string;
  type: string;
  forAgents: boolean;
  directJoin: boolean;
  unlimited: boolean;
  reward: string;
  rewardKind: "pts" | "credits" | "other";
  each: boolean;
  completed: number;
  creator: string;
  createdAt: string;
};

type HomeTaskColumns = {
  cultivator: HomeTask[];
};

type HomeCommunityBoard = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  active: number;
  credits: number;
  pts: number;
};

const CULTIVATOR_BOARD_IDS = new Set(["tb_official_cultivator_cn", "tb_official_cultivator_global"]);

function collapse(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function subnetSeats(body: unknown): BoardSeat[] {
  const rows = Array.isArray((body as { subnets?: unknown } | null)?.subnets)
    ? (body as { subnets: Array<Record<string, unknown>> }).subnets
    : [];
  const seats: BoardSeat[] = [];
  for (const row of rows) {
    const id = String(row.slug || "").trim();
    const name = String(row.name || "").trim();
    if (!id || !name) continue;
    const agents = Number(row.agents);
    seats.push({
      id,
      subnetId: id,
      name,
      note: collapse(row.description),
      metric: formatWholeCredits(Number.isFinite(agents) ? agents : 0),
      delta: null,
    });
    if (seats.length >= HOME_SLOTS) break;
  }
  return seats;
}

function oneLine(value: unknown): string {
  const text = collapse(value);
  return text.length > 72 ? `${text.slice(0, 71)}…` : text;
}

const ACTIVE_TASK_STATUS = new Set(["open", "in_progress", "assigned", "submitted"]);

function taskBounty(row: Record<string, unknown>): { credits: number; pts: number } {
  const meta = row.metadata;
  const display =
    meta && typeof meta === "object" && typeof (meta as { reward_display?: unknown }).reward_display === "number"
      ? (meta as { reward_display: number }).reward_display
      : null;
  const currency = String(row.reward_currency || "").toLowerCase();
  const seats = Number(row.max_participants);
  const multiplier = Number.isFinite(seats) && seats > 1 ? seats : 1;
  if ((currency === "ap_points" || currency === "pts") && display != null && display > 0) {
    return { credits: 0, pts: display * multiplier };
  }
  const budget = Number(row.total_budget);
  if (Number.isFinite(budget) && budget > 0) return { credits: budget, pts: 0 };
  const amount = Number(row.reward);
  if (Number.isFinite(amount) && amount > 0 && (!currency || currency === "credits")) {
    return { credits: amount * multiplier, pts: 0 };
  }
  return { credits: 0, pts: 0 };
}

function boardTaskStats(rows: Array<Record<string, unknown>>): Pick<HomeCommunityBoard, "active" | "credits" | "pts"> {
  let active = 0;
  let credits = 0;
  let pts = 0;
  for (const row of rows) {
    const status = String(row.status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") continue;
    const bounty = taskBounty(row);
    credits += bounty.credits;
    pts += bounty.pts;
    if (ACTIVE_TASK_STATUS.has(status) && row.is_expired !== true) active += 1;
  }
  return { active, credits, pts };
}

function isPublicAgent(id: string, name?: string | null): boolean {
  if (TEST_AGENT.some((re) => re.test(id))) return false;
  if (name && TEST_AGENT.some((re) => re.test(name))) return false;
  return true;
}

function isNoisyTask(row: Record<string, unknown>): boolean {
  const title = String(row.title || "");
  const creator = String(row.creator_name || row.creator_display_name || "");
  return /\[QA TEST\]|smoke task/i.test(title) || !isPublicAgent(title, creator);
}

function communityBoards(rows: Array<Record<string, unknown>>): Array<Omit<HomeCommunityBoard, "active" | "credits" | "pts">> {
  const boards: Array<Omit<HomeCommunityBoard, "active" | "credits" | "pts">> = [];
  for (const row of rows) {
    const id = String(row.board_id || "");
    const name = String(row.name || "").trim();
    const slug = String(row.slug || "");
    const creatorId = String(row.creator_id || "");
    if (!id || !name) continue;
    if (row.status && String(row.status) !== "active") continue;
    if (CULTIVATOR_BOARD_IDS.has(id) || (slug === "cultivator-tasks" && creatorId === "platform")) continue;
    if (!isPublicAgent(name, String(row.creator_display_name || creatorId))) continue;
    const categories = Array.isArray(row.allowed_task_types)
      ? row.allowed_task_types.map((item) => collapse(item)).filter(Boolean)
      : [];
    boards.push({ id, name, description: collapse(row.theme), categories });
    if (boards.length >= HOME_SLOTS) break;
  }
  return boards;
}

async function listBoardTasks(api: string, boardId: string): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let offset = 0;
  for (let page = 0; page < 5; page += 1) {
    const body = await readJson(
      `${api}/api/labs/tasks?board_id=${encodeURIComponent(boardId)}&limit=100&offset=${offset}`,
    );
    const tasks = Array.isArray((body as { tasks?: unknown } | null)?.tasks)
      ? (body as { tasks: Array<Record<string, unknown>> }).tasks
      : [];
    rows.push(...tasks);
    const total = Number((body as { total?: unknown } | null)?.total);
    const hasMore = (body as { has_more?: unknown } | null)?.has_more === true;
    offset += tasks.length;
    if (!hasMore || tasks.length === 0 || (Number.isFinite(total) && offset >= total)) break;
  }
  return rows;
}

function boardMainReward(row: Pick<HomeCommunityBoard, "credits" | "pts">, t: { homeTaskCredits: string; homeTaskPts: string }): string {
  if (row.credits > 0) return `${formatWholeCredits(row.credits)} ${t.homeTaskCredits}`;
  if (row.pts > 0) return `${formatWholeCredits(row.pts)} ${t.homeTaskPts}`;
  return `0 ${t.homeTaskCredits}`;
}

function boardExtraReward(row: Pick<HomeCommunityBoard, "credits" | "pts">, t: { homeTaskPts: string }): string {
  if (row.credits > 0 && row.pts > 0) return `${formatWholeCredits(row.pts)} ${t.homeTaskPts}`;
  return "";
}

function taskMainReward(row: HomeTask, t: { homeTaskCredits: string; homeTaskPts: string }): string {
  if (!row.reward) return `0 ${t.homeTaskPts}`;
  if (row.rewardKind === "pts") return `${row.reward} ${t.homeTaskPts}`;
  if (row.rewardKind === "credits") return `${row.reward} ${t.homeTaskCredits}`;
  return row.reward;
}

function regionToday(cn: boolean): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: cn ? "Asia/Shanghai" : "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return formatWholeCredits(n);
}

function taskPreview(row: Record<string, unknown>): Omit<HomeTask, "id" | "title" | "description" | "type" | "creator" | "createdAt"> & {
  rewardKind: HomeTask["rewardKind"];
} {
  const meta = row.metadata;
  const display =
    meta && typeof meta === "object" && typeof (meta as { reward_display?: unknown }).reward_display === "number"
      ? (meta as { reward_display: number }).reward_display
      : null;
  const currency = String(row.reward_currency || "").toLowerCase();
  const seats = row.max_participants;
  const unlimited = seats == null;
  const each = unlimited || Number(seats) > 1;
  let reward = "";
  let rewardKind: HomeTask["rewardKind"] = "other";
  if ((currency === "ap_points" || currency === "pts") && display != null) {
    reward = formatWholeCredits(display);
    rewardKind = "pts";
  } else {
    const amount = Number(row.reward);
    if (Number.isFinite(amount) && amount > 0) {
      reward = formatWholeCredits(amount);
      rewardKind = !currency || currency === "credits" ? "credits" : "other";
      if (rewardKind === "other") reward = `${reward} ${currency.toUpperCase()}`;
    }
  }
  return {
    forAgents: row.cultivator_work !== true,
    directJoin: row.require_join_approval !== true,
    unlimited,
    reward,
    rewardKind,
    each: each && !!reward,
    completed: Number(row.completed_count) || 0,
  };
}

function shortId(id: string): string {
  const bare = id.replace(/^acn:/i, "").trim();
  return bare.length > 12 ? `${bare.slice(0, 8)}…` : bare;
}

async function readJson(url: string, token?: string | null): Promise<unknown | null> {
  try {
    const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeJson(url: string, token: string, method: "POST" | "DELETE", body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function publicAgentProfile(api: string, id: string): Promise<{ name: string; note: string }> {
  const row = await readJson(`${api}/api/agents/${encodeURIComponent(id)}`);
  if (!row || typeof row !== "object") return { name: "", note: "" };
  const record = row as { display_name?: unknown; name?: unknown; description?: unknown };
  return {
    name: String(record.display_name || record.name || "").trim(),
    note: oneLine(record.description),
  };
}

function appHint(id: AppId, t: RanchMessages): string {
  switch (id) {
    case "world":
      return t.homeAppWorldHint;
    case "market":
      return t.homeAppMarketHint;
    case "cultivators":
      return t.homeAppCultivatorsHint;
    case "feed":
      return t.homeAppFeedHint;
    case "consensus":
      return t.homeAppConsensusHint;
    default:
      return "";
  }
}

function appLabel(id: AppId, t: RanchMessages): string {
  switch (id) {
    case "world":
      return t.homeAppWorld;
    case "market":
      return t.homeAppMarket;
    case "rankings":
      return t.homeAppRankings;
    case "tasks":
      return t.homeAppTasks;
    case "cultivators":
      return t.homeAppCultivators;
    case "feed":
      return t.homeAppFeed;
    case "consensus":
      return t.homeAppConsensus;
  }
}

function planetHref(base: string | undefined, path: string): string {
  const origin = (base || "https://agentplanet.org").replace(/\/+$/, "");
  return `${origin}${path}`;
}

function planName(plan: PlanUsage, locale: RanchLocale): string {
  if (locale === "zh" && plan.plan.label_zh) return plan.plan.label_zh;
  return plan.plan.label;
}

function usedPercent(plan: PlanUsage): number | null {
  const total = plan.allowance?.dialog_credits;
  const used = plan.allowance?.dialog_credits_used ?? 0;
  if (total == null || total <= 0) return null;
  return Math.min(100, Math.round((used / total) * 100));
}

function resetDate(plan: PlanUsage, locale: RanchLocale): string {
  const iso = plan.period?.end || plan.plan.paid_until || "";
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

const statCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
  padding: "12px 12px 10px",
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  background: colors.panel,
  color: colors.text,
  textAlign: "left",
  cursor: "pointer",
};

const cardTop: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const cardLabel: CSSProperties = {
  fontSize: 12,
  color: colors.muted,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const cardFigure: CSSProperties = {
  fontSize: 20,
  fontWeight: 650,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
};

const pill: CSSProperties = {
  flexShrink: 0,
  borderRadius: 999,
  background: colors.text,
  color: colors.bg,
  fontSize: 11,
  fontWeight: 650,
  padding: "4px 8px",
};

const barTrack: CSSProperties = {
  display: "block",
  height: 4,
  borderRadius: 999,
  background: "rgba(255,255,255,0.14)",
  overflow: "hidden",
};

const barFill: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: 999,
  background: colors.muted,
};

const cardFoot: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
  marginTop: "auto",
  fontSize: 11,
  color: colors.muted,
};

const boardColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
  color: colors.text,
  textDecoration: "none",
};

const boardTitle: CSSProperties = {
  color: colors.muted,
  fontSize: 12,
  fontWeight: 650,
};

const rankRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "16px 22px minmax(0, 1fr) auto",
  columnGap: 8,
  rowGap: 3,
  alignItems: "start",
  minWidth: 0,
  minHeight: 56,
  padding: "8px 0",
  color: colors.text,
  textDecoration: "none",
};

const rankNum: CSSProperties = {
  fontSize: 12,
  lineHeight: "22px",
  color: colors.muted,
};

const rankMark: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: colors.panel,
  color: colors.text,
  fontSize: 11,
  fontWeight: 700,
};

const rankName: CSSProperties = {
  gridColumn: 3,
  gridRow: 1,
  minWidth: 0,
  fontSize: 13,
  lineHeight: "22px",
  fontWeight: 650,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rankNote: CSSProperties = {
  gridColumn: 3,
  gridRow: 2,
  minWidth: 0,
  fontSize: 11,
  lineHeight: 1.35,
  color: colors.muted,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rankMetric: CSSProperties = {
  gridColumn: 4,
  gridRow: 1,
  textAlign: "right",
  fontSize: 13,
  lineHeight: "22px",
  fontWeight: 650,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const rankUnit: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 500,
  color: colors.muted,
  whiteSpace: "nowrap",
};

const rankActions: CSSProperties = {
  gridColumn: 4,
  gridRow: 2,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  whiteSpace: "nowrap",
};

const rankAction: CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 0,
  fontSize: 11,
  fontWeight: 650,
  color: "#3ddc97",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function taskSlot(index: number) {
  return (
    <div style={taskLink} aria-hidden>
      <span style={{ ...taskMark, background: "rgba(232,238,245,0.08)" }} />
      <span style={taskCopy}>
        <span style={taskNameLine}>
          <span style={slotBar(index === 1 ? 96 : 128, 10)} />
          <span style={{ flex: 1 }} />
          <span style={slotBar(44, 10)} />
        </span>
        <span style={taskDetail}>
          <span style={slotBar(index === 0 ? 176 : 148, 8)} />
        </span>
        <span style={taskMetaLine}>
          <span style={slotBar(72, 8)} />
        </span>
      </span>
    </div>
  );
}

function slotBar(width: number | string, height = 8): CSSProperties {
  return {
    display: "block",
    width,
    maxWidth: "100%",
    height,
    borderRadius: 999,
    background: "rgba(232,238,245,0.12)",
  };
}

const boardRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  color: colors.text,
  textDecoration: "none",
};

const boardRank: CSSProperties = {
  fontSize: 11,
  color: colors.muted,
};

const boardName: CSSProperties = {
  fontSize: 13,
  fontWeight: 650,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const boardDetail: CSSProperties = {
  fontSize: 11,
  color: colors.muted,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sectionLabel: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 14,
  fontWeight: 650,
};

const sectionBlock: CSSProperties = {
  marginTop: 24,
};

const appRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  padding: "8px 4px",
  borderRadius: 8,
  color: colors.text,
  textDecoration: "none",
};

const appMark: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  fontSize: 13,
  fontWeight: 700,
};

const appCopy: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const TASK_MARKS = ["#d6f25c", "#3ee0b0", "#c4b5fd"];

const taskStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const taskLink: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  minWidth: 0,
  height: 72,
  padding: "8px 4px",
  borderRadius: 8,
  color: colors.text,
  textDecoration: "none",
  boxSizing: "border-box",
};

const taskMark: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#111318",
  fontSize: 13,
  fontWeight: 700,
};

const taskCopy: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const taskType: CSSProperties = {
  flexShrink: 0,
  fontSize: 11,
  fontWeight: 650,
  color: "#d6f25c",
};

const taskDesc: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  fontSize: 11,
  lineHeight: 1.35,
  color: colors.muted,
  whiteSpace: "nowrap",
};

const taskNameLine: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  height: 20,
};

const taskDetail: CSSProperties = {
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  height: 16,
  overflow: "hidden",
  fontSize: 11,
  lineHeight: "16px",
  color: colors.muted,
  whiteSpace: "nowrap",
};

const taskDetailText: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const taskMetaLine: CSSProperties = {
  ...taskDesc,
  height: 16,
  overflow: "hidden",
};

const taskReward: CSSProperties = {
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 650,
  color: "#3ddc97",
  whiteSpace: "nowrap",
};

const columnTitle: CSSProperties = {
  ...boardTitle,
  display: "inline-block",
  marginBottom: 8,
  color: colors.muted,
  textDecoration: "none",
  cursor: "pointer",
};

function curvePoints(values: number[], width: number, height: number, flatY: number, peak = Math.max(...values, 0)) {
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = peak === 0 ? flatY : 4 + (1 - value / peak) * (height - 8);
    return { x, y };
  });
}

function linePath(points: { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

function cumulative(values: number[]): number[] {
  let total = 0;
  return values.map((value) => {
    total += value;
    return total;
  });
}

type ChartTip = { value: string; when: string };

function AreaChart({
  values,
  color,
  tip,
}: {
  values: number[];
  color: string;
  tip: (index: number, value: number) => ChartTip;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 120;
  const height = 64;
  const peak = Math.max(...values, 0);
  if (values.length < 2 || peak === 0) return null;
  const points = curvePoints(values, width, height, 36, peak);
  const path = linePath(points);
  const area = `${path} L${points[points.length - 1]?.x ?? width},${height} L${points[0]?.x ?? 0},${height} Z`;
  const point = hover == null ? null : points[hover];
  const shown = hover == null ? null : tip(hover, values[hover] ?? 0);
  const translateX = hover == null || hover === 0 ? "0" : hover === values.length - 1 ? "-100%" : "-50%";
  const placeAbove = point != null && point.y > 24;
  return (
    <div
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = (event.clientX - rect.left) / rect.width;
        const next = Math.round(ratio * (values.length - 1));
        setHover(Math.min(values.length - 1, Math.max(0, next)));
      }}
      onMouseLeave={() => setHover(null)}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <svg
        aria-hidden
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ display: "block", pointerEvents: "none" }}
      >
        <path d={area} fill={color} opacity={0.18} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {point && shown ? (
        <>
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: `${(point.x / width) * 100}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: color,
              opacity: 0.45,
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: `${(point.x / width) * 100}%`,
              top: `${(point.y / height) * 100}%`,
              width: 7,
              height: 7,
              borderRadius: 999,
              background: color,
              border: `1.5px solid ${colors.bg}`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: `${(point.x / width) * 100}%`,
              top: `${(point.y / height) * 100}%`,
              transform: placeAbove ? `translate(${translateX}, calc(-100% - 8px))` : `translate(${translateX}, 8px)`,
              zIndex: 2,
              padding: "4px 6px",
              borderRadius: 6,
              background: colors.panelAlt,
              border: "1px solid rgba(255,255,255,0.16)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ display: "block", fontSize: 12, fontWeight: 650, color, lineHeight: 1.2 }}>{shown.value}</span>
            <span style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.muted, lineHeight: 1.2 }}>
              {shown.when}
            </span>
          </span>
        </>
      ) : null}
    </div>
  );
}

function RateHint({ up, pct, label }: { up: boolean; pct: number; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: "relative",
        flexShrink: 0,
        fontWeight: 650,
        color: up ? "#3ddc97" : "#f87171",
      }}
    >
      {up ? "↑" : "↓"}
      {Math.abs(pct)}%
      {open ? (
        <span
          style={{
            position: "absolute",
            left: "calc(100% + 8px)",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 3,
            padding: "4px 6px",
            borderRadius: 6,
            background: colors.panelAlt,
            border: "1px solid rgba(255,255,255,0.16)",
            color: colors.text,
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

function TaskProgressCurve({
  finished,
  tip,
}: {
  finished: number[] | null;
  tip: (index: number, value: number) => ChartTip;
}) {
  const finishedLine = finished && finished.length > 1 ? finished : null;
  if (!finishedLine || Math.max(...finishedLine, 0) === 0) return null;
  return <AreaChart values={finishedLine} color="#3b82f6" tip={tip} />;
}

function EarningsCurve({
  earnings,
  up,
  tip,
}: {
  earnings: number[] | null;
  up: boolean;
  tip: (index: number, value: number) => ChartTip;
}) {
  const empty = [0, 0, 0, 0, 0, 0, 0];
  const earnedLine = cumulative(earnings && earnings.length > 1 ? earnings : empty);
  if (Math.max(...earnedLine, 0) === 0) return null;
  return <AreaChart values={earnedLine} color={up ? "#3ddc97" : "#f87171"} tip={tip} />;
}

const MICROS_PER_CREDIT = 1_000_000;

function earnedMicros(earnings: AgentEarnings | null): number | null {
  if (!earnings) return null;
  if (earnings.current_micros != null) return earnings.current_micros;
  if (earnings.current == null) return null;
  return Math.trunc(earnings.current) * MICROS_PER_CREDIT;
}

function earnedSeriesMicros(earnings: AgentEarnings | null): number[] | null {
  if (!earnings) return null;
  if (earnings.series_micros) return earnings.series_micros;
  if (!earnings.series) return null;
  return earnings.series.map((value) => Math.trunc(value) * MICROS_PER_CREDIT);
}

function windowMicros(micros: number | null | undefined, whole: number | null): number | null {
  if (micros != null) return micros;
  if (whole == null) return null;
  return Math.trunc(whole) * MICROS_PER_CREDIT;
}

/** Percent vs the previous 7 days. Both windows at 0 is a flat 0, not a hidden rate. */
function earnedDeltaPct(earnings: AgentEarnings | null): number | null {
  if (!earnings) return null;
  if (earnings.delta_pct != null) return earnings.delta_pct;
  const current = windowMicros(earnings.current_micros, earnings.current);
  const previous = windowMicros(earnings.previous_micros, earnings.previous);
  if (current == null || previous == null) return null;
  if (previous === 0 && current === 0) return 0;
  return null;
}

function ColumnTitle({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={columnTitle}>
      {children}
    </a>
  );
}

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...sectionLabel,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: colors.text,
        textDecoration: "none",
      }}
    >
      {children}
      <span aria-hidden style={{ color: colors.muted, fontWeight: 500 }}>
        &gt;
      </span>
    </a>
  );
}

function AppSlot({ index }: { index: number }) {
  return (
    <div style={appRow} aria-hidden>
      <span style={{ ...appMark, background: "rgba(232,238,245,0.08)", borderColor: "transparent" }} />
      <span style={appCopy}>
        <span style={slotBar(index === 1 ? 96 : 128, 10)} />
        <span style={slotBar(index === 0 ? 176 : 148)} />
      </span>
    </div>
  );
}

function AppRow({
  href,
  name,
  description,
}: {
  href: string;
  name: string;
  description: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={appRow}>
      <span style={appMark} aria-hidden>
        {(name.trim().slice(0, 1) || "?").toUpperCase()}
      </span>
      <span style={appCopy}>
        <span style={boardName}>{name}</span>
        {description ? <span style={boardDetail}>{description}</span> : null}
      </span>
    </a>
  );
}

export function HomeRightPane({
  account,
  client,
  locale,
  cn,
  agentPlanetBaseUrl,
  gatewayBaseUrl,
  messages: t,
  onOpenPlan,
  onOpenWallet,
  onStartChat,
  getAccessToken,
}: {
  account: RanchChatAccount | null;
  client: GatewayClient;
  locale: RanchLocale;
  cn: boolean;
  agentPlanetBaseUrl?: string;
  gatewayBaseUrl?: string;
  messages: RanchMessages;
  onOpenPlan: () => void;
  onOpenWallet: () => void;
  onStartChat: (agentId: string) => void;
  getAccessToken: () => Promise<string | null>;
}) {
  const [wallet, setWallet] = useState<HumanWallet | null>(null);
  const [plan, setPlan] = useState<PlanUsage | null>(null);
  const [agentEarnings, setAgentEarnings] = useState<AgentEarnings | null>(null);
  const [boards, setBoards] = useState<HomeBoards | null>(null);
  const [networkRows, setNetworkRows] = useState<BoardSeat[] | null>(null);
  const [market, setMarket] = useState<HomeMarket | null>(null);
  const [taskColumns, setTaskColumns] = useState<HomeTaskColumns | null>(null);
  const [community, setCommunity] = useState<HomeCommunityBoard[] | null>(null);
  const [rankBusy, setRankBusy] = useState<string | null>(null);
  const [joinPrompt, setJoinPrompt] = useState<{ name: string; text: string } | null>(null);
  const apps = HOME_APPS;
  const label = (account?.name || account?.email || t.account).trim();
  const pct = plan ? usedPercent(plan) : null;
  const resets = plan ? resetDate(plan, locale) : "";
  const demand = plan?.on_demand;
  const demandLine =
    !demand || demand.mode === "unlimited" || demand.limit_credits == null
      ? t.accountPlanLimitUnlimited
      : t.accountPlanUsedOfLimit
          .replace("{used}", formatWholeCredits(demand.spent_credits))
          .replace("{limit}", formatWholeCredits(demand.limit_credits));
  const earnedNow = earnedMicros(agentEarnings);
  const earnedLine = earnedSeriesMicros(agentEarnings);
  const earnedDelta = earnedDeltaPct(agentEarnings);
  const showEarnedChart = earnedLine?.some((value) => value > 0) ?? false;

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    void Promise.all([
      client.getHumanWallet().catch(() => null),
      client.getPlanUsage().catch(() => null),
      client.getAgentEarnings().catch(() => null),
    ]).then(([nextWallet, nextPlan, nextEarnings]) => {
      if (cancelled) return;
      setWallet(nextWallet);
      setPlan(nextPlan);
      setAgentEarnings(
        nextEarnings ?? {
            current: null,
            previous: null,
            delta_pct: null,
            agent_count: null,
            series: null,
            count_series: null,
            tasks_active: null,
            tasks_completed: null,
            tasks_active_series: null,
            tasks_completed_series: null,
          },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [account, client]);

  useEffect(() => {
    const api = (gatewayBaseUrl || "").replace(/\/+$/, "");
    if (!api) {
      setBoards({ campaign: [], launch: [], leaderboard: [], network: [] });
      return;
    }
    let cancelled = false;
    const day = regionToday(cn);
    void (async () => {
      const token = await getAccessToken().catch(() => null);
      if (cancelled) return;
      const [campaignBody, launchBody, rankBody] = await Promise.all([
        readJson(`${api}/api/rankings/campaigns`, token),
        readJson(`${api}/api/launches?date=${day}&until=${day}&board=human`, token),
        readJson(`${api}/api/rankings/agents?window=7d&limit=20`),
      ]);
      const campaignRows = Array.isArray((campaignBody as { agents?: unknown } | null)?.agents)
        ? (campaignBody as { agents: Array<Record<string, unknown>> }).agents
        : [];
      const launchRows = Array.isArray((launchBody as { launches?: unknown } | null)?.launches)
        ? (launchBody as { launches: Array<Record<string, unknown>> }).launches
        : [];
      const rankRows = Array.isArray((rankBody as { agents?: unknown } | null)?.agents)
        ? (rankBody as { agents: Array<Record<string, unknown>> }).agents
        : [];
      const launches = [...launchRows].sort((a, b) => {
        const votes = Number(b.human_vote_count || 0) - Number(a.human_vote_count || 0);
        if (votes) return votes;
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
      const idOf = (row: Record<string, unknown>) => String(row.agent_id || "");
      const head = (
        rows: Array<Record<string, unknown>>,
        fallback?: (row: Record<string, unknown>) => string,
      ) =>
        rows
          .filter((row) => isPublicAgent(idOf(row), fallback?.(row)))
          .slice(0, HOME_SLOTS);
      const campaignHead = head(campaignRows);
      const launchHead = head(launches, (row) => String(row.agent_name || ""));
      const rankHead = head(rankRows, (row) => String(row.name || ""));
      const picked = [...campaignHead, ...launchHead, ...rankHead]
        .map(idOf)
        .filter((id, index, all) => id && all.indexOf(id) === index);
      const profiles = new Map<string, { name: string; note: string }>();
      await Promise.all(
        picked.map(async (id) => {
          const profile = await publicAgentProfile(api, id);
          if (profile.name || profile.note) profiles.set(id, profile);
        }),
      );
      if (cancelled) return;
      const seat = (
        id: string,
        metric: string,
        delta: number | null,
        fallback?: string,
        extra?: Pick<BoardSeat, "launchId" | "voted" | "trial" | "tickets" | "owner">,
      ): BoardSeat | null => {
        const profile = profiles.get(id);
        const name = (profile?.name || fallback || "").trim();
        if (!id || !isPublicAgent(id, name)) return null;
        return { id, name: name || shortId(id), note: profile?.note || "", metric, delta, ...extra };
      };
      const take = (rows: Array<BoardSeat | null>) => rows.filter((row): row is BoardSeat => !!row).slice(0, HOME_SLOTS);
      setBoards({
        campaign: take(
          campaignHead.map((row) =>
            seat(String(row.agent_id || ""), formatWholeCredits(Number(row.vault_balance || 0)), null, undefined, {
              trial: String(row.trial_status || "none"),
              tickets: Number(row.tickets_remaining || 0),
              owner: row.is_owner === true,
            }),
          ),
        ),
        launch: take(
          launchHead.map((row) =>
            seat(
              String(row.agent_id || ""),
              formatWholeCredits(Number(row.human_vote_count || 0)),
              null,
              String(row.agent_name || ""),
              {
                launchId: String(row.launch_id || ""),
                voted: row.voted === true,
              },
            ),
          ),
        ),
        leaderboard: take(
          rankHead.map((row) => {
            const wow = row.wow_pct;
            return seat(
              String(row.agent_id || ""),
              compactCount(Number(row.public_tokens || 0)),
              typeof wow === "number" && Number.isFinite(wow) ? wow : null,
              String(row.name || ""),
            );
          }),
        ),
        network: [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cn, gatewayBaseUrl, getAccessToken]);

  useEffect(() => {
    let cancelled = false;
    setNetworkRows(null);
    void readJson(`/api/subnets?region=${cn ? "cn" : "global"}`).then((body) => {
      if (!cancelled) setNetworkRows(subnetSeats(body));
    });
    return () => {
      cancelled = true;
    };
  }, [cn]);

  useEffect(() => {
    const api = (gatewayBaseUrl || "").replace(/\/+$/, "");
    if (!api) {
      setMarket({ official: [], agents: [] });
      return;
    }
    let cancelled = false;
    void readJson(`${api}/api/market/products`).then((body) => {
      if (cancelled) return;
      const rows = Array.isArray((body as { products?: unknown } | null)?.products)
        ? (body as { products: Array<Record<string, unknown>> }).products
        : [];
      const listings = (seller: string) =>
        rows
          .filter((row) => String(row.seller_type || "") === seller)
          .filter((row) => row.is_active !== false)
          .filter((row) => !(cn && seller === "platform" && String(row.product_type || "") === "openrouter_key"))
          .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
          .map((row) => ({
            id: String(row.product_id || ""),
            name: String(row.name || "").trim(),
            description: collapse(row.description),
            catalog: isMachineListing(row) ? ("machine" as const) : null,
          }))
          .filter((row) => row.id && row.name)
          .slice(0, HOME_SLOTS);
      setMarket({ official: listings("platform"), agents: listings("agent") });
    });
    return () => {
      cancelled = true;
    };
  }, [cn, gatewayBaseUrl]);

  useEffect(() => {
    const api = (gatewayBaseUrl || "").replace(/\/+$/, "");
    if (!api) {
      setTaskColumns({ cultivator: [] });
      setCommunity([]);
      return;
    }
    let cancelled = false;
    const market = cn ? "cn" : "global";
    void (async () => {
      const [taskBody, boardBody, communityBody] = await Promise.all([
        readJson(`${api}/api/labs/tasks?status=open&limit=50`),
        readJson(
          `${api}/api/labs/boards?market=${market}&status=active&official=true&xp_eligible=true&limit=20`,
        ),
        readJson(`${api}/api/labs/boards?market=${market}&status=active&official=false&limit=20`),
      ]);
      if (cancelled) return;
      const listed = (body: unknown) =>
        Array.isArray((body as { tasks?: unknown } | null)?.tasks)
          ? (body as { tasks: Array<Record<string, unknown>> }).tasks
          : [];
      const boards = Array.isArray(boardBody) ? (boardBody as Array<Record<string, unknown>>) : [];
      const boardPages = await Promise.all(
        boards.map((board) =>
          readJson(
            `${api}/api/labs/tasks?status=open&board_id=${encodeURIComponent(String(board.board_id || ""))}&limit=20`,
          ),
        ),
      );
      if (cancelled) return;
      const seen = new Set<string>();
      const rows: Array<Record<string, unknown>> = [];
      for (const row of [...boardPages.flatMap(listed), ...listed(taskBody)]) {
        const id = String(row.task_id || "");
        if (!id || seen.has(id) || row.is_expired === true || isNoisyTask(row)) continue;
        seen.add(id);
        rows.push(row);
      }
      const seats = (list: Array<Record<string, unknown>>): HomeTask[] =>
        list
          .slice(0, HOME_SLOTS)
          .map((row) => ({
            id: String(row.task_id || ""),
            title: String(row.title || "").trim(),
            description: String(row.description || "").replace(/\s+/g, " ").trim(),
            type: String(row.task_type || "").trim(),
            creator: String(row.creator_display_name || row.creator_name || "").trim(),
            createdAt: String(row.created_at || ""),
            ...taskPreview(row),
          }))
          .filter((row) => row.id && row.title);
      setTaskColumns({
        cultivator: seats(rows.filter((row) => row.cultivator_work === true)),
      });
      const picked = communityBoards(
        Array.isArray(communityBody) ? (communityBody as Array<Record<string, unknown>>) : [],
      );
      const withStats = (
        await Promise.all(
          picked.map(async (board) => ({ ...board, ...boardTaskStats(await listBoardTasks(api, board.id)) })),
        )
      ).filter((board) => board.description || board.active > 0 || board.credits > 0 || board.pts > 0);
      if (cancelled) return;
      setCommunity(withStats);
    })();
    return () => {
      cancelled = true;
    };
  }, [cn, gatewayBaseUrl]);

  const apiBase = (gatewayBaseUrl || "").replace(/\/+$/, "");

  async function claimTicket(id: string) {
    const token = await getAccessToken().catch(() => null);
    if (!token || !apiBase) return;
    setRankBusy(`claim:${id}`);
    const ok = await writeJson(`${apiBase}/api/campaigns/tickets/claim`, token, "POST", { agent_id: id });
    setRankBusy(null);
    if (!ok) return;
    setBoards((prev) =>
      prev && {
        ...prev,
        campaign: prev.campaign.map((row) => (row.id === id ? { ...row, trial: "issued" } : row)),
      },
    );
  }

  async function toggleVote(row: BoardSeat) {
    if (!row.launchId) return;
    const token = await getAccessToken().catch(() => null);
    if (!token || !apiBase) return;
    setRankBusy(`vote:${row.id}`);
    const ok = await writeJson(
      `${apiBase}/api/launches/${encodeURIComponent(row.launchId)}/vote`,
      token,
      row.voted ? "DELETE" : "POST",
    );
    setRankBusy(null);
    if (!ok) return;
    const next = !row.voted;
    const count = Math.max(0, Number(String(row.metric).replace(/,/g, "")) + (next ? 1 : -1));
    setBoards((prev) =>
      prev && {
        ...prev,
        launch: prev.launch.map((item) =>
          item.id === row.id ? { ...item, voted: next, metric: formatWholeCredits(count) } : item,
        ),
      },
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="ranch-thin-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "18px 16px 120px" }}>
        {account ? (
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 22,
              fontWeight: 650,
              letterSpacing: "-0.02em",
            }}
          >
            {t.homeWelcome(label)}
          </h2>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <button type="button" onClick={onOpenPlan} style={statCard}>
            <span style={cardTop}>
              <span style={cardLabel}>{plan ? planName(plan, locale) : t.accountPlanUsage}</span>
              <span style={pill}>{plan?.plan.renewable ? t.accountPlanRenew : t.accountPlanUpgrade}</span>
            </span>
            <span style={cardFigure}>
              {pct == null
                ? t.accountPlanLimitUnlimited
                : pct < 1 && (plan?.allowance.dialog_credits_used ?? 0) > 0
                  ? t.accountPlanUsedUnderOne
                  : t.accountPlanUsedPct.replace("{n}", String(pct))}
            </span>
            <span style={barTrack} aria-hidden>
              <span style={{ ...barFill, width: `${pct ?? 0}%` }} />
            </span>
            <span style={cardFoot}>
              <span style={{ minWidth: 0 }}>{t.accountPlanIncludedUsage}</span>
              <span style={{ flexShrink: 0 }}>{resets ? t.homePlanResets.replace("{date}", resets) : ""}</span>
            </span>
          </button>
          <button type="button" onClick={onOpenWallet} style={statCard}>
            <span style={cardTop}>
              <span style={cardLabel}>{t.accountWallet}</span>
              <span style={pill}>{t.walletTopup}</span>
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={cardFigure}>
                {wallet ? formatCreditBalance(wallet.balance, wallet.balance_micros) : "—"}
              </span>
              {wallet ? (
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 500, color: colors.muted }}>
                  {t.homeRankCredits}
                </span>
              ) : null}
            </span>
            <span style={cardFoot}>
              <span style={{ minWidth: 0 }}>{t.accountPlanOnDemand}</span>
              <span style={{ flexShrink: 0 }}>{demandLine}</span>
            </span>
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <a
            href={planetHref(agentPlanetBaseUrl, "/agents?tab=my")}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...statCard, position: "relative", minHeight: 108, overflow: "hidden", textDecoration: "none" }}
          >
            <span style={{ ...cardLabel, position: "relative", zIndex: 1 }}>
              {t.homeEarned(agentEarnings?.agent_count ?? null)}
            </span>
            <span
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                paddingRight: showEarnedChart ? "44%" : 0,
              }}
            >
              <span style={cardFigure}>
                {earnedNow == null ? "—" : formatLedgerAmount(earnedNow, "micros")}
              </span>
              {earnedNow == null ? null : (
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 500, color: colors.muted }}>
                  {t.homeRankCredits}
                </span>
              )}
            </span>
            {earnedDelta == null ? null : (
              <span
                style={{
                  position: "relative",
                  zIndex: 3,
                  display: "flex",
                  alignItems: "baseline",
                  paddingRight: showEarnedChart ? "44%" : 0,
                  fontSize: 11,
                }}
              >
                <RateHint up={earnedDelta >= 0} pct={earnedDelta} label={t.homeEarnedVersus} />
              </span>
            )}
            {showEarnedChart && earnedLine ? (
              <span style={{ position: "absolute", right: 10, top: 28, bottom: 14, width: "40%", zIndex: 2 }}>
                <EarningsCurve
                  earnings={earnedLine}
                  up={(agentEarnings?.delta_pct ?? 0) >= 0}
                  tip={(index, value) => ({
                    value: `${formatLedgerAmount(value, "micros")} ${t.homeRankCredits}`,
                    when: t.homeChartWhen(earnedLine.length - 1 - index),
                  })}
                />
              </span>
            ) : null}
          </a>
          <a
            href={planetHref(agentPlanetBaseUrl, "/tasks?view=mine")}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...statCard, position: "relative", minHeight: 108, overflow: "hidden", textDecoration: "none" }}
          >
            <span style={{ ...cardLabel, position: "relative", zIndex: 1 }}>{t.homeTaskProgress}</span>
            <span
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                paddingRight: agentEarnings?.tasks_completed_series?.some((value) => value > 0) ? "44%" : 0,
              }}
            >
              <span style={cardFigure}>
                {agentEarnings?.tasks_active == null ? "—" : String(agentEarnings.tasks_active)}
              </span>
              {agentEarnings?.tasks_active == null ? null : (
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 500, color: colors.muted }}>
                  {t.homeTasksActive}
                </span>
              )}
            </span>
            {agentEarnings?.tasks_active == null ? null : (
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  paddingRight: agentEarnings?.tasks_completed_series?.some((value) => value > 0) ? "44%" : 0,
                  fontSize: 11,
                }}
              >
                <span style={{ flexShrink: 0, fontWeight: 650, color: "#3b82f6" }}>0</span>
                <span style={{ color: colors.muted }}>{t.homeTaskNotice}</span>
              </span>
            )}
            {agentEarnings?.tasks_completed_series?.some((value) => value > 0) ? (
              <span style={{ position: "absolute", right: 10, top: 28, bottom: 14, width: "40%", zIndex: 2 }}>
                <TaskProgressCurve
                  finished={agentEarnings.tasks_completed_series}
                  tip={(index, value) => ({
                    value: t.homeChartFinishedPoint(String(value)),
                    when: t.homeChartWhen((agentEarnings.tasks_completed_series?.length ?? 1) - 1 - index),
                  })}
                />
              </span>
            ) : null}
          </a>
        </div>
        <h3
          style={{
            margin: "40px 0 18px",
            fontSize: 22,
            fontWeight: 650,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          {t.homeExploreTitle}
        </h3>
        <div>
          <SectionLink href={planetHref(agentPlanetBaseUrl, "/tasks")}>{t.homeAppTasks}</SectionLink>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            {(
              [
                [
                  "cultivator",
                  t.homeTaskCultivators,
                  taskColumns?.cultivator ?? [],
                  `/tasks?board=${cn ? "tb_official_cultivator_cn" : "tb_official_cultivator_global"}`,
                ],
              ] as const
            ).map(([key, title, rows, path]) => (
              <div key={key} style={{ minWidth: 0 }}>
                <ColumnTitle href={planetHref(agentPlanetBaseUrl, path)}>{title}</ColumnTitle>
                <div style={taskStack}>
                  {padSlots(rows).map((row, index) =>
                    row ? (
                      <a
                        key={row.id}
                        href={planetHref(agentPlanetBaseUrl, `/tasks/${encodeURIComponent(row.id)}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={taskLink}
                      >
                        <span style={{ ...taskMark, background: TASK_MARKS[index % TASK_MARKS.length] }} aria-hidden>
                          {(row.title.trim().slice(0, 1) || "?").toUpperCase()}
                        </span>
                        <span style={taskCopy}>
                          <span style={taskNameLine}>
                            <span style={{ ...boardName, flex: 1, minWidth: 0 }}>{row.title}</span>
                            <span style={taskReward}>{taskMainReward(row, t)}</span>
                          </span>
                          <span style={taskDetail}>
                            <span style={taskDetailText}>{row.description || "\u00a0"}</span>
                          </span>
                          <span style={taskMetaLine}>
                            {row.type ? <span style={taskType}>{row.type}</span> : "\u00a0"}
                          </span>
                        </span>
                      </a>
                    ) : (
                      <div key={`${key}-slot-${index}`}>{taskSlot(index)}</div>
                    ),
                  )}
                </div>
              </div>
            ))}
            <div style={{ minWidth: 0 }}>
              <ColumnTitle href={planetHref(agentPlanetBaseUrl, "/tasks")}>{t.homeTaskCommunityPicks}</ColumnTitle>
              <div style={taskStack}>
                {padSlots(community ?? []).map((row, index) =>
                  row ? (
                    <a
                      key={row.id}
                      href={planetHref(agentPlanetBaseUrl, `/tasks?board=${encodeURIComponent(row.id)}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={taskLink}
                    >
                      <span style={{ ...taskMark, background: TASK_MARKS[index % TASK_MARKS.length] }} aria-hidden>
                        {(row.name.trim().slice(0, 1) || "?").toUpperCase()}
                      </span>
                      <span style={taskCopy}>
                        <span style={taskNameLine}>
                          <span style={{ ...boardName, flex: 1, minWidth: 0 }}>{row.name}</span>
                          <span style={taskReward}>{boardMainReward(row, t)}</span>
                        </span>
                        <span style={taskDetail}>
                          <span style={taskDetailText}>{row.description || "\u00a0"}</span>
                        </span>
                        <span style={taskMetaLine}>
                          <span style={taskType}>{row.categories.length ? row.categories.join(", ") : t.homeBoardAny}</span>
                          <span aria-hidden style={{ flexShrink: 0 }}>
                            ·
                          </span>
                          <span style={{ flexShrink: 0 }}>{t.homeBoardActive(row.active)}</span>
                          {boardExtraReward(row, t) ? (
                            <>
                              <span aria-hidden style={{ flexShrink: 0 }}>
                                ·
                              </span>
                              <span style={{ flexShrink: 0 }}>{boardExtraReward(row, t)}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </a>
                  ) : (
                    <div key={`community-slot-${index}`}>{taskSlot(index)}</div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={sectionBlock}>
        <SectionLink href={planetHref(agentPlanetBaseUrl, "/rankings?view=campaign")}>
          {t.homeAppRankings}
        </SectionLink>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          {(
            [
              ["campaign", t.homeBoardCampaign, "/rankings?view=campaign", t.homeRankCredits],
              ["launch", t.homeBoardLaunch, "/rankings?view=launch", t.homeRankVotes],
              ["leaderboard", t.homeBoardLeaderboard, "/rankings?view=leaderboard", t.homeRankTokens],
              ["network", t.homeBoardNetwork, "/world", t.homeRankAgents],
            ] as const
          ).map(([key, title, path, unit]) => {
            const rows = key === "network" ? networkRows : boards ? boards[key] : null;
            const href = planetHref(agentPlanetBaseUrl, path);
            return (
              <div key={key} style={{ minWidth: 0 }}>
                <ColumnTitle href={href}>{title}</ColumnTitle>
                {padSlots(rows ?? []).map((row, index) =>
                  row ? (
                    <div key={row.id} style={rankRow}>
                      <span style={rankNum}>{index + 1}</span>
                      <span style={rankMark} aria-hidden>
                        {(row.name.trim().slice(0, 1) || "?").toUpperCase()}
                      </span>
                      {row.subnetId ? (
                        <span style={rankName}>{row.name}</span>
                      ) : (
                        <a
                          href={planetHref(agentPlanetBaseUrl, `/agents/${encodeURIComponent(row.id)}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...rankName, color: "inherit", textDecoration: "none" }}
                        >
                          {row.name}
                        </a>
                      )}
                      <span style={rankMetric}>
                        {row.metric}
                        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: colors.muted }}>
                          {row.subnetId ? t.homeRankAgents : unit}
                        </span>
                      </span>
                      {row.subnetId ? (
                        <span style={rankNote}>{row.note || "\u00a0"}</span>
                      ) : (
                        <a
                          href={planetHref(agentPlanetBaseUrl, `/agents/${encodeURIComponent(row.id)}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...rankNote, color: colors.muted, textDecoration: "none" }}
                        >
                          {row.note || "\u00a0"}
                        </a>
                      )}
                      <span style={rankActions}>
                        {row.delta != null ? (
                          <span style={{ ...rankUnit, fontWeight: 650, color: row.delta >= 0 ? "#3ddc97" : "#f87171" }}>
                            {row.delta >= 0 ? "↑" : "↓"}
                            {Math.abs(Math.round(row.delta))}%
                          </span>
                        ) : null}
                        {row.subnetId ? (
                          <button
                            type="button"
                            style={rankAction}
                            onClick={() =>
                              setJoinPrompt({
                                name: row.name,
                                text: subnetJoinPrompt(locale, row.name, row.subnetId || ""),
                              })
                            }
                          >
                            {t.homeRankJoin}
                          </button>
                        ) : (
                          <button type="button" style={rankAction} onClick={() => onStartChat(row.id)}>
                            {t.homeRankChat}
                          </button>
                        )}
                        {key === "campaign" && !row.owner ? (
                          <button
                            type="button"
                            style={{
                              ...rankAction,
                              color: row.trial === "none" && row.tickets ? "#3ddc97" : colors.muted,
                            }}
                            disabled={row.trial !== "none" || !row.tickets || rankBusy === `claim:${row.id}`}
                            onClick={() => void claimTicket(row.id)}
                          >
                            {row.trial === "redeemed"
                              ? t.homeRankClaimUsed
                              : row.trial === "issued"
                                ? t.homeRankClaimed
                                : t.homeRankClaim}
                          </button>
                        ) : null}
                        {key === "launch" && row.launchId ? (
                          <button
                            type="button"
                            style={rankAction}
                            disabled={rankBusy === `vote:${row.id}`}
                            onClick={() => void toggleVote(row)}
                          >
                            {row.voted ? t.homeRankVoted : t.homeRankVote}
                          </button>
                        ) : null}
                      </span>
                    </div>
                  ) : (
                    <div key={`${key}-slot-${index}`} style={rankRow} aria-hidden>
                      <span style={rankNum}>{index + 1}</span>
                      <span style={{ ...rankMark, background: "rgba(232,238,245,0.08)" }} />
                      <span style={{ ...slotBar(index === 1 ? 96 : 128, 10), gridColumn: 3, gridRow: 1, alignSelf: "center" }} />
                      <span style={{ ...slotBar(72, 10), gridColumn: 4, gridRow: 1, justifySelf: "end", alignSelf: "center" }} />
                      <span style={{ ...slotBar(index === 0 ? 176 : 148), gridColumn: 3, gridRow: 2, alignSelf: "center" }} />
                    </div>
                  ),
                )}
              </div>
            );
          })}
        </div>
        </div>
        <div style={sectionBlock}>
          <div style={sectionLabel}>{t.homeSectionApps}</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ ...boardTitle, marginBottom: 8 }}>{t.homeAppsOfficial}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {apps.map((app) => (
                  <AppRow
                    key={app.id}
                    href={planetHref(agentPlanetBaseUrl, app.href)}
                    name={appLabel(app.id, t)}
                    description={appHint(app.id, t)}
                  />
                ))}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...boardTitle, marginBottom: 8 }}>{t.homeAppsSkills}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {Array.from({ length: HOME_SLOTS }, (_, index) => (
                  <AppSlot key={`skills-slot-${index}`} index={index} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={sectionBlock}>
          <SectionLink href={planetHref(agentPlanetBaseUrl, "/market")}>{t.homeAppMarket}</SectionLink>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            {(
              [
                ["official", t.homeMarketOfficial, market ? market.official : null],
                ["agents", t.homeMarketAgents, market ? market.agents : null],
              ] as const
            ).map(([key, title, rows]) => (
              <div key={key} style={{ minWidth: 0 }}>
                <div style={{ ...boardTitle, marginBottom: 8 }}>{title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {padSlots(rows ?? []).map((row, index) =>
                    row ? (
                      <AppRow
                        key={row.id}
                        href={planetHref(
                          agentPlanetBaseUrl,
                          `/market/listings/${encodeURIComponent(row.id)}`,
                        )}
                        name={row.catalog === "machine" ? t.homeMarketMachineName : row.name}
                        description={row.catalog === "machine" ? t.homeMarketMachineBlurb : row.description}
                      />
                    ) : (
                      <AppSlot key={`${key}-slot-${index}`} index={index} />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {joinPrompt ? (
        <SubnetJoinDialog
          name={joinPrompt.name}
          prompt={joinPrompt.text}
          t={t}
          onClose={() => setJoinPrompt(null)}
        />
      ) : null}
    </div>
  );
}

function SubnetJoinDialog({
  name,
  prompt,
  t,
  onClose,
}: {
  name: string;
  prompt: string;
  t: RanchMessages;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useModalA11y({ open: true, onClose, containerRef: cardRef });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      style={joinOverlay}
      onClick={onClose}
    >
      <div ref={cardRef} tabIndex={-1} style={joinCard} onClick={(event) => event.stopPropagation()}>
        <div style={joinHeader}>
          <strong style={{ fontSize: 16 }}>{name}</strong>
          <button type="button" onClick={onClose} style={btnGhost} aria-label={t.close}>
            ✕
          </button>
        </div>
        <div style={joinBody}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: colors.muted }}>{t.homeSubnetJoinHint}</p>
          <textarea readOnly value={prompt} style={joinPromptBox} />
          <button
            type="button"
            style={{ ...btnPrimary, width: "100%" }}
            onClick={() => {
              void copyText(prompt).then((ok) => {
                if (!ok) return;
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            {copied ? t.promptCopied : t.copyPromptForAgent}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const joinOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10050,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const joinCard: CSSProperties = {
  width: "min(440px, 100%)",
  maxHeight: "85%",
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 25px 50px rgba(0,0,0,0.45)",
};

const joinHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: `1px solid ${colors.border}`,
  flexShrink: 0,
};

const joinBody: CSSProperties = {
  overflow: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const joinPromptBox: CSSProperties = {
  ...inputStyle,
  minHeight: 160,
  resize: "vertical",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12,
  lineHeight: 1.45,
  color: colors.text,
};
