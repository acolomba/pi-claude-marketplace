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
 * keeping it in the no-`--force` inventory set while excluding it from the
 * `update --force` (upgradable/force-upgradable) candidates, at parity with the
 * frozen `(disabled)` row `list` shows.
 *
 * `force-installed-upgradable` is a force-installed record (already degraded)
 * that ALSO carries a meaningful upgrade candidate -- a newer, NON-unavailable
 * version. `list` renders it as `(force-installed)`, identical to a plain
 * `force-installed` row, but -- unlike one -- it is a real `update --force`
 * target: a supported candidate promotes it back to `installed` (FSTAT-03), an
 * unsupported candidate re-applies the force-install. It is NEVER
 * `force-upgradable` (FSTAT-04 -- that state is reserved for a currently-CLEAN
 * row whose candidate would newly degrade it).
 */
export type InstalledClassification =
  | "installed"
  | "upgradable"
  | "force-installed"
  | "force-installed-upgradable"
  | "force-upgradable";

/**
 * The not-installed manifest-entry states, mapping 1:1 onto the resolver's
 * three-way `ResolvedPlugin.state` discriminant (D-64-01).
 */
export type ManifestEntryClassification = "available" | "unsupported" | "unavailable";

/**
 * The minimal structural view of a persisted install record the classifier
 * reads. Both `ExtensionState[...]plugins[...]` and the bucketizer's state
 * record satisfy this by construction.
 *
 * - `compatibility.unsupported` is the install-time degrade signal (FSTAT-01 /
 *   D-66-01): non-empty means one or more components were dropped, so the row
 *   derives `force-installed`.
 * - `enabled` + `compatibility.installable` are the recorded-but-disabled axes
 *   (ENBL-02 -- canonical `reconcile/plan.ts::isRecordedButDisabled`): an
 *   `installable: true` record with `enabled: false` was explicitly disabled and
 *   is version-frozen, so the classifier short-circuits it to `installed`
 *   (WR-01) -- it must never split into `upgradable`/`force-upgradable`.
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
 * Precedence (A4): `force-installed` (install-time degrade) wins over the clean
 * upgrade signals -- a degraded record is never mis-split into `force-upgradable`
 * or `upgradable`. A degraded record WITH a newer, NON-unavailable candidate is
 * `force-installed-upgradable` (WR-02): the force-update is meaningful (promote
 * back to `installed` if the candidate is supported, or re-apply force if still
 * unsupported), so it must be offerable under `update --force`. A degraded record
 * with NO newer candidate -- or one whose candidate resolves structural
 * `unavailable` (nothing installable to move to) -- stays plain `force-installed`.
 *
 * Only a CLEAN record reaches the `force-upgradable`/`upgradable` split: a
 * candidate that resolves `unsupported` would NEWLY degrade the plugin
 * (`force-upgradable`); any other candidate (clean, structural-`unavailable`, or
 * an un-probeable `undefined`) stays plain `upgradable`.
 */
export function classifyInstalledRecord(
  record: InstalledRecordLike,
  candidate: UpgradeCandidate,
): InstalledClassification {
  // WR-01 / ENBL-02 / D-54-01: a recorded-but-disabled record (the canonical
  // `installable: true` + `enabled: false` marker `reconcile/plan.ts::
  // isRecordedButDisabled` reads) is version-frozen while disabled, so it must
  // never split into `upgradable`/`force-upgradable`. `list` renders it as the
  // distinct `(disabled)` token via its own pre-classifier guard; the completion
  // path has no `disabled` token, so collapse to `installed` here -- it stays in
  // the no-`--force` inventory set but is excluded from `update --force`, at
  // parity with the frozen `(disabled)` row. Checked BEFORE the force-installed
  // branch so a disabled record is never mislabeled `force-installed`.
  if (record.compatibility.installable && !record.enabled) {
    return "installed";
  }

  // FSTAT-01 / D-66-01 / A4: install-time degrade wins over the clean upgrade
  // split. WR-02 / FSTAT-03: a degraded record WITH a newer, NON-unavailable
  // candidate is a real `update --force` target (promote to `installed` if the
  // candidate is supported, re-apply force if still unsupported), so it derives
  // the distinct `force-installed-upgradable` (offered under `update --force`,
  // rendered `(force-installed)`, never `force-upgradable`). `undefined` (CR-01
  // probe failure) is treated as NON-unavailable -- it cannot assert the
  // candidate is gone -- matching the clean record's degrade-to-`upgradable`.
  if (record.compatibility.unsupported.length > 0) {
    if (candidate.upgradable && candidate.resolved?.state !== "unavailable") {
      return "force-installed-upgradable";
    }

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
