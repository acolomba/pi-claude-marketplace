import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ESLint, Linter } from "eslint";
import importX from "eslint-plugin-import-x";

import { EXTENSION_ROOT_REL, SHELL_OUT_EXEMPT_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const EXTENSION_ROOT = path.join(REPO_ROOT, EXTENSION_ROOT_REL);

// The rule ids ESLint reports for `importer` importing `target`, both relative
// to the extension root, under the computed config of `importer`. Computing it
// per file catches a flat-config block that replaces another block's zones.
async function importViolations(importer: string, target: string): Promise<Array<string | null>> {
  const filename = path.join(EXTENSION_ROOT, importer);
  const eslint = new ESLint({ cwd: REPO_ROOT });
  const config = (await eslint.calculateConfigForFile(filename)) as Linter.Config;
  const restriction = config.rules?.["import-x/no-restricted-paths"];
  assert.ok(restriction !== undefined);
  const specifier = path.relative(path.dirname(filename), path.join(EXTENSION_ROOT, target));
  const messages = new Linter().verify(
    `import "./${specifier.split(path.sep).join("/")}";`,
    {
      files: ["**/*.ts"],
      plugins: { "import-x": importX },
      rules: { "import-x/no-restricted-paths": restriction },
    },
    { filename },
  );
  return messages.map((message) => message.ruleId);
}

for (const { importer, violations } of [
  { importer: "orchestrators/plugin/package-install.ts", violations: [] },
  { importer: "edge/package-install.ts", violations: ["import-x/no-restricted-paths"] },
  {
    importer: "orchestrators/other/package-install.ts",
    violations: ["import-x/no-restricted-paths"],
  },
  {
    importer: "orchestrators/plugin/nested/package-install.ts",
    violations: ["import-x/no-restricted-paths"],
  },
  { importer: "package-install.ts", violations: ["import-x/no-restricted-paths"] },
  { importer: "edge/commands.ts", violations: ["import-x/no-restricted-paths"] },
]) {
  test(`the package runner import gate reports ${violations.length} violations for ${importer}`, async () => {
    // arrange
    const target = "platform/package-manager.ts";

    // act
    const reported = await importViolations(importer, target);

    // assert
    assert.deepStrictEqual(reported, violations);
  });
}

for (const { importer, violations } of [
  { importer: "platform/git.ts", violations: [] },
  { importer: "platform/git-credential.ts", violations: [] },
  { importer: "platform/other.ts", violations: ["import-x/no-restricted-paths"] },
  { importer: "orchestrators/auth-host.ts", violations: ["import-x/no-restricted-paths"] },
  {
    importer: "orchestrators/plugin/package-install.ts",
    violations: ["import-x/no-restricted-paths"],
  },
  { importer: "edge/commands.ts", violations: ["import-x/no-restricted-paths"] },
]) {
  test(`D-SG-01: the git process import gate reports ${violations.length} violations for ${importer}`, async () => {
    // arrange
    const target = "platform/git-process.ts";

    // act
    const reported = await importViolations(importer, target);

    // assert
    assert.deepStrictEqual(reported, violations);
  });
}

/**
 * D-SG-01 spawn-site defense. D-SG-01 reverses D-21: the extension runs the
 * user's system git, and only the git process module may start it. This test
 * asserts that no other file under `extensions/pi-claude-marketplace/` imports
 * `node:child_process`, `child_process`, or its named members, beyond the five
 * sanctioned spawn sites below.
 *
 * Mirrors the no-telemetry-deps test's structure -- read every .ts under the
 * extension tree, refuse if a forbidden import is detected.
 *
 * Forbidden patterns (regex on the source text):
 *   - `from "node:child_process"`
 *   - `from "child_process"`
 *   - `require("child_process")`
 *   - `require("node:child_process")`
 *
 * Why this test is NOT replaceable by a fallow rule pack (measured):
 *   A `banned-import` rule with these two specifiers and the exempt files as
 *   `exclude` rejects the static `import` and `export ... from` forms, but it
 *   passes `await import("node:child_process")` and a `createRequire`
 *   `require("child_process")` untouched, both of which the regexes below
 *   reject. Keep this test.
 *
 * D-SG-01 / SG-PRC-01 first sanctioned site:
 * extensions/pi-claude-marketplace/platform/git-process.ts starts every git
 * process, the `git credential` launch of platform/git-credential.ts included,
 * and, once the SSH probe lands, the ssh one. It spawns an absolute git with
 * `shell: false`, an argv, and the D-SG-05 hardening, through the shared
 * launcher. Only platform/git.ts and platform/git-credential.ts may import it
 * (the GIT_PROCESS_IMPORTERS zone in eslint.config.js).
 *
 * EXEC-01..04 / D-60-01 second sanctioned site:
 * The hook execution layer at
 * extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts is the
 * load-bearing exec primitive for the hooks bridge. The OS-level concern
 * lives in the bridge file because no pure-JS equivalent exists for
 * arbitrary plugin-supplied commands (EXEC-01 spawn + EXEC-02 timer
 * escalation + EXEC-04 exec-form vs shell-form discrimination), and the
 * 8 per-event payload translators (PAYL-01) feed the child's stdin
 * envelope. Adding a third file requires the same edit-here +
 * edit-sibling-assertion discipline.
 *
 * EXEC-05 / HOOK-06 / D-62-01 third sanctioned site:
 * The async-rewake registry at
 * extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
 * is the bridge-owned background-spawn site for `asyncRewake: true` hook
 * entries. Spawn options diverge from the sync EXEC-01..04 path
 * (`detached: false` + fire-and-forget exit handler watching for code 2
 * -> `ctx.sendMessage` injection); the OS-level concern lives here
 * because no pure-JS equivalent exists for arbitrary plugin-supplied
 * commands AND the registry owns in-memory + persisted (PID table)
 * state for `/reload`-safe SIGKILL.
 *
 * D-PL9-11 / PKD-03 fourth sanctioned site:
 * extensions/pi-claude-marketplace/platform/package-manager.ts spawns
 * `npm ci` or `bun install` for a plugin's own packages, the package install
 * Claude Code runs. No pure-JS equivalent exists. It spawns with `shell: false`
 * and an argv from the closed lockfile table in
 * orchestrators/plugin/package-install.ts.
 *
 * D-CF1-02 fifth sanctioned site:
 * extensions/pi-claude-marketplace/platform/prompt-shell.ts runs the `!`
 * commands in the body of a user-invoked skill or command, as Claude Code's
 * dynamic context injection does. The commands are arbitrary and come from the
 * installed plugin, so no pure-JS equivalent exists. It spawns with
 * `shell: false` and an argv: `bash -c <command>`, or PowerShell's
 * `-NoProfile -Command <command>`. Adding a SIXTH file requires the same
 * edit-here + edit-sibling-assertion discipline.
 *
 * The ALLOWED_CHILD_PROCESS_FILES whitelist below is the SOLE permitted use
 * of node:child_process in the extension tree. Adding a sixth file MUST
 * require an explicit edit here AND an update to the sibling whitelist
 * assertion below, so silent widening is caught in CI.
 */

const ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string> = new Set(SHELL_OUT_EXEMPT_TARGETS);

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

const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /from\s+["']node:child_process["']/,
  /from\s+["']child_process["']/,
  /require\(\s*["']child_process["']\s*\)/,
  /require\(\s*["']node:child_process["']\s*\)/,
  /import\s*\(\s*["']node:child_process["']\s*\)/,
  /import\s*\(\s*["']child_process["']\s*\)/,
];

test("D-SG-01: only the sanctioned spawn sites import node:child_process", async () => {
  // arrange
  assert.ok(
    SHELL_OUT_EXEMPT_TARGETS.length > 0,
    "D-07-03: an empty SHELL_OUT_EXEMPT_TARGETS empties the whitelist, so this walk would flag the five sanctioned sites and prove nothing about the rest of the tree.",
  );

  // act
  const offenders: string[] = [];
  let walked = 0;
  for await (const file of walkTsFiles(EXTENSION_ROOT)) {
    walked += 1;
    const rel = path.relative(REPO_ROOT, file);
    if (ALLOWED_CHILD_PROCESS_FILES.has(rel)) {
      continue;
    }

    const source = await readFile(file, "utf8");
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(source)) {
        offenders.push(`${rel} matches ${String(pat)}`);
      }
    }
  }

  // assert
  assert.ok(
    walked > 0,
    `D-07-03: walked ${EXTENSION_ROOT_REL} and found no .ts files -- a walk over zero files is a gate reporting success over nothing.`,
  );
  assert.deepEqual(
    offenders,
    [],
    `D-SG-01 violation: child_process import detected outside the sanctioned spawn sites:\n  ${offenders.join("\n  ")}\n  (every git process starts from platform/git-process.ts; a new spawn site needs its own entry in SHELL_OUT_EXEMPT_TARGETS and in the whitelist test below)`,
  );
});

// D-SG-01 + EXEC-01..04 + EXEC-05 / HOOK-06 + D-PL9-11 + D-CF1-02 assertion:
// the whitelist is exactly the five load-bearing sites named below -- nobody silently
// widened it. If a future change needs another file with node:child_process,
// it MUST update both SHELL_OUT_EXEMPT_TARGETS in the registry AND this
// assertion's expected array in the same commit, with a justification recorded
// in the docstring header. The expectation is spelled relative to the extension
// root because the full paths are owned by the registry (D-07-05); comparing
// the whitelist against the same group it was built from would pin nothing.
test("whitelist: exactly five files may import node:child_process", () => {
  // arrange
  const expectedFiles = [
    "bridges/hooks/async-rewake/registry.ts",
    "bridges/hooks/dispatch-exec.ts",
    "platform/git-process.ts",
    "platform/package-manager.ts",
    "platform/prompt-shell.ts",
  ];

  // act
  const allowedFiles = [...ALLOWED_CHILD_PROCESS_FILES]
    .map((rel) => path.relative(EXTENSION_ROOT_REL, rel))
    .sort();

  // assert
  assert.deepEqual(allowedFiles, expectedFiles);
});
