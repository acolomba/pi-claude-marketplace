// tests/architecture/hooks-async-rewake.test.ts
//
// Architecture-level invariant pins for the async-rewake bridge
// (HOOK-06 + EXEC-05 + D-62-01..05 + the IL-2 EXEMPTION for
// rewakeSummary + the D-59-03 captured-epoch zombie defense).
//
//   Block A -- spawn options pinned: { detached: false,
//       stdio: ["pipe","pipe","pipe"] } + the
//       PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId> env marker.
//   Block B -- exit code 2 -> pi.sendMessage({ customType:
//       "claude-hook-rewake", display: false, content, details },
//       { deliverAs: ctx.isIdle() ? "nextTurn" : "followUp" }); any other
//       code -> silent.
//   Block C -- ring buffer overflow drops oldest bytes; truncated latch
//       surfaces as "[…truncated]\n" prefix in injected body.
//   Block D -- D-62-05 PID table atomic write on spawnAndRegister + exit;
//       ENOENT read returns []; marker mismatch on Linux skips SIGKILL with
//       debug-log; non-Linux platforms soft-skip with debug-log.
//   Block E -- D-59-03 captured-epoch -- stale child no-ops on exit when
//       currentEpoch() bumped during child's life.
//   Block F -- IL-2 EXEMPTION: rewakeSummary routes through
//       notifyAsyncRewakeSummary independent of exit code; spawnAndRegister
//       is fire-and-forget.
//   Block G -- dispatch-exec delegation: asyncRewake:true -> spawnAndRegister
//       + return {kind:"noop"}; non-`true` values flow to sync path.
//   Block H -- multi-hook fan-in: distinct dispatchIds via randomUUID;
//       independent exit handlers; registry size reflects live children.

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { afterEach, beforeEach, describe, test } from "node:test";

import {
  pidTablePath,
  readPidTable,
  unlinkPidTable,
  writePidTable,
  type PidTableEntry,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import {
  _awaitLastPidTablePersistForTest,
  _getRegistryForTest,
  _resetDispatchIdGeneratorForTest,
  _resetOrphanProbesForTest,
  _resetSpawnForTest,
  _setDispatchIdGeneratorForTest,
  _setOrphanProbesForTest,
  _setSpawnForTest,
  MARKER_ENV,
  reapOrphans,
  shutdownInMemoryChildren,
  spawnAndRegister,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import {
  RingBuffer,
  STDERR_CAP_BYTES,
  STDOUT_CAP_BYTES,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts";
import {
  dispatchHookExec,
  _resetSpawnForTest as _resetExecSpawnForTest,
  _setSpawnForTest as _setExecSpawnForTest,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts";
import {
  _bumpEpochForTest,
  _resetForTest as _resetEventRouterForTest,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { MATCH_ALL_IF } from "../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { asAbsolutePluginRoot } from "../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { RoutingEntry } from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import type { BucketAEvent } from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ChildProcess, SpawnOptions } from "node:child_process";

// ──────────────────────────────────────────────────────────────────────────
// Mock spawn + ChildProcess
// ──────────────────────────────────────────────────────────────────────────

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
  readonly stdinChunks: string[];
}

interface MockChild {
  readonly call: SpawnCall;
  readonly child: ChildProcess;
  emitStdout(chunk: string | Buffer): void;
  emitStderr(chunk: string | Buffer): void;
  emitExit(code: number | null, signal?: NodeJS.Signals | null): void;
  emitError(err: Error): void;
  killCalls(): readonly NodeJS.Signals[];
}

function makeMockChild(call: SpawnCall, pid = 99_991): MockChild {
  const emitter = new EventEmitter();
  const noopRead = (): void => undefined;
  const stdout = new Readable({ read: noopRead });
  const stderr = new Readable({ read: noopRead });
  const stdin = new Writable({
    write(chunk, _enc, cb): void {
      call.stdinChunks.push(typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8"));
      cb();
    },
  });

  const killCalls: NodeJS.Signals[] = [];
  let killed = false;

  const child = Object.assign(emitter, {
    stdout,
    stderr,
    stdin,
    get killed(): boolean {
      return killed;
    },
    kill(signal?: NodeJS.Signals): boolean {
      killCalls.push(signal ?? "SIGTERM");
      killed = true;
      return true;
    },
    pid,
  }) as unknown as ChildProcess;

  return {
    call,
    child,
    emitStdout(chunk): void {
      stdout.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    },
    emitStderr(chunk): void {
      stderr.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    },
    emitExit(code, signal): void {
      stdout.push(null);
      stderr.push(null);
      emitter.emit("exit", code, signal ?? null);
    },
    emitError(err): void {
      emitter.emit("error", err);
    },
    killCalls(): readonly NodeJS.Signals[] {
      return killCalls;
    },
  };
}

interface SpawnSpy {
  readonly calls: SpawnCall[];
  readonly children: MockChild[];
  setPid(pid: number): void;
}

function installSpawnSpy(
  configure?: (handle: MockChild) => void,
  opts?: { wireBoth?: boolean },
): SpawnSpy {
  const calls: SpawnCall[] = [];
  const children: MockChild[] = [];
  let nextPid = 99_991;
  const fakeSpawn = ((
    command: string,
    args: readonly string[],
    options: SpawnOptions,
  ): ChildProcess => {
    const call: SpawnCall = { command, args: [...args], options, stdinChunks: [] };
    calls.push(call);
    const handle = makeMockChild(call, nextPid);
    nextPid += 1;
    children.push(handle);
    if (configure !== undefined) {
      queueMicrotask(() => {
        configure(handle);
      });
    }

    return handle.child;
  }) as unknown as typeof import("node:child_process").spawn;
  _setSpawnForTest(fakeSpawn);
  if (opts?.wireBoth === true) {
    _setExecSpawnForTest(fakeSpawn);
  }

  return {
    calls,
    children,
    setPid(pid): void {
      nextPid = pid;
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Mock ExtensionContext + ExtensionAPI
// ──────────────────────────────────────────────────────────────────────────

interface SendMessageCall {
  readonly message: {
    customType: string;
    content: string;
    display: boolean;
    details?: unknown;
  };
  readonly options: { triggerTurn?: boolean; deliverAs?: string } | undefined;
}

interface NotifyCall {
  readonly text: string;
  readonly severity: "info" | "warning" | "error" | undefined;
}

interface MockCtx {
  readonly ctx: ExtensionContext;
  readonly notifyCalls: NotifyCall[];
  setIdle(b: boolean): void;
}

function makeMockCtx(cwd: string): MockCtx {
  const notifyCalls: NotifyCall[] = [];
  let idle = true;
  const ctx = {
    cwd,
    isIdle: () => idle,
    sessionManager: {
      getSessionId: () => "session-rewake",
      getSessionFile: () => undefined,
    },
    ui: {
      notify: (text: string, severity?: "info" | "warning" | "error") => {
        notifyCalls.push({ text, severity });
      },
    },
  } as unknown as ExtensionContext;
  return {
    ctx,
    notifyCalls,
    setIdle(b): void {
      idle = b;
    },
  };
}

interface MockPi {
  readonly pi: ExtensionAPI;
  readonly sendMessageCalls: SendMessageCall[];
  setSendMessageThrow(err: Error | undefined): void;
}

function makeMockPi(): MockPi {
  const sendMessageCalls: SendMessageCall[] = [];
  let throwOnSend: Error | undefined;
  const pi = {
    sendMessage: (message: unknown, options?: unknown) => {
      if (throwOnSend !== undefined) {
        throw throwOnSend;
      }

      sendMessageCalls.push({
        message: message as SendMessageCall["message"],
        options: options as SendMessageCall["options"],
      });
    },
    on: () => {
      /* no-op */
    },
  } as unknown as ExtensionAPI;
  return {
    pi,
    sendMessageCalls,
    setSendMessageThrow(err): void {
      throwOnSend = err;
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Routing entry + temp scope helpers
// ──────────────────────────────────────────────────────────────────────────

function makeEntry(overrides: {
  asyncRewake?: unknown;
  rewakeMessage?: string;
  rewakeSummary?: string;
  pluginId?: string;
  claudeEvent?: BucketAEvent;
}): RoutingEntry {
  const handlerDecl: Record<string, unknown> = {
    type: "command",
    command: "/bin/true",
  };
  if (overrides.asyncRewake !== undefined) {
    handlerDecl.asyncRewake = overrides.asyncRewake;
  }

  if (overrides.rewakeMessage !== undefined) {
    handlerDecl.rewakeMessage = overrides.rewakeMessage;
  }

  if (overrides.rewakeSummary !== undefined) {
    handlerDecl.rewakeSummary = overrides.rewakeSummary;
  }

  return {
    scope: "user",
    marketplace: "mp",
    pluginId: overrides.pluginId ?? "rewake-plug",
    resolvedSource: asAbsolutePluginRoot("/test/plugin-root"),
    claudeEvent: overrides.claudeEvent ?? "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: handlerDecl as RoutingEntry["handlerDecl"],
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
  };
}

async function makeTempLocations(): Promise<{
  loc: ScopedLocations;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "async-rewake-test-"));
  // Lay out a synthetic user-scope agent dir so locationsFor's path
  // composition produces a ScopedLocations whose dataRoot already exists
  // (needed for assertPathInside to succeed against the constructed
  // CLAUDE_PLUGIN_DATA path).
  const agentRoot = path.join(root, "agent");
  await mkdir(path.join(agentRoot, "pi-claude-marketplace", "data", "_shared"), {
    recursive: true,
  });
  await mkdir(path.join(agentRoot, "pi-claude-marketplace", "plugins"), { recursive: true });
  const prev = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentRoot;
  const loc = locationsFor("user", agentRoot);
  return {
    loc,
    cleanup: async () => {
      // Drain any in-flight pid-table atomic write before removing the
      // temp directory.  write-file-atomic holds a temp file open in
      // _shared/ until the rename+fsync completes; removing the directory
      // concurrently produces ENOTEMPTY on macOS.
      await _awaitLastPidTablePersistForTest();
      if (prev === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = prev;
      }

      // `maxRetries` backstops the drain above: under parallel CPU load a
      // late off-band persist (or its write-file-atomic temp file in
      // _shared/) can still race the recursive walk and surface a transient
      // ENOTEMPTY. Retrying the unlink converges deterministically once the
      // last temp file is renamed away.
      await rm(root, { recursive: true, force: true, maxRetries: 10 });
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Lifecycle hygiene -- every describe resets the seams + registry
// ──────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetEventRouterForTest();
  _resetSpawnForTest();
  _resetDispatchIdGeneratorForTest();
  _resetOrphanProbesForTest();
  shutdownInMemoryChildren();
});

afterEach(() => {
  _resetSpawnForTest();
  _resetExecSpawnForTest();
  _resetDispatchIdGeneratorForTest();
  _resetOrphanProbesForTest();
  shutdownInMemoryChildren();
  _resetEventRouterForTest();
});

// ──────────────────────────────────────────────────────────────────────────
// describe: spawn-and-register
// ──────────────────────────────────────────────────────────────────────────

describe("spawn-and-register", () => {
  test("EXEC-05: spawn options pinned to detached:false + stdio pipe-pipe-pipe", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "fixed-uuid-1");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      assert.equal(spy.calls.length, 1);
      const call = spy.calls[0];
      assert.ok(call !== undefined);
      assert.equal(call.options.detached, false);
      assert.deepEqual(call.options.stdio, ["pipe", "pipe", "pipe"]);
    } finally {
      await tmp.cleanup();
    }
  });

  test("EXEC-05: PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH env marker equals dispatchId byte-for-byte", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "fixed-uuid-marker");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      const env = spy.calls[0]?.options.env ?? {};
      assert.equal(MARKER_ENV, "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH");
      assert.equal(env[MARKER_ENV], "fixed-uuid-marker");
    } finally {
      await tmp.cleanup();
    }
  });

  test("EXEC-05: registry add happens before resolve", async () => {
    const tmp = await makeTempLocations();
    try {
      installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "fixed-uuid-2");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      const reg = _getRegistryForTest();
      assert.equal(reg.has("fixed-uuid-2"), true);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: PID table persists the registered entry after spawnAndRegister", async () => {
    const tmp = await makeTempLocations();
    try {
      installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "fixed-uuid-3");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      const table = await readPidTable(tmp.loc);
      assert.equal(table.length, 1);
      assert.equal(table[0]?.dispatchId, "fixed-uuid-3");
      assert.equal(table[0]?.plugin, "rewake-plug");
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: spawnAndRegister resolves without awaiting child exit", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "fixed-uuid-4");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      const promise = spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      await promise;
      // Child still alive after the await -- exit handler has not fired
      const reg = _getRegistryForTest();
      assert.equal(reg.has("fixed-uuid-4"), true);
      // Now emit exit; the handler runs out-of-band
      spy.children[0]?.emitExit(0);
      await new Promise((r) => setImmediate(r));
      assert.equal(reg.has("fixed-uuid-4"), false);
    } finally {
      await tmp.cleanup();
    }
  });

  test("onChildError removes the registered entry and persists the pid table", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "fixed-uuid-onerror");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      const reg = _getRegistryForTest();
      assert.equal(reg.has("fixed-uuid-onerror"), true);
      // A spawn-level failure (e.g. ENOENT) surfaces as a child "error" event,
      // routed to onChildError out-of-band: it cancels the ladder, drops the
      // entry, and persists the shrunken pid table.
      spy.children[0]?.emitError(new Error("spawn failed"));
      await new Promise((r) => setImmediate(r));
      assert.equal(reg.has("fixed-uuid-onerror"), false);
      await _awaitLastPidTablePersistForTest();
    } finally {
      await tmp.cleanup();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// describe: on-exit
// ──────────────────────────────────────────────────────────────────────────

describe("on-exit", () => {
  test("HOOK-06: exit code 2 -> pi.sendMessage with display:false + customType:claude-hook-rewake", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-exit-2");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({ rewakeMessage: "Security finding:" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStderr("blocking violation");
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls.length, 1);
      const call = pi.sendMessageCalls[0];
      assert.ok(call !== undefined);
      assert.equal(call.message.customType, "claude-hook-rewake");
      assert.equal(call.message.display, false);
      assert.equal(call.message.content, "Security finding:\n\nblocking violation");
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: exit code 2 with empty rewakeMessage uses raw body as content", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-raw-body");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStderr("finding-only");
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls.length, 1);
      assert.equal(pi.sendMessageCalls[0]?.message.content, "finding-only");
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: exit code 2 with empty stderr falls back to stdout body", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-stdout");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStdout("from-stdout");
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls[0]?.message.content, "from-stdout");
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: exit code 0 -> pi.sendMessage NOT called", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-zero");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({ rewakeMessage: "noise" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStderr("ignored");
      spy.children[0]?.emitExit(0);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls.length, 0);
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: exit code 2 with empty body skips injection (no zero-content sendMessage)", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-empty-body");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls.length, 0);
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: deliverAs === nextTurn when ctx.isIdle() is true", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-idle");
      const ctx = makeMockCtx("/tmp/proj");
      ctx.setIdle(true);
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStderr("body");
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls[0]?.options?.deliverAs, "nextTurn");
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: deliverAs === followUp when ctx.isIdle() is false", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-busy");
      const ctx = makeMockCtx("/tmp/proj");
      ctx.setIdle(false);
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStderr("body");
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls[0]?.options?.deliverAs, "followUp");
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: pi.sendMessage throw is trapped (handler does not escape)", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-throw");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      pi.setSendMessageThrow(new Error("sendMessage bombed"));
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStderr("body");
      // Must not throw out of the exit-handler microtask.
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      // sendMessage was attempted (and threw) -- no call recorded because
      // the spy throws BEFORE recording.
      assert.equal(pi.sendMessageCalls.length, 0);
      // Registry still cleaned up.
      assert.equal(_getRegistryForTest().has("uuid-throw"), false);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-59-03: captured-epoch mismatch -> exit handler no-ops (no sendMessage, no notify)", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-stale");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({ rewakeSummary: "should not fire" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      // Simulate a /reload between spawn and exit.
      _bumpEpochForTest();
      spy.children[0]?.emitStderr("late body");
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(pi.sendMessageCalls.length, 0);
      assert.equal(ctx.notifyCalls.length, 0);
    } finally {
      await tmp.cleanup();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// describe: ring-buffer
// ──────────────────────────────────────────────────────────────────────────

describe("ring-buffer", () => {
  test("EXEC-05: STDERR_CAP_BYTES === 64 KiB", () => {
    assert.equal(STDERR_CAP_BYTES, 65_536);
  });

  test("EXEC-05: STDOUT_CAP_BYTES === 1 MiB", () => {
    assert.equal(STDOUT_CAP_BYTES, 1_048_576);
  });

  test("D-62-04: write more than capacity drops oldest bytes and latches truncated", () => {
    const rb = new RingBuffer(8);
    rb.write(Buffer.from("0123456789"));
    const got = rb.read();
    assert.equal(got.truncated, true);
    // Tail kept: last 8 bytes of "0123456789" are "23456789".
    assert.equal(got.text, "23456789");
  });

  test("D-62-04: read returns chronological order after wrap", () => {
    const rb = new RingBuffer(4);
    rb.write(Buffer.from("ab"));
    rb.write(Buffer.from("cd"));
    rb.write(Buffer.from("ef"));
    const got = rb.read();
    assert.equal(got.truncated, true);
    assert.equal(got.text, "cdef");
  });

  test("D-62-04: empty buffer read returns {text:'', truncated:false}", () => {
    const rb = new RingBuffer(8);
    assert.deepEqual(rb.read(), { text: "", truncated: false });
  });

  test("HOOK-06: injection content prepends '[…truncated]\\n' when ring buffer truncated", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-truncated");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      // Emit > 64 KiB of stderr so the ring buffer truncates.
      spy.children[0]?.emitStderr(Buffer.alloc(STDERR_CAP_BYTES + 16, 0x41));
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      const content = pi.sendMessageCalls[0]?.message.content ?? "";
      assert.ok(
        content.startsWith("[…truncated]\n"),
        `expected truncated prefix, got first 32 chars: ${JSON.stringify(content.slice(0, 32))}`,
      );
    } finally {
      await tmp.cleanup();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// describe: orphan-reap
// ──────────────────────────────────────────────────────────────────────────

describe("orphan-reap", () => {
  test("D-62-05: pidTablePath(loc) ends with /pi-claude-marketplace/data/_shared/async-rewake-pids.json", async () => {
    const tmp = await makeTempLocations();
    try {
      const p = pidTablePath(tmp.loc);
      assert.match(p, /pi-claude-marketplace[/\\]data[/\\]_shared[/\\]async-rewake-pids\.json$/);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: writePidTable + readPidTable round-trips entries", async () => {
    const tmp = await makeTempLocations();
    try {
      const entries: readonly PidTableEntry[] = [
        {
          pid: 1111,
          dispatchId: "uuid-A",
          scope: "user",
          marketplace: "mp",
          plugin: "p1",
          spawnedAt: "2026-06-15T00:00:00.000Z",
        },
        {
          pid: 2222,
          dispatchId: "uuid-B",
          scope: "user",
          marketplace: "mp",
          plugin: "p2",
          spawnedAt: "2026-06-15T00:00:01.000Z",
        },
      ];
      await writePidTable(tmp.loc, entries);
      const round = await readPidTable(tmp.loc);
      assert.equal(round.length, 2);
      assert.equal(round[0]?.dispatchId, "uuid-A");
      assert.equal(round[1]?.dispatchId, "uuid-B");
    } finally {
      await tmp.cleanup();
    }
  });

  test("NFR-3: readPidTable on missing file returns []", async () => {
    const tmp = await makeTempLocations();
    try {
      // No write performed; readPidTable must return [] on ENOENT.
      const round = await readPidTable(tmp.loc);
      assert.deepEqual([...round], []);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: reapOrphans on Linux with matching marker -> killProbe receives SIGKILL", async (t) => {
    if (process.platform !== "linux") {
      t.skip("Linux-only marker path");
      return;
    }

    const tmp = await makeTempLocations();
    try {
      const killCalls: Array<{ pid: number; sig: number | NodeJS.Signals }> = [];
      _setOrphanProbesForTest({
        killProbe: (pid, sig) => {
          killCalls.push({ pid, sig });
        },
        environReader: () => Promise.resolve(`${MARKER_ENV}=uuid-owned\0OTHER=x`),
      });
      await writePidTable(tmp.loc, [
        {
          pid: 12_345,
          dispatchId: "uuid-owned",
          scope: "user",
          marketplace: "mp",
          plugin: "p",
          spawnedAt: "2026-06-15T00:00:00.000Z",
        },
      ]);
      await reapOrphans(tmp.loc);
      // First call is kill 0 (liveness probe); second call is SIGKILL.
      const sigKillCalls = killCalls.filter((c) => c.sig === "SIGKILL");
      assert.equal(sigKillCalls.length, 1);
      assert.equal(sigKillCalls[0]?.pid, 12_345);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: reapOrphans on Linux with mismatched marker -> killProbe SIGKILL NOT issued", async (t) => {
    if (process.platform !== "linux") {
      t.skip("Linux-only marker path");
      return;
    }

    const tmp = await makeTempLocations();
    try {
      const killCalls: Array<{ pid: number; sig: number | NodeJS.Signals }> = [];
      _setOrphanProbesForTest({
        killProbe: (pid, sig) => {
          killCalls.push({ pid, sig });
        },
        environReader: () => Promise.resolve(`${MARKER_ENV}=different-uuid\0OTHER=x`),
      });
      await writePidTable(tmp.loc, [
        {
          pid: 54_321,
          dispatchId: "uuid-expected",
          scope: "user",
          marketplace: "mp",
          plugin: "p",
          spawnedAt: "2026-06-15T00:00:00.000Z",
        },
      ]);
      await reapOrphans(tmp.loc);
      const sigKillCalls = killCalls.filter((c) => c.sig === "SIGKILL");
      assert.equal(sigKillCalls.length, 0);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: reapOrphans on non-Linux platform soft-skips SIGKILL (conservative path)", async (t) => {
    if (process.platform === "linux") {
      t.skip("non-Linux soft-skip arm; this host is Linux");
      return;
    }

    const tmp = await makeTempLocations();
    try {
      const killCalls: Array<{ pid: number; sig: number | NodeJS.Signals }> = [];
      _setOrphanProbesForTest({
        killProbe: (pid, sig) => {
          killCalls.push({ pid, sig });
        },
        environReader: () => Promise.resolve(""),
      });
      await writePidTable(tmp.loc, [
        {
          pid: 11_111,
          dispatchId: "uuid-x",
          scope: "user",
          marketplace: "mp",
          plugin: "p",
          spawnedAt: "2026-06-15T00:00:00.000Z",
        },
      ]);
      await reapOrphans(tmp.loc);
      const sigKillCalls = killCalls.filter((c) => c.sig === "SIGKILL");
      assert.equal(sigKillCalls.length, 0);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: reapOrphans unlinks the PID table after the kill pass", async () => {
    const tmp = await makeTempLocations();
    try {
      _setOrphanProbesForTest({
        killProbe: () => {
          // ESRCH -> dead pid; nothing to kill.
          const err = new Error("no such process") as NodeJS.ErrnoException;
          err.code = "ESRCH";
          throw err;
        },
        environReader: () => Promise.resolve(""),
      });
      await writePidTable(tmp.loc, [
        {
          pid: 99_999,
          dispatchId: "uuid-dead",
          scope: "user",
          marketplace: "mp",
          plugin: "p",
          spawnedAt: "2026-06-15T00:00:00.000Z",
        },
      ]);
      // Sanity check: file exists pre-reap.
      const statPre = await stat(pidTablePath(tmp.loc));
      assert.ok(statPre.isFile());
      await reapOrphans(tmp.loc);
      await assert.rejects(() => stat(pidTablePath(tmp.loc)), /ENOENT/);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: unlinkPidTable on missing file is a no-op", async () => {
    const tmp = await makeTempLocations();
    try {
      await assert.doesNotReject(() => unlinkPidTable(tmp.loc));
    } finally {
      await tmp.cleanup();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// describe: dispatch-exec delegation
// ──────────────────────────────────────────────────────────────────────────

describe("dispatch-exec delegation", () => {
  test("D-62-01: asyncRewake:true -> dispatchHookExec returns {kind:'noop'} AND spawnAndRegister was called", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-disp-async");
      const ctx = makeMockCtx(tmp.loc.scopeRoot);
      const pi = makeMockPi();
      const result = await dispatchHookExec(
        makeEntry({ asyncRewake: true }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
      );
      assert.deepEqual(result, { kind: "noop" });
      assert.equal(spy.calls.length, 1);
      assert.equal(_getRegistryForTest().has("uuid-disp-async"), true);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-01: asyncRewake:undefined -> sync EXEC body fires (single spawn, no async registry entry)", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy(
        (h) => {
          // The sync EXEC body uses `close`, not `exit`, to settle. Push
          // EOF on both streams then emit `close` on the EventEmitter
          // backing the mock child.
          h.child.stdout?.emit("end");
          h.child.stderr?.emit("end");
          (h.child as unknown as EventEmitter).emit("close", 0);
        },
        { wireBoth: true },
      );
      _setDispatchIdGeneratorForTest(() => "uuid-should-not-be-used");
      const ctx = makeMockCtx(tmp.loc.scopeRoot);
      const pi = makeMockPi();
      await dispatchHookExec(makeEntry({}), { toolName: "bash", input: {} }, ctx.ctx, pi.pi);
      assert.equal(spy.calls.length, 1);
      // No async registry entry -- the spy uuid was never consumed.
      assert.equal(_getRegistryForTest().has("uuid-should-not-be-used"), false);
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-03 lenient: asyncRewake:'yes' (non-boolean truthy) routes to sync path", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy(
        (h) => {
          h.child.stdout?.emit("end");
          h.child.stderr?.emit("end");
          (h.child as unknown as EventEmitter).emit("close", 0);
        },
        { wireBoth: true },
      );
      _setDispatchIdGeneratorForTest(() => "uuid-yes-route");
      const ctx = makeMockCtx(tmp.loc.scopeRoot);
      const pi = makeMockPi();
      await dispatchHookExec(
        makeEntry({ asyncRewake: "yes" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
      );
      // Strict === true discriminator: non-boolean routes to sync.
      // Async registry is empty.
      assert.equal(_getRegistryForTest().has("uuid-yes-route"), false);
      assert.equal(spy.calls.length, 1);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-01: asyncRewake:true returns {kind:'noop'} even when spawnAndRegister rejects internally", async () => {
    const tmp = await makeTempLocations();
    try {
      // No spawn spy installed deliberately: the production `spawn` will
      // be invoked for "/bin/true" via shell -- harmless but takes a real
      // process slot. To avoid touching the OS, install a spawn fake
      // that throws synchronously so the registry's internal `try/catch`
      // arm exercises (the dispatch-exec outer try/catch is the
      // backstop the test pins).
      _setSpawnForTest(((): ChildProcess => {
        throw new Error("synthetic spawn failure");
      }) as unknown as typeof import("node:child_process").spawn);
      const ctx = makeMockCtx(tmp.loc.scopeRoot);
      const pi = makeMockPi();
      const result = await dispatchHookExec(
        makeEntry({ asyncRewake: true }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
      );
      assert.deepEqual(result, { kind: "noop" });
    } finally {
      await tmp.cleanup();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// describe: multi-hook fan-in
// ──────────────────────────────────────────────────────────────────────────

describe("multi-hook fan-in", () => {
  test("HOOK-06: two concurrent spawnAndRegister calls produce distinct dispatchIds", async () => {
    const tmp = await makeTempLocations();
    try {
      installSpawnSpy();
      const ids = ["uuid-fan-A", "uuid-fan-B"];
      let i = 0;
      _setDispatchIdGeneratorForTest(() => {
        const id = ids[i] ?? "uuid-overflow";
        i += 1;
        return id;
      });
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await Promise.all([
        spawnAndRegister(
          makeEntry({ pluginId: "p-a" }),
          { toolName: "bash", input: {} },
          ctx.ctx,
          pi.pi,
          tmp.loc,
        ),
        spawnAndRegister(
          makeEntry({ pluginId: "p-b" }),
          { toolName: "bash", input: {} },
          ctx.ctx,
          pi.pi,
          tmp.loc,
        ),
      ]);
      const reg = _getRegistryForTest();
      assert.equal(reg.size, 2);
      assert.equal(reg.has("uuid-fan-A"), true);
      assert.equal(reg.has("uuid-fan-B"), true);
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: each child's exit independently removes its own entry", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      const ids = ["uuid-indep-A", "uuid-indep-B"];
      let i = 0;
      _setDispatchIdGeneratorForTest(() => {
        const id = ids[i] ?? "uuid-overflow";
        i += 1;
        return id;
      });
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({ pluginId: "p-a" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      await spawnAndRegister(
        makeEntry({ pluginId: "p-b" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      assert.equal(_getRegistryForTest().size, 2);
      spy.children[0]?.emitExit(0);
      await new Promise((r) => setImmediate(r));
      assert.equal(_getRegistryForTest().size, 1);
      assert.equal(_getRegistryForTest().has("uuid-indep-B"), true);
      spy.children[1]?.emitExit(0);
      await new Promise((r) => setImmediate(r));
      assert.equal(_getRegistryForTest().size, 0);
    } finally {
      await tmp.cleanup();
    }
  });

  test("D-62-05: PID table reflects both entries until each exit fires", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      const ids = ["uuid-pid-A", "uuid-pid-B"];
      let i = 0;
      _setDispatchIdGeneratorForTest(() => {
        const id = ids[i] ?? "uuid-overflow";
        i += 1;
        return id;
      });
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({ pluginId: "p-a" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      await spawnAndRegister(
        makeEntry({ pluginId: "p-b" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      const table2 = await readPidTable(tmp.loc);
      assert.equal(table2.length, 2);
      spy.children[0]?.emitExit(0);
      // onChildExit runs synchronously on the `exit` emit and reassigns the
      // module-level _lastPidTablePersist handle, so draining that exact
      // promise is deterministic -- a fixed sleep is a race under parallel
      // CPU load (the off-band write may not finish in time).
      await _awaitLastPidTablePersistForTest();
      const table1 = await readPidTable(tmp.loc);
      assert.equal(table1.length, 1);
      assert.equal(table1[0]?.dispatchId, "uuid-pid-B");
    } finally {
      await tmp.cleanup();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// describe: IL-2 exemption (rewakeSummary independent of exit code)
// ──────────────────────────────────────────────────────────────────────────

describe("rewakeSummary IL-2 exemption", () => {
  test("HOOK-06: rewakeSummary fires through ctx.ui.notify on exit code 0", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-summary-0");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({ rewakeSummary: "all clear" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitExit(0);
      await new Promise((r) => setImmediate(r));
      assert.equal(ctx.notifyCalls.length, 1);
      assert.equal(ctx.notifyCalls[0]?.text, "all clear");
      assert.equal(ctx.notifyCalls[0]?.severity, "info");
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: rewakeSummary fires through ctx.ui.notify on exit code 2 (independent of inject)", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-summary-2");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({ rewakeSummary: "found violation" }),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitStderr("body");
      spy.children[0]?.emitExit(2);
      await new Promise((r) => setImmediate(r));
      assert.equal(ctx.notifyCalls.length, 1);
      assert.equal(ctx.notifyCalls[0]?.severity, "info");
      // The inject arm STILL fires alongside the summary.
      assert.equal(pi.sendMessageCalls.length, 1);
    } finally {
      await tmp.cleanup();
    }
  });

  test("HOOK-06: handler without rewakeSummary -> ctx.ui.notify NOT called", async () => {
    const tmp = await makeTempLocations();
    try {
      const spy = installSpawnSpy();
      _setDispatchIdGeneratorForTest(() => "uuid-no-summary");
      const ctx = makeMockCtx("/tmp/proj");
      const pi = makeMockPi();
      await spawnAndRegister(
        makeEntry({}),
        { toolName: "bash", input: {} },
        ctx.ctx,
        pi.pi,
        tmp.loc,
      );
      spy.children[0]?.emitExit(0);
      await new Promise((r) => setImmediate(r));
      assert.equal(ctx.notifyCalls.length, 0);
    } finally {
      await tmp.cleanup();
    }
  });
});
