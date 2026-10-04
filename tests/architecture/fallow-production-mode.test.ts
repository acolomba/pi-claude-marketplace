/**
 * D-05: `.fallowrc.json` moves only `deadCode` to production reachability.
 * `health` and `dupes` keep the test tree in scope. These cases read both
 * analyses' real reports over the repository, not the config text that
 * requests the scope.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./source-scan.ts";

const ANALYZER = path.join(REPO_ROOT, "node_modules", "fallow", "bin", "fallow");

/**
 * One non-dead-code analysis report from the real repository.
 *
 * Child stdout goes to a real file rather than a pipe: under the test runner a
 * nested pipe can drop the child's output entirely, and an empty read is
 * indistinguishable from a clean report. The envelope is checked before any
 * field is read, so a renamed analysis or a bumped schema fails here naming
 * itself instead of scoring zero discovered files.
 */
function readScopeReport(
  analysis: string,
  kind: string,
  schemaVersion: number,
): Record<string, unknown> {
  const outputRoot = mkdtempSync(path.join(tmpdir(), "fallow-scope-"));
  try {
    const reportPath = path.join(outputRoot, "report.json");
    const descriptor = openSync(reportPath, "w");
    try {
      const execution = spawnSync(
        process.execPath,
        [ANALYZER, analysis, "--no-cache", "--format", "json"],
        { cwd: REPO_ROOT, stdio: ["ignore", descriptor, "ignore"] },
      );
      assert.strictEqual(execution.error, undefined);
      assert.strictEqual(execution.signal, null);
    } finally {
      closeSync(descriptor);
    }

    const parsed: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.ok(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed));
    const document = parsed as Record<string, unknown>;
    assert.strictEqual(document.kind, kind);
    assert.strictEqual(document.schema_version, schemaVersion);
    return document;
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
}

/** Every repository-relative path a report lists under `field`, via `read`. */
function reportedPaths(
  document: Record<string, unknown>,
  field: string,
  read: (record: Record<string, unknown>) => string[],
): string[] {
  const rows = document[field];
  assert.ok(Array.isArray(rows) && rows.length > 0, `The report listed no ${field} at all`);
  return rows.flatMap((row: unknown) => {
    assert.ok(typeof row === "object" && row !== null && !Array.isArray(row));
    return read(row as Record<string, unknown>);
  });
}

test("D-05: health analysis keeps its test-inclusive scope", () => {
  // arrange
  const document = readScopeReport("health", "health", 11);

  // act
  const scored = reportedPaths(document, "file_scores", (score) => {
    const scoredPath = score.path;
    assert.ok(typeof scoredPath === "string" && scoredPath.length > 0);
    return [scoredPath];
  });

  // assert
  assert.ok(
    scored.some((scoredPath) => scoredPath.startsWith("tests/")),
    "D-05: health scored no file under tests/, so its scope moved to production with dead code",
  );
  assert.ok(
    scored.some((scoredPath) => scoredPath.startsWith("extensions/")),
    "D-05: health scored no file under extensions/, so its scope is not the whole tree either",
  );
});

test("D-05: duplication analysis keeps its test-inclusive scope", () => {
  // arrange
  const document = readScopeReport("dupes", "dupes", 10);

  // act
  const cloned = reportedPaths(document, "clone_groups", (group) => {
    const instances = group.instances;
    assert.ok(Array.isArray(instances) && instances.length > 1);
    return instances.map((instance: unknown) => {
      assert.ok(typeof instance === "object" && instance !== null);
      const file = (instance as Record<string, unknown>).file;
      assert.ok(typeof file === "string" && file.length > 0);
      return file;
    });
  });

  // assert
  assert.ok(
    cloned.some((clonedPath) => clonedPath.startsWith("tests/")),
    "D-05: duplication reported no clone under tests/, so its scope moved to production",
  );
  assert.ok(
    cloned.some((clonedPath) => clonedPath.startsWith("extensions/")),
    "D-05: duplication reported no clone under extensions/, so its scope is not the whole tree",
  );
});
