import assert from "node:assert/strict";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { type PluginAvailableMessage } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import {
  type PluginDisabledMessage,
  type PluginInstalledMessage,
  type PluginNotificationMessage,
  type Severity,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import {
  notifyReconcileAppliedWithContext,
  notifyUpdateNoOpWithContext,
  notifyUpdateWithContext,
  notifyWithContext,
  type CommandContext,
  type MarketplaceRows,
  type Plural,
  type Single,
} from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";

import { runWithNothingLoaded } from "./notification-run-seeds.ts";

import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

type ControlledMessage = PluginAvailableMessage | PluginDisabledMessage;
type ControlledStatus = ControlledMessage["status"];

void ({ Messaging: { label: "Empty" }, rowPolicies: {} } satisfies CommandContext<never>);
void ({
  Messaging: { label: "Incomplete" },
  // @ts-expect-error every declared status requires a policy
  rowPolicies: {},
} satisfies CommandContext<"available">);
void ({
  Messaging: { label: "Callable" },
  rowPolicies: {
    // @ts-expect-error policies carry data, never rendering callbacks
    available: () => "row",
  },
} satisfies CommandContext<"available">);

function producerStatusesMustMatch(
  ctx: ExtensionContext,
  run: NotificationRun,
  context: CommandContext<"available">,
  rows: readonly MarketplaceRows<PluginDisabledMessage>[],
): void {
  // @ts-expect-error the producer emits a status the context does not declare
  notifyWithContext(ctx, run, context, rows, undefined, "single");
  // @ts-expect-error the update producer must match the context's status set
  notifyUpdateWithContext(ctx, run, context, rows, "plural", { verb: "updated", count: 1 });
  // @ts-expect-error the no-op producer must match the context's status set
  notifyUpdateNoOpWithContext(ctx, run, context, rows, "plural");
  notifyReconcileAppliedWithContext(ctx, run, context, {
    kind: "reconcile-applied-cascade",
    // @ts-expect-error the reconcile producer must match the context's status set
    marketplaces: rows,
  });
}

void producerStatusesMustMatch;
void ([{ status: "available", name: "alpha" }] as const satisfies Single<PluginAvailableMessage>);
void ([
  { status: "available", name: "alpha" },
  { status: "available", name: "beta" },
] as const satisfies Plural<PluginAvailableMessage>);
void ({
  name: "official",
  scope: "user",
  plugins: [{ status: "available", name: "alpha" }],
} satisfies MarketplaceRows<PluginAvailableMessage>);
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
  readonly run: NotificationRun;
  readonly ui: ExtensionContext["ui"];
}

function omissionMustRemainATypeError(
  ctx: ExtensionContext,
  run: NotificationRun,
  context: CommandContext<ControlledStatus>,
  rows: readonly MarketplaceRows<ControlledMessage>[],
): void {
  // @ts-expect-error -- cardinality is mandatory even when kind is explicitly undefined.
  notifyWithContext(ctx, run, context, rows, undefined);
}

void omissionMustRemainATypeError;

function createHarness(notification: NotificationRecord): Harness {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(1);
  when(() => ctx.ui).thenReturn(ui);
  if (notification.severity === undefined) {
    when(() => {
      ui.notify(notification.message);
    }).thenReturn(undefined);
  } else {
    when(() => {
      ui.notify(notification.message, notification.severity);
    }).thenReturn(undefined);
  }

  return { ctx, run: runWithNothingLoaded(), ui };
}

function createControlledContext(label: string): CommandContext<ControlledStatus> {
  return {
    Messaging: { label },
    rowPolicies: {
      available: { markers: false, contentReasons: true },
      disabled: { markers: false, contentReasons: true },
    },
  };
}

function availableRow(name: string): PluginAvailableMessage {
  return { status: "available", name, severity: "info", needsReload: false };
}

function disabledRow(name: string): PluginDisabledMessage {
  return { status: "disabled", name, severity: "info", needsReload: false };
}

test("an empty plural cascade emits only its sentinel", () => {
  // arrange
  const harness = createHarness({
    message: "(no marketplaces)",
  });
  const controlled = createControlledContext("Plugin inspect");

  // act
  notifyWithContext(harness.ctx, harness.run, controlled, [], undefined, "plural", {
    retainedWorkflows: [],
  });

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("WR-06: folds caller-supplied advisory lines before the tally", () => {
  // arrange
  // One row, so a tally actually renders: an empty result suppresses the
  // success line entirely (#209), which would leave nothing to fold before.
  const harness = createHarness({
    message:
      "● official [user]\n  ○ alpha (available)\n\nfirst advisory\nsecond advisory\n\nPlugin inspect: 1 success",
  });
  const controlled = createControlledContext("Plugin inspect");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    { name: "official", scope: "user", plugins: [availableRow("alpha")] },
  ];

  // act
  notifyWithContext(harness.ctx, harness.run, controlled, rows, undefined, "plural", {
    advisories: ["first advisory", "second advisory"],
  });

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("APL-04 / D-14: a caller-supplied needsApply ends the cascade with the apply trailer", () => {
  // arrange
  const harness = createHarness({
    message:
      "● official [user]\n  ○ alpha (available)\n\nPlugin inspect: 1 success\n\n/claude:plugin apply to make these changes",
  });
  const controlled = createControlledContext("Plugin inspect");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    { name: "official", scope: "user", plugins: [availableRow("alpha")] },
  ];

  // act
  notifyWithContext(harness.ctx, harness.run, controlled, rows, undefined, "plural", {
    needsApply: true,
  });

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("a one-row plural cascade retains its one-success tally", () => {
  // arrange
  const harness = createHarness({
    message: "● official [user]\n  ○ alpha (available)\n\nPlugin inspect: 1 success",
  });
  const controlled = createControlledContext("Plugin inspect");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    { name: "official", scope: "user", plugins: [availableRow("alpha")] },
  ];

  // act
  notifyWithContext(harness.ctx, harness.run, controlled, rows, undefined, "plural");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("a single cascade dispatches its row without a plural tally", () => {
  // arrange
  const harness = createHarness({
    message: "● official [user]\n  ○ alpha (available)",
  });
  const controlled = createControlledContext("Plugin inspect");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    { name: "official", scope: "user", plugins: [availableRow("alpha")] },
  ];

  // act
  notifyWithContext(harness.ctx, harness.run, controlled, rows, "cascade", "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("plural marketplaces dispatch equal-status rows separately in input order", () => {
  // arrange
  const harness = createHarness({
    message: [
      "● official [user]",
      "  ○ alpha (available)",
      "  ○ beta (available)",
      "",
      "● community [project]",
      "  ◍ gamma (disabled)",
      "",
      "Plugin inspect: 3 successes",
    ].join("\n"),
  });
  const controlled = createControlledContext("Plugin inspect");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    {
      name: "official",
      scope: "user",
      plugins: [availableRow("alpha"), availableRow("beta")],
    },
    { name: "community", scope: "project", plugins: [disabledRow("gamma")] },
  ];

  // act
  notifyWithContext(harness.ctx, harness.run, controlled, rows, undefined, "plural");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

for (const { count, expectedMessage } of [
  {
    count: 0,
    expectedMessage: "● official [project]\n  ○ alpha (available)",
  },
  {
    count: 1,
    expectedMessage: "● official [project]\n  ○ alpha (available)\n\nPlugin update: 1 updated",
  },
  {
    count: 37,
    expectedMessage: "● official [project]\n  ○ alpha (available)\n\nPlugin update: 37 updated",
  },
] as const) {
  test(`the update wrapper preserves the exact integer tally ${count.toString()}`, () => {
    // arrange
    const harness = createHarness({ message: expectedMessage });
    const controlled = createControlledContext("Plugin update");
    const rows: readonly MarketplaceRows<ControlledMessage>[] = [
      { name: "official", scope: "project", plugins: [availableRow("alpha")] },
    ];

    // act
    notifyUpdateWithContext(harness.ctx, harness.run, controlled, rows, "plural", {
      verb: "updated",
      count,
    });

    // assert
    verify(harness.ctx);
    verify(harness.ui);
  });
}

// eslint-disable-next-line sonarjs/assertions-in-tests -- Strong-mock verifies the exact notification and arity.
test("the no-op update wrapper emits its fixed headline for no rows", () => {
  // arrange
  const harness = createHarness({ message: "Plugin update: nothing to update" });
  const controlled = createControlledContext("Plugin update");

  // act
  notifyUpdateNoOpWithContext(harness.ctx, harness.run, controlled, [], "plural");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

// eslint-disable-next-line sonarjs/assertions-in-tests -- Strong-mock verifies the exact notification and arity.
test("the no-op update wrapper dispatches surviving rows before its headline", () => {
  // arrange
  const harness = createHarness({
    message: "● official [user]\n  ◍ alpha (disabled)\n\nPlugin update: nothing to update",
  });
  const controlled = createControlledContext("Plugin update");
  const rows: readonly MarketplaceRows<ControlledMessage>[] = [
    { name: "official", scope: "user", plugins: [disabledRow("alpha")] },
  ];

  // act
  notifyUpdateNoOpWithContext(harness.ctx, harness.run, controlled, rows, "plural");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

/** An `installed`-only context whose one marker policy value is `installed`. */
function installedMarkerContext(installed: boolean): CommandContext<"installed"> {
  return {
    Messaging: { label: "Plugin inspect" },
    rowPolicies: { installed: { markers: installed, contentReasons: true } },
  };
}

/** One `installed` row that declares agents, so pi-subagents is its marker. */
function installedAgentsRows(): readonly MarketplaceRows<PluginInstalledMessage>[] {
  return [
    {
      name: "official",
      scope: "user",
      plugins: [
        {
          status: "installed",
          name: "alpha",
          dependencies: ["agents"],
          severity: "info",
          needsReload: false,
        },
      ],
    },
  ];
}

// D-12: each wrapper runs once with its context's policy on and once with it
// off. The off case is red for a wrapper that hands the emitter
// `CENTRAL_ROW_POLICY` or an all-true policy in place of `context.rowPolicies`,
// because both map `installed` to true.
for (const { entry, emit, markedMessage, unmarkedMessage } of [
  {
    entry: "notifyWithContext",
    emit: (harness, context, rows) => {
      notifyWithContext(harness.ctx, harness.run, context, rows, undefined, "single");
    },
    markedMessage: "● official [user]\n  ● alpha (installed) {requires pi-subagents}",
    unmarkedMessage: "● official [user]\n  ● alpha (installed)",
  },
  {
    entry: "notifyUpdateWithContext",
    emit: (harness, context, rows) => {
      notifyUpdateWithContext(harness.ctx, harness.run, context, rows, "single", {
        verb: "updated",
        count: 1,
      });
    },
    markedMessage: "● official [user]\n  ● alpha (installed) {requires pi-subagents}",
    unmarkedMessage: "● official [user]\n  ● alpha (installed)",
  },
  {
    entry: "notifyUpdateNoOpWithContext",
    emit: (harness, context, rows) => {
      notifyUpdateNoOpWithContext(harness.ctx, harness.run, context, rows, "single");
    },
    markedMessage:
      "● official [user]\n  ● alpha (installed) {requires pi-subagents}\n\nPlugin update: nothing to update",
    unmarkedMessage: "● official [user]\n  ● alpha (installed)\n\nPlugin update: nothing to update",
  },
  {
    entry: "notifyReconcileAppliedWithContext",
    emit: (harness, context, rows) => {
      notifyReconcileAppliedWithContext(harness.ctx, harness.run, context, {
        kind: "reconcile-applied-cascade",
        marketplaces: rows,
      });
    },
    markedMessage:
      "● official [user]\n  ● alpha (installed) {requires pi-subagents}\n\nPlugin inspect: 1 success",
    unmarkedMessage: "● official [user]\n  ● alpha (installed)\n\nPlugin inspect: 1 success",
  },
] satisfies readonly {
  entry: string;
  emit: (
    harness: Harness,
    context: CommandContext<"installed">,
    rows: readonly MarketplaceRows<PluginInstalledMessage>[],
  ) => void;
  markedMessage: string;
  unmarkedMessage: string;
}[]) {
  test(`D-12: ${entry} composes row markers under the context's marker policy`, () => {
    // arrange
    const harness = createHarness({ message: markedMessage });
    const context = installedMarkerContext(true);

    // act
    emit(harness, context, installedAgentsRows());

    // assert
    verify(harness.ctx);
    verify(harness.ui);
  });

  test(`D-12: ${entry} suppresses markers its context's policy maps off`, () => {
    // arrange
    const harness = createHarness({ message: unmarkedMessage });
    const context = installedMarkerContext(false);

    // act
    emit(harness, context, installedAgentsRows());

    // assert
    verify(harness.ctx);
    verify(harness.ui);
  });
}

test("a missing row policy reports its named row before the adjacent present row", () => {
  // arrange
  const harness = createHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [user]",
      '  orphan (failed) {internal: no render arm for "disabled"}',
      "  ○ neighbor (available)",
    ].join("\n"),
    severity: "error",
  });

  const context = {
    Messaging: { label: "Broken command" },
    rowPolicies: { available: { markers: false, contentReasons: true } },
  } as CommandContext<string>;
  const missing = disabledRow("orphan");
  const rows: readonly MarketplaceRows<PluginNotificationMessage>[] = [
    {
      name: "official",
      scope: "user",
      plugins: [missing, availableRow("neighbor")],
    },
  ];

  // act
  notifyWithContext(harness.ctx, harness.run, context, rows, undefined, "single");

  // assert
  assert.deepStrictEqual(missing, {
    status: "disabled",
    name: "orphan",
    severity: "error",
    needsReload: false,
  });

  verify(harness.ctx);
  verify(harness.ui);
});

test("a frozen unnamed missing-arm row still precedes the adjacent present arm", () => {
  // arrange
  const harness = createHarness({
    message: [
      "● official [user]",
      '  ? (failed) {internal: no render arm for "unknown"}',
      "  ○ neighbor (available)",
    ].join("\n"),
  });

  const context = {
    Messaging: { label: "Broken command" },
    rowPolicies: { available: { markers: false, contentReasons: true } },
  } as CommandContext<string>;
  const missing = Object.freeze({ status: "unknown" }) as never;
  const rows: readonly MarketplaceRows<PluginNotificationMessage>[] = [
    {
      name: "official",
      scope: "user",
      plugins: [missing, availableRow("neighbor")],
    },
  ];

  // act
  notifyWithContext(harness.ctx, harness.run, context, rows, undefined, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("the reconcile wrapper dispatches rows with its label and plural cardinality", () => {
  // arrange
  const harness = createHarness({
    message: "● official [user]\n  ○ alpha (available)\n\nPlugin reconcile: 1 success",
  });
  const controlled = createControlledContext("Plugin reconcile");
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [{ name: "official", scope: "user", plugins: [availableRow("alpha")] }],
  } as const;

  // act
  notifyReconcileAppliedWithContext(harness.ctx, harness.run, controlled, message);

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

function nullRowsAreRefused(
  ctx: ExtensionContext,
  run: NotificationRun,
  context: CommandContext<"available">,
): void {
  notifyWithContext(
    ctx,
    run,
    context,
    // @ts-expect-error a null marketplace collection is not an empty collection
    null,
    undefined,
    "plural",
  );
  const nullPlugin = {
    name: "official",
    scope: "user",
    // @ts-expect-error a null plugin row is not a producer row
    plugins: [null],
  } satisfies MarketplaceRows<PluginAvailableMessage>;
  void nullPlugin;
  const nullPlugins = {
    name: "official",
    scope: "user",
    // @ts-expect-error a null plugin collection is not an empty collection
    plugins: null,
  } satisfies MarketplaceRows<PluginAvailableMessage>;
  void nullPlugins;
  // @ts-expect-error no-op updates still require a marketplace collection
  notifyUpdateNoOpWithContext(ctx, run, context, null, "plural");
  notifyReconcileAppliedWithContext(ctx, run, context, {
    kind: "reconcile-applied-cascade",
    // @ts-expect-error applied reconcile still requires a marketplace collection
    marketplaces: null,
  });
}

void nullRowsAreRefused;
