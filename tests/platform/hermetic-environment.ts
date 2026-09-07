import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface HermeticEnvironment {
  readonly agentDir: string;
  readonly cwd: string;
  readonly home: string;
  readonly root: string;
}

/** Runs one test callback with all Pi user locations under a fresh temporary root. */
export async function withHermeticEnvironment<T>(
  prefix: string,
  fn: (environment: HermeticEnvironment) => Promise<T>,
): Promise<T> {
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

  try {
    return await fn({ agentDir, cwd, home, root });
  } finally {
    if (hadAgentDir && previousAgentDir !== undefined) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    if (hadHome && previousHome !== undefined) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
