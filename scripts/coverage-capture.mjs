// One native unit run, captured immutably (D-01, D-02, D-04, D-10).
//
// `npm run coverage:capture` runs the existing unit selection exactly once under
// the ordinary native runner flags and, from that same run, keeps the LCOV the
// runner writes, the raw V8 coverage its workers emit, and the source and
// executed-JavaScript bytes the loader actually evaluated. Every input is
// inventoried and hashed before execution, after execution and again before
// publication; a loaded module whose bytes differ from the pre-run inventory, a
// worker that did not finish, a raw record from a process the run did not
// register, or a failing test refuses the run.
//
// A refused run keeps its evidence under its own `coverage/runs/<runId>/`
// directory with `status: "failed"` and publishes nothing. A successful run
// copies the LCOV to `coverage/unit.lcov` and then, last and atomically, writes
// `coverage/unit.manifest.json`. Starting any run removes the previous public
// pointer first, so a stale success is never reachable while a replacement is
// in flight.
//
// `--verify` reads a published bundle back the way a consumer must, refusing
// stale inputs, changed tooling, a different runtime or any digest mismatch.
//
// `--root <dir>` runs against an isolated fixture root that follows the same
// directory layout and selection rules as the repository.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  enumerateInventory,
  foreignLoaderTokens,
  inventoryDifference,
  invocationDigest,
  MANIFEST_KIND,
  MANIFEST_SCHEMA_VERSION,
  NATIVE_COVERAGE_FLAGS,
  PUBLIC_LCOV_PATH,
  PUBLIC_MANIFEST_PATH,
  RUNS_DIRECTORY,
  runtimeIdentity,
  selectedTests,
  sha256,
  toolingIdentity,
  toProjectPath,
  UNIT_TEST_PATTERNS,
  verifyCaptureBundle,
  writeJsonAtomically,
} from "./coverage-capture.manifest.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const runtimeImport = `--import=${new URL("./coverage-capture.runtime.mjs", import.meta.url).href}`;
const rawFileName = /^coverage-(?<pid>\d+)-\d{13}-\d+\.json$/u;

class UsageError extends Error {}

function parseArguments(args) {
  const options = { root: projectRoot, verify: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--verify") {
      options.verify = true;
    } else if (argument === "--root" && args[index + 1] !== undefined) {
      options.root = path.resolve(args[index + 1]);
      index += 1;
    } else {
      throw new UsageError(`Unknown option: ${argument}. Pass --root <dir> and/or --verify.`);
    }
  }

  if (!existsSync(options.root)) {
    throw new UsageError(`Root is not a directory: ${options.root}`);
  }

  return options;
}

// Anything that would transform module text before V8 sees it, other than this
// run's own runtime, is refused before a run directory exists.
function refuseForeignLoaders() {
  const tokens = foreignLoaderTokens(
    process.env.NODE_OPTIONS ?? "",
    process.execArgv,
    runtimeImport,
  );

  if (tokens.length > 0) {
    throw new Error(
      `Refusing to capture under foreign loader or transform flags: ${tokens.join(" ")}`,
    );
  }
}

function createRun(root) {
  const runId = `${new Date().toISOString().replace(/[-:.]/gu, "")}-${randomBytes(4).toString("hex")}`;
  const runPrefix = `${RUNS_DIRECTORY}/${runId}`;
  const runDirectory = path.join(root, runPrefix);

  if (existsSync(runDirectory)) {
    throw new Error(`Run directory already exists: ${runPrefix}`);
  }

  mkdirSync(path.join(runDirectory, "raw"), { recursive: true });
  mkdirSync(path.join(runDirectory, "workers"), { recursive: true });
  // The previous success is unreachable from the moment a replacement starts.
  // Only these two files are removed; earlier run directories stay as evidence.
  rmSync(path.join(root, PUBLIC_MANIFEST_PATH), { force: true });
  rmSync(path.join(root, PUBLIC_LCOV_PATH), { force: true });

  return { root, runId, runPrefix, runDirectory, startedAt: new Date().toISOString() };
}

// Production bytes are copied content-addressed into the run before execution,
// so a later consumer reads the module a run measured and never the mutable
// file on disk (D-02).
function snapshotInventory(run, inventory) {
  const snapshotDirectory = path.join(run.runDirectory, "inventory");
  mkdirSync(snapshotDirectory, { recursive: true });

  for (const entry of inventory.filter((candidate) => candidate.group === "production")) {
    const target = path.join(snapshotDirectory, entry.digest);

    if (!existsSync(target)) {
      writeFileSync(target, readFileSync(path.join(run.root, entry.path)));
    }
  }

  const inventoryPath = path.join(run.runDirectory, "inventory.json");
  writeJsonAtomically(inventoryPath, inventory);
  const counts = {};

  for (const entry of inventory) {
    counts[entry.group] = (counts[entry.group] ?? 0) + 1;
  }

  return {
    path: `${run.runPrefix}/inventory.json`,
    digest: sha256(readFileSync(inventoryPath)),
    counts,
  };
}

// The runner's environment: the outer runner's worker markers are shed (a
// nested `node --test` that inherits NODE_TEST_CONTEXT skips every file and
// exits 0), any inherited copy of this runtime import is folded into the one
// appended here, and the run's own destination variables are set explicitly.
// The recorded form keeps run-relative paths so the invocation digest does not
// depend on where the root lives.
function runnerEnvironment(run) {
  const { NODE_TEST_CONTEXT: _context, NODE_TEST_WORKER_ID: _worker, ...inherited } = process.env;
  const inheritedOptions = (inherited.NODE_OPTIONS ?? "")
    .split(/\s+/u)
    .filter((token) => token !== "" && token !== runtimeImport);
  const recorded = {
    NODE_DISABLE_COMPILE_CACHE: "1",
    NODE_OPTIONS: [...inheritedOptions, runtimeImport].join(" "),
    NODE_V8_COVERAGE: `${run.runPrefix}/raw`,
    PI_CM_COVERAGE_ROOT: ".",
    PI_CM_COVERAGE_RUN_DIR: run.runPrefix,
    PI_CM_COVERAGE_RUN_ID: run.runId,
  };
  const actual = {
    ...inherited,
    ...recorded,
    NODE_V8_COVERAGE: path.join(run.runDirectory, "raw"),
    PI_CM_COVERAGE_ROOT: run.root,
    PI_CM_COVERAGE_RUN_DIR: run.runDirectory,
  };

  return { actual, recorded };
}

function runnerArguments(run) {
  const concurrency = process.env.TEST_CONCURRENCY;

  return [
    "--test",
    ...(concurrency === undefined || concurrency === ""
      ? []
      : [`--test-concurrency=${concurrency}`]),
    ...NATIVE_COVERAGE_FLAGS,
    `--test-reporter-destination=${run.runPrefix}/unit.lcov`,
    ...UNIT_TEST_PATTERNS,
  ];
}

function buildInvocation(run) {
  const environment = runnerEnvironment(run);
  const recorded = {
    execPath: process.execPath,
    node: process.version,
    argv: runnerArguments(run),
    cwd: ".",
    env: environment.recorded,
  };

  return { ...recorded, digest: invocationDigest(recorded), actualEnvironment: environment.actual };
}

function executeRunner(run, invocation) {
  const runner = spawnSync(process.execPath, invocation.argv, {
    cwd: run.root,
    env: invocation.actualEnvironment,
    stdio: ["ignore", "inherit", "inherit"],
  });

  return { pid: runner.pid, status: runner.status, signal: runner.signal, error: runner.error };
}

// Launch, signal and test failures are separate verdicts so a run that never
// started, one the OS stopped and one whose tests failed read differently.
function outcomeFailures(outcome) {
  if (outcome.error !== undefined) {
    return [{ kind: "launch", error: outcome.error.message }];
  }

  if (outcome.signal !== null) {
    return [{ kind: "signal", signal: outcome.signal }];
  }

  return outcome.status === 0 ? [] : [{ kind: "tests-failed", status: outcome.status }];
}

function driftFailures(stage, before, after) {
  const difference = inventoryDifference(before, after);
  const drifted = [difference.added, difference.removed, difference.changed].some(
    (list) => list.length > 0,
  );

  return drifted ? [{ kind: "drift", stage, ...difference }] : [];
}

function readJsonLines(filePath) {
  return readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readProcessRecords(run) {
  const workersDirectory = path.join(run.runDirectory, "workers");
  const records = { starts: new Map(), exits: new Map(), loads: [], refusals: [] };

  for (const fileName of readdirSync(workersDirectory).sort()) {
    const filePath = path.join(workersDirectory, fileName);

    if (fileName.endsWith(".start.json")) {
      const start = JSON.parse(readFileSync(filePath, "utf8"));
      records.starts.set(start.pid, start);
    } else if (fileName.endsWith(".exit.json")) {
      const exit = JSON.parse(readFileSync(filePath, "utf8"));
      records.exits.set(exit.pid, exit);
    } else if (fileName.endsWith(".loads.jsonl")) {
      records.loads.push(...readJsonLines(filePath));
    } else if (fileName.endsWith(".refusals.jsonl")) {
      records.refusals.push(...readJsonLines(filePath));
    }
  }

  return records;
}

function readRawRecords(run) {
  const rawDirectory = path.join(run.runDirectory, "raw");
  const raw = [];
  const failures = [];

  for (const fileName of readdirSync(rawDirectory).sort()) {
    const match = rawFileName.exec(fileName);

    if (match === null) {
      failures.push({ kind: "unexpected-raw-file", file: fileName });
      continue;
    }

    raw.push({
      file: fileName,
      path: `${run.runPrefix}/raw/${fileName}`,
      pid: Number(match.groups.pid),
      digest: sha256(readFileSync(path.join(rawDirectory, fileName))),
    });
  }

  return { raw, failures };
}

// A worker is a registered process the runner itself spawned for one selected
// test file: it needs an exit record and at least one raw file, and no test may
// have two of them.
function classifyWorker(run, start, exit, files, tests, workersByTest) {
  const test = toProjectPath(run.root, start.argv[1] ?? "");
  const failures = [];

  if (test === undefined || !tests.includes(test)) {
    failures.push({ kind: "unexpected-worker", pid: start.pid, argv: start.argv });
  } else if (workersByTest.has(test)) {
    failures.push({ kind: "duplicate-worker", test });
  } else {
    workersByTest.set(test, start.pid);
  }

  if (exit === undefined) {
    failures.push({ kind: "interrupted-worker", test, pid: start.pid });
  }

  if (files.length === 0) {
    failures.push({ kind: "missing-capture", test, pid: start.pid });
  }

  return { worker: { test, pid: start.pid, exitCode: exit?.code ?? null, raw: files }, failures };
}

// Every registered process is either a worker (its parent is the runner) or
// nested evidence: kept, counted, and allowed to end by signal. Every selected
// test needs a worker, and every raw file needs a registered producer.
function reconcileProcesses(run, records, raw, runnerPid, tests) {
  const rawByPid = new Map();

  for (const record of raw) {
    rawByPid.set(record.pid, [...(rawByPid.get(record.pid) ?? []), record.file]);
  }

  const workers = [];
  const nested = [];
  const failures = [];
  const workersByTest = new Map();

  for (const start of records.starts.values()) {
    const exit = records.exits.get(start.pid);
    const files = rawByPid.get(start.pid) ?? [];

    if (start.ppid !== runnerPid) {
      nested.push({ pid: start.pid, ppid: start.ppid, completed: exit !== undefined, raw: files });
      continue;
    }

    const classified = classifyWorker(run, start, exit, files, tests, workersByTest);
    workers.push(classified.worker);
    failures.push(...classified.failures);
  }

  for (const test of tests.filter((selected) => !workersByTest.has(selected))) {
    failures.push({ kind: "missing-worker", test });
  }

  for (const record of raw.filter((candidate) => !records.starts.has(candidate.pid))) {
    failures.push({ kind: "unregistered-capture", file: record.file, pid: record.pid });
  }

  return { workers, nested, failures };
}

// Each loaded module must be in the pre-run inventory with the same bytes, and
// its stored source and executed text must still hash to what the loader wrote.
function reconcileModules(run, records, inventory) {
  const inventoryDigests = new Map(inventory.map((entry) => [entry.path, entry.digest]));
  const modules = new Map();
  const failures = [];
  const seen = new Set();

  for (const load of records.loads) {
    const key = canonicalJson(load);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const expected = inventoryDigests.get(load.path);

    if (expected === undefined) {
      failures.push({ kind: "unlisted-module", path: load.path });
    } else if (expected !== load.source) {
      failures.push({
        kind: "loaded-bytes-differ",
        path: load.path,
        expected,
        actual: load.source,
      });
    } else if (modules.has(load.path)) {
      failures.push({ kind: "inconsistent-module", path: load.path });
    } else {
      modules.set(load.path, load);
    }

    for (const [store, digest] of [
      ["sources", load.source],
      ["executed", load.executed],
    ]) {
      const storedPath = path.join(run.runDirectory, store, digest);

      if (!existsSync(storedPath) || sha256(readFileSync(storedPath)) !== digest) {
        failures.push({ kind: "missing-source-capture", path: load.path, store, digest });
      }
    }
  }

  for (const refusal of records.refusals) {
    failures.push({ kind: "unsupported-format", path: refusal.path, format: refusal.format });
  }

  return { modules: [...modules.values()].sort((a, b) => a.path.localeCompare(b.path)), failures };
}

function reconcile(run, runnerPid, tests, inventory) {
  const records = readProcessRecords(run);
  const rawRecords = readRawRecords(run);
  const processes = reconcileProcesses(run, records, rawRecords.raw, runnerPid, tests);
  const modules = reconcileModules(run, records, inventory);

  return {
    workers: processes.workers,
    nested: processes.nested,
    raw: rawRecords.raw,
    modules: modules.modules,
    failures: [...rawRecords.failures, ...processes.failures, ...modules.failures],
  };
}

function emptyEvidence() {
  return { workers: [], nested: [], raw: [], modules: [], failures: [] };
}

function lcovArtifact(run) {
  const lcovPath = `${run.runPrefix}/unit.lcov`;
  const absolutePath = path.join(run.root, lcovPath);

  return {
    path: lcovPath,
    digest: existsSync(absolutePath) ? sha256(readFileSync(absolutePath)) : null,
  };
}

// `state` is `captured` for every run this CLI writes. Conversion to Istanbul
// is a separate acceptance that promotes a bundle to `accepted`; a successful
// test process alone never certifies converted output.
function assembleManifest(run, parts) {
  const { actualEnvironment: _actual, ...invocation } = parts.invocation;

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    kind: MANIFEST_KIND,
    runId: run.runId,
    status: parts.failures.length === 0 ? "captured" : "failed",
    state: "captured",
    failures: parts.failures,
    startedAt: run.startedAt,
    completedAt: new Date().toISOString(),
    runtime: runtimeIdentity(),
    tooling: toolingIdentity(),
    selection: { patterns: UNIT_TEST_PATTERNS, tests: parts.tests },
    invocation,
    inventory: parts.inventoryRecord,
    workers: parts.evidence.workers,
    nested: parts.evidence.nested,
    raw: parts.evidence.raw,
    modules: parts.evidence.modules,
    artifacts: {
      lcov: parts.lcov,
      public: { lcov: PUBLIC_LCOV_PATH, manifest: PUBLIC_MANIFEST_PATH },
    },
    outcome: parts.outcome,
  };
}

function copyAtomically(sourcePath, targetPath) {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, readFileSync(sourcePath));
  renameSync(temporaryPath, targetPath);
}

// The run manifest is always written; the public pointer only for a captured
// run, and only after the public LCOV has been copied and re-hashed, so the
// pointer is the last byte a successful run produces.
function publish(run, manifest) {
  const runManifestPath = path.join(run.runDirectory, "manifest.json");
  writeJsonAtomically(runManifestPath, manifest);

  if (manifest.status !== "captured") {
    return;
  }

  const publicLcovPath = path.join(run.root, PUBLIC_LCOV_PATH);
  copyAtomically(path.join(run.root, manifest.artifacts.lcov.path), publicLcovPath);

  if (sha256(readFileSync(publicLcovPath)) !== manifest.artifacts.lcov.digest) {
    throw new Error(`Published LCOV does not match the captured digest: ${PUBLIC_LCOV_PATH}`);
  }

  copyAtomically(runManifestPath, path.join(run.root, PUBLIC_MANIFEST_PATH));
}

function report(run, manifest) {
  if (manifest.status === "captured") {
    process.stdout.write(
      `Coverage capture ${run.runId}: ${manifest.workers.length} worker(s), ${manifest.raw.length} raw record(s), ${manifest.modules.length} module(s) -> ${PUBLIC_MANIFEST_PATH}\n`,
    );
    return 0;
  }

  const reasons = manifest.failures
    .map((failure) => `  ${canonicalJson(failure).trim()}`)
    .join("\n");
  process.stderr.write(
    `Coverage capture ${run.runId} refused with ${manifest.failures.length} failure(s):\n${reasons}\nEvidence retained under ${run.runPrefix}\n`,
  );
  return 1;
}

function captureRun(root) {
  const run = createRun(root);
  const inventory = enumerateInventory(root);
  const tests = selectedTests(root);
  const failures = [];

  if (!inventory.some((entry) => entry.group === "production")) {
    failures.push({ kind: "empty-production-inventory" });
  }

  if (tests.length === 0) {
    failures.push({ kind: "empty-selection", patterns: UNIT_TEST_PATTERNS });
  }

  const inventoryRecord = snapshotInventory(run, inventory);
  const invocation = buildInvocation(run);
  let evidence = emptyEvidence();
  let outcome = null;

  if (failures.length === 0) {
    outcome = executeRunner(run, invocation);
    failures.push(...outcomeFailures(outcome));
    failures.push(...driftFailures("after-execution", inventory, enumerateInventory(root)));
    evidence = reconcile(run, outcome.pid, tests, inventory);
    failures.push(...evidence.failures);
  }

  const lcov = lcovArtifact(run);

  if (failures.length === 0 && lcov.digest === null) {
    failures.push({ kind: "missing-artifact", path: lcov.path });
  }

  if (failures.length === 0) {
    failures.push(...driftFailures("before-publication", inventory, enumerateInventory(root)));
  }

  const manifest = assembleManifest(run, {
    failures,
    tests,
    inventoryRecord,
    invocation,
    evidence,
    lcov,
    outcome: outcome === null ? null : { status: outcome.status, signal: outcome.signal },
  });
  publish(run, manifest);
  return report(run, manifest);
}

function verifyRun(root) {
  const verdict = verifyCaptureBundle(root, {
    tooling: toolingIdentity(),
    runtime: runtimeIdentity(),
  });

  if (verdict.ok) {
    process.stdout.write(`Coverage capture verified: ${verdict.manifest.runId}\n`);
    return 0;
  }

  const reasons = verdict.failures
    .map((failure) => `  ${canonicalJson(failure).trim()}`)
    .join("\n");
  process.stderr.write(`Coverage capture refused on readback:\n${reasons}\n`);
  return 1;
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.verify) {
    return verifyRun(options.root);
  }

  refuseForeignLoaders();
  return captureRun(options.root);
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
