import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin pending command surface. */
export const PLUGIN_PENDING_FIXTURES: FixtureMap = {
  "/claude:plugin pending": {
    "empty-steady-state": {
      pi: piWithBothLoaded(),
      // Dedicated standalone variant; the renderer hard-codes the advisory
      // body line so the byte form cannot drift from the catalog state.
      message: { kind: "reconcile-pending-empty" },
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
