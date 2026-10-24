import { piWithAllLoaded, piWithBothLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { NotificationMessage } from "../../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin reinstall command surface. */
export const PLUGIN_REINSTALL_FIXTURES: FixtureMap = {
  "/claude:plugin reinstall": {
    "single-mp-all-reinstalled": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "beta",
                version: "0.5.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    "success-with-soft-dep": {
      pi: piWithNothingLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / WR-09: a component the reinstall's own ledger degraded names
    // its kind on the `(reinstalled)` row and takes the info -> warning raise,
    // matching the install / enable / backfill arms.
    "reinstall-degraded-component": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },

    // WLIF-06: the reinstall's source dropped or renamed a workflow the record
    // named, so its envelope is gone and the command it registered is still
    // live. Same token, same tail position and same info -> warning raise the
    // uninstall, disable and update rows take.
    "reinstall-stale-workflow-command": {
      pi: piWithAllLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                reasons: ["stale workflow command"],
              },
            ],
          },
        ],
      },
    },

    // D-18-06: the source now resolves partially-available, so the reinstall
    // left a kind out. A record that left nothing out before raises the row.
    "reinstall-partial-component": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                version: "1.1.0",
                dependencies: [],
                reasons: ["unsupported hooks"],
              },
            ],
          },
        ],
      },
    },

    // REI-04 / UPR-03: a reinstall that installed a newer version names the
    // version it replaced, as the update row does.
    "reinstall-newer-version": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "1.0.0",
                version: "1.1.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // UPR-02: a reinstall onto a new commit at the same declared version names
    // both commits.
    "reinstall-same-version-new-commit": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "git-plugin",
                from: "1.0.0",
                version: "1.0.0",
                commits: {
                  from: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
                  to: "2222333344445555666677778888999900001111",
                },
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // ENBL-05 / ENBL-18 / DFEN-07: a cascade reaching an already-disabled
    // record short-circuits before the resolve, so nothing is re-materialized
    // and the record keeps its component inventory. The row is benign and
    // idempotent, hence info severity and no summary line; the reload hint
    // still fires off the sibling `(reinstalled)` row, and the plural tally
    // counts the informational skip as a success.
    "reinstall-disabled-record-cascade": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["already disabled"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "single-mp-mixed-outcomes": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          // fallow-ignore-next-line code-duplication -- reviewed: each catalog state spells out its full expected message, so a state reads on its own
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
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
                name: "delta",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "single-mp-all-failed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "alpha",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "beta",
                reasons: ["invalid manifest"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "plugin-became-unavailable": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "unavailable", name: "delta", reasons: ["unsupported hooks"] },
            ],
          },
        ],
      },
    },

    "bare-multi-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "helper",
                version: "0.5.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "tool",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
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
                name: "delta",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "beta",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // D-18-07: a dependent's range does not admit the offered version, so the
    // reinstall is skipped with the holders on the cause line.
    "reinstall-held-by-dependents": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "shared-lib",
                reasons: ["dependents constrain"],
                cause: new Error(
                  'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "alpha@mp"',
                ),
                severity: "warning",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // D-18-02: the shared candidate resolution skips an entry it cannot
    // install and one the cached manifest no longer declares.
    "reinstall-runner-skips": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                reasons: ["no longer installable"],
                severity: "warning",
                needsReload: false,
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["not in manifest"],
                severity: "warning",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // D-18-17: the dependency walk cannot read a recorded plugin, so a named
    // reinstall fails closed and names that record.
    "reinstall-dependency-walk-unreadable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "good",
                reasons: ["unreadable"],
                cause: new Error(
                  "cannot read the dependencies of bad@mp: not declared by its marketplace",
                ),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // D-18-10: a bridge commit failed inside the shared swap, so the row
    // carries the swap's aggregate cause and one child per failed bridge.
    "reinstall-rollback-partial": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "hello",
                version: "1.0.0",
                reasons: ["rollback partial"],
                cause: new Error(
                  'Plugin "hello" failed during physical replace. Run /claude:plugin reinstall hello@mp to repair it.',
                  { cause: new Error("EACCES: permission denied, rename") },
                ),
                rollbackPartial: [
                  { phase: "agents", cause: new Error("EACCES: permission denied, rename") },
                ],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // CR-02 / UPR-04: standalone reinstall of a present marketplace whose plugin
    // record is absent -> the `(failed) {not installed}` row at `error`, as
    // uninstall's is; single cardinality so no tally.
    "standalone-not-installed-error": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "hello",
                reasons: ["not installed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // SCOPE-01: the container is registered in the scope the command did not
    // target, so the brace names it beside `not installed`.
    "reinstall-not-installed-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "hello",
                reasons: ["not installed", "marketplace in user scope"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // ATTR-03 / SCOPE-01 / M6 / M7 / M8: marketplace not added in the requested
    // explicit scope (or present only in the other scope) -> standalone
    // `marketplace-not-added` variant carrying the requested-scope bracket,
    // form-independent across the explicit-scope-plugin / explicit-scope-
    // marketplace forms.
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "project",
      } satisfies NotificationMessage,
    },

    // ATTR-03: bare `reinstall @<marketplace>` form absent in BOTH scopes ->
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
