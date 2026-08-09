/**
 * CN Interfaze plan WeChat checkout — cash → activate_paid_plan (no Wallet debit).
 */
import { getBffBaseUrl } from "@/lib/bff";
import { getCnSessionToken } from "@/lib/auth/cn";

export class PlanApiError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "PlanApiError";
    this.status = status;
    this.data = data;
  }
}

export interface PlanCheckoutCreateResponse {
  order_id: string;
  plan_code: string;
  amount_cents: number;
  channel: "wxpay";
  payment?: {
    channel: "native" | "miniapp" | "jsapi" | "h5";
    code_url?: string;
  };
  detail?: string;
}

export interface PlanCheckoutSyncResponse {
  paid: boolean;
  status?: string;
  plan_code?: string;
  paid_until?: string | null;
  reason?: string;
  credits_added?: number;
}

export interface PlanCheckoutOrderMeta {
  order_id: string;
  plan_code: string;
  status: string;
  amount_cents: number;
}

const STASH_ORDER = "cn_plan_checkout_order";
const STASH_CODE = "cn_plan_checkout_code";

function normalizePlanCode(code: string): string {
  const c = (code || "").trim().toLowerCase();
  return c === "ultra" ? "max" : c;
}

export function stashPlanCheckout(orderId: string, planCode: string): void {
  try {
    sessionStorage.setItem(STASH_ORDER, orderId);
    sessionStorage.setItem(STASH_CODE, normalizePlanCode(planCode));
  } catch {
    /* ignore */
  }
}

export function clearPlanCheckoutStash(): void {
  try {
    sessionStorage.removeItem(STASH_ORDER);
    sessionStorage.removeItem(STASH_CODE);
  } catch {
    /* ignore */
  }
}

export function getWxplanOrderId(searchParams?: URLSearchParams | null): string | null {
  const id = (searchParams?.get("wxplan") || "").trim();
  return id.startsWith("wp") ? id : null;
}

export function getPendingPlanCheckout(
  searchParams?: URLSearchParams | null,
  expectedPlanCode?: string | null,
): { orderId: string; planCode: string } | null {
  const fromQuery = (searchParams?.get("wxplan") || "").trim();
  let orderId = fromQuery;
  let planCode = "";
  try {
    const stashOrder = sessionStorage.getItem(STASH_ORDER) || "";
    const stashCode = normalizePlanCode(sessionStorage.getItem(STASH_CODE) || "");
    if (!orderId) {
      orderId = stashOrder;
      planCode = stashCode;
    } else if (stashOrder === orderId) {
      planCode = stashCode;
    }
  } catch {
    if (!orderId) orderId = "";
  }
  if (!orderId.startsWith("wp")) return null;
  if (expectedPlanCode) {
    const expected = normalizePlanCode(expectedPlanCode);
    if (!planCode || planCode !== expected) return null;
  }
  return { orderId, planCode };
}

function authHeaders(): HeadersInit {
  const token = getCnSessionToken();
  if (!token) throw new PlanApiError(401, "未登录");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseError(res: Response): Promise<never> {
  const body = await res.text();
  let data: unknown;
  try {
    data = body ? JSON.parse(body) : undefined;
  } catch {
    data = body ? { detail: body } : undefined;
  }
  const msg =
    data && typeof data === "object" && "detail" in data
      ? typeof (data as { detail: unknown }).detail === "string"
        ? String((data as { detail: string }).detail)
        : res.statusText
      : res.statusText;
  throw new PlanApiError(res.status, msg || `HTTP ${res.status}`, data);
}

export type PlanCheckoutGateCode =
  | "already_active"
  | "already_paid"
  | "downgrade_blocked"
  | "status_unavailable";

export interface PlanCheckoutGateError {
  code: PlanCheckoutGateCode;
  message: string;
  orderId?: string;
  planCode?: string;
  paidUntil?: string | null;
}

export function parsePlanCheckoutGate(err: unknown): PlanCheckoutGateError | null {
  if (!(err instanceof PlanApiError) || (err.status !== 409 && err.status !== 503)) {
    return null;
  }
  const data = err.data;
  if (!data || typeof data !== "object") return null;
  const detail = (data as { detail?: unknown }).detail;
  const obj =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : (data as Record<string, unknown>);
  const code = typeof obj.code === "string" ? obj.code : "";
  if (
    code !== "already_active" &&
    code !== "already_paid" &&
    code !== "downgrade_blocked" &&
    code !== "status_unavailable"
  ) {
    return null;
  }
  return {
    code,
    message:
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.detail === "string" && obj.detail) ||
      code,
    orderId: typeof obj.order_id === "string" ? obj.order_id : undefined,
    planCode: typeof obj.plan_code === "string" ? obj.plan_code : undefined,
    paidUntil:
      typeof obj.paid_until === "string" || obj.paid_until === null
        ? (obj.paid_until as string | null)
        : undefined,
  };
}

export async function createPlanCheckout(
  planCode: string,
  opts?: { renew?: boolean },
): Promise<PlanCheckoutCreateResponse> {
  const res = await fetch(`${getBffBaseUrl()}/api/plan/checkout/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      plan_code: planCode,
      channel: "wxpay",
      client: "web",
      renew: Boolean(opts?.renew),
    }),
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<PlanCheckoutCreateResponse>;
}

export async function repayPlanCheckout(
  orderId: string,
  opts?: { renew?: boolean },
): Promise<PlanCheckoutCreateResponse> {
  const q = new URLSearchParams();
  if (opts?.renew) q.set("renew", "1");
  const qs = q.toString() ? `?${q}` : "";
  const res = await fetch(`${getBffBaseUrl()}/api/plan/checkout/${orderId}/repay${qs}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<PlanCheckoutCreateResponse>;
}

export async function syncPlanCheckoutPayment(
  orderId: string,
): Promise<PlanCheckoutSyncResponse> {
  const res = await fetch(`${getBffBaseUrl()}/api/plan/checkout/${orderId}/sync-payment`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<PlanCheckoutSyncResponse>;
}

export async function getPlanCheckoutOrder(orderId: string): Promise<PlanCheckoutOrderMeta> {
  const res = await fetch(`${getBffBaseUrl()}/api/plan/checkout/${orderId}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<PlanCheckoutOrderMeta>;
}

export async function getLatestPlanCheckout(planCode: string): Promise<PlanCheckoutOrderMeta> {
  const q = new URLSearchParams({ plan_code: normalizePlanCode(planCode) });
  const res = await fetch(`${getBffBaseUrl()}/api/plan/checkout/latest?${q}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<PlanCheckoutOrderMeta>;
}

export async function resolvePlanSyncOrderId(
  planCode: string,
  preferredOrderId?: string | null,
): Promise<string> {
  const expected = normalizePlanCode(planCode);
  let preferred: PlanCheckoutOrderMeta | null = null;
  if (preferredOrderId?.startsWith("wp")) {
    try {
      const meta = await getPlanCheckoutOrder(preferredOrderId);
      if (normalizePlanCode(meta.plan_code) === expected) preferred = meta;
    } catch {
      preferred = null;
    }
  }
  try {
    const latest = await getLatestPlanCheckout(expected);
    if (latest.status === "paid") return latest.order_id;
    if (preferred?.status === "paid") return preferred.order_id;
    if (preferred) return preferred.order_id;
    return latest.order_id;
  } catch (err) {
    if (preferred) return preferred.order_id;
    throw err;
  }
}

export async function startPlanNativeCheckout(
  planCode: string,
  existingOrderId?: string | null,
  opts?: { renew?: boolean },
): Promise<{ orderId: string; codeUrl: string; planCode: string }> {
  const created = existingOrderId
    ? await repayPlanCheckout(existingOrderId, { renew: opts?.renew })
    : await createPlanCheckout(planCode, { renew: opts?.renew });
  const codeUrl = created.payment?.code_url;
  if (!codeUrl || created.payment?.channel !== "native") {
    throw new Error(created.detail ?? "未返回扫码支付链接");
  }
  stashPlanCheckout(created.order_id, planCode || created.plan_code);
  return {
    orderId: created.order_id,
    codeUrl,
    planCode: created.plan_code || planCode,
  };
}
