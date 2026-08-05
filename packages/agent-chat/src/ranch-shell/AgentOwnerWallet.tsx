"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  ChatGatewayError,
  type GatewayClient,
  type MyAgentWallet,
  type MyAgentWalletTx,
} from "../gateway";
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

function fmtTxTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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

export function AgentOwnerWallet({
  client,
  agentId,
  messages: t,
  agentPlanetBaseUrl = "https://agentplanet.org",
  busy,
}: Props) {
  const [wallet, setWallet] = useState<MyAgentWallet | null>(null);
  const [txs, setTxs] = useState<MyAgentWalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [acting, setActing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

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
      setError(t.walletLoadFailed);
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={assetCard}>
            <div style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>
              {t.walletBalance}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
              {fmtCredits(wallet.balance)}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
              {t.walletCreditsHint}
            </div>
          </div>
          <div style={assetCard}>
            <div style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>
              {t.walletApPoints}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
              {fmtCredits(wallet.ap_points)}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
              {t.walletApPointsHint}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
            position: "absolute",
            inset: 0,
            zIndex: 50,
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
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 15,
                fontWeight: 650,
                color: colors.text,
              }}
            >
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
                disabled={
                  acting || (dialog === "topup" ? topupBlocked : withdrawBlocked)
                }
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
    </div>
  );
}
