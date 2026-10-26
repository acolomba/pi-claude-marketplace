import assert from "node:assert/strict";
import { test, type TestContext, type Mock } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  ManualRecoveryError,
  UnsupportedModeError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
  notify,
  notifyCommandError,
  notifyAsyncRewakeSummary,
  notifyDeviceFlowPrompt,
  notifyDiagnostic,
  notifyMcpConfigNotices,
  notifyMcpMigration,
  notifyPluginPathSkipped,
  notifyReconcileAborted,
  notifyStopHookOverrideCap,
  notifyUsageError,
  notifyAutoapplyStatus,
  notifyUsageInfo,
} from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { CENTRAL_ROW_POLICY } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import {
  createCommandRunState,
  openNotificationRun,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { createJsonCapture } from "../edge/json-capture.ts";

import {
  runWithAllLoaded,
  runWithNothingLoaded,
  runWithSoftDeps,
} from "./notification-run-seeds.ts";

import type {
  NotificationContext as HostNotificationContext,
  PiInventory,
  ToolInventoryItem,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
  PluginInfoRow,
  UsageErrorMessage,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

interface NotificationContext {
  mode: string;
  readonly ui: {
    readonly notify: Mock<(message: string, severity?: "info" | "warning" | "error") => void>;
  };
}

function createContext(t: TestContext): NotificationContext {
  return {
    mode: "tui",
    ui: { notify: t.mock.fn((_message: string, _severity?: "info" | "warning" | "error") => {}) },
  };
}

function faultUsage(usage: string) {
  return {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "usage-info",
      severity: "info",
      needsReload: false,
      usage,
    },
  };
}

function faultError(message: string, needsReload = false) {
  return {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "internal-error",
      severity: "error",
      needsReload,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: [message], truncated: false },
    },
  };
}

function failingSink(failures: readonly number[]) {
  const attempts: Array<{ customType: string; payload: unknown }> = [];
  const sink = {
    appendEntry(customType: string, payload: unknown): void {
      assert.strictEqual(this, sink);
      attempts.push({ customType, payload });
      if (failures.includes(attempts.length)) {
        throw new Error(`Append ${attempts.length} failed.`);
      }
    },
  };
  return { sink, attempts };
}

test("marks recovery before a sink callback can reenter delivery", () => {
  // arrange
  const attempts: Array<{ customType: string; payload: unknown }> = [];
  const states: unknown[] = [];
  const ctx = {
    mode: "json",
    get ui(): never {
      throw new Error("Unexpected UI access");
    },
  };
  const run = {
    ...runWithNothingLoaded(),
    entrySink: {
      appendEntry(customType: string, payload: unknown): void {
        attempts.push({ customType, payload });
        states.push({ ...run.commandState });
        if (attempts.length === 1) {
          throw new Error("Append failed.");
        }

        notifyUsageInfo(ctx, run, "Reentrant.");
      },
    },
  };

  // act
  notifyUsageInfo(ctx, run, "First.");

  // assert
  assert.deepStrictEqual(attempts, [faultUsage("First."), faultError("Append failed.")]);
  assert.deepStrictEqual(states, [
    { hasOutcome: false, needsReload: false, settled: false, delivery: "open" },
    { hasOutcome: false, needsReload: false, settled: false, delivery: "recovering" },
  ]);
  assert.deepStrictEqual(run.commandState, {
    hasOutcome: true,
    needsReload: false,
    settled: false,
    delivery: "open",
  });
});

for (const { debug, loggerThrows } of [
  { debug: "0", loggerThrows: false },
  { debug: "1", loggerThrows: false },
  { debug: "1", loggerThrows: true },
]) {
  test(`contains terminal delivery with debug ${debug} and throwing logger ${loggerThrows}`, (t) => {
    // arrange
    const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      } else {
        process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
      }
    });
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = debug;
    t.mock.method(console, "error", () => {
      if (loggerThrows) {
        throw new Error("Logger failed.");
      }
    });
    const { sink, attempts } = failingSink([1, 2]);
    const run = { ...runWithNothingLoaded(), entrySink: sink };
    const ctx = {
      mode: "json",
      get ui(): never {
        throw new Error("Unexpected UI access");
      },
    };

    // act
    notifyUsageInfo(ctx, run, "First.");
    ctx.mode = "unusable";
    notifyUsageInfo(ctx, run, "Later.");

    // assert
    assert.deepStrictEqual(attempts, [faultUsage("First."), faultError("Append 1 failed.")]);
    assert.deepStrictEqual(run.commandState, {
      hasOutcome: false,
      needsReload: false,
      settled: false,
      delivery: "closed",
    });
  });
}

test("preserves direct dispatch for a command carrier without completion state", () => {
  // arrange
  const capture = createJsonCapture();
  const seed = runWithNothingLoaded();
  const run = { origin: seed.origin, softDeps: seed.softDeps, entrySink: capture.entrySink };
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };

  // act
  notifyUsageInfo(ctx, run, "Done.");

  // assert
  assert.deepStrictEqual(capture.entries, [faultUsage("Done.")]);
  capture.assertValid();
});

for (const { name, failures, expected, delivery, hasOutcome } of [
  {
    name: "first fault",
    failures: [1],
    expected: [
      faultUsage("First."),
      faultError("Append 1 failed."),
      faultUsage("Second."),
      faultUsage("Third."),
    ],
    delivery: "open",
    hasOutcome: true,
  },
  {
    name: "fault after success",
    failures: [2],
    expected: [
      faultUsage("First."),
      faultUsage("Second."),
      faultError("Append 2 failed."),
      faultUsage("Third."),
    ],
    delivery: "open",
    hasOutcome: true,
  },
  {
    name: "separate faults",
    failures: [1, 3],
    expected: [
      faultUsage("First."),
      faultError("Append 1 failed."),
      faultUsage("Second."),
      faultError("Append 3 failed."),
      faultUsage("Third."),
    ],
    delivery: "open",
    hasOutcome: true,
  },
  {
    name: "failed recovery",
    failures: [1, 2],
    expected: [faultUsage("First."), faultError("Append 1 failed.")],
    delivery: "closed",
    hasOutcome: false,
  },
]) {
  test(`bounds command append recovery for ${name}`, () => {
    // arrange
    const { sink, attempts } = failingSink(failures);
    const run = { ...runWithNothingLoaded(), entrySink: sink };
    const ctx = {
      mode: "json",
      get ui(): never {
        throw new Error("Unexpected UI access");
      },
    };
    let caught = false;

    // act
    try {
      notifyUsageInfo(ctx, run, "First.");
      ctx.mode = "rpc";
      notifyUsageInfo(ctx, run, "Second.");
      notifyUsageInfo(ctx, run, "Third.");
    } catch {
      caught = true;
    }

    // assert
    assert.strictEqual(caught, false);
    assert.deepStrictEqual(attempts, expected);
    assert.deepStrictEqual(run.commandState, {
      hasOutcome,
      needsReload: false,
      settled: false,
      delivery,
    });
  });
}

for (const { failures, delivery, hasOutcome } of [
  { failures: [1], delivery: "open", hasOutcome: true },
  { failures: [1, 2], delivery: "closed", hasOutcome: false },
]) {
  test(`bounds recovery of an internal-error with failed attempts ${failures.join(",")}`, () => {
    // arrange
    const { sink, attempts } = failingSink(failures);
    const run = { ...runWithNothingLoaded(), entrySink: sink };
    const ctx = {
      mode: "json",
      get ui(): never {
        throw new Error("Unexpected UI access");
      },
    };
    assert.ok(run.origin.kind === "command" && run.commandState !== undefined);

    // act
    notifyCommandError(ctx, sink, run.origin, run.commandState, new Error("Operation failed."));

    // assert
    assert.deepStrictEqual(attempts, [
      faultError("Operation failed."),
      faultError("Append 1 failed."),
    ]);
    assert.deepStrictEqual(run.commandState, {
      hasOutcome,
      needsReload: false,
      settled: false,
      delivery,
    });
  });
}

test("preserves reload truth from a failed attempted outcome", () => {
  // arrange
  const { sink, attempts } = failingSink([1]);
  const run = { ...runWithNothingLoaded(), entrySink: sink };
  const ctx = {
    mode: "json",
    get ui(): never {
      throw new Error("Unexpected UI access");
    },
  };

  // act
  notify(ctx, run, { kind: "prune-committed-warning", scope: "user", cause: new Error("Saved.") });

  // assert
  assert.deepStrictEqual(attempts, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "prune-committed-warning",
        severity: "warning",
        needsReload: true,
        summary: "Prune committed; finalization needs attention.",
        scope: "user",
        cause: { causeChain: ["Saved."], truncated: false },
      },
    },
    faultError("Append 1 failed.", true),
  ]);
  assert.deepStrictEqual(run.commandState, {
    hasOutcome: true,
    needsReload: true,
    settled: false,
    delivery: "open",
  });
});

for (const kind of ["load", "hook"] as const) {
  test(`leaves ${kind} append failures to its existing root`, () => {
    // arrange
    const { sink, attempts } = failingSink([1]);
    const run = { ...runWithNothingLoaded(), entrySink: sink, origin: { kind } };
    const ctx = {
      mode: "json",
      get ui(): never {
        throw new Error("Unexpected UI access");
      },
    };

    // act & assert
    assert.throws(
      () => {
        notifyUsageInfo(ctx, run, "Lifecycle.");
      },
      { name: "Error", message: "Append 1 failed." },
    );
    assert.deepStrictEqual(attempts, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind },
          kind: "usage-info",
          severity: "info",
          needsReload: false,
          usage: "Lifecycle.",
        },
      },
    ]);
  });
}

for (const { message, outcome, reload } of [
  { message: { kind: "cascade", marketplaces: [] }, outcome: true, reload: false },
  {
    message: {
      kind: "marketplace-info",
      name: "demo",
      scope: "user",
      details: { autoupdate: false },
      source: { sourceKind: "path", absPath: "/demo" },
    },
    outcome: true,
    reload: false,
  },
  {
    message: {
      kind: "plugin-info",
      marketplaceName: "demo",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: false },
      plugin: { name: "one", status: "available", componentsResolved: false },
    },
    outcome: true,
    reload: false,
  },
  {
    message: {
      kind: "marketplace-info-cascade",
      blocks: [
        {
          kind: "marketplace-info",
          name: "demo",
          scope: "user",
          details: { autoupdate: false },
          source: { sourceKind: "path", absPath: "/demo" },
        },
      ],
    },
    outcome: true,
    reload: false,
  },
  {
    message: {
      kind: "plugin-info-cascade",
      blocks: [
        {
          kind: "plugin-info",
          marketplaceName: "demo",
          marketplaceScope: "user",
          marketplaceDetails: { autoupdate: false },
          plugin: { name: "one", status: "available", componentsResolved: false },
        },
      ],
    },
    outcome: true,
    reload: false,
  },
  { message: { kind: "marketplace-not-added", name: "demo" }, outcome: true, reload: false },
  {
    message: { kind: "reconcile-pending-empty", command: "pending" },
    outcome: true,
    reload: false,
  },
  { message: { kind: "prune-empty", scope: "project" }, outcome: true, reload: false },
  {
    message: { kind: "prune-committed-warning", scope: "project", cause: new Error("Saved.") },
    outcome: true,
    reload: true,
  },
  {
    message: { kind: "reconcile-applied-cascade", marketplaces: [] },
    outcome: true,
    reload: false,
  },
] satisfies Array<{ message: NotificationMessage; outcome: boolean; reload: boolean }>) {
  test(`classifies ${message.kind} as command outcome ${outcome}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode: "json",
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(run.commandState, {
      hasOutcome: outcome,
      needsReload: reload,
      settled: false,
      delivery: "open",
    });
    assert.deepStrictEqual(
      capture.entries.map((entry) => {
        assert.ok(
          entry.payload !== null && typeof entry.payload === "object" && "kind" in entry.payload,
        );
        return entry.payload.kind;
      }),
      [message.kind],
    );
    capture.assertValid();
  });
}

for (const { kind, outcome, emit } of [
  {
    kind: "usage-error",
    outcome: true,
    emit: (ctx, run) => {
      notifyUsageError(ctx, run, { message: "Invalid.", usage: "Help." });
    },
  },
  {
    kind: "usage-info",
    outcome: true,
    emit: (ctx, run) => {
      notifyUsageInfo(ctx, run, "Help.");
    },
  },
  {
    kind: "internal-error",
    outcome: true,
    emit: (ctx, run) => {
      assert.ok(run.origin.kind === "command" && run.commandState !== undefined);
      notifyCommandError(ctx, run.entrySink, run.origin, run.commandState, new Error("Failed."));
    },
  },
  {
    kind: "diagnostic",
    outcome: false,
    emit: (ctx, run) => {
      notifyDiagnostic(ctx, run, "Warning.", ["Detail."]);
    },
  },
  {
    kind: "device-flow-prompt",
    outcome: false,
    emit: (ctx, run) => {
      notifyDeviceFlowPrompt(ctx, run, {
        verificationUri: "https://example.test",
        userCode: "ABCD",
      });
    },
  },
  {
    kind: "reconcile-aborted",
    outcome: false,
    emit: (ctx, run) => {
      notifyReconcileAborted(ctx, run, new Error("Failed."));
    },
  },
  {
    kind: "plugin-path-skipped",
    outcome: false,
    emit: (ctx, run) => {
      notifyPluginPathSkipped(ctx, run, "user", "Unreadable.");
    },
  },
  {
    kind: "async-rewake-summary",
    outcome: false,
    emit: (ctx, run) => {
      notifyAsyncRewakeSummary(ctx, run, "Done.");
    },
  },
  {
    kind: "stop-override-cap",
    outcome: false,
    emit: (ctx, run) => {
      notifyStopHookOverrideCap(ctx, run, "one@demo", 3);
    },
  },
  {
    kind: "mcp-config-notices",
    outcome: false,
    emit: (ctx, run) => {
      notifyMcpConfigNotices(ctx, run, [
        { kind: "left-unchanged", scope: "user", file: "mcp.json" },
      ]);
    },
  },
  {
    kind: "mcp-migration",
    outcome: false,
    emit: (ctx, run) => {
      notifyMcpMigration(ctx, run, {
        rows: [{ kind: "stopped", scope: "user", detail: "locked" }],
        notices: [],
      });
    },
  },
] satisfies Array<{
  kind: string;
  outcome: boolean;
  emit: (ctx: HostNotificationContext, run: NotificationRun) => void;
}>) {
  test(`classifies ${kind} as command outcome ${outcome}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode: "json",
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    emit(ctx, run);

    // assert
    assert.deepStrictEqual(run.commandState, {
      hasOutcome: outcome,
      needsReload: false,
      settled: false,
      delivery: "open",
    });
    assert.deepStrictEqual(
      capture.entries.map((entry) => {
        assert.ok(
          entry.payload !== null && typeof entry.payload === "object" && "kind" in entry.payload,
        );
        return entry.payload.kind;
      }),
      [kind],
    );
    capture.assertValid();
  });
}

for (const state of [
  { hasOutcome: true, needsReload: false, settled: true, delivery: "open" },
  { hasOutcome: false, needsReload: true, settled: false, delivery: "closed" },
] as const) {
  test(`suppresses notifications and errors for ${JSON.stringify(state)}`, () => {
    // arrange
    const run = { ...runWithNothingLoaded(), commandState: { ...state } };
    const ctx = {
      get mode(): string {
        throw new Error("Unexpected mode access");
      },
      get ui(): never {
        throw new Error("Unexpected UI access");
      },
    };
    assert.ok(run.origin.kind === "command");

    // act
    notifyUsageInfo(ctx, run, "Late.");
    notifyCommandError(ctx, run.entrySink, run.origin, run.commandState, new Error("Late."));

    // assert
    assert.deepStrictEqual(run.commandState, state);
  });
}

for (const kind of ["load", "hook"] as const) {
  test(`does not account ${kind} output as a command result`, () => {
    // arrange
    const capture = createJsonCapture();
    const run = { ...runWithNothingLoaded(), origin: { kind }, entrySink: capture.entrySink };
    const ctx = {
      mode: "json",
      get ui() {
        return capture.ui;
      },
    };

    // act
    notifyUsageInfo(ctx, run, "Lifecycle.");

    // assert
    assert.deepStrictEqual(run.commandState, {
      hasOutcome: false,
      needsReload: false,
      settled: false,
      delivery: "open",
    });
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind },
          kind: "usage-info",
          severity: "info",
          needsReload: false,
          usage: "Lifecycle.",
        },
      },
    ]);
    capture.assertValid();
  });
}

for (const mode of ["json", "rpc"]) {
  test(`delivers a resolved command error without inventory in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const origin = { kind: "command", commandId: "plugin update", invocationId: "run-a" } as const;
    const sink = {
      appendEntry(customType: string, payload: unknown) {
        assert.strictEqual(this, sink);
        capture.entrySink.appendEntry(customType, payload);
      },
    };

    // act
    notifyCommandError(
      ctx,
      sink,
      origin,
      { ...createCommandRunState(), needsReload: true },
      new Error("Failed at /private/work/config.json"),
    );

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          kind: "internal-error",
          origin,
          severity: "error",
          needsReload: true,
          summary: "Command failed unexpectedly.",
          cause: { causeChain: ["Failed at [path]"], truncated: false },
        },
      },
    ]);
    capture.assertValid();
  });
}

for (const mode of ["tui", "print"]) {
  test(`rethrows the exact command failure without UI access in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const origin = { kind: "command", commandId: "plugin update", invocationId: "run-a" } as const;
    const cause = new Error("failed");

    // act & assert
    assert.throws(
      () => {
        notifyCommandError(ctx, capture.entrySink, origin, createCommandRunState(), cause);
      },
      (error: unknown) => error === cause,
    );
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
  });
}

test("delivers an unexpected error after an earlier explicit outcome", () => {
  // arrange
  const capture = createJsonCapture();
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };
  const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
  assert.ok(run.origin.kind === "command" && run.commandState !== undefined);

  // act
  notifyUsageInfo(ctx, run, "Done.");
  notifyCommandError(ctx, run.entrySink, run.origin, run.commandState, new Error("Later failure."));

  // assert
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "usage-info",
        severity: "info",
        needsReload: false,
        usage: "Done.",
      },
    },
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "internal-error",
        severity: "error",
        needsReload: false,
        summary: "Command failed unexpectedly.",
        cause: { causeChain: ["Later failure."], truncated: false },
      },
    },
  ]);
  capture.assertValid();
});

for (const mode of ["json", "rpc"]) {
  test(`appends complete usage payloads in ${mode} without UI access`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    notifyUsageError(ctx, run, { message: "Invalid input.", usage: "Usage: command" });
    notifyUsageInfo(ctx, run, "Usage: command");

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "usage-error",
          severity: "error",
          needsReload: false,
          message: "Invalid input.",
          usage: "Usage: command",
        },
      },
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "usage-info",
          severity: "info",
          needsReload: false,
          usage: "Usage: command",
        },
      },
    ]);
    capture.assertValid();
  });
}

test("keeps mixed entries and duplicates ordered while reading live mode on the original run", () => {
  // arrange
  const capture = createJsonCapture();
  let mode = "json";
  let tools: readonly ToolInventoryItem[] = [];
  const inventory = mock<PiInventory>({ exactParams: true, name: "inventory" });
  when(() => inventory.getAllTools())
    .thenReturn([])
    .times(3);
  when(() => inventory.getCommands())
    .thenReturn([])
    .times(1);
  const pi = {
    getAllTools: () => {
      inventory.getAllTools();
      return tools;
    },
    getCommands: () => inventory.getCommands(),
    appendEntry: capture.entrySink.appendEntry,
  };
  const run = openNotificationRun(pi, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });
  const reads: string[] = [];
  const ctx = {
    get mode() {
      reads.push(mode);
      return mode;
    },
    get ui() {
      return capture.ui;
    },
  };

  // act
  notifyUsageError(ctx, run, { message: "Invalid input.", usage: "Usage: command" });
  tools = [{ name: "subagent" }, { name: "mcp" }, { name: "workflow_control" }];
  mode = "rpc";
  notify(ctx, run, { marketplaces: [] });
  mode = "json";
  notifyUsageError(ctx, run, { message: "Invalid input.", usage: "Usage: command" });
  mode = "rpc";
  notifyUsageError(ctx, run, { message: "Invalid input.", usage: "Usage: command" });

  // assert
  const expectedUsageEntry = {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "usage-error",
      severity: "error",
      needsReload: false,
      message: "Invalid input.",
      usage: "Usage: command",
    },
  };
  assert.deepStrictEqual(capture.entries, [
    expectedUsageEntry,
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "cascade",
        severity: "info",
        needsReload: false,
        marketplaces: [],
      },
    },
    expectedUsageEntry,
    expectedUsageEntry,
  ]);
  assert.notStrictEqual(capture.entries[0], capture.entries[2]);
  assert.notStrictEqual(capture.entries[2], capture.entries[3]);
  assert.deepStrictEqual(reads, ["json", "rpc", "json", "rpc"]);
  assert.deepStrictEqual(run.softDeps, {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  });
  assert.strictEqual(run.entrySink, pi);
  capture.assertValid();
  verify(inventory);
});

test("independent contexts retain their own explicit modes", (t) => {
  // arrange
  const first = createContext(t);
  const second = createContext(t);

  // act
  first.mode = "rpc";

  // assert
  assert.deepStrictEqual([first.mode, second.mode], ["rpc", "tui"]);
});

test("rejects an unsupported mode before structured or raw delivery", () => {
  // arrange
  const capture = createJsonCapture();
  const ctx = {
    mode: "invalid",
    get ui() {
      return capture.ui;
    },
  };
  const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

  // act & assert
  assert.throws(
    () => {
      notify(ctx, run, { marketplaces: [] });
    },
    {
      name: "UnsupportedModeError",
      mode: "invalid",
    },
  );
  assert.throws(() => {
    notifyUsageInfo(ctx, runWithNothingLoaded(), "usage");
  }, UnsupportedModeError);
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

for (const index of [0, 1, 2]) {
  test(`retains an invalid capture at position ${index} after its append failure is caught`, () => {
    // arrange
    const capture = createJsonCapture();
    const valid = {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "usage-info",
      severity: "info",
      needsReload: false,
      usage: "help",
    };
    const payloads: unknown[] = [valid, valid, valid];
    payloads[index] = {};

    // act
    for (const payload of payloads) {
      if (payload === valid) {
        capture.entrySink.appendEntry("claude-plugin", payload);
      } else {
        assert.throws(() => {
          capture.entrySink.appendEntry("claude-plugin", payload);
        }, assert.AssertionError);
      }
    }

    // assert
    assert.deepStrictEqual(
      capture.entries,
      payloads.map((payload) => ({ customType: "claude-plugin", payload })),
    );
    assert.throws(() => {
      capture.assertValid();
    }, assert.AssertionError);
  });
}

for (const { name, payload } of [
  {
    name: "undefined",
    payload: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "cascade",
      severity: "info",
      needsReload: false,
      marketplaces: [],
      advisories: undefined,
    },
  },
  { name: "null", payload: { extra: null } },
  { name: "function", payload: { extra: () => undefined } },
  { name: "symbol", payload: { extra: Symbol("extra") } },
  { name: "bigint", payload: { extra: 1n } },
  { name: "nonfinite number", payload: { extra: NaN } },
  { name: "class instance", payload: { extra: new Error("extra") } },
]) {
  test(`capture rejects original ${name} values before serialization can hide them`, () => {
    // arrange
    const capture = createJsonCapture();

    // act & assert
    assert.throws(() => {
      capture.entrySink.appendEntry("claude-plugin", payload);
    }, assert.AssertionError);
    assert.deepStrictEqual(capture.entries, [{ customType: "claude-plugin", payload }]);
    assert.throws(() => {
      capture.assertValid();
    }, assert.AssertionError);
  });
}

test("capture retains a wrong custom type after the immediate failure is caught", () => {
  // arrange
  const capture = createJsonCapture();

  // act & assert
  assert.throws(() => {
    capture.entrySink.appendEntry("other", {});
  }, assert.AssertionError);
  assert.deepStrictEqual(capture.entries, [{ customType: "other", payload: {} }]);
  assert.throws(() => {
    capture.assertValid();
  }, assert.AssertionError);
});

test("capture retains a caught UI getter failure without a notify call", () => {
  // arrange
  const capture = createJsonCapture();

  // act & assert
  assert.throws(() => capture.ui, Error);
  assert.deepStrictEqual(capture.entries, []);
  assert.throws(() => {
    capture.assertValid();
  }, assert.AssertionError);
});

test("an empty capture has no validation failures", () => {
  // arrange
  const capture = createJsonCapture();

  // act
  capture.assertValid();

  // assert
  assert.deepStrictEqual(capture.entries, []);
});

test("notify renders single installed plugin with empty deps under added marketplace (info severity + reload-hint)", (t) => {
  // arrange
  const ctx = createContext(t);
  const capture = createJsonCapture();
  const inventory = mock<PiInventory>({ exactParams: true, name: "Pi inventory" });
  when(() => inventory.getAllTools())
    .thenReturn([])
    .times(3);
  when(() => inventory.getCommands())
    .thenReturn([])
    .times(1);
  const pi = {
    getAllTools: () => inventory.getAllTools(),
    getCommands: () => inventory.getCommands(),
    appendEntry(customType: string, payload: unknown): void {
      assert.strictEqual(this, pi);
      capture.entrySink.appendEntry(customType, payload);
    },
  };
  const run = openNotificationRun(pi, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  ctx.mode = "json";
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "cascade",
        severity: "info",
        needsReload: true,
        marketplaces: [
          {
            name: "demo",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "commit-commands",
                id: "commit-commands@demo",
                scope: "user",
                reasons: [],
                version: "1.0.0",
              },
            ],
          },
        ],
      },
    },
  ]);
  capture.assertValid();
  verify(inventory);
});

test("notify renders installed plugin with agents dep + probe unloaded (soft-dep marker emitted inside brace)", (t) => {
  // arrange
  const ctx = createContext(t);
  ctx.mode = "print";
  const run = runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: false,
  }); // agents NOT loaded
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: ["agents"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed) {requires pi-subagents}\n\n/reload to pick up changes`,
  ]);
});

test("notify renders updated plugin with version arrow + mcp dep marker", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithSoftDeps({
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  }); // mcp NOT loaded
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "updated",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            from: "1.0.0",
            to: "1.1.0",
            dependencies: ["mcp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 → v1.1.0 (updated) {requires pi-mcp-adapter}\n\n/reload to pick up changes`,
  ]);
});

test("notify renders reinstalled plugin with both deps loaded (no soft-dep marker, empty brace suppressed)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "reinstalled",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: ["agents", "mcp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (reinstalled)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders uninstalled plugin (no dependencies field, ICON_AVAILABLE)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "uninstalled",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ○ commit-commands v1.0.0 (uninstalled)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders available plugin (MSG-PL-6 carve-out: NO scope bracket ever, list-surface header)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "available",
            name: "commit-commands",
            version: "1.0.0",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ○ commit-commands v1.0.0 (available)`,
  ]);
});

test("notify renders unavailable plugin with reasons (MSG-PL-6 carve-out: NO scope bracket)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "unavailable",
            name: "commit-commands",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ⊘ commit-commands (unavailable) {unsupported hooks}`,
  ]);
});

test("USTAT-01 / D-64-01: notify renders unsupported plugin with the ⊖ glyph (MSG-PL-6 carve-out: NO scope bracket)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "hookify",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● demo [user]\n  ⊖ hookify (partially-available) {unsupported hooks}`);
  assert.ok((args[0] as string).includes("⊖ hookify"));
  assert.ok(!(args[0] as string).includes("⊘ hookify"));
});

test("USTAT-01 / D-64-01: notify renders unsupported plugin with version and {lsp} brace", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "clangd-lsp",
            version: "1.0.0",
            reasons: ["lsp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ⊖ clangd-lsp v1.0.0 (partially-available) {lsp}`,
  ]);
});

test("XSURF-01: partially-available install-failure row with partialHint emits the --partial install trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "hookify",
            version: "1.0.0",
            reasons: ["unsupported hooks", "lsp"],
            severity: "error",
            partialHint: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `A plugin operation has failed.\n\n● demo [user]\n  ⊖ hookify v1.0.0 (partially-available) {unsupported hooks, lsp}\n    Re-run with --partial to install the supported components.`,
  );
});

test("XSURF-01: unsupported row WITHOUT partialHint stays byte-frozen (no trailer)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "hookify",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ⊖ hookify v1.0.0 (partially-available) {unsupported hooks}`,
  );
  assert.ok(!(args[0] as string).includes("--partial"));
});

test("XSURF-03: partially-upgradable update-decline row with partialHint emits the --partial update trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-upgradable",
            name: "clean-plugin",
            version: "1.0.0",
            reasons: ["lsp"],
            severity: "warning",
            partialHint: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args[1], "warning");
  assert.equal(
    args[0],
    `A plugin operation needs attention.\n\n● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {lsp}\n    Re-run with --partial to update with the supported components.`,
  );
});

test("XSURF-03: list-inventory partially-upgradable row WITHOUT partialHint stays byte-frozen (no trailer)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-upgradable",
            name: "clean-plugin",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {unsupported hooks}`,
  );
  assert.ok(!(args[0] as string).includes("--partial"));
});

test("notify renders upgradable plugin with version and reasons brace", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "upgradable",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["stale clone"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ● commit-commands v1.0.0 (upgradable) {stale clone}`,
  ]);
});

test("FSTAT-02 / D-66-03: partially-installed renders the ◉ glyph distinct from ● installed", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-installed",
            name: "degraded-plugin",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ◉ degraded-plugin v1.0.0 (partially-installed) {unsupported hooks}`,
  );
  assert.ok((args[0] as string).includes("◉ degraded-plugin"));
  assert.ok(!(args[0] as string).includes("● degraded-plugin"));
});

test("WR-03: partially-installed success row threads dependencies -> soft-dep marker fires in the SAME brace as the dropped-component reason", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: false,
  });
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "partially-installed",
            name: "helper",
            version: "1.0.0",
            dependencies: ["agents"],
            reasons: ["lsp"],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    `● official [user]\n  ◉ helper v1.0.0 (partially-installed) {lsp, requires pi-subagents}\n\n/reload to pick up changes`,
  );
});

test("WR-03: partially-installed INVENTORY row (no dependencies) renders no soft-dep marker even when a companion is unloaded", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "partially-installed",
            name: "degraded-plugin",
            version: "1.0.0",
            reasons: ["lsp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    `● official [user]\n  ◉ degraded-plugin v1.0.0 (partially-installed) {lsp}`,
  );
});

test("FSTAT-04 / D-66-03: partially-upgradable reuses the ● glyph like the upgradable arm", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-upgradable",
            name: "clean-plugin",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {unsupported hooks}`,
  );
});

test("FSTAT-06 / D-66-04: the will-install partial modifier renders (will partially install)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        plugins: [{ status: "will install", name: "degraded-plugin", partial: true }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● new-mp [user]\n  ● degraded-plugin (will partially install)`);
});

test("FSTAT-06 / D-66-04: will-install WITHOUT the partial modifier renders (will install)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        plugins: [{ status: "will install", name: "plain-plugin", partial: false }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args[0], `● new-mp [user]\n  ● plain-plugin (will install)`);
});

test("notify renders benign skipped plugin with up-to-date reason (info severity, UXG-02 / D-28-06)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "skipped",
            severity: "info",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["up-to-date"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ⊘ commit-commands v1.0.0 (skipped) {up-to-date}`,
  ]);
});

test("notify renders failed plugin with reasons only -- no cause, no rollback (error severity, NO reload-hint when mp.status=failed)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["network unreachable"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {network unreachable}`,
    "error",
  ]);
});

test("notify renders added marketplace header alone (empty plugins -> header-only body, NO reload-hint per SNM-33/D-22-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "added", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (added)`]);
});

test("notify renders removed marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-02)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "removed", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (removed)`]);
});

test("notify renders updated marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-06)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "updated", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (updated)`]);
});

test("notify renders failed marketplace header alone (empty plugins -> NO reload-hint per D-16-12; no severity because no failed plugin)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ demo [user] (failed)`,
    "error",
  ]);
});

test("D-48-A: bare-(failed) add `failure-unreachable` form is byte-unchanged (reasons omitted -> brace collapses)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "unreachable-mp",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ unreachable-mp [user] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ unreachable-mp \[user\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("D-48-A: bare-(failed) update `mp-failure-network` header is byte-unchanged (reasons omitted -> brace collapses)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ official [user] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ official \[user\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("D-48-A: a reasons-omitted failed marketplace arm renders bare `(failed)` (the third bare form; arm byte-stable)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "missing-mp",
        scope: "project",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ missing-mp [project] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ missing-mp \[project\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("notify renders autoupdate enabled marketplace header alone (UXG-04 <autoupdate> marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "foo", scope: "user", status: "autoupdate enabled", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● foo [user] <autoupdate>`]);
});

test("notify renders autoupdate disabled marketplace header alone (UXG-04 <no autoupdate> off-marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "foo", scope: "user", status: "autoupdate disabled", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● foo [user] <no autoupdate>`]);
});

test("notify renders idempotent-enable marketplace header with <autoupdate> marker + reasons brace (UXG-04, info severity per UXG-02 / D-28-07, NO reload-hint per D-17.1-05)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["already autoupdate"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● foo [user] <autoupdate> {already autoupdate}`,
  ]);
});

test("notify severity tier mp-skipped: idempotent-disable marketplace renders <no autoupdate> + brace, computes info (benign per UXG-02 / D-28-07)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["already no autoupdate"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
});

test('UXG-05: marketplace update no-op (mp.skipped + reasons:["up-to-date"], plugins:[]) renders `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer', (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["up-to-date"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  const body = args[0];
  assert.equal(body, "● local-mp [user] (skipped) {up-to-date}");
  assert.equal(args.length, 1);
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test('UXG-05 (UAT Test-3 gap): autoupdate-ON no-op payload (mp.skipped + reasons:["up-to-date"], plugins:[]) renders byte-identically to the OFF no-op `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer', (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["up-to-date"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  const body = args[0];
  assert.equal(body, "● official [user] (skipped) {up-to-date}");
  assert.equal(args.length, 1);
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("notify benign-only cascade: benign mp.skipped coexists with healthy plugin row -> computes info (UXG-02 / D-28-06/07)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["already autoupdate"],
        plugins: [
          {
            name: "p1",
            status: "available",
            version: "1.0.0",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  const body = args[0];
  assert.ok(
    body.includes(`● foo [user] <autoupdate> {already autoupdate}`),
    `expected body to include mp-skipped header, got: ${body}`,
  );
  assert.ok(
    !body.includes(`/reload to pick up changes`),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("notify renders SUB-BRANCH B list-surface marketplace header with autoupdate token; lastUpdatedAt field persists but is not rendered (UXG-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-05-25T00:00:00Z" },
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] <autoupdate>`]);
});

test("notify renders header-only block on empty plugins under added marketplace (NO reload-hint per SNM-33/D-22-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "added", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (added)`]);
});

test("RLD-04: list-shaped message with an installed inventory row (needsReload:false) emits NO /reload trailer (RLD-02 OR-reduce)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.includes("● alpha v1.0.0 (installed)"),
    `expected body to include the installed inventory row, got: ${body}`,
  );
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("RLD-02: cascade-shaped message with an installed transition row (needsReload:true) emits the /reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected body to include reload-hint trailer, got: ${body}`,
  );
});

test("PL-4: installed inventory row with description emits a 4-space-indented second line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            description: "A short description of the alpha plugin.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(
    body,
    "● official [user]\n  ● alpha v1.0.0 (installed)\n    A short description of the alpha plugin.",
  );
});

test("PL-4: upgradable row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "upgradable",
            name: "beta",
            version: "1.0.0",
            reasons: [],
            description: "Beta plugin description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(
    body,
    "● official [user]\n  ● beta v1.0.0 (upgradable)\n    Beta plugin description.",
  );
});

test("PL-4: available row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "available",
            name: "gamma",
            version: "2.0.0",
            description: "Installable plugin with a description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(
    body,
    "● official [user]\n  ○ gamma v2.0.0 (available)\n    Installable plugin with a description.",
  );
});

test("PL-4: unavailable row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "unavailable",
            name: "delta",
            reasons: ["unsupported hooks"],
            description: "Unavailable plugin that still surfaces its description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(
    body,
    "● official [user]\n  ⊘ delta (unavailable) {unsupported hooks}\n    Unavailable plugin that still surfaces its description.",
  );
});

test("PL-4 / CR-01: unsupported row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "delta",
            reasons: ["lsp"],
            description: "Unsupported plugin that still surfaces its description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(
    body,
    "● official [user]\n  ⊖ delta (partially-available) {lsp}\n    Unsupported plugin that still surfaces its description.",
  );
});

test("PL-4: disabled inventory row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            severity: "info",
            needsReload: false,
            name: "foo-plugin",
            version: "1.2.3",
            description: "Disabled plugin that still surfaces its description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(
    body,
    "● official [user]\n  ◍ foo-plugin v1.2.3 (disabled)\n    Disabled plugin that still surfaces its description.",
  );
});

test("PL-4: description absent -- no second line emitted", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", version: "2.0.0" }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(body, "● official [user]\n  ○ gamma v2.0.0 (available)");
});

test("PL-4: description exactly 66 chars -- emitted verbatim (no truncation)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const exactly66 = "A".repeat(66);
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: exactly66 }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.ok(
    body.includes(`    ${exactly66}`),
    `expected 66-char description verbatim, got: ${body}`,
  );
});

test("PL-4: description 67 chars -- truncated to 63 + '...' (column 66)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const over = "B".repeat(67);
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: over }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.ok(
    body.includes(`    ${"B".repeat(63)}...`),
    `expected truncated description, got: ${body}`,
  );
});

test("PL-4: empty string description -- no second line emitted", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: "" }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.equal(body, "● official [user]\n  ○ gamma (available)");
});

test("D-22-04 NEGATIVE: empty `marketplace add` ({status:'added', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "added", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected empty add to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 NEGATIVE: empty `marketplace remove` ({status:'removed', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-02)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "removed", plugins: [] }],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected empty remove to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 NEGATIVE: no-op `marketplace update` (all plugin rows skipped) emits NO /reload trailer (SNM-33 / G-MIL-06)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "updated",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected all-skipped update to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 POSITIVE: `marketplace remove` that uninstalled >=1 plugin emits the /reload trailer (SC#4)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "removed",
        plugins: [{ status: "uninstalled", name: "alpha", severity: "info", needsReload: true }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected non-empty remove to include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 POSITIVE: `marketplace update` with >=1 changed plugin emits the /reload trailer (SC#4)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "updated",
        plugins: [
          {
            status: "updated",
            name: "alpha",
            from: "1.0.0",
            to: "2.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected update with a changed plugin to include reload-hint trailer, got: ${body}`,
  );
});

test("notify renders (no marketplaces) sentinel for empty marketplaces array (no reload-hint, no severity)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = { marketplaces: [] };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`(no marketplaces)`]);
});

test("WR-06: notify folds caller-supplied advisory lines between the body and the tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [],
    advisories: ["first advisory", "second advisory"],
    retainedWorkflows: [],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.strictEqual(ctx.ui.notify.mock.calls.length, 1);
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "(no marketplaces)\n\nfirst advisory\nsecond advisory",
  ]);
});

test("notify renders bare marketplace header when mp.status and mp.details are both undefined (no-crash, BLOCKER-3 coverage)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user]`]);
});

test("notify renders single-plugin payload as 2-line body (header + 2-space indented row)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify preserves caller-supplied plugin order across multi-plugin payload (D-16-06: no internal sort)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "gamma",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
          {
            status: "installed",
            name: "alpha",
            version: "2.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
          {
            status: "installed",
            name: "beta",
            version: "3.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● gamma v1.0.0 (installed)\n  ● alpha v2.0.0 (installed)\n  ● beta v3.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify joins multi-marketplace blocks with single blank line and appends reload-hint at end (D-16-07)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "alpha-mp",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha-plugin",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
      {
        name: "beta-mp",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "beta-plugin",
            version: "2.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● alpha-mp [user] (added)\n  ● alpha-plugin v1.0.0 (installed)\n\n● beta-mp [project] (added)\n  ● beta-plugin v2.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify emits inline [scope] bracket on plugin row when p.scope set (orphan-fold PRESENT)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
            scope: "user", // orphan-fold: plugin scope differs from marketplace scope
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● commit-commands [user] v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify omits scope bracket on plugin row when p.scope is undefined (non-orphan-fold, BLOCKER-1 coverage)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "BLOCKER-1: row must not contain the literal [undefined] substring",
  );
  const lines = body.split("\n");
  const pluginRow = lines[1]!;
  assert.ok(
    !pluginRow.includes("[project]"),
    "BLOCKER-1: plugin row must not leak the marketplace's [project] bracket",
  );
  assert.ok(
    !pluginRow.includes("[user]"),
    "BLOCKER-1: plugin row must not contain a stray [user] bracket either",
  );
});

test("notify omits scope bracket on installed plugin row when p.scope === mp.scope (D-17.2-07a)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            scope: "user", // same-scope: plugin scope matches marketplace scope -> no bracket
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07a: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    !pluginRow.includes("[user]"),
    "D-17.2-07a: same-scope plugin row must not contain a [user] bracket",
  );
  assert.ok(
    !pluginRow.includes("[project]"),
    "D-17.2-07a: same-scope plugin row must not leak any other [scope] bracket",
  );
});

test("notify emits [project] bracket on installed plugin row when p.scope !== mp.scope (D-17.2-07b)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            scope: "project", // orphan-fold: plugin scope differs from marketplace scope
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha [project] v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07b: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    pluginRow.includes("[project]"),
    "D-17.2-07b: orphan-fold plugin row must contain the [project] bracket",
  );
});

test("notify omits scope bracket on updated plugin row when p.scope === mp.scope (D-17.2-07c)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "updated",
            severity: "info",
            needsReload: true,
            name: "alpha",
            from: "0.9.0",
            to: "1.0.0",
            dependencies: [],
            scope: "project", // same-scope: no bracket
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● alpha v0.9.0 → v1.0.0 (updated)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07c: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    !pluginRow.includes("[user]"),
    "D-17.2-07c: same-scope updated row must not contain a [user] bracket",
  );
  assert.ok(
    !pluginRow.includes("[project]"),
    "D-17.2-07c: same-scope updated row must not leak the [project] bracket",
  );
});

test("notify emits [project] bracket on failed plugin row when p.scope !== mp.scope (D-17.2-07d)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            reasons: ["unsupported source"],
            scope: "project", // orphan-fold on an error-class arm
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation has failed.\n\n● demo [user] (added)\n  ⊘ alpha [project] v1.0.0 (failed) {unsupported source}`,
    "error",
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07d: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[3]!;
  assert.ok(
    pluginRow.includes("[project]"),
    "D-17.2-07d: orphan-fold failed row must contain the [project] bracket",
  );
});

test("notify renders rollbackPartial child rows at 4-space indent for failed plugin (no causes)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
            rollbackPartial: [{ phase: "skills" }, { phase: "agents" }],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    [skills] (rollback failed)\n    [agents] (rollback failed)`,
    "error",
  ]);
});

test("notify renders nested cause chains: per-plugin at 4-space indent, per-phase rollback cause at 6-space indent (D-16-08)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const inner = new Error("inner", { cause: new Error("root") });
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
            cause: inner,
            rollbackPartial: [{ phase: "skills", cause: new Error("EACCES") }],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    cause: inner -> root\n    [skills] (rollback failed)\n      cause: EACCES`,
    "error",
  ]);
});

test("notify emits per-plugin cause-chain inline below each failed row (multi-cause cascade, D-16-08)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            reasons: ["permission denied"],
            cause: new Error("alpha-root"),
          },
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "beta",
            version: "2.0.0",
            reasons: ["network unreachable"],
            cause: new Error("beta-root"),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some plugin operations have failed.\n\n● demo [user] (added)\n  ⊘ alpha v1.0.0 (failed) {permission denied}\n    cause: alpha-root\n  ⊘ beta v2.0.0 (failed) {network unreachable}\n    cause: beta-root`,
    "error",
  ]);
});

test("notify severity tier info: installed plugin in added marketplace -> arguments length 1 (no severity arg)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
});

test('notify severity tier warning: single actionable skipped plugin -> arguments = [..., "warning"]', (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 2);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test('notify severity tier error first-match: failed + skipped in same payload -> "error" (failed beats warning)', (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
          {
            status: "failed",
            name: "beta",
            version: "2.0.0",
            reasons: ["permission denied"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 2);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("notify suppresses reload-hint when payload contains only failed statuses (D-16-12 negative case)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("/reload to pick up changes"),
    "D-16-12: reload-hint must be suppressed when no state-changing status is present",
  );
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}`,
    "error",
  ]);
});

test("notifyUsageError emits ${msg.message}\\n\\n${msg.usage} with 'error' severity (SNM-13)", (t) => {
  // arrange
  const ctx = createContext(t);
  const msg: UsageErrorMessage = {
    message: "Unknown plugin",
    usage: "Usage: /claude:plugin install <name>",
  };

  // act
  notifyUsageError(ctx, runWithNothingLoaded(), msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Unknown plugin\n\nUsage: /claude:plugin install <name>`,
    "error",
  ]);
});

test("notify renders manual recovery plugin with cause-chain trailer (warning severity, status literal includes the space)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new Error("EACCES"),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation needs attention.\n\n● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: EACCES`,
    "warning",
  ]);
});

test("AS-7: manual recovery row names the leaked paths from ManualRecoveryError.leaks", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const leaks = [
    "/home/u/.pi/pi-claude-marketplace/agents-staging/foo.md",
    "/home/u/.pi/pi-claude-marketplace/agents-index.json",
  ];
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new ManualRecoveryError("agent index rewrite failed", leaks, {
              cause: new Error("EACCES"),
            }),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const [rendered, severity] = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  assert.equal(severity, "warning");
  assert.match(rendered, /cause: agent index rewrite failed -> EACCES/);
  for (const leak of leaks) {
    assert.match(rendered, new RegExp(`    leaked: ${leak.replace(/[.]/g, "\\.")}`));
  }
});

test("AS-7: manual recovery row with no leaks emits no leaked-paths child row", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new ManualRecoveryError("nothing leaked", [], {
              cause: new Error("EACCES"),
            }),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.doesNotMatch(rendered, /leaked:/);
});

test("notify renders single-version hash row as v#<7hex> via renderVersion chokepoint (SNM-35)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "hash-2ea95f85703d",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("D-77-01 / PURL-09 notify renders single-version sha row as v#<7hex> via renderVersion chokepoint", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "sha-2ea95f857031",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders update arrow with hash on both sides as v#<7hex> → v#<7hex> via composeVersionArrow (SNM-35)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "updated",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            from: "hash-2ea95f85703d",
            to: "hash-1c3d9a0bbef1",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 → v#1c3d9a0 (updated)\n\n/reload to pick up changes`,
  ]);
});

test("notify passes a SemVer version through unchanged -> v1.0.0 (non-hash pass-through guard, SNM-35)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test('UXG-02 (D-28-03/06): actionable plugin skip ("not installed") computes warning', (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-09): mixed cascade (benign skip + actionable skip) computes warning -- first-match poisoning", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
          {
            status: "skipped",
            name: "beta",
            version: "2.0.0",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-06): plugin skip with empty reasons:[] computes warning (allBenign guard on length)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: [],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-08): mp-level skip with reasons OMITTED computes warning -- safe default", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "skipped",
        plugins: [],
        severity: "warning",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-07 (D-29-02/03): error -- single failed plugin under failed mp -> 'Some operations have failed.' summary prepended", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["network unreachable"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {network unreachable}`,
    "error",
  ]);
});

test("UXG-07 (D-29-03): error -- single failed plugin, non-failed mp -> 'A plugin operation has failed.' (single-type singular)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            reasons: ["unsupported source"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation has failed.\n\n● demo [user] (added)\n  ⊘ alpha v1.0.0 (failed) {unsupported source}`,
    "error",
  ]);
});

test("UXG-07 (D-29-03): error -- two failed plugins, non-failed mp -> 'Some plugin operations have failed.' (single-type plural)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            version: "1.0.0",
            reasons: ["permission denied"],
            severity: "error",
            needsReload: false,
          },
          {
            status: "failed",
            name: "beta",
            version: "2.0.0",
            reasons: ["network unreachable"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.startsWith("Some plugin operations have failed.\n\n"),
    "two-failed-plugin cascade summary must read 'Some plugin operations have failed.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("UXG-07 (D-29-03): error -- failed mp only, no plugin rows -> 'A marketplace operation has failed.' (single-type marketplace)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ demo [user] (failed)`,
    "error",
  ]);
});

test("UXG-07 (D-29-03/04): warning -- single actionable-skip plugin -> 'A plugin operation needs attention.'", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.startsWith("A plugin operation needs attention.\n\n"),
    "single actionable-skip cascade summary must read 'A plugin operation needs attention.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test("UXG-07 (D-29-04): warning -- manual-recovery plugin counts as an actionable skip -> 'A plugin operation needs attention.'", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new Error("EACCES"),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation needs attention.\n\n● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: EACCES`,
    "warning",
  ]);
});

test("UXG-07 (D-29-03/04): warning -- two actionable-skip plugins + one actionable-skip mp -> mixed plural summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
          {
            status: "skipped",
            name: "beta",
            version: "2.0.0",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
      {
        name: "other",
        scope: "user",
        status: "skipped",
        plugins: [],
        severity: "warning",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.startsWith("Some operations need attention.\n\n"),
    "mixed actionable-skip cascade summary must read 'Some operations need attention.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test("UXG-07 (D-29-02): info severity -- NO summary line prepended (byte-identical to prior info-severity behavior)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("UXG-07 (D-29-02): error -- summary prepended BEFORE cascade body AND reload-hint stays last", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "uninstalled",
            name: "alpha",
            version: "1.0.0",
            severity: "info",
            needsReload: true,
          },
          {
            status: "failed",
            name: "beta",
            version: "2.0.0",
            reasons: ["permission denied"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  assert.ok(
    body.startsWith("A plugin operation has failed.\n\n"),
    "summary line must be the first line of the composed string",
  );
  assert.ok(
    body.endsWith("\n\n/reload to pick up changes"),
    "reload-hint must remain the last trailer after the cascade body",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("UXG-07 (D-29-02): warning -- benign-only cascade routes to INFO so NO summary line is prepended", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1, "benign-only skip is info severity -- single-arg call, no summary");
  assert.ok(
    !args[0].includes("needs attention.") && !args[0].includes("need attention."),
    "info-severity cascade must NOT carry a summary line",
  );
});

function pluginInfoDescriptionBlock(t: TestContext, description: string): string[] {
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      description,
      componentsResolved: false,
    },
  };
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];
  const lines = body.split("\n");
  return lines.slice(2);
}

test("wrapDescription: empty description omits the wrap block entirely", (t) => {
  // arrange
  const description = "";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    components: not resolved"]);
});

test("wrapDescription: short description renders as a single 4-space-indented line", (t) => {
  // arrange
  const description = "Hello world.";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    Hello world.", "    components: not resolved"]);
});

test("wrapDescription: text fitting exactly 66 chars on a word boundary stays on one line", (t) => {
  // arrange
  const text = "x".repeat(66);

  // act
  const tail = pluginInfoDescriptionBlock(t, text);

  // assert
  assert.deepEqual(tail, [`    ${text}`, "    components: not resolved"]);
});

test("wrapDescription: long description wraps at word boundary at 66-char text width", (t) => {
  // arrange
  const first = "a".repeat(60);
  const second = "b".repeat(60);

  // act
  const tail = pluginInfoDescriptionBlock(t, `${first} ${second}`);

  // assert
  assert.deepEqual(tail, [`    ${first}`, `    ${second}`, "    components: not resolved"]);
});

test("wrapDescription: an over-length single word emits on its own line at indent with no ellipsis", (t) => {
  // arrange
  const word = "supercalifragilisticexpialidociousandevenlongerwithanotherwordtoexceed";

  // act
  const tail = pluginInfoDescriptionBlock(t, word);

  // assert
  assert.deepEqual(tail, [`    ${word}`, "    components: not resolved"]);
});

test("wrapDescription: whitespace collapsed (tabs, newlines, double spaces) into single-space-separated words", (t) => {
  // arrange
  const description = "  hello\t\tworld\n\nfoo  ";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    hello world foo", "    components: not resolved"]);
});

test("WR-05 / wrapDescription: whitespace-only description reaches wrapDescription and returns no body lines", (t) => {
  // arrange
  const description = "   ";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    components: not resolved"]);
});

test("WR-05 / wrapDescription: two words whose `current.length + 1 + word.length === wrapCol` stay on one line (boundary-equality)", (t) => {
  // arrange
  const a = "a".repeat(32);
  const b = "b".repeat(33);
  const expectedWidth = 66;

  // act
  const width = a.length + 1 + b.length;
  const tail = pluginInfoDescriptionBlock(t, `${a} ${b}`);

  // assert
  assert.equal(width, expectedWidth, "fixture precondition: joined width must be exactly 66");
  assert.deepEqual(tail, [`    ${a} ${b}`, "    components: not resolved"]);
});

test("GRAM-01 / GRAM-02: standalone {marketplace not added} row renders the two-block summary + separate detail block (marketplace subject, error severity)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ my-mp [user] (failed) {marketplace not added}",
    "error",
  ]);
});

test("GRAM-02: standalone failed plugin-info renders `A plugin operation has failed.` + separate multi-line detail block", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "bad-mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "failed",
      name: "bad-mp",
      scope: "user",
      reasons: ["invalid manifest"],
      componentsResolved: false,
    },
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    [
      "A plugin operation has failed.",
      "",
      "● bad-mp [user] <no autoupdate>",
      "  ⊘ bad-mp (failed) {invalid manifest}",
      "    components: not resolved",
    ].join("\n"),
    "error",
  ]);
});

test("INFO-04: {marketplace not added} row never carries a reload-hint (read-only surface)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };

  // act
  notify(ctx, run, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.ok(
    !body.includes("/reload"),
    "marketplace-not-added must NOT carry the reload-hint trailer",
  );
});

test("INFO-01: renderMarketplaceInfo (github source + ref + lastUpdated + description)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: true, lastUpdatedAt: "2026-05-01T12:34:56Z" },
    source: { sourceKind: "github", owner: "acolombo", repo: "official", ref: "main" },
    description: "The official Claude plugin marketplace.",
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "github: acolombo/official#main",
      "last_updated: 2026-05-01T12:34:56Z",
      "description: The official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-01: renderMarketplaceInfo (path source, no lastUpdated, no description)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "local-mp",
    scope: "project",
    details: { autoupdate: false },
    source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" },
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    ["● local-mp [project] <no autoupdate>", "path: /home/user/projects/local-mp"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02 / INFO-05: renderPluginInfo (componentsResolved:true with sorted components + dependencies + wrapping description)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      description: "A short description of the alpha plugin.",
      componentsResolved: true,
      components: {
        agents: ["agent-a", "agent-b"],
        commands: ["cmd-a"],
        skills: ["skill-a", "skill-b"],
      },
      dependencies: ["beta@official", "gamma@official"],
    },
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    A short description of the alpha plugin.",
      "    agents: agent-a, agent-b",
      "    commands: cmd-a",
      "    skills: skill-a, skill-b",
      "    dependencies: beta@official, gamma@official",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-05: renderPluginInfo (componentsResolved:false emits the `components: not resolved` marker)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "available",
      name: "external",
      version: "2.0.0",
      componentsResolved: false,
    },
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ○ external v2.0.0 (available)",
      "    components: not resolved",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("SURF-02 / D-63-04: renderer emits multi-line `hooks:` block at 4-space header + 6-space per-entry indent (mixed tool/non-tool entries)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        hooks: [
          { event: "PreToolUse", matcher: "Bash" },
          { event: "PreToolUse", matcher: "Edit|Write" },
          { event: "PostToolUse", matcher: "Edit" },
          { event: "SessionStart" },
        ],
      },
    },
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    hooks:",
      "      PreToolUse(Bash)",
      "      PreToolUse(Edit|Write)",
      "      PostToolUse(Edit)",
      "      SessionStart",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("SURF-02 / D-63-04: empty hooks ([]) emits NO `hooks:` header; non-hooks kinds still render their single-line comma-join", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        agents: ["agent-a"],
        hooks: [],
      },
    },
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    ["● official [user] <autoupdate>", "  ● alpha v1.0.0 (installed)", "    agents: agent-a"].join(
      "\n",
    ),
  );
  assert.equal(args.length, 1);
});

test("SURF-02 / D-63-04: undefined hooks (field omitted) emits NO `hooks:` header; legacy 4-kind comma-join output is byte-stable", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        agents: ["a"],
        commands: ["b"],
        mcp: [{ name: "plugin:alpha:c" }],
        skills: ["d"],
      },
    },
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    agents: a",
      "    commands: b",
      "    mcp: plugin:alpha:c",
      "    skills: d",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("SURF-02: lenient `HookSummaryEntry` arm renders `<event> (unsupported)` when supported=false, bare `<event>` when supported=true", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "unavailable",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        hooks: [
          { kind: "lenient", event: "Notification", supported: false },
          { kind: "lenient", event: "PostToolUse", supported: true },
        ],
      },
    },
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ⊘ alpha v1.0.0 (unavailable)",
      "    hooks:",
      "      Notification (unsupported)",
      "      PostToolUse",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03: marketplace-info-cascade with a single block byte-equals the bare marketplace-info render", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-06-03T00:00:00Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "Official Claude plugin marketplace.",
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "github: anthropics/claude-plugins-official#main",
      "last_updated: 2026-06-03T00:00:00Z",
      "description: Official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03: marketplace-info-cascade with two blocks renders project-first then user, joined by one blank line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "project",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/repo/path/my-mp" },
      },
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "github", owner: "someuser", repo: "my-mp" },
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● my-mp [project] <autoupdate>",
      "path: /repo/path/my-mp",
      "",
      "● my-mp [user] <no autoupdate>",
      "github: someuser/my-mp",
    ].join("\n"),
  );
});

test("INFO-03: marketplace-info-cascade severity is always info (no second arg) and no reload-hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "project",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/repo/path/my-mp" },
      },
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "github", owner: "someuser", repo: "my-mp" },
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1, "info severity must omit the 2nd arg");
  assert.ok(
    !args[0].includes("/reload"),
    "info-surface marketplace-info-cascade must NOT carry the reload-hint trailer",
  );
});

test("INFO-03 + INFO-01: single-block fan-out (github source, all optional fields) byte form", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "claude-plugins-official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-05-01T12:34:56Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "The official Claude plugin marketplace.",
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● claude-plugins-official [user] <autoupdate>",
      "github: anthropics/claude-plugins-official#main",
      "last_updated: 2026-05-01T12:34:56Z",
      "description: The official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03 + INFO-01: single-block fan-out (path source, minimal) byte form omits last_updated and description", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "local-mp",
        scope: "project",
        details: { autoupdate: false },
        source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" },
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    ["● local-mp [project] <no autoupdate>", "path: /home/user/projects/local-mp"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02: plugin-info-cascade with a single block byte-equals the bare plugin-info render", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "foo",
          version: "1.0.0",
          componentsResolved: true,
          components: { skills: ["s1"] },
        },
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    ["● mp [user] <no autoupdate>", "  ● foo v1.0.0 (installed)", "    skills: s1"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02 + INFO-03: plugin-info-cascade with two blocks renders project-first then user, joined by one blank line", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "project",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "foo",
          version: "1.0.0",
          componentsResolved: true,
          components: { skills: ["s1"] },
        },
      },
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "foo",
          version: "2.0.0",
          componentsResolved: true,
          components: { agents: ["a1"] },
        },
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● mp [project] <autoupdate>",
      "  ● foo v1.0.0 (installed)",
      "    skills: s1",
      "",
      "● mp [user] <no autoupdate>",
      "  ● foo v2.0.0 (installed)",
      "    agents: a1",
    ].join("\n"),
  );
});

test("INFO-02: plugin-info-cascade severity is always info (no second arg) and no reload-hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "project",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "foo",
          version: "1.0.0",
          componentsResolved: true,
          components: { skills: ["s1"] },
        },
      },
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "foo",
          version: "2.0.0",
          componentsResolved: true,
          components: { agents: ["a1"] },
        },
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1, "info severity must omit the 2nd arg");
  assert.ok(
    !args[0].includes("/reload"),
    "info-surface plugin-info-cascade must NOT carry the reload-hint trailer",
  );
});

test("INFO-02: plugin-info-cascade single block installed with resolved components + dependencies renders full INFO-02 happy path", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
          dependencies: ["helper@utils-mp"],
        },
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● commit-commands v1.2.0 (installed)",
      "    Helpful git commit commands for everyday use.",
      "    agents: review-bot",
      "    commands: c1, c2",
      "    skills: commit-summary",
      "    dependencies: helper@utils-mp",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-05: plugin-info-cascade single block components-not-resolved emits the marker line at col 4", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "remote-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "remote-plugin",
          version: "1.0.0",
          description: "Remote plugin sourced from an external npm package.",
          componentsResolved: false,
        },
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● remote-mp [user] <no autoupdate>",
      "  ● remote-plugin v1.0.0 (installed)",
      "    Remote plugin sourced from an external npm package.",
      "    components: not resolved",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("an omitted cascade kind renders byte-identically to an explicit cascade kind", (t) => {
  // arrange
  const ctxNoKind = createContext(t);
  const ctxWithKind = createContext(t);
  const run = runWithAllLoaded();
  const noKindMsg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };
  const withKindMsg: NotificationMessage = {
    kind: "cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };
  notify(ctxNoKind, run, noKindMsg);

  // act
  notify(ctxWithKind, run, withKindMsg);
  const noKindArgs = ctxNoKind.ui.notify.mock.calls[0]!.arguments;
  const withKindArgs = ctxWithKind.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.deepEqual(
    noKindArgs,
    withKindArgs,
    'Optional kind?:"cascade" must produce byte-identical notify() output to omitted kind',
  );
});

test("WILL-01: marketplace add renders a bare header + will-install plugin child (orphan-fold suppresses [scope])", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        plugins: [{ status: "will install", name: "alpha" }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● new-mp [user]\n  ● alpha (will install)`);
});

test("DIFF-02: will-uninstall plugin under existing (no-status) marketplace block", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [{ status: "will uninstall", name: "old-plugin" }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ○ old-plugin (will uninstall)`);
});

test("DIFF-02: will-enable + will-disable rows under same marketplace", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          { status: "will enable", name: "to-enable" },
          { status: "will disable", name: "to-disable" },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ● to-enable (will enable)\n  ◍ to-disable (will disable)`);
});

test("DIFF-02: cross-scope orphan-fold -- plugin scope differs from marketplace scope -> [scope] bracket renders", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "shared",
        scope: "project",
        plugins: [{ status: "will install", name: "alpha", scope: "user" }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [project]\n  ● alpha [user] (will install)`);
});

test("DIFF-02: will-* cascade emits NO /reload to pick up changes trailer (pending rows are pre-transition)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          { status: "will install", name: "a" },
          { status: "will uninstall", name: "b" },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0];

  // assert
  assert.ok(
    !emitted.includes("/reload to pick up changes"),
    "pending rows MUST NOT emit the reload-hint trailer",
  );
});

test("DIFF-02: will-* cascade computes info severity (no second arg to ctx.ui.notify)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [{ status: "will uninstall", name: "p" }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
});

test("D-54-01: (disabled) inventory row renders subject-first with version under list-arm marketplace (info severity, no /reload)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        details: { autoupdate: true },
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user] <autoupdate>\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row without version omits the v<version> slot cleanly", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "disabled", name: "foo-plugin", severity: "info", needsReload: false }],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ◍ foo-plugin (disabled)`);
});

test("D-54-01: (disabled) inventory row with orphan-fold scope bracket -- explicit p.scope differs from mp.scope", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "shared",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            scope: "project",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [user]\n  ◍ foo-plugin [project] v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row WITHOUT orphan-fold -- p.scope matches mp.scope -> no row bracket", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            scope: "user",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("UAT-03 / RLD-05: a fresh (disabled) row stamping needsReload:true DOES emit the /reload trailer (realized transition; byte-identical row form)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    [
      "● claude-plugins-official [user]",
      "  ◍ foo-plugin v1.2.3 (disabled)",
      "",
      "/reload to pick up changes",
    ].join("\n"),
  );
});

test("UAT-03 / RLD-05: a (disabled) inventory row stamping needsReload:false stays trailer-free (stamp drives the hint, not the row status)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● claude-plugins-official [user]\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("D-54-01 / ENBL idempotency: (skipped) {already enabled} row routes to info severity (benign reason)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "info",
            needsReload: false,
            name: "foo-plugin",
            reasons: ["already enabled"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ⊘ foo-plugin (skipped) {already enabled}`,
  );
});

test("D-54-01 / ENBL idempotency: (skipped) {already disabled} row routes to info severity (benign reason)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "info",
            needsReload: false,
            name: "foo-plugin",
            reasons: ["already disabled"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ⊘ foo-plugin (skipped) {already disabled}`,
  );
});

test("D-54-01: enable cascade (installed plugin row under added mp header) emits /reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "foo-plugin",
            version: "1.2.3",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user] (added)\n  ● foo-plugin v1.2.3 (installed)\n\n/reload to pick up changes`,
  );
});

test("D-54-01: disable cascade (uninstalled plugin row under list-arm mp) emits /reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "uninstalled",
            severity: "info",
            needsReload: true,
            name: "foo-plugin",
            version: "1.2.3",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ○ foo-plugin v1.2.3 (uninstalled)\n\n/reload to pick up changes`,
  );
});

test("RECON-04: success cascade -- mixed marketplace add + plugin install across both scopes, project-first ordering", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "new-mp",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "new-plugin",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
      {
        name: "other-mp",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "other-plugin",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● new-mp [project] (added)\n  ● new-plugin (installed)\n\n● other-mp [user] (added)\n  ● other-plugin (installed)\n\n/reload to pick up changes`,
  );
});

test("D-08: an apply report with a realized row ends with the reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        status: "added",
        plugins: [
          { status: "installed", name: "a", dependencies: [], severity: "info", needsReload: true },
          { status: "uninstalled", name: "b", severity: "info", needsReload: true },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.deepStrictEqual(args, [
    "● new-mp [user] (added)\n  ● a (installed)\n  ○ b (uninstalled)\n\n/reload to pick up changes",
  ]);
});

test("D-08: an apply report with only failed rows carries no reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "a",
            reasons: ["not found"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.deepStrictEqual(args, [
    "A plugin operation has failed.\n\n● new-mp [user]\n  ⊘ a (failed) {not found}",
    "error",
  ]);
});

test("RECON-04: soft-fail per-entry -- failed mp row mixed with successful install row routes to error + summary prepended", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "flaky-mp",
        scope: "user",
        status: "failed",
        severity: "error",
        needsReload: false,
        reasons: ["network unreachable"],
        plugins: [],
      },
      {
        name: "ok-mp",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "ok-plugin",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `A marketplace operation has failed.\n\n⊘ flaky-mp [user] (failed) {network unreachable}\n\n● ok-mp [user] (added)\n  ● ok-plugin (installed)\n\n/reload to pick up changes`,
  );
});

test("RECON-04: CFG-03 invalid-config row carries BASENAME only (T-55-02-01 information-disclosure mitigation)", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "claude-plugins.json",
        scope: "project",
        status: "failed",
        severity: "error",
        needsReload: false,
        reasons: ["invalid manifest"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx, run, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `A marketplace operation has failed.\n\n⊘ claude-plugins.json [project] (failed) {invalid manifest}`,
  );
});

test("SURF-05 / D-63-08: installed row renders `(installed) {orphan rewake}` via the existing reasons brace", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "helper",
            version: "1.0.0",
            dependencies: [],
            reasons: ["orphan rewake"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● official [user]\n  ● helper v1.0.0 (installed) {orphan rewake}\n\n/reload to pick up changes`,
  ]);
});

test("CLASS-01 / D-86-01: installed row renders `(installed) {malformed skill}` at warning severity", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "warning",
            needsReload: true,
            name: "helper",
            version: "1.0.0",
            dependencies: [],
            reasons: ["malformed skill"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation needs attention.\n\n● official [user]\n  ● helper v1.0.0 (installed) {malformed skill}\n\n/reload to pick up changes`,
    "warning",
  ]);
});

test("notify renders a central remote row without inferred reasons", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "remote", name: "alpha", version: "sha-abcdef012345" }],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◌ alpha v#abcdef0 (remote)",
  ]);
});

test("notify counts a warning in a plural tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "cascade",
    cardinality: "plural",
    label: "Plugin update",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation needs attention.\n\n● official [user]\n  ⊘ alpha (skipped) {not installed}\n\nPlugin update: 1 warning",
    "warning",
  ]);
});

for (const { name, tally, expected } of [
  {
    name: "a positive override tally renders the supplied verb",
    tally: { verb: "updated", count: 2 },
    expected: "(no marketplaces)\n\nPlugin update: 2 updated",
  },
  {
    name: "a zero override tally contributes no line",
    tally: { verb: "updated", count: 0 },
    expected: "(no marketplaces)",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const message = {
      kind: "cascade",
      cardinality: "plural",
      label: "Plugin update",
      tally,
      marketplaces: [],
    } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("an empty default plural cascade emits only its sentinel", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "cascade",
    cardinality: "plural",
    label: "Marketplace list",
    marketplaces: [],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
});

test("a marketplace-level reload stamp emits the trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
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
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] (added)\n\n/reload to pick up changes",
  ]);
});

test("marketplace info renders complete URL-source fields", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "marketplace-info",
    name: "remote-mp",
    scope: "user",
    details: { autoupdate: true, lastUpdatedAt: "2026-08-29T12:00:00Z" },
    source: { sourceKind: "url", url: "https://example.test/repo.git", ref: "main" },
    description: "Remote marketplace",
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● remote-mp [user] <autoupdate>\nurl: https://example.test/repo.git#main\nlast_updated: 2026-08-29T12:00:00Z\ndescription: Remote marketplace",
  ]);
});

for (const { name, plugin, expected } of [
  {
    name: "plugin info renders a partially-installed row",
    plugin: {
      status: "partially-installed",
      name: "alpha",
      version: "1.0.0",
      reasons: ["lsp"],
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ◉ alpha v1.0.0 (partially-installed) {lsp}\n    components: not resolved",
  },
  {
    name: "plugin info renders a disabled row",
    plugin: {
      status: "disabled",
      name: "alpha",
      version: "1.0.0",
      reasons: ["not in manifest"],
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ◍ alpha v1.0.0 (disabled) {not in manifest}\n    components: not resolved",
  },
  {
    name: "plugin info renders a remote row",
    plugin: {
      status: "remote",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ◌ alpha v1.0.0 (remote)\n    components: not resolved",
  },
  {
    name: "plugin info renders a partially-available row",
    plugin: {
      status: "partially-available",
      name: "alpha",
      version: "1.0.0",
      reasons: ["lsp"],
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ⊖ alpha v1.0.0 (partially-available) {lsp}\n    components: not resolved",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const message = {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin,
    } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

for (const { command, expected } of [
  { command: "pending", expected: "Pending: /claude:plugin apply has nothing to change." },
  { command: "apply", expected: "Apply: nothing to change." },
] as const) {
  test(`D-08 / D-14: reconcile-pending-empty emits the exact ${command} advisory`, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const message = {
      kind: "reconcile-pending-empty",
      command,
      retainedWorkflows: [],
    } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });

  test(`WR-06: the retained-workflow advisory folds under the ${command} advisory`, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const message = {
      kind: "reconcile-pending-empty",
      command,
      advisories: ["Retained staging tree."],
    } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
      `${expected}\n\nRetained staging tree.`,
    ]);
  });
}

for (const scope of ["user", "project"] as const) {
  test(`prune-empty emits the scoped informational sentence for ${scope}`, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const message = { kind: "prune-empty", scope } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [[`Nothing to prune in ${scope} scope: no orphaned dependency installs were found.`]],
    );
  });
}

test("prune-committed-warning reports a saved scope and requests reload", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "prune-committed-warning",
    scope: "project",
    cause: new Error("lock release failed after save"),
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "Prune committed; finalization needs attention.\n\n" +
          "Prune committed in project scope.\n" +
          "  cause: lock release failed after save\n\n" +
          "/reload to pick up changes",
        "warning",
      ],
    ],
  );
});

test("context emission renders the disabled enable hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();

  const message = {
    kind: "cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "alpha",
            version: "1.0.0",
            enableHint: true,
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies Parameters<typeof emitContextCascade>[2];

  // act
  emitContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◍ alpha v1.0.0 (disabled)\n    Run enable on this plugin to use its components.",
  ]);
});

test("reconcile applied summarizes mixed failed subjects", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        severity: "error",
        needsReload: false,
        reasons: ["network unreachable"],
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not found"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations have failed.\n\n⊘ official [user] (failed) {network unreachable}\n  ⊘ alpha (failed) {not found}",
    "error",
  ]);
});

for (const { name, message, expected } of [
  {
    name: "context emission suppresses reload for marketplace info envelopes",
    message: { kind: "marketplace-info", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for plugin info envelopes",
    message: {
      kind: "plugin-info",
      plugin: { status: "available" },
      marketplaces: [],
    },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for marketplace info cascades",
    message: { kind: "marketplace-info-cascade", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for plugin info cascades",
    message: { kind: "plugin-info-cascade", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for absent marketplace envelopes",
    message: { kind: "marketplace-not-added", marketplaces: [] },
    expected: ["A marketplace operation has failed.\n\n(no marketplaces)", "error"],
  },
  {
    name: "context emission suppresses reload for pending-empty envelopes",
    message: { kind: "reconcile-pending-empty", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for reconcile-applied envelopes",
    message: { kind: "reconcile-applied-cascade", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();

    // act
    emitContextCascade(ctx, run, message as never, CENTRAL_ROW_POLICY);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, expected);
  });
}

test("a list-surface marketplace with autoupdate disabled omits the marker", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        details: { autoupdate: false },
        plugins: [],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["● official [user]"]);
});

test("a warning reconcile cascade summarizes a marketplace subject", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "skipped",
        reasons: ["already installed"],
        severity: "warning",
        needsReload: false,
        plugins: [],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation needs attention.\n\n● official [user] (skipped) {already installed}",
    "warning",
  ]);
});

test("a non-failed plugin fallback preserves the empty standalone summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  let statusIndex = 0;
  // The envelope reads the status before the body does (presentation read order).
  const statuses = ["failed", "available", "available", "available"] as const;
  const plugin = Object.defineProperty({ name: "alpha", componentsResolved: false }, "status", {
    enumerable: true,
    get() {
      const status = statuses[Math.min(statusIndex, statuses.length - 1)]!;
      statusIndex++;
      return status;
    },
  });
  const message = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin,
  };

  // act
  notify(ctx, run, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "\n\n● official [user] <no autoupdate>\n  ○ alpha (available)\n    components: not resolved",
    "error",
  ]);
});

test("a defined empty cause does not add an indented cause trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not found"],
            severity: "error",
            needsReload: false,
            cause: null,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx, run, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}",
    "error",
  ]);
});

test("a URL marketplace without a ref omits the fragment suffix", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: false },
    source: { sourceKind: "url", url: "https://example.com/marketplace.git" },
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] <no autoupdate>\nurl: https://example.com/marketplace.git",
  ]);
});

test("an absent marketplace without a scope omits the scope bracket", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "marketplace-not-added",
    name: "official",
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ official (failed) {marketplace not added}",
    "error",
  ]);
});

for (const { scope, expectedReason } of [
  { scope: "user", expectedReason: "marketplace not added to user scope" },
  { scope: "project", expectedReason: "marketplace not added to project scope" },
] as const) {
  test(`an absent marketplace present in the other scope names the ${scope} scope that missed`, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const message = {
      kind: "marketplace-not-added",
      name: "official",
      scope,
      presentInOtherScope: true,
    } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
      `A marketplace operation has failed.\n\n⊘ official [${scope}] (failed) {${expectedReason}}`,
      "error",
    ]);
  });
}

test("an absent marketplace claiming a sibling scope with no bracket keeps the plain token", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "marketplace-not-added",
    name: "official",
    presentInOtherScope: true,
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ official (failed) {marketplace not added}",
    "error",
  ]);
});

test("an empty applied reconcile cascade renders the empty sentinel", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
});

test("a failed stale-gate row emits its dedicated recovery trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["lsp"],
            severity: "error",
            needsReload: false,
            partialHint: true,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {lsp}\n    Run update --partial on this plugin, then enable it again.",
    "error",
  ]);
});

test("the central disabled arm preserves a caller-stamped reason", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "alpha",
            version: "1.0.0",
            reasons: ["not in manifest"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◍ alpha v1.0.0 (disabled) {not in manifest}",
  ]);
});

for (const { name, plugin, expected } of [
  {
    name: "the central available arm omits a reason that no central producer stamps",
    plugin: {
      status: "available",
      name: "alpha",
      version: "1.0.0",
      reasons: ["installs disabled"],
    },
    expected: "● official [user]\n  ○ alpha v1.0.0 (available)",
  },
  {
    name: "the central remote arm omits a reason that no central producer stamps",
    plugin: {
      status: "remote",
      name: "alpha",
      version: "1.0.0",
      reasons: ["installs disabled"],
    },
    expected: "● official [user]\n  ◌ alpha v1.0.0 (remote)",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const message = {
      marketplaces: [{ name: "official", scope: "user", plugins: [plugin] }],
    } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

for (const { name, reasons, expected } of [
  {
    name: "plugin info preserves a stamped reason on an available row",
    reasons: ["installs disabled"],
    expected:
      "● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available) {installs disabled}\n    components: not resolved",
  },
  {
    name: "plugin info omits the reasons brace when reasons are absent",
    reasons: undefined,
    expected:
      "● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)\n    components: not resolved",
  },
  {
    name: "plugin info omits the reasons brace when reasons are empty",
    reasons: [],
    expected:
      "● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)\n    components: not resolved",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const run = runWithAllLoaded();
    const plugin = {
      status: "available",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: false,
      ...(reasons === undefined ? {} : { reasons }),
    } satisfies PluginInfoRow;
    const message = {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin,
    } satisfies NotificationMessage;

    // act
    notify(ctx, run, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("a single-target label remains inert without plural cardinality", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    label: "Plugin uninstall",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not installed"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not installed}",
    "error",
  ]);
});

for (const mode of ["json", "rpc"]) {
  test(`appends a redacted diagnostic through the parent run in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    notifyDiagnostic(ctx, run, "import of https://user:tok@host/o/r skipped:", [
      "x-access-token:abc123 rejected",
      "plain line",
    ]);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "diagnostic",
          severity: "warning",
          needsReload: false,
          header: "import of https://***@host/o/r skipped:",
          lines: ["x-access-token:*** rejected", "plain line"],
        },
      },
    ]);
    capture.assertValid();
  });
}

for (const mode of ["json", "rpc"]) {
  for (const { name, lines, expected } of [
    { name: "no lines", lines: [], expected: [] },
    {
      name: "one empty line",
      lines: [""],
      expected: [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "diagnostic",
            severity: "warning",
            needsReload: false,
            header: "Warnings",
            lines: [""],
          },
        },
      ],
    },
    {
      name: "whitespace",
      lines: [" \t "],
      expected: [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "diagnostic",
            severity: "warning",
            needsReload: false,
            header: "Warnings",
            lines: [" \t "],
          },
        },
      ],
    },
    {
      name: "ordered duplicates",
      lines: ["second", "first", "first", "second"],
      expected: [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "diagnostic",
            severity: "warning",
            needsReload: false,
            header: "Warnings",
            lines: ["second", "first", "first", "second"],
          },
        },
      ],
    },
  ]) {
    test(`preserves diagnostic ${name} in ${mode}`, () => {
      // arrange
      const capture = createJsonCapture();
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };
      const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

      // act
      notifyDiagnostic(ctx, run, "Warnings", lines);

      // assert
      assert.deepStrictEqual(capture.entries, expected);
      capture.assertValid();
    });
  }
}

test("empty diagnostics do not read a stale mode getter", () => {
  // arrange
  const capture = createJsonCapture();
  const ctx = {
    get mode(): string {
      throw new Error("stale mode");
    },
    get ui() {
      return capture.ui;
    },
  };
  const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

  // act
  notifyDiagnostic(ctx, run, "Warnings", []);

  // assert
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

test("diagnostic dispatch preserves empty and ordered warning captures", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyDiagnostic(ctx, runWithNothingLoaded(), "Warnings", []);
  notifyDiagnostic(ctx, runWithNothingLoaded(), "Warnings", ["first", "second"]);

  // assert
  assert.equal(ctx.ui.notify.mock.callCount(), 1);
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Warnings\n\nfirst\nsecond",
    "warning",
  ]);
});

test("async rewake dispatch preserves empty and repeated input behavior", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyAsyncRewakeSummary(ctx, runWithNothingLoaded(), "");
  notifyAsyncRewakeSummary(ctx, runWithNothingLoaded(), "ready");
  notifyAsyncRewakeSummary(ctx, runWithNothingLoaded(), "ready");

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      ["ready", "info"],
      ["ready", "info"],
    ],
  );
});

for (const mode of ["json", "rpc"]) {
  test(`rewake dispatch preserves whitespace and duplicates in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    notifyAsyncRewakeSummary(ctx, run, "");
    notifyAsyncRewakeSummary(ctx, run, " \n");
    notifyAsyncRewakeSummary(ctx, run, " \n");

    // assert
    const expectedEntry = {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "async-rewake-summary",
        severity: "info",
        needsReload: false,
        text: " \n",
      },
    };
    assert.deepStrictEqual(capture.entries, [expectedEntry, expectedEntry]);
    capture.assertValid();
  });
}

test("empty rewake does not read mode or sink", () => {
  // arrange
  const capture = createJsonCapture();
  const ctx = {
    get mode(): string {
      throw new Error("stale mode");
    },
    get ui() {
      return capture.ui;
    },
  };
  const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

  // act
  notifyAsyncRewakeSummary(ctx, run, "");

  // assert
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

test("stop override dispatch preserves exact warning bytes", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyStopHookOverrideCap(ctx, runWithNothingLoaded(), "official:guard", 8);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Stop hook override cap reached.\n\n`official:guard`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
    "warning",
  ]);
});

for (const mode of ["json", "rpc"]) {
  test(`Stop cap dispatch appends the complete warning in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    notifyStopHookOverrideCap(ctx, run, "official:guard", 8);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "stop-override-cap",
          severity: "warning",
          needsReload: false,
          pluginId: "official:guard",
          cap: 8,
        },
      },
    ]);
    capture.assertValid();
  });
}

test("AFILE-04: an empty MCP config notice list sends nothing", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx, runWithNothingLoaded(), []);

  // assert
  assert.equal(ctx.ui.notify.mock.callCount(), 0);
});

test("AFILE-04: notices of every kind send one warning per kind in section order", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx, runWithNothingLoaded(), [
    {
      kind: "leftover-removed",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
    },
    {
      kind: "tool-rules-unenforced",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["toolPermissions"],
    },
    {
      kind: "credentials-blanked",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["ANTHROPIC_API_KEY"],
    },
    {
      kind: "variables-missing",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    },
    {
      kind: "override-kept",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["env"],
    },
    { kind: "left-unchanged", scope: "user", file: "mcp.json" },
    { kind: "comments-dropped", scope: "user", file: "mcp.json" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config comments removed.\n\nThe user-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        "warning",
      ],
      [
        "MCP config left unchanged.\n\nThe user-scope mcp.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
        "warning",
      ],
      [
        'MCP server override kept.\n\nhello now provides "plugin_hello_srv_" in the user-scope mcp-adapter.json. Your override for "plugin_hello_srv_" is kept, but these fields of it stop applying: env. It comes back when you uninstall or disable hello.',
        "warning",
      ],
      [
        'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the user-scope mcp-adapter.json uses environment variables that were not set at install: DD_SITE.',
        "warning",
      ],
      [
        'MCP server credentials withheld.\n\nServer "plugin_hello_srv_" from hello in the user-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
        "warning",
      ],
      [
        'MCP server tool rules not enforced.\n\nServer "plugin_hello_srv_" from hello in the user-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: toolPermissions. Its tools run without these rules.',
        "warning",
      ],
      [
        'Old MCP server settings removed.\n\nRemoved "srv" from the user-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
        "warning",
      ],
    ],
  );
});

for (const mode of ["json", "rpc"]) {
  test(`AFILE-04: MCP config notices append one mcp-config-notices entry per section in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    notifyMcpConfigNotices(ctx, run, [
      { kind: "left-unchanged", scope: "user", file: "mcp.json" },
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
    ]);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          severity: "warning",
          needsReload: false,
          kind: "mcp-config-notices",
          notices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
        },
      },
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          severity: "warning",
          needsReload: false,
          kind: "mcp-config-notices",
          notices: [{ kind: "left-unchanged", scope: "user", file: "mcp.json" }],
        },
      },
    ]);
    assert.deepStrictEqual(run.commandState, {
      hasOutcome: false,
      needsReload: false,
      settled: false,
      delivery: "open",
    });
    capture.assertValid();
  });
}

test("AMIG-03: a report with no row and no notice sends nothing", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpMigration(ctx, runWithNothingLoaded(), { rows: [], notices: [] });

  // assert
  assert.equal(ctx.ui.notify.mock.callCount(), 0);
});

test("AMIG-03: a report with notices but no row sends each notice section as its own warning", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpMigration(ctx, runWithNothingLoaded(), {
    rows: [],
    notices: [
      {
        kind: "variables-missing",
        scope: "user",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_srv_",
        names: ["DD_SITE"],
      },
    ],
  });

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the user-scope mcp-adapter.json uses environment variables that were not set at install: DD_SITE.',
        "warning",
      ],
    ],
  );
});

test("AMIG-03: a report with rows sends one notice with the reload hint at its severity", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpMigration(ctx, runWithNothingLoaded(), {
    rows: [
      {
        kind: "removed",
        scope: "project",
        plugin: "hello",
        marketplace: "mp",
        server: "gone",
        cause: "not-declared",
      },
    ],
    notices: [],
  });

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "Plugin MCP servers removed from mcp.json.\n\nRemoved from mcp.json:\n  gone (hello) [project] hello no longer declares it.\n/reload to pick up changes",
        "info",
      ],
    ],
  );
});

for (const mode of ["json", "rpc"]) {
  test(`AMIG-03: a migration report appends one load-origin mcp-migration entry in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const run: NotificationRun = {
      origin: { kind: "load" },
      softDeps: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
      entrySink: capture.entrySink,
    };

    // act
    notifyMcpMigration(ctx, run, {
      rows: [
        { kind: "stopped", scope: "user", detail: "state.json is locked" },
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          from: "srv",
          to: "plugin_acme_srv_",
        },
      ],
      notices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
    });

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          kind: "mcp-migration",
          origin: { kind: "load" },
          severity: "warning",
          needsReload: true,
          rows: [
            {
              kind: "moved",
              scope: "project",
              plugin: "acme",
              marketplace: "mp",
              from: "srv",
              to: "plugin_acme_srv_",
            },
            { kind: "stopped", scope: "user", detail: "state.json is locked" },
          ],
          notices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
        },
      },
    ]);
    capture.assertValid();
  });
}

test("PMOD-04: a credential in a server name and a migration detail is redacted in text and JSON", (t) => {
  // arrange
  const ctx = createContext(t);
  const capture = createJsonCapture();
  const jsonContext = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };
  const report = {
    rows: [
      {
        kind: "unfinished",
        scope: "user",
        plugin: "hello",
        marketplace: "mp",
        servers: ["https://u:tok@h/srv"],
        file: "mcp.json",
        detail: "write https://u:tok@h/d failed",
      },
    ],
    notices: [],
  } as const;

  // act
  notifyMcpMigration(ctx, runWithNothingLoaded(), report);
  notifyMcpMigration(
    jsonContext,
    { ...runWithNothingLoaded(), entrySink: capture.entrySink },
    report,
  );

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "Plugin MCP servers in mcp.json need attention.\n\nLeft in mcp.json:\n  https://***@h/srv (hello) [user] The new entries are written, but mcp.json could not be updated: write https://***@h/d failed. The next /reload finishes the move.",
        "warning",
      ],
    ],
  );
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        kind: "mcp-migration",
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        severity: "warning",
        needsReload: false,
        rows: [
          {
            kind: "unfinished",
            scope: "user",
            plugin: "hello",
            marketplace: "mp",
            servers: ["https://***@h/srv"],
            file: "mcp.json",
            detail: "write https://***@h/d failed",
          },
        ],
        notices: [],
      },
    },
  ]);
  capture.assertValid();
});

test("usage info dispatch preserves usage message at info severity", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyUsageInfo(ctx, runWithNothingLoaded(), "Usage: /claude:plugin ...");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Usage: /claude:plugin ...",
    "info",
  ]);
});

test("AAP-04: autoapply status dispatch renders the effective value at info severity", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyAutoapplyStatus(ctx, runWithNothingLoaded(), {
    kind: "autoapply-status",
    enabled: false,
    files: [{ scope: "user", file: "claude-plugins.json" }],
  });

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Autoapply: off (default)\n\nclaude-plugins.json [user]: not set",
    "info",
  ]);
});

test("notifyReconcileAborted emits the serialized cause at error severity", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyReconcileAborted(ctx, runWithNothingLoaded(), new Error("boom"));

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [["reconcile aborted: boom", "error"]],
  );
});

for (const mode of ["json", "rpc"]) {
  test(`load warnings append complete entries through the same run in ${mode}`, () => {
    // arrange
    const capture = createJsonCapture();
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    notifyReconcileAborted(ctx, run, new Error("state unreadable"));
    notifyPluginPathSkipped(ctx, run, "project", "EACCES");

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "reconcile-aborted",
          severity: "error",
          needsReload: false,
          causeMessage: "state unreadable",
        },
      },
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "plugin-path-skipped",
          severity: "warning",
          needsReload: false,
          scope: "project",
          reason: "EACCES",
        },
      },
    ]);
    capture.assertValid();
  });
}

test("notifyPluginPathSkipped emits the skipped scope and reason at warning severity", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyPluginPathSkipped(ctx, runWithNothingLoaded(), "project", "schema unsupported");

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "plugin PATH not refreshed for project scope (install state unreadable): schema unsupported",
        "warning",
      ],
    ],
  );
});

test("retains a caught invalid device prompt append for final validation", () => {
  // arrange
  const capture = createJsonCapture();
  const ctx = {
    mode: "rpc",
    get ui() {
      return capture.ui;
    },
  };
  const run = {
    ...runWithNothingLoaded(),
    entrySink: {
      appendEntry(customType: string, payload: unknown) {
        assert.ok(typeof payload === "object" && payload !== null);
        try {
          capture.entrySink.appendEntry(customType, { ...payload, accessToken: "forbidden-token" });
        } catch {
          throw new Error("Invalid payload.");
        }
      },
    },
  };

  // act
  notifyDeviceFlowPrompt(ctx, run, {
    verificationUri: "https://github.com/login/device",
    userCode: "BAD-1234",
  });

  // assert
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "device-flow-prompt",
        severity: "info",
        needsReload: false,
        verificationUri: "https://github.com/login/device",
        userCode: "BAD-1234",
        accessToken: "forbidden-token",
      },
    },
    {
      customType: "claude-plugin",
      payload: { ...faultError("Invalid payload.").payload, accessToken: "forbidden-token" },
    },
  ]);
  assert.throws(() => {
    capture.assertValid();
  }, assert.AssertionError);
});

test("notifyDeviceFlowPrompt emits the verification URI and user code at info severity", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyDeviceFlowPrompt(ctx, runWithNothingLoaded(), {
    verificationUri: "https://github.com/login/device",
    userCode: "ABCD-1234",
  });

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [["Open https://github.com/login/device and enter: ABCD-1234", "info"]],
  );
});

test("context dispatch preserves ordered rows and stamped reload hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();

  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            name: "first",
            status: "installed",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
          {
            name: "second",
            status: "available",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ● first (installed)\n  ○ second (available)\n\n/reload to pick up changes",
  ]);
});

test("context dispatch preserves the success tally and reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();

  const message = {
    kind: "cascade",
    cardinality: "plural",
    label: "Plugin install",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ● alpha (installed)\n\nPlugin install: 1 success\n\n/reload to pick up changes",
  ]);
});

test("D-12: context dispatch composes each row's markers under the caller's marker policy", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithNothingLoaded();

  const message = {
    marketplaces: [
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
          {
            status: "reinstalled",
            name: "beta",
            dependencies: ["mcp"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx, run, message, {
    installed: { markers: true, contentReasons: true },
    reinstalled: { markers: false, contentReasons: true },
  });

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ● alpha (installed) {requires pi-subagents}\n  ● beta (reinstalled)",
  ]);
});

test("context dispatch keeps independent parallel captures", async (t) => {
  // arrange
  const first = createContext(t);
  const second = createContext(t);
  const run = runWithAllLoaded();

  const message = { marketplaces: [] } satisfies CascadeNotificationMessage;

  // act
  await Promise.all([
    Promise.resolve().then(() => {
      emitContextCascade(first, run, message, CENTRAL_ROW_POLICY);
    }),
    Promise.resolve().then(() => {
      emitContextCascade(second, run, message, CENTRAL_ROW_POLICY);
    }),
  ]);

  // assert
  assert.deepStrictEqual(first.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
  assert.deepStrictEqual(second.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
});

test("update no-op dispatch preserves empty and non-empty folds", (t) => {
  // arrange
  const empty = createContext(t);
  const nonEmpty = createContext(t);
  const run = runWithAllLoaded();

  const emptyMessage = { marketplaces: [] } satisfies CascadeNotificationMessage;
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            name: "alpha",
            status: "available",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitUpdateNoOpCascade(empty, run, emptyMessage, CENTRAL_ROW_POLICY);
  emitUpdateNoOpCascade(nonEmpty, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(empty.ui.notify.mock.calls[0]!.arguments, [
    "Plugin update: nothing to update",
  ]);
  assert.deepStrictEqual(nonEmpty.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ○ alpha (available)\n\nPlugin update: nothing to update",
  ]);
});

test("reconcile context dispatch keeps its tally and omits reload", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();

  const message = {
    kind: "reconcile-applied-cascade",
    cardinality: "plural",
    label: "Reconcile",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "added",
        severity: "info",
        needsReload: false,
        plugins: [],
      },
    ],
  } as const;

  // act
  emitReconcileAppliedContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] (added)\n\nReconcile: 1 success",
  ]);
});

test("reconcile context dispatch of a failed row omits reload and stamps error severity", (t) => {
  // arrange
  // D-08: a failed row changed nothing the session must load, so it stamps no
  // reload. The standalone `notify()` arm is gated in
  // test/architecture/notify-grammar-invariant.test.ts; production reaches this
  // emitter from shared/notify-context.ts, so the missing trailer, the failure
  // tally, and the stamped severity argument are pinned here.
  const ctx = createContext(t);
  const run = runWithAllLoaded();

  const message = {
    kind: "reconcile-applied-cascade",
    cardinality: "plural",
    label: "Reconcile",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not found"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies Parameters<typeof emitReconcileAppliedContextCascade>[2];

  // act
  emitReconcileAppliedContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}\n\nReconcile: 1 failure",
    "error",
  ]);
});

/*
 * Summary delivery through the public entry points.
 *
 * The seam that prepends the summary line is module-private, so each case below
 * drives it from the path production uses. The assertion is therefore the
 * complete emitted string and the exact notify argument list, not a body the
 * test handed in.
 */

test("a mixed actionable-skip cascade emits the plural attention summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "skipped",
        severity: "warning",
        reasons: ["not found"],
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
  emitContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations need attention.\n\n● official [user] (skipped) {not found}\n  ⊘ alpha (skipped) {not installed}",
    "warning",
  ]);
});

test("a marketplace-only failure cascade emits the marketplace failure summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    marketplaces: [
      { name: "official", scope: "user", status: "failed", severity: "error", plugins: [] },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ official [user] (failed)",
    "error",
  ]);
});

test("an unstamped cascade plugin defaults to info severity and a success tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    cardinality: "plural",
    label: "Plugin list",
    marketplaces: [
      { name: "official", scope: "user", plugins: [{ name: "alpha", status: "available" }] },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx, run, message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ○ alpha (available)\n\nPlugin list: 1 success",
  ]);
});

test("an applied reconcile with a failed plugin emits the plural failure summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        severity: "error",
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
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations have failed.\n\n⊘ official [user] (failed)\n  ⊘ alpha (failed) {not found}",
    "error",
  ]);
});

test("an applied reconcile with only a skipped marketplace emits the marketplace attention summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const run = runWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      { name: "official", scope: "user", status: "skipped", severity: "warning", plugins: [] },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx, run, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation needs attention.\n\n● official [user] (skipped)",
    "warning",
  ]);
});
