import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCommand } from "../../extensions/pi-claude-marketplace/edge/command-run.ts";
import { UnsupportedModeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { notifyUsageInfo } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { openNotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

import { createJsonCapture } from "./json-capture.ts";

test("retains committed local state and earlier output after a command throws", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-partial-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const store = path.join(directory, "state.json");
  await writeFile(store, '{"installed":false}');
  const capture = createJsonCapture();
  const pi = { ...capture.entrySink, getAllTools: () => [] };
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
    const pi = { ...capture.entrySink, getAllTools: () => [] };
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
    const pi = { ...capture.entrySink, getAllTools: () => [] };
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
      const pi = { ...capture.entrySink, getAllTools: () => [] };
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
      const pi = { ...capture.entrySink, getAllTools: () => [] };
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

function expectedError(message: string, invocationId = "run-a") {
  return {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      kind: "internal-error",
      origin: { kind: "command", commandId: "plugin update", invocationId },
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: [message], truncated: false },
    },
  };
}

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
      const pi = { ...capture.entrySink, getAllTools: () => [] };
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
    const pi = { ...capture.entrySink, getAllTools: () => [] };
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
  const pi = { ...capture.entrySink, getAllTools: () => [] };
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
  const pi = { ...capture.entrySink, getAllTools: () => [] };
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
  const pi = { ...capture.entrySink, getAllTools: () => [] };
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
