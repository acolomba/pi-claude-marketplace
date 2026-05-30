// persistence/migrate.ts
//
// Legacy state.json record migration (ST-4, ST-5) and the SINGLE
// sanctioned `console-warn` callsite (IL-3).
//
// The IL-3 console.warn callsite is permitted by a per-file override in
// eslint.config.js that turns no-console + no-restricted-syntax off for this
// single file (the callsite trips both rules). Any other use of
// `console.warn` in the extension still trips the eslint rule by design,
// since the extension-wide block scopes the prohibition everywhere else.
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

function ensureMarketplacePaths(
  mpName: string,
  mp: Record<string, unknown>,
  extensionRoot: string,
): boolean {
  let mutated = false;
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

  return mutated;
}

function ensurePluginResources(mp: Record<string, unknown>): boolean {
  const plugins = mp.plugins;
  if (typeof plugins !== "object" || plugins === null || Array.isArray(plugins)) {
    return false;
  }

  let mutated = false;
  for (const plRaw of Object.values(plugins as Record<string, unknown>)) {
    if (typeof plRaw !== "object" || plRaw === null || Array.isArray(plRaw)) {
      continue;
    }

    const pl = plRaw as Record<string, unknown>;
    const resources =
      typeof pl.resources === "object" && pl.resources !== null
        ? (pl.resources as Record<string, unknown>)
        : {};
    if (pl.resources !== resources) {
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

  return mutated;
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

    mutated = ensureMarketplacePaths(mpName, mp, extensionRoot) || mutated;
    mutated = ensurePluginResources(mp) || mutated;

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
 * Per Plan 21-01 D-21-04: the IL-3 callsite below is allowed by the
 * block-level files-override at `extensions/pi-claude-marketplace/persistence/migrate.ts`
 * in eslint.config.js (BLOCK B-2). No inline disable directive is
 * required. Any other `console.warn` in the extension trips BLOCK A by
 * design.
 */
export async function persistMigratedState(
  stateJsonPath: string,
  normalizedState: unknown,
): Promise<void> {
  try {
    await atomicWriteJson(stateJsonPath, normalizedState);
  } catch (err) {
    const errMsg = errorMessage(err);
    console.warn(
      `Legacy marketplace migration could not be persisted to ${stateJsonPath}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.`,
    );
  }
}
