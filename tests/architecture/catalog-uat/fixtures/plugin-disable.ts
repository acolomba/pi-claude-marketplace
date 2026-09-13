import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for plugin disable and its manual-recovery anchor. */
export const PLUGIN_DISABLE_FIXTURES: FixtureMap = {
  "/claude:plugin disable <plugin>@<marketplace>": {
    "disable-fresh": {
      pi: piWithBothLoaded(),
      // UAT-03: the fresh-disable
      // row carries the closed-set `(disabled)` token -- same glyph + token
      // as the disabled-inventory row, version slot kept. RLD-05 / D-07: the
      // reload-hint fires via the row's `needsReload: true` stamp (RLD-02
      // OR-reduce), not a cascade kind; list/info inventory `disabled` rows
      // stamp `needsReload: false` and stay hint-free.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
              },
            ],
          },
        ],
      },
    },

    "disable-idempotent": {
      pi: piWithBothLoaded(),
      // Benign reason -> info severity.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "info",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["already disabled"],
              },
            ],
          },
        ],
      },
    },

    "disable-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      },
    },

    "disable-invalid-config": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["invalid manifest"],
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // Manual recovery anchors -- per-plugin manual-recovery row inside a block.
  // -------------------------------------------------------------------------
  "manual-recovery-anchors": {
    "per-plugin-manual-recovery": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "manual recovery",
                severity: "warning",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["unreadable"],
                cause: new Error("bridge: agent staging conflict"),
              },
            ],
          },
        ],
      },
    },
  },
};
