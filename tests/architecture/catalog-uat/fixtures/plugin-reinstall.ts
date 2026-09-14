import { piWithBothLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { NotificationMessage } from "../../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin reinstall command surface. */
export const PLUGIN_REINSTALL_FIXTURES: FixtureMap = {
  "/claude:plugin reinstall": {
    "single-mp-all-reinstalled": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "beta",
                version: "0.5.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    "success-with-soft-dep": {
      pi: piWithNothingLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / WR-09: a component the reinstall's own ledger degraded names
    // its kind on the `(reinstalled)` row and takes the info -> warning raise,
    // matching the install / enable / backfill arms.
    "reinstall-degraded-component": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },

    // ENBL-05 / ENBL-18 / DFEN-07: a cascade reaching an already-disabled
    // record short-circuits before the resolve, so nothing is re-materialized
    // and the record keeps its component inventory. The row is benign and
    // idempotent, hence info severity and no summary line; the reload hint
    // still fires off the sibling `(reinstalled)` row, and the plural tally
    // counts the informational skip as a success.
    "reinstall-disabled-record-cascade": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["already disabled"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "single-mp-mixed-outcomes": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
              {
                status: "failed",
                name: "delta",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "single-mp-all-failed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "alpha",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "beta",
                reasons: ["invalid manifest"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "plugin-became-unavailable": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "unavailable", name: "delta", reasons: ["unsupported hooks"] },
            ],
          },
        ],
      },
    },

    "bare-multi-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "helper",
                version: "0.5.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "tool",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
              {
                status: "failed",
                name: "delta",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "beta",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // CR-02 / D-01: standalone reinstall of a present marketplace whose plugin
    // record is absent -> the `(skipped) {not installed}` row stamps `error`
    // (absent-target across the board), single cardinality so no tally. Mirrors
    // the byte form the `reinstallPlugin` standalone path now emits.
    "standalone-not-installed-error": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                name: "hello",
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
    // target, so the brace names it beside `not installed`.
    "reinstall-not-installed-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                reasons: ["not installed", "marketplace in user scope"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // ATTR-03 / SCOPE-01 / M6 / M7 / M8: marketplace not added in the requested
    // explicit scope (or present only in the other scope) -> standalone
    // `marketplace-not-added` variant carrying the requested-scope bracket,
    // form-independent across the explicit-scope-plugin / explicit-scope-
    // marketplace forms.
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "project",
      } satisfies NotificationMessage,
    },

    // ATTR-03: bare `reinstall @<marketplace>` form absent in BOTH scopes ->
    // standalone `marketplace-not-added` variant with NO bracket (the
    // absent-from-both form; no requested scope to report).
    "missing-marketplace-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      } satisfies NotificationMessage,
    },
  },
};
