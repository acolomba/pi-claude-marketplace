// domain/manifest.ts
//
// Top-level `marketplace.json` schema (PRD §6.3 MM-1). The `plugins` array
// contains entries shaped per `domain/components/plugin.ts` PLUGIN_ENTRY_SCHEMA.
//
// D-05 + D-07: TypeBox JIT compilation runs at module load. The import path
// is `typebox/compile` (the package is `typebox` with no scope).

import { readFile } from "node:fs/promises";
import path from "node:path";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { InvalidMarketplaceManifestError } from "../shared/errors.ts";
import { assertPathInside } from "../shared/path-safety.ts";

import { PLUGIN_ENTRY_SCHEMA } from "./components/plugin.ts";
import { createManifestCache } from "./manifest-cache.ts";

/**
 * MM-1: `marketplace.json` shape. Required: string `name`, array `plugins`.
 * Optional: boolean `strict` (default true per MM-5), `owner.name`.
 *
 * The `strict` field controls resolver behavior (resolveStrict vs
 * resolveLoose) per MM-5/MM-6/MM-7; the schema only validates presence.
 */
export const MARKETPLACE_SCHEMA = Type.Object({
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
export const MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA);

/**
 * NFR-8 / D-14: the sole marketplace.json read+parse+validate. This is the ONLY
 * marketplace.json file read in the repo (CACHE-06) and the injected loader
 * behind the cache. It preserves the parsed manifest except that plugin-local
 * `mcpServers` file references are inlined before validation. It does NOT route
 * the result through the validator's coercing parse, a schema clean, or a deep
 * clone -- so key order and extra fields survive (`update.ts` JSON.stringifys
 * it; `info.ts` reads `parsed.description`). Keep this focused on path-based
 * reads only: no cache state, invalidation, or caller-specific error wrapping
 * belongs here.
 */
async function loadMarketplaceManifestUncached(manifestPath: string): Promise<MarketplaceManifest> {
  const raw = await readFile(manifestPath, "utf8");

  // D-48-B: malformed JSON throws SyntaxError from JSON.parse; re-throw it as a
  // typed InvalidMarketplaceManifestError (carrying the original as cause) so
  // consumers narrow on instanceof instead of sniffing for SyntaxError.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new InvalidMarketplaceManifestError(
      `marketplace.json is not valid JSON: ${String(err)}`,
      {
        cause: err,
      },
    );
  }

  await inlineMcpServerReferences(parsed, manifestPath);

  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    const firstErr = MARKETPLACE_VALIDATOR.Errors(parsed)[0];
    const detail = firstErr
      ? `${firstErr.instancePath || "<root>"}: ${firstErr.message}`
      : "(no detail)";
    throw new InvalidMarketplaceManifestError(`marketplace.json schema invalid: ${detail}`);
  }

  return parsed;
}

async function inlineMcpServerReferences(manifest: unknown, manifestPath: string): Promise<void> {
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !Array.isArray((manifest as { plugins?: unknown }).plugins)
  ) {
    return;
  }

  const marketplaceRoot = path.dirname(path.dirname(manifestPath));
  for (const plugin of (manifest as { plugins: unknown[] }).plugins) {
    if (
      typeof plugin !== "object" ||
      plugin === null ||
      typeof (plugin as { source?: unknown }).source !== "string" ||
      typeof (plugin as { mcpServers?: unknown }).mcpServers !== "string"
    ) {
      continue;
    }

    const entry = plugin as { source: string; mcpServers: unknown };
    const mcpReference = entry.mcpServers as string;
    const pluginRoot = path.resolve(marketplaceRoot, entry.source);
    const mcpPath = path.resolve(pluginRoot, mcpReference);
    await assertPathInside(marketplaceRoot, pluginRoot, `plugin source path "${entry.source}"`);
    await assertPathInside(pluginRoot, mcpPath, `mcpServers path "${mcpReference}"`);

    try {
      const mcpDoc = JSON.parse(await readFile(mcpPath, "utf8")) as { mcpServers?: unknown };
      entry.mcpServers = mcpDoc.mcpServers;
    } catch (err) {
      throw new InvalidMarketplaceManifestError(`mcpServers file is invalid: ${String(err)}`, {
        cause: err,
      });
    }
  }
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
