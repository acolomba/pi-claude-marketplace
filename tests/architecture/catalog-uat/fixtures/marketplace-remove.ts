import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the marketplace remove command surface. */
export const MARKETPLACE_REMOVE_FIXTURES: FixtureMap = {
  "/claude:plugin marketplace remove <name>": {
    clean: {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace remove",
        cardinality: "single",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "removed",
            plugins: [
              { status: "uninstalled", name: "helper", severity: "info", needsReload: true },
            ],
          },
        ],
      },
    },

    partial: {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace remove",
        cardinality: "single",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            plugins: [
              { status: "uninstalled", name: "helper", severity: "info", needsReload: true },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "tool",
                reasons: ["permission denied"],
                cause: new Error("EACCES: permission denied"),
              },
            ],
          },
        ],
      },
    },

    // ATTR-06 / S3 / D-48-C Shape 1: explicit-scope remove of a name not added
    // in the requested scope -> standalone `marketplace-not-added` `{marketplace not added}`
    // variant carrying the requested scope bracket (pre-guard miss; no raw
    // MarketplaceNotFoundError escapes the orchestrator).
    "remove-missing-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      },
    },

    // ATTR-06 / S4: bare-form remove of a name absent from BOTH scopes -> the
    // SAME standalone variant with NO bracket (resolveScopeFromState's
    // MarketplaceNotFoundError caught at the entrypoint, absent-from-both form).
    "remove-missing-not-added-bare": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      },
    },
  },
};
