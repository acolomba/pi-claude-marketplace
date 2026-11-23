// test/integration/ipc-child-environment.ts
//
// The environment a forked IPC child driver under `test/integration/` starts
// with. The parent builds it from scratch instead of spreading its own, so no
// variable of the test runner (the sandbox's git rewrites, proxy settings, a
// developer's git configuration) reaches the product code in the child
// (DRV-03, SG-HRN-04).

/**
 * Returns the environment of one forked IPC child, with exactly these keys:
 *
 * - `PATH`: the runner's, so the child finds the same `node` and `git`.
 * - `HOME`: `options.home`, the case's own temporary home.
 * - `PI_CM_TEST_HOME`: the runner's. `fork` passes the runner's `execArgv`, so
 *   the child loads `scripts/isolated-pi-home.mjs` too, and that preload moves
 *   `HOME` to a new temporary root unless it finds this variable.
 * - `PI_CODING_AGENT_DIR`: `options.agentDir`, only when the case names one.
 *   Without it the child's agent directory is `<home>/.pi/agent`.
 * - `NODE_V8_COVERAGE`: the runner's, only when it has one, so a coverage run
 *   still collects the child's coverage.
 *
 * Throws when the runner has no `PI_CM_TEST_HOME`, because the child would
 * then make a temporary home of its own.
 */
export function ipcChildEnvironment(options: {
  readonly home: string;
  readonly agentDir?: string;
}): NodeJS.ProcessEnv {
  const testHome = process.env.PI_CM_TEST_HOME;
  if (testHome === undefined) {
    throw new Error(
      "PI_CM_TEST_HOME is not set: run the integration suite through " +
        "`node --import scripts/isolated-pi-home.mjs`, or a forked child moves its HOME",
    );
  }

  const coverage = process.env.NODE_V8_COVERAGE;
  return {
    PATH: process.env.PATH ?? "",
    HOME: options.home,
    PI_CM_TEST_HOME: testHome,
    ...(options.agentDir === undefined ? {} : { PI_CODING_AGENT_DIR: options.agentDir }),
    ...(coverage === undefined ? {} : { NODE_V8_COVERAGE: coverage }),
  };
}
