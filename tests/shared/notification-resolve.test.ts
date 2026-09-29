import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  resolveEnvelope,
  resolveRows,
  resolveUpdateNoOpEnvelope,
} from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

import type {
  ResolvedEnvelope,
  ResolvedMarketplace,
  ResolvedRow,
} from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  CascadeNotificationMessage,
  MarketplaceNotificationMessage,
  NotificationMessage,
  PluginFailedMessage,
  PluginNotificationMessage,
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
    const resolved = resolveRows(marketplaces);

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
    const resolved = resolveRows(marketplaces);

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
    const resolved = resolveRows(marketplaces);

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
    const resolved = resolveRows(marketplaces);

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

  test("copies a non-failure row without a failure key", () => {
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
    const resolved = resolveRows(marketplaces);

    // assert
    assert.deepStrictEqual(resolved[0]!.plugins, [
      { status: "installed", severity: "info", needsReload: true, name: "alpha", dependencies: [] },
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
    resolveRows(marketplaceWith([row]), () => true);

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
    const resolved = resolveRows(marketplaceWith([row]), () => false);

    // assert
    assert.deepStrictEqual(row, {
      status: "disabled",
      severity: "error",
      needsReload: false,
      name: "orphan",
    });
    assert.deepStrictEqual(resolved[0]!.plugins, [
      { status: "disabled", severity: "error", needsReload: false, name: "orphan" },
    ]);
  });

  test("keeps a frozen row's severity and adds no name to its resolved copy", () => {
    // arrange
    const row = Object.freeze({ status: "unknown", severity: "info" });

    // act
    const resolved = resolveRows(marketplaceWith([row as never]), () => false);

    // assert
    assert.deepStrictEqual(row, { status: "unknown", severity: "info" });
    assert.deepStrictEqual(resolved[0]!.plugins, [{ status: "unknown", severity: "info" }]);
  });
});
