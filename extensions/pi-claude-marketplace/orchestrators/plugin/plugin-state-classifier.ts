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
 *
 * `disabled` is NOT produced here: `list` renders the distinct `(disabled)`
 * inventory token via its own `isRecordedButDisabled` guard ahead of the call
 * (D-54-01 / ENBL-04). The completion path has no `disabled` token, so the
 * classifier collapses a recorded-but-disabled record to `installed` (WR-01) --
 * keeping it in the no-`--partial` inventory set while excluding it from the
 * `update --partial` (upgradable/partially-upgradable) candidates, at parity with the
 * frozen `(disabled)` row `list` shows.
 *
 * `partially-installed-upgradable` is a partially-installed record (already degraded)
 * that ALSO carries a meaningful upgrade candidate -- a newer, NON-unavailable
 * version. `list` renders it as `(partially-installed)`, identical to a plain
 * `partially-installed` row, but -- unlike one -- it is a real `update --partial`
 * target: a supported candidate promotes it back to `installed` (FSTAT-03), an
 * partially-available candidate re-applies the partial install. It is NEVER
 * `partially-upgradable` (FSTAT-04 -- that state is reserved for a currently-CLEAN
 * row whose candidate would newly degrade it).
 */
export type InstalledClassification =
  | "installed"
  | "upgradable"
  | "partially-installed"
  | "partially-installed-upgradable"
  | "partially-upgradable";

/**
 * The not-installed manifest-entry states. `available` / `partially-available` /
 * `unavailable` map 1:1 onto the resolver's three-way `ResolvedPlugin.state`
 * discriminant (D-64-01). `remote` (RSTA-01 / D-80-06) is the extra
 * not-installed git-source-with-no-materialized-clone bucket: it is derived at
 * the CLASSIFICATION layer (in `git-source-probe.ts::probeManifestEntry`) from
 * fs-only clone/mirror presence, NOT a resolver arm -- the resolver union stays
 * strictly three-way (NFR-7).
 */
export type ManifestEntryClassification =
  "available" | "partially-available" | "unavailable" | "remote";

/**
 * The minimal structural view of a persisted install record the classifier
 * reads. Both `ExtensionState[...]plugins[...]` and the bucketizer's state
 * record satisfy this by construction.
 *
 * - `compatibility.unsupported` is the install-time degrade signal (FSTAT-01 /
 *   D-66-01): non-empty means one or more components were dropped, so the row
 *   derives `partially-installed`.
 * - `enabled` + `compatibility.installable` are the recorded-but-disabled axes
 *   (ENBL-02 -- canonical `reconcile/plan.ts::isRecordedButDisabled`): an
 *   `installable: true` record with `enabled: false` was explicitly disabled and
 *   is version-frozen, so the classifier short-circuits it to `installed`
 *   (WR-01) -- it must never split into `upgradable`/`partially-upgradable`.
 */
export interface InstalledRecordLike {
  readonly enabled: boolean;
  readonly compatibility: {
    readonly installable: boolean;
    readonly unsupported: readonly string[];
  };
}

/**
 * The upgrade-candidate signal for {@link classifyInstalledRecord}.
 *
 * `upgradable: false` -- the installed version matches the manifest (no newer
 * candidate); the record stays `installed`/`partially-installed`.
 *
 * `upgradable: true` -- the manifest carries a newer version (PL-5 string
 * compare at the caller). `resolved` is the NO-NETWORK `resolveStrict`
 * resolution of the candidate manifest entry; `resolved: undefined` is the
 * CR-01 probe-failure degrade (the classifier falls back to plain `upgradable`
 * rather than asserting a partial degrade it could not probe).
 */
export type UpgradeCandidate =
  | { readonly upgradable: false }
  | { readonly upgradable: true; readonly resolved: ResolvedPlugin | undefined };

/**
 * Classify a persisted install record into the finer installed-inventory state.
 *
 * Precedence (A4): `partially-installed` (install-time degrade) wins over the clean
 * upgrade signals -- a degraded record is never mis-split into `partially-upgradable`
 * or `upgradable`. A degraded record WITH a newer, NON-unavailable candidate is
 * `partially-installed-upgradable` (WR-02): the partial update is meaningful (promote
 * back to `installed` if the candidate is supported, or re-apply the partial
 * install if still `partially-available`), so it must be offerable under
 * `update --partial`. A degraded record
 * with NO newer candidate -- or one whose candidate resolves structural
 * `unavailable` (nothing installable to move to) -- stays plain `partially-installed`.
 *
 * Only a CLEAN record reaches the `partially-upgradable`/`upgradable` split: a
 * candidate that resolves `partially-available` would NEWLY degrade the plugin
 * (`partially-upgradable`); any other candidate (clean, structural-`unavailable`, or
 * an un-probeable `undefined`) stays plain `upgradable`.
 */
export function classifyInstalledRecord(
  record: InstalledRecordLike,
  candidate: UpgradeCandidate,
): InstalledClassification {
  // WR-01 / ENBL-02 / D-54-01: a recorded-but-disabled record (the canonical
  // `installable: true` + `enabled: false` marker `reconcile/plan.ts::
  // isRecordedButDisabled` reads) is version-frozen while disabled, so it must
  // never split into `upgradable`/`partially-upgradable`. `list` renders it as the
  // distinct `(disabled)` token via its own pre-classifier guard; the completion
  // path has no `disabled` token, so collapse to `installed` here -- it stays in
  // the no-`--partial` inventory set but is excluded from `update --partial`, at
  // parity with the frozen `(disabled)` row. Checked BEFORE the partially-installed
  // branch so a disabled record is never mislabeled `partially-installed`.
  if (record.compatibility.installable && !record.enabled) {
    return "installed";
  }

  // FSTAT-01 / D-66-01 / A4: install-time degrade wins over the clean upgrade
  // split. WR-02 / FSTAT-03: a degraded record WITH a newer, NON-unavailable
  // candidate is a real `update --partial` target (promote to `installed` if the
  // candidate is supported, re-apply the partial install if still
  // `partially-available`), so it derives
  // the distinct `partially-installed-upgradable` (offered under `update --partial`,
  // rendered `(partially-installed)`, never `partially-upgradable`). `undefined` (CR-01
  // probe failure) is treated as NON-unavailable -- it cannot assert the
  // candidate is gone -- matching the clean record's degrade-to-`upgradable`.
  if (record.compatibility.unsupported.length > 0) {
    if (candidate.upgradable && candidate.resolved?.state !== "unavailable") {
      return "partially-installed-upgradable";
    }

    return "partially-installed";
  }

  if (candidate.upgradable) {
    // FSTAT-04 / FSTAT-05 / D-66-02: a newer candidate that resolves
    // `partially-available` newly degrades a currently-clean plugin.
    if (candidate.resolved?.state === "partially-available") {
      return "partially-upgradable";
    }

    // CR-01 degrade: `resolved === undefined` (probe failure), `installable`,
    // and structural `unavailable` candidates all stay plain `upgradable`.
    return "upgradable";
  }

  return "installed";
}

/**
 * Classify a not-installed manifest entry's resolution. D-64-01: `installable`
 * is the only `available` arm; both `partially-available` and structural `unavailable`
 * are distinct here (the render collapse to a single `(unavailable)` token is a
 * caller concern, not a classification one). The exhaustive `switch` +
 * `assertNever` makes a future fourth `ResolvedPlugin` arm a compile-time error.
 *
 * Return type EXCLUDES `remote` (RSTA-01 / NFR-7): `remote` is derived at the
 * classification layer from fs-only clone/mirror presence
 * (`git-source-probe.ts::probeManifestEntry`), never from a `ResolvedPlugin`, so
 * a resolver-driven classification is provably one of the three-way arms.
 */
export function classifyManifestEntry(
  resolved: ResolvedPlugin,
): Exclude<ManifestEntryClassification, "remote"> {
  switch (resolved.state) {
    case "installable":
      return "available";
    case "partially-available":
      return "partially-available";
    case "unavailable":
      return "unavailable";
    default:
      return assertNever(resolved);
  }
}
