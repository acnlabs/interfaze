"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  ChatGatewayError,
  type AgentCreateAvailability,
  type AgentCreateJob,
  type AgentCreateKey,
  type AgentCreateMachine,
  type GatewayClient,
} from "../gateway";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors } from "./styles";

function machinesFrom(avail: AgentCreateAvailability | null): AgentCreateMachine[] {
  if (!avail) return [];
  if (avail.machines?.length) return avail.machines;
  return avail.tiers.map((row) => ({
    tier_id: row.tier_id,
    product_id: row.product_id,
    machine_credits: row.machine_credits,
  }));
}

function keysFrom(avail: AgentCreateAvailability | null): AgentCreateKey[] {
  if (!avail) return [];
  if (avail.keys?.length) return avail.keys;
  const credits = avail.key_credits;
  if (!avail.key_product_id && credits == null) return [];
  return [
    {
      product_id: avail.key_product_id || "or-starter",
      key_quota_credits: avail.key_quota_credits ?? 500,
      key_fee_credits: avail.key_fee_credits ?? 50,
      key_credits: credits ?? 550,
    },
  ];
}

function feePercent(row: AgentCreateKey): number {
  if (row.key_quota_credits > 0) {
    return Math.round((row.key_fee_credits / row.key_quota_credits) * 100);
  }
  return 0;
}

type Props = {
  client: GatewayClient;
  messages: RanchMessages;
  agentPlanetBaseUrl: string;
  busy?: boolean;
  onClose: () => void;
  onReady: (agentId: string) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CreateAgentDialog({
  client,
  messages: t,
  agentPlanetBaseUrl,
  busy,
  onClose,
  onReady,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [avail, setAvail] = useState<AgentCreateAvailability | null>(null);
  const [name, setName] = useState("");
  const [tierId, setTierId] = useState<string>("starter");
  const [runtime, setRuntime] = useState<"hermes" | "openclaw">("hermes");
  const [keyProductId, setKeyProductId] = useState<string>("or-starter");
  const [job, setJob] = useState<AgentCreateJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void client
      .getAgentCreateAvailability()
      .then((row) => {
        if (cancelled) return;
        setAvail(row);
        const machines = machinesFrom(row);
        const keys = keysFrom(row);
        if (machines[0]?.tier_id) setTierId(machines[0].tier_id);
        const preferredRuntime = row.default_runtime === "openclaw" ? "openclaw" : "hermes";
        setRuntime(preferredRuntime);
        const preferred =
          row.default_key_product_id ||
          row.key_product_id ||
          keys[0]?.product_id;
        if (preferred) setKeyProductId(preferred);
      })
      .catch(() => {
        if (!cancelled) {
          setAvail({ available: false, reason: "unavailable", tiers: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const machines = machinesFrom(avail);
  const keys = keysFrom(avail);
  const machine = machines.find((row) => row.tier_id === tierId) ?? machines[0];
  const key = keys.find((row) => row.product_id === keyProductId) ?? keys[0];
  const totalCredits = (machine?.machine_credits ?? 0) + (key?.key_credits ?? 0);
  const rechargeUrl = `${agentPlanetBaseUrl.replace(/\/+$/, "")}/wallet`;
  const locked = acting || !!job;

  const pollUntilSettled = async (jobId: string) => {
    for (let i = 0; i < 90; i += 1) {
      const row = await client.getAgentCreateJob(jobId);
      setJob(row);
      if (row.status === "ready" && row.agent_id) {
        onReady(row.agent_id);
        return;
      }
      if (row.status === "failed") {
        setError(row.error || t.createAgentFailed);
        return;
      }
      await sleep(2000);
    }
    setError(t.createAgentSlow);
  };

  const submit = async () => {
    if (acting || busy || job) return;
    setError(null);
    setActing(true);
    try {
      const created = await client.createAgentJob({
        name: name.trim(),
        tier_id: tierId as "starter" | "standard",
        key_product_id: keyProductId,
        runtime,
      });
      setJob(created);
      if (created.status === "ready" && created.agent_id) {
        onReady(created.agent_id);
        return;
      }
      await pollUntilSettled(created.job_id);
    } catch (e) {
      if (e instanceof ChatGatewayError && e.status === 402) {
        setError(t.createAgentNeedCredits);
        if (e.jobId) {
          setJob({ job_id: e.jobId, status: "pending_payment" });
        }
      } else if (e instanceof ChatGatewayError) {
        setError(e.message || t.createAgentFailed);
      } else {
        setError(t.createAgentFailed);
      }
    } finally {
      setActing(false);
    }
  };

  const retryPay = async () => {
    if (!job?.job_id || acting) return;
    setError(null);
    setActing(true);
    try {
      const paid = await client.payAgentCreateJob(job.job_id);
      setJob(paid);
      await pollUntilSettled(paid.job_id);
    } catch (e) {
      if (e instanceof ChatGatewayError && e.status === 402) {
        setError(t.createAgentNeedCredits);
      } else if (e instanceof ChatGatewayError && e.status === 410) {
        setError(t.createAgentOrderExpired);
      } else {
        setError(t.createAgentFailed);
      }
    } finally {
      setActing(false);
    }
  };

  const retryBind = async () => {
    if (!job?.job_id || acting) return;
    setError(null);
    setActing(true);
    try {
      const bound = await client.retryBindAgentCreateJob(job.job_id);
      setJob(bound);
      if (bound.status === "ready" && bound.agent_id) {
        onReady(bound.agent_id);
        return;
      }
      await pollUntilSettled(bound.job_id);
    } catch {
      setError(t.createAgentFailed);
    } finally {
      setActing(false);
    }
  };

  return (
    <div style={overlay} role="dialog" aria-label={t.createAgentTitle}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <strong style={{ flex: 1, fontSize: 16 }}>{t.createAgentTitle}</strong>
          <button type="button" style={btnGhost} onClick={onClose}>
            {t.close}
          </button>
        </div>
        {loading ? (
          <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>
        ) : !avail?.available ? (
          <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.55 }}>
            {t.createAgentUnavailable}
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.muted, lineHeight: 1.55 }}>
              {t.createAgentBlurb}
            </p>
            <label style={label}>
              {t.createAgentName}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={locked}
                style={input}
                maxLength={100}
              />
            </label>
            <div style={{ margin: "12px 0 8px" }}>
              <div style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}>
                {t.createAgentServerSection}
              </div>
              {machines.map((row) => (
                <label
                  key={row.tier_id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    marginBottom: 8,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="radio"
                    name="tier"
                    checked={tierId === row.tier_id}
                    disabled={locked}
                    onChange={() => setTierId(row.tier_id)}
                  />
                  <span>
                    <strong>
                      {row.tier_id === "standard" ? t.createAgentStandard : t.createAgentStarter}
                    </strong>
                    <span style={{ color: colors.muted }}> · {row.machine_credits} credits</span>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ margin: "8px 0 12px" }}>
              <div style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}>
                {t.createAgentRuntimeSection}
              </div>
              {(["hermes", "openclaw"] as const).map((id) => (
                <label
                  key={id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    marginBottom: 8,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="radio"
                    name="runtime"
                    checked={runtime === id}
                    disabled={locked}
                    onChange={() => setRuntime(id)}
                  />
                  <span>
                    <strong>
                      {id === "openclaw" ? t.createAgentRuntimeOpenclaw : t.createAgentRuntimeHermes}
                    </strong>
                  </span>
                </label>
              ))}
              <div style={{ fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                {avail?.region === "cn" ? t.createAgentRegionCn : t.createAgentRegionSg}
              </div>
            </div>
            <div style={{ margin: "8px 0 12px" }}>
              <div style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}>
                {t.createAgentKeySection}
              </div>
              {keys.map((row) => (
                <label
                  key={row.product_id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    marginBottom: 8,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="radio"
                    name="key"
                    checked={keyProductId === row.product_id}
                    disabled={locked}
                    onChange={() => setKeyProductId(row.product_id)}
                  />
                  <span>
                    <strong>
                      {row.or_usd_limit != null
                        ? t.createAgentKeyUsd.replace("{usd}", String(row.or_usd_limit))
                        : row.product_id}
                    </strong>
                    <span style={{ color: colors.muted }}>
                      {" "}
                      · {row.key_quota_credits} + {row.key_fee_credits} ({feePercent(row)}%) ·{" "}
                      {row.key_credits}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {machine && key ? (
              <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12, color: colors.muted }}>
                <li>
                  {t.createAgentMachineLine.replace("{n}", String(machine.machine_credits))}
                </li>
                <li>
                  {t.createAgentKeyQuotaLine.replace("{n}", String(key.key_quota_credits))}
                </li>
                <li>
                  {t.createAgentKeyFeeLine
                    .replace("{n}", String(key.key_fee_credits))
                    .replace("{pct}", String(feePercent(key)))}
                </li>
                <li>{t.createAgentTotalLine.replace("{n}", String(totalCredits))}</li>
              </ul>
            ) : null}
            {job ? (
              <p style={{ fontSize: 12, color: colors.muted }}>
                {job.status === "pending_payment"
                  ? t.createAgentPendingPay
                  : job.status === "ready"
                    ? t.createAgentReady
                    : t.createAgentProgress}
              </p>
            ) : null}
            {error ? (
              <p style={{ color: colors.danger, fontSize: 12, lineHeight: 1.5 }}>{error}</p>
            ) : null}
            {job?.status === "pending_payment" ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={rechargeUrl} target="_blank" rel="noopener noreferrer" style={btnPrimary}>
                  {t.createAgentRecharge}
                </a>
                <button type="button" style={btnGhost} disabled={acting} onClick={() => void retryPay()}>
                  {t.createAgentRetryPay}
                </button>
                <button
                  type="button"
                  style={btnGhost}
                  disabled={acting}
                  onClick={() => {
                    setJob(null);
                    setError(null);
                  }}
                >
                  {t.createAgentStartOver}
                </button>
              </div>
            ) : job?.status === "failed" ? (
              <button
                type="button"
                style={{ ...btnPrimary, width: "100%" }}
                disabled={acting}
                onClick={() => void retryBind()}
              >
                {acting ? t.createAgentWorking : t.createAgentRetryBind}
              </button>
            ) : job ? null : (
              <button
                type="button"
                style={{ ...btnPrimary, width: "100%" }}
                disabled={acting || busy || name.trim().length < 2 || !machine || !key}
                onClick={() => void submit()}
              >
                {acting ? t.createAgentWorking : t.createAgentSubmit}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(460px, 100%)",
  maxHeight: "min(90vh, 720px)",
  overflow: "auto",
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: 16,
  color: colors.text,
};

const label: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  color: colors.muted,
};

const input: CSSProperties = {
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  color: colors.text,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 14,
};
