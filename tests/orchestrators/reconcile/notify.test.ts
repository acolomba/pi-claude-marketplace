import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  buildReconcileAppliedCascade,
  buildReconcilePendingNotification,
  isReconcilePlanListEmpty,
  resolvePendingForceInstalls,
  type PendingInstallCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type {
  PlannedPluginInstall,
  ReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * DIFF-02 / RECON-04 projection owner. Both entrypoints are pure functions of
 * plain data, so every case supplies complete case-local inputs and compares the
 * complete returned message. Expected messages are authored by hand from the
 * closed reason / status vocabularies -- never by calling a production
 * projector, formatter, or classifier.
 */

type AppliedCascade = ReturnType<typeof buildReconcileAppliedCascade>;
type PlannedActions = Partial<Omit<ReconcilePlan, "scope">>;

function reconcilePlan(scope: Scope, actions: PlannedActions = {}): ReconcilePlan {
  return {
    scope,
    marketplacesToAdd: [...(actions.marketplacesToAdd ?? [])],
    marketplacesToRemove: [...(actions.marketplacesToRemove ?? [])],
    pluginsToInstall: [...(actions.pluginsToInstall ?? [])],
    pluginsToUninstall: [...(actions.pluginsToUninstall ?? [])],
    pluginsToEnable: [...(actions.pluginsToEnable ?? [])],
    pluginsToDisable: [...(actions.pluginsToDisable ?? [])],
    sourceMismatches: [...(actions.sourceMismatches ?? [])],
  };
}

/**
 * One canonical outcome per `PerEntryOutcome` kind, keyed by that kind. The
 * mapped key set is what pins the table to the union: a kind added to
 * `PerEntryOutcome` without a cell here fails to compile, and a cell whose
 * outcome does not match its key fails to compile too.
 */
type AppliedOutcomeRows = {
  readonly [K in PerEntryOutcome["kind"]]: {
    readonly outcome: Extract<PerEntryOutcome, { kind: K }>;
    readonly expected: AppliedCascade;
  };
};

function appliedOutcomeRows(): AppliedOutcomeRows {
  return {
    "mp-added": {
      outcome: { kind: "mp-added", scope: "project", marketplace: "mp" },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [{ name: "mp", scope: "project", status: "added", plugins: [] }],
      },
    },
    "mp-removed": {
      outcome: { kind: "mp-removed", scope: "project", marketplace: "mp" },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [{ name: "mp", scope: "project", status: "removed", plugins: [] }],
      },
    },
    "mp-add-failed": {
      outcome: {
        kind: "mp-add-failed",
        scope: "project",
        marketplace: "mp",
        reason: "network unreachable",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [],
            reasons: ["network unreachable"],
          },
        ],
      },
    },
    "mp-remove-failed": {
      outcome: {
        kind: "mp-remove-failed",
        scope: "project",
        marketplace: "mp",
        reason: "plugins remain",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [],
            reasons: ["plugins remain"],
          },
        ],
      },
    },
    "mp-remove-partial": {
      outcome: { kind: "mp-remove-partial", scope: "project", marketplace: "mp" },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          { name: "mp", scope: "project", status: "failed", severity: "error", plugins: [] },
        ],
      },
    },
    "plugin-installed": {
      outcome: {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: ["agents"],
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "installed",
                name: "cr",
                version: "1.0.0",
                dependencies: ["agents"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "plugin-backfilled": {
      outcome: {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: ["mcp"],
        installable: true,
        unsupported: [],
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "installed",
                name: "cr",
                version: "1.0.0",
                dependencies: ["mcp"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "plugin-uninstalled": {
      outcome: {
        kind: "plugin-uninstalled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "uninstalled",
                name: "cr",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "plugin-enabled": {
      outcome: {
        kind: "plugin-enabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "installed",
                name: "cr",
                version: "1.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "plugin-disabled": {
      outcome: {
        kind: "plugin-disabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "disabled",
                name: "cr",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "plugin-install-failed": {
      outcome: {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reason: "not in manifest",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "cr",
                reasons: ["not in manifest"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
    "plugin-uninstall-failed": {
      outcome: {
        kind: "plugin-uninstall-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reason: "not installed",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "cr",
                reasons: ["not installed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
    "plugin-enable-failed": {
      outcome: {
        kind: "plugin-enable-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reason: "no longer installable",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "cr",
                reasons: ["no longer installable"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
    "plugin-disable-failed": {
      outcome: {
        kind: "plugin-disable-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reason: "lock held",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "cr",
                reasons: ["lock held"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
    "source-mismatch": {
      outcome: {
        kind: "source-mismatch",
        cause: "source-mismatch",
        scope: "project",
        marketplace: "mp",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [],
            reasons: ["source mismatch"],
          },
        ],
      },
    },
    "invalid-block": {
      outcome: {
        kind: "invalid-block",
        scope: "project",
        basename: "claude-plugins.json",
        reason: "invalid manifest",
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "claude-plugins.json",
            scope: "project",
            status: "failed",
            severity: "error",
            plugins: [],
            reasons: ["invalid manifest"],
          },
        ],
      },
    },
  };
}

describe("buildReconcileAppliedCascade", () => {
  for (const [kind, { outcome, expected }] of Object.entries(appliedOutcomeRows())) {
    test(`projects the complete cascade for a ${kind} outcome`, () => {
      // arrange
      const outcomes = [outcome];

      // act
      const cascade = buildReconcileAppliedCascade(outcomes);

      // assert
      assert.deepStrictEqual(cascade, expected);
    });
  }

  test("returns no marketplace blocks for an empty outcome list", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, { kind: "reconcile-applied-cascade", marketplaces: [] });
  });

  test("keeps the marketplace reasons brace off a partial remove while a failed remove keeps its own", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      { kind: "mp-remove-partial", scope: "user", marketplace: "partial-mp" },
      {
        kind: "mp-remove-failed",
        scope: "user",
        marketplace: "stuck-mp",
        reason: "plugins remain",
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "partial-mp",
          scope: "user",
          status: "failed",
          severity: "error",
          plugins: [],
        },
        {
          name: "stuck-mp",
          scope: "user",
          status: "failed",
          severity: "error",
          plugins: [],
          reasons: ["plugins remain"],
        },
      ],
    });
  });

  test("renders the structural marketplace-absent marker as the not-found content reason", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      { kind: "mp-remove-failed", scope: "user", marketplace: "absent-mp", reason: "not added" },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "absent-mp",
          scope: "user",
          status: "failed",
          severity: "error",
          plugins: [],
          reasons: ["not found"],
        },
      ],
    });
  });

  test("attaches the redacted diagnostic to an invalid-config block as a synthetic child row", () => {
    // arrange
    const cause = new Error("schema validation failed for marketplaces");
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "invalid-block",
        scope: "project",
        basename: "claude-plugins.json",
        reason: "invalid manifest",
        cause,
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "claude-plugins.json",
          scope: "project",
          status: "failed",
          severity: "error",
          reasons: ["invalid manifest"],
          plugins: [
            {
              status: "failed",
              name: "claude-plugins.json",
              reasons: ["invalid manifest"],
              cause,
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
    });
  });

  for (const { cause, outcome, subject, reasons, children } of [
    {
      cause: "source-mismatch",
      outcome: {
        kind: "source-mismatch",
        cause: "source-mismatch",
        scope: "user",
        marketplace: "mp",
      },
      subject: "mp",
      reasons: ["source mismatch"],
      children: [],
    },
    {
      cause: "unknown-stored",
      outcome: {
        kind: "source-mismatch",
        cause: "unknown-stored",
        scope: "user",
        marketplace: "mp",
      },
      subject: "mp",
      reasons: ["source mismatch"],
      children: [],
    },
    {
      cause: "dangling-reference",
      outcome: {
        kind: "source-mismatch",
        cause: "dangling-reference",
        scope: "user",
        marketplace: "phantom-mp",
        plugin: "cr",
      },
      subject: "phantom-mp",
      reasons: ["dangling reference"],
      children: [
        {
          status: "failed",
          name: "cr",
          reasons: ["dangling reference"],
          severity: "error",
          needsReload: false,
        },
      ],
    },
    {
      cause: "malformed-plugin-key",
      outcome: {
        kind: "source-mismatch",
        cause: "malformed-plugin-key",
        scope: "user",
        rawKey: "my-plugin",
      },
      subject: "my-plugin",
      reasons: ["source mismatch"],
      children: [],
    },
  ] satisfies readonly {
    cause: string;
    outcome: PerEntryOutcome;
    subject: string;
    reasons: readonly string[];
    children: readonly unknown[];
  }[]) {
    test(`names ${subject} and reports ${reasons.join(", ")} for the ${cause} cause`, () => {
      // arrange
      const outcomes = [outcome];

      // act
      const cascade = buildReconcileAppliedCascade(outcomes);

      // assert
      assert.deepStrictEqual(cascade, {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: subject,
            scope: "user",
            status: "failed",
            severity: "error",
            reasons,
            plugins: children,
          },
        ],
      });
    });
  }

  test("omits the version slot from an install row whose outcome carries no version", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        dependencies: [],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("raises an install row to warning and names one malformed token per degraded kind", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: [],
        degradedKinds: ["command", "skill"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              version: "1.0.0",
              dependencies: [],
              reasons: ["malformed skill", "malformed command"],
              severity: "warning",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("names an orphaned rewake handler on an install row without moving its severity", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: [],
        orphanRewake: true,
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              version: "1.0.0",
              dependencies: [],
              reasons: ["orphan rewake"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("emits the orphan token before the malformed tokens on one install row", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: [],
        orphanRewake: true,
        degradedKinds: ["skill"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              version: "1.0.0",
              dependencies: [],
              reasons: ["orphan rewake", "malformed skill"],
              severity: "warning",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("projects a re-enable that dropped component kinds as a partially-installed row", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-enabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        unsupported: ["lspServers"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "partially-installed",
              name: "cr",
              version: "1.0.0",
              dependencies: [],
              reasons: ["lsp"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("omits the version slot from a partially-installed re-enable row that carries no version", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-enabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        unsupported: ["hooks"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "partially-installed",
              name: "cr",
              dependencies: [],
              reasons: ["unsupported hooks"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("omits the version slot from a clean re-enable row that carries no version", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      { kind: "plugin-enabled", scope: "project", marketplace: "mp", plugin: "cr" },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("raises a re-enable row to warning when its own ledger malformed a component", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-enabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        degradedKinds: ["skill"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              version: "1.0.0",
              dependencies: [],
              reasons: ["malformed skill"],
              severity: "warning",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("declares both companion dependencies on a re-enable that staged agents and MCP servers", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-enabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        stagedAgents: true,
        stagedMcpServers: true,
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              version: "1.0.0",
              dependencies: ["agents", "mcp"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("carries every re-enable degradation signal and dependency on one partially-installed row", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-enabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        unsupported: ["lspServers"],
        orphanRewake: true,
        degradedKinds: ["command", "skill"],
        stagedAgents: true,
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "partially-installed",
              name: "cr",
              version: "1.0.0",
              dependencies: ["agents"],
              reasons: ["orphan rewake", "malformed skill", "malformed command", "lsp"],
              severity: "warning",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("projects a still-degraded backfill as a partially-installed row at info severity", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: [],
        installable: false,
        unsupported: ["lspServers"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "partially-installed",
              name: "cr",
              version: "1.0.0",
              dependencies: [],
              reasons: ["lsp"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("omits the version slot from a still-degraded backfill row that carries no version", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        dependencies: [],
        installable: false,
        unsupported: [],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "partially-installed",
              name: "cr",
              dependencies: [],
              reasons: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("omits the version slot from a fully promoted backfill row that carries no version", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        dependencies: [],
        installable: true,
        unsupported: [],
        orphanRewake: true,
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "cr",
              dependencies: [],
              reasons: ["orphan rewake"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("raises a backfill row to warning when its own ledger malformed a component", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: [],
        installable: false,
        unsupported: ["themes"],
        orphanRewake: true,
        degradedKinds: ["command"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "partially-installed",
              name: "cr",
              version: "1.0.0",
              dependencies: [],
              reasons: ["orphan rewake", "malformed command", "unsupported component"],
              severity: "warning",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("omits the version slot from an uninstall row whose outcome carries no version", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      { kind: "plugin-uninstalled", scope: "project", marketplace: "mp", plugin: "cr" },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [{ status: "uninstalled", name: "cr", severity: "info", needsReload: true }],
        },
      ],
    });
  });

  test("names the author-declared cause and the enable remedy on an install-disabled row", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-disabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reasons: ["installs disabled"],
        enableHint: true,
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "disabled",
              name: "cr",
              reasons: ["installs disabled"],
              enableHint: true,
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("folds two outcomes for one marketplace into a single block in apply order", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "fresh",
        dependencies: [],
      },
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "promoted",
        dependencies: [],
        installable: false,
        unsupported: ["lspServers"],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "fresh",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
            {
              status: "partially-installed",
              name: "promoted",
              dependencies: [],
              reasons: ["lsp"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("orders two marketplace blocks by name regardless of outcome order", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      { kind: "mp-added", scope: "user", marketplace: "zebra" },
      { kind: "mp-removed", scope: "user", marketplace: "alpha" },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        { name: "alpha", scope: "user", status: "removed", plugins: [] },
        { name: "zebra", scope: "user", status: "added", plugins: [] },
      ],
    });
  });

  test("orders two same-name marketplace blocks project before user", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      { kind: "mp-added", scope: "user", marketplace: "shared" },
      { kind: "mp-added", scope: "project", marketplace: "shared" },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        { name: "shared", scope: "project", status: "added", plugins: [] },
        { name: "shared", scope: "user", status: "added", plugins: [] },
      ],
    });
  });
});

describe("buildReconcilePendingNotification", () => {
  test("returns no marketplace blocks for an empty plan list", () => {
    // arrange
    const plans: readonly ReconcilePlan[] = [];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, { marketplaces: [] });
  });

  test("returns no marketplace blocks for a plan whose buckets are all empty", () => {
    // arrange
    const plans = [reconcilePlan("project")];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, { marketplaces: [] });
  });

  test("shows nothing pending for a marketplace add that carries no child work", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToAdd: [
          { scope: "project", marketplace: "mp", source: "acme/tools", configSource: "base" },
        ],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, { marketplaces: [] });
  });

  test("rides a planned install of a newly added marketplace on a bare header", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToAdd: [
          { scope: "project", marketplace: "mp", source: "acme/tools", configSource: "base" },
        ],
        pluginsToInstall: [
          { scope: "project", plugin: "cr", marketplace: "mp", configSource: "base" },
        ],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [{ status: "will install", name: "cr" }],
        },
      ],
    });
  });

  test("synthesizes one will-uninstall child per recorded plugin of a removed marketplace", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: ["p1", "p2"] }],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "old-mp",
          scope: "project",
          plugins: [
            { status: "will uninstall", name: "p1" },
            { status: "will uninstall", name: "p2" },
          ],
        },
      ],
    });
  });

  test("shows nothing pending for a marketplace removal that has no recorded plugins", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: [] }],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, { marketplaces: [] });
  });

  for (const { bucket, actions, expectedRow } of [
    {
      bucket: "pluginsToInstall",
      actions: {
        pluginsToInstall: [
          { scope: "project", plugin: "cr", marketplace: "mp", configSource: "base" },
        ],
      },
      expectedRow: { status: "will install", name: "cr" },
    },
    {
      bucket: "pluginsToUninstall",
      actions: { pluginsToUninstall: [{ scope: "project", plugin: "cr", marketplace: "mp" }] },
      expectedRow: { status: "will uninstall", name: "cr" },
    },
    {
      bucket: "pluginsToDisable",
      actions: { pluginsToDisable: [{ scope: "project", plugin: "cr", marketplace: "mp" }] },
      expectedRow: { status: "will disable", name: "cr" },
    },
    {
      bucket: "pluginsToEnable",
      actions: { pluginsToEnable: [{ scope: "project", plugin: "cr", marketplace: "mp" }] },
      expectedRow: { status: "will enable", name: "cr" },
    },
  ] satisfies readonly {
    bucket: string;
    actions: PlannedActions;
    expectedRow: { status: string; name: string };
  }[]) {
    test(`projects ${bucket} as a ${expectedRow.status} child under a bare header`, () => {
      // arrange
      const plans = [reconcilePlan("project", actions)];

      // act
      const pending = buildReconcilePendingNotification(plans);

      // assert
      assert.deepStrictEqual(pending, {
        marketplaces: [{ name: "mp", scope: "project", plugins: [expectedRow] }],
      });
    });
  }

  for (const { cause, mismatch, subject, reasons, children } of [
    {
      cause: "source-mismatch",
      mismatch: {
        scope: "project",
        cause: "source-mismatch",
        marketplace: "mp",
        declaredSource: "acme/new",
        recordedSource: "https://github.com/acme/old",
      },
      subject: "mp",
      reasons: ["source mismatch"],
      children: [],
    },
    {
      cause: "unknown-stored",
      mismatch: {
        scope: "project",
        cause: "unknown-stored",
        marketplace: "mp",
        declaredSource: "acme/new",
        recordedSource: "[object Object]",
      },
      subject: "mp",
      reasons: ["source mismatch"],
      children: [],
    },
    {
      cause: "dangling-reference",
      mismatch: {
        scope: "project",
        cause: "dangling-reference",
        marketplace: "phantom-mp",
        plugin: "cr",
      },
      subject: "phantom-mp",
      reasons: ["dangling reference"],
      children: [
        {
          status: "failed",
          name: "cr",
          reasons: ["dangling reference"],
          severity: "error",
          needsReload: false,
        },
      ],
    },
    {
      cause: "malformed-plugin-key",
      mismatch: { scope: "project", cause: "malformed-plugin-key", rawKey: "my-plugin" },
      subject: "my-plugin",
      reasons: ["source mismatch"],
      children: [],
    },
  ] satisfies readonly {
    cause: string;
    mismatch: ReconcilePlan["sourceMismatches"][number];
    subject: string;
    reasons: readonly string[];
    children: readonly unknown[];
  }[]) {
    test(`previews ${subject} as failed with ${reasons.join(", ")} for the ${cause} cause`, () => {
      // arrange
      const plans = [reconcilePlan("project", { sourceMismatches: [mismatch] })];

      // act
      const pending = buildReconcilePendingNotification(plans);

      // assert
      assert.deepStrictEqual(pending, {
        marketplaces: [
          {
            name: subject,
            scope: "project",
            status: "failed",
            severity: "error",
            reasons,
            plugins: children,
          },
        ],
      });
    });
  }

  test("keeps two dangling plugins of one undeclared marketplace individually attributable", () => {
    // arrange
    const plans = [
      reconcilePlan("user", {
        sourceMismatches: [
          { scope: "user", cause: "dangling-reference", marketplace: "phantom-mp", plugin: "cr" },
          { scope: "user", cause: "dangling-reference", marketplace: "phantom-mp", plugin: "cr2" },
        ],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "phantom-mp",
          scope: "user",
          status: "failed",
          severity: "error",
          reasons: ["dangling reference"],
          plugins: [
            {
              status: "failed",
              name: "cr",
              reasons: ["dangling reference"],
              severity: "error",
              needsReload: false,
            },
            {
              status: "failed",
              name: "cr2",
              reasons: ["dangling reference"],
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
    });
  });

  test("orders blocks from separate plans by name regardless of plan order", () => {
    // arrange
    const plans = [
      reconcilePlan("user", {
        pluginsToInstall: [
          { scope: "user", plugin: "z1", marketplace: "zebra", configSource: "base" },
        ],
      }),
      reconcilePlan("project", {
        pluginsToInstall: [
          { scope: "project", plugin: "a1", marketplace: "alpha", configSource: "base" },
        ],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "alpha",
          scope: "project",
          plugins: [{ status: "will install", name: "a1" }],
        },
        {
          name: "zebra",
          scope: "user",
          plugins: [{ status: "will install", name: "z1" }],
        },
      ],
    });
  });

  test("orders two same-name blocks project before user", () => {
    // arrange
    const plans = [
      reconcilePlan("user", {
        pluginsToInstall: [
          { scope: "user", plugin: "u1", marketplace: "shared", configSource: "base" },
        ],
      }),
      reconcilePlan("project", {
        pluginsToInstall: [
          { scope: "project", plugin: "p1", marketplace: "shared", configSource: "base" },
        ],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(plans);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "shared",
          scope: "project",
          plugins: [{ status: "will install", name: "p1" }],
        },
        {
          name: "shared",
          scope: "user",
          plugins: [{ status: "will install", name: "u1" }],
        },
      ],
    });
  });

  test("stamps the partial modifier only on the install whose key is in the force set", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        pluginsToInstall: [
          { scope: "project", plugin: "cr", marketplace: "mp", configSource: "base" },
        ],
      }),
      reconcilePlan("user", {
        pluginsToInstall: [
          { scope: "user", plugin: "cr", marketplace: "mp", configSource: "base" },
        ],
      }),
    ];
    const forceInstallKeys = new Set<string>(["project\u0000mp\u0000cr"]);

    // act
    const pending = buildReconcilePendingNotification(plans, forceInstallKeys);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [{ status: "will install", name: "cr", partial: true }],
        },
        {
          name: "mp",
          scope: "user",
          plugins: [{ status: "will install", name: "cr" }],
        },
      ],
    });
  });

  test("folds every planned action of one scope into name-ordered blocks", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToRemove: [{ scope: "project", marketplace: "gone-mp", plugins: ["g1"] }],
        pluginsToInstall: [
          { scope: "project", plugin: "ins", marketplace: "mp", configSource: "base" },
        ],
        pluginsToUninstall: [{ scope: "project", plugin: "rem", marketplace: "mp" }],
        pluginsToEnable: [{ scope: "project", plugin: "en", marketplace: "mp" }],
        pluginsToDisable: [{ scope: "project", plugin: "dis", marketplace: "mp" }],
        sourceMismatches: [
          { scope: "project", cause: "dangling-reference", marketplace: "phantom", plugin: "dang" },
        ],
      }),
    ];
    const forceInstallKeys = new Set<string>(["project\u0000mp\u0000ins"]);

    // act
    const pending = buildReconcilePendingNotification(plans, forceInstallKeys);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "gone-mp",
          scope: "project",
          plugins: [{ status: "will uninstall", name: "g1" }],
        },
        {
          name: "mp",
          scope: "project",
          plugins: [
            { status: "will install", name: "ins", partial: true },
            { status: "will uninstall", name: "rem" },
            { status: "will disable", name: "dis" },
            { status: "will enable", name: "en" },
          ],
        },
        {
          name: "phantom",
          scope: "project",
          status: "failed",
          severity: "error",
          reasons: ["dangling reference"],
          plugins: [
            {
              status: "failed",
              name: "dang",
              reasons: ["dangling reference"],
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
    });
  });
});

describe("isReconcilePlanListEmpty", () => {
  test("reports an empty plan list as empty", () => {
    // arrange
    const plans: readonly ReconcilePlan[] = [];

    // act
    const planListEmpty = isReconcilePlanListEmpty(plans);

    // assert
    assert.strictEqual(planListEmpty, true);
  });

  test("reports two all-empty plans as empty", () => {
    // arrange
    const plans = [reconcilePlan("project"), reconcilePlan("user")];

    // act
    const planListEmpty = isReconcilePlanListEmpty(plans);

    // assert
    assert.strictEqual(planListEmpty, true);
  });

  test("reports a marketplace removal with no recorded plugins as empty", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: [] }],
      }),
    ];

    // act
    const planListEmpty = isReconcilePlanListEmpty(plans);

    // assert
    assert.strictEqual(planListEmpty, true);
  });

  for (const { bucket, actions } of [
    {
      bucket: "a marketplace removal carrying recorded plugins",
      actions: {
        marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: ["p1"] }],
      },
    },
    {
      bucket: "a planned install",
      actions: {
        pluginsToInstall: [
          { scope: "project", plugin: "cr", marketplace: "mp", configSource: "base" },
        ],
      },
    },
    {
      bucket: "a planned uninstall",
      actions: { pluginsToUninstall: [{ scope: "project", plugin: "cr", marketplace: "mp" }] },
    },
    {
      bucket: "a planned enable",
      actions: { pluginsToEnable: [{ scope: "project", plugin: "cr", marketplace: "mp" }] },
    },
    {
      bucket: "a planned disable",
      actions: { pluginsToDisable: [{ scope: "project", plugin: "cr", marketplace: "mp" }] },
    },
    {
      bucket: "a source mismatch",
      actions: {
        sourceMismatches: [
          { scope: "project", cause: "malformed-plugin-key", rawKey: "my-plugin" },
        ],
      },
    },
  ] satisfies readonly { bucket: string; actions: PlannedActions }[]) {
    test(`reports a plan carrying ${bucket} as not empty`, () => {
      // arrange
      const plans = [reconcilePlan("project", actions)];

      // act
      const planListEmpty = isReconcilePlanListEmpty(plans);

      // assert
      assert.strictEqual(planListEmpty, false);
    });
  }

  test("reports a marketplace add on its own as empty", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToAdd: [
          { scope: "project", marketplace: "mp", source: "acme/tools", configSource: "base" },
        ],
      }),
    ];

    // act
    const planListEmpty = isReconcilePlanListEmpty(plans);

    // assert
    assert.strictEqual(planListEmpty, true);
  });
});

describe("resolvePendingForceInstalls", () => {
  const install: PlannedPluginInstall = {
    scope: "project",
    plugin: "cr",
    marketplace: "mp",
    configSource: "base",
  };

  test("collects the tuple key of an install whose candidate resolves partially available", async (t) => {
    // arrange
    const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "reconcile-force-"));
    t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
    await mkdir(path.join(marketplaceRoot, "cr"), { recursive: true });
    await writeFile(path.join(marketplaceRoot, "cr", ".lsp.json"), "{}", "utf8");
    const plans = [reconcilePlan("project", { pluginsToInstall: [install] })];
    const locate = (): Promise<PendingInstallCandidate> =>
      Promise.resolve({
        marketplaceRoot,
        manifestEntry: { name: "cr", source: "./cr", version: "1.0.0" },
      });

    // act
    const forceInstallKeys = await resolvePendingForceInstalls(plans, locate);

    // assert
    assert.deepStrictEqual(forceInstallKeys, new Set(["project\u0000mp\u0000cr"]));
  });

  test("collects no key for an install whose candidate resolves installable", async (t) => {
    // arrange
    const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "reconcile-clean-"));
    t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
    await mkdir(path.join(marketplaceRoot, "cr"), { recursive: true });
    const plans = [reconcilePlan("project", { pluginsToInstall: [install] })];
    const locate = (): Promise<PendingInstallCandidate> =>
      Promise.resolve({
        marketplaceRoot,
        manifestEntry: { name: "cr", source: "./cr", version: "1.0.0" },
      });

    // act
    const forceInstallKeys = await resolvePendingForceInstalls(plans, locate);

    // assert
    assert.deepStrictEqual(forceInstallKeys, new Set());
  });

  test("collects no key when the candidate cannot be located offline", async () => {
    // arrange
    const plans = [reconcilePlan("project", { pluginsToInstall: [install] })];
    const locate = (): Promise<PendingInstallCandidate | undefined> => Promise.resolve(undefined);

    // act
    const forceInstallKeys = await resolvePendingForceInstalls(plans, locate);

    // assert
    assert.deepStrictEqual(forceInstallKeys, new Set());
  });

  test("collects no key when resolving the candidate throws", async (t) => {
    // arrange
    const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "reconcile-throw-"));
    t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
    // A regular file standing where the marketplace clone root belongs makes the
    // offline resolve fail with ENOTDIR rather than a missing-path verdict.
    const notADirectory = path.join(marketplaceRoot, "not-a-directory");
    await writeFile(notADirectory, "x", "utf8");
    const plans = [reconcilePlan("project", { pluginsToInstall: [install] })];
    const locate = (): Promise<PendingInstallCandidate> =>
      Promise.resolve({
        marketplaceRoot: notADirectory,
        manifestEntry: { name: "cr", source: "./cr", version: "1.0.0" },
      });

    // act
    const forceInstallKeys = await resolvePendingForceInstalls(plans, locate);

    // assert
    assert.deepStrictEqual(forceInstallKeys, new Set());
  });

  test("collects no key for a plan that has no planned installs", async () => {
    // arrange
    const plans = [reconcilePlan("project")];
    const locate = (): Promise<PendingInstallCandidate | undefined> => Promise.resolve(undefined);

    // act
    const forceInstallKeys = await resolvePendingForceInstalls(plans, locate);

    // assert
    assert.deepStrictEqual(forceInstallKeys, new Set());
  });
});
