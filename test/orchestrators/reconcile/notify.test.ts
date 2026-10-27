import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { UninstallRefusedError } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import {
  blockedMoveOutcomes,
  buildReconcileAppliedCascade,
  buildReconcilePendingNotification,
  convergedMoveOutcomes,
  enabledMoveOutcome,
  isReconcilePlanListEmpty,
  planListNeedsApply,
  recordedVersionEntries,
  resolvePendingForceInstalls,
  type PendingInstallCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";
import { DependencyCascadeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  discoveryWarning,
  hygieneWarning,
} from "../../../extensions/pi-claude-marketplace/shared/staging-warnings.ts";

import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { PlannedMove } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts";
import type {
  PlannedPluginInstall,
  ReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * DIFF-02 / RECON-04 projection owner. Both entrypoints are pure functions of
 * plain data, so every case supplies complete case-local inputs and compares the
 * complete returned message. Expected messages are authored by hand from the
 * closed reason / status vocabularies -- never by calling a production
 * projector, formatter, or classifier.
 */

type AppliedCascade = ReturnType<typeof buildReconcileAppliedCascade>;

const LAYER_GAP_CAUSE = new Error("the local layer declares alpha@mp without its marketplace");
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
    pluginsToDependencyDisable: [...(actions.pluginsToDependencyDisable ?? [])],
    pluginsToDependencyInstall: [...(actions.pluginsToDependencyInstall ?? [])],
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
                reasons: ["components now supported"],
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
    "plugin-dependency-disabled": {
      outcome: {
        kind: "plugin-dependency-disabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        reasons: ["dependency unsatisfied"],
        cause: new Error('Install "vault@mp" or uninstall "cr@mp"'),
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
                reasons: ["dependency unsatisfied"],
                cause: new Error('Install "vault@mp" or uninstall "cr@mp"'),
                severity: "warning",
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
    "plugin-declarer-unreadable": {
      outcome: {
        kind: "plugin-declarer-unreadable",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reason: "not in manifest",
        cause: new Error(
          "cannot read the dependencies of cr@mp: not declared by its marketplace, and its installed copy cannot be read",
        ),
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
                cause: new Error(
                  "cannot read the dependencies of cr@mp: not declared by its marketplace, and its installed copy cannot be read",
                ),
                severity: "warning",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
    "plugin-converged": {
      outcome: {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        row: {
          status: "updated",
          name: "cr",
          scope: "project",
          from: "1.0.0",
          to: "1.1.0",
          dependencies: [],
          severity: "info",
          needsReload: true,
        },
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "updated",
                name: "cr",
                scope: "project",
                from: "1.0.0",
                to: "1.1.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
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
    "layer-marketplace-gap": {
      outcome: {
        kind: "layer-marketplace-gap",
        scope: "project",
        basename: "claude-plugins.local.json",
        cause: LAYER_GAP_CAUSE,
      },
      expected: {
        kind: "reconcile-applied-cascade",
        marketplaces: [
          {
            name: "claude-plugins.local.json",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "claude-plugins.local.json",
                reasons: ["invalid manifest"],
                cause: LAYER_GAP_CAUSE,
                severity: "error",
                needsReload: false,
              },
            ],
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
      {
        kind: "mp-remove-failed",
        scope: "user",
        marketplace: "absent-mp",
        reason: "marketplace not added",
      },
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

  test("D-09-09: names a reload-installed dependency on its install row", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "secrets-vault",
        version: "1.0.0",
        dependencies: [],
        dependencyInstalled: true,
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert -- no cause key: the register's success rows carry none.
    assert.deepStrictEqual(cascade, {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "installed",
              name: "secrets-vault",
              version: "1.0.0",
              dependencies: [],
              reasons: ["dependency installed"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("TAGS-02: names a dependency that fell back to its current copy on its install row", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "secrets-vault",
        version: "1.0.0",
        dependencies: [],
        dependencyInstalled: true,
        dependencyCurrentCopy: true,
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
              name: "secrets-vault",
              version: "1.0.0",
              dependencies: [],
              reasons: ["dependency installed", "dependency current copy"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("D-09-09: an outcome without the flag renders byte-identically to today", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        dependencies: [],
      },
    ];

    // act
    const cascade = buildReconcileAppliedCascade(outcomes);

    // assert -- no reasons brace (NREG-01).
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
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("D-09-09: orders dependency installed before orphan rewake, then degraded kinds", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "secrets-vault",
        version: "1.0.0",
        dependencies: [],
        dependencyInstalled: true,
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
              name: "secrets-vault",
              version: "1.0.0",
              dependencies: [],
              reasons: ["dependency installed", "orphan rewake", "malformed skill"],
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

  test("WDEP-02: declares the workflows dependency LAST on a re-enable that staged all three kinds", () => {
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
        stagedWorkflows: true,
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
              dependencies: ["agents", "mcp", "workflows"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("WDEP-02: a re-enable that staged no workflow declares no host-engine dependency", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-enabled",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        version: "1.0.0",
        stagedAgents: true,
        stagedWorkflows: false,
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
              dependencies: ["agents"],
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
              reasons: ["components now supported", "lsp"],
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
              reasons: ["components now supported"],
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
              reasons: ["components now supported", "orphan rewake"],
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
              reasons: [
                "components now supported",
                "orphan rewake",
                "malformed command",
                "unsupported component",
              ],
              severity: "warning",
              needsReload: true,
            },
          ],
        },
      ],
    });
  });

  test("D-05-16: carries the refusal cause on a plugin-uninstall-failed row that names one", () => {
    // arrange
    const cause = new UninstallRefusedError(
      "unreadable",
      "cannot read the dependencies of keeper@mp: not declared by its marketplace, and its installed copy cannot be read",
    );
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-uninstall-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "orphan",
        reason: "unreadable",
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
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "failed",
              name: "orphan",
              reasons: ["unreadable"],
              cause,
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
    });
  });

  test("D-05-16: renders no cause child on a plugin-install-failed row", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reason: "permission denied",
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
              status: "failed",
              name: "cr",
              reasons: ["permission denied"],
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
    });
  });

  test("REC-06: renders the narrowed reasons a plugin-install-failed row carries", () => {
    // arrange
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "cr",
        reason: "no longer installable",
        reasons: ["unsupported hooks", "lsp"],
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
              status: "failed",
              name: "cr",
              reasons: ["unsupported hooks", "lsp"],
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
    });
  });

  test("RESV-06: carries the dependency-cascade cause on a plugin-install-failed row that names one", () => {
    // arrange
    const cause = new DependencyCascadeError(
      'Dependency "missing@mp" is not declared by its marketplace.',
      "missing@mp",
    );
    const outcomes: readonly PerEntryOutcome[] = [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        reason: "dependency failed",
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
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "failed",
              name: "hello",
              reasons: ["dependency failed"],
              cause,
              severity: "error",
              needsReload: false,
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
              reasons: ["components now supported", "lsp"],
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

const DEMO_MOVE: PlannedMove = {
  scope: "project",
  marketplace: "mp",
  plugin: "demo",
  fromVersion: "1.0.0",
  toVersion: "1.1.0",
  revisionChanged: true,
  grew: false,
  partial: false,
};

const UPDATE_BASE = { name: "demo", declaresAgents: false, declaresMcp: false } as const;

describe("blockedMoveOutcomes", () => {
  test("D-12: reports a range hold and a consent decline with the rows pending lists", () => {
    // arrange
    const convergence = {
      moves: [DEMO_MOVE],
      holds: [
        {
          scope: "project",
          marketplace: "mp",
          plugin: "lib",
          version: "1.0.0",
          cause:
            'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@mp"',
        },
      ],
      declines: [
        {
          scope: "user",
          marketplace: "mp",
          plugin: "styled",
          version: "1.0.0",
          unsupported: ["outputStyles"],
        },
      ],
    } as const;

    // act
    const outcomes = blockedMoveOutcomes(convergence);

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "lib",
        row: {
          status: "skipped",
          name: "lib",
          version: "1.0.0",
          reasons: ["dependents constrain"],
          cause: new Error(
            'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@mp"',
          ),
          severity: "warning",
          needsReload: false,
        },
      },
      {
        kind: "plugin-converged",
        scope: "user",
        marketplace: "mp",
        plugin: "styled",
        row: {
          status: "partially-upgradable",
          name: "styled",
          version: "1.0.0",
          reasons: ["unsupported component"],
          catalogHint: true,
          severity: "warning",
          needsReload: false,
        },
      },
    ]);
  });

  test("reports nothing for a plan with no blocked move", () => {
    // act
    const outcomes = blockedMoveOutcomes({ moves: [DEMO_MOVE], holds: [], declines: [] });

    // assert
    assert.deepStrictEqual(outcomes, []);
  });
});

describe("enabledMoveOutcome", () => {
  test("APPLY1-01 / WR-02: a held-down record moved and enabled reports the move's updated row", () => {
    // act
    const outcome = enabledMoveOutcome({ ...DEMO_MOVE, grew: true });

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "plugin-converged",
      scope: "project",
      marketplace: "mp",
      plugin: "demo",
      row: {
        status: "updated",
        name: "demo",
        scope: "project",
        from: DEMO_MOVE.fromVersion,
        to: DEMO_MOVE.toVersion,
        dependencies: [],
        reasons: ["components now supported"],
        severity: "info",
        needsReload: true,
      },
    });
  });
});

describe("convergedMoveOutcomes", () => {
  test("D-08: an updated move reports update's row without the range disclosure", () => {
    // arrange
    const notice = {
      kind: "comments-dropped",
      scope: "project",
      file: "mcp-adapter.json",
    } as const;

    // act
    const outcomes = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "updated",
      resourcesChanged: true,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresWorkflows: true,
      constraint: {
        disclosure: 'constrained to the combined range (>=1.0.0) -- required by "app@mp"',
        fellBackToCurrentCopy: true,
      },
      mcpConfigNotices: [notice],
    });

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        row: {
          status: "updated",
          name: "demo",
          scope: "project",
          from: "1.0.0",
          to: "1.1.0",
          dependencies: ["workflows"],
          severity: "info",
          needsReload: true,
        },
        mcpConfigNotices: [notice],
      },
    ]);
  });

  test("D-08: a partial record's move that drops a kind reports the partially-installed row at info", () => {
    // act
    const outcomes = convergedMoveOutcomes(
      { ...DEMO_MOVE, partial: true },
      {
        ...UPDATE_BASE,
        partition: "updated",
        resourcesChanged: true,
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresWorkflows: false,
        constraint: undefined,
        partialDegrade: { kinds: ["outputStyles"], newlyDegraded: false },
      },
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        row: {
          status: "partially-installed",
          name: "demo",
          scope: "project",
          version: "1.1.0",
          from: "1.0.0",
          dependencies: [],
          reasons: ["unsupported component"],
          severity: "info",
          needsReload: true,
        },
      },
    ]);
  });

  test("WCONV-03: a revision move whose supported set grew leads its updated row with the growth marker", () => {
    // act
    const outcomes = convergedMoveOutcomes(
      { ...DEMO_MOVE, grew: true },
      {
        ...UPDATE_BASE,
        partition: "updated",
        resourcesChanged: true,
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresWorkflows: false,
        constraint: undefined,
      },
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        row: {
          status: "updated",
          name: "demo",
          scope: "project",
          from: "1.0.0",
          to: "1.1.0",
          dependencies: [],
          reasons: ["components now supported"],
          severity: "info",
          needsReload: true,
        },
      },
    ]);
  });

  test("WCONV-03: a grown partial record's move puts the growth marker before the dropped kinds", () => {
    // act
    const outcomes = convergedMoveOutcomes(
      { ...DEMO_MOVE, partial: true, grew: true },
      {
        ...UPDATE_BASE,
        partition: "updated",
        resourcesChanged: true,
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresWorkflows: false,
        constraint: undefined,
        partialDegrade: { kinds: ["outputStyles"], newlyDegraded: false },
      },
    );

    // assert
    assert.deepStrictEqual(
      outcomes.map((outcome) => outcome.row.reasons),
      [["components now supported", "unsupported component"]],
    );
  });

  test("a move the runner found at the recorded revision reports nothing", () => {
    // act
    const outcomes = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "unchanged",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      declaresWorkflows: false,
      constraint: undefined,
    });

    // assert
    assert.deepStrictEqual(outcomes, []);
  });

  test("D-12: a range hold the runner met reports the hold row with its cause", () => {
    // act
    const outcomes = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "skipped",
      fromVersion: "1.0.0",
      notes: [
        'version 1.1.0 falls outside what the combined range admits (~1.0.0) -- required by "app@mp"',
      ],
      reasons: ["dependents constrain"],
      declaresWorkflows: false,
    });

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        row: {
          status: "skipped",
          name: "demo",
          version: "1.0.0",
          reasons: ["dependents constrain"],
          cause: new Error(
            'version 1.1.0 falls outside what the combined range admits (~1.0.0) -- required by "app@mp"',
          ),
          severity: "warning",
          needsReload: false,
        },
      },
    ]);
  });

  test("a skip with no cause and no recorded version names the planned version and its reason", () => {
    // act
    const outcomes = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "skipped",
      notes: [],
      reasons: ["already disabled"],
      declaresWorkflows: false,
    });

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        row: {
          status: "skipped",
          name: "demo",
          version: "1.0.0",
          reasons: ["already disabled"],
          severity: "warning",
          needsReload: false,
        },
      },
    ]);
  });

  test("D-12 / D-24: a consent decline the runner met reports the decline row with the catalog hint", () => {
    // act
    const outcomes = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "skipped",
      fromVersion: "1.0.0",
      notes: ['Plugin "demo" is no longer installable: contains outputStyles'],
      reasons: ["unsupported component"],
      partialUpgradable: true,
      declaresWorkflows: false,
    });

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        row: {
          status: "partially-upgradable",
          name: "demo",
          version: "1.0.0",
          reasons: ["unsupported component"],
          catalogHint: true,
          severity: "warning",
          needsReload: false,
        },
      },
    ]);
  });

  test("D-13 / T-55-02-02: a failed move reports its reason and the planned move, never the raw error", () => {
    // arrange
    const notice = { kind: "left-unchanged", scope: "project", file: "mcp.json" } as const;

    // act
    const outcomes = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "failed",
      fromVersion: "1.0.0",
      notes: ["EACCES: permission denied, open '/secret/path'"],
      reasons: ["permission denied"],
      cause: new Error("EACCES: permission denied, open '/secret/path'"),
      declaresWorkflows: false,
      mcpConfigNotices: [notice],
    });

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-converged",
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        row: {
          status: "failed",
          name: "demo",
          version: "1.1.0",
          from: "1.0.0",
          reasons: ["permission denied"],
          severity: "error",
          needsReload: false,
        },
        mcpConfigNotices: [notice],
      },
    ]);
  });

  test("D-PL1-23: an updated and a failed move carry the runner's tagged staging warnings", () => {
    // arrange
    const stagingWarnings = [discoveryWarning("skill skipped"), hygieneWarning("index rebuilt")];

    // act
    const moved = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "updated",
      resourcesChanged: true,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresWorkflows: false,
      constraint: undefined,
      stagingWarnings,
    });
    const failed = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "failed",
      notes: [],
      reasons: ["permission denied"],
      declaresWorkflows: false,
      stagingWarnings,
    });

    // assert
    assert.deepStrictEqual(
      [...moved, ...failed].map((outcome) => ({
        status: outcome.row.status,
        stagingWarnings: outcome.stagingWarnings,
      })),
      [
        { status: "updated", stagingWarnings },
        { status: "failed", stagingWarnings },
      ],
    );
  });

  test("a failed move with no classified reason renders an empty brace", () => {
    // act
    const outcomes = convergedMoveOutcomes(DEMO_MOVE, {
      ...UPDATE_BASE,
      partition: "failed",
      notes: ["boom"],
      declaresWorkflows: false,
    });

    // assert
    assert.deepStrictEqual(outcomes[0]?.row, {
      status: "failed",
      name: "demo",
      version: "1.1.0",
      from: "1.0.0",
      reasons: [],
      severity: "error",
      needsReload: false,
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

  test("D-20: previews a marketplace add with no child work as a bare will-add header", () => {
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
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          status: "will add",
          severity: "info",
          needsReload: false,
          plugins: [],
        },
      ],
    });
  });

  test("D-20: rides a planned install of a newly added marketplace on its will-add header", () => {
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
          status: "will add",
          severity: "info",
          needsReload: false,
          plugins: [{ status: "will install", name: "cr" }],
        },
      ],
    });
  });

  test("D-20: synthesizes one will-uninstall child per recorded plugin of a will-remove marketplace", () => {
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
          status: "will remove",
          severity: "info",
          needsReload: false,
          plugins: [
            { status: "will uninstall", name: "p1" },
            { status: "will uninstall", name: "p2" },
          ],
        },
      ],
    });
  });

  test("PRN-02: each will-uninstall row names the version its scope recorded", () => {
    // arrange
    const plugin = (
      version: string,
    ): ExtensionState["marketplaces"][string]["plugins"][string] => ({
      version,
      resolvedSource: "/plugins/p",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
      enabled: true,
      provenance: "explicit",
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const marketplace = (
      name: string,
      plugins: ExtensionState["marketplaces"][string]["plugins"],
    ): ExtensionState["marketplaces"][string] => ({
      name,
      scope: "project",
      source: { kind: "path", path: `/marketplaces/${name}` },
      addedFromCwd: "/workspace",
      manifestPath: `/marketplaces/${name}/.claude-plugin/marketplace.json`,
      marketplaceRoot: `/marketplaces/${name}`,
      plugins,
    });
    const state: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        "old-mp": marketplace("old-mp", { p1: plugin("1.0.0") }),
        mp: marketplace("mp", { cr: plugin("2.1.0") }),
      },
    };
    const plans = [
      reconcilePlan("project", {
        marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: ["p1"] }],
        pluginsToUninstall: [{ scope: "project", plugin: "cr", marketplace: "mp" }],
      }),
    ];

    // act
    const pending = buildReconcilePendingNotification(
      plans,
      new Set<string>(),
      new Map(recordedVersionEntries("project", state)),
    );

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [{ status: "will uninstall", name: "cr", version: "2.1.0" }],
        },
        {
          name: "old-mp",
          scope: "project",
          status: "will remove",
          severity: "info",
          needsReload: false,
          plugins: [{ status: "will uninstall", name: "p1", version: "1.0.0" }],
        },
      ],
    });
  });

  test("D-20: previews a marketplace removal with no recorded plugins as a bare will-remove header", () => {
    // arrange
    const plans = [
      reconcilePlan("project", {
        marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: [] }],
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
          status: "will remove",
          severity: "info",
          needsReload: false,
          plugins: [],
        },
      ],
    });
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
    {
      // WR-02: the held-down bucket previews the same action the
      // config-driven disable bucket does, so the projection gives it the
      // same token rather than a new one.
      bucket: "pluginsToDependencyDisable",
      actions: {
        pluginsToDependencyDisable: [
          {
            scope: "project",
            plugin: "cr",
            marketplace: "mp",
            dependency: "dep@mp",
            kind: "missing",
          },
        ],
      },
      expectedRow: { status: "will disable", name: "cr" },
    },
    {
      // D-09-12: the dependency-install bucket previews the same action the
      // config-driven install bucket does, so the projection gives it the
      // same token rather than a new one.
      bucket: "pluginsToDependencyInstall",
      actions: {
        pluginsToDependencyInstall: [
          {
            scope: "project",
            plugin: "cr",
            marketplace: "mp",
            ranges: [],
            requiredBy: "dependent@mp",
            declarers: ["dependent@mp"],
          },
        ],
      },
      expectedRow: { status: "will install", name: "cr" },
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

  test("D-09-12: previews a dependency install as a bare will-install row", () => {
    // arrange -- a bucket entry never matches a `resolvePendingForceInstalls`
    // key, so the row carries no `partial` modifier.
    const plans = [
      reconcilePlan("project", {
        pluginsToDependencyInstall: [
          {
            scope: "project",
            plugin: "secrets-vault",
            marketplace: "mp",
            ranges: ["^2.0.0"],
            requiredBy: "deploy-kit@mp",
            declarers: ["deploy-kit@mp"],
          },
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
          plugins: [{ status: "will install", name: "secrets-vault" }],
        },
      ],
    });
  });

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

  test("D-14: previews a catalog move as a will-update row with its version arrow", () => {
    // arrange
    const plans = [reconcilePlan("project")];
    const moves = [
      {
        scope: "project",
        marketplace: "mp",
        plugin: "demo",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        revisionChanged: true,
        grew: false,
        partial: false,
      },
    ] as const;

    // act
    const pending = buildReconcilePendingNotification(plans, new Set(), new Map(), {
      moves,
      holds: [],
      declines: [],
    });

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [{ status: "will update", name: "demo", from: "1.0.0", to: "1.1.0" }],
        },
      ],
    });
  });

  test("D-10 / WCONV-03: a growth-only move carries the components-now-supported marker", () => {
    // arrange
    const plans = [reconcilePlan("project")];
    const moves = [
      {
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        revisionChanged: false,
        grew: true,
        partial: false,
      },
    ] as const;

    // act
    const pending = buildReconcilePendingNotification(plans, new Set(), new Map(), {
      moves,
      holds: [],
      declines: [],
    });

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            {
              status: "will update",
              name: "hello",
              from: "1.0.0",
              to: "1.0.0",
              reasons: ["components now supported"],
            },
          ],
        },
      ],
    });
  });

  test("D-12 / D-24: previews a range hold and a consent decline as update's warning rows after the moves", () => {
    // arrange
    const plans = [reconcilePlan("project")];
    const convergence = {
      moves: [
        {
          scope: "project",
          marketplace: "mp",
          plugin: "demo",
          fromVersion: "1.0.0",
          toVersion: "1.1.0",
          revisionChanged: true,
          grew: false,
          partial: false,
        },
      ],
      holds: [
        {
          scope: "project",
          marketplace: "mp",
          plugin: "lib",
          version: "1.0.0",
          cause:
            'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@mp"',
        },
      ],
      declines: [
        {
          scope: "project",
          marketplace: "mp",
          plugin: "styled",
          version: "1.0.0",
          unsupported: ["outputStyles", "lspServers"],
        },
      ],
    } as const;

    // act
    const pending = buildReconcilePendingNotification(plans, new Set(), new Map(), convergence);

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "project",
          plugins: [
            { status: "will update", name: "demo", from: "1.0.0", to: "1.1.0" },
            {
              status: "skipped",
              name: "lib",
              version: "1.0.0",
              reasons: ["dependents constrain"],
              cause: new Error(
                'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@mp"',
              ),
              severity: "warning",
              needsReload: false,
            },
            {
              status: "partially-upgradable",
              name: "styled",
              version: "1.0.0",
              reasons: ["unsupported component", "lsp"],
              catalogHint: true,
              severity: "warning",
              needsReload: false,
            },
          ],
        },
      ],
    });
  });

  test("D-14 / UPR-02: a same-version move names its commits after the plan's rows", () => {
    // arrange
    const fromCommit = "a".repeat(40);
    const toCommit = "b".repeat(40);
    const plans = [
      reconcilePlan("user", {
        pluginsToInstall: [
          { scope: "user", plugin: "ins", marketplace: "mp", configSource: "base" },
        ],
      }),
    ];
    const moves = [
      {
        scope: "user",
        marketplace: "mp",
        plugin: "ghp",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        fromCommit,
        toCommit,
        revisionChanged: true,
        grew: false,
        partial: false,
      },
    ] as const;

    // act
    const pending = buildReconcilePendingNotification(plans, new Set(), new Map(), {
      moves,
      holds: [],
      declines: [],
    });

    // assert
    assert.deepStrictEqual(pending, {
      marketplaces: [
        {
          name: "mp",
          scope: "user",
          plugins: [
            { status: "will install", name: "ins" },
            {
              status: "will update",
              name: "ghp",
              from: "1.0.0",
              to: "1.0.0",
              commits: { from: fromCommit, to: toCommit },
            },
          ],
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
          status: "will remove",
          severity: "info",
          needsReload: false,
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

/**
 * APL-04 / D-14: one plan action per bucket `/claude:plugin apply` would act
 * on. A source mismatch is not among them: `apply` cannot fix it.
 */
const CHANGE_BUCKETS = [
  {
    bucket: "a marketplace add on its own",
    actions: {
      marketplacesToAdd: [
        { scope: "project", marketplace: "mp", source: "acme/tools", configSource: "base" },
      ],
    },
  },
  {
    bucket: "a marketplace removal carrying recorded plugins",
    actions: {
      marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: ["p1"] }],
    },
  },
  {
    bucket: "a marketplace removal with no recorded plugins",
    actions: {
      marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: [] }],
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
    // WR-02: the load-time held-down bucket is an action the next reload
    // performs, so a scope carrying only this bucket must not report as a
    // steady state.
    bucket: "a planned dependency disable",
    actions: {
      pluginsToDependencyDisable: [
        {
          scope: "project",
          plugin: "cr",
          marketplace: "mp",
          dependency: "dep@mp",
          kind: "missing",
        },
      ],
    },
  },
  {
    // MISS-01 / D-09-12: the dependency-install bucket is an action the
    // next reload performs, so a scope carrying only this bucket must not
    // report as a steady state.
    bucket: "a planned dependency install",
    actions: {
      pluginsToDependencyInstall: [
        {
          scope: "project",
          plugin: "cr",
          marketplace: "mp",
          ranges: [],
          requiredBy: "dependent@mp",
          declarers: ["dependent@mp"],
        },
      ],
    },
  },
] satisfies readonly { bucket: string; actions: PlannedActions }[];

const SOURCE_MISMATCH_ACTIONS = {
  sourceMismatches: [{ scope: "project", cause: "malformed-plugin-key", rawKey: "my-plugin" }],
} satisfies PlannedActions;

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

  for (const { bucket, actions } of [
    ...CHANGE_BUCKETS,
    { bucket: "a source mismatch", actions: SOURCE_MISMATCH_ACTIONS },
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
});

describe("planListNeedsApply", () => {
  test("reports an empty plan list as needing no apply", () => {
    // arrange
    const plans: readonly ReconcilePlan[] = [];

    // act
    const needsApply = planListNeedsApply(plans);

    // assert
    assert.strictEqual(needsApply, false);
  });

  for (const { bucket, actions } of CHANGE_BUCKETS) {
    test(`reports a plan carrying ${bucket} as needing apply`, () => {
      // arrange
      const plans = [reconcilePlan("project"), reconcilePlan("user", actions)];

      // act
      const needsApply = planListNeedsApply(plans);

      // assert
      assert.strictEqual(needsApply, true);
    });
  }

  test("reports a plan carrying only a source mismatch as needing no apply", () => {
    // arrange
    const plans = [reconcilePlan("project", SOURCE_MISMATCH_ACTIONS)];

    // act
    const needsApply = planListNeedsApply(plans);

    // assert
    assert.strictEqual(needsApply, false);
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

  test("collects the key of an install whose binaries count for an official marketplace", async (t) => {
    // arrange
    const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "reconcile-official-"));
    t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
    await mkdir(path.join(marketplaceRoot, "cr"), { recursive: true });
    const plans = [
      reconcilePlan("project", {
        pluginsToInstall: [{ ...install, marketplace: "claude-plugins-official" }],
      }),
    ];
    const locate = (): Promise<PendingInstallCandidate> =>
      Promise.resolve({
        marketplaceRoot,
        manifestEntry: {
          name: "cr",
          source: "./cr",
          version: "1.0.0",
          binaries: { tool: "https://example.com/tool" },
        },
      });

    // act
    const forceInstallKeys = await resolvePendingForceInstalls(plans, locate);

    // assert
    assert.deepStrictEqual(
      forceInstallKeys,
      new Set(["project\u0000claude-plugins-official\u0000cr"]),
    );
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
