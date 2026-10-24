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

/** Name after the provider prefix. A dated id does not match the undated one. */
export function priceTail(modelId: string | null | undefined): string {
  let text = (modelId || "").trim().toLowerCase();
  if (text.startsWith("~")) text = text.slice(1);
  const colon = text.indexOf(":");
  if (colon >= 0) text = text.slice(0, colon);
  const slash = text.lastIndexOf("/");
  return slash >= 0 ? text.slice(slash + 1) : text;
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

/** Price-book rows whose name matches a model this agent reported. */
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
 * Models to show. Several name matches stay on those rows.
 * One current model does not hide the rest of a priced card.
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

/**
 * The id to send. The menu may hold the price-book row.
 * The agent runs its own id. A row with no matching report stays as it is.
 */
export function agentModelIdForSend(
  selected: string | null | undefined,
  reported: Array<string | null | undefined>,
): string | null {
  const picked = (selected || "").trim();
  if (!picked) return null;
  const ids = dedupe(reported);
  const exact = ids.find((id) => sameExactId(id, picked));
  if (exact) return exact;
  const tail = priceTail(picked);
  const sameName = tail ? ids.filter((id) => priceTail(id) === tail) : [];
  return sameName[0] || picked;
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

/** TokenPlan / other BYO leftovers must not pin an official-shelf menu. */
function isByoProviderVendor(vendor: string): boolean {
  return vendor === "tencenttokenplan";
}

/**
 * Select on the Host official shelf when the agent declared no providers.
 * Ignore BYO ``preferred_model`` / runtime; prefer the Host official default.
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
    if (isByoProviderVendor(modelVendor(raw))) return null;
    const exact = menu.find((id) => sameExactId(id, raw));
    if (exact) return exact;
    // Bare id may match a shelf row; prefixed non-BYO must be exact (no cross-vendor).
    if (modelVendor(raw)) return null;
    const tail = priceTail(raw);
    if (!tail) return null;
    return menu.find((id) => priceTail(id) === tail) || null;
  };

  return onShelf(args.stored) || onShelf(args.officialDefault) || menu[0] || null;
}
