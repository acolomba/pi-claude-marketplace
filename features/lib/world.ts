/**
 * @fileoverview The per-scenario world and the run's one headless Pi.
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
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
  setWorldConstructor,
  World,
} from "@cucumber/cucumber";

import { runCommand, startSession } from "./pi-commands.ts";
import { PiProcess } from "./pi-process.ts";

import type { CascadePayload, OfferedSkill } from "./pi-commands.ts";
import type { RpcSandbox } from "../../tests/e2e/_rpc.ts";

// Starting Pi takes most of a second and a command a tenth of that; the
// margin covers a loaded CI runner.
const STEP_TIMEOUT_MS = 30_000;

setDefaultTimeout(STEP_TIMEOUT_MS);

/** The Pi process and the sandbox it runs in, which last the whole run. */
interface PiRun {
  readonly root: string;
  readonly sandbox: RpcSandbox;
  readonly marketplacesRoot: string;
  pi: PiProcess;
}

// Cucumber builds a world per scenario, but Pi lives for the run, so the run
// is the one piece of module state under `features/`.
let piRun: PiRun | undefined = undefined;

function currentRun(): PiRun {
  if (piRun === undefined) {
    throw new Error("the run's Pi has not started");
  }

  return piRun;
}

export class PluginWorld extends World {
  private readonly run: PiRun = currentRun();
  result: CascadePayload | undefined = undefined;
  skills: readonly OfferedSkill[] | undefined = undefined;

  /** The run's Pi, which the `Before()` hook has reset for this scenario. */
  get pi(): PiProcess {
    return this.run.pi;
  }

  /** The directory the marketplace steps write local marketplaces into. */
  get marketplacesRoot(): string {
    return this.run.marketplacesRoot;
  }

  /** Returns the result of the last command, which a `When` step must have run. */
  lastResult(): CascadePayload {
    if (this.result === undefined) {
      throw new Error("no command has run in this scenario");
    }

    return this.result;
  }

  /** Returns the skills of the last new session, which a `When` step must have started. */
  sessionSkills(): readonly OfferedSkill[] {
    if (this.skills === undefined) {
      throw new Error("no new session has started in this scenario");
    }

    return this.skills;
  }
}

setWorldConstructor(PluginWorld);

async function startPi(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "pi-cm-features-"));
  const sandbox = {
    home: path.join(root, "home"),
    agentDir: path.join(root, "agent"),
    cwd: path.join(root, "project"),
  };
  await Promise.all(Object.values(sandbox).map((location) => mkdir(location, { recursive: true })));
  piRun = {
    root,
    sandbox,
    marketplacesRoot: path.join(root, "marketplaces"),
    pi: await PiProcess.start(sandbox),
  };
}

BeforeAll(startPi);

// Empties `location` but keeps it, because Pi holds it as HOME, agent
// directory, or cwd.
async function emptyDirectory(location: string): Promise<void> {
  const names = await readdir(location);
  await Promise.all(
    names.map((name) => rm(path.join(location, name), { recursive: true, force: true })),
  );
}

async function resetPi(): Promise<void> {
  const run = currentRun();
  // A scenario that failed mid-request leaves Pi busy or gone; the next
  // scenario gets a new process.
  if (!run.pi.idle) {
    await run.pi.stop();
    run.pi = await PiProcess.start(run.sandbox);
  }

  await Promise.all(Object.values(run.sandbox).map(emptyDirectory));
  await rm(run.marketplacesRoot, { recursive: true, force: true });
  const skills = await startSession(run.pi);
  const listed = await runCommand(run.pi, "/claude:plugin list");
  assert.deepStrictEqual(
    { skills, marketplaces: listed.marketplaces },
    { skills: [], marketplaces: [] },
  );
}

Before(resetPi);

async function stopPi(): Promise<void> {
  const run = currentRun();
  await run.pi.stop();
  await rm(run.root, { recursive: true, force: true });
}

AfterAll(stopPi);
