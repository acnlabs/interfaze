"use client";

import type { CSSProperties } from "react";
import type { RanchMessages } from "./i18n";
import { btnGhost, colors } from "./styles";

export type AccountHubKind = "manage" | "discover";

type HubItem = {
  key: string;
  label: string;
  hint?: string;
  comingSoon?: boolean;
  onSelect?: () => void;
};

type Props = {
  kind: AccountHubKind;
  messages: RanchMessages;
  onClose: () => void;
  onOpenMyAgents: () => void;
  onOpenDiscoverAgents: () => void;
};

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.muted,
};

export function AccountHubPanel({
  kind,
  messages: t,
  onClose,
  onOpenMyAgents,
  onOpenDiscoverAgents,
}: Props) {
  const title = kind === "manage" ? t.accountManage : t.accountDiscover;
  const items: HubItem[] =
    kind === "manage"
      ? [
          {
            key: "agents",
            label: t.hubAgents,
            hint: t.hubAgentsManageHint,
            onSelect: onOpenMyAgents,
          },
          {
            key: "subnets",
            label: t.networkSubnets,
            hint: t.hubSubnetsManageHint,
            comingSoon: true,
          },
          {
            key: "orgs",
            label: t.networkOrgs,
            hint: t.hubOrgsManageHint,
            comingSoon: true,
          },
        ]
      : [
          {
            key: "agents",
            label: t.hubAgents,
            hint: t.hubAgentsDiscoverHint,
            onSelect: onOpenDiscoverAgents,
          },
          {
            key: "subnets",
            label: t.networkSubnets,
            hint: t.hubSubnetsDiscoverHint,
            comingSoon: true,
          },
          {
            key: "orgs",
            label: t.networkOrgs,
            hint: t.hubOrgsDiscoverHint,
            comingSoon: true,
          },
        ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <button type="button" style={btnGhost} onClick={onClose} aria-label={t.close}>
          ←
        </button>
        <strong style={{ fontSize: 14, flex: 1 }}>{title}</strong>
        <span style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 0" }}>
        <div style={{ padding: "0 14px 8px" }}>
          <p style={sectionTitle}>{kind === "manage" ? t.hubManageSection : t.hubDiscoverSection}</p>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
            {kind === "manage" ? t.hubManageIntro : t.hubDiscoverIntro}
          </p>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => {
            const disabled = !!item.comingSoon || !item.onSelect;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-disabled={disabled || undefined}
                  title={item.comingSoon ? t.comingSoon : undefined}
                  onClick={() => item.onSelect?.()}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: disabled ? colors.muted : colors.text,
                    padding: "12px 14px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: disabled ? 0.8 : 1,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {item.label}
                      {item.comingSoon ? (
                        <span style={{ fontSize: 11, fontWeight: 500, color: colors.muted }}>
                          {t.comingSoon}
                        </span>
                      ) : null}
                    </span>
                    {item.hint ? (
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          fontSize: 11,
                          color: colors.muted,
                          lineHeight: 1.45,
                        }}
                      >
                        {item.hint}
                      </span>
                    ) : null}
                  </span>
                  {!disabled ? (
                    <span style={{ color: colors.muted, fontSize: 14 }}>›</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
