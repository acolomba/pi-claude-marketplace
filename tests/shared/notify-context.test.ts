import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  notifyReconcileAppliedWithContext,
  notifyUpdateNoOpWithContext,
  notifyUpdateWithContext,
  notifyWithContext,
  type CommandContext,
  type MarketplaceRows,
  type Plural,
  type RenderFn,
  type Single,
  type WithPlugins,
} from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
  SoftDepStatus,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  PluginAvailableMessage,
  PluginDisabledMessage,
  PluginNotificationMessage,
  Severity,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

type ControlledMessage = PluginAvailableMessage | PluginDisabledMessage;
type ControlledStatus = ControlledMessage["status"];
interface SimpleMarketplace {
  readonly name: string;
  readonly scope: Scope;
  readonly plugins: readonly PluginNotificationMessage[];
}

void (((row: PluginAvailableMessage, probe: SoftDepStatus, scope: Scope) =>
  `${row.name}:${probe.piSubagentsLoaded.toString()}:${scope}`) satisfies RenderFn<PluginAvailableMessage>);
void ({
  Messaging: { label: "Plugin inspect" },
  render: {
    available: (row) => row.name,
    disabled: (row) => row.name,
  },
} satisfies CommandContext<ControlledStatus, ControlledMessage>);
void ([{ status: "available", name: "alpha" }] as const satisfies Single<PluginAvailableMessage>);
void ([
  { status: "available", name: "alpha" },
  { status: "available", name: "beta" },
] as const satisfies Plural<PluginAvailableMessage>);
void ({
  name: "official",
  scope: "user",
  plugins: [{ status: "available", name: "alpha" }],
} satisfies WithPlugins<SimpleMarketplace, PluginAvailableMessage>);
void ({
  name: "official",
  scope: "user",
  plugins: [{ status: "available", name: "alpha" }],
} satisfies MarketplaceRows<PluginAvailableMessage>);

void (
  // @ts-expect-error render functions return strings
  ((row: PluginAvailableMessage) => row.name.length) satisfies RenderFn<PluginAvailableMessage>
);
void ({
  Messaging: { label: "Plugin inspect" },
  // @ts-expect-error every declared status requires a render arm
  render: {},
} satisfies CommandContext<"available", PluginAvailableMessage>);
void (
  // @ts-expect-error Single requires exactly one row
  [] satisfies Single<PluginAvailableMessage>
);
void ({
  name: "official",
  scope: "user",
  plugins: [
    // @ts-expect-error marketplace rows accept only the context message union
    { status: "disabled", name: "alpha", severity: "info", needsReload: false },
  ],
} satisfies MarketplaceRows<PluginAvailableMessage>);

interface NotificationRecord {
  readonly message: string;
  readonly severity?: Severity;
}

interface Harness {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly ui: ExtensionContext["ui"];
}

interface RenderCall {
  readonly status: ControlledStatus;
  readonly name: string;
  readonly probe: SoftDepStatus;
  readonly scope: Scope;
}

interface ControlledContext {
  readonly context: CommandContext<ControlledStatus, ControlledMessage>;
  readonly calls: RenderCall[];
}

function createHarness(notification: NotificationRecord): Harness {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => ctx.ui).thenReturn(ui);
  when(() => pi.getAllTools())
    .thenReturn([])
    .twice();
  if (notification.severity === undefined) {
    when(() => {
      ui.notify(notification.message);
    }).thenReturn(undefined);
  } else {
    when(() => {
      ui.notify(notification.message, notification.severity);
    }).thenReturn(undefined);
  }

  return { ctx, pi, ui };
}

function createControlledContext(t: TestContext, label: string): ControlledContext {
  const calls: RenderCall[] = [];
  const available = t.mock.fn<RenderFn<PluginAvailableMessage>>((row, probe, scope) => {
    calls.push({ status: row.status, name: row.name, probe: { ...probe }, scope });
    return `controlled available ${row.name} [${scope}]`;
  });
  const disabled = t.mock.fn<RenderFn<PluginDisabledMessage>>((row, probe, scope) => {
    calls.push({ status: row.status, name: row.name, probe: { ...probe }, scope });
    return `controlled disabled ${row.name} [${scope}]`;
  });
  const context = {
    Messaging: { label },
    render: { available, disabled },
  } satisfies CommandContext<ControlledStatus, ControlledMessage>;
  return { context, calls };
}

function availableRow(name: string): PluginAvailableMessage {
  return { status: "available", name, severity: "info", needsReload: false };
}

function disabledRow(name: string): PluginDisabledMessage {
  return { status: "disabled", name, severity: "info", needsReload: false };
}

test("an empty cascade notifies once without invoking a renderer", (t) => {
  // arrange
  const harness = createHarness({ message: "(no marketplaces)" });
  const controlled = createControlledContext(t, "Plugin inspect");

  // act
  notifyWithContext(harness.ctx, harness.pi, controlled.context, []);

  // assert
  assert.deepStrictEqual(controlled.calls, []);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("a single cascade dispatches its row without a plural tally", (t) => {
  // arrange
  const harness = createHarness({
    message: "● official [user]\n  controlled available alpha [user]",
  });
  const controlled = createControlledContext(t, "Plugin inspect");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    { name: "official", scope: "user", plugins: [availableRow("alpha")] },
  ];

  // act
  notifyWithContext(harness.ctx, harness.pi, controlled.context, rows, "cascade", "single");

  // assert
  assert.deepStrictEqual(controlled.calls, [
    {
      status: "available",
      name: "alpha",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "user",
    },
  ]);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("plural marketplaces dispatch equal-status rows separately in input order", (t) => {
  // arrange
  const harness = createHarness({
    message: [
      "● official [user]",
      "  controlled available alpha [user]",
      "  controlled available beta [user]",
      "",
      "● community [project]",
      "  controlled disabled gamma [project]",
      "",
      "Plugin inspect: 3 successes",
    ].join("\n"),
  });
  const controlled = createControlledContext(t, "Plugin inspect");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    {
      name: "official",
      scope: "user",
      plugins: [availableRow("alpha"), availableRow("beta")],
    },
    { name: "community", scope: "project", plugins: [disabledRow("gamma")] },
  ];

  // act
  notifyWithContext(harness.ctx, harness.pi, controlled.context, rows, undefined, "plural");

  // assert
  assert.deepStrictEqual(controlled.calls, [
    {
      status: "available",
      name: "alpha",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "user",
    },
    {
      status: "available",
      name: "beta",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "user",
    },
    {
      status: "disabled",
      name: "gamma",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "project",
    },
  ]);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

for (const { count, expectedMessage } of [
  {
    count: 0,
    expectedMessage: "● official [project]\n  controlled available alpha [project]",
  },
  {
    count: 1,
    expectedMessage:
      "● official [project]\n  controlled available alpha [project]\n\nPlugin update: 1 updated",
  },
  {
    count: 37,
    expectedMessage:
      "● official [project]\n  controlled available alpha [project]\n\nPlugin update: 37 updated",
  },
] as const) {
  test(`the update wrapper preserves the exact integer tally ${count.toString()}`, (t) => {
    // arrange
    const harness = createHarness({ message: expectedMessage });
    const controlled = createControlledContext(t, "Plugin update");
    const rows: readonly MarketplaceRows<ControlledMessage>[] = [
      { name: "official", scope: "project", plugins: [availableRow("alpha")] },
    ];

    // act
    notifyUpdateWithContext(harness.ctx, harness.pi, controlled.context, rows, "plural", {
      verb: "updated",
      count,
    });

    // assert
    assert.deepStrictEqual(controlled.calls, [
      {
        status: "available",
        name: "alpha",
        probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
        scope: "project",
      },
    ]);
    verify(harness.ctx);
    verify(harness.pi);
    verify(harness.ui);
  });
}

test("the no-op update wrapper emits its fixed headline for no rows", (t) => {
  // arrange
  const harness = createHarness({ message: "Plugin update: nothing to update" });
  const controlled = createControlledContext(t, "Plugin update");

  // act
  notifyUpdateNoOpWithContext(harness.ctx, harness.pi, controlled.context, []);

  // assert
  assert.deepStrictEqual(controlled.calls, []);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("the no-op update wrapper dispatches surviving rows before its headline", (t) => {
  // arrange
  const harness = createHarness({
    message:
      "● official [user]\n  controlled disabled alpha [user]\n\nPlugin update: nothing to update",
  });
  const controlled = createControlledContext(t, "Plugin update");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    { name: "official", scope: "user", plugins: [disabledRow("alpha")] },
  ];

  // act
  notifyUpdateNoOpWithContext(harness.ctx, harness.pi, controlled.context, rows);

  // assert
  assert.deepStrictEqual(controlled.calls, [
    {
      status: "disabled",
      name: "alpha",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "user",
    },
  ]);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("a missing render arm reports its named row before the adjacent present arm", (t) => {
  // arrange
  const harness = createHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [user]",
      '  orphan (failed) {internal: no render arm for "disabled"}',
      "  controlled available neighbor [user]",
    ].join("\n"),
    severity: "error",
  });
  const calls: RenderCall[] = [];
  const available = t.mock.fn<RenderFn<PluginAvailableMessage>>((row, probe, scope) => {
    calls.push({ status: row.status, name: row.name, probe: { ...probe }, scope });
    return `controlled available ${row.name} [${scope}]`;
  });
  const context = {
    Messaging: { label: "Broken command" },
    render: { available },
  } as CommandContext<string, PluginNotificationMessage>;
  const missing = disabledRow("orphan");
  const rows: readonly MarketplaceRows<PluginNotificationMessage>[] = [
    {
      name: "official",
      scope: "user",
      plugins: [missing, availableRow("neighbor")],
    },
  ];

  // act
  notifyWithContext(harness.ctx, harness.pi, context, rows);

  // assert
  assert.deepStrictEqual(missing, {
    status: "disabled",
    name: "orphan",
    severity: "error",
    needsReload: false,
  });
  assert.deepStrictEqual(calls, [
    {
      status: "available",
      name: "neighbor",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "user",
    },
  ]);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("a frozen unnamed missing-arm row still precedes the adjacent present arm", (t) => {
  // arrange
  const harness = createHarness({
    message: [
      "● official [user]",
      '  ? (failed) {internal: no render arm for "unknown"}',
      "  controlled available neighbor [user]",
    ].join("\n"),
  });
  const calls: RenderCall[] = [];
  const available = t.mock.fn<RenderFn<PluginAvailableMessage>>((row, probe, scope) => {
    calls.push({ status: row.status, name: row.name, probe: { ...probe }, scope });
    return `controlled available ${row.name} [${scope}]`;
  });
  const context = {
    Messaging: { label: "Broken command" },
    render: { available },
  } as CommandContext<string, PluginNotificationMessage>;
  const missing = Object.freeze({ status: "unknown" }) as never;
  const rows: readonly MarketplaceRows<PluginNotificationMessage>[] = [
    {
      name: "official",
      scope: "user",
      plugins: [missing, availableRow("neighbor")],
    },
  ];

  // act
  notifyWithContext(harness.ctx, harness.pi, context, rows);

  // assert
  assert.deepStrictEqual(calls, [
    {
      status: "available",
      name: "neighbor",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "user",
    },
  ]);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("the reconcile wrapper dispatches rows with its label and plural cardinality", (t) => {
  // arrange
  const harness = createHarness({
    message:
      "● official [user]\n  controlled available alpha [user]\n\nPlugin reconcile: 1 success",
  });
  const controlled = createControlledContext(t, "Plugin reconcile");
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [{ name: "official", scope: "user", plugins: [availableRow("alpha")] }],
  } as const;

  // act
  notifyReconcileAppliedWithContext(harness.ctx, harness.pi, controlled.context, message);

  // assert
  assert.deepStrictEqual(controlled.calls, [
    {
      status: "available",
      name: "alpha",
      probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
      scope: "user",
    },
  ]);
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});
