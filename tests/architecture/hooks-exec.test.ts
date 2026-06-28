// Architecture-level invariant pins for the hooks-bridge execution layer
// (EXEC-01..04 / PAYL-01 / HOOK-05 / D-60-01 / D-60-06).
//
// Each block in this file pins one load-bearing invariant. If any test
// red-fails CI, a future contributor inadvertently reverted a locked
// invariant.
//
//   - Block A: EXEC-01 -- spawn invoked with ctx.cwd as options.cwd and the
//     three always-set CLAUDE_* env vars merged with process.env.
//   - Block B: EXEC-02 -- 256 KB stdin truncation marker, 1 MB stdout
//     overflow kill + noop, timer ladder cancellation on natural exit.
//   - Block C: EXEC-03 -- static-grep guarantees `ctx.ui.notify` does NOT
//     appear in dispatch-exec.ts (comment lines excluded); stderr emits at
//     runtime are observable via spawn-spy + close events.
//   - Block D: EXEC-04 -- args !== undefined -> exec-form; args undefined
//     -> shell-form; args:[] is exec-form (the discriminator is "defined").
//   - Block E: HOOK-05 -- per-event env-var presence sweep; SessionStart
//     sets CLAUDE_ENV_FILE; the other 7 events do not; CLAUDE_CODE_REMOTE
//     is unset everywhere.
//   - Block F: D-60-06 -- `_shared` data dir exists after
//     registerHooksBridge under both scopes; the call is idempotent; the
//     SessionStart env-file path matches the regex pin
//     /data/_shared/claude-env-<sid>.env.

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  _resetSpawnForTest,
  _setSpawnForTest,
  dispatchHookExec,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts";
import {
  _resetForTest,
  registerHooksBridge,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { MATCH_ALL_IF } from "../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { asAbsolutePluginRoot } from "../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type { RoutingEntry } from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import type { BucketAEvent } from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ChildProcess, SpawnOptions } from "node:child_process";

// ──────────────────────────────────────────────────────────────────────────
// Shared fixtures
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
  emitStdout(chunk: string): void;
  emitStderr(chunk: string): void;
  emitClose(code: number | null): void;
  killed(): boolean;
  killCalls(): readonly NodeJS.Signals[];
}

function makeChild(call: SpawnCall): MockChild {
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
    pid: 99999,
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
    killed(): boolean {
      return killed;
    },
    killCalls(): readonly NodeJS.Signals[] {
      return killCalls;
    },
  };
}

interface SpawnSpy {
  readonly calls: SpawnCall[];
  readonly children: MockChild[];
}

function installSpawnSpy(
  t: import("node:test").TestContext,
  configure?: (handle: MockChild) => void,
): SpawnSpy {
  const calls: SpawnCall[] = [];
  const children: MockChild[] = [];
  _setSpawnForTest(((
    command: string,
    args: readonly string[],
    options: SpawnOptions,
  ): ChildProcess => {
    const call: SpawnCall = { command, args: [...args], options, stdinChunks: [] };
    calls.push(call);
    const handle = makeChild(call);
    children.push(handle);
    if (configure !== undefined) {
      queueMicrotask(() => {
        configure(handle);
      });
    }

    return handle.child;
  }) as unknown as typeof import("node:child_process").spawn);
  t.after(() => {
    _resetSpawnForTest();
  });
  return { calls, children };
}

function makeEntry(input: {
  claudeEvent?: BucketAEvent;
  args?: readonly string[];
  shell?: string;
}): RoutingEntry {
  const handlerDecl: Record<string, unknown> = { type: "command", command: "/bin/true" };
  if (input.args !== undefined) {
    handlerDecl.args = [...input.args];
  }

  if (input.shell !== undefined) {
    handlerDecl.shell = input.shell;
  }

  return {
    scope: "user",
    marketplace: "mp",
    pluginId: "test-plugin",
    resolvedSource: asAbsolutePluginRoot("/test/plugin-root"),
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

/**
 * Hermetic env: relocate PI_CODING_AGENT_DIR + HOME to fresh tmpdirs so
 * the user-scope arm does not read the developer's $HOME state.
 */
async function relocateAgent(t: import("node:test").TestContext): Promise<{
  agentDir: string;
  home: string;
  cwd: string;
}> {
  const agentDir = await mkdtemp(path.join(tmpdir(), "hooks-exec-arch-agent-"));
  const home = await mkdtemp(path.join(tmpdir(), "hooks-exec-arch-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "hooks-exec-arch-cwd-"));
  const prevAgent = process.env.PI_CODING_AGENT_DIR;
  const prevHome = process.env.HOME;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.HOME = home;
  t.after(async () => {
    if (prevAgent === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = prevAgent;
    }

    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    // A best-effort migration persist (write-file-atomic, fired off by
    // loadState without await) may still be renaming state.json.<rand> into
    // place when teardown runs; retry removal so the transient tmp entry does
    // not yield ENOTEMPTY on macOS.
    await rm(agentDir, { recursive: true, force: true, maxRetries: 10 });
    await rm(home, { recursive: true, force: true, maxRetries: 10 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10 });
  });
  return { agentDir, home, cwd };
}

function makePiMock(): { pi: ExtensionAPI; calls: string[] } {
  const calls: string[] = [];
  const onFn = (event: string): void => {
    calls.push(event);
  };

  const on = Object.assign(onFn, { bind: () => on });
  return { pi: { on } as unknown as ExtensionAPI, calls };
}

// ──────────────────────────────────────────────────────────────────────────
// Block A: EXEC-01 spawn cwd + env merge
// ──────────────────────────────────────────────────────────────────────────

test("Block A / EXEC-01: spawn called with options.cwd === ctx.cwd and CLAUDE_* env vars present", async (t) => {
  await relocateAgent(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(makeEntry({}), { toolName: "bash", input: {} }, makeCtx("/tmp/proj"));

  assert.equal(spy.calls.length, 1);
  const call = spy.calls[0];
  assert.ok(call !== undefined);
  assert.equal(call.options.cwd, "/tmp/proj");
  const env = call.options.env ?? {};
  assert.equal(env.CLAUDE_PROJECT_DIR, "/tmp/proj");
  // CLAUDE_PLUGIN_ROOT mirrors `RoutingEntry.resolvedSource` -- the actual
  // plugin source path on disk (state.json::resolvedSource), NOT a
  // synthesized `<extensionRoot>/plugins/<id>` path that never existed.
  assert.equal(env.CLAUDE_PLUGIN_ROOT, asAbsolutePluginRoot("/test/plugin-root"));
  assert.ok(env.CLAUDE_PLUGIN_DATA?.endsWith("/data/test-plugin") ?? false);
});

// ──────────────────────────────────────────────────────────────────────────
// Block B: EXEC-02 timer escalation + buffer caps + stdin truncation
// ──────────────────────────────────────────────────────────────────────────

test("Block B / EXEC-02: stdin > 256 KB injects top-level _truncated:true marker", async (t) => {
  await relocateAgent(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  const hugeText = "x".repeat(300 * 1024);
  await dispatchHookExec(
    makeEntry({ claudeEvent: "UserPromptSubmit" }),
    { text: hugeText },
    makeCtx("/tmp/proj"),
  );

  await new Promise((r) => setImmediate(r));
  const stdinText = spy.calls[0]?.stdinChunks.join("") ?? "";
  assert.ok(stdinText.includes('"_truncated":true'), "top-level _truncated marker missing");
});

test("CR-02 / Block B: stdin truncation accounts for UTF-8 bytes (CJK), not code units", async (t) => {
  await relocateAgent(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  // 120 K code units of "中" (U+4E2D, 3 UTF-8 bytes each) = 360 K bytes.
  // 360 K bytes > 256 KB cap; the marker MUST fire under byte-accurate
  // measurement. Under the old code-unit comparison this would fall
  // BELOW the cap (120 K < 262 144) and the marker would be omitted.
  const cjk = "中".repeat(120 * 1024);
  await dispatchHookExec(
    makeEntry({ claudeEvent: "UserPromptSubmit" }),
    { text: cjk },
    makeCtx("/tmp/proj"),
  );

  await new Promise((r) => setImmediate(r));
  const stdinText = spy.calls[0]?.stdinChunks.join("") ?? "";
  assert.ok(
    stdinText.includes('"_truncated":true'),
    "CR-02: top-level _truncated marker missing on CJK payload that exceeds 256 KB UTF-8",
  );
});

test("Block B / EXEC-02: stdout > 1 MB triggers SIGTERM + noop", async (t) => {
  await relocateAgent(t);
  const spy = installSpawnSpy(t, (h) => {
    // Push > 1 MB and observe the kill.
    h.emitStdout("x".repeat(1024 * 1024 + 10));
    setImmediate(() => {
      h.emitClose(0);
    });
  });

  const result = await dispatchHookExec(
    makeEntry({}),
    { toolName: "bash", input: {} },
    makeCtx("/tmp/proj"),
  );

  assert.deepEqual(result, { kind: "noop" });
  const killSignals = spy.children[0]?.killCalls() ?? [];
  assert.ok(killSignals.includes("SIGTERM"), "expected SIGTERM on stdout overflow");
});

// ──────────────────────────────────────────────────────────────────────────
// Block C: EXEC-03 stderr -> hookDebugLog sole sink
// ──────────────────────────────────────────────────────────────────────────

test("Block C / EXEC-03: dispatch-exec.ts contains ZERO non-comment ctx.ui.notify references", async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(
    __dirname,
    "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
  );
  const source = await readFile(filePath, "utf8");
  const offenders: string[] = [];
  for (const [i, line] of source.split("\n").entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
      continue;
    }

    if (trimmed === "" || trimmed.startsWith("/*")) {
      continue;
    }

    if (line.includes("ctx.ui.notify")) {
      offenders.push(`${(i + 1).toString()}: ${line}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `EXEC-03 violation: dispatch-exec.ts has live ctx.ui.notify references:\n${offenders.join(
      "\n",
    )}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block D: EXEC-04 exec-form vs shell-form
// ──────────────────────────────────────────────────────────────────────────

interface ExecFormFixture {
  readonly name: string;
  readonly args: readonly string[] | undefined;
  readonly shell: string | undefined;
  readonly expectShell: boolean | string;
}

const EXEC_FORM_FIXTURES: readonly ExecFormFixture[] = [
  {
    name: "args undefined -> shell-form (shell:true)",
    args: undefined,
    shell: undefined,
    expectShell: true,
  },
  {
    name: "args:[] (empty) -> exec-form (shell:false)",
    args: [],
    shell: undefined,
    expectShell: false,
  },
  {
    name: 'args:["x"] -> exec-form (shell:false)',
    args: ["x"],
    shell: undefined,
    expectShell: false,
  },
  {
    name: "shell:/bin/zsh + no args -> shell-form with binary set",
    args: undefined,
    shell: "/bin/zsh",
    expectShell: "/bin/zsh",
  },
];

for (const fixture of EXEC_FORM_FIXTURES) {
  test(`Block D / EXEC-04: ${fixture.name}`, async (t) => {
    await relocateAgent(t);
    const spy = installSpawnSpy(t, (h) => {
      h.emitClose(0);
    });

    const entryInput: Parameters<typeof makeEntry>[0] = {};
    if (fixture.args !== undefined) {
      entryInput.args = fixture.args;
    }

    if (fixture.shell !== undefined) {
      entryInput.shell = fixture.shell;
    }

    await dispatchHookExec(
      makeEntry(entryInput),
      { toolName: "bash", input: {} },
      makeCtx("/tmp/proj"),
    );

    assert.equal(spy.calls[0]?.options.shell, fixture.expectShell);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Block E: HOOK-05 env-var presence per event
// ──────────────────────────────────────────────────────────────────────────

interface EnvFixture {
  readonly claudeEvent: BucketAEvent;
  readonly event: unknown;
  readonly expectEnvFile: boolean;
}

const ENV_FIXTURES: readonly EnvFixture[] = [
  { claudeEvent: "SessionStart", event: { reason: "startup" }, expectEnvFile: true },
  { claudeEvent: "UserPromptSubmit", event: { text: "hello" }, expectEnvFile: false },
  { claudeEvent: "PreToolUse", event: { toolName: "bash", input: {} }, expectEnvFile: false },
  {
    claudeEvent: "PostToolUse",
    event: { toolName: "bash", input: {}, content: [], isError: false },
    expectEnvFile: false,
  },
  {
    claudeEvent: "PostToolUseFailure",
    event: { toolName: "bash", input: {}, content: [], isError: true },
    expectEnvFile: false,
  },
  { claudeEvent: "PreCompact", event: {}, expectEnvFile: false },
  { claudeEvent: "PostCompact", event: {}, expectEnvFile: false },
  { claudeEvent: "SessionEnd", event: { reason: "quit" }, expectEnvFile: false },
];

for (const fixture of ENV_FIXTURES) {
  test(`Block E / HOOK-05: ${fixture.claudeEvent} -- env vars present; CLAUDE_ENV_FILE ${
    fixture.expectEnvFile ? "set" : "unset"
  }; CLAUDE_CODE_REMOTE unset`, async (t) => {
    await relocateAgent(t);
    const spy = installSpawnSpy(t, (h) => {
      h.emitClose(0);
    });

    await dispatchHookExec(
      makeEntry({ claudeEvent: fixture.claudeEvent }),
      fixture.event,
      makeCtx("/tmp/proj"),
    );

    const env = spy.calls[0]?.options.env ?? {};
    assert.equal(env.CLAUDE_PROJECT_DIR, "/tmp/proj");
    assert.ok(env.CLAUDE_PLUGIN_ROOT !== undefined);
    assert.ok(env.CLAUDE_PLUGIN_DATA !== undefined);
    assert.equal(env.CLAUDE_CODE_REMOTE, undefined);
    if (fixture.expectEnvFile) {
      assert.ok(env.CLAUDE_ENV_FILE !== undefined);
    } else {
      assert.equal(env.CLAUDE_ENV_FILE, undefined);
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Block F: D-60-06 _shared dir mkdir-p + env-file path scheme
// ──────────────────────────────────────────────────────────────────────────

/**
 * Seed a minimal `state.json` + `hooks/<slug>/hooks.json` fixture under
 * `extensionRoot` so the bridge's hydrate path picks up a SessionStart
 * hook entry on rebuild. The gate inside `registerHooksBridge` skips the
 * `_shared` mkdir on a pristine scope (WR-05) -- the architecture pin
 * asserts the mkdir DOES fire once a real SessionStart hook is present.
 */
async function seedSessionStartPlugin(extensionRoot: string): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await mkdir(path.join(extensionRoot, "hooks", "ss-slug"), { recursive: true });
  await writeFile(
    path.join(extensionRoot, "hooks", "ss-slug", "hooks.json"),
    JSON.stringify({
      SessionStart: [
        {
          matcher: "",
          hooks: [{ type: "command", command: "/bin/true" }],
        },
      ],
    }),
  );
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({
      schemaVersion: 1,
      marketplaces: {
        mp: {
          name: "mp",
          scope: extensionRoot.includes("agent") ? "user" : "project",
          source: { kind: "path", raw: "/tmp/test" },
          addedFromCwd: "/tmp",
          manifestPath: "/tmp/test/marketplace.json",
          marketplaceRoot: "/tmp/test",
          plugins: {
            "ss-plugin": {
              version: "1.0.0",
              resolvedSource: asAbsolutePluginRoot("/test/"),
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: ["ss-slug"],
              },
              installedAt: "2026-06-14T00:00:00Z",
              updatedAt: "2026-06-14T00:00:00Z",
            },
          },
        },
      },
    }),
  );
}

test("Block F / D-60-06: _shared dir exists after registerHooksBridge under both scopes (when SessionStart plugin present)", async (t) => {
  _resetForTest();
  const { agentDir, cwd } = await relocateAgent(t);

  // Seed user + project scopes each with a SessionStart hook so the
  // ensureSharedDataDir gate fires.
  await seedSessionStartPlugin(path.join(agentDir, "pi-claude-marketplace"));
  await seedSessionStartPlugin(path.join(cwd, ".pi", "pi-claude-marketplace"));

  const { pi } = makePiMock();
  await registerHooksBridge(pi, { ctx: makeCtx(cwd), cwd });

  const userShared = path.join(agentDir, "pi-claude-marketplace", "data", "_shared");
  const projectShared = path.join(cwd, ".pi", "pi-claude-marketplace", "data", "_shared");
  const userStat = await stat(userShared);
  const projectStat = await stat(projectShared);
  assert.ok(userStat.isDirectory(), "user-scope _shared dir missing");
  assert.ok(projectStat.isDirectory(), "project-scope _shared dir missing");
});

test("Block F / D-60-06 / WR-05: clean scope -> NO _shared dir, NO scope file is created", async (t) => {
  _resetForTest();
  const { agentDir, cwd } = await relocateAgent(t);

  const { pi } = makePiMock();
  await registerHooksBridge(pi, { ctx: makeCtx(cwd), cwd });

  // The pi-claude-marketplace subdir must not be created on a clean
  // reconcile (WR-05 invariant in tests/edge/index-handler.test.ts).
  const userExt = path.join(agentDir, "pi-claude-marketplace");
  const projectExt = path.join(cwd, ".pi");
  await assert.rejects(
    () => stat(userExt),
    /ENOENT/,
    "WR-05: clean reconcile must NOT create user-scope extensionRoot",
  );
  await assert.rejects(
    () => stat(projectExt),
    /ENOENT/,
    "WR-05: clean reconcile must NOT create <cwd>/.pi",
  );
});

test("Block F / D-60-06: registerHooksBridge twice does not throw (idempotent)", async (t) => {
  _resetForTest();
  const { agentDir, cwd } = await relocateAgent(t);

  // Seed both scopes so the mkdir actually fires; idempotency is the
  // load-bearing claim -- the second call must not EEXIST against the
  // dir the first call created.
  await seedSessionStartPlugin(path.join(agentDir, "pi-claude-marketplace"));
  await seedSessionStartPlugin(path.join(cwd, ".pi", "pi-claude-marketplace"));

  const { pi } = makePiMock();
  await registerHooksBridge(pi, { ctx: makeCtx(cwd), cwd });
  await assert.doesNotReject(() => registerHooksBridge(pi, { ctx: makeCtx(cwd), cwd }));
});

test("registerHooksBridge tolerates a corrupt project-scope state.json (hydrate falls back to default state)", async (t) => {
  _resetForTest();
  const { cwd } = await relocateAgent(t);

  // Invalid JSON makes loadState throw (non-ENOENT) during factory-time
  // hydrate. The per-scope catch must swallow it and fall back to
  // DEFAULT_STATE so a corrupt state file in one scope does not block the
  // bridge from booting.
  const extRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  await mkdir(extRoot, { recursive: true });
  await writeFile(path.join(extRoot, "state.json"), "{ not valid json");

  const { pi } = makePiMock();
  await assert.doesNotReject(() => registerHooksBridge(pi, { ctx: makeCtx(cwd), cwd }));
});

test("Block F / D-60-06: SessionStart CLAUDE_ENV_FILE matches /data/_shared/claude-env-<sid>.env scheme", async (t) => {
  await relocateAgent(t);
  const spy = installSpawnSpy(t, (h) => {
    h.emitClose(0);
  });

  await dispatchHookExec(
    makeEntry({ claudeEvent: "SessionStart" }),
    { reason: "startup" },
    makeCtx("/tmp/proj"),
  );

  const envFile = spy.calls[0]?.options.env?.CLAUDE_ENV_FILE ?? "";
  assert.match(envFile, /[/\\]data[/\\]_shared[/\\]claude-env-[^/\\]+\.env$/);
});
