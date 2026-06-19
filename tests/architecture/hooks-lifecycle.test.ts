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
//     a `parsedConfigCache.delete` (or `cache.delete`) call must appear
//     INSIDE the function body BEFORE any other significant statement, so
//     phantom project-arm entries cannot leak past the re-hydrate path.
//   - Block F: negative pin. Iterate every `orchestrators/plugin/*.ts`
//     and assert that any file mutating the parsed-config cache also calls
//     `rebuildRoutingTables` in the same file (catches a future orchestrator
//     that adds a cache mutation without the rebuild). `apply.ts` is not
//     under `orchestrators/plugin/` so it is not relevant to this scan.

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// Repo-relative paths to the four orchestrators we pin + the event-router
// where the WR-01 prefix lives.
const ORCH_DIR = path.join(
  import.meta.dirname,
  "../../extensions/pi-claude-marketplace/orchestrators/plugin",
);
const EVENT_ROUTER_PATH = path.join(
  import.meta.dirname,
  "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts",
);

const INSTALL_PATH = path.join(ORCH_DIR, "install.ts");
const UNINSTALL_PATH = path.join(ORCH_DIR, "uninstall.ts");
const REINSTALL_PATH = path.join(ORCH_DIR, "reinstall.ts");
const UPDATE_PATH = path.join(ORCH_DIR, "update.ts");

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
async function readNonCommentLines(filePath: string): Promise<string[]> {
  const raw = await readFile(filePath, "utf8");
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
// Block A: WR-03 -- install.ts addPluginConfigToCache -> rebuildRoutingTables
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block A: install.ts pairs the cache-mutation site with rebuildRoutingTables in lockstep", async () => {
  const lines = await readNonCommentLines(INSTALL_PATH);

  // install.ts wraps the cache-add in the bridge helper
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
    `install.ts: no cache-mutation call site found (tried ${HELPER_FORMS.join(", ")})`,
  );
  assertMutatorFollowedByRebuilder(lines, mutator, "rebuildRoutingTables(", 20, "install.ts");
});

// ──────────────────────────────────────────────────────────────────────────
// Block B: WR-03 -- uninstall.ts removePluginConfigFromCache -> rebuild
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block B: uninstall.ts pairs removePluginConfigFromCache with rebuildRoutingTables in lockstep", async () => {
  const lines = await readNonCommentLines(UNINSTALL_PATH);
  assertMutatorFollowedByRebuilder(
    lines,
    "removePluginConfigFromCache(",
    "rebuildRoutingTables(",
    20,
    "uninstall.ts",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block C: WR-03 / D-60-05 -- reinstall.ts explicit remove + add + rebuild
// inside the per-plugin lock. The mutator pair lives in `runLockedReinstall`
// (the re-install does NOT delegate to install/uninstall, so the wiring
// must be present in THIS file -- D-60-05 audit closure).
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block C: reinstall.ts wires remove + add + rebuildRoutingTables in its per-plugin lock", async () => {
  const lines = await readNonCommentLines(REINSTALL_PATH);

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
  assert.ok(hasRemove, "reinstall.ts: missing removePluginConfigFromCache call site");
  assert.ok(
    hasAdd,
    "reinstall.ts: missing addPluginConfigToCache / readAndCachePluginHooks call site",
  );
  assert.ok(hasRebuild, "reinstall.ts: missing rebuildRoutingTables call site");

  // The remove must be followed within window by the rebuild call.
  assertMutatorFollowedByRebuilder(
    lines,
    "removePluginConfigFromCache(",
    "rebuildRoutingTables(",
    30,
    "reinstall.ts",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block D: WR-03 / D-60-05 -- update.ts explicit remove + add + rebuild
// inside the per-plugin lock. Same gap as reinstall (no delegation).
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block D: update.ts wires remove + add + rebuildRoutingTables in its per-plugin lock", async () => {
  const lines = await readNonCommentLines(UPDATE_PATH);

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
  assert.ok(hasRemove, "update.ts: missing removePluginConfigFromCache call site");
  assert.ok(
    hasAdd,
    "update.ts: missing addPluginConfigToCache / readAndCachePluginHooks call site",
  );
  assert.ok(hasRebuild, "update.ts: missing rebuildRoutingTables call site");

  assertMutatorFollowedByRebuilder(
    lines,
    "removePluginConfigFromCache(",
    "rebuildRoutingTables(",
    30,
    "update.ts",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block E: WR-01 -- hydrateProjectScopeForCwd opens with a clear-cache
// prefix that drops phantom project-arm entries BEFORE the re-hydrate
// loop. The prefix must precede the existing `loadState` / `hydrateScopeFromState`
// calls so the rebuild never observes stale entries.
// ──────────────────────────────────────────────────────────────────────────

test("WR-01 Block E: event-router.ts::hydrateProjectScopeForCwd opens with a parsedConfigCache.delete prefix", async () => {
  const raw = await readFile(EVENT_ROUTER_PATH, "utf8");

  // Locate the function body. The function is declared as
  // `export async function hydrateProjectScopeForCwd(cwd: string): Promise<void> { ... }`.
  // Grab everything between the opening brace and the matching closing
  // brace via a forgiving regex (the function body has no nested braces
  // at depth > 1 in current source; if a future contributor adds a
  // block-statement inside, the regex still matches the first balanced
  // pair via the lazy `[\s\S]*?` and a tail anchor of `\n}`).
  const match = /export async function hydrateProjectScopeForCwd[^{]*\{([\s\S]*?)\n\}/.exec(raw);
  assert.ok(
    match !== null,
    "event-router.ts: could not locate hydrateProjectScopeForCwd function body",
  );
  const body = match[1] ?? "";

  // The WR-01 prefix must contain a delete-from-the-cache call.
  assert.match(
    body,
    /parsedConfigCache\.delete\b|cache\.delete\b/,
    "WR-01: hydrateProjectScopeForCwd must call parsedConfigCache.delete (or equivalent) to drop phantom entries",
  );

  // The delete call must precede the load-state-then-rehydrate calls so
  // the phantom entries cannot leak past the re-hydrate path. Find the
  // first occurrence of each token and assert the delete comes first.
  const deleteIdx = body.search(/parsedConfigCache\.delete\b|cache\.delete\b/);
  const loadIdx = body.search(/loadState\(/);
  const hydrateIdx = body.search(/hydrateScopeFromState\(/);
  assert.ok(deleteIdx >= 0, "WR-01: delete call missing from function body");
  assert.ok(
    loadIdx < 0 || deleteIdx < loadIdx,
    "WR-01: parsedConfigCache.delete must precede loadState",
  );
  assert.ok(
    hydrateIdx < 0 || deleteIdx < hydrateIdx,
    "WR-01: parsedConfigCache.delete must precede hydrateScopeFromState",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block F: negative pin -- any orchestrators/plugin/*.ts that mutates the
// hooks-bridge parsed-config cache MUST also call rebuildRoutingTables in
// the same file. Defends against a future orchestrator silently widening
// the cache-mutation-without-rebuild surface.
// ──────────────────────────────────────────────────────────────────────────

test("WR-03 Block F: every orchestrators/plugin/*.ts that mutates the cache also calls rebuildRoutingTables", async () => {
  const entries = await readdir(ORCH_DIR);
  const tsFiles = entries.filter((e) => e.endsWith(".ts") && !e.endsWith(".test.ts"));

  let scanned = 0;
  for (const file of tsFiles) {
    const filePath = path.join(ORCH_DIR, file);
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

  // Guard against a future refactor that empties the directory or moves
  // the call sites elsewhere: the scan MUST find at least the four files
  // wired in this phase (install, uninstall, reinstall, update).
  assert.ok(
    scanned >= 4,
    `WR-03 Block F: expected at least 4 orchestrators with cache mutations + rebuild; found ${String(scanned)}`,
  );
});
