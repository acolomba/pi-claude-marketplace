/** Structural minimum shared by every per-scope list row. */
export interface Sortable {
  readonly name: string;
  readonly scope: "user" | "project";
}

/**
 * Canonical name-first ordering: case-insensitive name, then project before
 * user. Exact ties return zero so stable sort preserves caller order.
 */
export function compareByNameThenScope(a: Sortable, b: Sortable): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (byName !== 0) {
    return byName;
  }

  if (a.scope === b.scope) {
    return 0;
  }

  return a.scope === "project" ? -1 : 1;
}
