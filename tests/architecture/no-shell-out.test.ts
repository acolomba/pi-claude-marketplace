import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace");

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
 * The ALLOWED_CHILD_PROCESS_FILES whitelist below is the SOLE permitted use
 * of node:child_process in the extension tree. Adding a second file MUST
 * require an explicit edit here AND an update to the sibling
 * "exactly one file" assertion below, so silent widening is caught in CI.
 */

const ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
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

const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /from\s+["']node:child_process["']/,
  /from\s+["']child_process["']/,
  /require\(\s*["']child_process["']\s*\)/,
  /require\(\s*["']node:child_process["']\s*\)/,
  /import\s*\(\s*["']node:child_process["']\s*\)/,
  /import\s*\(\s*["']child_process["']\s*\)/,
];

test("no child_process imports outside the platform/git-credential whitelist (D-21)", async () => {
  const offenders: string[] = [];
  for await (const file of walkTsFiles(EXTENSION_ROOT)) {
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

  assert.deepEqual(
    offenders,
    [],
    `D-21 violation: child_process import detected outside the platform/git-credential whitelist:\n  ${offenders.join("\n  ")}\n  (MA-7's "git CLI not found" failure mode is superseded by isomorphic-git for clone/fetch/pull; only platform/git-credential.ts is permitted to spawn git subprocesses, and only for OS keychain access per AUTH-06/08/09. Reintroducing child_process anywhere else would re-open the supersession)`,
  );
});

// AUTH-06/08/09 assertion: the whitelist is exactly
// platform/git-credential.ts -- nobody silently widened it. If a future
// change needs another file with node:child_process, it MUST update both
// ALLOWED_CHILD_PROCESS_FILES above AND this assertion's expected array
// in the same commit, with a justification recorded in the
// docstring header.
test("whitelist: exactly one file may import node:child_process", () => {
  assert.deepEqual([...ALLOWED_CHILD_PROCESS_FILES].sort(), [
    "extensions/pi-claude-marketplace/platform/git-credential.ts",
  ]);
});
