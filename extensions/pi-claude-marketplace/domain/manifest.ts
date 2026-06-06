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

import { PLUGIN_ENTRY_SCHEMA } from "./components/plugin.ts";

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

/** JIT-compiled validator (D-07). Use `.Check(value)` or `.Parse(value)`. */
export const MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA);

/**
 * NFR-8 / D-14: single domain seam for reading marketplace manifests.
 *
 * Future mtime-based caching wraps this function. Keep this function focused
 * on path-based marketplace.json reads only: no cache state, invalidation, or
 * caller-specific error wrapping belongs here.
 */
export async function loadMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    const firstErr = MARKETPLACE_VALIDATOR.Errors(parsed)[0];
    const detail = firstErr
      ? `${firstErr.instancePath || "<root>"}: ${firstErr.message}`
      : "(no detail)";
    throw new Error(`marketplace.json schema invalid: ${detail}`);
  }

  return parsed;
}
