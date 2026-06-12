import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace");

/**
 * SPLIT-02 -- write-seam ownership for the user config file
 * (`claude-plugins.json` / `claude-plugins.local.json`) and the internal
 * state file (`state.json`).
 *
 * The persistence layer exposes these write seams:
 *   - `persistence/config-io.ts::saveConfig` is the SOLE writer of either
 *     config file. `saveConfig` runs `assertPathInside(scopeRoot, filePath,
 *     ...)` BEFORE `atomicWriteJson` (NFR-10 write-site).
 *   - `persistence/state-io.ts::saveState` and
 *     `persistence/migrate.ts::persistMigratedState` are the SOLE writers of
 *     `state.json`.
 *
 * This test locks ownership at the architecture level so the seams cannot
 * be bypassed as v1.12's downstream phases (52-56) and any future milestone
 * add new code paths. A new orchestrator or reconcile-path file CANNOT grow
 * a call to `atomicWriteJson(<configJsonPath>, ...)` without either being
 * added to `ALLOWED_CONFIG_JSON_WRITERS` (which forces an explicit edit to
 * the sibling 'exactly N' assertion below in the same commit) or being
 * caught at CI time.
 *
 * Shape: mirrors `tests/architecture/no-shell-out.test.ts` -- recursive walk
 * of every `.ts` file under `extensions/pi-claude-marketplace/`, regex-based
 * detection of forbidden call patterns, plus a sibling 'exactly N'
 * assertion that pins the allow-list literally so silent widening is caught.
 *
 * Forbidden call patterns (regex on the source text):
 *   - `atomicWriteJson(<...>stateJsonPath, ...)`         outside ALLOWED_STATE_JSON_WRITERS
 *   - `atomicWriteJson(<...>configJsonPath, ...)`        outside ALLOWED_CONFIG_JSON_WRITERS
 *   - `atomicWriteJson(<...>configLocalJsonPath, ...)`   outside ALLOWED_CONFIG_JSON_WRITERS
 *
 * The `<...>` matches an optional `<identifier>.` prefix (e.g.
 * `loc.stateJsonPath`, `locations.configJsonPath`) AND the bare-identifier
 * form (e.g. `stateJsonPath`). The current legitimate callsites use both
 * shapes: `state-io.ts::saveState` and `migrate.ts::persistMigratedState`
 * pass a bare `stateJsonPath` local; `config-io.ts::saveConfig` passes a
 * bare `filePath` parameter (which the regex deliberately does NOT match --
 * `config-io.ts` is on the allow-list).
 *
 * Why path-name-specific patterns and not a coarse `atomicWriteJson(` walk:
 * the codebase has SEVEN legitimate `atomicWriteJson` callsites that write
 * other JSON files entirely (mcp.json, agents-index.json, completion
 * caches): `bridges/mcp/{stage,unstage}.ts`, `persistence/agents-index-io.ts`,
 * `shared/completion-cache.ts` (3 sites). A coarse walk forbidding any
 * `atomicWriteJson(` callsite outside the SPLIT-02 allow-list would
 * incorrectly flag every one of them. The path-name-specific patterns scope
 * enforcement to ONLY the protected files (state.json / claude-plugins.json
 * / claude-plugins.local.json) without false positives.
 *
 * Known limitation (accepted): a hypothetical offender that aliases the
 * protected path into a differently-named local (e.g.
 * `const x = loc.stateJsonPath; atomicWriteJson(x, ...);`) would slip the
 * regex. This is an accepted residual risk -- the 'exactly N' sibling
 * assertions keep the allow-list visible in code review, and adding a new
 * writer is conspicuous enough that the alias pattern is implausible
 * without intent.
 *
 * Adding a writer to either allow-list MUST update BOTH:
 *   1. the matching `ALLOWED_*_WRITERS` ReadonlySet below, AND
 *   2. the matching 'exactly N' sibling assertion's literal array,
 * in the SAME commit. Code review catches the role-split intent (a new
 * state-file writer in ALLOWED_STATE_JSON_WRITERS, a new config-file writer
 * in ALLOWED_CONFIG_JSON_WRITERS).
 */

const ALLOWED_STATE_JSON_WRITERS: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/persistence/state-io.ts",
  "extensions/pi-claude-marketplace/persistence/migrate.ts",
]);

const ALLOWED_CONFIG_JSON_WRITERS: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/persistence/config-io.ts",
]);

async function* walkTsFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTsFiles(full);
    } else if (entry.isFile() && full.endsWith(".ts")) {
      yield full;
    }
  }
}

// Regex notes:
//   - `(?:\w+\.)?` allows an optional `<identifier>.` member-access prefix
//     so `loc.stateJsonPath` / `locations.configJsonPath` match alongside
//     the bare-identifier callsite shape (`stateJsonPath`).
//   - `\b` word-boundary on the right prevents accidental matches on
//     `stateJsonPathLegacy` or similar suffixed identifiers.
const FORBIDDEN_STATE_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?stateJsonPath\b/;
const FORBIDDEN_CONFIG_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?configJsonPath\b/;
const FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?configLocalJsonPath\b/;

test("SPLIT-02: only saveConfig writes claude-plugins.json / claude-plugins.local.json", async () => {
  const offenders: string[] = [];
  for await (const file of walkTsFiles(EXTENSION_ROOT)) {
    const rel = path.relative(REPO_ROOT, file);
    if (ALLOWED_CONFIG_JSON_WRITERS.has(rel)) {
      continue;
    }

    const source = await readFile(file, "utf8");
    if (FORBIDDEN_CONFIG_JSON_PATTERN.test(source)) {
      offenders.push(`${rel} matches ${String(FORBIDDEN_CONFIG_JSON_PATTERN)}`);
    }

    if (FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN.test(source)) {
      offenders.push(`${rel} matches ${String(FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN)}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `SPLIT-02 violation: an atomicWriteJson(...) call targets claude-plugins.json or claude-plugins.local.json outside persistence/config-io.ts::saveConfig:\n  ${offenders.join("\n  ")}\n  (saveConfig is the SOLE sanctioned writer -- it runs assertPathInside(scopeRoot, filePath, ...) BEFORE atomicWriteJson per NFR-10. Bypassing it would open the path-traversal hole the seam was designed to close. If you intentionally need a new writer, add it to ALLOWED_CONFIG_JSON_WRITERS above AND update the matching 'exactly N' sibling assertion in this file in the same commit.)`,
  );
});

test("SPLIT-02: only saveState / persistMigratedState write state.json", async () => {
  const offenders: string[] = [];
  for await (const file of walkTsFiles(EXTENSION_ROOT)) {
    const rel = path.relative(REPO_ROOT, file);
    if (ALLOWED_STATE_JSON_WRITERS.has(rel)) {
      continue;
    }

    const source = await readFile(file, "utf8");
    if (FORBIDDEN_STATE_JSON_PATTERN.test(source)) {
      offenders.push(`${rel} matches ${String(FORBIDDEN_STATE_JSON_PATTERN)}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `SPLIT-02 violation: an atomicWriteJson(...) call targets state.json outside persistence/state-io.ts::saveState or persistence/migrate.ts::persistMigratedState:\n  ${offenders.join("\n  ")}\n  (saveState revalidates the in-memory state against STATE_SCHEMA before writing; persistMigratedState is the IL-3 best-effort persist for the legacy-shape migration. Bypassing either would either skip schema revalidation or duplicate the IL-3 warn-on-failure contract. If you intentionally need a new writer, add it to ALLOWED_STATE_JSON_WRITERS above AND update the matching 'exactly N' sibling assertion in this file in the same commit.)`,
  );
});

// 'Exactly N' sibling assertions: the literal arrays force any future widener
// to update BOTH the ReadonlySet allow-list above AND the matching literal
// expectation here in the SAME commit. Silent widening is caught in CI.

test("SPLIT-02 whitelist: exactly the named writers may write state.json", () => {
  assert.deepEqual([...ALLOWED_STATE_JSON_WRITERS].sort(), [
    "extensions/pi-claude-marketplace/persistence/migrate.ts",
    "extensions/pi-claude-marketplace/persistence/state-io.ts",
  ]);
});

test("SPLIT-02 whitelist: exactly one file may write claude-plugins.json files", () => {
  assert.deepEqual([...ALLOWED_CONFIG_JSON_WRITERS].sort(), [
    "extensions/pi-claude-marketplace/persistence/config-io.ts",
  ]);
});

// Negative-test the walker itself: prove the regex catches a synthetic
// offender source string. This is the manual-positive evidence required by
// the plan's acceptance criteria -- without it, a regex bug could make the
// walker silently GREEN against ANY codebase (false-negative class).
// We test the patterns directly against synthetic strings rather than
// touching production code, so no permanent test artefact is created.

test("SPLIT-02 walker: forbidden patterns catch a synthetic offender", () => {
  const stateOffender = "await atomicWriteJson(loc.stateJsonPath, state);";
  const stateBareOffender = "await atomicWriteJson(stateJsonPath, state);";
  const configOffender = "await atomicWriteJson(loc.configJsonPath, cfg);";
  const configBareOffender = "atomicWriteJson(configJsonPath, cfg)";
  const configLocalOffender = "await atomicWriteJson(loc.configLocalJsonPath, cfg);";

  assert.ok(
    FORBIDDEN_STATE_JSON_PATTERN.test(stateOffender),
    `walker regression: ${String(FORBIDDEN_STATE_JSON_PATTERN)} failed to match ${stateOffender}`,
  );
  assert.ok(
    FORBIDDEN_STATE_JSON_PATTERN.test(stateBareOffender),
    `walker regression: ${String(FORBIDDEN_STATE_JSON_PATTERN)} failed to match the bare-local form ${stateBareOffender}`,
  );
  assert.ok(
    FORBIDDEN_CONFIG_JSON_PATTERN.test(configOffender),
    `walker regression: ${String(FORBIDDEN_CONFIG_JSON_PATTERN)} failed to match ${configOffender}`,
  );
  assert.ok(
    FORBIDDEN_CONFIG_JSON_PATTERN.test(configBareOffender),
    `walker regression: ${String(FORBIDDEN_CONFIG_JSON_PATTERN)} failed to match the bare-local form ${configBareOffender}`,
  );
  assert.ok(
    FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN.test(configLocalOffender),
    `walker regression: ${String(FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN)} failed to match ${configLocalOffender}`,
  );

  // Negative: legitimate callsites that write OTHER JSON files must NOT match.
  const mcpJson = "await atomicWriteJson(locations.mcpJsonPath, doc);";
  const agentsIndex = "await atomicWriteJson(agentsIndexPathFor(loc), index);";
  const completionCache = "await atomicWriteJson(marketplaceNamesCachePath, payload);";
  for (const benign of [mcpJson, agentsIndex, completionCache]) {
    assert.ok(
      !FORBIDDEN_STATE_JSON_PATTERN.test(benign),
      `walker false-positive: ${String(FORBIDDEN_STATE_JSON_PATTERN)} matched a benign callsite ${benign}`,
    );
    assert.ok(
      !FORBIDDEN_CONFIG_JSON_PATTERN.test(benign),
      `walker false-positive: ${String(FORBIDDEN_CONFIG_JSON_PATTERN)} matched a benign callsite ${benign}`,
    );
    assert.ok(
      !FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN.test(benign),
      `walker false-positive: ${String(FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN)} matched a benign callsite ${benign}`,
    );
  }
});
