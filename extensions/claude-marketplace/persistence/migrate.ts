// persistence/migrate.ts
//
// Legacy state.json record migration (ST-4, ST-5) and the SINGLE
// sanctioned `console-warn` callsite (IL-3).
//
// Per Phase 1 SUMMARY handoff item #2, the disable-comment incantation
// disables BOTH no-restricted-syntax AND no-console rules:
//   // eslint-disable-next-line no-restricted-syntax,no-console -- IL-3 ...
// Any other use of `console-warn` in this file (or anywhere in the
// extension) trips the eslint rule by design.
//
// Per ST-4: missing manifestPath / marketplaceRoot are filled with
// V1's default-derivation. Per ST-5: missing resources.agents /
// resources.mcpServers are normalized to [].
//
// Per ST-4 "persisted asynchronously (best-effort)": the persist call
// does NOT re-throw on failure; the IL-3 warn surfaces the cause and
// the in-memory normalized state remains usable for the rest of the
// process. The next load re-runs the migration.

import path from "node:path";

import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";

/**
 * Result of a normalize pass: the legal `marketplaces` map and a flag
 * indicating whether any field was filled in. Callers persist only when
 * `mutated === true` to avoid pointless I/O on already-normalized files.
 */
export interface MigrationResult {
  readonly marketplaces: Record<string, unknown>;
  readonly mutated: boolean;
}

/**
 * Normalize a parsed state.json's `marketplaces` map to the current shape.
 *
 * Pure function -- does NOT touch disk. Caller decides whether to persist
 * the result (typically via persistMigratedState).
 *
 * Behavior (V1-equivalent):
 *   - non-object / null parsed input -> { marketplaces: {}, mutated: false }
 *   - parsed object with non-object marketplaces -> reset to {} (Pitfall 9)
 *   - per-marketplace: fill manifestPath and marketplaceRoot with defaults
 *     derived from `<extensionRoot>/sources/<mp>/...` (ST-4)
 *   - per-plugin: ensure resources.agents and resources.mcpServers are
 *     arrays (ST-5)
 */
export function migrateLegacyMarketplaceRecords(
  parsed: unknown,
  extensionRoot: string,
): MigrationResult {
  // Reject anything that isn't an object (Pitfall 9: null/array -> reset).
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { marketplaces: {}, mutated: false };
  }

  const root = parsed as Record<string, unknown>;
  const rawMps = root.marketplaces;

  // Missing / null / non-object marketplaces field -> reset to {}.
  // If the field was non-undefined-but-bad (null, array, primitive), mark
  // mutated so the caller knows to persist the reset.
  if (
    rawMps === undefined ||
    rawMps === null ||
    typeof rawMps !== "object" ||
    Array.isArray(rawMps)
  ) {
    return { marketplaces: {}, mutated: rawMps !== undefined };
  }

  let mutated = false;
  const marketplaces: Record<string, unknown> = {};

  for (const [mpName, mpRaw] of Object.entries(rawMps as Record<string, unknown>)) {
    if (typeof mpRaw !== "object" || mpRaw === null || Array.isArray(mpRaw)) {
      // V1 never produced this shape; skip silently and mark mutated.
      mutated = true;
      continue;
    }

    const mp = mpRaw as Record<string, unknown>;

    // ST-4: derive default manifestPath / marketplaceRoot if absent.
    if (mp.manifestPath === undefined) {
      mp.manifestPath = path.join(
        extensionRoot,
        "sources",
        mpName,
        ".claude-plugin",
        "marketplace.json",
      );
      mutated = true;
    }

    if (mp.marketplaceRoot === undefined) {
      mp.marketplaceRoot = path.join(extensionRoot, "sources", mpName);
      mutated = true;
    }

    // ST-5: normalize per-plugin resources.agents / resources.mcpServers to [].
    const plugins = mp.plugins;
    if (typeof plugins === "object" && plugins !== null && !Array.isArray(plugins)) {
      for (const plRaw of Object.values(plugins as Record<string, unknown>)) {
        if (typeof plRaw !== "object" || plRaw === null || Array.isArray(plRaw)) {
          continue;
        }

        const pl = plRaw as Record<string, unknown>;
        let resources: Record<string, unknown>;

        if (typeof pl.resources === "object" && pl.resources !== null) {
          resources = pl.resources as Record<string, unknown>;
        } else {
          resources = {};
          pl.resources = resources;
          mutated = true;
        }

        if (resources.agents === undefined) {
          resources.agents = [];
          mutated = true;
        }

        if (resources.mcpServers === undefined) {
          resources.mcpServers = [];
          mutated = true;
        }
      }
    }

    marketplaces[mpName] = mp;
  }

  return { marketplaces, mutated };
}

/**
 * Best-effort async persistence of the migrated state. Failure surfaces
 * via the SINGLE sanctioned `console-warn` callsite (IL-3); does NOT throw.
 *
 * The user-visible message NAMES the failed path so the user can act on
 * it manually if needed, but the in-memory state is still usable for the
 * remainder of this Pi process.
 *
 * Per Phase 1 SUMMARY handoff item #2: the disable-comment must disable
 * BOTH `no-restricted-syntax` AND `no-console` in a single comment. Any
 * other shape trips ESLint by design (the no-console block-error and the
 * no-restricted-syntax message both point operators here).
 */
export async function persistMigratedState(
  stateJsonPath: string,
  normalizedState: unknown,
): Promise<void> {
  try {
    await atomicWriteJson(stateJsonPath, normalizedState);
  } catch (err) {
    const errMsg = errorMessage(err);
    // eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail
    console.warn(
      `pi-claude-marketplace: failed to persist migrated state to ${stateJsonPath} (${errMsg}); continuing with in-memory normalized state. Original state.json is unchanged.`,
    );
  }
}
