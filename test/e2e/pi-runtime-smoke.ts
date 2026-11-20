/**
 * @fileoverview Starts the repository's own Pi CLI with only the real
 * extension and `--help`, and reports whether the extension loaded.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { resolvePiRuntime } from "../../features/lib/pi-runtime.ts";
import { allowlistedEnvironment } from "../platform/process-environment.ts";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export async function runPiRuntimeSmoke(): Promise<{
  readonly ok: boolean;
  readonly output: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "pi-cm-runtime-smoke-"));
  const home = path.join(root, "home");
  const cwd = path.join(root, "project");
  const agentDir = path.join(home, ".pi", "agent");
  const sessionDir = path.join(agentDir, "sessions");
  const extension = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");

  try {
    await mkdir(home, { recursive: true });
    await mkdir(cwd, { recursive: true });
    const runtime = resolvePiRuntime(REPO_ROOT);
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runtime.cliPath, "--offline", "--no-extensions", "--extension", extension, "--help"],
      {
        cwd,
        env: allowlistedEnvironment(["PATH"], {
          HOME: home,
          PI_CODING_AGENT_DIR: agentDir,
          PI_CODING_AGENT_SESSION_DIR: sessionDir,
          PI_OFFLINE: "1",
        }),
        timeout: 30_000,
      },
    );
    const output = `${stdout}\n${stderr}`;
    return { ok: !/failed to load|error loading/i.test(output), output };
  } catch (err: unknown) {
    // execFile rejects with an Error that also carries the child's stdout and stderr.
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message ?? ""}`;
    return { ok: false, output };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
