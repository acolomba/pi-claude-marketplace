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

    // ATTR-06 / D-48-C Shape 1: explicit-scope remove of a name not added
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

    // ATTR-06: bare-form remove of a name absent from BOTH scopes -> the
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

    // LAYER-02: a command without --local names a marketplace only the local config declares.
    "remove-marketplace-in-local-layer-only": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace remove",
        cardinality: "single",
        marketplaces: [
          {
            name: "tools",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "tools",
                reasons: ["marketplace in local layer only"],
                cause: new Error(
                  "The marketplace tools is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
                ),
              },
            ],
          },
        ],
      },
    },

    // LAYER-02: a --local command names a marketplace only the base config declares.
    "remove-marketplace-in-base-layer-only": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace remove",
        cardinality: "single",
        marketplaces: [
          {
            name: "tools",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "tools",
                reasons: ["marketplace in base layer only"],
                cause: new Error(
                  "The marketplace tools is declared only in the base config (claude-plugins.json). Run the command again without --local.",
                ),
              },
            ],
          },
        ],
      },
    },

    // LAYER-03: the remove of a marketplace holding a dependency cannot read a declaration.
    "remove-dependency-declarations-unreadable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace remove",
        cardinality: "single",
        marketplaces: [
          {
            name: "tools",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "tools",
                reasons: ["unreadable"],
                cause: new Error(
                  "cannot read the dependencies of lib@tools: its marketplace manifest is invalid",
                ),
              },
            ],
          },
        ],
      },
    },
    "remove-dependents-remain": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace remove",
        cardinality: "single",
        marketplaces: [
          {
            name: "tools",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "alpha",
                reasons: ["dependents remain"],
                cause: new Error(
                  "Uninstall beta@tools first, then remove the marketplace tools again.",
                ),
              },
            ],
          },
        ],
      },
    },
    "remove-other-config-file-invalid": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace remove",
        cardinality: "single",
        marketplaces: [
          {
            name: "tools",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "tools",
                reasons: ["invalid manifest"],
                cause: new Error(
                  'Config file "claude-plugins.local.json" failed schema validation.',
                ),
              },
            ],
          },
        ],
      },
    },
  },
};
