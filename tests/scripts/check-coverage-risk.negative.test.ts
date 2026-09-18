import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { TestContext } from "node:test";

// The negative runner drives the real production CRAP gate against fixture
// roots, one offender at a time. These cases drive the RUNNER: they hand it
// a stand-in wrapper that behaves like the real one except at one scripted
// invocation, so the question each case asks is "does the runner reject
// this answer" rather than "is the root at risk". The faithful run is the
// one positive control (D-06, D-09).

const scriptsUrl = new URL("../../scripts/", import.meta.url);
const runnerPath = fileURLToPath(new URL("check-coverage-risk.negative.mjs", scriptsUrl));
const wrapperPath = fileURLToPath(new URL("check-coverage-risk.mjs", scriptsUrl));

interface RunnerRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

// What a stand-in does at its scripted invocation; every other invocation
// runs the real wrapper unchanged.
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

// A stand-in that passes every invocation through to the real wrapper
// except invocation `at`, counted in a file beside it, where it applies
// `defect`. `at: 0` applies the defect to every invocation.
async function writeStandIn(t: TestContext, at: number, defect: Defect): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "coverage-risk-stand-in-"));

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
const real = spawnSync(process.execPath, [${JSON.stringify(wrapperPath)}, ...process.argv.slice(2)], {
  encoding: "utf8",
});

if (at !== 0 && invocation !== at) {
  process.stdout.write(real.stdout);
  process.stderr.write(real.stderr);
  process.exitCode = real.status;
} else if (defect.kind === "always-pass") {
  process.stdout.write("Coverage risk verified: stand-in\\n");
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
  return entries.filter((entry) => entry.startsWith("coverage-risk-negative-")).sort();
}

// Every control the runner performs, in order; the run names each one.
const controlOrder = [
  "benign",
  "offender",
  "exactly-thirty",
  "below-thirty",
  "missing-manifest",
  "not-accepted",
  "source-changed",
  "acceptance-tool-changed",
  "schema-changed",
  "map-malformed",
  "nested-function-deleted",
  "counter-swap",
  "estimated-row",
  "row-omitted",
  "row-duplicated",
  "wrong-join",
  "consumer-version",
  "all-tree-denominator",
  "mixed-violation",
  "environment-override",
];

test("names every control it ran when the real tools answer", async () => {
  // arrange
  const before = await workspaces();

  // act
  const faithful = runRunner([]);

  // assert
  assert.deepStrictEqual(faithful, {
    status: 0,
    stdout: `${controlOrder.map((label) => `${label}: ok\n`).join("")}Coverage risk negative controls passed (20 of 20).\n`,
    stderr: "",
  });
  assert.deepStrictEqual(await workspaces(), before);
});

test("rejects a wrapper that passes every root", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, 0, { kind: "always-pass" });

  // act
  const rejected = runRunner(["--wrapper", standIn]);

  // assert
  assert.strictEqual(rejected.status, 1);
  assert.strictEqual(rejected.stdout, "benign: ok\n");
  assert.match(rejected.stderr, /^offender: the wrapper exited 0 rather than refusing\n$/u);
});

test("rejects a wrapper that names the wrong row kind", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, 2, { kind: "wrong-kind", from: '"crap"', to: '"risk"' });

  // act
  const rejected = runRunner(["--wrapper", standIn]);

  // assert
  assert.strictEqual(rejected.status, 1);
  assert.strictEqual(rejected.stdout, "benign: ok\n");
  assert.match(
    rejected.stderr,
    /^offender: the wrapper reported \[\{"kind":"risk".* rather than \[\{"kind":"crap".*\n$/u,
  );
});

test("rejects a wrapper that writes an unparsable row", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, 2, { kind: "unparsable-row" });

  // act
  const rejected = runRunner(["--wrapper", standIn]);

  // assert
  assert.strictEqual(rejected.status, 1);
  assert.match(
    rejected.stderr,
    /^offender: the wrapper wrote an unparsable row: {3}\{not a row\n$/u,
  );
});

test("rejects a wrapper ended by a signal", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, 1, { kind: "signal" });

  // act
  const rejected = runRunner(["--wrapper", standIn]);

  // assert
  assert.strictEqual(rejected.status, 1);
  assert.strictEqual(rejected.stdout, "");
  assert.match(rejected.stderr, /^benign: the wrapper was ended by signal SIGKILL\n$/u);
});

test("rejects a wrapper that exits 1 without a row", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, 2, { kind: "silent-exit", status: 1 });

  // act
  const rejected = runRunner(["--wrapper", standIn]);

  // assert
  assert.strictEqual(rejected.status, 1);
  assert.match(
    rejected.stderr,
    /^offender: the wrapper reported \[\] rather than \[\{"kind":"crap".*\n$/u,
  );
});

test("rejects a wrapper that does not launch", () => {
  // arrange
  const missing = path.join(tmpdir(), "coverage-risk-no-such-wrapper.mjs");

  // act
  const rejected = runRunner(["--wrapper", missing]);

  // assert
  assert.strictEqual(rejected.status, 1);
  assert.match(rejected.stderr, /^benign: the wrapper refused the benign root \(exit 1\): /u);
});

test("removes its workspace after a control fails", async (t) => {
  // arrange
  const standIn = await writeStandIn(t, 0, { kind: "always-pass" });
  const before = await workspaces();

  // act
  const rejected = runRunner(["--wrapper", standIn]);

  // assert
  assert.strictEqual(rejected.status, 1);
  assert.deepStrictEqual(await workspaces(), before);
});
