/**
 * CN Interfaze wallet recharge — WeChat Native QR via BFF (same rail as AgentPlanet).
 */
import { getBffBaseUrl } from "@/lib/bff";
import { getCnSessionToken } from "@/lib/auth/cn";

export class WalletApiError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "WalletApiError";
    this.status = status;
    this.data = data;
  }
}

export interface RechargePackage {
  id: string;
  label: string;
  credits: number;
  price_cents: number;
  price_yuan: number;
  face_yuan?: number;
  fee_yuan?: number;
}

export interface RechargeCreateResponse {
  order_id: string;
  credits: number;
  amount_cents: number;
  channel: "wxpay" | "xpay";
  payment?: {
    channel: "jsapi" | "h5" | "native";
    mweb_url?: string;
    code_url?: string;
  };
  detail?: string;
}

export interface RechargeSyncResponse {
  paid: boolean;
  balance: number | null;
}

function authHeaders(): HeadersInit {
  const token = getCnSessionToken();
  if (!token) throw new WalletApiError(401, "未登录");
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
  throw new WalletApiError(res.status, msg || `HTTP ${res.status}`, data);
}

export async function listRechargePackages(
  channel: "wxpay" | "xpay" = "wxpay",
): Promise<RechargePackage[]> {
  const res = await fetch(
    `${getBffBaseUrl()}/api/wallet/recharge/packages?channel=${channel}`,
  );
  if (!res.ok) await parseError(res);
  const data = (await res.json()) as { packages: RechargePackage[] };
  return data.packages || [];
}

export async function createRecharge(packageId: string): Promise<RechargeCreateResponse> {
  const res = await fetch(`${getBffBaseUrl()}/api/wallet/recharge/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ package_id: packageId, channel: "wxpay" }),
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<RechargeCreateResponse>;
}

export async function syncRechargePayment(orderId: string): Promise<RechargeSyncResponse> {
  const res = await fetch(
    `${getBffBaseUrl()}/api/wallet/recharge/${encodeURIComponent(orderId)}/sync-payment`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );
  if (!res.ok) await parseError(res);
  return res.json() as Promise<RechargeSyncResponse>;
}

export type WxpayRechargeStart =
  | { kind: "paid"; balance: number }
  | { kind: "h5" }
  | { kind: "native"; orderId: string; codeUrl: string };

export async function startWxpayRecharge(packageId: string): Promise<WxpayRechargeStart> {
  const created = await createRecharge(packageId);
  if (!created.payment) {
    throw new Error(created.detail ?? "微信支付未配置");
  }
  if (created.payment.channel === "native" && created.payment.code_url) {
    return { kind: "native", orderId: created.order_id, codeUrl: created.payment.code_url };
  }
  if (created.payment.channel === "h5" && created.payment.mweb_url) {
    window.location.href = created.payment.mweb_url;
    return { kind: "h5" };
  }
  throw new Error("当前环境不支持此支付方式，请用微信扫码或在网页完成。");
}
