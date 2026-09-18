// `npm run coverage:validate`: the fail-closed acceptance of a candidate
// Istanbul map against the capture run it claims to describe (D-02, D-03,
// D-09).
//
//   node scripts/coverage-validate.mjs [--root <dir>] [--map <istanbul.json>]
//                                      [--receipt <json>]
//
// The published capture bundle under `root` is read back the way every
// consumer must (`verifyCaptureBundle`): pointer, run manifest, artifact
// digests, module stores and the inventory recomputed from the tree. The
// candidate map (`coverage/unit.istanbul.json` by default) must then name,
// by canonical contained paths, exactly the production sources that run
// inventoried, and each record must pass, against the run's own immutable
// source and executed text, the position-preserving strip proof, the strict
// schema (shape, counters, concrete positions, implicit-else convention) and
// the independent syntax correspondence.
//
// An accepted map earns a receipt (`coverage/unit.validation.json` by
// default) that binds the verdict to its exact inputs: the run, the digest
// of the public manifest, the digest of the map bytes, the source and
// executed-text digests of every validated module, the schema and syntax
// model versions, the digests of the validator scripts and the runtime. A
// receipt from an earlier run is removed before validation starts, so no
// acceptance survives a refusal. Any failure refuses the whole map with exit
// status 1 and one `{ kind, ... }` row per finding on stderr; a usage or
// setup error exits 2 before anything is read. The module is inert on import.

import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RUNS_DIRECTORY,
  runtimeIdentity,
  sha256,
  toolingIdentity,
  toProjectPath,
  verifyCaptureBundle,
  writeJsonAtomically,
} from "./coverage-capture.manifest.mjs";
import {
  CORRESPONDENCE_SYNTAX_VERSION,
  correspondenceFailures,
  syntaxInventory,
} from "./coverage-correspondence.mjs";
import { COVERAGE_SCHEMA_VERSION, fileFailures, mapFiles } from "./coverage-schema.mjs";
import { executedSourceMap, openCaptureRun, recordedModule } from "./coverage-source-map.mjs";

const PUBLIC_MANIFEST_PATH = "coverage/unit.manifest.json";
const DEFAULT_MAP_PATH = "coverage/unit.istanbul.json";
const DEFAULT_RECEIPT_PATH = "coverage/unit.validation.json";
const RECEIPT_KIND = "pi-claude-marketplace-unit-coverage-validation";
const RECEIPT_SCHEMA_VERSION = 1;

// The scripts whose bytes decide a verdict, read next to this module.
const VALIDATOR_TOOLING = [
  "coverage-validate.mjs",
  "coverage-schema.mjs",
  "coverage-correspondence.mjs",
  "coverage-syntax.mjs",
  "coverage-source-map.mjs",
];
const OPTIONS = ["--root", "--map", "--receipt"];

class UsageError extends Error {}

// A refusal: `failures` carries the `{ kind, ... }` rows.
class ValidationError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = "ValidationError";
    this.failures = failures;
  }
}

// `--map` and `--receipt` resolve against the root; the root must exist.
function parseArguments(args) {
  const options = { root: process.cwd(), map: DEFAULT_MAP_PATH, receipt: DEFAULT_RECEIPT_PATH };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (OPTIONS.includes(argument) && value !== undefined) {
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new UsageError(
        `Unknown option: ${argument}. Pass [--root <dir>] [--map <istanbul.json>] [--receipt <json>].`,
      );
    }
  }

  const root = path.resolve(options.root);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new UsageError(`Root is not a directory: ${root}`);
  }

  return {
    root,
    map: path.resolve(root, options.map),
    receipt: path.resolve(root, options.receipt),
  };
}

// The capture run the bundle points at, current for this tree and tooling.
function currentRun(root) {
  const verdict = verifyCaptureBundle(root, {
    tooling: toolingIdentity(),
    runtime: runtimeIdentity(),
  });

  if (!verdict.ok) {
    throw new ValidationError("The capture bundle is not current", verdict.failures);
  }

  return openCaptureRun(path.join(root, RUNS_DIRECTORY, verdict.manifest.runId, "manifest.json"));
}

function readCandidateMap(root, mapPath) {
  const projectPath = toProjectPath(root, mapPath) ?? mapPath;

  if (!existsSync(mapPath)) {
    throw new ValidationError(`${mapPath} does not exist`, [
      { kind: "missing-artifact", path: projectPath },
    ]);
  }

  const bytes = readFileSync(mapPath);

  try {
    return { map: JSON.parse(bytes.toString("utf8")), digest: sha256(bytes) };
  } catch {
    throw new ValidationError(`${mapPath} is not JSON`, [
      { kind: "malformed-json", path: projectPath },
    ]);
  }
}

function productionPaths(run) {
  const inventory = JSON.parse(readFileSync(path.join(run.directory, "inventory.json"), "utf8"));
  return inventory.filter((entry) => entry.group === "production").map((entry) => entry.path);
}

// The map must name, by canonical contained paths, every production source
// the run inventoried and no other file.
function population(root, production, map) {
  const { files, failures } = mapFiles(map, root);
  const keyed = new Map();

  for (const [projectPath, key] of files) {
    if (production.includes(projectPath)) {
      keyed.set(projectPath, key);
    } else {
      failures.push({ kind: "unlisted-file", path: key });
    }
  }

  for (const projectPath of production) {
    if (!keyed.has(projectPath)) {
      failures.push({ kind: "production-missing", path: projectPath });
    }
  }

  return { keyed, failures };
}

function withPath(failures, projectPath) {
  return failures.map((failure) => ({ ...failure, path: projectPath }));
}

// One record against the run's own bytes: the executed text must be a
// position-preserving strip of the source, the record must have the strict
// schema with every location a concrete position in that source, and it
// must correspond exactly to the syntax.
function fileVerdict(run, projectPath, file) {
  const module = recordedModule(run, projectPath);
  executedSourceMap(module);
  const schema = fileFailures(file, module.original);

  if (schema.length > 0) {
    return { failures: withPath(schema, projectPath) };
  }

  const inventory = syntaxInventory(module.executed);

  return {
    failures: withPath(correspondenceFailures(file, module.executed), projectPath),
    counts: {
      functions: inventory.functions.length,
      statements: inventory.statements.length,
      branches: inventory.branches.length,
    },
  };
}

function rowsOf(error) {
  if (Array.isArray(error.failures)) {
    return error.failures;
  }

  throw error;
}

function validatorTooling() {
  const identity = {};

  for (const fileName of VALIDATOR_TOOLING) {
    identity[fileName] = sha256(readFileSync(fileURLToPath(new URL(fileName, import.meta.url))));
  }

  return identity;
}

// The acceptance bound to its exact inputs; `modules` are the run's records
// of every validated file, in the order the map was read.
function receiptFor(options, run, keyed, mapDigest, totals) {
  const records = new Map(run.manifest.modules.map((record) => [record.path, record]));

  return {
    kind: RECEIPT_KIND,
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    status: "accepted",
    runId: run.manifest.runId,
    manifest: {
      path: PUBLIC_MANIFEST_PATH,
      digest: sha256(readFileSync(path.join(options.root, PUBLIC_MANIFEST_PATH))),
    },
    map: { path: toProjectPath(options.root, options.map) ?? options.map, digest: mapDigest },
    modules: [...keyed.keys()].map((projectPath) => {
      const { source, executed } = records.get(projectPath);
      return { path: projectPath, source, executed };
    }),
    model: { coverageSchema: COVERAGE_SCHEMA_VERSION, syntax: CORRESPONDENCE_SYNTAX_VERSION },
    tooling: validatorTooling(),
    runtime: runtimeIdentity(),
    totals: { files: keyed.size, ...totals },
  };
}

function validate(options) {
  rmSync(options.receipt, { force: true });
  const run = currentRun(options.root);
  const { map, digest } = readCandidateMap(options.root, options.map);
  const { keyed, failures } = population(options.root, productionPaths(run), map);
  const totals = { functions: 0, statements: 0, branches: 0 };

  for (const [projectPath, key] of keyed) {
    let verdict;

    try {
      verdict = fileVerdict(run, projectPath, map[key]);
    } catch (error) {
      verdict = { failures: withPath(rowsOf(error), projectPath) };
    }

    failures.push(...verdict.failures);

    for (const [counter, count] of Object.entries(verdict.counts ?? {})) {
      totals[counter] += count;
    }
  }

  if (failures.length > 0) {
    throw new ValidationError("The coverage map is refused", failures);
  }

  const receipt = receiptFor(options, run, keyed, digest, totals);
  writeJsonAtomically(options.receipt, receipt);
  return {
    ...receipt,
    receiptPath: toProjectPath(options.root, options.receipt) ?? options.receipt,
  };
}

function report(accepted) {
  const { runId, totals, model, receiptPath } = accepted;
  process.stdout.write(
    `Coverage map validated: ${runId}, ${totals.files} file(s), ${totals.functions} function(s), ${totals.statements} statement(s), ${totals.branches} branch(es), schema ${model.coverageSchema}, syntax model ${model.syntax}; receipt ${receiptPath}\n`,
  );
}

function refuse(error) {
  const rows = rowsOf(error)
    .map((failure) => `  ${JSON.stringify(failure)}`)
    .join("\n");
  process.stderr.write(`${error.message}:\n${rows}\n`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  try {
    report(validate(options));
    return 0;
  } catch (error) {
    refuse(error);
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
