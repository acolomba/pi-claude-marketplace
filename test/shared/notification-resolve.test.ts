import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PENDING_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";
import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { composeReconcileAppliedBody } from "../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import {
  CENTRAL_ROW_POLICY,
  mcpConfigNoticeSurfaces,
  resolveEnvelope,
  resolveNotAddedReason,
  resolveRawSurface,
  resolveRows,
  resolveUpdateNoOpEnvelope,
} from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

import type { SoftDepStatus } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { Dependency } from "../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";
import type {
  RowPolicyMap,
  ResolvedEnvelope,
  ResolvedMarketplace,
  ResolvedRow,
} from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  CascadeNotificationMessage,
  MarketplaceNotAddedMessage,
  MarketplaceNotificationMessage,
  McpConfigNotice,
  McpMigrationRow,
  NotificationMessage,
  PluginFailedMessage,
  PluginNotificationMessage,
  PluginPathSkippedSurface,
  Reason,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

void ({
  status: "failed",
  severity: "error",
  name: "alpha",
  reasons: [],
  failure: { leaks: [], rollbackPartial: [] },
} satisfies ResolvedRow<PluginFailedMessage>);
void ({
  status: "failed",
  severity: "error",
  name: "alpha",
  reasons: [],
  // @ts-expect-error a resolved failed row carries no live Error
  cause: new Error("x"),
} satisfies ResolvedRow<PluginFailedMessage>);

test("resolves absent policies as explicit diagnostic facts", () => {
  // arrange
  const row = { status: "available", name: "alpha" } satisfies PluginNotificationMessage;

  // act
  const marketplaces = resolveRows(marketplaceWith([row]), allLoaded(), {});

  // assert
  assert.deepStrictEqual(marketplaces[0]!.plugins, [
    { status: "available", name: "alpha", severity: "error", reasons: [], missingPolicy: true },
  ]);
});

test("a present all-false policy suppresses content without marking a diagnostic", () => {
  // arrange
  const row = { status: "available", name: "alpha", reasons: ["installs disabled"] } as const;

  // act
  const marketplaces = resolveRows(marketplaceWith([row]), noneLoaded(), {
    available: { markers: false, contentReasons: false },
  });

  // assert
  assert.deepStrictEqual(marketplaces[0]!.plugins, [
    { status: "available", name: "alpha", reasons: [] },
  ]);
  assert.deepStrictEqual(row, {
    status: "available",
    name: "alpha",
    reasons: ["installs disabled"],
  });
});

describe("resolveEnvelope", () => {
  for (const { name, message, expectedEnvelope } of [
    {
      name: "a clean cascade resolves to an info envelope",
      message: {
        kind: "cascade",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                name: "alpha",
                status: "installed",
                dependencies: [],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
      expectedEnvelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
    },
    {
      name: "a single warning row resolves to a warning envelope with its summary",
      message: {
        kind: "cascade",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                name: "alpha",
                status: "skipped",
                reasons: ["not installed"],
                severity: "warning",
                needsReload: false,
              },
            ],
          },
        ],
      },
      expectedEnvelope: {
        severity: "warning",
        summary: "A plugin operation needs attention.",
        needsReload: false,
        needsApply: false,
        noOp: false,
      },
    },
    {
      name: "an error cascade resolves to an error envelope with its summary",
      message: {
        kind: "cascade",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                name: "alpha",
                status: "failed",
                reasons: ["not found"],
                severity: "error",
                needsReload: false,
              },
              {
                name: "beta",
                status: "failed",
                reasons: ["not found"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
      expectedEnvelope: {
        severity: "error",
        summary: "Some plugin operations have failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
      },
    },
    {
      name: "a failed plugin info resolves to an error envelope",
      message: {
        kind: "plugin-info",
        marketplaceName: "official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: { name: "alpha", status: "failed", componentsResolved: false },
      },
      expectedEnvelope: {
        severity: "error",
        summary: "A plugin operation has failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
      },
    },
    {
      name: "an absent marketplace resolves to an error envelope",
      message: { kind: "marketplace-not-added", name: "missing" },
      expectedEnvelope: {
        severity: "error",
        summary: "A marketplace operation has failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
      },
    },
    {
      name: "a read-only info kind resolves to an info envelope",
      message: {
        kind: "marketplace-info",
        name: "official",
        scope: "user",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/marketplaces/official" },
      },
      expectedEnvelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
    },
    {
      name: "a single-target cascade resolves no tally",
      message: {
        kind: "cascade",
        cardinality: "single",
        label: "Plugin install",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ name: "alpha", status: "available", severity: "info" }],
          },
        ],
      },
      expectedEnvelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
    },
    {
      name: "a plural cascade without an operation label resolves no tally",
      message: {
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ name: "alpha", status: "available", severity: "info" }],
          },
        ],
      },
      expectedEnvelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
    },
    {
      name: "an empty plural cascade resolves no tally",
      message: { kind: "cascade", cardinality: "plural", label: "Plugin list", marketplaces: [] },
      expectedEnvelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
    },
    {
      name: "a populated plural cascade with no operation rows resolves zero successes",
      message: {
        kind: "cascade",
        cardinality: "plural",
        label: "Plugin list",
        marketplaces: [{ name: "official", scope: "user", plugins: [] }],
      },
      expectedEnvelope: {
        severity: "info",
        needsReload: false,
        needsApply: false,
        noOp: false,
        tally: { label: "Plugin list", failures: 0, warnings: 0, success: { count: 0 } },
      },
    },
    {
      name: "an unstamped cascade plugin counts as one success",
      message: {
        cardinality: "plural",
        label: "Plugin list",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ name: "alpha", status: "available" }],
          },
        ],
      },
      expectedEnvelope: {
        severity: "info",
        needsReload: false,
        needsApply: false,
        noOp: false,
        tally: { label: "Plugin list", failures: 0, warnings: 0, success: { count: 1 } },
      },
    },
    {
      name: "bare marketplace headers are excluded from the success count",
      message: {
        kind: "cascade",
        cardinality: "plural",
        label: "Plugin list",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              { name: "alpha", status: "available", severity: "info" },
              { name: "beta", status: "available", severity: "info" },
            ],
          },
          {
            name: "extra",
            scope: "project",
            status: "added",
            severity: "info",
            needsReload: false,
            plugins: [],
          },
        ],
      },
      expectedEnvelope: {
        severity: "info",
        needsReload: false,
        needsApply: false,
        noOp: false,
        tally: { label: "Plugin list", failures: 0, warnings: 0, success: { count: 3 } },
      },
    },
    {
      name: "a plural tally counts failures, warnings, and successes together",
      message: {
        cardinality: "plural",
        label: "Plugin update",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "failed",
            severity: "error",
            plugins: [
              {
                name: "warning-row",
                status: "skipped",
                reasons: ["not installed"],
                severity: "warning",
                needsReload: false,
              },
              { name: "success-row", status: "available", severity: "info" },
            ],
          },
        ],
      },
      expectedEnvelope: {
        severity: "error",
        summary: "A marketplace operation has failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
        tally: { label: "Plugin update", failures: 1, warnings: 1, success: { count: 1 } },
      },
    },
    {
      name: "a failure-only plural cascade resolves no success category",
      message: {
        kind: "cascade",
        cardinality: "plural",
        label: "Plugin install",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                name: "alpha",
                status: "failed",
                reasons: ["not found"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
      expectedEnvelope: {
        severity: "error",
        summary: "A plugin operation has failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
        tally: { label: "Plugin install", failures: 1, warnings: 0 },
      },
    },
    {
      name: "a positive update override resolves its verb as the success category",
      message: {
        kind: "cascade",
        cardinality: "plural",
        label: "Plugin update",
        marketplaces: [],
        tally: { verb: "updated", count: 2 },
      },
      expectedEnvelope: {
        severity: "info",
        needsReload: false,
        needsApply: false,
        noOp: false,
        tally: {
          label: "Plugin update",
          failures: 0,
          warnings: 0,
          success: { count: 2, verb: "updated" },
        },
      },
    },
    {
      name: "a zero update override with one failure resolves failures only",
      message: {
        kind: "cascade",
        cardinality: "plural",
        label: "Plugin update",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                name: "alpha",
                status: "failed",
                reasons: ["not found"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
        tally: { verb: "updated", count: 0 },
      },
      expectedEnvelope: {
        severity: "error",
        summary: "A plugin operation has failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
        tally: { label: "Plugin update", failures: 1, warnings: 0 },
      },
    },
    {
      name: "a marketplace reload stamp resolves needsReload",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "added",
            severity: "info",
            needsReload: true,
            plugins: [],
          },
        ],
      },
      expectedEnvelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
    },
    {
      name: "a plugin reload stamp resolves needsReload",
      message: {
        kind: "cascade",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              { name: "alpha", status: "available", severity: "info", needsReload: false },
              {
                name: "beta",
                status: "installed",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
      expectedEnvelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
    },
    {
      name: "APL-04 / D-14: a cascade that sets needsApply resolves needsApply",
      message: {
        kind: "cascade",
        needsApply: true,
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ name: "alpha", status: "will install", severity: "info" }],
          },
        ],
      },
      expectedEnvelope: { severity: "info", needsReload: false, needsApply: true, noOp: false },
    },
    {
      name: "APL-04 / D-14: a kindless cascade that sets needsApply resolves needsApply",
      message: {
        needsApply: true,
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ name: "alpha", status: "will uninstall", severity: "info" }],
          },
        ],
      },
      expectedEnvelope: { severity: "info", needsReload: false, needsApply: true, noOp: false },
    },
    {
      name: "an applied reconcile resolves its tally and the reload its row stamps",
      message: {
        kind: "reconcile-applied-cascade",
        cardinality: "plural",
        label: "Reconcile",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                name: "alpha",
                status: "installed",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
      expectedEnvelope: {
        severity: "info",
        needsReload: true,
        needsApply: false,
        noOp: false,
        tally: { label: "Reconcile", failures: 0, warnings: 0, success: { count: 1 } },
      },
    },
  ] satisfies readonly {
    readonly name: string;
    readonly message: NotificationMessage;
    readonly expectedEnvelope: ResolvedEnvelope;
  }[]) {
    test(name, () => {
      // act
      const envelope = resolveEnvelope(message);

      // assert
      assert.deepStrictEqual(envelope, expectedEnvelope);
    });
  }
});

describe("resolveUpdateNoOpEnvelope", () => {
  test("resolves the no-op flag with no tally and no reload", () => {
    // arrange
    const message = {
      cardinality: "plural",
      label: "Plugin update",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              name: "alpha",
              status: "partially-upgradable",
              reasons: ["lsp"],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    } satisfies CascadeNotificationMessage;

    // act
    const envelope = resolveUpdateNoOpEnvelope(message);

    // assert
    assert.deepStrictEqual(envelope, {
      severity: "info",
      needsReload: false,
      needsApply: false,
      noOp: true,
    });
  });

  test("resolves the severity and summary of a no-op with a warning row", () => {
    // arrange
    const message = {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              name: "alpha",
              status: "skipped",
              reasons: ["not installed"],
              severity: "warning",
              needsReload: false,
            },
          ],
        },
      ],
    } satisfies CascadeNotificationMessage;

    // act
    const envelope = resolveUpdateNoOpEnvelope(message);

    // assert
    assert.deepStrictEqual(envelope, {
      severity: "warning",
      summary: "A plugin operation needs attention.",
      needsReload: false,
      needsApply: false,
      noOp: true,
    });
  });
});

/** One marketplace holding `plugins`, in the shape `resolveRows` reads. */
function marketplaceWith(
  plugins: readonly PluginNotificationMessage[],
): readonly MarketplaceNotificationMessage[] {
  return [{ name: "official", scope: "user", plugins }];
}

/** A snapshot in which every companion extension is loaded. */
function allLoaded(): SoftDepStatus {
  return { piSubagentsLoaded: true, piMcpAdapterLoaded: true, workflowEngineLoaded: true };
}

/** A snapshot in which no companion extension is loaded. */
function noneLoaded(): SoftDepStatus {
  return { piSubagentsLoaded: false, piMcpAdapterLoaded: false, workflowEngineLoaded: false };
}

describe("resolveRows", () => {
  test("serializes a failed row's cause chain and rollback phases", () => {
    // arrange
    const marketplaces = marketplaceWith([
      {
        status: "failed",
        severity: "error",
        name: "alpha",
        reasons: ["rollback partial"],
        cause: new Error("outer", { cause: new Error("inner") }),
        rollbackPartial: [
          { phase: "skills", cause: new Error("undo failed") },
          { phase: "commands" },
        ],
      },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved, [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            severity: "error",
            name: "alpha",
            reasons: ["rollback partial"],
            failure: {
              cause: { causeChain: ["outer", "inner"], truncated: false },
              leaks: [],
              rollbackPartial: [
                { phase: "skills", cause: { causeChain: ["undo failed"], truncated: false } },
                { phase: "commands" },
              ],
            },
          },
        ],
      },
    ] satisfies readonly ResolvedMarketplace[]);
  });

  test("resolves a failed row without a cause to empty failure facts", () => {
    // arrange
    const marketplaces = marketplaceWith([
      { status: "failed", severity: "warning", name: "alpha", reasons: ["not found"] },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      {
        status: "failed",
        severity: "warning",
        name: "alpha",
        reasons: ["not found"],
        failure: { leaks: [], rollbackPartial: [] },
      },
    ]);
  });

  for (const { title, row, expectedRow } of [
    {
      title: "serializes the remedy cause of a load-time dependency disable row",
      row: {
        status: "disabled",
        severity: "warning",
        needsReload: false,
        name: "alpha",
        reasons: ["dependency unsatisfied"],
        cause: new Error('Install "vault@mp" or uninstall "alpha@mp"'),
      },
      expectedRow: {
        status: "disabled",
        severity: "warning",
        needsReload: false,
        name: "alpha",
        reasons: ["dependency unsatisfied"],
        failure: {
          cause: { causeChain: ['Install "vault@mp" or uninstall "alpha@mp"'], truncated: false },
          leaks: [],
          rollbackPartial: [],
        },
      },
    },
    {
      title: "serializes the dependents cause of an uninstalled row",
      row: {
        status: "uninstalled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        reasons: ["dependents unsatisfied"],
        cause: new Error("required by beta@mp"),
      },
      expectedRow: {
        status: "uninstalled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        reasons: ["dependents unsatisfied"],
        failure: {
          cause: { causeChain: ["required by beta@mp"], truncated: false },
          leaks: [],
          rollbackPartial: [],
        },
      },
    },
    {
      title: "serializes the held-update cause of a skipped row",
      row: {
        status: "skipped",
        severity: "warning",
        needsReload: false,
        name: "alpha",
        reasons: ["dependents constrain"],
        cause: new Error('required by "beta@mp"'),
      },
      expectedRow: {
        status: "skipped",
        severity: "warning",
        needsReload: false,
        name: "alpha",
        reasons: ["dependents constrain"],
        failure: {
          cause: { causeChain: ['required by "beta@mp"'], truncated: false },
          leaks: [],
          rollbackPartial: [],
        },
      },
    },
    {
      title: "gives a disabled row without a cause no failure facts",
      row: { status: "disabled", severity: "info", needsReload: true, name: "alpha" },
      expectedRow: {
        status: "disabled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        reasons: [],
      },
    },
    {
      title: "gives an uninstalled row without a cause no failure facts",
      row: { status: "uninstalled", severity: "info", needsReload: true, name: "alpha" },
      expectedRow: {
        status: "uninstalled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        reasons: [],
      },
    },
  ] as const satisfies readonly {
    title: string;
    row: PluginNotificationMessage;
    expectedRow: ResolvedRow;
  }[]) {
    test(title, () => {
      // act
      const resolved = resolveRows(marketplaceWith([row]), allLoaded(), CENTRAL_ROW_POLICY);

      // assert
      assert.deepStrictEqual(resolved[0]!.plugins, [expectedRow]);
    });
  }

  test("D-10-13: resolves the disclosure cause of an updated, a reinstalled, and a partially installed row and still composes their markers", () => {
    // arrange
    const disclosure = 'constrained to the combined range (^1.0.0) -- required by "app@tools"';
    const rows: readonly PluginNotificationMessage[] = [
      {
        status: "updated",
        severity: "info",
        needsReload: true,
        name: "lib",
        from: "1.0.0",
        to: "1.1.0",
        dependencies: ["agents"],
        reasons: ["dependency current copy"],
        cause: new Error(disclosure),
      },
      {
        status: "reinstalled",
        severity: "info",
        needsReload: true,
        name: "lib",
        version: "1.0.0",
        dependencies: ["agents"],
        reasons: ["dependency current copy"],
        cause: new Error(disclosure),
      },
      {
        status: "partially-installed",
        severity: "info",
        needsReload: true,
        name: "lib",
        from: "1.0.0",
        version: "1.1.0",
        dependencies: [],
        reasons: ["lsp"],
        cause: new Error(disclosure),
      },
      {
        status: "updated",
        severity: "info",
        needsReload: true,
        name: "other",
        from: "1.0.0",
        to: "1.1.0",
        dependencies: [],
      },
      {
        status: "reinstalled",
        severity: "info",
        needsReload: true,
        name: "other",
        version: "1.0.0",
        dependencies: [],
      },
    ];
    const failure = {
      cause: { causeChain: [disclosure], truncated: false },
      leaks: [],
      rollbackPartial: [],
    };

    // act
    const resolved = resolveRows(marketplaceWith(rows), noneLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      {
        status: "updated",
        severity: "info",
        needsReload: true,
        name: "lib",
        from: "1.0.0",
        to: "1.1.0",
        reasons: ["dependency current copy", "requires pi-subagents"],
        failure,
      },
      {
        status: "reinstalled",
        severity: "info",
        needsReload: true,
        name: "lib",
        version: "1.0.0",
        reasons: ["dependency current copy", "requires pi-subagents"],
        failure,
      },
      {
        status: "partially-installed",
        severity: "info",
        needsReload: true,
        name: "lib",
        from: "1.0.0",
        version: "1.1.0",
        reasons: ["lsp"],
        failure,
      },
      {
        status: "updated",
        severity: "info",
        needsReload: true,
        name: "other",
        from: "1.0.0",
        to: "1.1.0",
        reasons: [],
      },
      {
        status: "reinstalled",
        severity: "info",
        needsReload: true,
        name: "other",
        version: "1.0.0",
        reasons: [],
      },
    ]);
  });

  test("reads the leaked paths of a ManualRecoveryError cause", () => {
    // arrange
    const marketplaces = marketplaceWith([
      {
        status: "failed",
        severity: "error",
        name: "alpha",
        reasons: ["rollback partial"],
        cause: new ManualRecoveryError("stuck", ["/tmp/a", "/tmp/b"]),
      },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      {
        status: "failed",
        severity: "error",
        name: "alpha",
        reasons: ["rollback partial"],
        failure: {
          cause: { causeChain: ["stuck"], truncated: false },
          leaks: ["/tmp/a", "/tmp/b"],
          rollbackPartial: [],
        },
      },
    ]);
  });

  test("PMOD-04 / D-07 redacts the credentials of manual-recovery leaks", () => {
    // arrange
    const marketplaces = marketplaceWith([
      {
        status: "manual recovery",
        severity: "error",
        name: "alpha",
        reasons: ["rollback partial"],
        cause: new ManualRecoveryError("stuck", [
          "clone-ghp_0123456789abcdefghijklmnopqrstuvwxyz",
          "/tmp/leak",
        ]),
      },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      {
        status: "manual recovery",
        severity: "error",
        name: "alpha",
        reasons: ["rollback partial"],
        failure: {
          cause: { causeChain: ["stuck"], truncated: false },
          leaks: ["clone-***", "/tmp/leak"],
          rollbackPartial: [],
        },
      },
    ]);
  });

  for (const { title, name, expectedName } of [
    {
      title: "PMOD-04 / D-07 redacts the userinfo of a marketplace block name",
      name: "https://alice:s3cret@gitlab.example.com/team/private-mp",
      expectedName: "https://***@gitlab.example.com/team/private-mp",
    },
    {
      title: "keeps an scp-style marketplace block name unchanged",
      name: "git@github.com:foo/bar.git",
      expectedName: "git@github.com:foo/bar.git",
    },
  ]) {
    test(title, () => {
      // arrange
      const marketplaces: readonly MarketplaceNotificationMessage[] = [
        {
          name,
          scope: "project",
          status: "failed",
          severity: "error",
          reasons: ["authentication required"],
          plugins: [],
        },
      ];

      // act
      const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

      // assert
      assert.deepStrictEqual(resolved, [
        {
          name: expectedName,
          scope: "project",
          status: "failed",
          severity: "error",
          reasons: ["authentication required"],
          plugins: [],
        },
      ] satisfies readonly ResolvedMarketplace[]);
    });
  }

  test("PMOD-04 / D-07 redacts the userinfo of a plugin row name", () => {
    // arrange
    const marketplaces = marketplaceWith([
      { status: "will install", name: "https://alice:s3cret@github.com/o/r.git" },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved, [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "will install", name: "https://***@github.com/o/r.git", reasons: [] }],
      },
    ] satisfies readonly ResolvedMarketplace[]);
  });

  test("PMOD-04 / D-07 redacts the userinfo a last-@ split leaves at the end of a row name", () => {
    // arrange
    const marketplaces = marketplaceWith([
      { status: "will install", name: "foo@https://alice:s3cret" },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved, [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "will install", name: "foo@https://***", reasons: [] }],
      },
    ] satisfies readonly ResolvedMarketplace[]);
  });

  test("resolves a manual-recovery row with its leaks and no rollback phases", () => {
    // arrange
    const marketplaces = marketplaceWith([
      {
        status: "manual recovery",
        severity: "error",
        name: "alpha",
        reasons: ["rollback partial"],
        cause: new ManualRecoveryError("stuck", ["/tmp/leak"], { cause: new Error("inner") }),
      },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      {
        status: "manual recovery",
        severity: "error",
        name: "alpha",
        reasons: ["rollback partial"],
        failure: {
          cause: { causeChain: ["stuck", "inner"], truncated: false },
          leaks: ["/tmp/leak"],
          rollbackPartial: [],
        },
      },
    ]);
  });

  test("copies a non-failure row without a failure or dependencies key", () => {
    // arrange
    const marketplaces = marketplaceWith([
      {
        status: "installed",
        severity: "info",
        needsReload: true,
        name: "alpha",
        dependencies: [],
      },
    ]);

    // act
    const resolved = resolveRows(marketplaces, allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      { status: "installed", severity: "info", needsReload: true, name: "alpha", reasons: [] },
    ]);
  });

  test("leaves the input row unchanged when every status has a row policy", () => {
    // arrange
    const cause = new Error("outer");
    const row = {
      status: "failed",
      severity: "warning",
      name: "alpha",
      reasons: ["not found"],
      cause,
    } satisfies PluginFailedMessage;

    // act
    resolveRows(marketplaceWith([row]), allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(row, {
      status: "failed",
      severity: "warning",
      name: "alpha",
      reasons: ["not found"],
      cause,
    });
  });

  test("floors the input row to error when its status has no row policy", () => {
    // arrange
    const row = {
      status: "disabled",
      severity: "info",
      needsReload: false,
      name: "orphan",
    } satisfies PluginNotificationMessage;

    // act
    const resolved = resolveRows(marketplaceWith([row]), allLoaded(), {});

    // assert
    assert.deepStrictEqual(row, {
      status: "disabled",
      severity: "error",
      needsReload: false,
      name: "orphan",
    });
    assert.deepStrictEqual(resolved[0]!.plugins, [
      {
        status: "disabled",
        severity: "error",
        needsReload: false,
        name: "orphan",
        reasons: [],
        missingPolicy: true,
      },
    ]);
  });

  test("keeps a frozen row's severity and adds no name to its resolved copy", () => {
    // arrange
    const row = Object.freeze({ status: "unknown", severity: "info" });

    // act
    const resolved = resolveRows(marketplaceWith([row as never]), allLoaded(), {});

    // assert
    assert.deepStrictEqual(row, { status: "unknown", severity: "info" });
    assert.deepStrictEqual(resolved[0]!.plugins, [
      { status: "unknown", severity: "info", reasons: [], missingPolicy: true },
    ]);
  });

  test("keeps the shape of a diagnostic row whose name is undefined", () => {
    // arrange
    const row = { status: "unknown", severity: "error", name: undefined };

    // act
    const resolved = resolveRows(marketplaceWith([row as never]), allLoaded(), {});

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      { status: "unknown", severity: "error", name: undefined, reasons: [], missingPolicy: true },
    ]);
  });

  for (const { row, expectedRow } of [
    {
      row: { status: "unavailable", name: "alpha", reasons: ["lsp"], partialHint: true },
      expectedRow: {
        status: "unavailable",
        name: "alpha",
        reasons: ["lsp"],
        hint: "partial-install",
      },
    },
    {
      row: { status: "partially-available", name: "alpha", reasons: ["lsp"], partialHint: true },
      expectedRow: {
        status: "partially-available",
        name: "alpha",
        reasons: ["lsp"],
        hint: "partial-install",
      },
    },
    {
      row: { status: "partially-upgradable", name: "alpha", reasons: ["lsp"], partialHint: true },
      expectedRow: {
        status: "partially-upgradable",
        name: "alpha",
        reasons: ["lsp"],
        hint: "partial-update",
      },
    },
    {
      row: { status: "partially-upgradable", name: "alpha", reasons: ["lsp"], catalogHint: true },
      expectedRow: {
        status: "partially-upgradable",
        name: "alpha",
        reasons: ["lsp"],
        hint: "catalog-partial-update",
      },
    },
    {
      row: {
        status: "failed",
        severity: "error",
        name: "alpha",
        reasons: ["lsp"],
        partialHint: true,
      },
      expectedRow: {
        status: "failed",
        severity: "error",
        name: "alpha",
        reasons: ["lsp"],
        hint: "stale-gate-update",
        failure: { leaks: [], rollbackPartial: [] },
      },
    },
    {
      row: {
        status: "disabled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        enableHint: true,
      },
      expectedRow: {
        status: "disabled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        reasons: [],
        hint: "enable",
      },
    },
  ] as const satisfies readonly {
    row: PluginNotificationMessage;
    expectedRow: ResolvedRow;
  }[]) {
    test(`resolves the ${expectedRow.hint} hint on a flagged ${row.status} row`, () => {
      // act
      const resolved = resolveRows(marketplaceWith([row]), allLoaded(), CENTRAL_ROW_POLICY);

      // assert
      assert.deepStrictEqual(resolved[0]!.plugins, [expectedRow]);
    });
  }

  for (const { flag, row, expectedRow } of [
    {
      flag: "a false partialHint",
      row: { status: "unavailable", name: "alpha", reasons: ["lsp"], partialHint: false },
      expectedRow: { status: "unavailable", name: "alpha", reasons: ["lsp"] },
    },
    {
      flag: "an absent partialHint",
      row: { status: "partially-upgradable", name: "alpha", reasons: ["lsp"] },
      expectedRow: { status: "partially-upgradable", name: "alpha", reasons: ["lsp"] },
    },
    {
      flag: "a false enableHint",
      row: {
        status: "disabled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        enableHint: false,
      },
      expectedRow: {
        status: "disabled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        reasons: [],
      },
    },
  ] as const satisfies readonly {
    flag: string;
    row: PluginNotificationMessage;
    expectedRow: ResolvedRow;
  }[]) {
    test(`resolves no hint from ${flag} on a ${row.status} row`, () => {
      // act
      const resolved = resolveRows(marketplaceWith([row]), allLoaded(), CENTRAL_ROW_POLICY);

      // assert
      assert.deepStrictEqual(resolved[0]!.plugins, [expectedRow]);
    });
  }

  test("resolves no hint from a partialHint on a status that takes none", () => {
    // arrange
    const row = { status: "upgradable", name: "alpha", reasons: [], partialHint: true };

    // act
    const resolved = resolveRows(marketplaceWith([row as never]), allLoaded(), CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      { status: "upgradable", name: "alpha", reasons: [], partialHint: true },
    ]);
  });

  for (const { dependency, policy, companion, snapshot, expectedReasons } of [
    {
      dependency: "agents",
      policy: "on",
      companion: "missing",
      snapshot: noneLoaded(),
      expectedReasons: ["orphan rewake", "requires pi-subagents"],
    },
    {
      dependency: "agents",
      policy: "on",
      companion: "loaded",
      snapshot: allLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "agents",
      policy: "off",
      companion: "missing",
      snapshot: noneLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "agents",
      policy: "off",
      companion: "loaded",
      snapshot: allLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "mcp",
      policy: "on",
      companion: "missing",
      snapshot: noneLoaded(),
      expectedReasons: ["orphan rewake", "requires pi-mcp-adapter"],
    },
    {
      dependency: "mcp",
      policy: "on",
      companion: "loaded",
      snapshot: allLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "mcp",
      policy: "off",
      companion: "missing",
      snapshot: noneLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "mcp",
      policy: "off",
      companion: "loaded",
      snapshot: allLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "workflows",
      policy: "on",
      companion: "missing",
      snapshot: noneLoaded(),
      expectedReasons: ["orphan rewake", "requires pi-dynamic-workflows"],
    },
    {
      dependency: "workflows",
      policy: "on",
      companion: "loaded",
      snapshot: allLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "workflows",
      policy: "off",
      companion: "missing",
      snapshot: noneLoaded(),
      expectedReasons: ["orphan rewake"],
    },
    {
      dependency: "workflows",
      policy: "off",
      companion: "loaded",
      snapshot: allLoaded(),
      expectedReasons: ["orphan rewake"],
    },
  ] as const satisfies readonly {
    dependency: Dependency;
    policy: "on" | "off";
    companion: "loaded" | "missing";
    snapshot: SoftDepStatus;
    expectedReasons: readonly Reason[];
  }[]) {
    test(`D-12: a ${dependency} dependency with the policy ${policy} and its companion ${companion} resolves reasons ${expectedReasons.join(", ")}`, () => {
      // arrange
      const row = {
        status: "installed",
        severity: "info",
        needsReload: true,
        name: "alpha",
        dependencies: [dependency],
        reasons: ["orphan rewake"],
      } satisfies PluginNotificationMessage;
      const markers = { installed: { markers: policy === "on", contentReasons: true } };

      // act
      const resolved = resolveRows(marketplaceWith([row]), snapshot, markers);

      // assert
      assert.deepStrictEqual(resolved[0]!.plugins, [
        {
          status: "installed",
          severity: "info",
          needsReload: true,
          name: "alpha",
          reasons: expectedReasons,
        },
      ]);
    });
  }

  for (const { title, row, markers, expectedRow } of [
    {
      title: "PMOD-01: puts content reasons first, then the agents, mcp, workflows markers",
      row: {
        status: "updated",
        severity: "info",
        needsReload: true,
        name: "alpha",
        from: "1.0.0",
        to: "2.0.0",
        dependencies: ["workflows", "mcp", "agents"],
        reasons: ["orphan rewake", "malformed skill"],
      },
      markers: { updated: { markers: true, contentReasons: true } },
      expectedRow: {
        status: "updated",
        severity: "info",
        needsReload: true,
        name: "alpha",
        from: "1.0.0",
        to: "2.0.0",
        reasons: [
          "orphan rewake",
          "malformed skill",
          "requires pi-subagents",
          "requires pi-mcp-adapter",
          "requires pi-dynamic-workflows",
        ],
      },
    },
    {
      title: "PMOD-01: keeps duplicate content reasons ahead of the markers",
      row: {
        status: "partially-installed",
        name: "alpha",
        dependencies: ["mcp"],
        reasons: ["lsp", "lsp"],
      },
      markers: { "partially-installed": { markers: true, contentReasons: true } },
      expectedRow: {
        status: "partially-installed",
        name: "alpha",
        reasons: ["lsp", "lsp", "requires pi-mcp-adapter"],
      },
    },
    {
      title: "D-12: a row without dependencies gets no marker with the policy on",
      row: { status: "partially-installed", name: "alpha", reasons: ["lsp"] },
      markers: { "partially-installed": { markers: true, contentReasons: true } },
      expectedRow: { status: "partially-installed", name: "alpha", reasons: ["lsp"] },
    },
    {
      title: "D-12: an absent policy produces a marker-free diagnostic",
      row: {
        status: "reinstalled",
        severity: "info",
        needsReload: true,
        name: "alpha",
        dependencies: ["agents"],
      },
      markers: { installed: { markers: true, contentReasons: true } },
      expectedRow: {
        status: "reinstalled",
        severity: "error",
        needsReload: true,
        name: "alpha",
        reasons: [],
        missingPolicy: true,
      },
    },
  ] as const satisfies readonly {
    title: string;
    row: PluginNotificationMessage;
    markers: RowPolicyMap;
    expectedRow: ResolvedRow;
  }[]) {
    test(title, () => {
      // act
      const resolved = resolveRows(marketplaceWith([row]), noneLoaded(), markers);

      // assert
      assert.deepStrictEqual(resolved[0]!.plugins, [expectedRow]);
    });
  }
});

describe("resolveNotAddedReason", () => {
  for (const { title, message, expectedReason } of [
    {
      title: "the plain token without presentInOtherScope",
      message: { kind: "marketplace-not-added", name: "missing", scope: "user" },
      expectedReason: "marketplace not added",
    },
    {
      title: "the plain token when presentInOtherScope has no scope",
      message: { kind: "marketplace-not-added", name: "missing", presentInOtherScope: true },
      expectedReason: "marketplace not added",
    },
    {
      title: "the user-scope token for a user-scope miss",
      message: {
        kind: "marketplace-not-added",
        name: "missing",
        scope: "user",
        presentInOtherScope: true,
      },
      expectedReason: "marketplace not added to user scope",
    },
    {
      title: "the project-scope token for a project-scope miss",
      message: {
        kind: "marketplace-not-added",
        name: "missing",
        scope: "project",
        presentInOtherScope: true,
      },
      expectedReason: "marketplace not added to project scope",
    },
  ] as const satisfies readonly {
    title: string;
    message: MarketplaceNotAddedMessage;
    expectedReason: string;
  }[]) {
    test(`resolves ${title}`, () => {
      // act
      const reason = resolveNotAddedReason(message);

      // assert
      assert.strictEqual(reason, expectedReason);
    });
  }
});

describe("resolveRawSurface", () => {
  test("serializes an Error cause to its message", () => {
    // arrange
    const surface = { kind: "reconcile-aborted", cause: new Error("boom") } as const;

    // act
    const resolved = resolveRawSurface(surface);

    // assert
    assert.deepStrictEqual(resolved, { kind: "reconcile-aborted", causeMessage: "boom" });
  });

  for (const { title, cause, causeMessage } of [
    { title: "a string cause", cause: "boom", causeMessage: "boom" },
    { title: "a number cause", cause: 42, causeMessage: "42" },
    { title: "an undefined cause", cause: undefined, causeMessage: "undefined" },
  ] as const satisfies readonly { title: string; cause: unknown; causeMessage: string }[]) {
    test(`serializes ${title} to its string form`, () => {
      // arrange
      const surface = { kind: "reconcile-aborted", cause } as const;

      // act
      const resolved = resolveRawSurface(surface);

      // assert
      assert.deepStrictEqual(resolved, { kind: "reconcile-aborted", causeMessage });
    });
  }

  test("PMOD-04 / D-07 redacts a credential in a reconcile-aborted cause", () => {
    // arrange
    const surface = {
      kind: "reconcile-aborted",
      cause: new Error("clone https://user:tok@host/o/r failed"),
    } as const;

    // act
    const resolved = resolveRawSurface(surface);

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "reconcile-aborted",
      causeMessage: "clone https://***@host/o/r failed",
    });
  });

  test("keeps a plugin-path-skipped surface without a credential equal", () => {
    // arrange
    const surface = {
      kind: "plugin-path-skipped",
      scope: "user",
      reason: "state.json is unreadable",
    } satisfies PluginPathSkippedSurface;

    // act
    const resolved = resolveRawSurface(surface);

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "plugin-path-skipped",
      scope: "user",
      reason: "state.json is unreadable",
    });
  });

  test("PMOD-04 / D-07 redacts a credential in a plugin-path-skipped reason", () => {
    // arrange
    const surface = {
      kind: "plugin-path-skipped",
      scope: "project",
      reason: "fetch with Bearer abc.def failed",
    } satisfies PluginPathSkippedSurface;

    // act
    const resolved = resolveRawSurface(surface);

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "plugin-path-skipped",
      scope: "project",
      reason: "fetch with Bearer *** failed",
    });
  });

  test("PMOD-04 / D-07 redacts a usage-error message and keeps its usage text", () => {
    // arrange
    const surface = {
      kind: "usage-error",
      message: "invalid source https://user:tok@host/o/r",
      usage: "usage: add <https://user@host/o/r>",
    } as const;

    // act
    const resolved = resolveRawSurface(surface);

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "usage-error",
      message: "invalid source https://***@host/o/r",
      usage: "usage: add <https://user@host/o/r>",
    });
  });

  test("PMOD-04 / D-07 redacts a diagnostic header and every line", () => {
    // arrange
    const surface = {
      kind: "diagnostic",
      header: "import of https://user:tok@host/o/r skipped:",
      lines: ["  x-access-token:abc123 rejected", "  plain line"],
    } as const;

    // act
    const resolved = resolveRawSurface(surface);

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "diagnostic",
      header: "import of https://***@host/o/r skipped:",
      lines: ["  x-access-token:*** rejected", "  plain line"],
    });
  });

  for (const surface of [
    { kind: "usage-info", usage: "usage: add <https://user:tok@host/o/r>" },
    {
      kind: "device-flow-prompt",
      verificationUri: "https://github.com/login/device",
      userCode: "ABCD-1234",
    },
    { kind: "async-rewake-summary", summary: "rewake with Bearer abc" },
    { kind: "stop-override-cap", pluginId: "alpha@official", cap: 8 },
  ] as const) {
    test(`returns a ${surface.kind} surface as the same object`, () => {
      // arrange
      const expectedSurface = surface;

      // act
      const resolved = resolveRawSurface(surface);

      // assert
      assert.strictEqual(resolved, expectedSurface);
    });
  }

  for (const { requirement, notice } of [
    {
      requirement: "AFILE-04",
      notice: { kind: "left-unchanged", scope: "project", file: "mcp-adapter.json" },
    },
    {
      requirement: "AFILE-06",
      notice: {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "srv",
        fields: ["env", "headers"],
      },
    },
    {
      requirement: "AVAR-04",
      notice: {
        kind: "variables-missing",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_srv_",
        names: ["DD_SITE"],
      },
    },
    {
      requirement: "AVAR-05",
      notice: {
        kind: "credentials-blanked",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_srv_",
        names: ["ANTHROPIC_API_KEY"],
      },
    },
    {
      requirement: "ANAME-07",
      notice: {
        kind: "tool-rules-unenforced",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_srv_",
        fields: ["toolPermissions"],
      },
    },
    {
      requirement: "AMIG-01",
      notice: {
        kind: "leftover-removed",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "srv",
      },
    },
  ] as const) {
    test(`${requirement}: a repeated ${notice.kind} notice resolves once`, () => {
      // arrange
      const surface = {
        kind: "mcp-config-notices",
        section: notice.kind,
        notices: [notice, notice],
      } as const;

      // act
      const resolved = resolveRawSurface(surface);

      // assert
      assert.deepStrictEqual(resolved, {
        kind: "mcp-config-notices",
        section: notice.kind,
        notices: [notice],
      });
    });
  }

  test("PMOD-04 redacts a credential in each name a config notice carries", () => {
    // arrange
    const surface = {
      kind: "mcp-config-notices",
      section: "override-kept",
      notices: [
        {
          kind: "override-kept",
          scope: "user",
          file: "mcp-adapter.json",
          plugin: "https://u:tok@h/p",
          server: "https://u:tok@h/s",
          fields: ["https://u:tok@h/f"],
        },
      ],
    } as const;

    // act
    const resolved = resolveRawSurface(surface);

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-config-notices",
      section: "override-kept",
      notices: [
        {
          kind: "override-kept",
          scope: "user",
          file: "mcp-adapter.json",
          plugin: "https://***@h/p",
          server: "https://***@h/s",
          fields: ["https://***@h/f"],
        },
      ],
    });
  });

  test("AMIG-03: moved rows sort project first, then by plugin and old name in code-unit order, at info", () => {
    // arrange
    const userAcme = {
      kind: "moved",
      scope: "user",
      plugin: "acme",
      marketplace: "mp",
      from: "srv",
      to: "plugin_acme_srv_",
    } as const;
    const projectBeta = {
      kind: "moved",
      scope: "project",
      plugin: "beta",
      marketplace: "mp",
      from: "alpha",
      to: "plugin_beta_alpha_",
    } as const;
    const projectAcmeWeb = {
      kind: "moved",
      scope: "project",
      plugin: "acme",
      marketplace: "mp",
      from: "web",
      to: "plugin_acme_web_",
    } as const;
    const projectAcmeApi = {
      kind: "moved",
      scope: "project",
      plugin: "acme",
      marketplace: "mp",
      from: "api",
      to: "plugin_acme_api_",
    } as const;
    const projectZed = {
      kind: "moved",
      scope: "project",
      plugin: "Zed",
      marketplace: "mp",
      from: "srv",
      to: "plugin_Zed_srv_",
    } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [userAcme, projectBeta, projectAcmeWeb, projectAcmeApi, projectZed],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [projectZed, projectAcmeApi, projectAcmeWeb, projectBeta, userAcme],
      notices: [],
      severity: "info",
      needsReload: true,
    });
  });

  test("AMIG-03: a stopped row with nothing moved is a warning that needs no reload", () => {
    // arrange
    const stopped = { kind: "stopped", scope: "user", detail: "state.json is locked" } as const;

    // act
    const resolved = resolveRawSurface({ kind: "mcp-migration", rows: [stopped], notices: [] });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [stopped],
      notices: [],
      severity: "warning",
      needsReload: false,
    });
  });

  test("AMIG-03: moved and stopped rows share one warning, stopped rows sorted by scope then detail", () => {
    // arrange
    const userB = { kind: "stopped", scope: "user", detail: "b@mp: denied" } as const;
    const projectZ = { kind: "stopped", scope: "project", detail: "z@mp: denied" } as const;
    const moved = {
      kind: "moved",
      scope: "user",
      plugin: "acme",
      marketplace: "mp",
      from: "srv",
      to: "plugin_acme_srv_",
    } as const;
    const projectA = { kind: "stopped", scope: "project", detail: "a@mp: denied" } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [userB, projectZ, moved, projectA],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [moved, projectA, projectZ, userB],
      notices: [],
      severity: "warning",
      needsReload: true,
    });
  });

  test("AMIG-03: config notices resolve to their distinct notices in section order, at warning", () => {
    // arrange
    const moved = {
      kind: "moved",
      scope: "project",
      plugin: "acme",
      marketplace: "mp",
      from: "srv",
      to: "plugin_acme_srv_",
    } as const;
    const variablesMissing = {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "plugin_acme_srv_",
      names: ["TOKEN"],
    } as const;
    const commentsDropped = {
      kind: "comments-dropped",
      scope: "project",
      file: "mcp.json",
    } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [moved],
      notices: [variablesMissing, commentsDropped, variablesMissing],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [moved],
      notices: [commentsDropped, variablesMissing],
      severity: "warning",
      needsReload: true,
    });
  });

  test("AMIG-03: a tool-rules-unenforced notice resolves after the credentials-withheld notice, at warning", () => {
    // arrange
    const moved = {
      kind: "moved",
      scope: "project",
      plugin: "acme",
      marketplace: "mp",
      from: "srv",
      to: "plugin_acme_srv_",
    } as const;
    const toolRules = {
      kind: "tool-rules-unenforced",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "plugin_acme_srv_",
      fields: ["tools[].permission_policy", "toolPermissions"],
    } as const;
    const credentials = {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "plugin_acme_srv_",
      names: ["NPM_TOKEN"],
    } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [moved],
      notices: [toolRules, credentials],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [moved],
      notices: [credentials, toolRules],
      severity: "warning",
      needsReload: true,
    });
  });

  for (const { notice, severity } of [
    {
      notice: {
        kind: "variables-missing",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_srv_",
        names: ["TOKEN"],
      },
      severity: "warning",
    },
    {
      notice: {
        kind: "credentials-blanked",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_srv_",
        names: ["NPM_TOKEN"],
      },
      severity: "warning",
    },
    {
      notice: {
        kind: "tool-rules-unenforced",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_srv_",
        fields: ["toolPermissions"],
      },
      severity: "warning",
    },
    {
      notice: { kind: "comments-dropped", scope: "project", file: "mcp.json" },
      severity: "info",
    },
  ] as const) {
    test(`AMIG-03: a ${notice.kind} notice alone resolves an all-moved report at ${severity}`, () => {
      // arrange
      const moved = {
        kind: "moved",
        scope: "project",
        plugin: "acme",
        marketplace: "mp",
        from: "srv",
        to: "plugin_acme_srv_",
      } as const;

      // act
      const resolved = resolveRawSurface({
        kind: "mcp-migration",
        rows: [moved],
        notices: [notice],
      });

      // assert
      assert.deepStrictEqual(resolved, {
        kind: "mcp-migration",
        rows: [moved],
        notices: [notice],
        severity,
        needsReload: true,
      });
    });
  }

  test("AMIG-03: a leftover-removed notice makes an all-moved report a warning, its notice last", () => {
    // arrange
    const moved = {
      kind: "moved",
      scope: "project",
      plugin: "acme",
      marketplace: "mp",
      from: "srv",
      to: "plugin_acme_srv_",
    } as const;
    const leftover = {
      kind: "leftover-removed",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "srv",
    } as const;
    const toolRules = {
      kind: "tool-rules-unenforced",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "plugin_acme_srv_",
      fields: ["toolPermissions"],
    } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [moved],
      notices: [leftover, toolRules],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [moved],
      notices: [toolRules, leftover],
      severity: "warning",
      needsReload: true,
    });
  });

  test("AMIG-03: left-in-place rows sort with the stopped rows by scope, then plugin, then first old name", () => {
    // arrange
    const unownedB = {
      kind: "unowned",
      scope: "project",
      plugin: "b",
      marketplace: "mp",
      servers: ["x"],
    } as const;
    const stopped = { kind: "stopped", scope: "project", detail: "a@mp: denied" } as const;
    const unownedA = {
      kind: "unowned",
      scope: "project",
      plugin: "a",
      marketplace: "mp",
      servers: ["z", "b"],
    } as const;
    const userUnownedA = {
      kind: "unowned",
      scope: "user",
      plugin: "a",
      marketplace: "mp",
      servers: ["a"],
    } as const;
    const sourceUnreadable = {
      kind: "source-unreadable",
      scope: "project",
      plugin: "a",
      marketplace: "other",
      servers: ["m"],
    } as const;
    const fileUnreadable = { kind: "file-unreadable", scope: "project", file: "mcp.json" } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [unownedB, stopped, unownedA, userUnownedA, sourceUnreadable, fileUnreadable],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [fileUnreadable, sourceUnreadable, unownedA, stopped, unownedB, userUnownedA],
      notices: [],
      severity: "warning",
      needsReload: false,
    });
  });

  test("AMIG-03: owner rows of every kind sort by plugin, then first old name", () => {
    // arrange
    const collision = {
      kind: "collision",
      scope: "user",
      plugin: "e",
      marketplace: "mp",
      servers: ["e1"],
      key: "plugin_e_e1_",
      source: "the user-scope mcp-adapter.json",
    } as const;
    const unfinished = {
      kind: "unfinished",
      scope: "user",
      plugin: "d",
      marketplace: "mp",
      servers: ["d1"],
      file: "mcp.json",
      detail: "permission denied",
    } as const;
    const sourceOutdated = {
      kind: "source-outdated",
      scope: "user",
      plugin: "c",
      marketplace: "mp",
      servers: ["c1"],
    } as const;
    const notListed = {
      kind: "not-listed",
      scope: "user",
      plugin: "b",
      marketplace: "mp",
      servers: ["b1"],
    } as const;
    const marketplaceUnreadable = {
      kind: "marketplace-unreadable",
      scope: "user",
      plugin: "a",
      marketplace: "mp",
      servers: ["a1"],
    } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [collision, unfinished, sourceOutdated, notListed, marketplaceUnreadable],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [marketplaceUnreadable, notListed, sourceOutdated, unfinished, collision],
      notices: [],
      severity: "warning",
      needsReload: false,
    });
  });

  test("AMIG-03: removed rows sort project first, then by plugin and old name", () => {
    // arrange
    const rows = [
      { scope: "user", plugin: "a", server: "x" },
      { scope: "project", plugin: "b", server: "y" },
      { scope: "project", plugin: "a", server: "z" },
      { scope: "project", plugin: "a", server: "w" },
    ].map(({ scope, plugin, server }): McpMigrationRow => ({
      kind: "removed",
      scope: scope === "user" ? "user" : "project",
      plugin,
      marketplace: "mp",
      server,
      cause: "not-declared",
    }));

    // act
    const resolved = resolveRawSurface({ kind: "mcp-migration", rows, notices: [] });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [rows[3], rows[2], rows[1], rows[0]],
      notices: [],
      severity: "info",
      needsReload: true,
    });
  });

  test("AMIG-03: not-declared and disabled removals alone stay info and need a reload", () => {
    // arrange
    const gone = {
      kind: "removed",
      scope: "project",
      plugin: "hello",
      marketplace: "mp",
      server: "gone",
      cause: "not-declared",
    } as const;
    const disabled = {
      kind: "removed",
      scope: "project",
      plugin: "acme",
      marketplace: "mp",
      server: "srv",
      cause: "disabled",
    } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [gone, disabled],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [disabled, gone],
      notices: [],
      severity: "info",
      needsReload: true,
    });
  });

  test("AMIG-03: a move with a not-declared removal stays info", () => {
    // arrange
    const moved = {
      kind: "moved",
      scope: "user",
      plugin: "hello",
      marketplace: "mp",
      from: "srv",
      to: "plugin_hello_srv_",
    } as const;
    const removed = {
      kind: "removed",
      scope: "user",
      plugin: "hello",
      marketplace: "mp",
      server: "gone",
      cause: "not-declared",
    } as const;

    // act
    const resolved = resolveRawSurface({
      kind: "mcp-migration",
      rows: [moved, removed],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [moved, removed],
      notices: [],
      severity: "info",
      needsReload: true,
    });
  });

  for (const row of [
    {
      kind: "removed",
      scope: "project",
      plugin: "hello",
      marketplace: "mp",
      server: "live",
      cause: "unsupported-feature",
      feature: "sdk",
    },
    {
      kind: "removed",
      scope: "project",
      plugin: "hello",
      marketplace: "mp",
      server: "live",
      cause: "malformed",
    },
  ] as const) {
    test(`AMIG-03: a removal for ${row.cause} alone is a warning that needs a reload`, () => {
      // act
      const resolved = resolveRawSurface({ kind: "mcp-migration", rows: [row], notices: [] });

      // assert
      assert.deepStrictEqual(resolved, {
        kind: "mcp-migration",
        rows: [row],
        notices: [],
        severity: "warning",
        needsReload: true,
      });
    });
  }

  test("PMOD-04 redacts a credential in each name and detail a migration row or notice carries", () => {
    // arrange
    const rows: readonly McpMigrationRow[] = [
      {
        kind: "moved",
        scope: "project",
        plugin: "https://u:tok@h/p",
        marketplace: "https://u:tok@h/m",
        from: "https://u:tok@h/from",
        to: "https://u:tok@h/to",
      },
      {
        kind: "removed",
        scope: "project",
        plugin: "https://u:tok@h/p",
        marketplace: "https://u:tok@h/m",
        server: "https://u:tok@h/s",
        cause: "unsupported-feature",
        feature: "https://u:tok@h/f",
      },
      { kind: "stopped", scope: "project", detail: "clone https://u:tok@h/r failed" },
      { kind: "file-unreadable", scope: "user", file: "mcp.json" },
      {
        kind: "unowned",
        scope: "user",
        plugin: "https://u:tok@h/a",
        marketplace: "https://u:tok@h/m",
        servers: ["https://u:tok@h/s"],
      },
      {
        kind: "collision",
        scope: "user",
        plugin: "https://u:tok@h/b",
        marketplace: "m",
        servers: ["s"],
        key: "https://u:tok@h/k",
        source: "https://u:tok@h/src",
      },
      {
        kind: "unfinished",
        scope: "user",
        plugin: "https://u:tok@h/c",
        marketplace: "m",
        servers: ["s"],
        file: "mcp.json",
        detail: "write https://u:tok@h/d failed",
      },
    ];
    const notices: readonly McpConfigNotice[] = [
      {
        kind: "variables-missing",
        scope: "user",
        file: "mcp-adapter.json",
        plugin: "https://u:tok@h/p",
        server: "https://u:tok@h/s",
        names: ["https://u:tok@h/n"],
      },
    ];

    // act
    const resolved = resolveRawSurface({ kind: "mcp-migration", rows, notices });

    // assert
    assert.deepStrictEqual(resolved, {
      kind: "mcp-migration",
      rows: [
        {
          kind: "moved",
          scope: "project",
          plugin: "https://***@h/p",
          marketplace: "https://***@h/m",
          from: "https://***@h/from",
          to: "https://***@h/to",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "https://***@h/p",
          marketplace: "https://***@h/m",
          server: "https://***@h/s",
          cause: "unsupported-feature",
          feature: "https://***@h/f",
        },
        { kind: "stopped", scope: "project", detail: "clone https://***@h/r failed" },
        { kind: "file-unreadable", scope: "user", file: "mcp.json" },
        {
          kind: "unowned",
          scope: "user",
          plugin: "https://***@h/a",
          marketplace: "https://***@h/m",
          servers: ["https://***@h/s"],
        },
        {
          kind: "collision",
          scope: "user",
          plugin: "https://***@h/b",
          marketplace: "m",
          servers: ["s"],
          key: "https://***@h/k",
          source: "https://***@h/src",
        },
        {
          kind: "unfinished",
          scope: "user",
          plugin: "https://***@h/c",
          marketplace: "m",
          servers: ["s"],
          file: "mcp.json",
          detail: "write https://***@h/d failed",
        },
      ],
      notices: [
        {
          kind: "variables-missing",
          scope: "user",
          file: "mcp-adapter.json",
          plugin: "https://***@h/p",
          server: "https://***@h/s",
          names: ["https://***@h/n"],
        },
      ],
      severity: "warning",
      needsReload: true,
    });
  });
});

describe("mcpConfigNoticeSurfaces", () => {
  test("AFILE-04: mixed MCP config notices group comments-dropped first, then left-unchanged", () => {
    // arrange
    const leftUnchanged = {
      kind: "left-unchanged",
      scope: "user",
      file: "mcp-adapter.json",
    } as const;
    const commentsDropped = {
      kind: "comments-dropped",
      scope: "project",
      file: "mcp.json",
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([leftUnchanged, commentsDropped]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "comments-dropped", notices: [commentsDropped] },
      { kind: "mcp-config-notices", section: "left-unchanged", notices: [leftUnchanged] },
    ]);
  });

  test("AFILE-06: override-kept notices for two servers share one section, in list order", () => {
    // arrange
    const alpha = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "alpha",
      fields: ["env"],
    } as const;
    const beta = {
      kind: "override-kept",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "beta",
      fields: ["cwd"],
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([alpha, beta]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "override-kept", notices: [alpha, beta] },
    ]);
  });

  test("AFILE-06: a later override-kept notice for a server replaces the earlier one in its first position", () => {
    // arrange
    const helloSrv = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env"],
    } as const;
    const helloOther = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "other",
      fields: ["cwd"],
    } as const;
    const betaSrv = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "beta",
      server: "srv",
      fields: ["headers"],
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([helloSrv, helloOther, betaSrv]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "override-kept", notices: [betaSrv, helloOther] },
    ]);
  });

  test("AFILE-06: mixed MCP config notices group comments-dropped, then left-unchanged, then override-kept", () => {
    // arrange
    const overrideKept = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    } as const;
    const leftUnchanged = {
      kind: "left-unchanged",
      scope: "project",
      file: "mcp-adapter.json",
    } as const;
    const commentsDropped = {
      kind: "comments-dropped",
      scope: "user",
      file: "mcp-adapter.json",
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([overrideKept, leftUnchanged, commentsDropped]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "comments-dropped", notices: [commentsDropped] },
      { kind: "mcp-config-notices", section: "left-unchanged", notices: [leftUnchanged] },
      { kind: "mcp-config-notices", section: "override-kept", notices: [overrideKept] },
    ]);
  });

  test("AFILE-06: an override-restored notice alone yields no section", () => {
    // act
    const surfaces = mcpConfigNoticeSurfaces([
      { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
    ]);

    // assert
    assert.deepStrictEqual(surfaces, []);
  });

  test("AFILE-06: an override-restored notice cancels an earlier override-kept notice for the same server", () => {
    // act
    const surfaces = mcpConfigNoticeSurfaces([
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "srv",
        fields: ["env", "headers"],
      },
      { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
    ]);

    // assert
    assert.deepStrictEqual(surfaces, []);
  });

  test("AFILE-06: an override-kept notice after an override-restored notice for the same server stands", () => {
    // arrange
    const overrideKept = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([
      { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
      overrideKept,
    ]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "override-kept", notices: [overrideKept] },
    ]);
  });

  test("AFILE-06: a restore for another server, scope or file leaves the override-kept notice standing", () => {
    // arrange
    const overrideKept = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([
      overrideKept,
      { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "other" },
      { kind: "override-restored", scope: "user", file: "mcp-adapter.json", server: "srv" },
      { kind: "override-restored", scope: "project", file: "mcp.json", server: "srv" },
    ]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "override-kept", notices: [overrideKept] },
    ]);
  });

  test("AFILE-06: comments-dropped notices still form a section beside a cancelled override", () => {
    // arrange
    const commentsDropped = {
      kind: "comments-dropped",
      scope: "user",
      file: "mcp-adapter.json",
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([
      commentsDropped,
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "srv",
        fields: ["env", "headers"],
      },
      { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
    ]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "comments-dropped", notices: [commentsDropped] },
    ]);
  });

  test("AVAR-04: a variables-missing notice listed first still groups after the override-kept section", () => {
    // arrange
    const variablesMissing = {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    } as const;
    const overrideKept = {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["env"],
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([variablesMissing, overrideKept]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "override-kept", notices: [overrideKept] },
      { kind: "mcp-config-notices", section: "variables-missing", notices: [variablesMissing] },
    ]);
  });

  test("AVAR-05: a credentials-blanked notice listed first still groups after the variables-missing section", () => {
    // arrange
    const credentials = {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["ANTHROPIC_API_KEY"],
    } as const;
    const variablesMissing = {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([credentials, variablesMissing]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "variables-missing", notices: [variablesMissing] },
      { kind: "mcp-config-notices", section: "credentials-blanked", notices: [credentials] },
    ]);
  });

  test("ANAME-07: tool-rules-unenforced notices group after the credentials-withheld section, with a notice each", () => {
    // arrange
    const helloRules = {
      kind: "tool-rules-unenforced",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_alpha_",
      fields: ["tools[].permission_policy", "toolPermissions"],
    } as const;
    const credentials = {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_alpha_",
      names: ["ANTHROPIC_API_KEY"],
    } as const;
    const acmeRules = {
      kind: "tool-rules-unenforced",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "plugin_acme_beta_",
      fields: ["tools[].permission_policy"],
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([helloRules, credentials, acmeRules]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "credentials-blanked", notices: [credentials] },
      {
        kind: "mcp-config-notices",
        section: "tool-rules-unenforced",
        notices: [helloRules, acmeRules],
      },
    ]);
  });

  test("AMIG-01: leftover-removed notices group after the tool-rules section, with a notice each", () => {
    // arrange
    const acmeLeftover = {
      kind: "leftover-removed",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "github",
    } as const;
    const toolRules = {
      kind: "tool-rules-unenforced",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["toolPermissions"],
    } as const;
    const helloLeftover = {
      kind: "leftover-removed",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
    } as const;

    // act
    const surfaces = mcpConfigNoticeSurfaces([acmeLeftover, toolRules, helloLeftover]);

    // assert
    assert.deepStrictEqual(surfaces, [
      { kind: "mcp-config-notices", section: "tool-rules-unenforced", notices: [toolRules] },
      {
        kind: "mcp-config-notices",
        section: "leftover-removed",
        notices: [acmeLeftover, helloLeftover],
      },
    ]);
  });
});

test("an inherited prototype-name policy cannot authorize a malformed row", () => {
  // arrange
  const row = { status: "toString", name: "orphan", severity: "warning" };

  // act
  const resolved = resolveRows(marketplaceWith([row as never]), allLoaded(), {});
  const text = composeReconcileAppliedBody([resolved[0]!]);

  // assert
  assert.deepStrictEqual(row, { status: "toString", name: "orphan", severity: "error" });
  assert.deepStrictEqual(resolved, [
    {
      name: "official",
      scope: "user",
      plugins: [
        {
          status: "toString",
          name: "orphan",
          severity: "error",
          reasons: [],
          missingPolicy: true,
        },
      ],
    },
  ]);
  assert.equal(
    text,
    '● official [user]\n  orphan (failed) {internal: no render arm for "toString"}',
  );
});

test("equal neighboring rows and same-name scopes retain order and duplicate reasons", () => {
  // arrange
  const row = {
    status: "partially-installed",
    name: "same",
    scope: "project",
    reasons: ["lsp", "lsp"],
    dependencies: ["workflows", "mcp", "agents"],
  } as const;
  const marketplaces = [
    { name: "z-last", scope: "user", plugins: [row, row, { ...row, scope: "user" }] },
    { name: "a-first", scope: "project", plugins: [] },
  ] as const;

  // act
  const resolved = resolveRows(marketplaces, noneLoaded(), CENTRAL_ROW_POLICY);
  const text = resolved.map((mp) => composeReconcileAppliedBody([mp]));

  // assert
  const reasons = [
    "lsp",
    "lsp",
    "requires pi-subagents",
    "requires pi-mcp-adapter",
    "requires pi-dynamic-workflows",
  ];
  assert.deepStrictEqual(resolved, [
    {
      name: "z-last",
      scope: "user",
      plugins: [
        { status: "partially-installed", name: "same", scope: "project", reasons },
        { status: "partially-installed", name: "same", scope: "project", reasons },
        { status: "partially-installed", name: "same", scope: "user", reasons },
      ],
    },
    { name: "a-first", scope: "project", plugins: [] },
  ]);
  assert.deepStrictEqual(text, [
    "● z-last [user]\n  ◉ same [project] (partially-installed) {lsp, lsp, requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}\n  ◉ same [project] (partially-installed) {lsp, lsp, requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}\n  ◉ same (partially-installed) {lsp, lsp, requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}",
    "● a-first [project]",
  ]);
});

test("pending policies produce identical complete rows under opposite snapshots", () => {
  // arrange
  const rows = [
    {
      name: "official",
      scope: "user",
      plugins: [
        { status: "will install", name: "alpha", scope: "project", partial: true },
        { status: "will uninstall", name: "beta" },
        { status: "will enable", name: "gamma" },
        { status: "will disable", name: "delta" },
        { status: "will update", name: "epsilon", from: "1.0.0", to: "1.1.0" },
      ],
    },
  ] as const;

  // act
  const loaded = resolveRows(rows, allLoaded(), PENDING_CONTEXT.rowPolicies);
  const absent = resolveRows(rows, noneLoaded(), PENDING_CONTEXT.rowPolicies);

  // assert
  const expected = [
    {
      name: "official",
      scope: "user",
      plugins: [
        { status: "will install", name: "alpha", scope: "project", partial: true, reasons: [] },
        { status: "will uninstall", name: "beta", reasons: [] },
        { status: "will enable", name: "gamma", reasons: [] },
        { status: "will disable", name: "delta", reasons: [] },
        { status: "will update", name: "epsilon", from: "1.0.0", to: "1.1.0", reasons: [] },
      ],
    },
  ];
  assert.deepStrictEqual(loaded, expected);
  assert.deepStrictEqual(absent, expected);
  const expectedText =
    "● official [user]\n  ● alpha [project] (will partially install)\n  ○ beta (will uninstall)\n  ● gamma (will enable)\n  ◍ delta (will disable)\n  ● epsilon v1.0.0 → v1.1.0 (will update)";
  assert.equal(composeReconcileAppliedBody([loaded[0]!]), expectedText);
  assert.equal(composeReconcileAppliedBody([absent[0]!]), expectedText);
});
