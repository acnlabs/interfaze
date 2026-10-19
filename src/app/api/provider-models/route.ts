import { NextResponse } from "next/server";

const TOKENHUB_MODELS_URL = "https://tokenhub.tencentmaas.com/v1/models";

type CatalogRow = { id?: unknown; status?: unknown };

async function tokenHubModels(): Promise<string[]> {
  const key = process.env.TOKENHUB_API_KEY?.trim();
  if (!key) {
    throw Object.assign(new Error("provider_key_missing"), { status: 503 });
  }
  let response: Response;
  try {
    response = await fetch(TOKENHUB_MODELS_URL, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  } catch {
    throw Object.assign(new Error("provider_unreachable"), { status: 502 });
  }
  if (!response.ok) {
    throw Object.assign(new Error("provider_rejected"), { status: 502 });
  }
  const body = (await response.json()) as { data?: unknown };
  const rows = Array.isArray(body.data) ? body.data : [];
  return rows
    .filter((row): row is CatalogRow => !!row && typeof row === "object")
    .filter((row) => String(row.status || "online").toLowerCase() !== "offline")
    .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
    .filter(Boolean);
}

/** One ask per provider. The caller's provider name picks the adapter. */
const ASKS: Record<string, () => Promise<string[]>> = {
  tencenttokenplan: tokenHubModels,
};

async function callerCanSeeAgent(request: Request, agentId: string): Promise<boolean> {
  const auth = request.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ") || auth.trim().length < 16) return false;
  const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || "").replace(/\/+$/, "");
  if (!gateway || !agentId) return false;
  try {
    const who = await fetch(
      `${gateway}/api/chat/agents/${encodeURIComponent(agentId)}/model-status`,
      { headers: { Authorization: auth }, cache: "no-store" },
    );
    return who.ok;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agent")?.trim() || "";
  if (!(await callerCanSeeAgent(request, agentId))) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const provider = url.searchParams.get("provider")?.trim().toLowerCase() || "";
  const ask = ASKS[provider];
  if (!ask) {
    return NextResponse.json({ error: "provider_ask_unknown" }, { status: 404 });
  }
  try {
    return NextResponse.json({ ids: await ask() });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number(err.status) : 502;
    return NextResponse.json(
      { error: "provider_rejected" },
      { status: Number.isFinite(status) ? status : 502 },
    );
  }
}
