import { piWithAllLoaded, piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/**
 * Catalog fixtures for the plugin pending command surface. APL-04 / D-14: each
 * state with a `will ...` row sets `needsApply`, as the pending composer does.
 */
export const PLUGIN_PENDING_FIXTURES: FixtureMap = {
  "/claude:plugin pending": {
    "empty-steady-state": {
      pi: piWithBothLoaded(),
      // Dedicated standalone variant; the renderer hard-codes the advisory
      // body line so the byte form cannot drift from the catalog state.
      message: { kind: "reconcile-pending-empty", command: "pending" },
    },
    // WR-06: the retained workflow staging advisory on the standalone arm. The
    // line carries the tree's directory NAME and its envelope count and
    // interpolates no absolute path (T-53-02-02), which is also what makes it
    // pinnable by byte equality at all.
    "empty-steady-state-retained-workflow-staging": {
      pi: piWithAllLoaded(),
      message: {
        kind: "reconcile-pending-empty",
        command: "pending",
        retainedWorkflows: [{ name: "9f1c4d2a-3b7e", envelopeCount: 2 }],
      },
    },
    // WILL-01 / D-65.1-02: marketplace add is immediate (no `will add` token);
    // the child install is the reload-deferred work, rendered under a bare
    // list-arm header (no marketplace status).
    "mp-add-plugin-install": {
      pi: piWithBothLoaded(),
      message: {
        needsApply: true,
        marketplaces: [
          {
            name: "new-mp",
            scope: "user",
            plugins: [{ status: "will install", name: "new-plugin" }],
          },
        ],
      },
    },
    // FSTAT-06 / D-66-04: a pending child install whose no-network candidate
    // resolves `partially-available` carries the `partial` modifier, rendering
    // `(will partially install)` in place of `(will install)`. A render modifier,
    // not a new token; no `will partially update` analog exists (D-66-05).
    "mp-add-plugin-partial-install": {
      pi: piWithBothLoaded(),
      message: {
        needsApply: true,
        marketplaces: [
          {
            name: "new-mp",
            scope: "user",
            plugins: [{ status: "will install", name: "degraded-plugin", partial: true }],
          },
        ],
      },
    },
    "plugin-pending-uninstall": {
      pi: piWithBothLoaded(),
      message: {
        needsApply: true,
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [{ status: "will uninstall", name: "old-plugin", version: "1.0.0" }],
          },
        ],
      },
    },
    // WR-06: both pending arms format the same observed name and count.
    "plugin-pending-uninstall-retained-workflow-staging": {
      pi: piWithAllLoaded(),
      message: {
        needsApply: true,
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [{ status: "will uninstall", name: "old-plugin", version: "1.0.0" }],
          },
        ],
        retainedWorkflows: [{ name: "9f1c4d2a-3b7e", envelopeCount: 2 }],
      },
    },
    // WILL-03 / D-65.1-03: removing a marketplace that still has installed
    // plugins is reload-deferred ONLY for its plugin-uninstall cascade --
    // de-registration itself is immediate (no `will remove` marketplace token).
    // The pending preview renders the bare list-arm header (no marketplace
    // status) plus one `(will uninstall)` row per recorded plugin, byte-identical
    // to the surviving `plugin-pending-uninstall` form above.
    "marketplace-remove-with-installed-plugins": {
      pi: piWithBothLoaded(),
      message: {
        needsApply: true,
        marketplaces: [
          {
            name: "old-mp",
            scope: "user",
            plugins: [
              { status: "will uninstall", name: "p1", version: "1.0.0" },
              { status: "will uninstall", name: "p2", version: "2.3.0" },
            ],
          },
        ],
      },
    },
    "enable-disable-transitions": {
      // The will-enable bucket is populated only by the
      // recorded-but-disabled marker; the catalog fixture is hand-constructed
      // (not routed through planReconcile) so the enable-bucket wiring can
      // land against an exercised path.
      pi: piWithBothLoaded(),
      message: {
        needsApply: true,
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              { status: "will enable", name: "to-enable" },
              { status: "will disable", name: "to-disable" },
            ],
          },
        ],
      },
    },
    "source-mismatch": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["source mismatch"],
            plugins: [],
          },
        ],
      },
    },
    "invalid-config-abort": {
      // CFG-03: the marketplace `name` is the file BASENAME
      // (never the absolute path -- T-53-02-02 information-disclosure
      // mitigation). The orchestrator passes path.basename(filePath).
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins.json",
            scope: "project",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["invalid manifest"],
            plugins: [],
          },
        ],
      },
    },

    // LAYER-06: the same layer error in the pending diff; pending plans
    // nothing for the scope. The file heads its block with no status, so the
    // one failed row is the one error the tally counts.
    "pending-layer-marketplace-undeclared": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Reconcile pending",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins.local.json",
            scope: "project",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "claude-plugins.local.json",
                reasons: ["invalid manifest"],
                cause: new Error(
                  "The local config (claude-plugins.local.json) declares helper@official, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config.",
                ),
              },
            ],
          },
        ],
      },
    },
  },
};
