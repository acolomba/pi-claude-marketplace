import { piWithAllLoaded, piWithBothLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { NotificationMessage } from "../../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin uninstall command surface. */
export const PLUGIN_UNINSTALL_FIXTURES: FixtureMap = {
  "/claude:plugin uninstall <plugin>@<marketplace>": {
    success: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WR-06 / DATA-01: the preserving disposition, which is the only thing that
    // separates this row from the `success` row above.
    "success-keep-data": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                reasons: ["data kept"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WLIF-06: the removal took a workflow envelope off disk, so the command it
    // registered stays live until a reload. The `{stale workflow command}` token
    // and the `/reload to pick up changes` trailer coexist on one screen and
    // state different facts -- new things a reload picks up versus a removed
    // thing it drops.
    "uninstall-stale-workflow-command": {
      pi: piWithAllLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                reasons: ["stale workflow command"],
                severity: "warning",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "success-soft-dep-omitted": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "failure-permission-denied": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["permission denied"],
                cause: new Error("EACCES: permission denied, unlink '/path/to/file'"),
              },
            ],
          },
        ],
      },
    },

    // WLIF-06: the partial cascade removed a workflow envelope and then failed,
    // so the token joins the failure reason at the tail. Severity stays `error`
    // -- the uninstall was not carried out, which outranks the warning band the
    // token carries alone -- and the reload trailer stays structurally absent.
    "failure-stale-workflow-command": {
      pi: piWithAllLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["permission denied", "stale workflow command"],
                cause: new Error("EACCES: permission denied, unlink '/path/to/file'"),
              },
            ],
          },
        ],
      },
    },

    // ATTR-04 / SCOPE-01 / M3 / M4: marketplace never added (or present only
    // in the other scope) -> LOUD standalone `marketplace-not-added` variant
    // carrying the requested-scope bracket (distinct from the silent PU-5
    // already-gone-plugin converge).
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // D-01 / PU-5: standalone uninstall of an already-gone (not-installed)
    // plugin -- the marketplace IS present, so the header renders; the absent
    // target reports an `error` row (was literal silence). The orchestrated
    // reconcile converge stays silent (no row) per WR-06 / NFR-2.
    "already-gone-not-installed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
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
    // target, so the brace names it beside `not installed` -- the scope word is
    // always the OPPOSITE of the row's bracket.
    "already-gone-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
                reasons: ["not installed", "marketplace in project scope"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // LOAD-03 / D-06-06: other installed plugins in the scope still declared
    // the target and the removal went through anyway. The token rides the
    // SUCCESS row; the dependents ride the cause line, never the token.
    // The row is `info`, so the fixture omits `expectedSeverity`: notify
    // passes no second argument on the info arm.
    "success-dependents-unsatisfied": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                severity: "info",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                reasons: ["dependents unsatisfied"],
                cause: new Error("required by deploy-kit@official"),
              },
            ],
          },
        ],
      },
    },

    // D-05-07: some OTHER record's declarations could not be established, so
    // the uninstall is refused rather than risked. The brace carries the D-47-B
    // `unreadable` default -- a token about the declarer would make a false
    // claim about the target -- and the cause names which record it was.
    "refused-declarer-unreadable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["unreadable"],
                cause: new Error(
                  "cannot read the dependencies of other@official: not declared by its marketplace, and its installed copy cannot be read",
                ),
              },
            ],
          },
        ],
      },
    },

    // D-05-01 / D-05-02 / D-05-11 / PRUNE-04: `--prune` swept two orphaned
    // dependency records out after the named plugin -- one under the same
    // marketplace, one under another. The named plugin's block comes first,
    // then one block per other marketplace that lost a member.
    "success-prune": {
      pi: piWithBothLoaded(),
      // fallow-ignore-next-line code-duplication -- reviewed: each catalog state spells out its full expected message, so a state reads on its own
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
              {
                status: "uninstalled",
                name: "shared-lib",
                version: "2.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "community",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "tooling",
                version: "3.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // D-05-09: the data disposition covers every plugin the command removed,
    // and each pruned row says why it went before what was kept.
    "success-prune-keep-data": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                reasons: ["data kept"],
                severity: "info",
                needsReload: true,
              },
              {
                status: "uninstalled",
                name: "shared-lib",
                version: "2.0.0",
                reasons: ["dependency pruned", "data kept"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // D-05-13: a pruned member whose removal failed renders its own warning
    // row beside the rows that succeeded; the named plugin's removal and the
    // other members' stand, so the block computes `warning`.
    "prune-partial-failure": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
              {
                status: "uninstalled",
                name: "shared-lib",
                version: "2.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "community",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "warning",
                needsReload: false,
                name: "tooling",
                version: "3.0.0",
                reasons: ["source mismatch"],
                cause: new Error("Agents unstage refused: foreign content"),
              },
            ],
          },
        ],
      },
    },

    // LAYER-04: a named uninstall without --local acts on the base layer, so
    // a plugin only the local layer declares is refused and nothing changes.
    "uninstall-plugin-in-local-layer-only": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["plugin in local layer only"],
                cause: new Error(
                  "The plugin helper@official is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
                ),
              },
            ],
          },
        ],
      },
    },

    // LAYER-04: the mirror refusal of a named uninstall with --local.
    "uninstall-plugin-in-base-layer-only": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["plugin in base layer only"],
                cause: new Error(
                  "The plugin helper@official is declared only in the base config (claude-plugins.json). Run the command again without --local.",
                ),
              },
            ],
          },
        ],
      },
    },

    // LAYER-05: both layers declare the plugin, so a flagless uninstall drops
    // only the base declaration and keeps the installation. A warning: the
    // plugin the user asked to uninstall is still there.
    "uninstall-still-installed-in-other-layer": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "warning",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["still installed in local layer"],
                cause: new Error("Run the command again with --local to uninstall it."),
              },
            ],
          },
        ],
      },
    },

    // LAYER-08: no layer declares the target, and a plugin the target layer
    // declares still needs it, so the uninstall is refused.
    "uninstall-dependency-needed-in-layer": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "shared-lib",
                version: "1.0.0",
                reasons: ["dependents remain"],
                cause: new Error("Uninstall helper@official first, then shared-lib@official."),
              },
            ],
          },
        ],
      },
    },

    // LAYER-08: only a plugin the other layer declares needs the target, so
    // the uninstall removes nothing and names that layer.
    "uninstall-dependency-needed-in-other-layer": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "warning",
                needsReload: false,
                name: "shared-lib",
                version: "1.0.0",
                reasons: ["dependents remain"],
                cause: new Error(
                  "The local config (claude-plugins.local.json) declares helper@official, which needs shared-lib@official.",
                ),
              },
            ],
          },
        ],
      },
    },
  },
};
