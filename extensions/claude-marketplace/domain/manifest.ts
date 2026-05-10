// domain/manifest.ts
//
// Top-level `marketplace.json` schema (PRD §6.3 MM-1). The `plugins` array
// contains entries shaped per `domain/components/plugin.ts` PLUGIN_ENTRY_SCHEMA.
//
// CONTEXT.md D-05 + D-07: TypeBox JIT compilation runs at module load.
// RESEARCH.md Pitfall 3: import path is `typebox/compile` (the 1.x package
// is `typebox` with no scope; the 0.34 LTS path used the scoped name plus
// `/compiler`, which is NOT what we want here).

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
