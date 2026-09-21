// domain/manifest.ts
//
// Top-level `marketplace.json` schema (PRD §6.3 MM-1). The `plugins` array
// contains entries shaped per `domain/components/plugin.ts` PLUGIN_ENTRY_SCHEMA.
//
// D-05 + D-07: TypeBox JIT compilation runs at module load. The import path
// is `typebox/compile` (the package is `typebox` with no scope).

import { readFile } from "node:fs/promises";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { hookDebugLog } from "../shared/debug-log.ts";
import { InvalidMarketplaceManifestError } from "../shared/errors.ts";

import { PLUGIN_ENTRY_SCHEMA } from "./components/plugin.ts";
import { parseDeclaredDependencies } from "./dependencies.ts";
import { createManifestCache } from "./manifest-cache.ts";

/**
 * MM-1: `marketplace.json` shape. Required: string `name`, array `plugins`.
 * Optional: boolean `strict` (default true per MM-5), `owner.name`.
 *
 * The schema only validates the `strict` field's presence and type. No
 * consumer branches on it: `resolveStrict` is the one resolution path, so a
 * manifest declaring `strict: false` resolves exactly like one that omits it.
 */
const MARKETPLACE_SCHEMA = Type.Object({
  name: Type.String(),
  plugins: Type.Array(PLUGIN_ENTRY_SCHEMA),
  strict: Type.Optional(Type.Boolean()),
  owner: Type.Optional(
    Type.Object({
      name: Type.String(),
    }),
  ),
});

export type MarketplaceManifest = Type.Static<typeof MARKETPLACE_SCHEMA>;

/** JIT-compiled validator (D-07). Call its `Check` (or coercing `Parse`) method. */
const MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA);

/**
 * Isolates invalid dependency declarations before validating the marketplace.
 * The stub's `source` sub-object is the shape `info.ts`'s
 * `isUnsupportedEntrySource` check and `tests/architecture/partial-vocabulary-guard.test.ts`
 * both pin. The stub keeps the entry's own `dependencies` value: the resolver
 * parses it again and reports the parse failure as the entry's defect, so no
 * synthetic marker is needed and a real entry cannot be mistaken for a stub.
 */
function normalizeDependencyEntries(raw: unknown): unknown {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("plugins" in raw) ||
    !Array.isArray(raw.plugins)
  ) {
    return raw;
  }

  const plugins: unknown[] = [];
  const entries: readonly unknown[] = raw.plugins;
  let changed = false;
  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== "object" || entry === null || !("dependencies" in entry)) {
      plugins.push(entry);
      continue;
    }

    const dependencies = parseDeclaredDependencies(entry.dependencies);
    if (dependencies.ok) {
      plugins.push(entry);
      continue;
    }

    changed = true;
    hookDebugLog(
      `Invalid dependencies in marketplace entry ${index}; isolating the entry.`,
      "plugins",
    );
    if ("name" in entry && typeof entry.name === "string" && entry.name.length > 0) {
      plugins.push({
        name: entry.name,
        source: { source: "unsupported" },
        dependencies: entry.dependencies,
      });
    }
  }

  return changed ? { ...raw, plugins } : raw;
}

/**
 * NFR-8 / D-14: the sole marketplace.json read+parse+validate. This is the ONLY
 * marketplace.json file read in the repo (CACHE-06) and the injected loader
 * behind the cache. Valid entries retain the RAW JSON.parse value (WR-01),
 * including key order and extra fields (`update.ts` JSON.stringifys it;
 * `info.ts` reads `parsed.description`). Invalid dependency entries become
 * unsupported stubs, or are dropped when unnamed, as in Claude Code. Keep this
 * focused on path-based reads only: no cache state, invalidation, or
 * caller-specific error wrapping belongs here.
 */
async function loadMarketplaceManifestUncached(manifestPath: string): Promise<MarketplaceManifest> {
  const raw = await readFile(manifestPath, "utf8");

  // D-48-B: malformed JSON throws SyntaxError from JSON.parse; re-throw it as a
  // typed InvalidMarketplaceManifestError (carrying the original as cause) so
  // consumers narrow on instanceof instead of sniffing for SyntaxError.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    throw new InvalidMarketplaceManifestError(
      `marketplace.json is not valid JSON: ${String(err)}`,
      {
        cause: err,
      },
    );
  }

  parsed = normalizeDependencyEntries(parsed);
  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    const validationErrors = MARKETPLACE_VALIDATOR.Errors(parsed);
    const detail = validationErrors
      .slice(0, 1)
      .map((error) => `${error.instancePath || "<root>"}: ${error.message}`)
      .join("");
    throw new InvalidMarketplaceManifestError(`marketplace.json schema invalid: ${detail}`);
  }

  return parsed;
}

/**
 * Process-lifetime singleton memoizing the seam (D-01: one module-level cache,
 * no reset hook). Keyed per-path by (mtimeMs, size); cold again after /reload.
 */
const manifestCache = createManifestCache(loadMarketplaceManifestUncached);

/**
 * NFR-8 / D-14: single domain seam for reading marketplace manifests.
 *
 * Memoized (D-01..D-04): a second read of an unchanged manifest performs only a
 * `stat` and serves the prior parse; a (mtimeMs, size) change reloads; parse/
 * validate failures are negative-cached and re-thrown as the same Error until
 * the file changes; a stat failure falls through to the loader on every read
 * (D-02). The result is the raw parse returned BY REFERENCE -- callers MUST
 * treat it as READ-ONLY (D-03; mutation would corrupt every later cache hit).
 */
export async function loadMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest> {
  return manifestCache.load(manifestPath) as Promise<MarketplaceManifest>;
}
