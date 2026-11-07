/** Price-book tail, agent quotes, and the id the agent actually runs. */

export type ModelPriceOption = {
  model_id: string;
  priceable?: boolean;
  free?: boolean;
  input_price_per_million?: number;
  output_price_per_million?: number;
  /** Set when this row is a number the agent reported, not a price-book row. */
  price_from?: string;
};

export type QuotedModelPrice = {
  model_id: string;
  input_price_per_million?: number | string | null;
  output_price_per_million?: number | string | null;
};

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

function priceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sameExactId(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = (left || "").trim().toLowerCase();
  const b = (right || "").trim().toLowerCase();
  return !!a && a === b;
}

/** Last segment, before a date stamp is removed. */
function rawTail(modelId: string | null | undefined): string {
  let text = (modelId || "").trim().toLowerCase();
  if (text.startsWith("~")) text = text.slice(1);
  const colon = text.indexOf(":");
  if (colon >= 0) text = text.slice(0, colon);
  const slash = text.lastIndexOf("/");
  return slash >= 0 ? text.slice(slash + 1) : text;
}

/**
 * Name used to find the price-book row.
 * A compact date stamp (`-202605`) is the provider's spelling of the same model.
 */
export function priceTail(modelId: string | null | undefined): string {
  return rawTail(modelId).replace(/-20\d{4}(?:\d{2})?$/, "");
}

/** Batch rows and ``~`` aliases are not a price of their own (backend `catalog_price_alias`). */
export function catalogPriceAlias(modelId: string | null | undefined): boolean {
  const text = (modelId || "").trim().toLowerCase();
  return text.startsWith("~") || text.includes(":");
}

export type BookCatalogRow = {
  id: string;
  in: number;
  out: number;
  source?: string;
  currency?: string;
};

/**
 * Unique price-book row for a model id's last segment.
 * Mirrors backend `_catalog_pricing`: zero or several hits do not price.
 * Callers must pass the configured price book only.
 */
export function uniqueBookCatalogPair(
  modelId: string | null | undefined,
  book: BookCatalogRow[],
): BookCatalogRow | null {
  const tail = priceTail(modelId);
  if (!tail) return null;
  const hits = book.filter(
    (row) => !catalogPriceAlias(row.id) && priceTail(row.id) === tail,
  );
  if (hits.length !== 1) return null;
  return hits[0] ?? null;
}

export function modelOptionHasPrice(
  option: {
    priceable?: boolean;
    free?: boolean;
    input_price_per_million?: number;
    output_price_per_million?: number;
  } | null | undefined,
): boolean {
  if (!option || option.priceable === false) return false;
  if (option.free) return true;
  return (
    priceNumber(option.input_price_per_million) != null ||
    priceNumber(option.output_price_per_million) != null
  );
}

/**
 * Provider-reported ids that already have a price (book or agent quote).
 * The menu lists these ids — never the price-book row name alone.
 */
export function agentProviderPricedIds(
  reported: Array<string | null | undefined>,
  modelOptions: ModelPriceOption[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of dedupe(reported)) {
    if (!pricedOptionForId(id, modelOptions)) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/**
 * Models to show on a BYO card: only this agent's priced provider ids.
 * Price-book rows supply the rate via ``pricedOptionForId``; they are not menu ids.
 */
export function composerPricedMenuIds(
  reported: Array<string | null | undefined>,
  modelOptions: ModelPriceOption[],
): string[] {
  return agentProviderPricedIds(reported, modelOptions);
}

/**
 * The id to send. The chip may still hold a price-book spelling; that only finds the rate.
 * The call uses the provider's own id, including a dated spelling of the same name.
 * Prefer the same vendor as the pick, then a dated report, then any same-name report.
 * A pick with no matching report stays as it is.
 */
export function agentModelIdForSend(
  selected: string | null | undefined,
  reported: Array<string | null | undefined>,
): string | null {
  const picked = (selected || "").trim();
  if (!picked) return null;
  const ids = dedupe(reported);
  const tail = priceTail(picked);
  const sameName = tail ? ids.filter((id) => priceTail(id) === tail) : [];
  if (!sameName.length) {
    return ids.find((id) => sameExactId(id, picked)) || picked;
  }
  const vendor = providerVendor(picked);
  const sameVendor = vendor
    ? sameName.filter((id) => providerVendor(id) === vendor)
    : [];
  const pool = sameVendor.length ? sameVendor : sameName;
  // Dated OEM spelling beats a price-book row that happens to be listed too.
  const dated = pool.filter((id) => rawTail(id) !== priceTail(id));
  if (dated.length) return dated[0];
  const exact = pool.find((id) => sameExactId(id, picked));
  if (exact) return exact;
  return pool[0] || picked;
}

function providerVendor(modelId: string | null | undefined): string {
  const text = (modelId || "").trim().toLowerCase();
  const slash = text.indexOf("/");
  return slash > 0 ? text.slice(0, slash) : "";
}

/**
 * A remembered model may stay on the current private chat.
 * The price-book row and this provider's own id for that row both stay.
 * Another provider's id does not stay just because the model name matches.
 */
export function storedModelStillListed(
  selected: string | null | undefined,
  menuIds: readonly string[],
  currentIds: ReadonlyArray<string | null | undefined>,
): boolean {
  const picked = (selected || "").trim();
  if (!picked) return false;
  const current = currentIds.map((id) => (id || "").trim()).filter(Boolean);
  if (
    menuIds.some((id) => sameExactId(id, picked)) ||
    current.some((id) => sameExactId(id, picked))
  ) {
    return true;
  }
  const vendor = providerVendor(picked);
  const tail = priceTail(picked);
  if (!tail || !menuIds.some((id) => priceTail(id) === tail)) return false;
  if (!vendor) return true;
  return current.some((id) => providerVendor(id) === vendor && priceTail(id) === tail);
}

/**
 * The id to send for this private chat.
 * A model still on the current provider stays. A different provider's id
 * is replaced by the current path, and is not sent as itself.
 */
export function modelIdOnCurrentPath(
  selected: string | null | undefined,
  menuIds: readonly string[],
  currentIds: ReadonlyArray<string | null | undefined>,
  fallbackIds: ReadonlyArray<string | null | undefined>,
): string | null {
  if (storedModelStillListed(selected, menuIds, currentIds)) {
    const picked = (selected || "").trim();
    return picked || null;
  }
  const menuKnown = menuIds.some((id) => (id || "").trim());
  const currentKnown = currentIds.some((id) => (id || "").trim());
  if (!menuKnown && !currentKnown) {
    const picked = (selected || "").trim();
    return picked || null;
  }
  for (const id of fallbackIds) {
    const next = (id || "").trim();
    if (next) return next;
  }
  return null;
}

/** Ids that may rename a price-book row back to the agent's own model. */
export function reportedIdsForSend(
  model: {
    runtime_model_id?: string | null;
    listed_model_id?: string | null;
    self_reported_models?: Array<string | null | undefined> | null;
    supported_models?: Array<string | null | undefined> | null;
  } | null | undefined,
): Array<string | null | undefined> {
  if (!model) return [];
  return [
    model.runtime_model_id,
    model.listed_model_id,
    ...(model.self_reported_models ?? []),
    ...(model.supported_models ?? []),
  ];
}

/** Book or quote row for this id, matching the name after the provider prefix. */
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

/** Keep book prices. Add a price the agent just reported for a missing model. */
export function mergeQuotedPrices(
  options: ModelPriceOption[],
  quoted: QuotedModelPrice[] | null | undefined,
): ModelPriceOption[] {
  const next = options.map((row) => ({ ...row }));
  for (const row of quoted || []) {
    const id = (row?.model_id || "").trim();
    const inn = priceNumber(row?.input_price_per_million);
    const out = priceNumber(row?.output_price_per_million);
    if (!id || inn == null || out == null) continue;
    const tail = priceTail(id);
    const index = next.findIndex(
      (item) => sameExactId(item.model_id, id) || (tail && priceTail(item.model_id) === tail),
    );
    if (index >= 0 && modelOptionHasPrice(next[index])) continue;
    const option: ModelPriceOption = {
      model_id: id,
      input_price_per_million: inn,
      output_price_per_million: out,
      priceable: true,
      price_from: "agent",
    };
    if (index >= 0) next[index] = { ...next[index], ...option };
    else next.push(option);
  }
  return next;
}

/** Quotes already on the menu, so a status refresh can put them back. */
export function quotedPricesFromOptions(
  options: ModelPriceOption[] | null | undefined,
): QuotedModelPrice[] {
  const out: QuotedModelPrice[] = [];
  for (const row of options || []) {
    if (row.price_from !== "agent") continue;
    const id = (row.model_id || "").trim();
    const inn = priceNumber(row.input_price_per_million);
    const output = priceNumber(row.output_price_per_million);
    if (!id || inn == null || output == null) continue;
    out.push({
      model_id: id,
      input_price_per_million: inn,
      output_price_per_million: output,
    });
  }
  return out;
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
 * Official shelf ids only when this provider has no priced model.
 * A priced provider does not open the whole catalog.
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

/** True when heartbeat declared at least one provider with models. */
export function hasDeclaredProviderModels(
  providers:
    | Array<{ id?: string; models?: unknown } | null | undefined>
    | null
    | undefined,
): boolean {
  if (!Array.isArray(providers) || !providers.length) return false;
  return providers.some((row) => {
    if (!row || typeof row !== "object") return false;
    const models = row.models;
    return (
      Array.isArray(models) &&
      models.some((m) => typeof m === "string" && m.trim().length > 0)
    );
  });
}

function modelVendor(modelId: string | null | undefined): string {
  const s = (modelId || "").trim();
  const slash = s.indexOf("/");
  return slash > 0 ? s.slice(0, slash).toLowerCase() : "";
}

/**
 * Select on the Host official shelf when the agent declared no providers.
 * Prefixed leftovers (any BYO vendor) must match exactly — never pin via
 * bare-name cross-vendor. Prefer session pin on the shelf, else Host default.
 */
export function pickOfficialShelfSelection(args: {
  menuIds: Array<string | null | undefined>;
  stored: string | null | undefined;
  officialDefault: string | null | undefined;
}): string | null {
  const menu = dedupe(args.menuIds);
  if (!menu.length) return null;

  const onShelf = (wanted: string | null | undefined): string | null => {
    const raw = (wanted || "").trim();
    if (!raw) return null;
    const exact = menu.find((id) => sameExactId(id, raw));
    if (exact) return exact;
    // Prefixed id not on the shelf: do not equate vendors via priceTail.
    if (modelVendor(raw)) return null;
    const tail = priceTail(raw);
    if (!tail) return null;
    return menu.find((id) => priceTail(id) === tail) || null;
  };

  return onShelf(args.stored) || onShelf(args.officialDefault) || menu[0] || null;
}
