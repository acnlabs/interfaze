import { officialShelfAllows } from "./officialV0";

/** OpenRouter-style ``vendor/model``; empty if the id is bare. */
export function modelVendorId(modelId: string | null | undefined): string {
  const s = (modelId || "").trim();
  const slash = s.indexOf("/");
  return slash > 0 ? s.slice(0, slash) : "";
}

function dedupe(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = (raw || "").trim();
    if (!id) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

function bareModelId(modelId: string): string {
  const slash = modelId.lastIndexOf("/");
  return (slash >= 0 ? modelId.slice(slash + 1) : modelId).trim().toLowerCase();
}

/** A live catalog row matches a model this agent reported, including ids that contain a slash. */
function catalogListsReported(reportedId: string, liveId: string): boolean {
  const reported = reportedId.trim().toLowerCase();
  const live = liveId.trim().toLowerCase();
  if (!reported || !live) return false;
  if (reported === live || reported.endsWith(`/${live}`)) return true;
  return !live.includes("/") && bareModelId(reported) === live;
}

function sameOfferedModel(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes("/") && b.includes("/")) return false;
  return bareModelId(a) === bareModelId(b);
}

function sameExactId(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return !!a && a === b;
}

/** Shelf-safe default when the person's own models have no price. */
const OFFICIAL_PRICED_DEFAULT = "deepseek/deepseek-chat";

function priceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function modelOptionHasPrice(option: {
  priceable?: boolean;
  free?: boolean;
  input_price_per_million?: number;
  output_price_per_million?: number;
} | null | undefined): boolean {
  if (!option || option.priceable === false) return false;
  if (option.free) return true;
  return (
    priceNumber(option.input_price_per_million) != null ||
    priceNumber(option.output_price_per_million) != null
  );
}

export type ModelPriceOption = {
  model_id: string;
  priceable?: boolean;
  free?: boolean;
  input_price_per_million?: number;
  output_price_per_million?: number;
};

/** Name after the provider prefix, so a provider id can meet its price-book row. */
export function priceTail(modelId: string | null | undefined): string {
  let text = (modelId || "").trim().toLowerCase();
  if (text.startsWith("~")) text = text.slice(1);
  const colon = text.indexOf(":");
  if (colon >= 0) text = text.slice(0, colon);
  const slash = text.lastIndexOf("/");
  return slash >= 0 ? text.slice(slash + 1) : text;
}

/**
 * Price-book rows for models this agent reported.
 * The book names the row (`moonshotai/kimi-k2.5`); the agent names its provider
 * (`tencenttokenplan/kimi-k2.5`). A different model on the official card is not included.
 */
export function agentProviderPricedIds(
  reported: Array<string | null | undefined>,
  modelOptions: ModelPriceOption[],
): string[] {
  const tails = new Set(dedupe(reported).map(priceTail).filter(Boolean));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of modelOptions) {
    if (!modelOptionHasPrice(row)) continue;
    const id = row.model_id.trim();
    const tail = priceTail(id);
    if (!id || !tail || !tails.has(tail)) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/**
 * Models to show. Name-matched rows win when several of the agent's models
 * hit the book. A single current model does not hide the rest of the priced card.
 */
export function composerPricedMenuIds(
  reported: Array<string | null | undefined>,
  modelOptions: ModelPriceOption[],
): string[] {
  const matched = agentProviderPricedIds(reported, modelOptions);
  const priced: string[] = [];
  const seen = new Set<string>();
  for (const row of modelOptions) {
    if (!modelOptionHasPrice(row)) continue;
    const id = row.model_id.trim();
    const key = id.toLowerCase();
    if (!id || seen.has(key)) continue;
    seen.add(key);
    priced.push(id);
  }
  if (matched.length > 1) return matched;
  if (priced.length > matched.length) return priced;
  return matched;
}

/** Book row for this id, matching the model name after the provider prefix. */
export function pricedOptionForId(
  id: string | null | undefined,
  modelOptions: ModelPriceOption[],
): ModelPriceOption | null {
  const exact = modelOptions.find(
    (row) => sameExactId(row.model_id, id || "") && modelOptionHasPrice(row),
  );
  if (exact) return exact;
  const tail = priceTail(id);
  if (!tail) return null;
  return (
    modelOptions.find(
      (row) => priceTail(row.model_id) === tail && modelOptionHasPrice(row),
    ) ?? null
  );
}

/** Own-provider ids the price book did not price. */
export function unpricedOwnModelIds(
  reported: Array<string | null | undefined>,
  modelOptions: ModelPriceOption[],
): string[] {
  const pricedTails = new Set(
    modelOptions
      .filter((row) => modelOptionHasPrice(row))
      .map((row) => priceTail(row.model_id))
      .filter(Boolean),
  );
  return dedupe(reported).filter((id) => !pricedTails.has(priceTail(id)));
}

/**
 * The menu the person sees is the agent's provider models the price book priced.
 * The OpenRouter shelf is only loaded when that provider has no priced model.
 */
export function composerCatalogForOffer(args: {
  reportedIds: Array<string | null | undefined>;
  modelOptions: ModelPriceOption[];
  catalogIds: string[];
}): string[] {
  if (agentProviderPricedIds(args.reportedIds, args.modelOptions).length) return [];
  if (args.modelOptions.some((row) => modelOptionHasPrice(row))) return [];
  return args.catalogIds;
}

/** Reported ids that already have a price, either on the option or the live catalog row. */
export function pricedReportedIds(
  reported: Array<string | null | undefined>,
  modelOptions: Array<{
    model_id: string;
    priceable?: boolean;
    free?: boolean;
    input_price_per_million?: number;
    output_price_per_million?: number;
  }>,
  catalogIds: string[] = [],
): string[] {
  return dedupe(reported).filter((id) => {
    const option = modelOptions.find((row) => sameExactId(row.model_id, id));
    if (option?.priceable === false) return false;
    if (modelOptionHasPrice(option)) return true;
    return catalogIds.some((live) => sameExactId(live, id));
  });
}

function preferOfficialDefault(ids: string[]): string[] {
  const index = ids.findIndex((id) => sameExactId(id, OFFICIAL_PRICED_DEFAULT));
  if (index <= 0) return ids;
  const next = ids.slice();
  const [picked] = next.splice(index, 1);
  if (!picked) return ids;
  next.unshift(picked);
  return next;
}

function withoutRefused(ids: string[], refused: string[] | undefined): string[] {
  if (!refused?.length) return ids;
  return ids.filter((id) => !refused.some((blocked) => sameOfferedModel(id, blocked)));
}

/**
 * Model names a provider refusal names, so the menu can drop them.
 * Matches TokenHub's "not authorized to access model kimi-k2.5".
 */
export function refusedModelNames(text: string | null | undefined): string[] {
  const raw = text || "";
  const found: string[] = [];
  const patterns = [
    /not authorized to access model\s+([A-Za-z0-9._:-]+)/gi,
    /model\s+([A-Za-z0-9._:/-]+)\s+is not authorized/gi,
    /^([A-Za-z0-9._:/-]+)\s+was refused\b/gim,
  ];
  for (const pattern of patterns) {
    for (const match of raw.matchAll(pattern)) {
      const name = (match[1] || "").trim().replace(/\.+$/, "");
      if (name) found.push(name);
    }
  }
  return dedupe(found);
}

/**
 * Models the composer may offer.
 * Official pay-as-you-go: ids this Host key is authorized to complete.
 * The agent's own key: what that provider sells right now, when we have just
 * asked. A missing live list keeps the agent's report so the menu is not blank
 * before the ask returns. A refusal drops that model either way.
 */
export function composerMenuIds(args: {
  official: boolean;
  listed: string | null | undefined;
  supported: string[];
  officialIds: string[];
  keyGeo: string | null | undefined;
  /** Ids the provider returned on this ask. Bare or prefixed. */
  liveIds?: string[] | null;
  /** Vendor prefix for a bare live id, e.g. tencenttokenplan. */
  vendor?: string | null;
  refusedIds?: string[];
}): string[] {
  if (args.official) {
    const allowed = args.officialIds.filter((id) => officialShelfAllows(id, args.keyGeo));
    const listed = (args.listed || "").trim();
    const withListed =
      listed && allowed.some((id) => id.toLowerCase() === listed.toLowerCase())
        ? [listed, ...allowed]
        : allowed;
    const current =
      args.liveIds == null
        ? withListed
        : withListed.filter((id) => args.liveIds!.some((live) => sameOfferedModel(id, live)));
    return withoutRefused(dedupe(current), args.refusedIds);
  }
  if (args.liveIds != null) {
    const vendor = (args.vendor || "").trim().toLowerCase();
    const reported = dedupe([args.listed, ...args.supported]).filter((id) => {
      if (!vendor) return true;
      return modelVendorId(id).toLowerCase() === vendor;
    });
    const kept = reported.filter((id) =>
      args.liveIds!.some((live) => catalogListsReported(id, live)),
    );
    return withoutRefused(dedupe(kept), args.refusedIds);
  }
  return withoutRefused(dedupe(args.supported), args.refusedIds);
}

/**
 * Vendors whose menu is still the last report.
 * A live catalog already checked this provider. A provider marked down is skipped.
 * Everyone else needs the agent to report again.
 */
export function vendorsNeedingReport(
  vendors: string[],
  live: Record<string, LiveCatalog | null | undefined> | null | undefined,
): string[] {
  const asked = live || {};
  return vendors.filter((vendor) => {
    const row = asked[vendor] ?? asked[vendor.toLowerCase()];
    if (row === "down") return false;
    return !(Array.isArray(row) && row.length > 0 && catalogKind(vendor) !== "reported");
  });
}

/**
 * The menu is the agent's report. Asking a provider is that agent's job,
 * so the shell does not keep a per-vendor catalog.
 */
export function catalogKind(_vendor: string | null | undefined): "tokenhub" | "openrouter" | "reported" {
  return "reported";
}

/** Runtime provider first, then the listing, then the rest of the report. */
export function vendorOrder(
  runtime: string | null | undefined,
  listed: string | null | undefined,
  supported: string[],
): string[] {
  const out: string[] = [];
  const push = (id: string | null | undefined) => {
    const vendor = modelVendorId(id);
    if (!vendor) return;
    if (out.some((item) => item.toLowerCase() === vendor.toLowerCase())) return;
    out.push(vendor);
  };
  push(runtime);
  push(listed);
  for (const id of supported) push(id);
  return out;
}

/** A provider-wide failure, not one model missing from the key. */
export function providerDownFromText(text: string | null | undefined): boolean {
  return /api key does not exist|signature verification failed|api key is disabled|provider_rejected|provider_unreachable/i.test(
    text || "",
  );
}

/**
 * Only the latest agent reply can take a provider out.
 * An older sentence, or the same sentence in a human message, does not.
 */
export function providerDownFromMessages(
  messages: Array<{ sender_type?: string | null; content?: string | null }>,
): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const sender = (messages[i]?.sender_type || "").trim().toLowerCase();
    if (sender !== "agent") continue;
    return providerDownFromText(messages[i]?.content);
  }
  return false;
}

export type LiveCatalog = string[] | "down";

/** OpenRouter's current catalog fills an openrouter vendor. Other asks stay as given. */
export function liveWithOpenRouter(
  live: Record<string, LiveCatalog | null | undefined>,
  vendors: string[],
  openRouterIds: string[],
): Record<string, LiveCatalog | null | undefined> {
  if (!openRouterIds.length) return live;
  const next = { ...live };
  for (const vendor of vendors) {
    if (catalogKind(vendor) === "openrouter") next[vendor] = openRouterIds;
  }
  return next;
}

function reportedForVendor(ids: string[], vendor: string): string[] {
  const v = vendor.toLowerCase();
  return ids.filter((id) => modelVendorId(id).toLowerCase() === v);
}

/**
 * One path for every agent. Check the provider it reported, drop a refused
 * model, skip a provider that is down, and use the official list last.
 */
export function resolveComposerOffer(args: {
  listed: string | null | undefined;
  runtime: string | null | undefined;
  supported: string[];
  officialIds: string[];
  keyGeo: string | null | undefined;
  live?: Record<string, LiveCatalog | null | undefined>;
  refusedIds?: string[];
}): { official: boolean; vendor: string; ids: string[] } {
  const reported = dedupe([args.runtime, args.listed, ...args.supported]);
  const live = args.live || {};
  for (const vendor of vendorOrder(args.runtime, args.listed, args.supported)) {
    const asked = live[vendor] ?? live[vendor.toLowerCase()];
    if (asked === "down") continue;
    const reportedIds = reportedForVendor(reported, vendor);
    const catalog = Array.isArray(asked) && asked.length > 0 ? asked : null;
    const ids =
      catalog == null || catalogKind(vendor) === "reported"
        ? reportedIds
        : reportedIds.filter((id) => catalog.some((live) => catalogListsReported(id, live)));
    const usable = withoutRefused(dedupe(ids), args.refusedIds);
    if (usable.length) return { official: false, vendor, ids: usable };
  }
  const officialIds = composerMenuIds({
    official: true,
    listed: args.listed,
    supported: args.supported,
    officialIds: args.officialIds,
    keyGeo: args.keyGeo,
    refusedIds: args.refusedIds,
  });
  if (officialIds.length) return { official: true, vendor: "OpenRouter", ids: officialIds };
  return { official: false, vendor: "", ids: [] };
}

/**
 * Own-provider models with no price cannot be sent. Keep a priced own-provider
 * model on that key. When none are priced, offer official shelf models that are.
 */
export function choosePricedComposer(args: {
  listed: string | null | undefined;
  runtime: string | null | undefined;
  supported: string[];
  officialIds: string[];
  keyGeo: string | null | undefined;
  live?: Record<string, LiveCatalog | null | undefined>;
  refusedIds?: string[];
  pricedOwnIds: string[];
  officialPricedIds: string[];
}): { official: boolean; vendor: string; ids: string[] } {
  const offer = resolveComposerOffer(args);
  if (!offer.official) {
    const own = offer.ids.filter((id) =>
      args.pricedOwnIds.some((priced) => sameExactId(priced, id)),
    );
    if (own.length) return { official: false, vendor: offer.vendor, ids: own };
  }
  const catalog = dedupe(
    (args.officialPricedIds || []).filter((id) => officialShelfAllows(id, args.keyGeo)),
  );
  if (offer.official && offer.ids.length) {
    if (!catalog.length) return offer;
    const priced = offer.ids.filter((id) => catalog.some((row) => sameExactId(row, id)));
    if (priced.length) return { official: true, vendor: "OpenRouter", ids: priced };
  }
  if (catalog.length) {
    return { official: true, vendor: "OpenRouter", ids: preferOfficialDefault(catalog) };
  }
  if (offer.official) return offer;
  return { official: false, vendor: offer.vendor, ids: [] };
}

/** Name of the provider this send will call. */
export function composerProviderName(
  modelId: string | null | undefined,
  official: boolean,
): string {
  if (official) return "OpenRouter";
  return modelVendorId(modelId);
}
