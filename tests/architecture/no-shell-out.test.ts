import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace");

/**
 * D-21 supersession defense (W-8). MA-7 (PRD §5.1.1) required the extension
 * to handle "git not found on PATH" gracefully. D-21 supersedes that by
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
 */

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
];

test("no child_process imports anywhere in extensions/pi-claude-marketplace/ (D-21)", async () => {
  const offenders: string[] = [];
  for await (const file of walkTsFiles(EXTENSION_ROOT)) {
    const source = await readFile(file, "utf8");
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(source)) {
        offenders.push(`${path.relative(REPO_ROOT, file)} matches ${String(pat)}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `D-21 violation: child_process import detected in the extension tree:\n  ${offenders.join("\n  ")}\n  (MA-7's "git CLI not found" failure mode is superseded by isomorphic-git; reintroducing child_process would re-open the supersession)`,
  );
});
