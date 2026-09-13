import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the marketplace autoupdate command surface. */
export const MARKETPLACE_AUTOUPDATE_FIXTURES: FixtureMap = {
  "/claude:plugin marketplace autoupdate|noautoupdate [<name>]": {
    "enable-fresh": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace autoupdate",
        cardinality: "single",
        marketplaces: [{ name: "foo", scope: "user", status: "autoupdate enabled", plugins: [] }],
      },
    },
    "enable-idempotent": {
      pi: piWithBothLoaded(),
      // Benign idempotent flip (`already autoupdate` in BENIGN_REASONS) ->
      // INFO per UXG-02 / D-28-07 (no `expectedSeverity`); byte form unchanged.
      message: {
        label: "Marketplace autoupdate",
        cardinality: "single",
        marketplaces: [
          {
            name: "foo",
            scope: "user",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["already autoupdate"],
            plugins: [],
          },
        ],
      },
    },
    "all-empty": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace autoupdate",
        cardinality: "plural",
        marketplaces: [],
      },
    },

    "all-one": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace autoupdate",
        cardinality: "plural",
        marketplaces: [
          { name: "foo", scope: "project", status: "autoupdate enabled", plugins: [] },
        ],
      },
    },

    "all-many": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace autoupdate",
        cardinality: "plural",
        marketplaces: [
          { name: "foo", scope: "project", status: "autoupdate enabled", plugins: [] },
          {
            name: "bar",
            scope: "user",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["already autoupdate"],
            plugins: [],
          },
        ],
      },
    },

    // ATTR-05 / S1 / D-48-C Shape 1: an explicit-scope flip of a name not
    // added in the requested scope routes to the standalone
    // `marketplace-not-added` `{marketplace not added}` variant carrying the
    // requested scope bracket.
    "autoupdate-missing-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "missing-mp",
        scope: "user",
      },
    },

    // ATTR-05 / S2: the bare form absent from EVERY iterated scope routes to
    // the SAME standalone variant carrying `first.scope` (project-before-user
    // SC-6 order -> `[project]`).
    "autoupdate-missing-not-added-bare": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "missing-mp",
        scope: "project",
      },
    },
  },
};
