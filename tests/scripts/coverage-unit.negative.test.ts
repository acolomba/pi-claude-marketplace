import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { TestContext } from "node:test";

// The negative runner drives the real pipeline and the real readback against
// fixture roots, one offender at a time. These cases drive the RUNNER: they
// hand it a stand-in validator or pipeline that behaves like the real one
// except at one scripted invocation, so the question each case asks is
// "does the runner reject this answer" rather than "is the bundle valid".
// The faithful run is the one positive control (D-02, D-09).

const scriptsUrl = new URL("../../scripts/", import.meta.url);
const runnerPath = fileURLToPath(new URL("coverage-unit.negative.mjs", scriptsUrl));
const validatorPath = fileURLToPath(new URL("coverage-validate.mjs", scriptsUrl));

interface RunnerRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

// What a stand-in does at its scripted invocation; every other invocation
// runs the real tool unchanged.
type Defect =
  | { readonly kind: "always-pass" }
  | { readonly kind: "wrong-kind"; readonly from: string; readonly to: string }
  | { readonly kind: "unparsable-row" }
  | { readonly kind: "signal" }
  | { readonly kind: "silent-exit"; readonly status: number };

function runRunner(args: readonly string[]): RunnerRun {
  const { NODE_TEST_CONTEXT: _context, NODE_TEST_WORKER_ID: _worker, ...env } = process.env;
  const completed = spawnSync(process.execPath, [runnerPath, ...args], {
    encoding: "utf8",
    env: { ...env, NODE_V8_COVERAGE: "" },
  });
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

// A stand-in that passes every invocation through to the real tool except
// invocation `at`, counted in a file beside it, where it applies `defect`.
// `at: 0` applies the defect to every invocation.
async function writeStandIn(
  t: TestContext,
  realPath: string,
  at: number,
  defect: Defect,
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "coverage-unit-stand-in-"));

  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  const standInPath = path.join(directory, "stand-in.mjs");
  const counterPath = path.join(directory, "counter");
  const source = `import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const defect = ${JSON.stringify(defect)};
const at = ${at};
const counterPath = ${JSON.stringify(counterPath)};
const invocation = (existsSync(counterPath) ? Number(readFileSync(counterPath, "utf8")) : 0) + 1;
writeFileSync(counterPath, String(invocation));
const real = spawnSync(process.execPath, [${JSON.stringify(realPath)}, ...process.argv.slice(2)], {
  encoding: "utf8",
});

if (at !== 0 && invocation !== at) {
  process.stdout.write(real.stdout);
  process.stderr.write(real.stderr);
  process.exitCode = real.status;
} else if (defect.kind === "always-pass") {
  process.stdout.write("Coverage bundle verified: stand-in\\n");
} else if (defect.kind === "wrong-kind") {
  process.stderr.write(real.stderr.replaceAll(defect.from, defect.to));
  process.exitCode = real.status;
} else if (defect.kind === "unparsable-row") {
  process.stderr.write("refused:\\n  {not a row\\n");
  process.exitCode = 1;
} else if (defect.kind === "signal") {
  process.kill(process.pid, "SIGKILL");
} else {
  process.exitCode = defect.status;
}
`;
  await writeFile(standInPath, source);
  return standInPath;
}

async function workspaces(): Promise<string[]> {
  const entries = await readdir(tmpdir());
  return entries.filter((entry) => entry.startsWith("coverage-unit-negative-")).sort();
}

// Every control the runner performs, in order; the run names each one.
const controlOrder = [
  "accepted",
  "foreign",
  "source-added",
  "source-removed",
  "source-changed",
  "test-changed",
  "config-changed",
  "lock-changed",
  "capture-tool-changed",
  "acceptance-tool-changed",
  "producer-changed",
  "raw-missing",
  "raw-changed",
  "lcov-missing",
  "lcov-changed",
  "istanbul-missing",
  "istanbul-changed",
  "receipt-missing",
  "receipt-changed",
  "manifest-missing",
  "manifest-empty",
  "unloaded-record-dropped",
  "malformed-coordinate",
  "function-missing",
  "statement-missing",
  "unloaded-hits",
  "foreign-run-report",
  "foreign-run-bundle",
  "integration-substitution",
  "environment-override",
  "tests-failed",
  "worker-interrupted",
];

test("names every control it ran when the real tools answer", () => {
  // act
  const run = runRunner([]);

  // assert
  assert.strictEqual(run.stderr, "");
  assert.strictEqual(
    run.stdout,
    [
      ...controlOrder.map((label) => `${label}: ok`),
      `Verified unit coverage negative controls passed (${controlOrder.length} of ${controlOrder.length}).`,
      "",
    ].join("\n"),
  );
  assert.strictEqual(run.status, 0);
});

// The second validator invocation is the first offender: the accepted root
// with a production source added.
const FIRST_OFFENDER = 2;

test("rejects a validator that accepts every bundle", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, validatorPath, 0, { kind: "always-pass" });

  // act
  const run = runRunner(["--validator", standIn]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /^source-added: the validator exited 0 rather than refusing/u);
});

test("rejects a validator that names the wrong diagnostic", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, validatorPath, FIRST_OFFENDER, {
    kind: "wrong-kind",
    from: '"stale-input"',
    to: '"tool-changed"',
  });

  // act
  const run = runRunner(["--validator", standIn]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(
    run.stderr,
    /^source-added: the validator reported \[\{"kind":"tool-changed".* rather than \[\{"kind":"stale-input"/u,
  );
});

test("rejects a validator that writes an unparsable row", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, validatorPath, FIRST_OFFENDER, {
    kind: "unparsable-row",
  });

  // act
  const run = runRunner(["--validator", standIn]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /^source-added: the validator wrote an unparsable row: {2}\{not a row/u);
});

test("rejects a validator ended by a signal", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, validatorPath, FIRST_OFFENDER, { kind: "signal" });

  // act
  const run = runRunner(["--validator", standIn]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /^source-added: the validator was ended by signal SIGKILL/u);
});

test("rejects a validator that exits 1 without a row", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, validatorPath, FIRST_OFFENDER, {
    kind: "silent-exit",
    status: 1,
  });

  // act
  const run = runRunner(["--validator", standIn]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /^source-added: the validator reported \[\] rather than/u);
});

test("rejects a validator executable that cannot be launched", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "coverage-unit-absent-"));
  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  // act
  const run = runRunner(["--validator", path.join(directory, "no-such-validator.mjs")]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /^accepted: the validator refused the benign bundle \(exit 1\)/u);
});

test("rejects a pipeline that exits 0 without publishing a bundle", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, validatorPath, 0, { kind: "silent-exit", status: 0 });

  // act
  const run = runRunner(["--pipeline", standIn]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(
    run.stderr,
    /^accepted: the pipeline exited 0 without publishing an accepted bundle/u,
  );
});

test("removes its workspace after a control fails", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, validatorPath, 0, { kind: "always-pass" });
  const before = await workspaces();

  // act
  const run = runRunner(["--validator", standIn]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(await workspaces(), before);
});
