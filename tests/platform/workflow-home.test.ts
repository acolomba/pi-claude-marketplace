import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { workflowHomeDir } from "../../extensions/pi-claude-marketplace/platform/workflow-home.ts";

/**
 * Relocate the home directory `os.homedir()` reads, clear `PI_CODING_AGENT_DIR`,
 * and hand the new home back so the caller never re-reads the global it just
 * wrote: a caller reading `process.env.HOME` back needs a `?? ""` to satisfy
 * `strictNullChecks`, and that fallback turns a broken precondition into a
 * silent cwd-relative probe instead of a failure.
 *
 * With the variable cleared, the root takes the engine's home default. A case
 * that sets the variable does so after this call, so the restore registered
 * here covers its value too.
 *
 * The previous values are saved and their restoration registered before
 * anything is mutated, so a failing assertion cannot leave either variable
 * relocated. A variable that was absent is deleted rather than reassigned,
 * because `process.env` stringifies every assignment and an absent variable
 * restored by assignment would come back as the four letters `undefined`.
 */
async function hermeticHome(t: TestContext, label: string): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), `workflow-home-${label}-`));
  const previousHome = process.env.HOME;
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;

  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    if (previousAgentDirectory === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
    }

    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  return home;
}

test("joins `.pi/workflows` onto the home directory when PI_CODING_AGENT_DIR is unset", async (t) => {
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

test("WPTH-04 roots storage under PI_CODING_AGENT_DIR when the variable is set", async (t) => {
  // arrange
  await hermeticHome(t, "agent-dir");
  const agentDirectory = path.join(
    path.parse(process.cwd()).root,
    "workflow-home-fixture",
    "agent",
  );
  process.env.PI_CODING_AGENT_DIR = agentDirectory;

  // act
  const workflowHome = workflowHomeDir();

  // assert
  assert.strictEqual(workflowHome, path.join(agentDirectory, "workflows"));
});

test("WPTH-04 expands a leading `~` in PI_CODING_AGENT_DIR as Pi's getAgentDir does", async (t) => {
  // arrange
  const home = await hermeticHome(t, "agent-dir-tilde");
  process.env.PI_CODING_AGENT_DIR = "~/profile";

  // act
  const workflowHome = workflowHomeDir();

  // assert
  assert.strictEqual(workflowHome, path.join(home, "profile", "workflows"));
});

test("WPTH-04 takes the home default when PI_CODING_AGENT_DIR is empty", async (t) => {
  // arrange
  const home = await hermeticHome(t, "agent-dir-empty");
  process.env.PI_CODING_AGENT_DIR = "";

  // act
  const workflowHome = workflowHomeDir();

  // assert
  assert.strictEqual(workflowHome, path.join(home, ".pi", "workflows"));
});
