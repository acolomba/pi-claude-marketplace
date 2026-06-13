import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * DIFF-01 architecture purity gate.
 *
 * `orchestrators/reconcile/plan.ts` is the foundation of the reconcile
 * surface. Its `planReconcile` function is a pure bidirectional 7-bucket diff
 * between `MergedConfig` and `ExtensionState` and MUST NOT import anything
 * effectful -- no `node:fs`, no `node:fs/promises`, no `platform/git`, no
 * `gitOps` bare identifier, no `notify` bare identifier, no `saveState` /
 * `saveConfig` / `atomicWriteJson` / `withStateGuard` /
 * `withLockedStateTransaction` references.
 *
 * The grep operates over the COMMENT-STRIPPED source (same `stripComments`
 * pattern as `tests/architecture/no-orchestrator-network.test.ts`) so the
 * planner's header docstring may legally mention "this module never imports
 * notify" without self-invalidating the gate.
 *
 * Why this exists: the DIFF-01 SC#1 purity invariant is the seam that lets
 * the planner be unit-tested in isolation and that load-time apply can call from
 * inside `resources_discover` without dragging in any I/O surface.
 */
const TARGET = "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "import from node:fs", pattern: /from\s+["']node:fs["']/ },
  { name: "import from node:fs/promises", pattern: /from\s+["']node:fs\/promises["']/ },
  { name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
  { name: "notify reference", pattern: /\bnotify\b/ },
  { name: "saveState reference", pattern: /\bsaveState\b/ },
  { name: "saveConfig reference", pattern: /\bsaveConfig\b/ },
  { name: "atomicWriteJson reference", pattern: /\batomicWriteJson\b/ },
  { name: "withStateGuard reference", pattern: /\bwithStateGuard\b/ },
  {
    name: "withLockedStateTransaction reference",
    pattern: /\bwithLockedStateTransaction\b/,
  },
];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

test("DIFF-01: planReconcile is pure (no fs/network/notify/save/lock imports)", async () => {
  const offenders: string[] = [];
  const src = await readFile(path.join(REPO_ROOT, TARGET), "utf8");
  const stripped = stripComments(src);
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(stripped)) {
      offenders.push(`${TARGET} matches forbidden ${name}: ${String(pattern)}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `DIFF-01 violation: effectful surface detected in pure planner:\n  ${offenders.join("\n  ")}`,
  );
});
