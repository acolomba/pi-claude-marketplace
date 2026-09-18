// `npm run coverage:validate`: the fail-closed acceptance of a candidate
// Istanbul map against the capture run it claims to describe (D-02, D-03,
// D-09).
//
//   node scripts/coverage-validate.mjs [--root <dir>] [--map <istanbul.json>]
//
// The published capture bundle under `root` is read back the way every
// consumer must (`verifyCaptureBundle`): pointer, run manifest, artifact
// digests, module stores and the inventory recomputed from the tree. The
// candidate map (`coverage/unit.istanbul.json` by default) must then name,
// by canonical contained paths, exactly the production sources that run
// inventoried, and each record must pass, against the run's own immutable
// source and executed text, the position-preserving strip proof, the strict
// schema (shape, counters, concrete positions, implicit-else convention) and
// the independent syntax correspondence. Any failure refuses the whole map
// with exit status 1 and one `{ kind, ... }` row per finding on stderr; a
// usage error exits 2 before anything is read. The module is inert on import.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RUNS_DIRECTORY,
  runtimeIdentity,
  toolingIdentity,
  toProjectPath,
  verifyCaptureBundle,
} from "./coverage-capture.manifest.mjs";
import {
  CORRESPONDENCE_SYNTAX_VERSION,
  correspondenceFailures,
  syntaxInventory,
} from "./coverage-correspondence.mjs";
import { COVERAGE_SCHEMA_VERSION, fileFailures, mapFiles } from "./coverage-schema.mjs";
import { executedSourceMap, openCaptureRun, recordedModule } from "./coverage-source-map.mjs";

const DEFAULT_MAP_PATH = "coverage/unit.istanbul.json";

class UsageError extends Error {}

// A refusal: `failures` carries the `{ kind, ... }` rows.
class ValidationError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = "ValidationError";
    this.failures = failures;
  }
}

function parseArguments(args) {
  const options = { root: process.cwd(), map: undefined };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if ((argument === "--root" || argument === "--map") && value !== undefined) {
      options[argument.slice(2)] = path.resolve(value);
      index += 1;
    } else {
      throw new UsageError(
        `Unknown option: ${argument}. Pass [--root <dir>] [--map <istanbul.json>].`,
      );
    }
  }

  options.map ??= path.join(options.root, DEFAULT_MAP_PATH);
  return options;
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

  try {
    return JSON.parse(readFileSync(mapPath, "utf8"));
  } catch (error) {
    throw new ValidationError(`${mapPath} is not JSON`, [
      { kind: "malformed-json", path: projectPath, message: error.message },
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

function validate(options) {
  const run = currentRun(options.root);
  const map = readCandidateMap(options.root, options.map);
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

  return { runId: run.manifest.runId, files: keyed.size, totals };
}

function report(accepted) {
  const { runId, files, totals } = accepted;
  process.stdout.write(
    `Coverage map validated: ${runId}, ${files} file(s), ${totals.functions} function(s), ${totals.statements} statement(s), ${totals.branches} branch(es), schema ${COVERAGE_SCHEMA_VERSION}, syntax model ${CORRESPONDENCE_SYNTAX_VERSION}\n`,
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
