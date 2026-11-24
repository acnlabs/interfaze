"use client";

import { useState } from "react";
import { harnessLabel, knownHarnessMark, type AgentHarness } from "./agentHarness";
import { KnownHarnessGlyph } from "./harnessMarks";

/** Corner mark for a self-reported harness. Sits top-right so the presence dot can stay bottom-right. */
export function HarnessBadge({
  harness,
  size,
  ring,
}: {
  harness: AgentHarness;
  size: number;
  ring: string;
}) {
  const [broken, setBroken] = useState(false);
  const dim = Math.max(10, Math.min(18, Math.round(size * 0.42)));
  const reported = harness.logo_url && !broken ? harness.logo_url : "";
  const known = knownHarnessMark(harness.name);
  const glyph = (Array.from(harness.name.trim())[0] || "?").toUpperCase();
  return (
    <span
      title={harnessLabel(harness)}
      style={{
        position: "absolute",
        top: -1,
        right: -1,
        width: dim,
        height: dim,
        borderRadius: 999,
        overflow: "hidden",
        border: `2px solid ${ring}`,
        background: "#0f172a",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(8, dim - 6),
        fontWeight: 700,
        lineHeight: 1,
        boxSizing: "border-box",
      }}
    >
      {reported ? (
        <img
          src={reported}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : known ? (
        <KnownHarnessGlyph mark={known} />
      ) : (
        glyph
      )}
    </span>
  );
}
