// tests/architecture/no-legacy-markers.test.ts
//
// D-13-12 / CMC-35 static-audit gate.
//
// Recursively scans `extensions/pi-claude-marketplace` and `tests` for the
// 5 legacy ES-5 marker strings and asserts zero matches in non-allow-listed
// files. The 5 literals are pinned BYTE-FOR-BYTE in the test body below
// (NOT imported from `shared/markers.ts`) so the Wave 3 atomic commit that
// deletes the markers.ts exports does not break this gate; the literals
// live here as fixtures for the lifetime of the codebase.
//
// Why comments are NOT stripped: legitimate header-docstring mentions of
// the user-contract literals (e.g., the D-03 chokepoint header in
// transaction/rollback.ts) get covered by ALLOW_LIST, not by blanket
// comment-stripping. Stripping comments would hide intentional regressions
// hidden in comment blocks; the ALLOW_LIST approach is explicit-by-design.
//
// ALLOW_LIST entries (each with a rationale):
//   - extensions/pi-claude-marketplace/shared/markers.ts
//       The 5 legacy exports themselves (until Wave 3 atomic deletion).
//   - tests/architecture/markers-snapshot.test.ts
//       The drift-guarded snapshot test that asserts byte-equality of each
//       export against PRD §6.12. Removed when Wave 3 deletes the markers
//       and rewrites PRD §6.12 to a pointer.
//   - tests/architecture/no-legacy-markers.test.ts
//       This file. The 5 literals are pinned here as fixtures.
//   - extensions/pi-claude-marketplace/transaction/phase-ledger.ts
//       Header docstring per PI-14 + AS-4: the legacy
//       `(rollback partial: ...)` literal is now referenced INSIDE a
//       "retired in commit 64d823f" historical note (IN-01 fix); the
//       header is otherwise updated to document the closed-set CMC-11
//       token form rollback.ts produces today. Keep the file
//       allow-listed because the literal still appears as
//       documentation-of-supersession.
//
// Removed in Plan 13-02a-02 (Wave 2 sub-wave 2a continuation):
//   - extensions/pi-claude-marketplace/transaction/rollback.ts: chokepoint
//     migrated to the closed-set CMC-11 token form (parent `(failed)
//     {rollback partial}` + indented children `[<phase>] (rollback
//     failed) {rollback partial}`); the legacy literal is no longer in
//     the file's docstring or body.
//   - tests/transaction/rollback.test.ts: contract tests migrated to
//     assert the new rendered shape; the legacy literal is no longer in
//     the file's docstring or assertions.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// D-13-12 / CMC-35 binding: pin the 5 legacy ES-5 strings LITERALLY (NOT
// imported from markers.ts). The Wave 3 atomic commit deletes markers.ts's
// exports; this test continues to gate re-introductions for the lifetime of
// the codebase.
const LEGACY_MARKER_STRINGS: ReadonlyArray<string> = [
  "pi-subagents is not loaded; ",
  "pi-mcp-adapter is not loaded; ",
  "Run /reload to ",
  "MANUAL RECOVERY REQUIRED: ",
  "(rollback partial: ",
];

const ALLOW_LIST: ReadonlySet<string> = new Set([
  // Canonical sources (until Wave 3 atomic deletion):
  "extensions/pi-claude-marketplace/shared/markers.ts",
  "tests/architecture/markers-snapshot.test.ts",
  "tests/architecture/no-legacy-markers.test.ts",
  // Legitimate header-docstring mention (PI-14 + AS-4 chokepoint
  // contract) -- out of scope for Plan 13-02a-02; stays until a later
  // refactor updates the phase-ledger header to match the closed-set
  // token form rollback.ts now produces.
  "extensions/pi-claude-marketplace/transaction/phase-ledger.ts",
]);

const SCAN_ROOTS: ReadonlyArray<string> = ["extensions/pi-claude-marketplace", "tests"];

async function* walkTs(dir: string): AsyncIterable<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      if (full.endsWith("/tests/fixtures/bad-imports")) {
        continue;
      }

      yield* walkTs(full);
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".js"))) {
      yield full;
    }
  }
}

test("D-13-12 / CMC-35: legacy ES-5 marker strings absent from non-allow-listed sources", async () => {
  const offenders: Array<{ file: string; marker: string }> = [];
  for (const root of SCAN_ROOTS) {
    const absRoot = path.join(REPO_ROOT, root);
    for await (const file of walkTs(absRoot)) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      if (ALLOW_LIST.has(rel)) {
        continue;
      }

      const src = await readFile(file, "utf8");
      for (const marker of LEGACY_MARKER_STRINGS) {
        if (src.includes(marker)) {
          offenders.push({ file: rel, marker });
        }
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `D-13-12: legacy ES-5 marker strings found in non-allow-listed source:\n  ${offenders.map((o) => `${o.file}: ${JSON.stringify(o.marker)}`).join("\n  ")}`,
  );
});
