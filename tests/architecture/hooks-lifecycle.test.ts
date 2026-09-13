// Architecture-level invariant pins for the hooks-bridge lifecycle
// hardening contract (WR-01 / WR-03 / D-60-05).
//
// Each block pins one load-bearing decision that is a single textual diff
// away from regression. If any block red-fails CI, a future contributor
// inadvertently reverted a locked invariant.
//
// Technique:
//   - Blocks A-D: read each orchestrator's source on disk, strip comment
//     lines, then assert that the cache-mutation call (`addPluginConfigToCache`
//     / `removePluginConfigFromCache`) is followed within a bounded window
//     by `rebuildRoutingTables` on a non-comment line. The bounded window
//     forces the call-site to live INSIDE the same per-plugin lock body
//     rather than in an entirely different code path.
//   - Block E: WR-01 clear-cache prefix on `hydrateProjectScopeForCwd` --
//     a `deleteParsedConfig` call must appear
//     INSIDE the function body BEFORE any other significant statement, so
//     phantom project-arm entries cannot leak past the re-hydrate path.
//   - Block F: negative pin. Iterate every `orchestrators/plugin/*.ts`
//     and assert that any file mutating the parsed-config cache also calls
//     `rebuildRoutingTables` in the same file (catches a future orchestrator
//     that adds a cache mutation without the rebuild). `apply.ts` is not
//     under `orchestrators/plugin/` so it is not relevant to this scan.

import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createHooksHydration } from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { readHooksJson } from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createHooksRuntime } from "../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import { HOOKS_LIFECYCLE_TARGETS, PLUGIN_ORCHESTRATORS_REL } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

import type { HooksHydrationDeps } from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// D-07-05: the four orchestrators this gate pins and the event-router where the
// WR-01 prefix lives come from `HOOKS_LIFECYCLE_TARGETS`, so a literal-match
// stale-path scan of the registry sees every one of them. The group is a tuple,
// so destructuring binds by POSITION -- which is why every read below states the
// basename it expects and `readTargetSource` proves it.
const [INSTALL_REL, UNINSTALL_REL, REINSTALL_REL, UPDATE_REL, EVENT_ROUTER_REL] =
  HOOKS_LIFECYCLE_TARGETS;

/**
 * Read one registry target, proving first that the constant bound here really
 * addresses the module the caller names and second that the read produced text.
 *
 * D-07-05: the basename check is the positive control for a positionally-bound
 * name. Reordering the registry group rebinds all five local names at once, and
 * every block below would go on passing over the wrong file with no signal.
 *
 * D-07-03: an empty read means the block matched its patterns against nothing,
 * which is a gate reporting success over a target it never really inspected.
 */
async function readTargetSource(rel: string, expectedBasename: string): Promise<string> {
  assert.strictEqual(
    path.posix.basename(rel),
    expectedBasename,
    `D-07-05: this block pins ${expectedBasename}, but the registry target bound to it is ${rel}`,
  );
  const raw = await readFile(path.join(REPO_ROOT, rel), "utf8");
  assert.ok(
    raw.length > 0,
    `D-07-03: ${rel} read as empty, so this block scanned nothing and would report success over an uninspected target`,
  );
  return raw;
}

/**
 * Read a TypeScript source file from disk and return its lines after
 * stripping (a) full-line `//` comments and (b) blank lines. Inline `//`
 * tail-comments are left intact -- the call-site greps run against
 * substrings that survive trailing comments. The strip is intentionally
 * coarse (no block-comment / template-literal handling) because the
 * orchestrator source convention places significant code lines outside
 * `/* ... *\/` blocks; if a future regression hides a regression-inducing
 * statement inside a block comment, that diff will surface in the
 * accompanying behavioral test rather than this static pin.
 */
async function readNonCommentLines(rel: string, expectedBasename: string): Promise<string[]> {
  const raw = await readTargetSource(rel, expectedBasename);
  return raw
    .split("\n")
    .map((line) => line)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        return false;
      }

      if (trimmed.startsWith("//")) {
        return false;
      }

      return true;
    });
}

/**
 * Assert that within `nonCommentLines`, the first non-comment line that
 * contains `mutator` is followed within `window` subsequent non-comment
 * lines by a line that contains `rebuilder`. Used by Blocks A-D to pin
 * the cache-mutation -> rebuild call-site adjacency.
 */
function assertMutatorFollowedByRebuilder(
  nonCommentLines: readonly string[],
  mutator: string,
  rebuilder: string,
  window: number,
  context: string,
): void {
  for (let i = 0; i < nonCommentLines.length; i += 1) {
    const line = nonCommentLines[i];
    if (!line?.includes(mutator)) {
      continue;
    }

    // Skip import statements (they reference the symbol but are not the
    // call site we want to pin).
    if (/\bimport\b/.test(line)) {
      continue;
    }

    // Skip function declarations / signatures (the helper's own def line
    // includes its name but is not the call site). Recognize the two
    // canonical TS shapes: `function name(` and `async function name(`.
    if (/\b(?:async\s+)?function\s+\w+\s*\(/.test(line)) {
      continue;
    }

    const slice = nonCommentLines.slice(i + 1, i + 1 + window);
    const hit = slice.some((l) => l.includes(rebuilder));
    assert.ok(
      hit,
      `${context}: expected '${rebuilder}' within ${String(window)} non-comment lines after '${mutator}' (line index ${String(i)})`,
    );
    return;
  }

  assert.fail(`${context}: no non-import call site for '${mutator}' found in source`);
}

// ──────────────────────────────────────────────────────────────────────────
// Block A: WR-03 -- install-flow.ts cache mutation -> rebuildRoutingTables
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block A: install flow pairs the cache-mutation site with rebuildRoutingTables in lockstep", async () => {
  const lines = await readNonCommentLines(INSTALL_REL, "install-flow.ts");

  // install-flow.ts wraps the cache-add in the bridge helper
  // `readAndCachePluginHooks` because the call ALSO performs the disk read
  // + parse of the just-installed `<pluginRoot>/hooks/hooks.json`. The
  // orchestrator invocation site is the helper call
  // (`await readAndCachePluginHooks({...})`), and the rebuild must follow
  // IT -- not the inner `addPluginConfigToCache(...)` line buried in the
  // helper body. Pin whichever form the source uses (helper, helper's
  // predecessor `addInstalledPluginHooksToCache`, or the bare cache
  // mutator) so a future refactor that inlines or renames stays gated.
  const HELPER_FORMS = [
    "readAndCachePluginHooks(",
    "addInstalledPluginHooksToCache(",
    "addPluginConfigToCache(",
  ];
  const mutator = HELPER_FORMS.find((form) =>
    lines.some((l) => l.includes(form) && !/\bimport\b/.test(l)),
  );
  assert.ok(
    mutator,
    `install-flow.ts: no cache-mutation call site found (tried ${HELPER_FORMS.join(", ")})`,
  );
  assertMutatorFollowedByRebuilder(lines, mutator, "rebuildRoutingTables(", 20, "install-flow.ts");
});

// ──────────────────────────────────────────────────────────────────────────
// Block B: WR-03 -- uninstall.ts removePluginConfigFromCache -> rebuild
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block B: uninstall.ts pairs removePluginConfigFromCache with rebuildRoutingTables in lockstep", async () => {
  const lines = await readNonCommentLines(UNINSTALL_REL, "uninstall.ts");
  assertMutatorFollowedByRebuilder(
    lines,
    "removePluginConfigFromCache(",
    "rebuildRoutingTables(",
    20,
    "uninstall.ts",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block C: WR-03 / D-60-05 -- reinstall-flow.ts explicit remove + add + rebuild
// inside the per-plugin lock. The mutator pair lives in `runLockedReinstall`
// (the re-install does NOT delegate to install/uninstall, so the wiring
// must be present in THIS file -- D-60-05 audit closure).
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block C: reinstall-flow.ts wires remove + add + rebuildRoutingTables in its per-plugin lock", async () => {
  const lines = await readNonCommentLines(REINSTALL_REL, "reinstall-flow.ts");

  // Both cache mutators must appear as call sites (not just imports). The
  // add-side may flow through the bridge helper `readAndCachePluginHooks`
  // which wraps `addPluginConfigToCache` with the disk read + parse.
  const hasRemove = lines.some(
    (l) => l.includes("removePluginConfigFromCache(") && !/\bimport\b/.test(l),
  );
  const hasAdd = lines.some(
    (l) =>
      (l.includes("addPluginConfigToCache(") || l.includes("readAndCachePluginHooks(")) &&
      !/\bimport\b/.test(l),
  );
  const hasRebuild = lines.some(
    (l) => l.includes("rebuildRoutingTables(") && !/\bimport\b/.test(l),
  );
  assert.ok(hasRemove, "reinstall-flow.ts: missing removePluginConfigFromCache call site");
  assert.ok(
    hasAdd,
    "reinstall-flow.ts: missing addPluginConfigToCache / readAndCachePluginHooks call site",
  );
  assert.ok(hasRebuild, "reinstall-flow.ts: missing rebuildRoutingTables call site");

  // The remove must be followed within window by the rebuild call.
  assertMutatorFollowedByRebuilder(
    lines,
    "removePluginConfigFromCache(",
    "rebuildRoutingTables(",
    30,
    "reinstall-flow.ts",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block D: WR-03 / D-60-05 -- update-swap.ts explicit remove + add + rebuild
// inside the per-plugin lock. Same gap as reinstall (no delegation).
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block D: update-swap.ts wires remove + add + rebuildRoutingTables in its per-plugin lock", async () => {
  const lines = await readNonCommentLines(UPDATE_REL, "update-swap.ts");

  const hasRemove = lines.some(
    (l) => l.includes("removePluginConfigFromCache(") && !/\bimport\b/.test(l),
  );
  const hasAdd = lines.some(
    (l) =>
      (l.includes("addPluginConfigToCache(") || l.includes("readAndCachePluginHooks(")) &&
      !/\bimport\b/.test(l),
  );
  const hasRebuild = lines.some(
    (l) => l.includes("rebuildRoutingTables(") && !/\bimport\b/.test(l),
  );
  assert.ok(hasRemove, "update-swap.ts: missing removePluginConfigFromCache call site");
  assert.ok(
    hasAdd,
    "update-swap.ts: missing addPluginConfigToCache / readAndCachePluginHooks call site",
  );
  assert.ok(hasRebuild, "update-swap.ts: missing rebuildRoutingTables call site");

  assertMutatorFollowedByRebuilder(
    lines,
    "removePluginConfigFromCache(",
    "rebuildRoutingTables(",
    30,
    "update-swap.ts",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block E: WR-01 -- hydrateProjectScopeForCwdWith opens with a clear-cache
// prefix that drops phantom project-arm entries BEFORE the re-hydrate
// loop. The prefix must precede the existing `loadState` / `hydrateScopeFromState`
// calls so the rebuild never observes stale entries.
// ──────────────────────────────────────────────────────────────────────────

test("WR-01 Block E: event-router.ts::hydrateProjectScopeForCwdWith opens with a deleteParsedConfig prefix", async () => {
  const raw = await readTargetSource(EVENT_ROUTER_REL, "event-router.ts");

  // Locate the function body. The function is declared as
  // `async function hydrateProjectScopeForCwdWith(...) { ... }`.
  // Grab everything between the opening brace and the matching closing
  // brace via a forgiving regex (the function body has no nested braces
  // at depth > 1 in current source; if a future contributor adds a
  // block-statement inside, the regex still matches the first balanced
  // pair via the lazy `[\s\S]*?` and a tail anchor of `\n}`).
  const match = /async function hydrateProjectScopeForCwdWith[^{]*\{([\s\S]*?)\n\}/.exec(raw);
  assert.ok(
    match !== null,
    "event-router.ts: could not locate hydrateProjectScopeForCwdWith function body",
  );
  const body = match[1] ?? "";

  // The WR-01 prefix must contain a delete-from-the-cache call.
  assert.match(
    body,
    /deleteParsedConfig\b/,
    "WR-01: hydrateProjectScopeForCwdWith must call deleteParsedConfig to drop phantom entries",
  );

  // The delete call must precede the load-state-then-rehydrate calls so
  // the phantom entries cannot leak past the re-hydrate path. Find the
  // first occurrence of each token and assert the delete comes first.
  const deleteIdx = body.search(/deleteParsedConfig\b/);
  const loadIdx = body.search(/loadState\(/);
  const hydrateIdx = body.search(/hydrateScopeFromState\(/);
  assert.ok(deleteIdx >= 0, "WR-01: delete call missing from function body");
  assert.ok(loadIdx < 0 || deleteIdx < loadIdx, "WR-01: deleteParsedConfig must precede loadState");
  assert.ok(
    hydrateIdx < 0 || deleteIdx < hydrateIdx,
    "WR-01: deleteParsedConfig must precede hydrateScopeFromState",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block F: negative pin -- any orchestrators/plugin/*.ts that mutates the
// hooks-bridge parsed-config cache MUST also call rebuildRoutingTables in
// the same file. Defends against a future orchestrator silently widening
// the cache-mutation-without-rebuild surface.
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block F: every orchestrators/plugin/*.ts that mutates the cache also calls rebuildRoutingTables", async () => {
  const orchestratorDir = path.join(REPO_ROOT, PLUGIN_ORCHESTRATORS_REL);
  const entries = await readdir(orchestratorDir);
  const tsFiles = entries.filter((e) => e.endsWith(".ts") && !e.endsWith(".test.ts"));

  // D-07-03: a walk is a legitimate way to reach a set with no fixed
  // membership, but a walk over zero files is a gate reporting success over
  // nothing. Prove the directory really yielded modules before concluding that
  // none of them broke the invariant.
  assert.ok(
    tsFiles.length > 0,
    `D-07-03: walked ${PLUGIN_ORCHESTRATORS_REL} and found no .ts files, so this block inspected nothing`,
  );

  let scanned = 0;
  for (const file of tsFiles) {
    const filePath = path.join(orchestratorDir, file);
    const raw = await readFile(filePath, "utf8");

    // Identify cache-mutator call sites that are NOT inside import
    // statements. The regex matches a call expression `<symbol>(` that is
    // not preceded by `import ... ` on the same source line. We strip
    // import-statement lines first so the per-line check below stays
    // simple.
    const nonImportLines = raw.split("\n").filter((line) => !/^\s*import\b/.test(line));
    const nonImportText = nonImportLines.join("\n");

    const mutates =
      /\baddPluginConfigToCache\(/.test(nonImportText) ||
      /\bremovePluginConfigFromCache\(/.test(nonImportText);
    if (!mutates) {
      continue;
    }

    assert.ok(
      /\brebuildRoutingTables\(/.test(nonImportText),
      `${file}: mutates the hooks-bridge parsed-config cache but does NOT call rebuildRoutingTables in the same file -- silent NFR-2 regression`,
    );
    scanned += 1;
  }

  // Guard against a future refactor that moves the call sites elsewhere: the
  // scan MUST find at least the four wired lifecycle verbs (install,
  // uninstall, reinstall, update).
  assert.ok(
    scanned >= 4,
    `WR-03 Block F: expected at least 4 orchestrators with cache mutations + rebuild; found ${String(scanned)}`,
  );
});

test("same-runtime reload makes every retained registration inert before argument access", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "hooks-lifecycle-generation-"));
  const priorAgentRoot = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = path.join(root, "agent");
  t.after(async () => {
    if (priorAgentRoot === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = priorAgentRoot;
    }

    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });
  const readRoots: string[] = [];
  const reader: HooksHydrationDeps = {
    loadState(extensionRoot: string): Promise<ExtensionState> {
      readRoots.push(extensionRoot);
      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
    readHooksJson,
  };
  const registrations: Array<{ readonly event: string; readonly handler: unknown }> = [];
  const messages: unknown[] = [];
  const pi = {
    on(event: string, handler: unknown): void {
      registrations.push({ event, handler });
    },
    sendMessage(message: unknown): void {
      messages.push(message);
    },
  } as ExtensionAPI;
  const runtime = createHooksRuntime();
  const hydration = createHooksHydration(runtime, reader);
  const factoryRoot = path.join(root, "factory");
  const projectRoot = path.join(root, "project");
  const registrationContext = { cwd: factoryRoot } as ExtensionContext;
  await hydration.registerHooksBridge(pi, { ctx: registrationContext, cwd: factoryRoot });
  await hydration.registerHooksBridge(pi, { ctx: registrationContext, cwd: factoryRoot });
  const staleRegistrations = registrations.slice(0, 11);
  const liveRegistrations = registrations.slice(11);
  const registrationOrder = [
    "session_start",
    "session_shutdown",
    "session_before_compact",
    "session_compact",
    "input",
    "tool_call",
    "tool_result",
    "before_agent_start",
    "agent_end",
    "agent_settled",
    "input",
  ];
  const runtimeBefore = JSON.stringify({
    generation: runtime.currentGeneration(),
    cache: Array.from(runtime.parsedConfigEntries()),
    routes: Array.from(runtime.routingTableEntries()),
    pending: runtime.pendingSessionStartContextEntries(),
  });
  const readsBefore = [...readRoots];
  const forbiddenArgument = new Proxy(
    {},
    {
      get(_target, property): never {
        throw new Error(`stale callback read argument property ${String(property)}`);
      },
    },
  );

  // act
  for (const registration of staleRegistrations) {
    assert.strictEqual(typeof registration.handler, "function");
    const result = (registration.handler as (...args: unknown[]) => unknown)(
      forbiddenArgument,
      forbiddenArgument,
    );
    assert.strictEqual(await Promise.resolve(result), undefined);
  }

  const runtimeAfterStale = JSON.stringify({
    generation: runtime.currentGeneration(),
    cache: Array.from(runtime.parsedConfigEntries()),
    routes: Array.from(runtime.routingTableEntries()),
    pending: runtime.pendingSessionStartContextEntries(),
  });
  const liveSessionStart = liveRegistrations[0]?.handler;
  assert.strictEqual(typeof liveSessionStart, "function");
  const liveResult = (liveSessionStart as (...args: unknown[]) => unknown)(
    { type: "session_start", reason: "startup" },
    { cwd: projectRoot },
  );

  // assert
  assert.deepStrictEqual(
    registrations.map(({ event }) => event),
    [...registrationOrder, ...registrationOrder],
  );
  assert.deepStrictEqual(readRoots, [
    ...readsBefore,
    locationsFor("project", projectRoot).extensionRoot,
  ]);
  assert.strictEqual(runtimeAfterStale, runtimeBefore);
  assert.strictEqual(await Promise.resolve(liveResult), undefined);
  assert.deepStrictEqual(messages, []);
});
