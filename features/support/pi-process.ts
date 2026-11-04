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
 * The shared Pi follows the cucumber profile (DUAL-01, P1-DC-03). Under the
 * adapter profile it also loads pi-mcp-adapter from the optional peer cache,
 * with a temporary directory under the run's root, so its compile cache
 * survives the resets. Every reset then writes the adapter's onboarding seed
 * before the new session, so the adapter never turns Pi's built-in MCP off
 * in the sandbox settings (P1-DC-13). Under the builtin profile it loads no
 * companion and keeps Pi's built-in MCP, and each reset asserts that no stub
 * MCP server the shared Pi started outlives its scenario. The shared Pi is
 * probed at start and after every reset, and the reset fails when it does not
 * run the profile's implementation (DUAL-02).
 *
 * The run also starts the https git host that git marketplace sources clone
 * from, before Pi, because Pi fixes the host's CA file and port when it
 * starts. Pi also gets the GitHub base override pointed at the host, so a
 * GitHub source clones from it (GHB-01). `Before()` resets the host with Pi
 * and checks that it holds no repository, arm, request, connection, or CGI
 * child (HOST-02, HOST-03).
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { AfterAll, Before, BeforeAll, context } from "@cucumber/cucumber";

import { listedCommands } from "../../test/e2e/_rpc.ts";
import { resolveCompanion } from "../lib/companions.ts";
import { HttpsGitHost } from "../lib/https-git-host/server.ts";
import {
  classifyMcpImplementation,
  parseMcpProfile,
  stubPidsIn,
  waitUntilProcessesExit,
  writeAdapterOnboardingSeed,
} from "../lib/mcp-implementation.ts";
import { runCommand, startSession } from "../lib/pi-commands.ts";
import { PiProcess } from "../lib/pi-process.ts";
import { harnessDirectory } from "../lib/turn-records.ts";

import type { McpImplementation, McpProfile } from "../lib/mcp-implementation.ts";
import type { RpcGitEnvironment, RpcProfile, RpcSandbox } from "../lib/pi-process.ts";

/** The Pi process, the sandbox it runs in, and its git host, which last the whole run. */
export interface PiRun {
  readonly root: string;
  readonly sandbox: RpcSandbox;
  readonly marketplacesRoot: string;
  readonly gitHost: HttpsGitHost;
  /** The git and trust environment every Pi of the run starts with. */
  readonly piEnvironment: RpcGitEnvironment;
  /** The MCP implementation that the profile names and the shared Pi runs (DUAL-01). */
  readonly mcpImplementation: McpProfile;
  /** What the shared Pi loads beside the real extension, so a replaced Pi starts the same way. */
  readonly piProfile: RpcProfile | undefined;
  /** The version of the pi-mcp-adapter that the shared Pi loads, whose onboarding each reset seeds. */
  readonly adapterVersion: string | undefined;
  pi: PiProcess;
}

// Cucumber builds a world per scenario, but Pi lives for the worker, so the worker
// is the one piece of module state under `features/`.
let piRun: PiRun | undefined = undefined;

/**
 * The timeout of the run's start. Under the adapter profile the worker's
 * first Pi compiles pi-mcp-adapter through a cold jiti cache, which takes as
 * long as a first profile Pi start (`PROFILE_PI_START_TIMEOUT_MS` in
 * `world.ts`).
 */
const RUN_START_TIMEOUT_MS = 90_000;

// The jiti compile cache of a Pi child whose environment has no TMPDIR:
// Node's `os.tmpdir()` falls back to `/tmp`.
const DEFAULT_COMPILE_CACHE = "/tmp/jiti";

// A stub MCP server exits when its stdin closes, which the new session's
// shutdown of the old connections causes; the margin covers a loaded CI runner.
const STUB_EXIT_TIMEOUT_MS = 10_000;

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

/** Returns the MCP implementation that `pi` runs, read from its command list (MSEL-01). */
async function runningMcpImplementation(pi: PiProcess): Promise<McpImplementation> {
  const { response } = await pi.request({ type: "get_commands" });
  return classifyMcpImplementation(listedCommands(response));
}

/** Returns the profile's world parameter `mcpImplementation`, failing on any other value. */
function profileMcpImplementation(): McpProfile {
  const parameters: unknown = context.parameters;
  return parseMcpProfile(
    typeof parameters === "object" && parameters !== null && "mcpImplementation" in parameters
      ? parameters.mcpImplementation
      : undefined,
  );
}

BeforeAll({ timeout: RUN_START_TIMEOUT_MS }, async (): Promise<void> => {
  const mcpImplementation = profileMcpImplementation();
  // Pi receives the realpath of each sandbox location, so the run uses the
  // same spelling and `{home}` matches the paths Pi reports.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-features-")));
  let gitHost: HttpsGitHost | undefined = undefined;
  let pi: PiProcess | undefined = undefined;
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
    let piProfile: RpcProfile | undefined = undefined;
    let adapterVersion: string | undefined = undefined;
    if (mcpImplementation === "adapter") {
      const adapter = await resolveCompanion("pi-mcp-adapter");
      // The temporary directory lies outside the sandbox that the resets
      // empty, so the compile cache under it lasts the whole run.
      const temporary = path.join(root, "shared-pi-tmp");
      await mkdir(temporary);
      // A Pi started without a TMPDIR, such as a terminal Pi, compiles the
      // extension into Node's default `/tmp/jiti`. The shared Pi warms that
      // cache, as it did before it needed a TMPDIR, so a worker's first
      // terminal Pi does not compile cold under load.
      await mkdir(DEFAULT_COMPILE_CACHE, { recursive: true });
      await symlink(DEFAULT_COMPILE_CACHE, path.join(temporary, "jiti"));
      piProfile = { extensions: [adapter.entry], environment: { TMPDIR: temporary } };
      adapterVersion = adapter.version;
      // Pi starts its first session at once, before any reset seeds it.
      await writeAdapterOnboardingSeed(sandbox.agentDir, adapterVersion);
    }

    pi = await PiProcess.start(sandbox, piEnvironment, piProfile);
    assert.strictEqual(
      await runningMcpImplementation(pi),
      mcpImplementation,
      `the shared Pi does not run the MCP implementation of the ${mcpImplementation} profile`,
    );
    piRun = {
      root,
      sandbox,
      // Local marketplaces live under HOME, so a command types them through
      // `{home}`.
      marketplacesRoot: path.join(sandbox.home, "marketplaces"),
      gitHost,
      piEnvironment,
      mcpImplementation,
      piProfile,
      adapterVersion,
      pi,
    };
  } catch (error: unknown) {
    // A run that fails to start must not leave Pi or the host running, or the
    // root, which holds the host's private key once it has started, behind.
    const startedPi = pi;
    const startedHost = gitHost;
    const failures = await settleInOrder([
      () => startedPi?.stop() ?? Promise.resolve(),
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
  // scenario gets a new process, which starts in the emptied sandbox below.
  const replaced = !run.pi.idle;
  if (replaced) {
    await run.pi.stop();
  }

  // Under the builtin profile the shared Pi itself starts the stub MCP
  // servers of the plugins a scenario installed. Each one writes its pid file
  // in the sandbox, which the emptying below removes.
  const stubPids =
    run.mcpImplementation === "builtin" ? await stubPidsIn(harnessDirectory(run.sandbox.home)) : [];
  await run.gitHost.reset();
  // Empties each sandbox directory but keeps it, because Pi holds it as HOME,
  // agent directory, or cwd.
  const entries = await Promise.all(
    Object.values(run.sandbox).map(async (location: string) =>
      (await readdir(location)).map((name) => path.join(location, name)),
    ),
  );
  await Promise.all(entries.flat().map((entry) => rm(entry, { recursive: true, force: true })));
  if (run.adapterVersion !== undefined) {
    await writeAdapterOnboardingSeed(run.sandbox.agentDir, run.adapterVersion);
  }

  if (replaced) {
    run.pi = await PiProcess.start(run.sandbox, run.piEnvironment, run.piProfile);
  }

  const { skills, payloads } = await startSession(run.pi);
  // The new session ends the old session's MCP connections, so every stub
  // that the shared Pi started exits.
  await waitUntilProcessesExit(stubPids, STUB_EXIT_TIMEOUT_MS);
  const listed = await runCommand(run.pi, "/claude:plugin list");
  assert.deepStrictEqual(
    {
      skills,
      payloads,
      marketplaces: listed.marketplaces,
      gitHost: await run.gitHost.snapshot(),
      mcpImplementation: await runningMcpImplementation(run.pi),
    },
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
      mcpImplementation: run.mcpImplementation,
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
