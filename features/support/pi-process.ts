/**
 * @fileoverview Each worker's one headless Pi.
 *
 * Each worker starts one Pi in RPC mode with the real extension loaded, in a
 * sandbox of a HOME, a Pi agent directory, and a project directory under one
 * temporary root outside the repository. Pi fixes those locations when it
 * starts, so the sandbox lasts the whole run. Before each scenario the
 * `Before()` hook empties every sandbox directory and starts a new Pi session,
 * which rebuilds the extension runtime, then checks that no plugin,
 * marketplace, or skill is left and that the session reported no payload. So
 * no scenario sees the state of another, and the run order is random to
 * prove it.
 *
 * The run also starts the https git host that git marketplace sources clone
 * from, before Pi, because Pi fixes the host's CA file and port when it
 * starts. Pi also gets the GitHub base override pointed at the host, so a
 * GitHub source clones from it (GHB-01). `Before()` resets the host with Pi
 * and checks that it holds no repository, arm, request, connection, or CGI
 * child (HOST-02, HOST-03).
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { AfterAll, Before, BeforeAll } from "@cucumber/cucumber";

import { HttpsGitHost } from "../lib/https-git-host/server.ts";
import { runCommand, startSession } from "../lib/pi-commands.ts";
import { PiProcess } from "../lib/pi-process.ts";

import type { RpcGitEnvironment, RpcSandbox } from "../lib/pi-process.ts";

/** The Pi process, the sandbox it runs in, and its git host, which last the whole run. */
export interface PiRun {
  readonly root: string;
  readonly sandbox: RpcSandbox;
  readonly marketplacesRoot: string;
  readonly gitHost: HttpsGitHost;
  /** The git and trust environment every Pi of the run starts with. */
  readonly piEnvironment: RpcGitEnvironment;
  pi: PiProcess;
}

// Cucumber builds a world per scenario, but Pi lives for the worker, so the worker
// is the one piece of module state under `features/`.
let piRun: PiRun | undefined = undefined;

/** Returns the run's Pi and sandbox, which `BeforeAll()` has started. */
export function currentRun(): PiRun {
  if (piRun === undefined) {
    throw new Error("the run's Pi has not started");
  }

  return piRun;
}

/** Runs each stage in order, even when an earlier one fails, and returns every failure. */
async function settleInOrder(stages: ReadonlyArray<() => Promise<unknown>>): Promise<unknown[]> {
  const failures: unknown[] = [];
  for (const stage of stages) {
    await stage().catch((error: unknown) => {
      failures.push(error);
    });
  }

  return failures;
}

BeforeAll(async (): Promise<void> => {
  // Pi receives the realpath of each sandbox location, so the run uses the
  // same spelling and `{home}` matches the paths Pi reports.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-features-")));
  let gitHost: HttpsGitHost | undefined = undefined;
  try {
    const sandbox = {
      home: path.join(root, "home"),
      agentDir: path.join(root, "agent"),
      cwd: path.join(root, "project"),
    };
    await Promise.all(
      Object.values(sandbox).map((location) => mkdir(location, { recursive: true })),
    );
    gitHost = await HttpsGitHost.start(path.join(root, "git-host"));
    // The global git config is absent until a scenario writes it (DRV-03).
    const piEnvironment = {
      NODE_EXTRA_CA_CERTS: gitHost.certificatePath,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(sandbox.home, ".gitconfig"),
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: `https://${gitHost.address}`,
    } satisfies RpcGitEnvironment;
    const pi = await PiProcess.start(sandbox, piEnvironment);
    piRun = {
      root,
      sandbox,
      // Local marketplaces live under HOME, so a command types them through
      // `{home}`.
      marketplacesRoot: path.join(sandbox.home, "marketplaces"),
      gitHost,
      piEnvironment,
      pi,
    };
  } catch (error: unknown) {
    // A run that fails to start must not leave the host listening or the
    // root, which holds the host's private key once it has started, behind.
    const startedHost = gitHost;
    const failures = await settleInOrder([
      () => startedHost?.close() ?? Promise.resolve(),
      () => rm(root, { recursive: true, force: true }),
    ]);
    throw failures.length === 0
      ? error
      : new AggregateError([error, ...failures], "the run failed to start");
  }
});

Before(async (): Promise<void> => {
  const run = currentRun();
  // A scenario that failed mid-request leaves Pi busy or gone; the next
  // scenario gets a new process.
  if (!run.pi.idle) {
    await run.pi.stop();
    run.pi = await PiProcess.start(run.sandbox, run.piEnvironment);
  }

  await run.gitHost.reset();
  // Empties each sandbox directory but keeps it, because Pi holds it as HOME,
  // agent directory, or cwd.
  const entries = await Promise.all(
    Object.values(run.sandbox).map(async (location: string) =>
      (await readdir(location)).map((name) => path.join(location, name)),
    ),
  );
  await Promise.all(entries.flat().map((entry) => rm(entry, { recursive: true, force: true })));
  const { skills, payloads } = await startSession(run.pi);
  const listed = await runCommand(run.pi, "/claude:plugin list");
  assert.deepStrictEqual(
    { skills, payloads, marketplaces: listed.marketplaces, gitHost: await run.gitHost.snapshot() },
    {
      skills: [],
      payloads: [],
      marketplaces: [],
      gitHost: {
        repositories: [],
        files: [],
        arms: [],
        requests: [],
        connections: 0,
        children: 0,
      },
    },
  );
});

// No run means `BeforeAll()` failed, and it cleaned up after itself.
AfterAll(async (): Promise<void> => {
  const run = piRun;
  if (run === undefined) {
    return;
  }

  const failures = await settleInOrder([
    () => run.pi.stop(),
    () => run.gitHost.close(),
    () => rm(run.root, { recursive: true, force: true }),
  ]);
  if (failures.length > 0) {
    throw new AggregateError(failures, "the run's teardown failed");
  }
});
