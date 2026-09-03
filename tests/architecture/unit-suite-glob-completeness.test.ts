import assert from "node:assert/strict";
import { globSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * COV-04 / D-117-15 -- reachability control for the unit suite itself.
 *
 * `npm test` and `npm run test:coverage:unit` both select their input with a
 * brace-alternative glob whose every alternative names a directory under
 * `tests/`. A test file that lands where no alternative reaches is silently
 * never run, and nothing else in the repository can see it: the compiler
 * type-checks it, ESLint lints it, `fallow` walks it, and the direct-coverage
 * gate enumerates production modules itself rather than through the glob, so
 * it can report a pair green whose owner the suite never executed.
 *
 * This suite closes that hole by comparing what the two scripts match against
 * what exists, by two independent mechanisms: the script side expands the glob
 * arguments parsed out of `package.json`, the tree side walks `tests/` with a
 * recursive directory read. Neither side is derived from the other, so their
 * agreement is evidence rather than a restatement of the configuration.
 *
 * `e2e` and `integration` are excluded from the tree side because each has its
 * own npm script; the unit scripts are not meant to reach them.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SEPARATELY_SCRIPTED_ROOTS: ReadonlySet<string> = new Set(["e2e", "integration"]);

function toPosix(candidate: string): string {
  return candidate.split(path.sep).join("/");
}

/**
 * Every path the quoted glob arguments of one npm script expand to. Both
 * scripts quote their glob arguments and nothing else, so the double-quoted
 * substrings of the script string are exactly its patterns.
 */
function pathsMatchedByScript(scriptName: string): string[] {
  const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const script = manifest.scripts[scriptName];

  if (script === undefined) {
    throw new Error(`package.json declares no "${scriptName}" script`);
  }

  const patterns = [...script.matchAll(/"([^"]*)"/g)].map((quoted) => quoted[1] ?? "");
  const matched = patterns.flatMap((pattern) => globSync(pattern, { cwd: REPO_ROOT }));

  return [...new Set(matched.map(toPosix))].sort();
}

/** Every unit test file that exists under `tests/`, found without a glob. */
function unitTestFilesOnDisk(): string[] {
  const entries = readdirSync(path.join(REPO_ROOT, "tests"), {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => toPosix(path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name))))
    .filter((testPath) => !SEPARATELY_SCRIPTED_ROOTS.has(testPath.split("/")[1] ?? ""))
    .sort();
}

test("COV-04 the test script reaches every unit test file that exists", () => {
  // arrange
  const expectedPaths = unitTestFilesOnDisk();

  // act
  const matchedPaths = pathsMatchedByScript("test");

  // assert
  assert.deepStrictEqual(
    matchedPaths,
    expectedPaths,
    'the "test" script no longer matches exactly the unit test files under tests/',
  );
});

test("COV-04 the test:coverage:unit script reaches every unit test file that exists", () => {
  // arrange
  const expectedPaths = unitTestFilesOnDisk();

  // act
  const matchedPaths = pathsMatchedByScript("test:coverage:unit");

  // assert
  assert.deepStrictEqual(
    matchedPaths,
    expectedPaths,
    'the "test:coverage:unit" script no longer matches exactly the unit test files under tests/',
  );
});
