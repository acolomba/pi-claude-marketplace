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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
                severity: "info",
                needsReload: true,
                name: "agent-only-plugin",
                dependencies: ["agents"],
              },
              {
                status: "installed",
                version: "1.0.0",
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
                version: "1.0.0",
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
                version: "1.0.0",
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

    "dependency-cascade-failed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                version: "1.0.0",
                name: "before",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
              // RESV-06: a `DependencyCascadeError` throw collapses onto the
              // requesting plugin's own row -- `{dependency failed}` plus the
              // failing dependency's cause line -- exactly as reconcile's
              // load-time counterpart renders it (no separate dependency row).
              {
                status: "failed",
                name: "hello",
                reasons: ["dependency failed"],
                cause: new Error('Dependency "missing@mp" is not declared by its marketplace.'),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // UPD-DEP-D1 / WR-N5: the dependency an install moved first reports its
    // own row after the plugin's, by its full key.
    "import-dependency-moved": {
      pi: piWithBothLoaded(),
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            status: "skipped",
            reasons: ["already added"],
            plugins: [
              {
                status: "installed",
                version: "1.0.0",
                name: "app",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
              {
                status: "updated",
                name: "lib@mp",
                from: "1.0.0",
                to: "2.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "repeat-import-skips": {
      pi: piWithBothLoaded(),
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "fixtures",
            scope: "user",
            status: "skipped",
            reasons: ["already added"],
            plugins: [
              {
                status: "skipped",
                name: "demo",
                reasons: ["already installed"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "lock-held": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "fixtures",
            scope: "user",
            status: "failed",
            severity: "error",
            plugins: [
              {
                status: "failed",
                name: "fixtures",
                reasons: ["lock held"],
                cause: new Error(
                  "Another pi-claude-marketplace operation is in progress for user scope (~/.pi/agent/pi-claude-marketplace/.state-lock). Retry after it completes.",
                  { cause: new Error("Lock file is already being held") },
                ),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
  },
};
