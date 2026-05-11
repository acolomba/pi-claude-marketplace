import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * NFR-5 / PI-2 / PL-3 architectural surface guard.
 *
 * Forbidden surface, by file:
 *   - extensions/claude-marketplace/orchestrators/plugin/install.ts
 *     MUST NOT import `gitOps` / `platform/git` / `DEFAULT_GIT_OPS`
 *     (PI-2: install consults the cached manifest only; NO network sync).
 *   - extensions/claude-marketplace/orchestrators/plugin/list.ts
 *     MUST NOT import `gitOps` / `platform/git` / `DEFAULT_GIT_OPS`
 *     (PL-3 + NFR-5: list is read-only against state + manifest; no network).
 *
 * Exempt files (do NOT add):
 *   - orchestrators/plugin/update.ts
 *     PUP-2 syncClone REQUIRES gitOps; the orchestrator legitimately imports
 *     `GitOps` via Phase 4's `orchestrators/marketplace/shared.ts` re-export
 *     (Pattern S-9). Adding it here would break Phase 5 update.
 *   - orchestrators/plugin/uninstall.ts is implicitly clean (no git surface
 *     today) but is not gated here -- gating install + list covers the NFR-5
 *     orchestrator-tier obligation.
 *
 * Skip-path rationale (Wave 0 lands BEFORE install.ts / list.ts exist):
 *   Wave 2 will create these files. Until then, the test skips with an
 *   informational marker so this gate lands NOW (per VALIDATION.md Wave 0
 *   deliverables) without blocking the wave. Once Wave 2 lands, the files
 *   exist and the assertions fire.
 *
 * stripComments rationale (mandatory; mirrors list.test.ts:175-216 pattern):
 *   Source files include header docstrings that legally mention the forbidden
 *   symbols (e.g. "MUST NOT import platform/git"). Without `stripComments`,
 *   the assertion would fail on prose. See Pitfall 5 / Pitfall 8 in
 *   .planning/phases/05-plugin-orchestrators/05-PATTERNS.md.
 */
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
  "extensions/claude-marketplace/orchestrators/plugin/install.ts",
  "extensions/claude-marketplace/orchestrators/plugin/list.ts",
];

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  { name: "DEFAULT_GIT_OPS reference", pattern: /\bDEFAULT_GIT_OPS\b/ },
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

test("NFR-5 + PI-2 + PL-3: install + list orchestrators have zero gitOps surface", async () => {
  const offenders: string[] = [];

  for (const rel of FORBIDDEN_TARGETS) {
    let src: string;
    try {
      src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        // Pre-Wave-2 skip path: the file does not exist yet. The gate
        // activates once Wave 2 lands install.ts / list.ts (see header).
        continue;
      }

      throw err;
    }

    const stripped = stripComments(src);
    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(stripped)) {
        offenders.push(`${rel} matches forbidden ${name}: ${String(pattern)}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `NFR-5 / PI-2 / PL-3 violation: gitOps surface detected in plugin orchestrator(s):\n  ${offenders.join("\n  ")}\n  (install.ts and list.ts are network-free by contract; only update.ts is permitted to import gitOps via Pattern S-9.)`,
  );
});
