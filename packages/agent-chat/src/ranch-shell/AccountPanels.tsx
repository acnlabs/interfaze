"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { GatewayClient, HumanWallet, MyAgentWalletTx } from "../gateway";
import type { RanchChatAccount } from "../types";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors } from "./styles";

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.muted,
};

function PanelChrome({
  title,
  onClose,
  closeLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
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
        <button type="button" style={btnGhost} onClick={onClose} aria-label={closeLabel}>
          ←
        </button>
        <strong style={{ fontSize: 14, flex: 1 }}>{title}</strong>
        <span style={{ width: 40 }} />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>{children}</div>
    </div>
  );
}

export function AccountProfilePanel({
  account,
  messages: t,
  onClose,
}: {
  account: RanchChatAccount;
  messages: RanchMessages;
  onClose: () => void;
}) {
  const name = (account.name || "").trim();
  const email = (account.email || "").trim();
  const initial = (name || email || t.account).slice(0, 1).toUpperCase() || "?";

  return (
    <PanelChrome title={t.accountProfile} onClose={onClose} closeLabel={t.close}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        {account.picture ? (
          <img
            src={account.picture}
            alt=""
            width={72}
            height={72}
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              objectFit: "cover",
              background: colors.border,
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: colors.accentSoft,
              color: colors.accent,
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {initial}
          </span>
        )}
        <div style={{ textAlign: "center", width: "100%" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>
            {name || t.account}
          </p>
          {email ? (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: colors.muted }}>{email}</p>
          ) : null}
        </div>
      </div>
      <div style={{ marginTop: 28 }}>
        <h3 style={sectionTitle}>{t.accountProfile}</h3>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.55 }}>
          {t.accountProfileHint}
        </p>
      </div>
    </PanelChrome>
  );
}

export function AccountPlanUsagePanel({
  messages: t,
  onClose,
}: {
  messages: RanchMessages;
  onClose: () => void;
}) {
  return (
    <PanelChrome title={t.accountPlanUsage} onClose={onClose} closeLabel={t.close}>
      <h3 style={sectionTitle}>{t.comingSoon}</h3>
      <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.55 }}>
        {t.accountPlanUsageBody}
      </p>
      <p style={{ margin: "12px 0 0", fontSize: 12, color: colors.muted, lineHeight: 1.55 }}>
        {t.accountPlanUsageHint}
      </p>
    </PanelChrome>
  );
}

function fmtCredits(n: number): string {
  return Math.trunc(n).toLocaleString();
}

function fmtTxTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** Human Credits wallet — separate from Plan & Usage and agent wallets. */
export function AccountWalletPanel({
  client,
  messages: t,
  agentPlanetBaseUrl = "https://agentplanet.org",
  onClose,
}: {
  client: GatewayClient;
  messages: RanchMessages;
  agentPlanetBaseUrl?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<HumanWallet | null>(null);
  const [txs, setTxs] = useState<MyAgentWalletTx[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      client.getHumanWallet(),
      client.listHumanWalletTransactions(1, 10),
    ])
      .then(([w, list]) => {
        if (cancelled) return;
        setWallet(w);
        setTxs(list.transactions || []);
      })
      .catch(() => {
        if (!cancelled) setError(t.accountWalletLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, t.accountWalletLoadFailed]);

  const rechargeUrl = `${agentPlanetBaseUrl.replace(/\/$/, "")}/wallet`;

  return (
    <PanelChrome title={t.accountWallet} onClose={onClose} closeLabel={t.close}>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
        {t.accountWalletHint}
      </p>
      {loading ? (
        <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>
      ) : error ? (
        <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>
      ) : (
        <>
          <h3 style={sectionTitle}>{t.walletTab}</h3>
          <p style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {fmtCredits(wallet?.balance ?? 0)}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted }}>Credits</p>
          <a
            href={rechargeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnPrimary,
              display: "inline-block",
              textDecoration: "none",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {t.walletRechargeExternal}
          </a>
          <p style={{ margin: "0 0 16px", fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
            {t.walletRechargeExternalHint}
          </p>
          <h3 style={sectionTitle}>{t.accountWalletRecent}</h3>
          {txs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{t.accountWalletEmptyTx}</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {txs.map((tx) => (
                <li
                  key={tx.transaction_id}
                  style={{
                    padding: "10px 0",
                    borderBottom: `1px solid ${colors.border}`,
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                      {tx.type}
                      {tx.description ? (
                        <span style={{ fontWeight: 400, color: colors.muted }}> · {tx.description}</span>
                      ) : null}
                    </span>
                    <span style={{ fontSize: 11, color: colors.muted }}>{fmtTxTime(tx.created_at)}</span>
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 650,
                      color: tx.amount < 0 ? colors.danger : colors.text,
                      flexShrink: 0,
                    }}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {fmtCredits(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PanelChrome>
  );
}

/** Hub for user-created Agents / Subnets / Orgs — not listed in the account menu. */
export function AccountManagePanel({
  messages: t,
  onClose,
  onOpenAgents,
}: {
  messages: RanchMessages;
  onClose: () => void;
  onOpenAgents: () => void;
}) {
  const items: Array<{
    key: string;
    label: string;
    hint: string;
    comingSoon?: boolean;
    onSelect?: () => void;
  }> = [
    {
      key: "agents",
      label: t.hubAgents,
      hint: t.hubAgentsManageHint,
      onSelect: onOpenAgents,
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
        <strong style={{ fontSize: 14, flex: 1 }}>{t.accountManage}</strong>
        <span style={{ width: 40 }} />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "16px 0" }}>
        <div style={{ padding: "0 14px 10px" }}>
          <p style={sectionTitle}>{t.hubManageSection}</p>
          <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
            {t.hubManageIntro}
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
