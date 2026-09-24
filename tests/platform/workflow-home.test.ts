import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { workflowHomeDir } from "../../extensions/pi-claude-marketplace/platform/workflow-home.ts";

/**
 * Relocate the home directory `os.homedir()` reads, and hand the new home back
 * so the caller never re-reads the global it just wrote: a caller reading
 * `process.env.HOME` back needs a `?? ""` to satisfy `strictNullChecks`, and
 * that fallback turns a broken precondition into a silent cwd-relative probe
 * instead of a failure.
 *
 * The previous value is saved and its restoration registered before anything
 * is mutated, so a failing assertion cannot leave the variable relocated. A
 * variable that was absent is deleted rather than reassigned, because
 * `process.env` stringifies every assignment and an absent variable restored by
 * assignment would come back as the four letters `undefined`.
 */
async function hermeticHome(t: TestContext, label: string): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), `workflow-home-${label}-`));
  const previousHome = process.env.HOME;

  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  return home;
}

test("joins `.pi/workflows` onto the home directory", async (t) => {
  // arrange
  const home = await hermeticHome(t, "join");

  // act
  const workflowHome = workflowHomeDir();

  // assert
  assert.strictEqual(workflowHome, path.join(home, ".pi", "workflows"));
});

test("WPTH-02 roots storage under the home directory and never under the working directory", async (t) => {
  // arrange
  const home = await hermeticHome(t, "home-derived");
  // A working directory distinct from the home makes the derivation
  // observable: with one directory serving as both, the assertions below pass
  // just as happily for a cwd-derived root.
  const projectCwd = await mkdtemp(path.join(tmpdir(), "workflow-home-cwd-"));
  const previousCwd = process.cwd();

  t.after(async () => {
    process.chdir(previousCwd);

    await rm(projectCwd, { recursive: true, force: true });
  });
  process.chdir(projectCwd);

  // act
  const workflowHome = workflowHomeDir();

  // assert
  assert.strictEqual(workflowHome, path.join(home, ".pi", "workflows"));
  assert.deepStrictEqual(
    {
      underWorkingDirectory: workflowHome.startsWith(projectCwd),
      legacyProjectPath: workflowHome === path.join(projectCwd, ".pi", "workflows", "saved"),
    },
    { underWorkingDirectory: false, legacyProjectPath: false },
  );
});

test("reads the home directory again on every call instead of caching one root", async (t) => {
  // arrange
  const firstHome = await hermeticHome(t, "first");
  const secondHome = await mkdtemp(path.join(tmpdir(), "workflow-home-second-"));

  t.after(async () => {
    await rm(secondHome, { recursive: true, force: true });
  });

  // act
  const firstRoot = workflowHomeDir();
  process.env.HOME = secondHome;
  const secondRoot = workflowHomeDir();

  // assert
  assert.deepStrictEqual(
    { firstRoot, secondRoot },
    {
      firstRoot: path.join(firstHome, ".pi", "workflows"),
      secondRoot: path.join(secondHome, ".pi", "workflows"),
    },
  );
});
