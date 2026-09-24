import { piWithAllLoaded, piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/**
 * WR-06: the retained workflow staging advisory line, shared by the two pending
 * fixtures that carry it. One constant for both arms is the byte-identity claim
 * made testable: the arms differ only in the body the line is appended to.
 */
const RETAINED_WORKFLOW_STAGING_ADVISORY =
  "    retained workflow staging: 9f1c4d2a-3b7e (2 envelopes) under the workflows staging directory";

/** Catalog fixtures for the plugin pending command surface. */
export const PLUGIN_PENDING_FIXTURES: FixtureMap = {
  "/claude:plugin pending": {
    "empty-steady-state": {
      pi: piWithBothLoaded(),
      // Dedicated standalone variant; the renderer hard-codes the advisory
      // body line so the byte form cannot drift from the catalog state.
      message: { kind: "reconcile-pending-empty" },
    },
    // WR-06: the retained workflow staging advisory on the standalone arm. The
    // line carries the tree's directory NAME and its envelope count and
    // interpolates no absolute path (T-53-02-02), which is also what makes it
    // pinnable by byte equality at all.
    "empty-steady-state-retained-workflow-staging": {
      pi: piWithAllLoaded(),
      message: {
        kind: "reconcile-pending-empty",
        advisories: [RETAINED_WORKFLOW_STAGING_ADVISORY],
      },
    },
    // WILL-01 / D-65.1-02: marketplace add is immediate (no `will add` token);
    // the child install is the reload-deferred work, rendered under a bare
    // list-arm header (no marketplace status).
    "mp-add-plugin-install": {
      pi: piWithBothLoaded(),
      message: {
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
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [{ status: "will uninstall", name: "old-plugin" }],
          },
        ],
      },
    },
    // WR-06: the SAME advisory constant on the cascade arm. Both fixtures read
    // one constant, so a catalog block that drifted from its sibling would fail
    // byte equality here rather than shipping two spellings of one fact.
    "plugin-pending-uninstall-retained-workflow-staging": {
      pi: piWithAllLoaded(),
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [{ status: "will uninstall", name: "old-plugin" }],
          },
        ],
        advisories: [RETAINED_WORKFLOW_STAGING_ADVISORY],
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
        marketplaces: [
          {
            name: "old-mp",
            scope: "user",
            plugins: [
              { status: "will uninstall", name: "p1" },
              { status: "will uninstall", name: "p2" },
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
  },
};
