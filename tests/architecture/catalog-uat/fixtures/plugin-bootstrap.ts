import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin bootstrap command surface. */
export const PLUGIN_BOOTSTRAP_FIXTURES: FixtureMap = {
  "/claude:plugin bootstrap": {
    fresh: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "added",
            plugins: [],
          },
        ],
      },
    },

    "already-bootstrapped": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "updated",
            plugins: [],
          },
        ],
      },
    },
  },
};
