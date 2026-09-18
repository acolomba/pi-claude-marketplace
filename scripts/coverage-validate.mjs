// `npm run coverage:validate`: the fail-closed acceptance of an Istanbul map
// against the capture run it claims to describe (D-02, D-03, D-09, D-10).
//
//   node scripts/coverage-validate.mjs [--root <dir>] [--map <istanbul.json>]
//                                      [--receipt <json>]
//
// The published bundle under `root` is read back the way every consumer must
// (`verifyCaptureBundle`): pointer, run record, artifact digests, module
// stores, population and the inventory recomputed from the tree. What happens
// next depends on the bundle's state.
//
// A `captured` bundle takes a candidate map (`coverage/unit.istanbul.json`
// by default). It must name, by canonical contained paths, exactly the
// production sources that run inventoried, and each record must pass, against
// the run's own immutable source and executed text, the position-preserving
// strip proof, the strict schema (shape, counters, concrete positions,
// implicit-else convention) and the independent syntax correspondence; a
// source the run never loaded must carry only zero counters. An accepted map
// earns a receipt (`coverage/unit.validation.json` by default) that binds the
// verdict to its exact inputs: the run, the digest of the captured manifest,
// the digest of the map bytes, the source and executed-text digests of every
// validated module, the schema and syntax model versions, the digests of the
// validator scripts and the runtime. A receipt from an earlier run is removed
// before validation starts, so no acceptance survives a refusal.
//
// An `accepted` bundle is the published result of `coverage:unit:verified`,
// and no argument beyond `--root` applies. The installed producer must still
// be the one the acceptance recorded, the accepted map is validated again in
// full from the run's own bytes, and the receipt that validation would write
// now must equal the receipt the bundle carries; nothing is written.
//
// Any failure refuses with exit status 1 and one `{ kind, ... }` row per
// finding on stderr; a usage or setup error exits 2 before anything is read.
// The module is inert on import.

import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  PUBLIC_MANIFEST_PATH,
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
import { loadProducer, producerIdentity } from "./coverage-producer.convert.mjs";
import { COVERAGE_SCHEMA_VERSION, fileFailures, mapFiles } from "./coverage-schema.mjs";
import { executedSourceMap, openCaptureRun, recordedModule } from "./coverage-source-map.mjs";

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
  const explicit = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (OPTIONS.includes(argument) && value !== undefined) {
      options[argument.slice(2)] = value;
      explicit.push(argument);
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
    candidateOptions: explicit.filter((argument) => argument !== "--root"),
  };
}

// The state the public pointer declares, or `undefined` when there is no
// readable pointer; the bundle itself is judged by `verifyCaptureBundle`.
function publishedState(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, PUBLIC_MANIFEST_PATH), "utf8")).state;
  } catch {
    return undefined;
  }
}

// The published bundle, current for this tree and tooling, and the capture
// run it points at.
function currentBundle(root) {
  const verdict = verifyCaptureBundle(root, {
    tooling: toolingIdentity(),
    runtime: runtimeIdentity(),
  });

  if (!verdict.ok) {
    throw new ValidationError("The capture bundle is not current", verdict.failures);
  }

  const runManifestPath = path.join(root, RUNS_DIRECTORY, verdict.manifest.runId, "manifest.json");
  return { published: verdict.manifest, run: openCaptureRun(runManifestPath) };
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

// A source the run never loaded cannot have executed: every counter of its
// record must be zero (D-07).
function unloadedHitFailures(file) {
  const counters = [
    ...Object.entries(file.s).map(([id, hits]) => [`s[${id}]`, hits]),
    ...Object.entries(file.f).map(([id, hits]) => [`f[${id}]`, hits]),
    ...Object.entries(file.b).flatMap(([id, hits]) =>
      hits.map((value, index) => [`b[${id}][${index}]`, value]),
    ),
  ];

  return counters
    .filter(([, hits]) => hits !== 0)
    .map(([part, hits]) => ({ kind: "unloaded-hits", part, hits }));
}

// One record against the run's own bytes: the executed text must be a
// position-preserving strip of the source, the record must have the strict
// schema with every location a concrete position in that source, it must
// correspond exactly to the syntax, and an unloaded source must show no
// execution.
function fileVerdict(run, projectPath, file) {
  const module = recordedModule(run, projectPath);
  executedSourceMap(module);
  const schema = fileFailures(file, module.original);
  const digests = { source: sha256(module.original), executed: sha256(module.executed) };

  if (schema.length > 0) {
    return { failures: withPath(schema, projectPath), digests };
  }

  const inventory = syntaxInventory(module.executed);
  const failures = [
    ...correspondenceFailures(file, module.executed),
    ...(module.loaded ? [] : unloadedHitFailures(file)),
  ];

  return {
    failures: withPath(failures, projectPath),
    digests,
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

// Every production record of `map` judged against `run`: the files that
// passed with their source and executed digests, the failure rows, and the
// syntax totals of the files that reached correspondence.
function validateMap(root, run, map) {
  const { keyed, failures } = population(root, productionPaths(run), map);
  const totals = { functions: 0, statements: 0, branches: 0 };
  const modules = [];

  for (const [projectPath, key] of keyed) {
    let verdict;

    try {
      verdict = fileVerdict(run, projectPath, map[key]);
    } catch (error) {
      verdict = { failures: withPath(rowsOf(error), projectPath) };
    }

    failures.push(...verdict.failures);

    if (verdict.digests !== undefined) {
      modules.push({ path: projectPath, ...verdict.digests });
    }

    for (const [counter, count] of Object.entries(verdict.counts ?? {})) {
      totals[counter] += count;
    }
  }

  if (failures.length > 0) {
    throw new ValidationError("The coverage map is refused", failures);
  }

  return { files: keyed.size, modules, totals };
}

// The acceptance bound to its exact inputs. `manifestDigest` is the digest of
// the captured manifest the map was validated against, and `modules` are the
// validated files' source and executed digests in the order the map was read.
function receiptFor(options, run, validated, mapDigest, manifestDigest) {
  return {
    kind: RECEIPT_KIND,
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    status: "accepted",
    runId: run.manifest.runId,
    manifest: { path: PUBLIC_MANIFEST_PATH, digest: manifestDigest },
    map: { path: toProjectPath(options.root, options.map) ?? options.map, digest: mapDigest },
    modules: validated.modules,
    model: { coverageSchema: COVERAGE_SCHEMA_VERSION, syntax: CORRESPONDENCE_SYNTAX_VERSION },
    tooling: validatorTooling(),
    runtime: runtimeIdentity(),
    totals: { files: validated.files, ...validated.totals },
  };
}

// A captured bundle and a candidate map: validate, then write the receipt.
function acceptCandidate(options) {
  rmSync(options.receipt, { force: true });
  const { run } = currentBundle(options.root);
  const { map, digest } = readCandidateMap(options.root, options.map);
  const validated = validateMap(options.root, run, map);
  const manifestDigest = sha256(readFileSync(path.join(options.root, PUBLIC_MANIFEST_PATH)));
  const receipt = receiptFor(options, run, validated, digest, manifestDigest);
  writeJsonAtomically(options.receipt, receipt);

  return {
    ...receipt,
    verb: "map validated",
    trailer: `receipt ${toProjectPath(options.root, options.receipt) ?? options.receipt}`,
  };
}

// The installed producer, parser, merger, codec, runtime and adapter must be
// the ones the acceptance recorded; a changed patch or version invalidates
// every converted map (D-05).
async function producerFailures(acceptance) {
  const current = producerIdentity(await loadProducer());
  const recorded = acceptance.producer.identity;
  const changed = Object.keys(current).filter(
    (key) => canonicalJson(current[key]) !== canonicalJson(recorded?.[key]),
  );

  return changed.length === 0 ? [] : [{ kind: "producer-changed", fields: changed }];
}

// An accepted bundle: nothing is written, the map is validated again from
// the run's bytes, and the receipt that validation yields must be the one
// the bundle carries.
async function verifyAccepted(options) {
  if (options.candidateOptions.length > 0) {
    throw new UsageError(
      `The published bundle is accepted; ${options.candidateOptions.join(" and ")} apply to a captured bundle only.`,
    );
  }

  const { published, run } = currentBundle(options.root);
  const { acceptance } = published;
  const producer = await producerFailures(acceptance);

  if (producer.length > 0) {
    throw new ValidationError("The accepted bundle names another producer", producer);
  }

  const mapPath = path.join(options.root, acceptance.artifacts.istanbul.path);
  const { map, digest } = readCandidateMap(options.root, mapPath);
  const validated = validateMap(options.root, run, map);
  const manifestDigest = sha256(readFileSync(path.join(run.directory, "manifest.json")));
  const receipt = receiptFor(
    { root: options.root, map: mapPath },
    run,
    validated,
    digest,
    manifestDigest,
  );
  const recorded = readFileSync(path.join(options.root, acceptance.validation.path), "utf8");

  if (recorded !== canonicalJson(receipt)) {
    const stored = JSON.parse(recorded);
    const fields = Object.keys(receipt).filter(
      (key) => canonicalJson(receipt[key]) !== canonicalJson(stored[key]),
    );
    throw new ValidationError("The accepted receipt is not the one validation yields", [
      { kind: "receipt-mismatch", path: acceptance.validation.path, fields },
    ]);
  }

  return { ...receipt, verb: "bundle verified", trailer: `manifest ${PUBLIC_MANIFEST_PATH}` };
}

function report(accepted) {
  const { runId, totals, model, verb, trailer } = accepted;
  process.stdout.write(
    `Coverage ${verb}: ${runId}, ${totals.files} file(s), ${totals.functions} function(s), ${totals.statements} statement(s), ${totals.branches} branch(es), schema ${model.coverageSchema}, syntax model ${model.syntax}; ${trailer}\n`,
  );
}

function refuse(error) {
  const rows = rowsOf(error)
    .map((failure) => `  ${JSON.stringify(failure)}`)
    .join("\n");
  process.stderr.write(`${error.message}:\n${rows}\n`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const accepted = publishedState(options.root) === "accepted";

  try {
    report(await (accepted ? verifyAccepted(options) : acceptCandidate(options)));
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      throw error;
    }

    refuse(error);
    return 1;
  }
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
