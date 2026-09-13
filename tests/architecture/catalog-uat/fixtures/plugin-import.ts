import { piWithBothLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin import command surface. */
export const PLUGIN_IMPORT_FIXTURES: FixtureMap = {
  "/claude:plugin import": {
    "fresh-mixed-both-scopes": {
      pi: piWithBothLoaded(),
      // WR-02: the lone `unavailable` row now stamps `warning`, so the cascade
      // reduces to warning severity at the wire.
      expectedSeverity: "warning",
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "official-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "official-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "directory-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "local-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "directory-marketplace",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "local-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
              // WR-02: the import producer stamps unavailable rows `warning`
              // (actionable -- the user cannot complete the install without
              // addressing them), bumping the envelope severity and counting
              // the row under the warning tally rather than success.
              {
                status: "unavailable",
                name: "unavailable-plugin",
                reasons: ["unsupported hooks"],
                severity: "warning",
                needsReload: false,
              },
            ],
          },
          {
            name: "github-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "github-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "github-marketplace",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "github-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "scope-project-narrow": {
      pi: piWithBothLoaded(),
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "official-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "directory-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "local-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "github-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "github-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "soft-dep-markers": {
      pi: piWithNothingLoaded(),
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "agent-only-plugin",
                dependencies: ["agents"],
              },
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "dual-plugin",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "alpha",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "beta",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
  },
};
