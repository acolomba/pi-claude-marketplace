import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PiRuntime } from "../pi-runtime.ts";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MAX_BYTES = 1024 * 1024;

/** The isolated invocation and the stdout records emitted by its real Pi CLI. */
export interface JsonOutputRun {
  readonly version: string;
  readonly args: readonly string[];
  readonly records: readonly Record<string, unknown>[];
  readonly sessionFiles: readonly string[];
  readonly stderr: string;
  readonly exitCode: number;
}

/** Selects the transport and lifecycle controls of one fresh subprocess. */
export interface JsonOutputOptions {
  readonly runtime: PiRuntime;
  readonly mode: "json" | "rpc";
  readonly startupProbe: boolean;
  readonly persist: boolean;
}

function parseRecord(line: string): Record<string, unknown> {
  const record: unknown = JSON.parse(line);
  assert.ok(typeof record === "object" && record !== null && !Array.isArray(record));
  return record as Record<string, unknown>;
}

function runProcess(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  mode: JsonOutputOptions["mode"],
): Promise<Pick<JsonOutputRun, "records" | "stderr" | "exitCode">> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: "pipe" });
    const records: Record<string, unknown>[] = [];
    let pending = "";
    let stdoutBytes = 0;
    let stderr = "";
    let failure: Error | undefined;
    const requests = [
      { id: "list", type: "prompt", message: "/claude:plugin list" },
      { id: "probe", type: "prompt", message: "/startup-proof" },
      { id: "entries", type: "get_entries" },
    ];
    let requestIndex = 0;

    function fail(error: Error): void {
      failure ??= error;
      child.kill("SIGKILL");
    }

    function acceptLine(line: string): void {
      const record = parseRecord(line);
      records.push(record);
      if (mode !== "rpc" || record.type !== "response") {
        return;
      }

      const request = requests[requestIndex];
      assert.ok(request, "Unexpected RPC response");
      assert.strictEqual(record.id, request.id);
      assert.strictEqual(record.command, request.type);
      assert.strictEqual(record.success, true, JSON.stringify(record));
      requestIndex += 1;
      const next = requests[requestIndex];
      if (next === undefined) {
        child.stdin.end();
      } else {
        child.stdin.write(`${JSON.stringify(next)}\n`);
      }
    }

    const deadline = setTimeout(() => {
      fail(new Error("Pi exceeded the 20-second runtime deadline"));
    }, 20_000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > MAX_BYTES) {
        fail(new Error("Pi stdout exceeded the 1 MiB limit"));
        return;
      }

      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      try {
        for (const line of lines) {
          acceptLine(line);
        }
      } catch (error: unknown) {
        fail(error as Error);
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr) > MAX_BYTES) {
        fail(new Error("Pi stderr exceeded the 1 MiB limit"));
      }
    });
    child.on("close", (code, signal) => {
      clearTimeout(deadline);
      try {
        if (failure !== undefined) {
          throw failure;
        }

        assert.strictEqual(signal, null, stderr);
        assert.strictEqual(code, 0, stderr);
        if (pending.length > 0) {
          acceptLine(pending);
        }

        if (mode === "rpc") {
          assert.strictEqual(requestIndex, requests.length, "Missing correlated RPC responses");
        }

        resolve({ records, stderr, exitCode: code });
      } catch (error: unknown) {
        reject(new Error("Pi runtime failed", { cause: error }));
      }
    });
    if (mode === "rpc") {
      child.stdin.write(`${JSON.stringify(requests[0])}\n`);
    } else {
      child.stdin.end("");
    }
  });
}

/** Runs real Pi offline with fresh directories and no inherited credentials. */
export async function runJsonOutputRuntime(options: JsonOutputOptions): Promise<JsonOutputRun> {
  const root = await mkdtemp(path.join(tmpdir(), "pi-json-output-"));
  const sessionDir = path.join(root, "sessions");
  const home = path.join(root, "home");
  const cwd = path.join(root, "project");
  const agentDir = path.join(home, ".pi", "agent");
  try {
    await Promise.all([cwd, agentDir, sessionDir].map((dir) => mkdir(dir, { recursive: true })));
    const args = [
      options.runtime.cliPath,
      ...(options.mode === "json" ? ["-p"] : []),
      "--mode",
      options.mode,
      ...(options.persist ? [] : ["--no-session"]),
      "--offline",
      "--session-dir",
      sessionDir,
      "--no-extensions",
      "--extension",
      path.join(REPO_ROOT, "extensions/pi-claude-marketplace/index.ts"),
    ];
    if (options.startupProbe) {
      const fixture = path.join(root, "startup-entries.ts");
      await copyFile(new URL("./fixtures/startup-entries.ts.txt", import.meta.url), fixture);
      args.push("--extension", fixture);
    }

    if (options.mode === "json") {
      args.push("/claude:plugin list");
      if (options.startupProbe) {
        args.push("/startup-proof");
      }
    }

    const env = {
      PATH: process.env.PATH ?? "",
      HOME: home,
      PI_CODING_AGENT_DIR: agentDir,
      PI_CODING_AGENT_SESSION_DIR: sessionDir,
      PI_OFFLINE: "1",
    };
    const versionProbe = spawnSync(process.execPath, [options.runtime.cliPath, "--version"], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 20_000,
      killSignal: "SIGKILL",
      maxBuffer: MAX_BYTES,
    });
    assert.strictEqual(versionProbe.error, undefined);
    assert.strictEqual(versionProbe.signal, null);
    assert.strictEqual(versionProbe.status, 0, versionProbe.stderr);
    assert.strictEqual(versionProbe.stdout.trim(), options.runtime.version);
    const invocation = await runProcess(args, cwd, env, options.mode);
    const sessionFiles = await readdir(sessionDir, { recursive: true });
    return { version: versionProbe.stdout.trim(), args, ...invocation, sessionFiles };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
