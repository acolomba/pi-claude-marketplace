import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { restoreEnvironmentAfter } from "./process-environment.ts";

import type { TestContext } from "node:test";

export interface HermeticEnvironment {
  readonly agentDir: string;
  readonly cwd: string;
  readonly home: string;
  readonly root: string;
}

function restoreEnvironmentVariable(
  name: "HOME" | "PI_CODING_AGENT_DIR",
  hadValue: boolean,
  previousValue: string | undefined,
): void {
  if (hadValue && previousValue !== undefined) {
    process.env[name] = previousValue;
  } else if (name === "HOME") {
    delete process.env.HOME;
  } else {
    delete process.env.PI_CODING_AGENT_DIR;
  }
}

async function createHermeticRoot(prefix: string): Promise<HermeticEnvironment> {
  // Resolved so paths match what child processes and the filesystem report
  // where the temp directory is a symlink (macOS: /var -> /private/var).
  const root = await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
  const home = path.join(root, "home");
  const agentDir = path.join(home, ".pi", "agent");
  const cwd = path.join(root, "project");
  await Promise.all([mkdir(agentDir, { recursive: true }), mkdir(cwd, { recursive: true })]);
  return { agentDir, cwd, home, root };
}

async function removeHermeticRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

/** Enters a case-owned Pi environment; the caller runs `restore` itself, typically in a `finally`. */
export async function enterHermeticEnvironment(prefix: string): Promise<{
  readonly environment: HermeticEnvironment;
  readonly restore: () => Promise<void>;
}> {
  const environment = await createHermeticRoot(prefix);
  const hadHome = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const hadAgentDir = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.HOME = environment.home;
  process.env.PI_CODING_AGENT_DIR = environment.agentDir;

  return {
    environment,
    restore: async () => {
      restoreEnvironmentVariable("PI_CODING_AGENT_DIR", hadAgentDir, previousAgentDir);
      restoreEnvironmentVariable("HOME", hadHome, previousHome);
      await removeHermeticRoot(environment.root);
    },
  };
}

/**
 * Creates a case-owned Pi environment and registers its exact cleanup with the
 * test. HOME and PI_CODING_AGENT_DIR go into the case's environment ledger, so
 * `useAllowlistedProcessEnvironment` may run before or after this.
 */
export async function createHermeticEnvironment(
  t: TestContext,
  prefix: string,
): Promise<HermeticEnvironment> {
  const environment = await createHermeticRoot(prefix);
  t.after(() => removeHermeticRoot(environment.root));
  restoreEnvironmentAfter(t, ["HOME", "PI_CODING_AGENT_DIR"]);
  process.env.HOME = environment.home;
  process.env.PI_CODING_AGENT_DIR = environment.agentDir;
  return environment;
}

/** Runs one test callback with all Pi user locations under a fresh temporary root. */
export async function withHermeticEnvironment<T>(
  prefix: string,
  fn: (environment: HermeticEnvironment) => Promise<T>,
): Promise<T> {
  const entered = await enterHermeticEnvironment(prefix);

  try {
    return await fn(entered.environment);
  } finally {
    await entered.restore();
  }
}
