import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Independent structured inputs for the standalone prune catalog bytes. */
export const PLUGIN_PRUNE_FIXTURES: FixtureMap = {
  "/claude:plugin prune": {
    "actual-one-orphan": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "shared-lib",
                version: "2.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "actual-interleaved-chain": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "community",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "tooling",
                version: "3.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "shared-lib",
                version: "2.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "pending-one-orphan": {
      pi: piWithBothLoaded(),
      message: {
        kind: "cascade",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "will uninstall",
                name: "shared-lib",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "pending-interleaved-chain": {
      pi: piWithBothLoaded(),
      message: {
        kind: "cascade",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "will uninstall",
                name: "helper",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
          {
            name: "community",
            scope: "user",
            plugins: [
              {
                status: "will uninstall",
                name: "tooling",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "will uninstall",
                name: "shared-lib",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "empty-user-scope": {
      pi: piWithBothLoaded(),
      message: { kind: "prune-empty", scope: "user" },
    },
    "member-failure-independent-success": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
                version: "1.0.0",
                reasons: ["source mismatch"],
                cause: new Error("Agents unstage refused: foreign content"),
                severity: "warning",
                needsReload: false,
              },
            ],
          },
          {
            name: "community",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "tooling",
                version: "3.0.0",
                reasons: ["dependency pruned"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "unreadable-declarer": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "other",
                reasons: ["unreadable"],
                cause: new Error(
                  "cannot read the dependencies of other@official: not declared by its marketplace",
                ),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "malformed-state": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "(prune)",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "(prune)",
                reasons: ["unreadable"],
                cause: new Error(
                  "state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
                  {
                    cause: new SyntaxError(
                      "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
                    ),
                  },
                ),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "lock-held": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "(prune)",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "(prune)",
                reasons: ["lock held"],
                cause: new Error(
                  "Another pi-claude-marketplace operation is in progress for user scope (.state-lock). Retry after it completes.",
                  { cause: new Error("Lock file is already being held") },
                ),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
    "rollback-partial": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "(prune)",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "(prune)",
                reasons: ["rollback partial"],
                cause: new Error(
                  "Prune rollback was incomplete; the backup was retained for recovery.",
                  {
                    cause: new Error("state save failed"),
                  },
                ),
                rollbackPartial: [
                  {
                    phase: "skills",
                    cause: new Error(
                      "Prune rollback found an occupied artifact at mp-orphan-skill.",
                    ),
                  },
                ],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
        cardinality: "single",
      },
    },
  },
};
