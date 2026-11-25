/**
 * @fileoverview Gives each test run a Pi home of its own.
 *
 * Every `node --test` script loads this module with `--import`, so it runs
 * before any test module loads. It points `HOME` and `PI_CODING_AGENT_DIR` at
 * a new temporary root, so a case without its own hermetic environment reads
 * and writes that root and never the developer's `~/.pi`. The per-case helpers
 * in `hermetic-environment.ts` restore to these values.
 *
 * SG-SSH-02: it also writes `<root>/bin/ssh`, a script that refuses every
 * launch the way GitHub refuses an unknown key, and puts `<root>/bin` first on
 * `PATH`. So a test that reaches the product's ssh probe without a fake gets
 * `not-configured`, and no test runs the machine's own ssh against
 * github.com. Its `ssh -G` shows a direct hop to github.com, as a stock
 * OpenSSH does (D-SG-18). A case that needs another ssh puts its own first on the PATH
 * of the processes it starts.
 *
 * D-SG-18: it also removes the shell's `GIT_CONFIG_COUNT`,
 * `GIT_CONFIG_KEY_<n>`, `GIT_CONFIG_VALUE_<n>`, and `GIT_CONFIG_PARAMETERS`,
 * so a test that reaches the product's check of the user's git config, such
 * as an `insteadOf` rewrite of a GitHub ssh URL, reads the run's own home and
 * no setting of the shell that runs the suite. A case that needs a git config
 * variable sets it on the processes it starts.
 *
 * The test runner's process makes the root and removes it when it exits. Each
 * test file's process, and a child that a case forks, inherits `--import` too.
 * There the module finds `PI_CM_TEST_HOME` and changes nothing, so the child
 * keeps the runner's root, or the `HOME` that its parent chose for it, and the
 * `PATH` it was given.
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// The answer GitHub's ssh gives a key it does not know. D-SG-18: `ssh -G`
// prints the config of a stock OpenSSH, which reaches github.com straight, so
// the run's user is one with no GitHub key and no ssh setting.
const REFUSING_SSH = `#!/bin/sh
if [ "$1" = "-G" ]; then
  printf 'host github.com\\nuser git\\nhostname github.com\\nport 22\\n'
  exit 0
fi
echo 'git@github.com: Permission denied (publickey).' >&2
exit 255
`;

if (process.env.PI_CM_TEST_HOME === undefined) {
  // Resolved so the paths match what the filesystem and child processes
  // report where the temporary directory is a symlink (macOS: /var ->
  // /private/var).
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-cm-test-home-")));
  const home = path.join(root, "home");
  const agentDir = path.join(home, ".pi", "agent");

  mkdirSync(agentDir, { recursive: true });
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  writeFileSync(path.join(bin, "ssh"), REFUSING_SSH, { mode: 0o755 });
  process.env.PATH = [bin, process.env.PATH].filter(Boolean).join(path.delimiter);
  process.env.PI_CM_TEST_HOME = home;
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  for (const name of Object.keys(process.env)) {
    if (/^GIT_CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+)$/.test(name)) {
      Reflect.deleteProperty(process.env, name);
    }
  }

  process.on("exit", () => {
    rmSync(root, { recursive: true, force: true });
  });
}
