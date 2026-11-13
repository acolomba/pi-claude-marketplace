import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { stopHookScripts } from "../../features/lib/hook-files.ts";

test("stops a registered hook before its script writes a pid file", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "hook-script-cleanup-"));
  const harness = path.join(root, "harness");
  const scopeRoot = path.join(root, "project", ".pi");
  const table = path.join(
    scopeRoot,
    "pi-claude-marketplace",
    "data",
    "_shared",
    "async-rewake-pids.json",
  );
  await mkdir(harness, { recursive: true });
  await mkdir(path.dirname(table), { recursive: true });
  const dispatchId = "dispatch-1";
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    detached: process.platform !== "win32",
    env: { ...process.env, PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH: dispatchId },
    stdio: "ignore",
  });
  t.after(async () => {
    const pid = child.pid;
    if (pid !== undefined && child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }

    await rm(root, { recursive: true, force: true });
  });
  await once(child, "spawn");
  const pid = child.pid;
  assert.ok(pid !== undefined);
  await writeFile(
    table,
    JSON.stringify({
      version: 1,
      entries: [
        {
          pid,
          dispatchId,
          scope: "project",
          marketplace: "fixtures",
          plugin: "demo",
          spawnedAt: "2026-11-13T00:00:00Z",
        },
      ],
    }),
  );

  // act
  const exited = once(child, "exit", { signal: AbortSignal.timeout(1_500) });
  await stopHookScripts(harness, [scopeRoot]);
  await exited;

  // assert
  assert.deepStrictEqual(
    { code: child.exitCode, signal: child.signalCode },
    { code: null, signal: "SIGKILL" },
  );
});
