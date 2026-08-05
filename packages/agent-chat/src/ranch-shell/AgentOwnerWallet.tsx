"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  ChatGatewayError,
  type GatewayClient,
  type MyAgentSpendPolicy,
  type MyAgentWallet,
  type MyAgentWalletTx,
  type SpendAutonomy,
} from "../gateway";
import { FieldHint } from "./AgentOwnerSettings";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors, inputStyle } from "./styles";

/** Match Gateway ``MyAgentWalletAmount.amount`` upper bound. */
const MAX_CREDITS = 100_000_000;

type Props = {
  client: GatewayClient;
  agentId: string;
  messages: RanchMessages;
  agentPlanetBaseUrl?: string;
  busy?: boolean;
};

type DialogAction = "topup" | "withdraw";

type PolicyForm = {
  autonomy: SpendAutonomy;
  perTx: string;
  windowLimit: string;
  windowHours: string;
  reserveFloor: string;
};

function fmtCredits(n: number): string {
  return Math.trunc(n).toLocaleString();
}

function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (!/^\d+$/.test(s)) return null;
  if (s.length > 9) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0 || n > MAX_CREDITS) return null;
  return n;
}

function parseOptionalNonNeg(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_CREDITS) return undefined;
  return n;
}

function fmtTxTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function autonomyLabel(a: string, t: RanchMessages): string {
  if (a === "limited") return t.spendAutonomyLimited;
  if (a === "unlimited") return t.spendAutonomyUnlimited;
  return t.spendAutonomyDisabled;
}

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.muted,
};

const assetCard: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  background: colors.panel,
  minWidth: 0,
};

function formFromPolicy(p: MyAgentSpendPolicy): PolicyForm {
  return {
    autonomy: (p.stored_autonomy as SpendAutonomy) || "disabled",
    perTx: p.per_tx_limit?.toString() ?? "",
    windowLimit: p.window_limit?.toString() ?? "",
    windowHours: String(p.window_hours ?? 24),
    reserveFloor: String(p.reserve_floor ?? 0),
  };
}

export function AgentOwnerWallet({
  client,
  agentId,
  messages: t,
  agentPlanetBaseUrl = "https://agentplanet.org",
  busy,
}: Props) {
  const [wallet, setWallet] = useState<MyAgentWallet | null>(null);
  const [policy, setPolicy] = useState<MyAgentSpendPolicy | null>(null);
  const [txs, setTxs] = useState<MyAgentWalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [acting, setActing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [showPolicy, setShowPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState<PolicyForm>({
    autonomy: "disabled",
    perTx: "",
    windowLimit: "",
    windowHours: "24",
    reserveFloor: "0",
  });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const rechargeUrl = `${agentPlanetBaseUrl.replace(/\/+$/, "")}/wallet`;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, list] = await Promise.all([
        client.getMyAgentWallet(agentId),
        client.listMyAgentWalletTransactions(agentId, 1, 15),
      ]);
      setWallet(w);
      setTxs(list.transactions ?? []);
    } catch {
      setWallet(null);
      setTxs([]);
      setPolicy(null);
      setError(t.walletLoadFailed);
      setLoading(false);
      return;
    }
    try {
      const sp = await client.getMyAgentSpendPolicy(agentId);
      setPolicy(sp);
      setPolicyForm(formFromPolicy(sp));
    } catch {
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, [client, agentId, t.walletLoadFailed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openDialog = (action: DialogAction) => {
    setDialog(action);
    setAmountDraft("");
    setDialogError(null);
    setFlash(null);
  };

  const closeDialog = () => {
    if (acting) return;
    setDialog(null);
    setAmountDraft("");
    setDialogError(null);
  };

  const openPolicy = async () => {
    setShowPolicy(true);
    setPolicyError(null);
    setPolicyLoading(true);
    try {
      const sp = await client.getMyAgentSpendPolicy(agentId);
      setPolicy(sp);
      setPolicyForm(formFromPolicy(sp));
    } catch {
      setPolicyError(t.spendPolicyLoadFailed);
    } finally {
      setPolicyLoading(false);
    }
  };

  const savePolicy = async () => {
    if (policyLoading) return;
    setPolicyLoading(true);
    setPolicyError(null);
    try {
      const patch: {
        autonomy: SpendAutonomy;
        per_tx_limit?: number | null;
        window_limit?: number | null;
        window_hours?: number;
        reserve_floor?: number;
      } = { autonomy: policyForm.autonomy };
      if (policyForm.autonomy === "limited") {
        const perTx = parseOptionalNonNeg(policyForm.perTx);
        const windowLimit = parseOptionalNonNeg(policyForm.windowLimit);
        const hoursRaw = policyForm.windowHours.trim();
        const hours = hoursRaw === "" ? 24 : Number(hoursRaw);
        const floor = parseOptionalNonNeg(policyForm.reserveFloor);
        if (perTx === undefined || windowLimit === undefined || floor === undefined) {
          setPolicyError(t.spendPolicyInvalidLimits);
          setPolicyLoading(false);
          return;
        }
        if (!Number.isSafeInteger(hours) || hours < 1) {
          setPolicyError(t.spendPolicyInvalidLimits);
          setPolicyLoading(false);
          return;
        }
        patch.per_tx_limit = perTx;
        patch.window_limit = windowLimit;
        patch.window_hours = hours;
        patch.reserve_floor = floor ?? 0;
      } else {
        // Clear envelope when leaving limited (server also clears).
        patch.per_tx_limit = null;
        patch.window_limit = null;
        patch.reserve_floor = 0;
      }
      const next = await client.updateMyAgentSpendPolicy(agentId, patch);
      setPolicy(next);
      setPolicyForm(formFromPolicy(next));
      setShowPolicy(false);
      setFlash(t.spendPolicySaved);
    } catch {
      setPolicyError(t.spendPolicyFailed);
    } finally {
      setPolicyLoading(false);
    }
  };

  const amount = parseAmount(amountDraft);

  const runTransfer = async () => {
    if (!dialog || amount == null || acting || !wallet) return;
    if (dialog === "topup" && amount > wallet.owner_balance) {
      setDialogError(t.walletInsufficient);
      return;
    }
    if (dialog === "withdraw" && amount > wallet.balance) {
      setDialogError(t.walletInsufficient);
      return;
    }
    setActing(true);
    setDialogError(null);
    try {
      const next =
        dialog === "topup"
          ? await client.topupMyAgentWallet(agentId, amount)
          : await client.withdrawMyAgentWallet(agentId, amount);
      setWallet(next);
      setDialog(null);
      setAmountDraft("");
      setFlash(dialog === "topup" ? t.walletTopupOk : t.walletWithdrawOk);
      const list = await client.listMyAgentWalletTransactions(agentId, 1, 15);
      setTxs(list.transactions ?? []);
    } catch (e) {
      const code = e instanceof ChatGatewayError ? e.code : "";
      setDialogError(code === "insufficient_credits" ? t.walletInsufficient : t.walletFailed);
    } finally {
      setActing(false);
    }
  };

  if (loading && !wallet) {
    return <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>;
  }
  if (error && !wallet) {
    return <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>;
  }
  if (!wallet) return null;

  const topupBlocked = amount == null || amount > wallet.owner_balance;
  const withdrawBlocked = amount == null || amount > wallet.balance;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
      <section>
        <h3 style={sectionTitle}>{t.walletTab}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={assetCard}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: colors.muted,
                marginBottom: 4,
              }}
            >
              {t.walletBalance}
              <FieldHint text={t.walletCreditsHint} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
              {fmtCredits(wallet.balance)}
            </div>
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: colors.muted,
                }}
              >
                {t.spendPolicyTitle}
                <FieldHint text={t.spendPolicyHint} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>
                {policy
                  ? autonomyLabel(String(policy.stored_autonomy), t)
                  : t.spendPolicyLoadFailed}
              </span>
              <button
                type="button"
                style={{
                  ...btnGhost,
                  fontSize: 11,
                  padding: "4px 8px",
                  flexShrink: 0,
                }}
                disabled={busy || acting}
                onClick={() => void openPolicy()}
              >
                {t.spendPolicyEdit}
              </button>
            </div>
            {policy && policy.stored_autonomy === "limited" && policy.window_remaining != null ? (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
                {t.spendWindowUsage(
                  fmtCredits(policy.window_spent),
                  fmtCredits(policy.window_remaining),
                  String(policy.window_hours),
                )}
              </p>
            ) : policy && policy.stored_autonomy === "limited" ? (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
                {t.spendWindowSpent(String(policy.window_hours))}:{" "}
                <span style={{ color: colors.text, fontWeight: 600 }}>
                  {fmtCredits(policy.window_spent)}
                </span>
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                style={{ ...btnPrimary, flex: 1, fontWeight: 600 }}
                disabled={busy || acting}
                onClick={() => openDialog("topup")}
              >
                {t.walletTopup}
              </button>
              <button
                type="button"
                style={{ ...btnGhost, flex: 1, fontWeight: 600 }}
                disabled={busy || acting || wallet.balance <= 0}
                onClick={() => openDialog("withdraw")}
              >
                {t.walletWithdraw}
              </button>
            </div>
          </div>
          <div style={assetCard}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: colors.muted,
                marginBottom: 4,
              }}
            >
              {t.walletApPoints}
              <FieldHint text={t.walletApPointsHint} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
              {fmtCredits(wallet.ap_points)}
            </div>
          </div>
        </div>
        {flash ? (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: colors.accent }}>{flash}</p>
        ) : null}
      </section>

      <section>
        <h3 style={sectionTitle}>{t.walletTxTitle}</h3>
        {txs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{t.walletTxEmpty}</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {txs.map((tx) => (
              <li
                key={tx.transaction_id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: colors.text, fontWeight: 600 }}>{tx.type}</span>
                  <span style={{ color: colors.text }}>{fmtCredits(tx.amount)}</span>
                </div>
                <div style={{ marginTop: 4, color: colors.muted }}>
                  {tx.description || "—"}
                  {tx.created_at ? ` · ${fmtTxTime(tx.created_at)}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={closeDialog}
        >
          <div
            style={{
              width: "min(360px, 100%)",
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 650, color: colors.text }}>
              {dialog === "topup" ? t.walletTopupDialogTitle : t.walletWithdrawDialogTitle}
            </h3>

            {dialog === "topup" ? (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                {t.walletOwnerBalance}:{" "}
                <span style={{ color: colors.text, fontWeight: 600 }}>
                  {fmtCredits(wallet.owner_balance)}
                </span>
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                {t.walletBalance}:{" "}
                <span style={{ color: colors.text, fontWeight: 600 }}>
                  {fmtCredits(wallet.balance)}
                </span>
              </p>
            )}

            <label style={{ display: "block", fontSize: 12, color: colors.muted, marginBottom: 6 }}>
              {t.walletAmount}
            </label>
            <input
              value={amountDraft}
              onChange={(e) => {
                setAmountDraft(e.target.value);
                setDialogError(null);
              }}
              inputMode="numeric"
              placeholder="100"
              disabled={acting}
              autoFocus
              style={{ ...inputStyle, width: "100%", marginBottom: 6 }}
            />
            <p style={{ margin: "0 0 12px", fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
              {t.walletAmountHint}
            </p>

            {dialog === "topup" && amount != null && amount > wallet.owner_balance ? (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                {t.walletRechargeExternalHint}{" "}
                <a
                  href={rechargeUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: colors.accent }}
                >
                  {t.walletRechargeExternal}
                </a>
              </p>
            ) : null}

            {dialogError ? (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.danger }}>{dialogError}</p>
            ) : null}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={btnGhost} disabled={acting} onClick={closeDialog}>
                {t.cancel}
              </button>
              <button
                type="button"
                style={{ ...btnPrimary, fontWeight: 600 }}
                disabled={acting || (dialog === "topup" ? topupBlocked : withdrawBlocked)}
                onClick={() => void runTransfer()}
              >
                {acting
                  ? t.loading
                  : dialog === "topup"
                    ? t.walletTopupConfirmLabel
                    : t.walletWithdrawConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPolicy ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            overflow: "auto",
          }}
          onClick={() => {
            if (!policyLoading) setShowPolicy(false);
          }}
        >
          <div
            style={{
              width: "min(400px, 100%)",
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
              margin: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 650, color: colors.text }}>
              {t.spendPolicyTitle}
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
              {t.spendPolicyHint}
            </p>

            {policyLoading && !policy ? (
              <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>
            ) : (
              <>
                {policy ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginBottom: 12,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ color: colors.muted }}>{t.walletBalance}</div>
                      <div style={{ color: colors.text, fontWeight: 600 }}>
                        {fmtCredits(policy.balance)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: colors.muted }}>
                        {t.spendWindowSpent(String(policy.window_hours))}
                      </div>
                      <div style={{ color: colors.text, fontWeight: 600 }}>
                        {fmtCredits(policy.window_spent)}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {(
                    [
                      {
                        v: "disabled" as const,
                        label: t.spendAutonomyDisabled,
                        help: t.spendAutonomyDisabledHelp,
                      },
                      {
                        v: "limited" as const,
                        label: t.spendAutonomyLimited,
                        help: t.spendAutonomyLimitedHelp,
                      },
                      {
                        v: "unlimited" as const,
                        label: t.spendAutonomyUnlimited,
                        help: t.spendAutonomyUnlimitedHelp,
                      },
                    ] as const
                  ).map((opt) => {
                    const on = policyForm.autonomy === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setPolicyForm((f) => ({ ...f, autonomy: opt.v }))}
                        style={{
                          ...btnGhost,
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: 4,
                          padding: "10px 8px",
                          fontSize: 11,
                          fontWeight: on ? 650 : 500,
                          background: on ? colors.accentSoft : "transparent",
                          borderColor: on ? "rgba(59,130,246,0.45)" : colors.border,
                          color: on ? colors.text : colors.muted,
                          textAlign: "left",
                        }}
                      >
                        <span>{opt.label}</span>
                        <span style={{ opacity: 0.75, lineHeight: 1.35 }}>{opt.help}</span>
                      </button>
                    );
                  })}
                </div>

                {policyForm.autonomy === "limited" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    <div>
                      <label
                        style={{ display: "block", fontSize: 12, color: colors.muted, marginBottom: 4 }}
                      >
                        {t.spendPerTxLimit}
                      </label>
                      <input
                        value={policyForm.perTx}
                        onChange={(e) => setPolicyForm((f) => ({ ...f, perTx: e.target.value }))}
                        placeholder={t.spendNoCap}
                        inputMode="numeric"
                        style={{ ...inputStyle, width: "100%" }}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: colors.muted,
                            marginBottom: 4,
                          }}
                        >
                          {t.spendWindowLimit}
                        </label>
                        <input
                          value={policyForm.windowLimit}
                          onChange={(e) =>
                            setPolicyForm((f) => ({ ...f, windowLimit: e.target.value }))
                          }
                          placeholder={t.spendNoCap}
                          inputMode="numeric"
                          style={{ ...inputStyle, width: "100%" }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: colors.muted,
                            marginBottom: 4,
                          }}
                        >
                          {t.spendWindowHours}
                        </label>
                        <input
                          value={policyForm.windowHours}
                          onChange={(e) =>
                            setPolicyForm((f) => ({ ...f, windowHours: e.target.value }))
                          }
                          placeholder="24"
                          inputMode="numeric"
                          style={{ ...inputStyle, width: "100%" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        style={{ display: "block", fontSize: 12, color: colors.muted, marginBottom: 4 }}
                      >
                        {t.spendReserveFloor}
                      </label>
                      <input
                        value={policyForm.reserveFloor}
                        onChange={(e) =>
                          setPolicyForm((f) => ({ ...f, reserveFloor: e.target.value }))
                        }
                        placeholder="0"
                        inputMode="numeric"
                        style={{ ...inputStyle, width: "100%" }}
                      />
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: colors.muted }}>
                        {t.spendReserveFloorHint}
                      </p>
                    </div>
                  </div>
                ) : null}

                {policyForm.autonomy === "unlimited" ? (
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: "#fbbf24", lineHeight: 1.45 }}>
                    {t.spendAutonomyUnlimitedWarn}
                  </p>
                ) : null}

                {policyError ? (
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.danger }}>
                    {policyError}
                  </p>
                ) : null}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    style={btnGhost}
                    disabled={policyLoading}
                    onClick={() => setShowPolicy(false)}
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    style={{ ...btnPrimary, fontWeight: 600 }}
                    disabled={policyLoading}
                    onClick={() => void savePolicy()}
                  >
                    {policyLoading ? t.loading : t.spendPolicySave}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
