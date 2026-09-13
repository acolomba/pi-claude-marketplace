import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the marketplace update command surface. */
export const MARKETPLACE_UPDATE_FIXTURES: FixtureMap = {
  "/claude:plugin marketplace update [<name>]": {
    // UXG-05: autoupdate-OFF manifest-only refresh splits into a no-op
    // (`skipped {up-to-date}`) and a changed (`updated`) state. Per UXG-02 /
    // D-28-07 the benign `up-to-date` no-op computes INFO (no
    // `expectedSeverity`).
    "update-no-op-skipped": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    // UXG-05: the autoupdate-ON cascade
    // no-op converges to the SAME `(skipped) {up-to-date}` byte form as the
    // OFF no-op (plugins:[], dropped all-`unchanged` cascade rows). Distinct
    // mp name (`official`) so the two fixtures are not confusable.
    "update-autoupdate-noop-skipped": {
      pi: piWithBothLoaded(),
      // Benign `up-to-date` no-op -> INFO per UXG-02 / D-28-07 (no
      // `expectedSeverity`); byte form unchanged.
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    // WR-10: the near miss of the no-op above. A disabled record whose
    // content-derived pin moved is a `skipped` outcome, not `unchanged`, so it
    // leaves the no-op gate and the cascade rows render. Benign idempotent
    // reason -> INFO (no `expectedSeverity`).
    "update-autoupdate-disabled-repin": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "disabled-mp",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                scope: "user",
                reasons: ["already disabled"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // LIFE-06 / D-98-13: the cascade skip row for an installed record whose
    // manifest entry is gone. `outcomeToCascadePluginMessage`'s `skipped` arm
    // forwards name, scope and reasons ONLY -- no version -- so this row is
    // version-less while the single-plugin `update` surface renders `v1.0.0` on
    // the same skip. That asymmetry is the byte contract, not a bug.
    // `not in manifest` is non-idempotent, so `skipSeverity` stamps `warning`.
    "update-autoupdate-cascade-not-in-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "auto-skip",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                scope: "user",
                reasons: ["not in manifest"],
                severity: "warning",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "manifest-refresh-changed": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [{ name: "local-mp", scope: "user", status: "updated", plugins: [] }],
      },
    },

    "mixed-outcomes": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "delta",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },

    // SEV-03 / D-69-01: the autoupdate cascade TAKES the partial path, so a
    // candidate re-resolving `partially-available` renders `(partially-installed) {dropped
    // kinds}` (◉ glyph, via the shared `partiallyInstalledRow`) instead of
    // declining with `(skipped) {no longer installable}`. ALREADY-degraded case:
    // the persisted `compatibility.unsupported` was non-empty before the
    // auto-update, so re-degrading is benign -> INFO (no `expectedSeverity`).
    // partially-installed is a realized transition -> reload-hint fires.
    "autoupdate-partially-installed-already-degraded": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                scope: "user",
                version: "1.0.0",
                dependencies: [],
                reasons: ["lsp"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // SEV-03 / D-69-01: the SAME `(partially-installed)` autoupdate row, but the
    // auto-update NEWLY degrades a previously-clean plugin (the persisted
    // `compatibility.unsupported` was empty before the update). A silent
    // automatic degradation is actionable -> `warning` + the `needs attention`
    // summary line. The per-row bytes are identical to the already-degraded
    // info fixture above; only the stamped severity moves.
    "autoupdate-partially-installed-newly-degraded": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                scope: "user",
                version: "1.0.0",
                dependencies: [],
                reasons: ["lsp"],
                severity: "warning",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "mp-failure-network": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "failed",
            plugins: [],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    },

    // ATTR-10 / D-48-B: a path-source marketplace.json that is malformed or
    // schema-invalid renders `(failed) {invalid manifest}` on the synthetic-child
    // failed row -- never `{network unreachable}` (NFR-5: path-source touches no
    // network). The orchestrator's refreshOneMarketplace catch carries the
    // classified reason on a synthetic child (mirroring the mp-failure recipe);
    // this fixture pins that byte form. `cause` is omitted so the byte form is
    // deterministic (the live cause-chain trailer carries data-dependent JSON
    // parser text). Summary counts the synthetic child as one plugin operation.
    "update-path-invalid-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              {
                status: "failed",
                name: "official",
                reasons: ["invalid manifest"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "update-all-empty": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "plural",
        marketplaces: [],
      },
    },

    "update-all-one": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "plural",
        marketplaces: [
          {
            name: "alpha",
            scope: "project",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    "update-all-many-alpha": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "plural",
        marketplaces: [
          {
            name: "alpha",
            scope: "project",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    "update-all-many-beta": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace update",
        cardinality: "plural",
        marketplaces: [
          {
            name: "beta",
            scope: "project",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    // SC#1 / ATTR-06 / D-48-C: the marketplace-form update now converges on the
    // standalone `marketplace-not-added` variant for the marketplace-absent
    // precondition (closing the last residual Class-C raw-throw). Explicit scope
    // carries the requested `[scope]` bracket (SCOPE-01); the bare absent-from-both
    // form carries NO bracket. Both severity `error` via computeSeverity.
    "update-missing-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "project",
      },
    },

    "update-missing-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      },
    },
  },
};
