import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ESLint, Linter } from "eslint";
import importX from "eslint-plugin-import-x";

import { EXTENSION_ROOT_REL, SHELL_OUT_EXEMPT_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const EXTENSION_ROOT = path.join(REPO_ROOT, EXTENSION_ROOT_REL);

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
    const filename = path.join(EXTENSION_ROOT, importer);
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const config = (await eslint.calculateConfigForFile(filename)) as Linter.Config;
    const restriction = config.rules?.["import-x/no-restricted-paths"];
    assert.ok(restriction !== undefined);
    const runner = path.relative(
      path.dirname(filename),
      path.join(EXTENSION_ROOT, "platform/package-manager.ts"),
    );

    // act
    const messages = new Linter().verify(
      `import "./${runner.split(path.sep).join("/")}";`,
      {
        files: ["**/*.ts"],
        plugins: { "import-x": importX },
        rules: { "import-x/no-restricted-paths": restriction },
      },
      { filename },
    );

    // assert
    assert.deepStrictEqual(
      messages.map((message) => message.ruleId),
      violations,
    );
  });
}

/**
 * D-21 supersession defense (W-8). MA-7 (PRD §5.1.1) requires the extension
 * to handle "git not found on PATH" gracefully. D-21 satisfies that by
 * adopting `isomorphic-git` -- a pure-JS implementation that eliminates the
 * shell-out entirely. This test asserts the supersession holds: no file
 * under `extensions/pi-claude-marketplace/` may import `node:child_process`,
 * `child_process`, or its named members.
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
 *   A `banned-import` rule with these two specifiers and the three exempt
 *   files as `exclude` rejects the static `import` and `export ... from`
 *   forms, but it passes `await import("node:child_process")` and a
 *   `createRequire` `require("child_process")` untouched, both of which the
 *   regexes below reject. Keep this test.
 *
 * AUTH-06 / AUTH-08 / AUTH-09 narrowing:
 * child_process is permitted ONLY for the `git credential`
 * subprocess in extensions/pi-claude-marketplace/platform/git-credential.ts,
 * which is fundamentally different from a clone shell-out:
 *   - it never executes git clone/fetch/pull/etc.
 *   - it accesses the OS keychain via git's helper chain (osxkeychain,
 *     manager-core, libsecret), which has no pure-JS equivalent (keytar
 *     adds native deps).
 *   - the missing-git-binary failure mode is non-fatal (degrades to
 *     "no credential reuse"; the current operation still works via Device
 *     Flow). The MA-7 "git CLI not found" hard-fail concern is therefore
 *     not reintroduced by this narrowing.
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

test("no child_process imports outside the platform/git-credential whitelist (D-21)", async () => {
  assert.ok(
    SHELL_OUT_EXEMPT_TARGETS.length > 0,
    "D-07-03: an empty SHELL_OUT_EXEMPT_TARGETS empties the whitelist, so this walk would flag the five sanctioned sites and prove nothing about the rest of the tree.",
  );

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

  assert.ok(
    walked > 0,
    `D-07-03: walked ${EXTENSION_ROOT_REL} and found no .ts files -- a walk over zero files is a gate reporting success over nothing.`,
  );
  assert.deepEqual(
    offenders,
    [],
    `D-21 violation: child_process import detected outside the platform/git-credential whitelist:\n  ${offenders.join("\n  ")}\n  (MA-7's "git CLI not found" failure mode is superseded by isomorphic-git for clone/fetch/pull; only platform/git-credential.ts is permitted to spawn git subprocesses, and only for OS keychain access per AUTH-06/08/09. Reintroducing child_process anywhere else would re-open the supersession)`,
  );
});

// AUTH-06/08/09 + EXEC-01..04 + EXEC-05 / HOOK-06 + D-PL9-11 + D-CF1-02 assertion:
// the whitelist is exactly the five load-bearing sites named below -- nobody silently
// widened it. If a future change needs another file with node:child_process,
// it MUST update both SHELL_OUT_EXEMPT_TARGETS in the registry AND this
// assertion's expected array in the same commit, with a justification recorded
// in the docstring header. The expectation is spelled relative to the extension
// root because the full paths are owned by the registry (D-07-05); comparing
// the whitelist against the same group it was built from would pin nothing.
test("whitelist: exactly five files may import node:child_process", () => {
  assert.deepEqual(
    [...ALLOWED_CHILD_PROCESS_FILES].map((rel) => path.relative(EXTENSION_ROOT_REL, rel)).sort(),
    [
      "bridges/hooks/async-rewake/registry.ts",
      "bridges/hooks/dispatch-exec.ts",
      "platform/git-credential.ts",
      "platform/package-manager.ts",
      "platform/prompt-shell.ts",
    ],
  );
});
