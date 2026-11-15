import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOSTS = {
  global: "https://api.acnlabs.dev",
  cn: "https://acn.acnlabs.cn",
} as const;

const NOISE = /smoke|probe|e2e|gws-curl|experiment/i;

type RawSubnet = {
  slug?: string;
  name?: string;
  description?: string | null;
};

async function getJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request): Promise<Response> {
  const region = new URL(request.url).searchParams.get("region") === "cn" ? "cn" : "global";
  const host = HOSTS[region];
  const body = await getJson(`${host}/api/v1/subnets?limit=100`);
  const rows = Array.isArray((body as { subnets?: unknown } | null)?.subnets)
    ? (body as { subnets: RawSubnet[] }).subnets
    : [];
  const picked = rows
    .map((row) => ({
      slug: (row.slug || "").trim(),
      name: (row.name || "").trim(),
      description: (row.description || "").replace(/\s+/g, " ").trim(),
    }))
    .filter(
      (row) =>
        row.slug &&
        row.name &&
        row.description &&
        !row.description.startsWith("Org fence") &&
        !NOISE.test(row.slug) &&
        !NOISE.test(row.name),
    );

  const ranked = await Promise.all(
    picked.map(async (row) => {
      const agents = await getJson(
        `${host}/api/v1/agents?subnet=${encodeURIComponent(row.slug)}&status=all&limit=1`,
      );
      const count = Number((agents as { total?: unknown } | null)?.total);
      return { ...row, agents: Number.isFinite(count) ? count : 0 };
    }),
  );
  ranked.sort((a, b) => b.agents - a.agents || a.name.localeCompare(b.name));
  return NextResponse.json({ subnets: ranked.slice(0, 3) });
}
