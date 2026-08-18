// domain/manifest-lookup.ts
//
// The membership rule: does a marketplace manifest DECLARE a given plugin
// name? Every surface that renders an absence claim -- the list inventory row
// (INV-01), the info block (INFO-09 / INFO-10 / BOUND-02) and the update
// transition row -- reads it from here, so the three cannot drift apart.
//
// D-99-02a: the rule lives in `domain/` because it is a pure, network-free,
// write-free derivation over a domain type. `domain/` depends only on
// `shared/`, so no consumer can close an import cycle by reading it.

import type { MarketplaceManifest } from "./manifest.ts";

/** One validated `plugins[]` element of a marketplace manifest. */
export type ManifestPluginEntry = MarketplaceManifest["plugins"][number];

/**
 * An installed record's resolution against the manifest its own marketplace
 * record names, as a single discriminated value:
 *
 *   - `declared`   -- the manifest was read and declares the record; its entry
 *                     drives the PL-5 version compare and the PL-4 description.
 *   - `absent`     -- the manifest was read and does NOT declare the record.
 *                     The only state that warrants the INV-01 absence brace.
 *   - `unverified` -- the manifest could not be read, so nothing is claimed
 *                     about membership either way (BOUND-03 / D-95-05).
 *
 * All three arms live here even though {@link lookupDeclaredPlugin} produces
 * only two: a surface that continues rendering past a FAILED read builds the
 * third itself, and every consumer then switches on the same union.
 */
export type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: ManifestPluginEntry }
  | { readonly kind: "absent" }
  | { readonly kind: "unverified" };

/**
 * The successful-read half of the rule, and the ONE place it is written.
 *
 * Membership is exact string identity on `plugins[].name` -- no case folding,
 * no Unicode normalization. `manifest` is an ALREADY-VALIDATED manifest, so
 * this adds no parsing surface.
 *
 * It holds no opinion about what a failed read means, and deliberately cannot
 * express one: the `unverified` arm is outside its return type. Whether a
 * surface continues rendering past a failed read (list does, per BOUND-03 /
 * D-95-05), returns a `(failed)` row (info does) or lets the read throw
 * (update does) is a per-surface I/O decision, not a domain fact.
 *
 * The parameter is the `plugins` collection alone rather than the whole
 * `MarketplaceManifest`: the rule reads nothing else, and `update` holds its
 * cached read as a narrowing whose array is `readonly`.
 */
export function lookupDeclaredPlugin(
  manifest: { readonly plugins: readonly ManifestPluginEntry[] },
  pluginName: string,
): Extract<ManifestLookup, { kind: "declared" | "absent" }> {
  const entry = manifest.plugins.find((p) => p.name === pluginName);
  return entry === undefined ? { kind: "absent" } : { kind: "declared", entry };
}
