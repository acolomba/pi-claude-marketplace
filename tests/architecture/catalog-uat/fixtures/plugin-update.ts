import { UPDATE_CONTEXT } from "../../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";
import { notifyUpdateNoOpWithContext } from "../../../../extensions/pi-claude-marketplace/shared/notify-context.ts";
import { piWithBothLoaded } from "../mock-pi.ts";

import type { NotificationMessage } from "../../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin update command surface. */
export const PLUGIN_UPDATE_FIXTURES: FixtureMap = {
  "/claude:plugin update": {
    // SCOPE-01: `update <plugin>@<mp> --scope <scope>` where the container sits
    // one scope over. The plugin is the subject and the brace names where the
    // container really is -- the scope word is the OPPOSITE of the bracket.
    "update-not-installed-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                reasons: ["not installed", "marketplace in project scope"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // UGRM-01: the bulk-update up-to-date `beta` row is suppressed at the
    // orchestrator, so the fixture omits it. UGRM-02: the `tally` override owns
    // the success category (one realized `updated` row -> `1 updated`); the
    // failure category still folds in from the rows -> `1 failure, 1 updated`.
    "single-mp-mixed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 1 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
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

    // UGRM-02: the override carries a 0 success count (zero `updated` rows), so
    // `composeTally` drops the success category and the failure math is
    // unchanged -- the summary stays byte-identical at `Plugin update: 1
    // failure`. Proves the override does not perturb a failure-only cascade.
    "failed-with-rollback-partial": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 0 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "delta",
                version: "1.0.0",
                reasons: ["rollback partial"],
                cause: new Error("orchestrator failed mid-staging"),
                rollbackPartial: [
                  {
                    phase: "phase3a",
                    cause: new Error("failed to remove staged agent: EACCES"),
                  },
                  { phase: "phase3b", cause: new Error("orphan path: /.../delta.bak") },
                ],
              },
            ],
          },
        ],
      },
    },

    // UGRM-01/UGRM-02: an all-up-to-date bulk update suppresses every per-plugin
    // row (and drops the now-empty marketplace headers), leaving an empty
    // cascade. The never-silent `Plugin update: nothing to update` headline is
    // emitted by the ORCHESTRATOR (`notifyUpdateNoOpWithContext` ->
    // `emitUpdateNoOpCascade`), NOT the `notify()` renderer -- so this fixture
    // drives the orchestrator no-op seam via `emit`. Info severity, no
    // reload-hint.
    "all-up-to-date-noop": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        marketplaces: [],
      },
      emit: (ctx, pi) => {
        notifyUpdateNoOpWithContext(ctx, pi, UPDATE_CONTEXT, [], "plural");
      },
    },

    // UGRM-01: the up-to-date `beta` row is suppressed. UGRM-02: two realized
    // `updated` rows (`helper` + `alpha`) -> `tally` count 2; the one `failed`
    // row composes ahead -> `1 failure, 2 updated`.
    "bare-multi-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 2 },
        marketplaces: [
          {
            name: "local-mp",
            scope: "project",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "helper",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
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

    // UGRM-02: two realized `updated` rows across the per-scope blocks -> `tally`
    // count 2 -> `Plugin update: 2 updated` (no suppression -- no up-to-date
    // rows here; only the verb/count grammar changes).
    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 2 },
        marketplaces: [
          {
            name: "official",
            scope: "project",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "0.9.0",
                to: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "beta",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // SNM-35: an update arrow with PI-7 hashes on BOTH sides renders the
    // git-style short SHAs `#2ea95f8 → v#1c3d9a0` (bare from, v-prefixed
    // to per composeVersionArrow's asymmetry; D-23-05).
    "hash-version-arrow": {
      pi: piWithBothLoaded(),
      // UGRM-02: one realized `updated` row -> `tally` count 1 -> `Plugin
      // update: 1 updated`.
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 1 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "hashed-plugin",
                from: "hash-2ea95f85703d",
                to: "hash-1c3d9a0bbef1",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // D-78-06 / PURL-06: a git-source update from `sha-<12hex>OLD` to
    // `sha-<12hex>NEW` renders the version arrow as `v#<7hex> → v#<7hex>` through
    // the SAME composeVersionArrow -> renderVersion -> formatShaVersionForDisplay
    // path the hash-version arrow uses (`sha-a1b2c3d4e5f6` -> `v#a1b2c3d`,
    // `sha-2222333344455` -> `v#2222333`). Verify-only: no render code changes.
    "sha-version-arrow": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 1 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "git-plugin",
                from: "sha-a1b2c3d4e5f6",
                to: "sha-222233334445",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / WR-12 / D-99-03: a component the update's own ledger degraded
    // names its kind on the `(updated)` row and takes the info -> warning raise,
    // matching the install / enable / reinstall arms. Distinct from the
    // dropped-kind axis below, which renders `(partially-installed)`.
    "update-degraded-component": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                from: "1.0.0",
                to: "1.0.1",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08 / WR-01: the update verb's orphan-rewake row. Same token
    // and same info severity as the install / enable / backfill rows -- the
    // config bug names itself in the brace and moves no severity channel.
    "update-orphan-rewake": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "1.0.0",
                to: "1.0.1",
                dependencies: [],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // CR-01 / WARN-01 / FSTAT-07: the dropped-kind and malformed-component axes
    // firing on one ledger run. The drop picks the row FORM
    // (`partially-installed`, post-update version, no arrow); the malformed
    // component adds its token to the same brace, in the install row's emit
    // order (malformed first). Both cascade surfaces compose this through the
    // one `updatedRowFromOutcome` seam, so neither can name one axis and
    // swallow the other.
    "update-degraded-and-dropped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                scope: "user",
                version: "1.0.1",
                dependencies: [],
                reasons: ["malformed skill", "unsupported component"],
              },
            ],
          },
        ],
      },
    },

    // SEV-04 / D-69-02 / XSURF-03: a TARGETED `update <plugin>@<marketplace>`
    // that declines a partially-upgradable candidate (no `--partial`) is actionable
    // -> warning. The decline flips to the `partially-upgradable` token (consistent
    // with how `list` describes the same plugin) carrying the list-consistent
    // degrade reason + the update-worded `--partial` trailer (partialHint). Single
    // cardinality, so no trailing tally; the cascade carries the `needs
    // attention` summary line.
    "decline-partially-upgradable-targeted": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "partially-upgradable",
                severity: "warning",
                needsReload: false,
                partialHint: true,
                name: "hello",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // SEV-04 / D-69-02 / XSURF-03: a BULK `update @<marketplace>` that skips the
    // same partially-upgradable candidate the user did NOT target is benign -> info.
    // Same `partially-upgradable` token + `--partial` trailer as the targeted form; no
    // summary line; the plural tally counts the info skip among its successes.
    // UGRM-01/UGRM-02: a bulk update whose only non-`updated` row is a benign
    // info `(partially-upgradable)` decline (partition `skipped`, 0 updated, 0
    // failures/warnings) is a zero-realized-transition cascade. The Phase-73
    // `(partially-upgradable) {lsp}` body row + `--partial` trailer still render, but
    // the headline is the never-silent `Plugin update: nothing to update`
    // constant -- emitted by the ORCHESTRATOR (`notifyUpdateNoOpWithContext`),
    // NOT by composeTally (which would collapse a `tally {count: 0}` override to
    // `""`, dropping the line = the byte-drift defect). So this fixture drives
    // the orchestrator no-op seam via `emit`, keeping the Phase-73 row as the
    // body. Info severity, no reload-hint.
    "skip-partially-upgradable-bulk": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "partially-upgradable",
                severity: "info",
                needsReload: false,
                partialHint: true,
                name: "hello",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
      emit: (ctx, pi) => {
        notifyUpdateNoOpWithContext(
          ctx,
          pi,
          UPDATE_CONTEXT,
          [
            {
              name: "mp",
              scope: "project",
              plugins: [
                {
                  status: "partially-upgradable",
                  severity: "info",
                  needsReload: false,
                  partialHint: true,
                  name: "hello",
                  version: "1.0.0",
                  reasons: ["lsp"],
                },
              ],
            },
          ],
          "plural",
        );
      },
    },

    // WR-04 / D-98-04: a targeted `update` against a DISABLED record that is
    // ALREADY degraded and whose candidate re-resolves `partially-available`.
    // The record-derived gate admits it with no flag typed and the D-UPD
    // short-circuit refreshes the record's metadata while staging nothing.
    // WR-02: the row names why nothing was materialized rather than claiming
    // `up-to-date` in the very call that moved the pin -- both tokens are
    // inherited closed-set members, and `already disabled` is idempotent, so the
    // row keeps its info severity. No trailer.
    "disabled-record-refresh": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                severity: "info",
                needsReload: false,
                name: "hello",
                reasons: ["already disabled"],
              },
            ],
          },
        ],
      },
    },

    // ATTR-02 / SCOPE-01 / M10 / M11: marketplace not added in the requested
    // explicit scope (or present only in the other scope) -> standalone
    // `marketplace-not-added` variant carrying the requested-scope bracket,
    // form-independent across the `<plugin>@<mp>` / `@<mp>` forms. No raw
    // throw escapes the orchestrator.
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // ATTR-02: bare `update @<marketplace>` form absent in BOTH scopes ->
    // standalone `marketplace-not-added` variant with NO bracket (the
    // absent-from-both form; no requested scope to report).
    "missing-marketplace-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      } satisfies NotificationMessage,
    },
  },
};
