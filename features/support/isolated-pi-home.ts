/**
 * @fileoverview The Pi home of each worker and of each scenario.
 *
 * Some steps run product code in the worker itself, such as the plugin
 * completion provider, and that code finds the user scope through `HOME` and
 * `PI_CODING_AGENT_DIR`. `BeforeAll()` points both at a new temporary root of
 * the worker, so no code in the worker reads or writes the developer's
 * `~/.pi`. A scenario's `Before()` points them at the run's sandbox, the HOME
 * and agent directory that the run's Pi uses, and the scenario's release
 * points them back at the worker's root. A worker runs one scenario at a
 * time, so the change never reaches another scenario.
 *
 * The worker's HOME stays in `PI_CM_TEST_HOME`, the variable that
 * `test/platform/isolated-pi-home.ts` sets for a test run, so this module
 * keeps no state of its own. `AfterAll()` removes the root it names.
 */

import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { AfterAll, Before, BeforeAll } from "@cucumber/cucumber";

import { currentRun } from "./pi-process.ts";

import type { ScenarioWorld } from "./world.ts";

/** Returns the worker's HOME, which `BeforeAll()` has made. */
function workerHome(): string {
  const home = process.env.PI_CM_TEST_HOME;
  if (home === undefined) {
    throw new Error("the worker's Pi home has not been made");
  }

  return home;
}

/** Points `HOME` and `PI_CODING_AGENT_DIR` at the worker's root. */
function useWorkerHome(): void {
  const home = workerHome();
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = path.join(home, ".pi", "agent");
}

BeforeAll(async (): Promise<void> => {
  // Resolved so the paths match what the filesystem reports where the
  // temporary directory is a symlink (macOS: /var -> /private/var).
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-features-home-")));
  // Named before anything else can fail, so `AfterAll()` removes the root.
  process.env.PI_CM_TEST_HOME = path.join(root, "home");
  useWorkerHome();
  await mkdir(path.join(workerHome(), ".pi", "agent"), { recursive: true });
});

Before(function (this: ScenarioWorld): void {
  const { home, agentDir } = currentRun().sandbox;
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  this.onRelease(useWorkerHome);
});

// No HOME means `BeforeAll()` failed before it made the root.
AfterAll(async (): Promise<void> => {
  const home = process.env.PI_CM_TEST_HOME;
  if (home !== undefined) {
    await rm(path.dirname(home), { recursive: true, force: true });
  }
});
