import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { globSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "./source-scan.ts";

/**
 * COV-04 / D-117-15 -- reachability control for the unit suite itself.
 *
 * `npm test` and the coverage capture select their input from one definition,
 * `UNIT_TEST_PATTERNS` in `scripts/coverage-capture.manifest.mjs`: a
 * brace-alternative glob whose every alternative names a directory under
 * `tests/`. A test file that lands where no alternative reaches is silently
 * never run, and nothing else in the repository can see it: the compiler
 * type-checks it, ESLint lints it, `fallow` walks it, and the direct-coverage
 * gate enumerates production modules itself rather than through the glob, so
 * it can report a pair green whose owner the suite never executed.
 *
 * This suite closes that hole by comparing what the selection matches against
 * what exists, by two independent mechanisms: the selection side expands the
 * patterns the module exports, the tree side walks `tests/` with a recursive
 * directory read. Neither side is derived from the other, so their agreement
 * is evidence rather than a restatement of the configuration. A third case
 * pins that `npm test` runs that module, so the expansion speaks for the
 * script a developer types.
 *
 * `e2e` and `integration` are excluded from the tree side because each has its
 * own npm script; the unit selection is not meant to reach them.
 */

const TEST_ROOT = "tests";

const SEPARATELY_SCRIPTED_ROOTS: ReadonlySet<string> = new Set(["e2e", "integration"]);

const SELECTION_MODULE = "scripts/coverage-capture.manifest.mjs";

function toPosix(candidate: string): string {
  return candidate.split(path.sep).join("/");
}

/**
 * The patterns the selection module exports, read through a child `node` so the
 * `.mjs` module needs no declaration file in the typed tree.
 */
function authoritativePatterns(): string[] {
  const moduleUrl = pathToFileURL(path.join(REPO_ROOT, SELECTION_MODULE)).href;
  const printed = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { UNIT_TEST_PATTERNS } from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(UNIT_TEST_PATTERNS));`,
    ],
    { encoding: "utf8" },
  );

  if (printed.status !== 0) {
    throw new Error(`${SELECTION_MODULE} did not export its patterns: ${printed.stderr}`);
  }

  const patterns = JSON.parse(printed.stdout) as string[];
  const foreign = patterns.filter((candidate) => !candidate.startsWith(`${TEST_ROOT}/`));

  if (foreign.length > 0) {
    throw new Error(
      `${SELECTION_MODULE} names a pattern outside ${TEST_ROOT}/: ${foreign.join(", ")}`,
    );
  }

  return patterns;
}

/** Every path the authoritative patterns expand to. */
function pathsMatchedBySelection(): string[] {
  const matched = authoritativePatterns().flatMap((pattern) =>
    globSync(pattern, { cwd: REPO_ROOT }),
  );

  return [...new Set(matched.map(toPosix))].sort();
}

/** Every unit test file that exists under `tests/`, found without a glob. */
function unitTestFilesOnDisk(): string[] {
  const entries = readdirSync(path.join(REPO_ROOT, TEST_ROOT), {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => toPosix(path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name))))
    .filter((testPath) => !SEPARATELY_SCRIPTED_ROOTS.has(testPath.split("/")[1] ?? ""))
    .sort();
}

test("COV-04 the authoritative selection reaches every unit test file that exists", () => {
  // arrange
  const expectedPaths = unitTestFilesOnDisk();

  // act
  const matchedPaths = pathsMatchedBySelection();

  // assert
  assert.deepStrictEqual(
    matchedPaths,
    expectedPaths,
    "the unit selection no longer matches exactly the unit test files under tests/",
  );
});

test("COV-04 npm test runs the authoritative selection", () => {
  // arrange
  const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  // act
  const testScript = manifest.scripts.test;

  // assert
  assert.strictEqual(testScript, "node scripts/coverage-capture.mjs --plain");
});
