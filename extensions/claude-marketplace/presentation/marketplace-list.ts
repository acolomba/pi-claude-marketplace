// presentation/marketplace-list.ts
//
// ML-1, ML-2, ML-4 list rendering. Pure formatter -- no IO, no ctx.
// ML-3 (no manifest reads) is enforced at the orchestrator layer
// (`list.ts` calls `loadState` only, never `loadMarketplaceManifest`)
// -- this file does not touch IO at all.
//
// Format per PRD §5.1.3 ML-2:
//   <icon> <name> (<source.logical>)[ [autoupdate]]
//
// The icon is `●` (filled circle) per V1 reference. The optional
// `[autoupdate]` suffix follows the parenthesized logical source
// when `record.autoupdate === true`.

import { sourceLogical } from "../domain/source.ts";

import type { ParsedSource } from "../domain/source.ts";

/**
 * D-11 boundary: `presentation/` cannot import from `persistence/`. Define the
 * minimal structural shape this renderer consumes from `MarketplaceRecord`
 * (declared in `persistence/state-io.ts`) here. The persistence-layer type is
 * a structural superset, so callers pass `MarketplaceRecord[]` without casts.
 */
export interface MarketplaceListEntry {
  readonly name: string;
  readonly scope: "user" | "project";
  readonly source: ParsedSource;
  readonly autoupdate?: boolean;
}

const ICON = "●";

/**
 * ML-1, ML-2, ML-4: render the configured marketplaces grouped by
 * scope. ML-4 empty-case returns the byte-for-byte stable string
 * `No marketplaces configured.`
 */
export function renderMarketplaceList(records: readonly MarketplaceListEntry[]): string {
  if (records.length === 0) {
    return "No marketplaces configured.";
  }

  const byScope: Record<"user" | "project", MarketplaceListEntry[]> = {
    user: [],
    project: [],
  };
  for (const m of records) {
    byScope[m.scope].push(m);
  }

  const lines: string[] = [];
  for (const scope of ["user", "project"] as const) {
    const entries = byScope[scope];
    if (entries.length === 0) {
      continue;
    }

    if (lines.length > 0) {
      lines.push("");
    }

    lines.push(`${scope} scope marketplaces:`);
    for (const m of entries) {
      const auto = m.autoupdate === true ? " [autoupdate]" : "";
      // ML-2: source.logical for path; canonical https URL for github;
      // raw fallback for unknown (NFR-12 forward-compat).
      const logical = sourceLogical(m.source);
      lines.push(`  ${ICON} ${m.name} (${logical})${auto}`);
    }
  }

  return lines.join("\n");
}
