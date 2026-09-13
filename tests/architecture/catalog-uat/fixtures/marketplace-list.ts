import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the marketplace list command surface. */
export const MARKETPLACE_LIST_FIXTURES: FixtureMap = {
  "/claude:plugin marketplace list": {
    empty: {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace list",
        cardinality: "plural",
        marketplaces: [],
      },
    },

    single: {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace list",
        cardinality: "plural",
        marketplaces: [{ name: "alpha", scope: "project", severity: "info", plugins: [] }],
      },
    },

    "mixed-scopes": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace list",
        cardinality: "plural",
        marketplaces: [
          {
            name: "alpha",
            scope: "project",
            details: { autoupdate: true },
            severity: "info",
            plugins: [],
          },
          { name: "alpha", scope: "user", severity: "info", plugins: [] },
          { name: "beta", scope: "user", severity: "info", plugins: [] },
          {
            name: "zeta",
            scope: "project",
            details: { autoupdate: true },
            severity: "info",
            plugins: [],
          },
        ],
      },
    },
  },
};
