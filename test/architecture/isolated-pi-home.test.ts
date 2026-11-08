/**
 * @fileoverview Checks that every test entry point gives its run a temporary
 * Pi home, so no test reads or writes the developer's `~/.pi`.
 *
 * Every npm script that runs `node --test`, and the spawn of the direct
 * coverage script, must load `test/platform/isolated-pi-home.ts` with
 * `--import`. Every cucumber profile must load
 * `features/support/isolated-pi-home.ts`. This test runs under such a script
 * itself, so its last case checks that the import took effect.
 */

import assert from "node:assert/strict";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PACKAGE_JSON_REL } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const ISOLATED_PI_HOME_REL = "test/platform/isolated-pi-home.ts";
const CUCUMBER_ISOLATED_PI_HOME_REL = "features/support/isolated-pi-home.ts";
const COVERAGE_SCRIPT_REL = "scripts/test-coverage-direct.mjs";
const CUCUMBER_CONFIG_REL = "cucumber.json";

// The argument that follows `--import` in a script. The path is absolute,
// because a case that forks a child with another cwd passes `--import` on.
const SCRIPT_IMPORT = `"$PWD/${ISOLATED_PI_HOME_REL}"`;

// Splits a script into its commands, then a command into its words.
function commandsOf(script: string): readonly (readonly string[])[] {
  return script.split(/&&|\|\||[;|]/).map((command) => command.trim().split(/\s+/));
}

function runsNodeTest(words: readonly string[]): boolean {
  return words.includes("node") && words.includes("--test");
}

function importsIsolatedPiHome(words: readonly string[]): boolean {
  const flag = words.indexOf("--import");
  return flag !== -1 && words[flag + 1] === SCRIPT_IMPORT;
}

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relativePath), "utf8"));
}

test("names isolation modules that exist", () => {
  // arrange
  const modules = [ISOLATED_PI_HOME_REL, CUCUMBER_ISOLATED_PI_HOME_REL];

  // act
  const missing = modules.filter((module) => !existsSync(path.join(REPO_ROOT, module)));

  // assert
  assert.deepStrictEqual(missing, []);
});

test("every npm script that runs node --test imports the isolation module", async () => {
  // arrange
  const manifest = (await readJson(PACKAGE_JSON_REL)) as { scripts: Record<string, string> };

  // act
  const testScripts = Object.entries(manifest.scripts).filter(([, script]) =>
    commandsOf(script).some(runsNodeTest),
  );
  const unisolated = testScripts
    .filter(([, script]) =>
      commandsOf(script).some((words) => runsNodeTest(words) && !importsIsolatedPiHome(words)),
    )
    .map(([name]) => name);

  // assert
  assert.ok(
    testScripts.some(([name]) => name === "test:unpaired"),
    `${PACKAGE_JSON_REL} has no test:unpaired script that runs node --test`,
  );
  assert.deepStrictEqual(unisolated, []);
});

test("the direct coverage spawn imports the isolation module", async () => {
  // arrange
  const script = await readFile(path.join(REPO_ROOT, COVERAGE_SCRIPT_REL), "utf8");

  // act
  const definesUrl = script.includes(
    `const isolatedPiHomeUrl = new URL("../${ISOLATED_PI_HOME_REL}", import.meta.url).href;`,
  );
  const testSpawns = script.match(/"--test",/g) ?? [];
  const isolatedSpawns = script.match(/"--import",\s*isolatedPiHomeUrl,\s*"--test",/g) ?? [];

  // assert
  assert.ok(definesUrl, `${COVERAGE_SCRIPT_REL} does not point isolatedPiHomeUrl at the module`);
  assert.ok(testSpawns.length > 0, `${COVERAGE_SCRIPT_REL} spawns no node --test`);
  assert.strictEqual(isolatedSpawns.length, testSpawns.length);
});

test("every cucumber profile loads the cucumber isolation module", async () => {
  // arrange
  const config = (await readJson(CUCUMBER_CONFIG_REL)) as Record<
    string,
    { import?: readonly string[] }
  >;

  // act
  const profiles = Object.keys(config);
  const unisolated = profiles.filter(
    (profile) =>
      !(config[profile]?.import ?? []).some((glob) =>
        path.matchesGlob(CUCUMBER_ISOLATED_PI_HOME_REL, glob),
      ),
  );

  // assert
  assert.ok(profiles.length > 0, `${CUCUMBER_CONFIG_REL} names no profile`);
  assert.deepStrictEqual(unisolated, []);
});

test("this test process runs with a Pi home under the temporary directory", () => {
  // arrange
  const temporary = realpathSync(os.tmpdir());

  // act
  const home = os.homedir();
  const agentDir = process.env.PI_CODING_AGENT_DIR;

  // assert
  assert.ok(home.startsWith(`${temporary}${path.sep}`), `HOME ${home} is outside ${temporary}`);
  assert.strictEqual(agentDir, path.join(home, ".pi", "agent"));
});
