import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin fetch command surface. */
export const PLUGIN_FETCH_FIXTURES: FixtureMap = {
  "/claude:plugin fetch": {
    // FTCH-02: a cold git-source plugin warmed to an installable tree resolves
    // `available`; the bare row omits the scope bracket (MSG-PL-6 / SNM-11).
    // Single cardinality -> no tally. Info; no reload-hint.
    "single-available": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "available",
                name: "gp",
                version: "1.0.0",
              },
            ],
          },
        ],
      },
    },

    // FTCH-02: the warmed tree resolves `partially-available`; the `⊖` row
    // carries the `{lsp}` degrade reason via the same narrowUnsupportedKinds
    // seam `list` uses. Info; no reload-hint.
    "single-partially-available": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "gp",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // FTCH-03 / D-81-02: a path/non-git source or a pinned-warm clone is a
    // no-op; the row is `⊘ (skipped) {up-to-date}` at info severity, carrying
    // the existing `up-to-date` reason (closed set does not grow).
    "single-noop-skipped": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "gp",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // FTCH-02 / D-81-01: the plural sweep captures a per-plugin throw as a
    // `(failed)` row and continues; the succeeding plugin renders its fresh
    // derived status row. The default tally counts the info row as one success
    // and folds the failure in -> `Plugin fetch: 1 failure, 1 success`.
    // Severity `error` (first-match wins); no reload-hint (a fetch installs
    // nothing).
    "bulk-mixed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin fetch",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "available",
                name: "ok",
                version: "1.0.0",
              },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "bad",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },
  },
};
