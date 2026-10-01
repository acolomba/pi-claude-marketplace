import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  CENTRAL_ROW_POLICY,
  resolveEnvelope,
  resolveNotAddedReason,
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
  NotificationMessage,
  PluginFailedMessage,
  PluginNotificationMessage,
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
      expectedEnvelope: { severity: "info", needsReload: false, noOp: false },
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
      expectedEnvelope: { severity: "info", needsReload: false, noOp: false },
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
      expectedEnvelope: { severity: "info", needsReload: false, noOp: false },
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
      expectedEnvelope: { severity: "info", needsReload: false, noOp: false },
    },
    {
      name: "an empty plural cascade resolves no tally",
      message: { kind: "cascade", cardinality: "plural", label: "Plugin list", marketplaces: [] },
      expectedEnvelope: { severity: "info", needsReload: false, noOp: false },
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
      expectedEnvelope: { severity: "info", needsReload: true, noOp: false },
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
      expectedEnvelope: { severity: "info", needsReload: true, noOp: false },
    },
    {
      name: "an applied reconcile resolves its tally without needsReload",
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
        needsReload: false,
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
    assert.deepStrictEqual(envelope, { severity: "info", needsReload: false, noOp: true });
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

  test("leaves the input row unchanged when every status has a render arm", () => {
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

  test("floors the input row to error when its status has no render arm", () => {
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
      expectedReasons: ["orphan rewake", "requires pi-mcp"],
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
          "requires pi-mcp",
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
        reasons: ["lsp", "lsp", "requires pi-mcp"],
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
