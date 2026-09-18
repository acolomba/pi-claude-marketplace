// `npm run coverage:unit:verified`: one native unit run, converted, validated
// and published as one accepted bundle (D-01, D-02, D-04, D-07, D-10).
//
//   node scripts/coverage-unit.mjs [--root <dir>] [--reuse-current]
//
// The steps run in order, each one a shipping command-line tool of this
// pipeline, and the run stops at the first refusal:
//
// 1. `coverage-capture.mjs` runs the unit selection once and publishes the
//    native LCOV and a captured manifest; the previous public bundle is gone
//    from the moment it starts.
// 2. `coverage-producer.mjs` converts every raw V8 snapshot of that run for
//    every production source, loaded or not, into one Istanbul map under the
//    run directory and writes the producer identity receipt beside it.
// 3. `coverage-validate.mjs` validates that map against the run's own bytes
//    and writes its acceptance receipt beside it.
// 4. The acceptance record binds the captured manifest, the map, both
//    receipts, the conversion tooling, the population of production sources
//    (loaded, unloaded executable, unloaded type-only) and the native and
//    syntax denominators, labeled apart (`coverage-acceptance.mjs`, which the
//    readback recomputes). The map and the validation receipt
//    are copied to their public paths, the accepted manifest is written last,
//    and the whole bundle is read back the way a consumer reads it.
//
// A refusal at any step removes every public artifact, keeps the run
// directory as evidence and exits 1 with one `{ kind, ... }` row per finding;
// a crash removes the same artifacts and exits 1 with its message; a usage
// error exits 2. The LCOV is the runner's own output and is never rewritten
// (D-01). No test runs twice: the raw snapshots of the one native run feed
// the conversion (D-10).
//
// `--reuse-current` is the orchestration step the pre-commit hooks run
// (D-10). When the published bundle is accepted and `coverage-validate.mjs`
// accepts it now, against this tree, this tooling, this runtime and the
// installed producer, the bundle is reported as reused and no test runs;
// otherwise the four steps run in full. Only this producer reuses: a
// consumer such as `coverage:risk` refuses the same stale bundle and
// regenerates nothing.

import { spawnSync } from "node:child_process";
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

import { acceptanceSummary, productionPaths } from "./coverage-acceptance.mjs";
import {
  acceptanceToolingIdentity,
  PUBLIC_ISTANBUL_PATH,
  PUBLIC_LCOV_PATH,
  PUBLIC_MANIFEST_PATH,
  PUBLIC_VALIDATION_PATH,
  RUNS_DIRECTORY,
  runtimeIdentity,
  sha256,
  toolingIdentity,
  verifyCaptureBundle,
  writeJsonAtomically,
} from "./coverage-capture.manifest.mjs";
import { openCaptureRun } from "./coverage-source-map.mjs";

const ACCEPTANCE_SCHEMA_VERSION = 1;
const PUBLIC_PATHS = [
  PUBLIC_MANIFEST_PATH,
  PUBLIC_LCOV_PATH,
  PUBLIC_ISTANBUL_PATH,
  PUBLIC_VALIDATION_PATH,
];
// A child's stderr can hold the runner's warnings for every worker.
const CHILD_OUTPUT_BUDGET = 256 * 1024 * 1024;

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const scriptPath = (name) => fileURLToPath(new URL(name, import.meta.url));

class UsageError extends Error {}

// A refusal: `failures` carries the `{ kind, ... }` rows.
class AcceptanceError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = "AcceptanceError";
    this.failures = failures;
  }
}

function parseArguments(args) {
  const options = { root: projectRoot, reuseCurrent: false };

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--reuse-current") {
      options.reuseCurrent = true;
    } else if (args[index] === "--root" && args[index + 1] !== undefined) {
      options.root = path.resolve(args[index + 1]);
      index += 1;
    } else {
      throw new UsageError(
        `Unknown option: ${args[index]}. Pass --root <dir> and/or --reuse-current.`,
      );
    }
  }

  if (!existsSync(options.root)) {
    throw new UsageError(`Root is not a directory: ${options.root}`);
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

// The `{ kind, ... }` rows a pipeline tool prints one per line after its
// refusal message.
function rowsIn(stderr) {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("  {"))
    .map((line) => JSON.parse(line));
}

// A tool's stderr is re-emitted indented, so this command's own rows stay
// the only rows a reader of this command's stderr sees.
function relayStderr(stderr) {
  if (stderr !== "") {
    process.stderr.write(
      `${stderr.replace(/^(?=.)/gmu, "    ")}${stderr.endsWith("\n") ? "" : "\n"}`,
    );
  }
}

// Runs one tool of the pipeline. Its stdout streams through; its stderr is
// relayed. A launch failure, a signal and a refusal are three different
// rows; `failuresOf` reads the refused tool's own rows.
function runStep(kind, name, args, root, failuresOf = rowsIn) {
  const completed = spawnSync(process.execPath, [scriptPath(name), ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: CHILD_OUTPUT_BUDGET,
    stdio: ["ignore", "inherit", "pipe"],
  });
  const stderr = completed.stderr ?? "";
  relayStderr(stderr);

  if (completed.error !== undefined) {
    throw new AcceptanceError(`${name} did not launch`, [
      { kind, outcome: "launch", error: completed.error.message },
    ]);
  }

  if (completed.signal !== null) {
    throw new AcceptanceError(`${name} ended by signal ${completed.signal}`, [
      { kind, outcome: "signal", signal: completed.signal },
    ]);
  }

  if (completed.status !== 0) {
    throw new AcceptanceError(`${name} exited ${completed.status}`, [
      { kind, status: completed.status, failures: failuresOf(stderr) },
    ]);
  }
}

function runDirectories(root) {
  const runsDirectory = path.join(root, RUNS_DIRECTORY);
  return existsSync(runsDirectory) ? readdirSync(runsDirectory) : [];
}

// The capture prints its rows as pretty JSON, so a refused capture is read
// from the manifest of the one run directory it created instead.
function capture(root) {
  const before = new Set(runDirectories(root));
  runStep("capture", "coverage-capture.mjs", ["--root", root], root, () => {
    const created = runDirectories(root).filter((runId) => !before.has(runId));
    return created.length === 1
      ? readJson(path.join(root, RUNS_DIRECTORY, created[0], "manifest.json")).failures
      : [{ kind: "run-directory", created }];
  });
}

// The captured bundle the capture step published, read back as a consumer.
function capturedBundle(root) {
  const verdict = verifyCaptureBundle(root, {
    tooling: toolingIdentity(),
    runtime: runtimeIdentity(),
  });

  if (!verdict.ok) {
    throw new AcceptanceError("The captured bundle is not current", verdict.failures);
  }

  if (verdict.manifest.state !== "captured") {
    throw new AcceptanceError("The published bundle is not a fresh capture", [
      { kind: "not-captured", state: verdict.manifest.state },
    ]);
  }

  const runPrefix = `${RUNS_DIRECTORY}/${verdict.manifest.runId}`;
  const run = openCaptureRun(path.join(root, runPrefix, "manifest.json"));
  return { manifest: verdict.manifest, run, runPrefix, runDirectory: run.directory };
}

// Every production source in the run's raw snapshots, in the run's order,
// converted into the run directory.
function convert(root, bundle) {
  const request = {
    run: path.join(root, bundle.runPrefix, "manifest.json"),
    modules: productionPaths(bundle.run),
    raw: bundle.manifest.raw.map((record) => path.join(root, record.path)),
  };
  const requestPath = path.join(bundle.runDirectory, "unit.request.json");
  writeJsonAtomically(requestPath, request);
  const out = path.join(bundle.runDirectory, "unit.istanbul.json");
  const receipt = path.join(bundle.runDirectory, "unit.producer.json");
  runStep(
    "conversion",
    "coverage-producer.mjs",
    ["--request", requestPath, "--out", out, "--receipt", receipt],
    root,
  );
  return {
    istanbul: `${bundle.runPrefix}/unit.istanbul.json`,
    producer: `${bundle.runPrefix}/unit.producer.json`,
  };
}

function validate(root, bundle, artifacts) {
  const receipt = `${bundle.runPrefix}/unit.validation.json`;
  runStep(
    "validation",
    "coverage-validate.mjs",
    ["--root", root, "--map", artifacts.istanbul, "--receipt", receipt],
    root,
  );
  return receipt;
}

function digested(root, projectPath) {
  return { path: projectPath, digest: sha256(readFileSync(path.join(root, projectPath))) };
}

// The acceptance record: the captured manifest promoted, with everything the
// conversion added bound by digest.
function acceptedManifest(root, bundle, artifacts, validation) {
  const map = readJson(path.join(root, artifacts.istanbul));
  const receipt = readJson(path.join(root, validation));

  return {
    ...bundle.manifest,
    state: "accepted",
    acceptance: {
      schemaVersion: ACCEPTANCE_SCHEMA_VERSION,
      acceptedAt: new Date().toISOString(),
      captured: digested(root, `${bundle.runPrefix}/manifest.json`),
      tooling: acceptanceToolingIdentity(),
      producer: {
        ...digested(root, artifacts.producer),
        identity: readJson(path.join(root, artifacts.producer)),
      },
      validation: { ...digested(root, validation), model: receipt.model },
      artifacts: {
        istanbul: digested(root, artifacts.istanbul),
        public: { istanbul: PUBLIC_ISTANBUL_PATH, validation: PUBLIC_VALIDATION_PATH },
      },
      ...acceptanceSummary(root, bundle.run, bundle.manifest, map),
    },
  };
}

function copyAtomically(root, sourcePath, targetPath) {
  const target = path.join(root, targetPath);
  mkdirSync(path.dirname(target), { recursive: true });
  const temporaryPath = `${target}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, readFileSync(path.join(root, sourcePath)));
  renameSync(temporaryPath, target);
}

// The map and the validation receipt go public first, the manifest last, so
// the pointer is the final byte an acceptance produces; the bundle is then
// read back the way every consumer reads it.
function publish(root, bundle, accepted) {
  const acceptedPath = `${bundle.runPrefix}/accepted.json`;
  writeJsonAtomically(path.join(root, acceptedPath), accepted);
  copyAtomically(root, accepted.acceptance.artifacts.istanbul.path, PUBLIC_ISTANBUL_PATH);
  copyAtomically(root, accepted.acceptance.validation.path, PUBLIC_VALIDATION_PATH);
  copyAtomically(root, acceptedPath, PUBLIC_MANIFEST_PATH);
  const readback = verifyCaptureBundle(root, {
    tooling: toolingIdentity(),
    runtime: runtimeIdentity(),
  });

  if (!readback.ok) {
    throw new AcceptanceError("The published bundle does not read back", readback.failures);
  }
}

// The published bundle's state, or `undefined` without a readable pointer.
function publishedState(root) {
  try {
    return readJson(path.join(root, PUBLIC_MANIFEST_PATH)).state;
  } catch {
    return undefined;
  }
}

// The accepted bundle `coverage-validate.mjs` accepts now, or `undefined`
// when none is published or the validator refuses it. A refusal (exit 1) is
// the one answer that selects a fresh run, and its rows are relayed so the
// reader sees why; any other failure of the validator is an error.
function currentAccepted(root) {
  if (publishedState(root) !== "accepted") {
    return undefined;
  }

  const completed = spawnSync(
    process.execPath,
    [scriptPath("coverage-validate.mjs"), "--root", root],
    { cwd: root, encoding: "utf8", maxBuffer: CHILD_OUTPUT_BUDGET, stdio: "pipe" },
  );
  relayStderr(completed.stderr ?? "");

  if (completed.error !== undefined || completed.signal !== null) {
    throw new AcceptanceError("coverage-validate.mjs did not answer", [
      { kind: "readback", outcome: completed.error?.message ?? `signal ${completed.signal}` },
    ]);
  }

  if (completed.status === 1) {
    process.stderr.write("The published bundle is not current; the unit suite runs anew.\n");
    return undefined;
  }

  if (completed.status !== 0) {
    throw new AcceptanceError(`coverage-validate.mjs exited ${completed.status}`, [
      { kind: "readback", status: completed.status },
    ]);
  }

  return readJson(path.join(root, PUBLIC_MANIFEST_PATH));
}

function report(accepted, verb) {
  const { population, denominators } = accepted.acceptance;
  const { native, syntax } = denominators;
  const ratio = (counter) => `${counter.hit ?? counter.covered}/${counter.found ?? counter.total}`;
  process.stdout.write(
    `Coverage unit ${verb}: ${accepted.runId}: ${population.production} production file(s), ${population.loaded} loaded, ${population.unloaded.length} unloaded (${population.typeOnly} type-only, ${population.executable} executable); native ${ratio(native.lines)} line(s), ${ratio(native.functions)} function(s), ${ratio(native.branches)} branch(es); syntax ${ratio(syntax.functions)} function(s), ${ratio(syntax.statements)} statement(s), ${ratio(syntax.branchArms)} branch arm(s) -> ${PUBLIC_MANIFEST_PATH}\n`,
  );
}

function removePublicArtifacts(root) {
  for (const publicPath of PUBLIC_PATHS) {
    rmSync(path.join(root, publicPath), { force: true });
  }
}

function verifiedRun(root) {
  removePublicArtifacts(root);
  capture(root);
  const bundle = capturedBundle(root);
  const artifacts = convert(root, bundle);
  const validation = validate(root, bundle, artifacts);
  const accepted = acceptedManifest(root, bundle, artifacts, validation);
  publish(root, bundle, accepted);
  return accepted;
}

// The public artifacts go first on every failure, so a crash between the
// capture's publication and the acceptance leaves no half bundle behind;
// only a refusal has rows to print.
function refuse(root, error) {
  removePublicArtifacts(root);

  if (!Array.isArray(error.failures)) {
    throw error;
  }

  const rows = error.failures.map((failure) => `  ${JSON.stringify(failure)}`).join("\n");
  process.stderr.write(`${error.message}:\n${rows}\nEvidence retained under ${RUNS_DIRECTORY}\n`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  try {
    const current = options.reuseCurrent ? currentAccepted(options.root) : undefined;

    if (current === undefined) {
      report(verifiedRun(options.root), "verified");
    } else {
      report(current, "reused");
    }

    return 0;
  } catch (error) {
    refuse(options.root, error);
    return 1;
  }
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
