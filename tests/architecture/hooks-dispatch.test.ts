// Architecture-level invariant pins for the hooks-bridge dispatch core
// (DISP-01 / DISP-02 / DISP-03 / DISP-04 / OBS-01 / D-59-01 / D-59-05).
//
// Each block in this file pins one load-bearing decision that is a single
// textual diff away from regression. If any test red-fails CI, a future
// contributor inadvertently reverted a locked invariant.
//
// Technique:
//   - Block 1: factory-time pi.on count + locked event-name set, verified
//     by invoking registerHooksBridge against a synthetic Pi mock that
//     records each `on(event, handler)` call.
//   - Block 2: 8-bucket routing-table keyset after rebuild, against a
//     synthetic ExtensionState + hand-built HooksConfig fixture.
//   - Block 3: cross-plugin sort order + within-plugin declaration order,
//     against multi-plugin fixtures spanning user + project scopes.
//   - Block 4: epoch-mismatch no-op via _bumpEpochForTest; pinned at the
//     composite-handler boundary so the contract holds at the same surface
//     a future Pi loader reload would exercise.
//   - Block 5: tool_result event.isError split into PostToolUse vs.
//     PostToolUseFailure buckets, against a routing-table fixture with
//     entries in both buckets.
//   - Block 6: OBS-01 sole-seam import-graph scan (console.error appears
//     only in shared/debug-log.ts) + the eslint.config.js per-file
//     override scopes the console allowance to that single file.
//   - Block 7: D-59-05 legacy hookDebugLog stub removed from
//     domain/components/hooks.ts; the import is rewired to
//     shared/debug-log.ts and the three call sites are preserved.

import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compositeHandlerFor,
  toolResultCompositeHandler,
  _resetExecutorForTest,
  _setExecutorForTest,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import {
  addPluginConfigToCache,
  currentEpoch,
  rebuildRoutingTables,
  registerHooksBridge,
  _bumpEpochForTest,
  _resetForTest,
  _routingTableForTest,
  _setRoutingBucketForTest,
  type RoutingEntry,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import {
  BUCKET_A_EVENTS,
  type BucketAEvent,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import { parseMatcher } from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { HooksConfig } from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Test fixtures + helpers
// ──────────────────────────────────────────────────────────────────────────

// Synthetic Pi mock: records each pi.on call's event name into a calls
// array. The `.bind(pi)` typed-binding pattern used at index.ts requires
// `on` to expose a `bind` method that returns the same function; the
// inline Object.assign satisfies that interface without pulling the full
// ExtensionAPI surface into the mock.
interface PiMock {
  readonly on: ((event: string, handler: unknown) => void) & {
    bind: (thisArg: unknown) => PiMock["on"];
  };
  readonly calls: string[];
}

function makePiMock(): PiMock {
  const calls: string[] = [];
  const onFn = (event: string, _handler: unknown): void => {
    calls.push(event);
  };

  const on = Object.assign(onFn, { bind: () => on });
  return { on, calls };
}

function makeState(input: {
  marketplaces: Record<
    string,
    { scope: "user" | "project"; plugins: Record<string, { hooks: string[] }> }
  >;
}): ExtensionState {
  const marketplaces: ExtensionState["marketplaces"] = {};
  for (const [mpName, mp] of Object.entries(input.marketplaces)) {
    const plugins: (typeof marketplaces)[string]["plugins"] = {};
    for (const [pluginId, plugin] of Object.entries(mp.plugins)) {
      plugins[pluginId] = {
        version: "1.0.0",
        resolvedSource: "test://",
        compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
        resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: plugin.hooks },
        installedAt: "2026-06-14T00:00:00Z",
        updatedAt: "2026-06-14T00:00:00Z",
      };
    }

    marketplaces[mpName] = {
      name: mpName,
      scope: mp.scope,
      source: { kind: "path", raw: "/tmp/test" },
      addedFromCwd: "/tmp",
      manifestPath: "/tmp/test/marketplace.json",
      marketplaceRoot: "/tmp/test",
      plugins,
    };
  }

  return { schemaVersion: 1, marketplaces };
}

function makeConfig(
  arms: Array<{ event: string; matcher?: string; handlers: number }>,
): HooksConfig {
  const out: Record<
    string,
    Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }>
  > = {};
  for (const arm of arms) {
    const groups = out[arm.event] ?? [];
    const hooks = Array.from({ length: arm.handlers }, (_v, i) => ({
      type: "command",
      command: `echo handler-${i.toString()}`,
    }));
    const group: { matcher?: string; hooks: Array<{ type: string; command: string }> } = { hooks };
    if (arm.matcher !== undefined) {
      group.matcher = arm.matcher;
    }

    groups.push(group);
    out[arm.event] = groups;
  }

  return out;
}

function makeEntry(input: {
  scope?: "user" | "project";
  pluginId: string;
  claudeEvent?: BucketAEvent;
  rawMatcher?: string;
  command?: string;
  declarationIndex?: number;
}): RoutingEntry {
  const rawMatcher = input.rawMatcher ?? "";
  return {
    scope: input.scope ?? "user",
    marketplace: "mp",
    pluginId: input.pluginId,
    claudeEvent: input.claudeEvent ?? "PreToolUse",
    matcher: parseMatcher(rawMatcher),
    rawMatcher,
    handlerDecl: { type: "command", command: input.command ?? `echo ${input.pluginId}` },
    declarationIndex: input.declarationIndex ?? 0,
  };
}

const stubCtx = {} as unknown as ExtensionContext;

// Walk an extension subdirectory recursively, returning every .ts file
// path (relative to the repo root). Used by Block 6's import-graph scan.
async function collectExtensionTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
        continue;
      }

      const nested = await collectExtensionTsFiles(full);
      out.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }

  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Block 1: DISP-01 -- registerHooksBridge calls pi.on exactly 7 times with
// the locked event-name set
// ──────────────────────────────────────────────────────────────────────────

test("DISP-01: registerHooksBridge calls pi.on exactly 7 times with the locked Pi event names", async () => {
  _resetForTest();

  // WR-04: hermetic env. Without this, the user-scope hydrate arm resolves
  // `getAgentDir()` which reads `PI_CODING_AGENT_DIR` or defaults to
  // `~/.pi/agent`, pulling the developer's real $HOME state into the test.
  // The 7-handler assertion does not depend on hydrate output today, but a
  // future invariant added to this test must not be silently bypassed by
  // ambient $HOME state. Mirrors `withHermeticEnv` in
  // tests/edge/index-handler.test.ts.
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "hd-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "hd-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;

  try {
    const piMock = makePiMock();

    await registerHooksBridge(piMock as unknown as ExtensionAPI, {
      ctx: stubCtx,
      cwd,
    });

    assert.equal(
      piMock.calls.length,
      7,
      `expected 7 pi.on calls, got ${piMock.calls.length.toString()}: ${piMock.calls.join(",")}`,
    );

    const locked = new Set([
      "session_start",
      "session_shutdown",
      "session_before_compact",
      "session_compact",
      "input",
      "tool_call",
      "tool_result",
    ]);
    assert.deepEqual(
      new Set(piMock.calls),
      locked,
      "pi.on event-name set drifted from the locked 7-tuple",
    );
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 2: DISP-02 -- rebuildRoutingTables produces exactly the
// BUCKET_A_EVENTS 8-tuple keyset
// ──────────────────────────────────────────────────────────────────────────

test("DISP-02: rebuildRoutingTables produces exactly the BUCKET_A_EVENTS keyset (8 buckets)", () => {
  _resetForTest();

  const config = makeConfig([
    { event: "SessionStart", handlers: 1 },
    { event: "UserPromptSubmit", handlers: 1 },
    { event: "PreToolUse", handlers: 1 },
    { event: "PostToolUse", handlers: 1 },
    { event: "PostToolUseFailure", handlers: 1 },
    { event: "PreCompact", handlers: 1 },
    { event: "PostCompact", handlers: 1 },
    { event: "SessionEnd", handlers: 1 },
  ]);
  addPluginConfigToCache("user", "mp", "p1", config);

  const state = makeState({
    marketplaces: { mp: { scope: "user", plugins: { p1: { hooks: ["slug-p1"] } } } },
  });
  rebuildRoutingTables(state, locationsFor("user", "/tmp/cwd"));

  const tableKeys = Array.from(_routingTableForTest().keys()).sort();
  const expectedKeys = [...BUCKET_A_EVENTS].sort();
  assert.deepEqual(tableKeys, expectedKeys, "routingTable keyset drifted from BUCKET_A_EVENTS");
});

// ──────────────────────────────────────────────────────────────────────────
// Block 3: DISP-04 -- cross-plugin and within-plugin ordering
// ──────────────────────────────────────────────────────────────────────────

test("DISP-04: cross-plugin sort matches compareByNameThenScope (alphabetical, project breaks ties)", () => {
  _resetForTest();

  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  // Three plugins under DISTINCT pluginIds (alpha, beta, gamma) span both
  // scopes. compareByNameThenScope sorts primarily by name; the
  // project-before-user tie-breaker only fires on same-name pairs. With
  // distinct names the expected cross-plugin order is strictly alphabetical.
  addPluginConfigToCache("user", "mp", "alpha", config);
  addPluginConfigToCache("project", "mp", "beta", config);
  addPluginConfigToCache("project", "mp", "gamma", config);

  // Per-scope rebuild (the production wiring fires rebuildRoutingTables once
  // per scope inside applyReconcile's per-scope loop). Project goes first so
  // user's rebuild for this test reads the second snapshot.
  rebuildRoutingTables(
    makeState({
      marketplaces: {
        mp: {
          scope: "project",
          plugins: { beta: { hooks: ["s-beta"] }, gamma: { hooks: ["s-gamma"] } },
        },
      },
    }),
    locationsFor("project", "/tmp/cwd"),
  );
  const projectBucket = _routingTableForTest().get("PreToolUse") ?? [];
  assert.deepEqual(
    projectBucket.map((e) => e.pluginId),
    ["beta", "gamma"],
    "project-scope bucket order drifted from alphabetical",
  );

  rebuildRoutingTables(
    makeState({
      marketplaces: { mp: { scope: "user", plugins: { alpha: { hooks: ["s-alpha"] } } } },
    }),
    locationsFor("user", "/tmp/cwd"),
  );
  const userBucket = _routingTableForTest().get("PreToolUse") ?? [];
  assert.deepEqual(
    userBucket.map((e) => e.pluginId),
    ["alpha"],
    "user-scope bucket order drifted from alphabetical",
  );
});

test("DISP-04: within-plugin declaration order preserved via monotonic declarationIndex", () => {
  _resetForTest();

  // Two PreToolUse groups in the same plugin: group 0 has 2 handlers,
  // group 1 has 1. Flattened bucket order MUST preserve the (group, handler)
  // source order: g0[h0], g0[h1], g1[h0].
  const config = makeConfig([
    { event: "PreToolUse", matcher: "", handlers: 2 },
    { event: "PreToolUse", matcher: "", handlers: 1 },
  ]);
  addPluginConfigToCache("user", "mp", "p1", config);

  rebuildRoutingTables(
    makeState({
      marketplaces: { mp: { scope: "user", plugins: { p1: { hooks: ["slug"] } } } },
    }),
    locationsFor("user", "/tmp/cwd"),
  );

  const bucket = _routingTableForTest().get("PreToolUse") ?? [];
  assert.equal(bucket.length, 3, "expected 3 handler entries flattened from 2 groups");
  assert.deepEqual(
    bucket.map((e) => e.declarationIndex),
    [0, 1, 2],
    "declarationIndex must be monotonic from 0",
  );
  assert.deepEqual(
    bucket.map((e) => e.handlerDecl["command"]),
    ["echo handler-0", "echo handler-1", "echo handler-0"],
    "handler commands must follow declaration order across groups",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 4: DISP-03 -- epoch mismatch causes composite handler to no-op
// ──────────────────────────────────────────────────────────────────────────

test("DISP-03: composite handler with stale capturedEpoch no-ops without invoking dispatchHookExec", async (t) => {
  _resetForTest();

  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [makeEntry({ pluginId: "p1" })]);

  // Capture an epoch value, then bump the live cell so the handler's
  // captured value is stale. Per the dispatch.ts epoch defense, the
  // composite handler returns early on mismatch and dispatchHookExec is
  // never invoked. RESEARCH note: the load-bearing zombie defense in
  // production is Pi's _extensionRunner swap; this test pins the
  // belt-and-suspenders epoch path in isolation against an in-process
  // simulated reload.
  const stale = currentEpoch();
  _bumpEpochForTest();
  assert.notEqual(stale, currentEpoch(), "epoch must advance to simulate reload");

  const handler = compositeHandlerFor("PreToolUse", stale);
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "bash", input: { command: "ls" } },
    stubCtx,
  );

  assert.deepEqual(fired, [], "epoch mismatch must short-circuit before dispatchHookExec");
});

// ──────────────────────────────────────────────────────────────────────────
// Block 5: D-59-01 -- tool_result composite handler reads event.isError
// and dispatches to the correct bucket
// ──────────────────────────────────────────────────────────────────────────

test("D-59-01: toolResultCompositeHandler routes isError=true to PostToolUseFailure bucket", async (t) => {
  _resetForTest();

  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  // Pre-populate BOTH buckets so the test pins which one is selected by
  // event.isError truthy, not coincidental empty-bucket fall-through.
  _setRoutingBucketForTest("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  _setRoutingBucketForTest("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch());
  await handler(
    {
      type: "tool_result",
      toolCallId: "x",
      toolName: "bash",
      input: {},
      content: [],
      isError: true,
      details: undefined,
    } as unknown as ToolResultEvent,
    stubCtx,
  );

  assert.deepEqual(fired, ["p-failure"], "isError=true must route to PostToolUseFailure");
});

test("D-59-01: toolResultCompositeHandler routes isError=false to PostToolUse bucket", async (t) => {
  _resetForTest();

  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  _setRoutingBucketForTest("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch());
  await handler(
    {
      type: "tool_result",
      toolCallId: "x",
      toolName: "bash",
      input: {},
      content: [],
      isError: false,
      details: undefined,
    } as unknown as ToolResultEvent,
    stubCtx,
  );

  assert.deepEqual(fired, ["p-success"], "isError=false must route to PostToolUse");
});

// ──────────────────────────────────────────────────────────────────────────
// Block 6: OBS-01 -- shared/debug-log.ts is the sole runtime debug-output
// module (import-graph scan + eslint.config.js override scope)
// ──────────────────────────────────────────────────────────────────────────

test("OBS-01: console.error appears ONLY in shared/debug-log.ts within the extension source tree", async () => {
  const extensionRoot = path.join(process.cwd(), "extensions", "pi-claude-marketplace");
  const root = await stat(extensionRoot);
  assert.ok(root.isDirectory(), "extension root must exist");

  const files = await collectExtensionTsFiles(extensionRoot);
  assert.ok(files.length > 0, "extension source scan returned zero .ts files");

  const consoleErrorPattern = /(?:^|[^.\w])console\.error\s*\(/;
  const offenders: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (consoleErrorPattern.test(text)) {
      const relative = path.relative(extensionRoot, file);
      offenders.push(relative);
    }
  }

  assert.deepEqual(
    offenders.sort(),
    ["shared/debug-log.ts"],
    `console.error appears outside shared/debug-log.ts: ${offenders.join(", ")}`,
  );
});

test("OBS-01: eslint.config.js scopes the no-console allowance to shared/debug-log.ts only (within extension)", async () => {
  const configPath = path.join(process.cwd(), "eslint.config.js");
  const text = await readFile(configPath, "utf8");

  // Block 1: the per-file override for shared/debug-log.ts must declare
  // `no-console: off` (anchoring substring near each other in the file).
  const debugLogScope = "extensions/pi-claude-marketplace/shared/debug-log.ts";
  assert.ok(
    text.includes(debugLogScope),
    "eslint.config.js must declare a per-file override for shared/debug-log.ts",
  );

  // Block 2: the only sanctioned no-console allowances under
  // extensions/pi-claude-marketplace/** are the three documented files:
  // shared/notify.ts (IL-2 sanctioned ctx.ui.notify site), shared/debug-log.ts
  // (OBS-01 / D-59-05), persistence/migrate.ts (IL-3 legacy migration).
  // A future contributor who widens the allowance must amend the
  // expected list below in lockstep so the architectural intent is visible
  // in code review.
  //
  // We approximate "files override targets" by scanning each `files:`
  // single-line array literal that mentions the extension root, then
  // verifying the surrounding object disables `no-console`.
  const filesArrayPattern = /files:\s*\[([^\]]+)\]/g;
  const allowedSet = new Set<string>();
  for (const match of text.matchAll(filesArrayPattern)) {
    const arr = match[1] ?? "";
    if (!arr.includes("extensions/pi-claude-marketplace")) {
      continue;
    }

    // Look at the following ~600 chars for a `no-console: "off"` toggle.
    // `s` flag implicit -- the regex is anchored to a small slice.
    const tailStart = match.index ?? 0;
    const tail = text.slice(tailStart, tailStart + 600);
    if (!/["']no-console["']\s*:\s*["']off["']/.test(tail)) {
      continue;
    }

    const paths = Array.from(arr.matchAll(/"([^"]+)"/g)).map((m) => m[1] ?? "");
    for (const p of paths) {
      allowedSet.add(p);
    }
  }

  assert.ok(allowedSet.size > 0, "no per-file no-console override found for extension files");

  const expected = new Set([
    "extensions/pi-claude-marketplace/shared/notify.ts",
    "extensions/pi-claude-marketplace/shared/debug-log.ts",
    "extensions/pi-claude-marketplace/persistence/migrate.ts",
  ]);

  // Symmetric difference -- any drift in either direction red-fails.
  for (const p of allowedSet) {
    assert.ok(
      expected.has(p),
      `unexpected no-console allowance for ${p} (only notify.ts / debug-log.ts / migrate.ts may toggle off)`,
    );
  }

  for (const p of expected) {
    assert.ok(allowedSet.has(p), `expected no-console allowance for ${p} not found`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 7: D-59-05 -- legacy hookDebugLog stub removed from
// domain/components/hooks.ts; import rewired; call sites preserved
// ──────────────────────────────────────────────────────────────────────────

test("D-59-05: domain/components/hooks.ts no longer exports hookDebugLog", async () => {
  const hooksPath = path.join(
    process.cwd(),
    "extensions",
    "pi-claude-marketplace",
    "domain",
    "components",
    "hooks.ts",
  );
  const text = await readFile(hooksPath, "utf8");

  // Stub export gone: no `export function hookDebugLog` or
  // `export const hookDebugLog` at the start of any line.
  const exportPattern = /^export\s+(?:function|const|let|var)\s+hookDebugLog\b/m;
  assert.ok(
    !exportPattern.test(text),
    "hookDebugLog export must be gone from domain/components/hooks.ts (D-59-05)",
  );

  // Import rewired to the OBS-01 seam.
  const importPattern = /from\s+["']\.\.\/\.\.\/shared\/debug-log\.ts["']/m;
  assert.ok(
    importPattern.test(text),
    "domain/components/hooks.ts must import hookDebugLog from ../../shared/debug-log.ts (D-59-05)",
  );

  // Three call sites preserved (parseHooksConfig JSON-parse failure,
  // schema-validation failure, supportability failure arms).
  const callMatches = text.match(/hookDebugLog\s*\(/g) ?? [];
  assert.ok(
    callMatches.length >= 3,
    `expected >= 3 hookDebugLog call sites in domain/components/hooks.ts, found ${callMatches.length.toString()}`,
  );
});
