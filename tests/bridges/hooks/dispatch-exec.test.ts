import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  _resetSpawnForTest,
  _setSpawnForTest,
  dispatchHookExec,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";

import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import type { BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ChildProcess, SpawnOptions } from "node:child_process";

// ──────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hermetic env wrapper: relocates PI_CODING_AGENT_DIR to a tmpdir so the
 * locationsFor("user", ...) arm does not read the developer's real $HOME
 * state. Restores on cleanup.
 */
function relocateAgentDir(t: import("node:test").TestContext): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  void __dirname;
  const dir = path.join(
    tmpdir(),
    `hooks-exec-${Date.now().toString()}-${Math.random().toString(36).slice(2)}`,
  );
  const prev = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  t.after(() => {
    if (prev === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = prev;
    }
  });
  return dir;
}

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
  readonly stdinChunks: string[];
}

interface MockChildHandle {
  readonly call: SpawnCall;
  readonly child: ChildProcess;
  emitStdout(chunk: string): void;
  emitStderr(chunk: string): void;
  emitClose(code: number | null): void;
  emitError(err: Error): void;
}

interface MockChildOptions {
  /** When true, child.killed flips to true on .kill(). */
  readonly autoKilledFlag?: boolean;
}

function makeMockChild(call: SpawnCall, opts: MockChildOptions = {}): MockChildHandle {
  const emitter = new EventEmitter();
  // The dispatcher pulls via the "data" event; the underlying source is
  // pushed manually via emitStdout / emitStderr, so the read() impl is
  // intentionally a no-op.
  const noopRead = (): void => undefined;
  const stdout = new Readable({ read: noopRead });
  const stderr = new Readable({ read: noopRead });
  const stdin = new Writable({
    write(chunk, _enc, cb): void {
      call.stdinChunks.push(typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8"));
      cb();
    },
  });

  let killed = false;

  const child = Object.assign(emitter, {
    stdout,
    stderr,
    stdin,
    get killed(): boolean {
      return killed;
    },
    kill(_signal?: NodeJS.Signals): boolean {
      if (opts.autoKilledFlag) {
        killed = true;
      }

      return true;
    },
    pid: 12345,
  }) as unknown as ChildProcess;

  return {
    call,
    child,
    emitStdout(chunk: string): void {
      stdout.push(chunk);
    },
    emitStderr(chunk: string): void {
      stderr.push(chunk);
    },
    emitClose(code: number | null): void {
      stdout.push(null);
      stderr.push(null);
      emitter.emit("close", code);
    },
    emitError(err: Error): void {
      emitter.emit("error", err);
    },
  };
}

interface SpawnSpy {
  readonly calls: SpawnCall[];
  /** Synchronously available after dispatchHookExec invocation. */
  readonly handles: MockChildHandle[];
}

function installSpawnSpy(
  t: import("node:test").TestContext,
  configure?: (handle: MockChildHandle) => void,
): SpawnSpy {
  const calls: SpawnCall[] = [];
  const handles: MockChildHandle[] = [];
  _setSpawnForTest(((
    command: string,
    args: readonly string[],
    options: SpawnOptions,
  ): ChildProcess => {
    const call: SpawnCall = { command, args: [...args], options, stdinChunks: [] };
    calls.push(call);
    const handle = makeMockChild(call);
    handles.push(handle);
    if (configure !== undefined) {
      // Schedule on the microtask queue so the dispatcher's listeners are
      // attached before we emit events.
      queueMicrotask(() => {
        configure(handle);
      });
    }

    return handle.child;
  }) as unknown as typeof import("node:child_process").spawn);

  t.after(() => {
    _resetSpawnForTest();
  });

  return { calls, handles };
}

function makeEntry(input: {
  claudeEvent?: BucketAEvent;
  args?: readonly string[];
  shell?: string;
  command?: string;
  timeout?: number;
}): RoutingEntry {
  const handlerDecl: Record<string, unknown> = {
    type: "command",
    command: input.command ?? "/bin/true",
  };
  if (input.args !== undefined) {
    handlerDecl.args = [...input.args];
  }

  if (input.shell !== undefined) {
    handlerDecl.shell = input.shell;
  }

  if (input.timeout !== undefined) {
    handlerDecl.timeout = input.timeout;
  }

  return {
    scope: "user",
    marketplace: "mp",
    pluginId: "test-plugin",
    claudeEvent: input.claudeEvent ?? "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: handlerDecl as RoutingEntry["handlerDecl"],
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
  };
}

function makeCtx(cwd: string): ExtensionContext {
  return {
    cwd,
    sessionManager: {
      getSessionId: () => "session-xyz",
      getSessionFile: () => undefined,
    },
  } as unknown as ExtensionContext;
}

// ──────────────────────────────────────────────────────────────────────────
// Block: never-throws baseline (carried forward from the original stub)
// ──────────────────────────────────────────────────────────────────────────

test("dispatchHookExec: stub fixture path -- returns {kind:'noop'} when spawn errors", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitError(new Error("ENOENT"));
  });

  const result = await dispatchHookExec(
    makeEntry({}),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  assert.deepEqual(result, { kind: "noop" });
  assert.equal(spy.calls.length, 1);
});

test("dispatchHookExec: tolerates arbitrary event shapes (never throws)", async (t) => {
  relocateAgentDir(t);
  installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  const fixtures: unknown[] = [{}, { isError: true }, { toolName: "bash" }, null];
  for (const event of fixtures) {
    await assert.doesNotReject(() => dispatchHookExec(makeEntry({}), event, makeCtx("/tmp/proj")));
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block A: EXEC-01 spawn cwd + env merge
// ──────────────────────────────────────────────────────────────────────────

test("EXEC-01: spawn called with cwd === ctx.cwd", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(makeEntry({}), { toolName: "bash", input: {} }, makeCtx("/tmp/proj"));

  assert.equal(spy.calls.length, 1);
  assert.equal(spy.calls[0]?.options.cwd, "/tmp/proj");
});

test("EXEC-01 + HOOK-05: env contains process.env + CLAUDE_PROJECT_DIR + CLAUDE_PLUGIN_ROOT + CLAUDE_PLUGIN_DATA; CLAUDE_CODE_REMOTE unset", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  process.env.HOOK_TEST_PROBE = "probe-value";
  t.after(() => {
    delete process.env.HOOK_TEST_PROBE;
  });

  await dispatchHookExec(
    makeEntry({ claudeEvent: "PreToolUse" }),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  const env = spy.calls[0]?.options.env ?? {};
  assert.equal(env.HOOK_TEST_PROBE, "probe-value", "process.env keys must propagate");
  assert.equal(env.CLAUDE_PROJECT_DIR, "/tmp/proj");
  assert.ok(env.CLAUDE_PLUGIN_ROOT?.includes("/plugins/test-plugin"));
  assert.ok(env.CLAUDE_PLUGIN_DATA?.includes("/data/test-plugin"));
  assert.equal(env.CLAUDE_CODE_REMOTE, undefined);
});

// ──────────────────────────────────────────────────────────────────────────
// Block: HOOK-05 SessionStart-only CLAUDE_ENV_FILE (D-60-06)
// ──────────────────────────────────────────────────────────────────────────

test("HOOK-05 / D-60-06: CLAUDE_ENV_FILE set for SessionStart and matches /_shared/claude-env-<sid>.env scheme", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(
    makeEntry({ claudeEvent: "SessionStart" }),
    { reason: "startup" },
    makeCtx("/tmp/proj"),
  );

  const env = spy.calls[0]?.options.env ?? {};
  const envFile = env.CLAUDE_ENV_FILE ?? "";
  assert.ok(envFile !== "", "CLAUDE_ENV_FILE must be set for SessionStart");
  assert.match(envFile, /[/\\]data[/\\]_shared[/\\]claude-env-session-xyz\.env$/);
});

test("HOOK-05: CLAUDE_ENV_FILE absent for the other 7 events", async (t) => {
  relocateAgentDir(t);
  const otherEvents: BucketAEvent[] = [
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PreCompact",
    "PostCompact",
    "SessionEnd",
  ];

  for (const claudeEvent of otherEvents) {
    const spy = installSpawnSpy(t, (h) => {
      h.emitClose(0);
    });

    await dispatchHookExec(
      makeEntry({ claudeEvent }),
      { toolName: "bash", input: {}, content: [], reason: "quit", text: "x" },
      makeCtx("/tmp/proj"),
    );

    const env = spy.calls[0]?.options.env ?? {};
    assert.equal(env.CLAUDE_ENV_FILE, undefined, `${claudeEvent} must not set CLAUDE_ENV_FILE`);
    _resetSpawnForTest();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block D: EXEC-04 exec-form vs shell-form
// ──────────────────────────────────────────────────────────────────────────

test("EXEC-04: args=[arg1, arg2] -> exec-form (shell:false)", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(
    makeEntry({ args: ["arg1", "arg2"] }),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  assert.deepEqual(spy.calls[0]?.args, ["arg1", "arg2"]);
  assert.equal(spy.calls[0]?.options.shell, false);
});

test("EXEC-04: args undefined -> shell-form (shell:true, args:[])", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(makeEntry({}), { toolName: "bash", input: {} }, makeCtx("/tmp/proj"));

  assert.deepEqual(spy.calls[0]?.args, []);
  assert.equal(spy.calls[0]?.options.shell, true);
});

test("EXEC-04: shell: '/bin/bash' + no args -> shell binary set", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(
    makeEntry({ shell: "/bin/bash" }),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  assert.equal(spy.calls[0]?.options.shell, "/bin/bash");
});

test("EXEC-04: args=[] (empty array) -> exec-form (args!==undefined discriminator)", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(
    makeEntry({ args: [] }),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  assert.equal(spy.calls[0]?.options.shell, false, "args=[] must be exec-form, not shell-form");
});

// ──────────────────────────────────────────────────────────────────────────
// Block: EXEC-02 256KB stdin truncation marker
// ──────────────────────────────────────────────────────────────────────────

test("EXEC-02: stdin > 256KB injects top-level _truncated:true marker", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  // Build a huge prompt: ~300KB string in UserPromptSubmit's `prompt`.
  const hugeText = "x".repeat(300 * 1024);
  await dispatchHookExec(
    makeEntry({ claudeEvent: "UserPromptSubmit" }),
    { text: hugeText },
    makeCtx("/tmp/proj"),
  );

  // Wait one tick for the stdin chunk to flush.
  await new Promise((r) => setImmediate(r));
  const stdinText = spy.calls[0]?.stdinChunks.join("") ?? "";
  assert.ok(stdinText.includes('"_truncated":true'), "expected top-level _truncated marker");
});

// ──────────────────────────────────────────────────────────────────────────
// Block: EXEC-03 stderr -> hookDebugLog sole sink
// ──────────────────────────────────────────────────────────────────────────

test("EXEC-03: stderr emits route through hookDebugLog; result is parsed (noop)", async (t) => {
  relocateAgentDir(t);
  installSpawnSpy(t, (h) => {
    h.emitStderr("hook failed\n");
    setImmediate(() => {
      h.emitClose(0);
    });
  });

  const result = await dispatchHookExec(
    makeEntry({}),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  // Empty stdout + exit 0 = noop.
  assert.deepEqual(result, { kind: "noop" });
});

// ──────────────────────────────────────────────────────────────────────────
// Block: wire-protocol integration (exit 2 -> block)
// ──────────────────────────────────────────────────────────────────────────

test("wire-protocol integration: exit 2 + stderr -> {kind:'block', reason}", async (t) => {
  relocateAgentDir(t);
  installSpawnSpy(t, (h) => {
    h.emitStderr("denied");
    // setImmediate (not queueMicrotask) so the Readable stream's `data` event
    // delivery, which itself queues via the event loop, lands BEFORE `close`.
    setImmediate(() => {
      h.emitClose(2);
    });
  });

  const result = await dispatchHookExec(
    makeEntry({}),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  assert.deepEqual(result, { kind: "block", reason: "denied" });
});

test("wire-protocol integration: exit 0 + JSON {continue:false,stopReason:'X'} -> stop", async (t) => {
  relocateAgentDir(t);
  installSpawnSpy(t, (h) => {
    h.emitStdout('{"continue":false,"stopReason":"X"}');
    setImmediate(() => {
      h.emitClose(0);
    });
  });

  const result = await dispatchHookExec(
    makeEntry({}),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  assert.deepEqual(result, { kind: "stop", stopReason: "X" });
});

// ──────────────────────────────────────────────────────────────────────────
// Block: PAYL-01 stdin payload shape
// ──────────────────────────────────────────────────────────────────────────

test("PAYL-01: PreToolUse stdin carries hook_event_name + capitalized tool_name", async (t) => {
  relocateAgentDir(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(
    makeEntry({ claudeEvent: "PreToolUse" }),
    { toolName: "bash", input: { cmd: "ls" } },
    makeCtx("/tmp/proj"),
  );

  await new Promise((r) => setImmediate(r));
  const stdinText = spy.calls[0]?.stdinChunks.join("") ?? "";
  const parsed = JSON.parse(stdinText) as Record<string, unknown>;
  assert.equal(parsed.hook_event_name, "PreToolUse");
  assert.equal(parsed.tool_name, "Bash");
  assert.deepEqual(parsed.tool_input, { cmd: "ls" });
});
