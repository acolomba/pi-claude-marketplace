import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCommand } from "../../extensions/pi-claude-marketplace/edge/command-run.ts";
import { UnsupportedModeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  notify,
  notifyUsageInfo,
  notifyDiagnostic,
  notifyDeviceFlowPrompt,
} from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { openNotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

import { createJsonCapture } from "./json-capture.ts";

import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  CommandRunState,
  NotificationRun,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

for (const mode of ["json", "rpc"]) {
  test(`construction failure shares terminal delivery and settlement state in ${mode}`, async () => {
    // arrange
    const attempts: object[] = [];
    let state: CommandRunState | undefined;
    const pi = {
      getAllTools: (): never => {
        throw new Error("Inventory failed.");
      },
      getCommands: (): never => {
        throw new Error("Inventory failed.");
      },
      appendEntry(customType: string, payload: unknown): never {
        assert.strictEqual(this, pi);
        attempts.push({ customType, payload });
        throw new Error("Append failed.");
      },
    };
    const ctx = {
      mode,
      get ui(): never {
        throw new Error("Unexpected UI");
      },
    };

    // act
    await runCommand(
      pi,
      ctx,
      "plugin update",
      () => {
        throw new Error("Unexpected handler");
      },
      {
        ...createIds(),
        openRun: (inventory, _origin, commandState) => {
          state = commandState;
          inventory.getAllTools();
          throw new Error("Unexpected inventory success");
        },
      },
    );

    // assert
    assert.deepStrictEqual(attempts, [
      expectedError("Inventory failed."),
      expectedError("Append failed."),
    ]);
    assert.deepStrictEqual(state, {
      hasOutcome: false,
      needsReload: false,
      settled: true,
      delivery: "closed",
    });
  });
}

test("retains committed local state and earlier output after a command throws", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-partial-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const store = path.join(directory, "state.json");
  await writeFile(store, '{"installed":false}');
  const capture = createJsonCapture();
  const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };

  // act
  await runCommand(
    pi,
    ctx,
    "plugin update",
    async (run) => {
      await writeFile(store, '{"installed":true}');
      notifyUsageInfo(ctx, run, "Committed.");
      throw new Error("Later work failed.");
    },
    createIds(),
  );

  // assert
  assert.strictEqual(await readFile(store, "utf8"), '{"installed":true}');
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        kind: "usage-info",
        severity: "info",
        needsReload: false,
        origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
        usage: "Committed.",
      },
    },
    expectedError("Later work failed."),
  ]);
  capture.assertValid();
});

for (const { start, finish } of [
  { start: "tui", finish: "json" },
  { start: "print", finish: "rpc" },
]) {
  test(`delivers the error using live ${finish} after starting in ${start}`, async () => {
    // arrange
    const capture = createJsonCapture();
    const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
    const ctx = {
      mode: start,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await runCommand(
      pi,
      ctx,
      "plugin update",
      () => {
        ctx.mode = finish;
        return Promise.reject(new Error("failed"));
      },
      createIds(),
    );

    // assert
    assert.deepStrictEqual(capture.entries, [expectedError("failed")]);
    capture.assertValid();
  });
}

for (const { start, finish } of [
  { start: "json", finish: "tui" },
  { start: "rpc", finish: "print" },
]) {
  test(`preserves the original throw using live ${finish} after starting in ${start}`, async () => {
    // arrange
    const capture = createJsonCapture();
    const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
    const ctx = {
      mode: start,
      get ui() {
        return capture.ui;
      },
    };
    const failure = new Error("failed");

    // act & assert
    await assert.rejects(
      runCommand(
        pi,
        ctx,
        "plugin update",
        () => {
          ctx.mode = finish;
          return Promise.reject(failure);
        },
        createIds(),
      ),
      (error: unknown) => error === failure,
    );
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
  });
}

function createIds() {
  return {
    createInvocationId: () => "run-a",
    createRecoveryId: () => "recovery-a",
    openRun: openNotificationRun,
  };
}

for (const directoryName of [
  "'Confidential Client'",
  "O'Connor",
  "\nConfidential Client",
  "<Confidential Client>",
  '"Confidential Client"',
  "`Confidential Client`",
  "\r\nConfidential Client",
]) {
  for (const mode of ["json", "rpc"]) {
    test(`omits real filesystem details for ${JSON.stringify(directoryName)} in ${mode}`, async (t) => {
      // arrange
      const directory = await mkdtemp(path.join(tmpdir(), "command-missing-path-"));
      t.after(async () => {
        await rm(directory, { recursive: true, force: true });
      });
      const absentFile = path.join(directory, "missing", directoryName, "secret.json");
      const capture = createJsonCapture();
      const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };

      // act
      await runCommand(
        pi,
        ctx,
        "plugin update",
        async () => {
          await readFile(absentFile);
        },
        createIds(),
      );

      // assert
      assert.deepStrictEqual(capture.entries, [expectedError("Command failure details omitted.")]);
      assert.strictEqual(JSON.stringify(capture.entries).includes("Confidential Client"), false);
      assert.strictEqual(JSON.stringify(capture.entries).includes("Connor"), false);
      capture.assertValid();
    });
  }
}

for (const { message, safeMessage, disclosure } of [
  ...[
    "\\",
    "D:\\",
    "D:/",
    "\\\\host\\share\\",
    "\\\\?\\UNC\\host\\share\\",
    "\\\\?\\D:\\",
    "/",
    "//host/share/",
  ].flatMap((root) => [
    {
      message: `ENOENT: open '${root}Users\\ClientLedger\\secret.json'`,
      safeMessage: "ENOENT: open '[path]'",
      disclosure: "ClientLedger",
    },
    {
      message: `failed at:${root}PrivateVault`,
      safeMessage: "failed at:[path]",
      disclosure: "PrivateVault",
    },
    {
      message: `ENOENT: open '${root}O'ClientLedger\\secret.json'`,
      safeMessage: "Command failure details omitted.",
      disclosure: "ClientLedger",
    },
    {
      message: `ENOENT: open '${root}\nClientLedger\\secret.json'`,
      safeMessage: "Command failure details omitted.",
      disclosure: "ClientLedger",
    },
    {
      message: `failed at:${root}<ClientLedger>\\secret.json`,
      safeMessage: "Command failure details omitted.",
      disclosure: "ClientLedger",
    },
  ]),
  {
    message: "failed at /Users/<Confidential Client>/secret.json",
    safeMessage: "Command failure details omitted.",
    disclosure: "Confidential Client",
  },
  {
    message: 'ENOENT: open "/Private Data/client/secret.json"',
    safeMessage: 'ENOENT: open "[path]"',
    disclosure: "Private Data",
  },
  {
    message: 'ENOENT: open "/用户/秘密/config.json"',
    safeMessage: 'ENOENT: open "[path]"',
    disclosure: "秘密",
  },
  {
    message: 'ENOENT: open "C:\\Private Data\\client\\secret.json"',
    safeMessage: 'ENOENT: open "[path]"',
    disclosure: "Private Data",
  },
  {
    message: "failed at:/private/work/config.json",
    safeMessage: "failed at:[path]",
    disclosure: "private/work",
  },
]) {
  for (const mode of ["json", "rpc"]) {
    test(`hides ${message} at the ${mode} command boundary`, async () => {
      // arrange
      const capture = createJsonCapture();
      const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };

      // act
      await runCommand(
        pi,
        ctx,
        "plugin update",
        () => {
          throw new Error(message);
        },
        createIds(),
      );

      // assert
      assert.deepStrictEqual(capture.entries, [expectedError(safeMessage)]);
      assert.strictEqual(JSON.stringify(capture.entries).includes(disclosure), false);
      capture.assertValid();
    });
  }
}

for (const mode of ["json", "rpc"]) {
  test(`reports a silent command before settlement in ${mode}`, async () => {
    // arrange
    const capture = createJsonCapture();
    const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await runCommand(pi, ctx, "plugin update", async () => {}, createIds());

    // assert
    assert.deepStrictEqual(capture.entries, [
      expectedError("Command returned without an outcome."),
    ]);
    capture.assertValid();
  });
}

for (const { title, cause, message } of [
  { title: "null", cause: null, message: "Unknown thrown value." },
  { title: "undefined", cause: undefined, message: "Unknown thrown value." },
  { title: "string", cause: "failed string", message: "failed string" },
  { title: "object", cause: { secret: "private" }, message: "[object Object]" },
]) {
  for (const mode of ["json", "rpc"]) {
    test(`delivers a schema-valid error for thrown ${title} in ${mode}`, async () => {
      // arrange
      const capture = createJsonCapture();
      const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };

      // act
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exercises arbitrary thrown values at the command boundary
      await runCommand(pi, ctx, "plugin update", () => Promise.reject(cause), createIds());

      // assert
      assert.deepStrictEqual(capture.entries, [expectedError(message)]);
      capture.assertValid();
    });
  }

  for (const mode of ["tui", "print"]) {
    test(`preserves thrown ${title} identity in ${mode}`, async () => {
      // arrange
      const capture = createJsonCapture();
      const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };

      // act
      const completion = await runCommand(
        pi,
        ctx,
        "plugin update",
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- text must retain the original non-Error thrown value
        () => Promise.reject(cause),
        createIds(),
      ).then(
        () => ({ status: "fulfilled", cause: undefined }),
        (error: unknown) => ({ status: "rejected", cause: error }),
      );

      // assert
      assert.deepStrictEqual(completion, { status: "rejected", cause });
      assert.strictEqual(completion.cause, cause);
      assert.deepStrictEqual(capture.entries, []);
      capture.assertValid();
    });
  }
}

function expectedError(message: string, invocationId = "run-a", needsReload = false) {
  return {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      kind: "internal-error",
      origin: { kind: "command", commandId: "plugin update", invocationId },
      severity: "error",
      needsReload,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: [message], truncated: false },
    },
  };
}

for (const { failsTwice, expected } of [
  {
    failsTwice: false,
    expected: [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
          kind: "usage-info",
          severity: "info",
          needsReload: false,
          usage: "First.",
        },
      },
      expectedError("Append failed."),
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
          kind: "prune-committed-warning",
          severity: "warning",
          needsReload: true,
          scope: "user",
          summary: "Prune committed; finalization needs attention.",
          cause: { causeChain: ["Saved."], truncated: false },
        },
      },
      expectedError("Later failure.", "run-a", true),
    ],
  },
  {
    failsTwice: true,
    expected: [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
          kind: "usage-info",
          severity: "info",
          needsReload: false,
          usage: "First.",
        },
      },
      expectedError("Append failed."),
    ],
  },
]) {
  test(`settles after append recovery with terminal failure ${failsTwice}`, async (t) => {
    // arrange
    const attempts: Array<{ customType: string; payload: unknown }> = [];
    const pi = {
      getAllTools: () => [],
      getCommands: () => [],
      appendEntry(customType: string, payload: unknown) {
        assert.strictEqual(this, pi);
        attempts.push({ customType, payload });
        if (attempts.length === 1 || (failsTwice && attempts.length === 2)) {
          throw new Error("Append failed.");
        }
      },
    };
    const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      } else {
        process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
      }
    });
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
    t.mock.method(console, "error", () => {
      throw new Error("Logger failed.");
    });
    const ctx = {
      mode: "json",
      get ui(): never {
        throw new Error("Unexpected UI access");
      },
    };
    let late: () => void = () => {
      throw new Error("Missing callback");
    };

    // act
    await runCommand(
      pi,
      ctx,
      "plugin update",
      (run) => {
        late = () => {
          notifyUsageInfo(ctx, run, "Late.");
        };

        notifyUsageInfo(ctx, run, "First.");
        ctx.mode = "rpc";
        notify(ctx, run, {
          kind: "prune-committed-warning",
          scope: "user",
          cause: new Error("Saved."),
        });
        throw new Error("Later failure.");
      },
      createIds(),
    );
    const atSettlement = [...attempts];
    ctx.mode = "unusable";
    late();

    // assert
    assert.deepStrictEqual(atSettlement, expected);
    assert.deepStrictEqual(attempts, expected);
  });
}

test("does not retry or roll back committed work when its notification fails", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-transport-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const store = path.join(directory, "state.json");
  const events: string[] = [];
  const attempts: Array<{ customType: string; payload: unknown }> = [];
  const pi = {
    getAllTools: () => [],
    getCommands: () => [],
    appendEntry(customType: string, payload: unknown) {
      attempts.push({ customType, payload });
      if (attempts.length === 1) {
        throw new Error("Append failed.");
      }
    },
  };
  const ctx = {
    mode: "json",
    get ui(): never {
      throw new Error("Unexpected UI access");
    },
  };

  // act
  await runCommand(
    pi,
    ctx,
    "plugin update",
    async (run) => {
      events.push("execute");
      try {
        await writeFile(store, '{"installed":true}');
        events.push("committed");
        notifyUsageInfo(ctx, run, "Committed.");
      } catch {
        events.push("rollback");
        await writeFile(store, '{"installed":false}');
      }
    },
    createIds(),
  );

  // assert
  assert.strictEqual(await readFile(store, "utf8"), '{"installed":true}');
  assert.deepStrictEqual(events, ["execute", "committed"]);
  assert.deepStrictEqual(attempts, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
        kind: "usage-info",
        severity: "info",
        needsReload: false,
        usage: "Committed.",
      },
    },
    expectedError("Append failed."),
  ]);
});

for (const { name, emit, earlier } of [
  {
    name: "diagnostic",
    emit: (ctx, run) => {
      notifyDiagnostic(ctx, run, "Warning.", ["Detail."]);
    },
    earlier: [{ kind: "diagnostic", severity: "warning", header: "Warning.", lines: ["Detail."] }],
  },
  {
    name: "prompt",
    emit: (ctx, run) => {
      notifyDeviceFlowPrompt(ctx, run, {
        verificationUri: "https://example.test",
        userCode: "ABCD",
      });
    },
    earlier: [
      {
        kind: "device-flow-prompt",
        severity: "info",
        verificationUri: "https://example.test",
        userCode: "ABCD",
      },
    ],
  },
  {
    name: "empty diagnostic",
    emit: (ctx, run) => {
      notifyDiagnostic(ctx, run, "Warning.", []);
    },
    earlier: [],
  },
] satisfies Array<{
  name: string;
  emit: (ctx: NotificationContext, run: NotificationRun) => void;
  earlier: object[];
}>) {
  test(`does not accept ${name} as completion and suppresses retained output`, async () => {
    // arrange
    const capture = createJsonCapture();
    const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
    const ctx = {
      mode: "json",
      get ui() {
        return capture.ui;
      },
    };
    let late: () => void = () => {
      throw new Error("Callback not captured");
    };

    // act
    await runCommand(
      pi,
      ctx,
      "plugin update",
      (run) => {
        emit(ctx, run);
        late = () => {
          notifyUsageInfo(ctx, run, "Late.");
        };

        return Promise.resolve();
      },
      createIds(),
    );
    ctx.mode = "unusable";
    late();

    // assert
    assert.deepStrictEqual(capture.entries, [
      ...earlier.map((payload) => ({
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
          needsReload: false,
          ...payload,
        },
      })),
      expectedError("Command returned without an outcome."),
    ]);
    capture.assertValid();
  });
}

test("retains reload knowledge after a later false outcome and an escaped throw", async () => {
  // arrange
  const capture = createJsonCapture();
  const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };
  const origin = { kind: "command", commandId: "plugin update", invocationId: "run-a" };

  // act
  await runCommand(
    pi,
    ctx,
    "plugin update",
    (run) => {
      notify(ctx, run, {
        kind: "prune-committed-warning",
        scope: "user",
        cause: new Error("Saved."),
      });
      notify(ctx, run, { marketplaces: [] });
      throw new Error("Later failure.");
    },
    createIds(),
  );

  // assert
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin,
        kind: "prune-committed-warning",
        severity: "warning",
        needsReload: true,
        summary: "Prune committed; finalization needs attention.",
        scope: "user",
        cause: { causeChain: ["Saved."], truncated: false },
      },
    },
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin,
        kind: "cascade",
        severity: "info",
        needsReload: false,
        marketplaces: [],
      },
    },
    {
      ...expectedError("Later failure."),
      payload: { ...expectedError("Later failure.").payload, needsReload: true },
    },
  ]);
  capture.assertValid();
});

for (const mode of ["tui", "print"]) {
  test(`allows silent text completion in ${mode}`, async () => {
    // arrange
    const capture = createJsonCapture();
    const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await runCommand(pi, ctx, "plugin update", async () => {}, createIds());

    // assert
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
  });
}

test("does not finalize delivery that was already closed", async () => {
  // arrange
  const capture = createJsonCapture();
  const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
  const ctx = {
    get mode(): string {
      throw new Error("Unexpected mode access");
    },
    get ui() {
      return capture.ui;
    },
  };

  // act
  await runCommand(
    pi,
    ctx,
    "plugin update",
    (run) => {
      assert.ok(run.commandState);
      run.commandState.delivery = "closed";
      return Promise.resolve();
    },
    createIds(),
  );

  // assert
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

for (const mode of ["json", "rpc"]) {
  test(`delivers a handler failure through the original sink in ${mode}`, async () => {
    // arrange
    const capture = createJsonCapture();
    const events: string[] = [];
    const ids = {
      openRun: openNotificationRun,
      createInvocationId: () => {
        events.push("id");
        return "run-a";
      },
      createRecoveryId: () => {
        throw new Error("Unexpected recovery allocation");
      },
    };
    const pi = {
      getAllTools: () => {
        events.push("inventory");
        return [];
      },
      getCommands: () => {
        events.push("commands");
        return [];
      },
      appendEntry(customType: string, payload: unknown) {
        assert.strictEqual(this, pi);
        capture.entrySink.appendEntry(customType, payload);
        events.push("append");
      },
    };
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await runCommand(
      pi,
      ctx,
      "plugin update",
      () => {
        events.push("handler");
        return Promise.reject(new Error("failed"));
      },
      ids,
    );
    events.push("settled");

    // assert
    assert.deepStrictEqual(capture.entries, [expectedError("failed")]);
    assert.deepStrictEqual(events, [
      "id",
      "inventory",
      "commands",
      "inventory",
      "inventory",
      "handler",
      "append",
      "settled",
    ]);
    capture.assertValid();
  });

  test(`recovers identity once without probing or routing in ${mode}`, async () => {
    // arrange
    const capture = createJsonCapture();
    const events: string[] = [];
    const ids = {
      openRun: openNotificationRun,
      createInvocationId: () => {
        events.push("primary");
        throw new Error("ID failed");
      },
      createRecoveryId: () => {
        events.push("recovery");
        return "recovery-a";
      },
    };
    const pi = {
      ...capture.entrySink,
      getAllTools: () => {
        throw new Error("Unexpected inventory");
      },
      getCommands: () => {
        throw new Error("Unexpected inventory");
      },
    };
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await runCommand(
      pi,
      ctx,
      "plugin update",
      () => {
        throw new Error("Unexpected handler");
      },
      ids,
    );

    // assert
    assert.deepStrictEqual(capture.entries, [expectedError("ID failed", "recovery-a")]);
    assert.deepStrictEqual(events, ["primary", "recovery"]);
    capture.assertValid();
  });

  test(`reports inventory failure with the allocated identity in ${mode}`, async () => {
    // arrange
    const capture = createJsonCapture();
    const events: string[] = [];
    const pi = {
      ...capture.entrySink,
      getAllTools: () => {
        events.push("inventory");
        throw new Error("Inventory failed");
      },
      getCommands: () => {
        throw new Error("Unexpected inventory");
      },
    };
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await runCommand(
      pi,
      ctx,
      "plugin update",
      () => {
        throw new Error("Unexpected handler");
      },
      {
        ...createIds(),
        openRun: (inventory) => {
          inventory.getAllTools();
          throw new Error("Unexpected inventory success");
        },
      },
    );

    // assert
    assert.deepStrictEqual(capture.entries, [expectedError("Inventory failed")]);
    assert.deepStrictEqual(events, ["inventory"]);
    capture.assertValid();
  });
}

for (const mode of ["tui", "print"]) {
  for (const stage of ["createInvocationId", "openRun"] as const) {
    test(`preserves synchronous ${stage} failure identity in ${mode}`, () => {
      // arrange
      const failure = new Error("setup failed");
      const capture = createJsonCapture();
      const ids = createIds();
      const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
      const fail = () => {
        throw failure;
      };

      ids[stage] = fail;
      ids.createRecoveryId = () => {
        throw new Error("Unexpected recovery");
      };

      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };

      // act & assert
      assert.throws(
        () =>
          runCommand(
            pi,
            ctx,
            "plugin update",
            () => {
              throw new Error("Unexpected handler");
            },
            ids,
          ),
        (error: unknown) => error === failure,
      );
      assert.deepStrictEqual(capture.entries, []);
      capture.assertValid();
    });
  }

  test(`preserves handler rejection identity in ${mode}`, async () => {
    // arrange
    const failure = new Error("handler failed");
    const capture = createJsonCapture();
    const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act & assert
    await assert.rejects(
      runCommand(pi, ctx, "plugin update", () => Promise.reject(failure), createIds()),
      (error: unknown) => error === failure,
    );
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
  });
}

test("surfaces a broken recovery allocator as its original synchronous failure", () => {
  // arrange
  const failure = new Error("recovery failed");
  const capture = createJsonCapture();
  const pi = {
    ...capture.entrySink,
    getAllTools: () => {
      throw new Error("Unexpected inventory");
    },
    getCommands: () => {
      throw new Error("Unexpected inventory");
    },
  };
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };
  const ids = {
    openRun: openNotificationRun,
    createInvocationId: () => {
      throw new Error("primary failed");
    },
    createRecoveryId: () => {
      throw failure;
    },
  };

  // act & assert
  assert.throws(
    () =>
      runCommand(
        pi,
        ctx,
        "plugin update",
        () => {
          throw new Error("Unexpected handler");
        },
        ids,
      ),
    (error: unknown) => error === failure,
  );
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

test("surfaces an unsupported live mode after the handler fails", async () => {
  // arrange
  const capture = createJsonCapture();
  const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };

  // act & assert
  await assert.rejects(
    runCommand(
      pi,
      ctx,
      "plugin update",
      () => {
        ctx.mode = "unknown";
        return Promise.reject(new Error("handler failed"));
      },
      createIds(),
    ),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedModeError);
      assert.strictEqual(error.mode, "unknown");
      return true;
    },
  );
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

test("surfaces the original stale mode getter failure after handler work", async () => {
  // arrange
  const failure = new Error("stale mode");
  const capture = createJsonCapture();
  const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
  const ctx = {
    get mode(): string {
      throw failure;
    },
    get ui() {
      return capture.ui;
    },
  };

  // act & assert
  await assert.rejects(
    runCommand(
      pi,
      ctx,
      "plugin update",
      () => Promise.reject(new Error("handler failed")),
      createIds(),
    ),
    (error: unknown) => error === failure,
  );
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
});

test("awaits deferred handler output before fulfilling", async () => {
  // arrange
  const capture = createJsonCapture();
  const pi = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };
  let release: () => void = () => {
    throw new Error("Missing deferred resolver");
  };

  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let settled = false;

  // act
  const completion = runCommand(
    pi,
    ctx,
    "plugin update",
    async (run) => {
      await ready;
      notifyUsageInfo(ctx, run, "Done.");
    },
    createIds(),
  ).then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.strictEqual(settled, false);
  release();
  await completion;

  // assert
  assert.strictEqual(settled, true);
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        kind: "usage-info",
        severity: "info",
        needsReload: false,
        origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
        usage: "Done.",
      },
    },
  ]);
  capture.assertValid();
});
