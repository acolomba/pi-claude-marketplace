import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the marketplace noautoupdate command surface. */
export const MARKETPLACE_NOAUTOUPDATE_FIXTURES: FixtureMap = {
  "/claude:plugin marketplace autoupdate|noautoupdate [<name>]": {
    "disable-fresh": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace noautoupdate",
        cardinality: "single",
        marketplaces: [{ name: "foo", scope: "user", status: "autoupdate disabled", plugins: [] }],
      },
    },
    "disable-idempotent": {
      pi: piWithBothLoaded(),
      // Benign idempotent flip (`already no autoupdate` in BENIGN_REASONS) ->
      // INFO per UXG-02 / D-28-07 (no `expectedSeverity`); byte form unchanged.
      message: {
        label: "Marketplace noautoupdate",
        cardinality: "single",
        marketplaces: [
          {
            name: "foo",
            scope: "user",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["already no autoupdate"],
            plugins: [],
          },
        ],
      },
    },
  },
};
