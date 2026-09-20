import { ChatGatewayError, type AgentCreateJob, type GatewayClient } from "../gateway";

/** Hosted create can take well past a few minutes (AM provision + ACN join). */
export const CREATE_JOB_POLL_MAX_MS = 3 * 60 * 60 * 1000;
const FAST_INTERVAL_MS = 2_000;
const SLOW_INTERVAL_MS = 5_000;
const FAST_FOR_MS = 120_000;

export const PENDING_CREATE_JOB_STORAGE_KEY = "interfaze.pendingAgentCreateJobId";

export function createJobPollInterval(elapsedMs: number): number {
  return elapsedMs < FAST_FOR_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readPendingCreateJobId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PENDING_CREATE_JOB_STORAGE_KEY);
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export function writePendingCreateJobId(jobId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (jobId) sessionStorage.setItem(PENDING_CREATE_JOB_STORAGE_KEY, jobId);
    else sessionStorage.removeItem(PENDING_CREATE_JOB_STORAGE_KEY);
  } catch {
    /* private mode / quota */
  }
}

export async function watchAgentCreateJob(
  client: GatewayClient,
  jobId: string,
  opts: {
    onUpdate?: (row: AgentCreateJob) => void;
    shouldStop?: () => boolean;
    stopOn?: (row: AgentCreateJob) => boolean;
    maxMs?: number;
  } = {},
): Promise<AgentCreateJob | null> {
  const started = Date.now();
  const maxMs = opts.maxMs ?? CREATE_JOB_POLL_MAX_MS;
  const stopOn =
    opts.stopOn ??
    ((row: AgentCreateJob) => row.status === "ready" || row.status === "failed");

  while (!opts.shouldStop?.() && Date.now() - started < maxMs) {
    try {
      const row = await client.getAgentCreateJob(jobId);
      opts.onUpdate?.(row);
      if (stopOn(row)) return row;
    } catch (e) {
      if (e instanceof ChatGatewayError && (e.status === 404 || e.status === 410)) {
        throw e;
      }
      /* transient gateway errors — keep waiting */
    }
    await sleep(createJobPollInterval(Date.now() - started));
  }
  return null;
}
