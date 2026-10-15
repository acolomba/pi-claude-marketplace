/**
 * @fileoverview The run's one headless Pi.
 *
 * The run starts one Pi in RPC mode with the real extension loaded, in a
 * sandbox of a HOME, a Pi agent directory, and a project directory under one
 * temporary root outside the repository. Pi fixes those locations when it
 * starts, so the sandbox lasts the whole run. Before each scenario the
 * `Before()` hook empties every sandbox directory and starts a new Pi session,
 * which rebuilds the extension runtime, then checks that no plugin,
 * marketplace, or skill is left. So no scenario sees the state of another,
 * and the run order is random to prove it.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { AfterAll, Before, BeforeAll } from "@cucumber/cucumber";

import { runCommand, startSession } from "../lib/pi-commands.ts";
import { PiProcess } from "../lib/pi-process.ts";

import type { RpcSandbox } from "../lib/pi-process.ts";

/** The Pi process and the sandbox it runs in, which last the whole run. */
export interface PiRun {
  readonly root: string;
  readonly sandbox: RpcSandbox;
  readonly marketplacesRoot: string;
  pi: PiProcess;
}

// Cucumber builds a world per scenario, but Pi lives for the run, so the run
// is the one piece of module state under `features/`.
let piRun: PiRun | undefined = undefined;

/** Returns the run's Pi and sandbox, which `BeforeAll()` has started. */
export function currentRun(): PiRun {
  if (piRun === undefined) {
    throw new Error("the run's Pi has not started");
  }

  return piRun;
}

BeforeAll(async (): Promise<void> => {
  // Pi receives the realpath of each sandbox location, so the run uses the
  // same spelling and `{home}` matches the paths Pi reports.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-features-")));
  const sandbox = {
    home: path.join(root, "home"),
    agentDir: path.join(root, "agent"),
    cwd: path.join(root, "project"),
  };
  await Promise.all(Object.values(sandbox).map((location) => mkdir(location, { recursive: true })));
  piRun = {
    root,
    sandbox,
    // Local marketplaces live under HOME, so a command types them through
    // `{home}` (D-04).
    marketplacesRoot: path.join(sandbox.home, "marketplaces"),
    pi: await PiProcess.start(sandbox),
  };
});

Before(async (): Promise<void> => {
  const run = currentRun();
  // A scenario that failed mid-request leaves Pi busy or gone; the next
  // scenario gets a new process.
  if (!run.pi.idle) {
    await run.pi.stop();
    run.pi = await PiProcess.start(run.sandbox);
  }

  // Empties each sandbox directory but keeps it, because Pi holds it as HOME,
  // agent directory, or cwd.
  const entries = await Promise.all(
    Object.values(run.sandbox).map(async (location: string) =>
      (await readdir(location)).map((name) => path.join(location, name)),
    ),
  );
  await Promise.all(entries.flat().map((entry) => rm(entry, { recursive: true, force: true })));
  const skills = await startSession(run.pi);
  const listed = await runCommand(run.pi, "/claude:plugin list");
  assert.deepStrictEqual(
    { skills, marketplaces: listed.marketplaces },
    { skills: [], marketplaces: [] },
  );
});

AfterAll(async (): Promise<void> => {
  const run = currentRun();
  await run.pi.stop();
  await rm(run.root, { recursive: true, force: true });
});
