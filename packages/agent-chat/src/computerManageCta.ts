/** Empty list creates the default. A list that already has a computer opens an extra. */
export function computerManageCta(count: number): "create" | "extra" {
  return count > 0 ? "extra" : "create";
}
