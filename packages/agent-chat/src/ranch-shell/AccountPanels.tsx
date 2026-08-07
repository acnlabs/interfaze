"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type {
  ChatCollabBudget,
  GatewayClient,
  HumanWallet,
  MyAgentWalletTx,
  PlanUsage,
} from "../gateway";
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
  client,
  messages: t,
  locale = "en",
  onClose,
  onOpenWallet,
}: {
  client: GatewayClient;
  messages: RanchMessages;
  locale?: "en" | "zh";
  onClose: () => void;
  onOpenWallet?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlanUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void client
      .getPlanUsage()
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch(() => {
        if (!cancelled) setError(t.accountPlanUsageLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, t.accountPlanUsageLoadFailed]);

  const planLabel =
    locale === "zh"
      ? data?.plan.label_zh || data?.plan.label || "—"
      : data?.plan.label || "—";
  const used = data?.usage.dialog_credits ?? 0;
  const allowance = data?.allowance.dialog_credits ?? null;
  const remaining = data?.allowance.dialog_credits_remaining ?? null;
  const byAgent = data?.usage.by_agent ?? [];

  return (
    <PanelChrome title={t.accountPlanUsage} onClose={onClose} closeLabel={t.close}>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
        {t.accountPlanUsageBody}
      </p>
      {loading ? (
        <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>
      ) : error ? (
        <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>
      ) : (
        <>
          <h3 style={sectionTitle}>{t.accountPlanCurrent}</h3>
          <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{planLabel}</p>
          <p style={{ margin: "0 0 20px", fontSize: 12, color: colors.muted }}>
            {data?.allowance.honored === true && allowance != null
              ? `${t.accountPlanAllowance}: ${fmtCredits(allowance)}${
                  remaining != null
                    ? ` · ${fmtCredits(remaining)} ${t.accountPlanRemaining}`
                    : ""
                }`
              : t.accountPlanPayg}
          </p>

          <h3 style={sectionTitle}>{t.accountPlanUsageThisMonth}</h3>
          <p style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {fmtCredits(used)}
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.muted }}>
            {t.walletBalance}
          </p>
          {!data?.chat_billing_enabled ? (
            <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
              {t.accountPlanBillingOff}
            </p>
          ) : null}

          {byAgent.length === 0 ? (
            <p style={{ margin: "0 0 20px", fontSize: 12, color: colors.muted }}>
              {t.accountPlanEmptyUsage}
            </p>
          ) : (
            <>
              <h3 style={sectionTitle}>{t.accountPlanByAgent}</h3>
              <ul style={{ listStyle: "none", margin: "0 0 20px", padding: 0 }}>
                {byAgent.map((row) => (
                  <li
                    key={row.agent_id}
                    style={{
                      padding: "10px 0",
                      borderBottom: `1px solid ${colors.border}`,
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.agent_id}
                    </span>
                    <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {fmtCredits(row.credits)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {onOpenWallet ? (
            <button type="button" style={{ ...btnPrimary, width: "100%" }} onClick={onOpenWallet}>
              {t.accountPlanOpenWallet}
            </button>
          ) : null}
          <p style={{ margin: "12px 0 0", fontSize: 12, color: colors.muted, lineHeight: 1.55 }}>
            {t.accountPlanUsageHint}
          </p>
        </>
      )}
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

/** Account default collab tank + optional per-chat remaining controls. */
export function ChatCollabBudgetSection({
  client,
  messages: t,
  chatId,
}: {
  client: GatewayClient;
  messages: RanchMessages;
  chatId?: string | null;
}) {
  const [cap, setCap] = useState(0);
  const [capDraft, setCapDraft] = useState("0");
  const [budget, setBudget] = useState<ChatCollabBudget | null>(null);
  const [addDraft, setAddDraft] = useState("20");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    setErr(null);
    void client
      .getCollabCap()
      .then((r) => {
        setCap(r.cap_credits);
        setCapDraft(String(r.cap_credits));
      })
      .catch(() => setErr(t.sendFailed));
    if (chatId) {
      void client
        .getChatCollabBudget(chatId)
        .then(setBudget)
        .catch(() => setBudget(null));
    } else {
      setBudget(null);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on chat/client
  }, [client, chatId]);

  return (
    <div>
      <h3 style={sectionTitle}>{t.collabBudget}</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
        {t.collabBudgetHint}
      </p>
      {err ? (
        <p style={{ color: colors.danger, fontSize: 12, margin: "0 0 8px" }}>{err}</p>
      ) : null}
      <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
        {t.collabAccountCap}
      </label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          type="number"
          min={0}
          value={capDraft}
          onChange={(e) => setCapDraft(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: colors.text,
            fontSize: 14,
          }}
        />
        <button
          type="button"
          style={btnPrimary}
          disabled={busy}
          onClick={() => {
            const n = Math.max(0, Math.trunc(Number(capDraft) || 0));
            setBusy(true);
            void client
              .putCollabCap(n)
              .then((r) => {
                setCap(r.cap_credits);
                setCapDraft(String(r.cap_credits));
              })
              .catch(() => setErr(t.sendFailed))
              .finally(() => setBusy(false));
          }}
        >
          {t.collabSave}
        </button>
      </div>
      {chatId ? (
        <>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: colors.muted }}>
            {t.collabRemaining}:{" "}
            <strong style={{ color: colors.text }}>
              {fmtCredits(budget?.remaining_credits ?? 0)}
            </strong>
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: colors.muted }}>
            {budget?.can_auto ? t.collabAutoOn : t.collabAutoOff}
            {cap > 0 ? ` · ${t.collabAccountCap} ${cap}` : ""}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input
              type="number"
              min={1}
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              style={{
                width: 88,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.text,
                fontSize: 14,
              }}
            />
            <button
              type="button"
              style={btnPrimary}
              disabled={busy}
              onClick={() => {
                const n = Math.max(1, Math.trunc(Number(addDraft) || 0));
                setBusy(true);
                void client
                  .addChatCollabBudget(chatId, n)
                  .then(setBudget)
                  .catch(() => setErr(t.sendFailed))
                  .finally(() => setBusy(false));
              }}
            >
              {t.collabAdd}
            </button>
            <button
              type="button"
              style={btnGhost}
              disabled={busy || cap <= 0}
              onClick={() => {
                setBusy(true);
                void client
                  .ensureChatCollabDefault(chatId)
                  .then(setBudget)
                  .catch(() => setErr(t.sendFailed))
                  .finally(() => setBusy(false));
              }}
            >
              {t.collabApplyDefault}
            </button>
            <button
              type="button"
              style={btnGhost}
              disabled={busy || !(budget && budget.remaining_credits > 0)}
              onClick={() => {
                setBusy(true);
                void client
                  .releaseChatCollabBudget(chatId)
                  .then((r) => setBudget(r))
                  .catch(() => setErr(t.sendFailed))
                  .finally(() => setBusy(false));
              }}
            >
              {t.collabRelease}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

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
          <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted }}>
            {t.walletBalance}
          </p>
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
          <div style={{ marginBottom: 24 }}>
            <ChatCollabBudgetSection client={client} messages={t} />
          </div>
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
