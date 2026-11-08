/**
 * @fileoverview Gives each test run a Pi home of its own.
 *
 * Every `node --test` script loads this module with `--import`, so it runs
 * before any test module loads. It points `HOME` and `PI_CODING_AGENT_DIR` at
 * a new temporary root, so a case without its own hermetic environment reads
 * and writes that root and never the developer's `~/.pi`. The per-case helpers
 * in `hermetic-environment.ts` restore to these values.
 *
 * The test runner's process makes the root and removes it when it exits. Each
 * test file's process, and a child that a case forks, inherits `--import` too.
 * There the module finds `PI_CM_TEST_HOME` and changes nothing, so the child
 * keeps the runner's root, or the `HOME` that its parent chose for it.
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

if (process.env.PI_CM_TEST_HOME === undefined) {
  // Resolved so the paths match what the filesystem and child processes
  // report where the temporary directory is a symlink (macOS: /var ->
  // /private/var).
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-cm-test-home-")));
  const home = path.join(root, "home");
  const agentDir = path.join(home, ".pi", "agent");

  mkdirSync(agentDir, { recursive: true });
  process.env.PI_CM_TEST_HOME = home;
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.on("exit", () => {
    rmSync(root, { recursive: true, force: true });
  });
}
