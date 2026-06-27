// extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
//
// D-67-02 / LIST-02: the SINGLE shared per-entry plugin-state classifier. Both
// the list orchestrator (`installedRowMessage` / `availableRowMessage`) and the
// completion bucketizer (`orchestrators/edge-deps.ts::loadManifestForMarketplace`)
// derive their finer plugin state from THESE two functions -- there is no
// second classifier. A parity drift-guard test (tests/orchestrators/edge-deps.test.ts)
// asserts the two surfaces never diverge.
//
// PURITY (NFR-5): both functions take already-resolved inputs. They perform no
// disk or network I/O -- the caller owns the no-network `resolveStrict` probe and
// passes the result (or `undefined` on a probe failure) in. This keeps the
// classifier free of the `platform`/network layers and lets the no-network
// boundary stay at the caller, where the architecture guard
// (tests/architecture/no-orchestrator-network.test.ts) enforces it.

import { assertNever } from "../../shared/errors.ts";

import type { ResolvedPlugin } from "../../domain/resolver.ts";

/**
 * The finer installed-inventory states the classifier derives from a persisted
 * install record (plus the no-network resolution of its upgrade candidate).
 * `disabled` is NOT produced here -- it stays handled by the caller's
 * `isRecordedButDisabled` guard ahead of the call (D-54-01 / ENBL-04).
 */
export type InstalledClassification =
  | "installed"
  | "upgradable"
  | "force-installed"
  | "force-upgradable";

/**
 * The not-installed manifest-entry states, mapping 1:1 onto the resolver's
 * three-way `ResolvedPlugin.state` discriminant (D-64-01).
 */
export type ManifestEntryClassification = "available" | "unsupported" | "unavailable";

/**
 * The minimal structural view of a persisted install record the classifier
 * reads. Both `ExtensionState[...]plugins[...]` and the bucketizer's state
 * record satisfy this by construction. `compatibility.unsupported` is the
 * install-time degrade signal (FSTAT-01 / D-66-01): non-empty means one or
 * more components were dropped, so the row derives `force-installed`.
 */
export interface InstalledRecordLike {
  readonly compatibility: { readonly unsupported: readonly string[] };
}

/**
 * The upgrade-candidate signal for {@link classifyInstalledRecord}.
 *
 * `upgradable: false` -- the installed version matches the manifest (no newer
 * candidate); the record stays `installed`/`force-installed`.
 *
 * `upgradable: true` -- the manifest carries a newer version (PL-5 string
 * compare at the caller). `resolved` is the NO-NETWORK `resolveStrict`
 * resolution of the candidate manifest entry; `resolved: undefined` is the
 * CR-01 probe-failure degrade (the classifier falls back to plain `upgradable`
 * rather than asserting a force degrade it could not probe).
 */
export type UpgradeCandidate =
  | { readonly upgradable: false }
  | { readonly upgradable: true; readonly resolved: ResolvedPlugin | undefined };

/**
 * Classify a persisted install record into the finer installed-inventory state.
 *
 * Precedence (A4): `force-installed` (install-time degrade) wins over any
 * upgrade signal -- a degraded record is never mis-split into `force-upgradable`
 * or `upgradable`. Only a CLEAN record consults its upgrade candidate:
 * a candidate that resolves `unsupported` would NEWLY degrade the plugin
 * (`force-upgradable`); any other candidate (clean, structural-`unavailable`, or
 * an un-probeable `undefined`) stays plain `upgradable`.
 */
export function classifyInstalledRecord(
  record: InstalledRecordLike,
  candidate: UpgradeCandidate,
): InstalledClassification {
  // FSTAT-01 / D-66-01 / A4: install-time degrade wins over upgradability.
  if (record.compatibility.unsupported.length > 0) {
    return "force-installed";
  }

  if (candidate.upgradable) {
    // FSTAT-04 / FSTAT-05 / D-66-02: a newer candidate that resolves
    // `unsupported` newly degrades a currently-clean plugin.
    if (candidate.resolved?.state === "unsupported") {
      return "force-upgradable";
    }

    // CR-01 degrade: `resolved === undefined` (probe failure), `installable`,
    // and structural `unavailable` candidates all stay plain `upgradable`.
    return "upgradable";
  }

  return "installed";
}

/**
 * Classify a not-installed manifest entry's resolution. D-64-01: `installable`
 * is the only `available` arm; both `unsupported` and structural `unavailable`
 * are distinct here (the render collapse to a single `(unavailable)` token is a
 * caller concern, not a classification one). The exhaustive `switch` +
 * `assertNever` makes a future fourth `ResolvedPlugin` arm a compile-time error.
 */
export function classifyManifestEntry(resolved: ResolvedPlugin): ManifestEntryClassification {
  switch (resolved.state) {
    case "installable":
      return "available";
    case "unsupported":
      return "unsupported";
    case "unavailable":
      return "unavailable";
    default:
      return assertNever(resolved);
  }
}
