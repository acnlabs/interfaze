"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { formatCreditBalance, formatLedgerAmount, formatWholeCredits } from "../creditDisplay";
import type { AgentEarnings, GatewayClient, HumanWallet, PlanUsage } from "../gateway";
import type { RanchChatAccount } from "../types";
import type { RanchLocale, RanchMessages } from "./i18n";
import { colors } from "./styles";

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

const HOME_APPS: { id: AppId; href: string; cn: boolean }[] = [
  { id: "world", href: "/world", cn: false },
  { id: "cultivators", href: "/cultivators", cn: false },
  { id: "feed", href: "/feed", cn: false },
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

type BoardSeat = { id: string; name: string; note: string; metric: string; delta: number | null };

function withSlots<T>(rows: T[]): Array<T | null> {
  const next: Array<T | null> = rows.slice(0, HOME_SLOTS);
  while (next.length < HOME_SLOTS) next.push(null);
  return next;
}

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
  community: HomeTask[];
};

function oneLine(value: unknown): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > 72 ? `${text.slice(0, 71)}…` : text;
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

async function readJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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
  gridColumn: 4,
  gridRow: 2,
  textAlign: "right",
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 500,
  color: colors.muted,
  whiteSpace: "nowrap",
};

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
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  padding: "8px 4px",
  borderRadius: 8,
  color: colors.text,
  textDecoration: "none",
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
}) {
  const [wallet, setWallet] = useState<HumanWallet | null>(null);
  const [plan, setPlan] = useState<PlanUsage | null>(null);
  const [agentEarnings, setAgentEarnings] = useState<AgentEarnings | null>(null);
  const [boards, setBoards] = useState<HomeBoards | null>(null);
  const [market, setMarket] = useState<HomeMarket | null>(null);
  const [taskColumns, setTaskColumns] = useState<HomeTaskColumns | null>(null);
  const apps = withSlots(HOME_APPS.filter((app) => (cn ? app.cn : true)));
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
      const [campaignBody, launchBody, rankBody, networkBody] = await Promise.all([
        readJson(`${api}/api/rankings/campaigns`),
        readJson(`${api}/api/launches?date=${day}&until=${day}&board=human`),
        readJson(`${api}/api/rankings/agents?window=7d&limit=20`),
        readJson(`${api}/api/rankings/agents?window=7d&limit=20&sort=unique_callers`),
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
      const networkRows =
        (networkBody as { sort?: unknown } | null)?.sort === "unique_callers" &&
        Array.isArray((networkBody as { agents?: unknown } | null)?.agents)
          ? (networkBody as { agents: Array<Record<string, unknown>> }).agents
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
      const networkHead = head(networkRows, (row) => String(row.name || ""));
      const picked = [...campaignHead, ...launchHead, ...rankHead, ...networkHead]
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
      ): BoardSeat | null => {
        const profile = profiles.get(id);
        const name = (profile?.name || fallback || "").trim();
        if (!id || !isPublicAgent(id, name)) return null;
        return { id, name: name || shortId(id), note: profile?.note || "", metric, delta };
      };
      const take = (rows: Array<BoardSeat | null>) => rows.filter((row): row is BoardSeat => !!row).slice(0, HOME_SLOTS);
      setBoards({
        campaign: take(
          campaignHead.map((row) =>
            seat(String(row.agent_id || ""), formatWholeCredits(Number(row.vault_balance || 0)), null),
          ),
        ),
        launch: take(
          launchHead.map((row) =>
            seat(
              String(row.agent_id || ""),
              formatWholeCredits(Number(row.human_vote_count || 0)),
              null,
              String(row.agent_name || ""),
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
        network: take(
          networkHead.map((row) => {
            const wow = row.wow_pct;
            return seat(
              String(row.agent_id || ""),
              compactCount(Number(row.unique_callers || 0)),
              typeof wow === "number" && Number.isFinite(wow) ? wow : null,
              String(row.name || ""),
            );
          }),
        ),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cn, gatewayBaseUrl]);

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
            description: oneLine(row.description),
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
      setTaskColumns({ cultivator: [], community: [] });
      return;
    }
    let cancelled = false;
    const market = cn ? "cn" : "global";
    void (async () => {
      const [taskBody, boardBody] = await Promise.all([
        readJson(`${api}/api/labs/tasks?status=open&limit=50`),
        readJson(
          `${api}/api/labs/boards?market=${market}&status=active&official=true&xp_eligible=true&limit=20`,
        ),
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
        community: seats(rows.filter((row) => row.cultivator_work !== true)),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cn, gatewayBaseUrl]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="ranch-thin-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "18px 16px 56px" }}>
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
            {agentEarnings?.delta_pct == null ? null : (
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
                <RateHint up={agentEarnings.delta_pct >= 0} pct={agentEarnings.delta_pct} label={t.homeEarnedVersus} />
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
            {process.env.NODE_ENV === "development" ? (
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
                <span style={{ flexShrink: 0, fontWeight: 650, color: "#3b82f6" }}>{t.homeTaskNoticeCount}</span>
                <span style={{ color: colors.muted }}>{t.homeTaskNotice}</span>
              </span>
            ) : null}
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
            margin: "28px 0 18px",
            fontSize: 15,
            fontWeight: 650,
            letterSpacing: "-0.01em",
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
                ["community", t.homeTaskCommunityPicks, taskColumns?.community ?? [], "/tasks"],
              ] as const
            ).map(([key, title, rows, path]) => (
              <div key={key} style={{ minWidth: 0 }}>
                <ColumnTitle href={planetHref(agentPlanetBaseUrl, path)}>{title}</ColumnTitle>
                <div style={taskStack}>
                  {withSlots(rows).map((row, index) =>
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
                          <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                            <span style={{ ...boardName, flex: 1, minWidth: 0 }}>{row.title}</span>
                            {row.reward ? (
                              <span style={taskReward}>
                                {row.reward}{" "}
                                {row.rewardKind === "pts" ? t.homeTaskPts : row.rewardKind === "credits" ? t.homeTaskCredits : ""}
                              </span>
                            ) : null}
                          </span>
                          {row.type || row.description ? (
                            <span style={taskDesc}>
                              {row.type ? <span style={taskType}>{row.type}</span> : null}
                              {row.type && row.description ? (
                                <span aria-hidden style={{ flexShrink: 0 }}>
                                  ·
                                </span>
                              ) : null}
                              {row.description ? (
                                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {row.description}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                      </a>
                    ) : (
                      <div key={`${key}-slot-${index}`} style={taskLink} aria-hidden>
                        <span style={{ ...taskMark, background: "rgba(232,238,245,0.08)" }} />
                        <span style={taskCopy}>
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span style={slotBar(index === 1 ? 96 : 128, 10)} />
                            <span style={slotBar(44, 10)} />
                          </span>
                          <span style={slotBar(index === 0 ? 176 : 148)} />
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
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
              ["network", t.homeBoardNetwork, "/rankings?view=network", t.homeRankCallers],
            ] as const
          ).map(([key, title, path, unit]) => {
            const rows = withSlots(boards?.[key] ?? []);
            const href = planetHref(agentPlanetBaseUrl, path);
            return (
              <div key={key} style={{ minWidth: 0 }}>
                <ColumnTitle href={href}>{title}</ColumnTitle>
                {rows.map((row, index) =>
                  row ? (
                    <a
                      key={row.id}
                      href={planetHref(agentPlanetBaseUrl, `/agents/${encodeURIComponent(row.id)}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={rankRow}
                    >
                      <span style={rankNum}>{index + 1}</span>
                      <span style={rankMark} aria-hidden>
                        {(row.name.trim().slice(0, 1) || "?").toUpperCase()}
                      </span>
                      <span style={rankName}>{row.name}</span>
                      <span style={rankMetric}>{row.metric}</span>
                      <span style={rankNote}>{row.note}</span>
                      {row.delta != null ? (
                        <span style={{ ...rankUnit, fontWeight: 650, color: row.delta >= 0 ? "#3ddc97" : "#f87171" }}>
                          {row.delta >= 0 ? "↑" : "↓"}
                          {Math.abs(Math.round(row.delta))}%
                        </span>
                      ) : (
                        <span style={rankUnit}>{unit}</span>
                      )}
                    </a>
                  ) : (
                    <div key={`${key}-slot-${index}`} style={rankRow} aria-hidden>
                      <span style={rankNum}>{index + 1}</span>
                      <span style={{ ...rankMark, background: "rgba(232,238,245,0.08)" }} />
                      <span style={{ ...slotBar(index === 1 ? 96 : 128, 10), gridColumn: 3, gridRow: 1, alignSelf: "center" }} />
                      <span style={{ ...slotBar(36, 10), gridColumn: 4, gridRow: 1, justifySelf: "end", alignSelf: "center" }} />
                      <span style={{ ...slotBar(index === 0 ? 176 : 148), gridColumn: 3, gridRow: 2, alignSelf: "center" }} />
                      <span style={{ ...slotBar(44), gridColumn: 4, gridRow: 2, justifySelf: "end", alignSelf: "center" }} />
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
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ ...boardTitle, marginBottom: 8 }}>{t.homeAppsOfficial}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {apps.map((app, index) =>
                  app ? (
                    <AppRow
                      key={app.id}
                      href={planetHref(agentPlanetBaseUrl, app.href)}
                      name={appLabel(app.id, t)}
                      description={appHint(app.id, t)}
                    />
                  ) : (
                    <AppSlot key={`official-slot-${index}`} index={index} />
                  ),
                )}
              </div>
            </div>
            {(
              [
                ["plugins", t.homeAppsPlugins],
                ["skills", t.homeAppsSkills],
              ] as const
            ).map(([key, title]) => (
              <div key={key} style={{ minWidth: 0 }}>
                <div style={{ ...boardTitle, marginBottom: 8 }}>{title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {Array.from({ length: HOME_SLOTS }, (_, index) => (
                    <AppSlot key={`${key}-slot-${index}`} index={index} />
                  ))}
                </div>
              </div>
            ))}
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
                ["official", t.homeMarketOfficial, market?.official ?? []],
                ["agents", t.homeMarketAgents, market?.agents ?? []],
              ] as const
            ).map(([key, title, rows]) => (
              <div key={key} style={{ minWidth: 0 }}>
                <div style={{ ...boardTitle, marginBottom: 8 }}>{title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {withSlots(rows).map((row, index) =>
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
    </div>
  );
}
