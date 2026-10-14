"use client";

import { useState } from "react";
import type { HopPhase, LiveHop } from "../liveHops";
import { colors } from "./styles";

export type InteractionCopy = {
  empty: string;
  waiting: string;
  returned: string;
  failed: string;
  outside: string;
};

function phaseColor(phase: HopPhase): string {
  if (phase === "failed") return colors.danger;
  if (phase === "in_flight") return colors.warn;
  return colors.success;
}

function phaseLabel(phase: HopPhase, copy: InteractionCopy): string {
  if (phase === "failed") return copy.failed;
  if (phase === "in_flight") return copy.waiting;
  return copy.returned;
}

function bare(id: string): string {
  const trimmed = id.trim();
  return trimmed.toLowerCase().startsWith("acn:") ? trimmed.slice(4).trim() : trimmed;
}

function displayName(id: string, names: Record<string, string>, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim();
  const wanted = bare(id).toLowerCase();
  for (const [key, value] of Object.entries(names)) {
    if (bare(key).toLowerCase() === wanted && value.trim()) return value.trim();
  }
  return wanted.length > 8 ? wanted.slice(0, 8) : wanted;
}

function layout(ids: string[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const count = ids.length;
  ids.forEach((id, index) => {
    if (count === 1) {
      out[id] = { x: 320, y: 150 };
      return;
    }
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    out[id] = { x: 320 + Math.cos(angle) * 190, y: 150 + Math.sin(angle) * 100 };
  });
  return out;
}

function curve(from: { x: number; y: number }, to: { x: number; y: number }, bend: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const pad = 28;
  const sx = from.x + (dx / len) * pad;
  const sy = from.y + (dy / len) * pad;
  const ex = to.x - (dx / len) * pad;
  const ey = to.y - (dy / len) * pad;
  const mx = (sx + ex) / 2 + (-dy / len) * bend;
  const my = (sy + ey) / 2 + (dx / len) * bend;
  return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
}

export function InteractionPanel({
  hops,
  names,
  memberIds,
  copy,
}: {
  hops: LiveHop[];
  names: Record<string, string>;
  memberIds: string[];
  copy: InteractionCopy;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const members = new Set(memberIds.map((id) => bare(id).toLowerCase()));
  const ids: string[] = [];
  for (const hop of hops) {
    if (!ids.includes(hop.fromId)) ids.push(hop.fromId);
    if (!ids.includes(hop.toId)) ids.push(hop.toId);
  }
  const pos = layout(ids);
  const selected = hops.find((hop) => hop.key === selectedKey) ?? null;

  if (!hops.length) {
    return (
      <p data-interaction-empty="" style={{ margin: 16, color: colors.muted, fontSize: 13 }}>
        {copy.empty}
      </p>
    );
  }

  return (
    <div data-interaction-panel="" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <svg viewBox="0 0 640 300" style={{ width: "100%", height: "auto", flex: "1 1 auto" }}>
        {hops.map((hop, index) => {
          const from = pos[hop.fromId];
          const to = pos[hop.toId];
          if (!from || !to) return null;
          const d = curve(from, to, ((index % 3) - 1) * 18);
          const color = phaseColor(hop.phase);
          const active = hop.key === selected?.key;
          return (
            <g key={hop.key} data-hop={hop.key} data-phase={hop.phase}>
              <path d={d} fill="none" stroke="transparent" strokeWidth="14" style={{ cursor: "pointer" }} onClick={() => setSelectedKey(hop.key)} />
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={active ? 2.6 : 1.6}
                markerEnd={`url(#hop-arrow-${hop.phase})`}
                style={{ pointerEvents: "none" }}
              />
              {hop.phase === "in_flight" ? (
                <circle r="4.5" fill={color} style={{ pointerEvents: "none" }}>
                  <animateMotion dur="1.3s" repeatCount="indefinite" path={d} />
                </circle>
              ) : null}
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 8}
                textAnchor="middle"
                fill={color}
                fontSize="11"
                style={{ pointerEvents: "none" }}
              >
                {phaseLabel(hop.phase, copy)}
              </text>
            </g>
          );
        })}
        <defs>
          {(["in_flight", "completed", "failed"] as const).map((phase) => (
            <marker key={phase} id={`hop-arrow-${phase}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={phaseColor(phase)} />
            </marker>
          ))}
        </defs>
        {ids.map((id) => {
          const point = pos[id];
          const inside = members.has(bare(id).toLowerCase());
          const hop = hops.find((item) => item.toId === id);
          const label = displayName(id, names, hop?.name);
          return (
            <g key={id}>
              <circle
                cx={point.x}
                cy={point.y}
                r="16"
                fill={colors.panelAlt}
                stroke={inside ? colors.accentBright : colors.muted}
                strokeWidth="2"
                strokeDasharray={inside ? undefined : "4 3"}
              />
              <text x={point.x} y={point.y + 32} textAnchor="middle" fill={colors.text} fontSize="12">
                {label}
              </text>
              {inside ? null : (
                <text x={point.x} y={point.y + 46} textAnchor="middle" fill={colors.muted} fontSize="10">
                  {copy.outside}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {selected ? (
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: "8px 12px", fontSize: 12, color: colors.muted }}>
          <span style={{ color: colors.text }}>
            {displayName(selected.fromId, names)} → {displayName(selected.toId, names, selected.name)}
          </span>
          <span style={{ color: phaseColor(selected.phase) }}> · {phaseLabel(selected.phase, copy)}</span>
          {selected.hopId ? <div style={{ marginTop: 4 }}>{selected.hopId}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
