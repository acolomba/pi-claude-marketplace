// presentation/sort.ts
//
// MSG-GR-3 single per-scope sort comparator. Per the locked v1.3 messaging
// style guide §7 (Per-Scope Rendering) the canonical row order across every
// list-rendering surface (marketplace list, plugin list, plugin folding,
// cascade summaries) is:
//   1. name primary, case-insensitive (`localeCompare` with
//      `sensitivity: 'base'`)
//   2. scope secondary as a tie-breaker -- project before user
//
// This module is the SINGLE source of that policy. Wave 2 sub-waves (mp list,
// plugin list, import / update / reinstall cascades) consume this helper
// directly; D-13-15 places it here as a single-purpose pure-helper file per
// the Phase 12 precedent (`reload-hint.ts` and `soft-dep.ts` are single-
// purpose modules) and per D-13-15's recommendation in the phase pattern map.
//
// D-13-15 / MSG-GR-3 lock notes:
//   - The comparator accepts a STRUCTURAL minimum
//     `{ readonly name: string; readonly scope: "user" | "project" }` so it
//     can sort `MarketplaceRow`, `PluginListRow`, `PluginCascadeRow`, or any
//     future row type that carries these two fields without requiring an
//     adapter.
//   - `sensitivity: 'base'` treats "Alpha", "alpha", and "ALPHA" as equal --
//     accent differences are folded as well (matching the style guide's
//     "case-insensitive" wording, which under the JS spec maps to base
//     sensitivity).
//   - The scope tie-breaker uses a strict ternary -- mapping project to -1
//     and user to +1 -- so the canonical "project before user" ordering
//     holds for every same-name pair. When `a.scope === b.scope` the result
//     is 0, leaving Array.prototype.sort's stability guarantee to preserve
//     caller-side ordering.
//   - No imports from anywhere else in the codebase (pure helper; closed
//     under MSG-GR-3 only). The comparator never throws.

interface Sortable {
  readonly name: string;
  readonly scope: "user" | "project";
}

export function compareByNameThenScope(a: Sortable, b: Sortable): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (byName !== 0) {
    return byName;
  }

  // Tie-breaker: project before user per MSG-GR-3.
  if (a.scope === b.scope) {
    return 0;
  }

  return a.scope === "project" ? -1 : 1;
}
