import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

async function enterHermeticEnvironment(prefix: string): Promise<{
  readonly environment: HermeticEnvironment;
  readonly restore: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  const home = path.join(root, "home");
  const agentDir = path.join(home, ".pi", "agent");
  const cwd = path.join(root, "project");
  const hadHome = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const hadAgentDir = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;

  await Promise.all([mkdir(agentDir, { recursive: true }), mkdir(cwd, { recursive: true })]);
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  return {
    environment: { agentDir, cwd, home, root },
    restore: async () => {
      restoreEnvironmentVariable("PI_CODING_AGENT_DIR", hadAgentDir, previousAgentDir);
      restoreEnvironmentVariable("HOME", hadHome, previousHome);
      await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}

/** Creates a case-owned Pi environment and registers its exact cleanup with the test. */
export async function createHermeticEnvironment(
  t: TestContext,
  prefix: string,
): Promise<HermeticEnvironment> {
  const entered = await enterHermeticEnvironment(prefix);
  t.after(entered.restore);
  return entered.environment;
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
