// `npm run coverage:risk`: the production CRAP policy applied to the current
// accepted unit coverage bundle through the installed Fallow (D-06, D-08,
// D-09).
//
//   node scripts/check-coverage-risk.mjs [--root <dir>] [--report <json>]
//                                        [--consumer <launcher>]
//
// 1. The policy file beside this script names the threshold and the exact
//    consumer: its name, version, report kind and report schema.
// 2. The public bundle under `root` must be in the accepted state, and
//    `coverage-validate.mjs` must accept it now, so the map the consumer
//    reads is the one the run recorded and validated: fresh, complete and
//    position-exact. A captured bundle nobody accepted is refused before
//    anything is read.
// 3. Every production function is anchored from the run's own executed
//    text: a fresh parse yields each function node's start, its body span
//    and the statements the body contains; the accepted map supplies the
//    hits at those exact spans. Statement coverage is `covered / total` over
//    the contained statements, nested functions' statements included; a
//    body with no statement uses the function's own entry count.
// 4. The consumer runs once in a diagnostic form that lists every function
//    it analyzed (`--report-only --max-crap 1 --format json --no-cache`),
//    with inherited `FALLOW_*` overrides removed and the accepted map passed
//    explicitly. Its findings are data and its exit status decides nothing.
// 5. Each production row is converted from the consumer's byte column to a
//    UTF-16 column through the original source line and joined to exactly
//    one anchor; every anchor must be reported exactly once; every
//    production row must carry `coverage_source: "istanbul"` and a
//    `coverage_pct` equal to the independent proportion. Rows outside the
//    production population (tests, scripts) are counted and never gated.
// 6. CRAP is `cc * cc * (1 - coverage) ** 3 + cc` with the consumer's
//    cyclomatic complexity and the unrounded coverage; a function at or
//    above the threshold is a `crap` row and the gate exits 1. The consumer's
//    own one-decimal labels are recorded beside each function and never
//    compared with the threshold.
//
// Any refusal exits 1 with one `{ kind, ... }` row per finding on stderr; a
// usage error exits 2. `--report` writes the measurement as JSON whenever the
// join completed, verdict included. `--consumer` names the launcher under
// test and exists for the negative controls; the shipped default is the
// installed Fallow. The module is inert on import.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_ISTANBUL_PATH,
  PUBLIC_MANIFEST_PATH,
  RUNS_DIRECTORY,
  writeJsonAtomically,
} from "./coverage-capture.manifest.mjs";
import { syntaxInventory } from "./coverage-correspondence.mjs";
import { openCaptureRun, recordedModule } from "./coverage-source-map.mjs";
import {
  childNodes,
  declaredFunction,
  lineStartsOf,
  locate,
  parseExecuted,
} from "./coverage-syntax.mjs";

const POLICY_PATH = fileURLToPath(new URL("coverage-risk-policy.json", import.meta.url));
const POLICY_PROJECT_PATH = "scripts/coverage-risk-policy.json";
const POLICY_KIND = "pi-claude-marketplace-coverage-risk-policy";
const VALIDATOR_PATH = fileURLToPath(new URL("coverage-validate.mjs", import.meta.url));
const DEFAULT_CONSUMER_PATH = fileURLToPath(
  new URL("../node_modules/fallow/bin/fallow", import.meta.url),
);
const REPORT_KIND = "pi-claude-marketplace-coverage-risk";
const REPORT_SCHEMA_VERSION = 1;
// The diagnostic form: every function analyzed is a finding, and the exit
// status is never a verdict.
const DIAGNOSTIC_FLAGS = [
  "--format",
  "json",
  "--no-cache",
  "--report-only",
  "--max-crap",
  "1",
  "--quiet",
];
const CHILD_OUTPUT_BUDGET = 256 * 1024 * 1024;
// The blanks the position-preserving strip writes for the characters it
// removes.
const STRIP_BLANKS = new Set([" ", "\u00a0", "\u2002", "\ufeff"]);
// The consumer's percentage must equal the independent one up to
// floating-point noise; its score is printed to one decimal.
const PERCENT_TOLERANCE = 1e-9;
const SCORE_TOLERANCE = 0.05 + 1e-9;
const OPTIONS = ["--root", "--report", "--consumer"];

class UsageError extends Error {}

// A refusal: `failures` carries the `{ kind, ... }` rows.
class RiskError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = "RiskError";
    this.failures = failures;
  }
}

function parseArguments(args) {
  const options = { root: process.cwd(), report: undefined, consumer: DEFAULT_CONSUMER_PATH };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (OPTIONS.includes(argument) && value !== undefined) {
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new UsageError(
        `Unknown option: ${argument}. Pass [--root <dir>] [--report <json>] [--consumer <launcher>].`,
      );
    }
  }

  const root = path.resolve(options.root);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new UsageError(`Root is not a directory: ${root}`);
  }

  return {
    root,
    report: options.report === undefined ? undefined : path.resolve(root, options.report),
    consumer: path.resolve(options.consumer),
  };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

// The policy is the shipped file beside this script and nothing else.
function readPolicy() {
  let policy;

  try {
    policy = readJson(POLICY_PATH);
  } catch (error) {
    throw new RiskError("The policy file is unreadable", [
      { kind: "policy", path: POLICY_PROJECT_PATH, reason: error.message },
    ]);
  }

  const report = policy.consumer?.report;
  const wellFormed =
    policy.kind === POLICY_KIND &&
    policy.schemaVersion === 1 &&
    isPositive(policy.maxCrap) &&
    typeof policy.consumer.version === "string" &&
    typeof report?.kind === "string" &&
    Number.isInteger(report.schemaVersion);

  if (!wellFormed) {
    throw new RiskError("The policy file is malformed", [
      { kind: "policy", path: POLICY_PROJECT_PATH, reason: "shape" },
    ]);
  }

  return policy;
}

// The public pointer must declare the accepted state before the validator
// runs: on a captured bundle the validator would judge a candidate map and
// write a receipt, which a gate must never do.
function acceptedManifest(root) {
  const manifestPath = path.join(root, PUBLIC_MANIFEST_PATH);

  if (!existsSync(manifestPath)) {
    throw new RiskError("There is no published coverage bundle", [
      { kind: "missing-manifest", path: PUBLIC_MANIFEST_PATH },
    ]);
  }

  let manifest;

  try {
    manifest = readJson(manifestPath);
  } catch {
    throw new RiskError("The published manifest is not JSON", [
      { kind: "malformed-manifest", path: PUBLIC_MANIFEST_PATH },
    ]);
  }

  if (manifest.state !== "accepted") {
    throw new RiskError("The published bundle is not accepted", [
      { kind: "not-accepted", state: manifest.state ?? null },
    ]);
  }

  return manifest;
}

// The `{ kind, ... }` rows a tool prints one per line after its message.
function rowsIn(stderr) {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("  {"))
    .map((line) => JSON.parse(line));
}

function reemit(stderr) {
  if (stderr !== "") {
    process.stderr.write(
      `${stderr.replace(/^(?=.)/gmu, "    ")}${stderr.endsWith("\n") ? "" : "\n"}`,
    );
  }
}

// A child that did not run to a status is a launch or signal row, never a
// verdict.
function processFailure(kind, completed) {
  if (completed.error !== undefined) {
    return { kind, outcome: "launch", error: completed.error.message };
  }

  if (completed.signal !== null) {
    return { kind, outcome: "signal", signal: completed.signal };
  }

  return undefined;
}

// The accepted bundle re-validated in full by the shipping validator; its
// stderr is re-emitted indented so this command's rows stay the only rows.
function validateBundle(root) {
  const completed = spawnSync(process.execPath, [VALIDATOR_PATH, "--root", root], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: CHILD_OUTPUT_BUDGET,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const stderr = completed.stderr ?? "";
  reemit(stderr);
  const failure = processFailure("validation", completed);

  if (failure !== undefined) {
    throw new RiskError("The validator did not reach a verdict", [failure]);
  }

  if (completed.status !== 0) {
    throw new RiskError("The accepted bundle is refused by the validator", [
      { kind: "validation", status: completed.status, failures: rowsIn(stderr) },
    ]);
  }
}

// Every function the executed text declares: the offset its own node starts
// at (the value of a method or property, the node itself otherwise), its
// `decl` offsets, its body offsets and its declared name.
function collectFunctions(node, consumed, found) {
  const fn = declaredFunction(node, consumed);

  if (fn !== undefined) {
    const own =
      fn.outer.type === "MethodDefinition" || fn.outer.type === "Property"
        ? fn.outer.value
        : fn.outer;
    found.push({
      start: own.start,
      decl: fn.decl,
      body: [fn.body.start, fn.body.end],
      name: fn.name,
    });
  }

  for (const child of childNodes(node)) {
    collectFunctions(child, consumed, found);
  }

  return found;
}

// A TypeScript function node begins at its type parameter list, which the
// strip erases to blanks, so the anchor moves back from the executed node
// start over exactly the erased characters: `load<T>(` anchors at `<`. An
// erased optional marker stays outside the anchor, as `opt?(` anchors at
// `(`.
function anchorOffset(module, start) {
  let offset = start;

  while (
    offset > 0 &&
    STRIP_BLANKS.has(module.executed[offset - 1]) &&
    !/\s/u.test(module.original[offset - 1])
  ) {
    offset -= 1;
  }

  return module.original[offset] === "?" ? offset + 1 : offset;
}

function offsetAt(lineStarts, position) {
  return lineStarts[position.line - 1] + position.column;
}

function spanKey(lineStarts, start, end) {
  const from = locate(lineStarts, start);
  const to = locate(lineStarts, end);
  return `${from.line}:${from.column}-${to.line}:${to.column}`;
}

function locationKey(location) {
  return `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;
}

// The statements the executed text declares with the hits the map records
// at exactly their spans; a span the map lacks is a failure row.
function inventoriedStatements(projectPath, file, executed, lineStarts, failures) {
  const hitsByKey = new Map(
    Object.entries(file.statementMap).map(([id, loc]) => [locationKey(loc), file.s[id]]),
  );

  return syntaxInventory(executed).statements.flatMap(({ loc }) => {
    const hits = hitsByKey.get(locationKey(loc));

    if (hits === undefined) {
      failures.push({ kind: "statement-record", path: projectPath, loc });
      return [];
    }

    return [{ start: offsetAt(lineStarts, loc.start), end: offsetAt(lineStarts, loc.end), hits }];
  });
}

// One declared function measured: the statements its body contains, how
// many executed, and its entry count for a body with no statement.
function measureFunction(fn, statements, hits) {
  const contained = statements.filter((s) => s.start >= fn.body[0] && s.end <= fn.body[1]);
  const total = contained.length;
  const covered = contained.filter((s) => s.hits > 0).length;

  return total === 0
    ? { total, covered, coverage: hits > 0 ? 1 : 0 }
    : { total, covered, coverage: covered / total };
}

// Every production function of `projectPath` keyed by its anchor
// (`path:line:column` in UTF-16 units), from the run's own executed text.
function fileAnchors(projectPath, module, file, anchors, failures) {
  const { executed } = module;
  const lineStarts = lineStartsOf(executed);
  const statements = inventoriedStatements(projectPath, file, executed, lineStarts, failures);
  const entriesByKey = new Map(
    Object.entries(file.fnMap).map(([id, fn]) => [
      `${locationKey(fn.decl)}|${locationKey(fn.loc)}`,
      file.f[id],
    ]),
  );

  for (const fn of collectFunctions(parseExecuted(executed), new WeakSet(), [])) {
    const { line, column } = locate(lineStarts, anchorOffset(module, fn.start));
    const key = `${spanKey(lineStarts, ...fn.decl)}|${spanKey(lineStarts, ...fn.body)}`;
    const hits = entriesByKey.get(key);
    const identity = { path: projectPath, line, column, name: fn.name ?? "(anonymous)" };

    if (hits === undefined) {
      failures.push({ kind: "function-record", ...identity });
      continue;
    }

    anchors.set(`${projectPath}:${line}:${column}`, {
      ...identity,
      statements: measureFunction(fn, statements, hits),
      row: undefined,
    });
  }
}

function productionPaths(run) {
  return readJson(path.join(run.directory, "inventory.json"))
    .filter((entry) => entry.group === "production")
    .map((entry) => entry.path);
}

// The production population anchored from the run: every function keyed by
// its anchor and every file's original lines for the column conversion.
function populationAnchors(root, run, map) {
  const production = productionPaths(run);
  const anchors = new Map();
  const linesByPath = new Map();
  const failures = [];

  for (const projectPath of production) {
    const module = recordedModule(run, projectPath);
    const file = map[path.join(root, projectPath)];

    if (file === undefined) {
      failures.push({ kind: "production-missing", path: projectPath });
      continue;
    }

    linesByPath.set(projectPath, module.original.split("\n"));
    fileAnchors(projectPath, module, file, anchors, failures);
  }

  if (failures.length > 0) {
    throw new RiskError("The production population cannot be anchored", failures);
  }

  return { production, anchors, linesByPath };
}

// The consumer's report over `root` with the accepted map as its coverage
// input, in the diagnostic form, under an environment stripped of every
// `FALLOW_*` override. A consumer that yields no report has its stderr
// re-emitted indented, like the validator's, so its own message stands
// beside the status row; the warnings of a consumer that reports stay with
// the report.
function consumerReport(root, mapPath, consumer) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("FALLOW_")),
  );
  const completed = spawnSync(
    process.execPath,
    [consumer, "health", "--root", root, "--coverage", mapPath, ...DIAGNOSTIC_FLAGS],
    { cwd: root, encoding: "utf8", env, maxBuffer: CHILD_OUTPUT_BUDGET },
  );
  const failure = processFailure("consumer", completed);

  if (failure !== undefined) {
    reemit(completed.stderr ?? "");
    throw new RiskError("The consumer did not run", [failure]);
  }

  if (completed.status !== 0) {
    reemit(completed.stderr);
    throw new RiskError("The consumer exited without a report", [
      { kind: "consumer", outcome: "status", status: completed.status },
    ]);
  }

  let report;

  try {
    report = JSON.parse(completed.stdout);
  } catch {
    throw new RiskError("The consumer wrote no JSON report", [
      { kind: "consumer-output", reason: "not-json" },
    ]);
  }

  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    throw new RiskError("The consumer wrote no report object", [
      { kind: "consumer-output", reason: "not-object" },
    ]);
  }

  return report;
}

// The report must come from the exact consumer the policy names and list
// every function it analyzed.
function reportFailures(report, policy) {
  const expected = {
    kind: policy.consumer.report.kind,
    schema_version: policy.consumer.report.schemaVersion,
    version: policy.consumer.version,
  };
  const failures = Object.entries(expected)
    .filter(([field, value]) => report[field] !== value)
    .map(([field, value]) => ({
      kind: "consumer-identity",
      field,
      expected: value,
      actual: report[field] ?? null,
    }));
  const summary = report.summary ?? {};
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const complete =
    summary.functions_analyzed === findings.length &&
    summary.functions_above_threshold === findings.length &&
    summary.max_crap_threshold === 1 &&
    summary.coverage_model === "istanbul";

  if (!complete) {
    failures.push({
      kind: "consumer-enumeration",
      analyzed: summary.functions_analyzed ?? null,
      aboveThreshold: summary.functions_above_threshold ?? null,
      reported: findings.length,
      maxCrapThreshold: summary.max_crap_threshold ?? null,
      coverageModel: summary.coverage_model ?? null,
    });
  }

  return failures;
}

// The UTF-16 column at byte offset `byteColumn` of `lineText`, or
// `undefined` when that offset splits a character.
function utf16ColumnOf(lineText, byteColumn) {
  let bytes = 0;
  let units = 0;

  for (const character of lineText) {
    if (bytes >= byteColumn) {
      break;
    }

    bytes += Buffer.byteLength(character);
    units += character.length;
  }

  return bytes === byteColumn ? units : undefined;
}

// Each production row joined to exactly one anchor, and each anchor to
// exactly one row.
function joinRows(rows, population) {
  const failures = [];

  for (const row of rows) {
    const lineText = population.linesByPath.get(row.path)?.[row.line - 1] ?? "";
    const column = utf16ColumnOf(lineText, row.col);

    if (column === undefined) {
      failures.push({ kind: "anchor-unit", path: row.path, line: row.line, col: row.col });
      continue;
    }

    const anchor = population.anchors.get(`${row.path}:${row.line}:${column}`);
    const identity = { path: row.path, line: row.line, column };

    if (anchor === undefined) {
      failures.push({ kind: "row-unjoined", ...identity, col: row.col, name: row.name });
    } else if (anchor.row !== undefined) {
      failures.push({ kind: "row-duplicate", ...identity, names: [anchor.row.name, row.name] });
    } else {
      anchor.row = row;
    }
  }

  for (const anchor of population.anchors.values()) {
    if (anchor.row === undefined) {
      const { path: projectPath, line, column, name } = anchor;
      failures.push({ kind: "function-unreported", path: projectPath, line, column, name });
    }
  }

  return failures;
}

function compareRows(a, b) {
  return a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column;
}

// One joined function scored: the consumer must have measured it from the
// map and agree with the independent proportion; the score is this
// command's own arithmetic.
function scoreFunction(anchor, maxCrap, failures) {
  const { row, statements } = anchor;
  const identity = {
    path: anchor.path,
    line: anchor.line,
    column: anchor.column,
    name: anchor.name,
  };
  const measuredPercent = statements.coverage * 100;
  const reportedPercent = typeof row.coverage_pct === "number" ? row.coverage_pct : undefined;
  const crap = row.cyclomatic * row.cyclomatic * (1 - statements.coverage) ** 3 + row.cyclomatic;

  if (!Number.isInteger(row.cyclomatic) || row.cyclomatic < 1) {
    failures.push({ kind: "complexity", ...identity, cyclomatic: row.cyclomatic ?? null });
  } else if (row.coverage_source !== "istanbul") {
    failures.push({ kind: "coverage-source", ...identity, source: row.coverage_source ?? null });
  } else if (
    reportedPercent === undefined ||
    Math.abs(reportedPercent - measuredPercent) > PERCENT_TOLERANCE
  ) {
    const reported = reportedPercent ?? null;
    failures.push({ kind: "coverage-mismatch", ...identity, reported, measured: measuredPercent });
  } else if (typeof row.crap !== "number" || Math.abs(row.crap - crap) > SCORE_TOLERANCE) {
    failures.push({
      kind: "crap-mismatch",
      ...identity,
      reported: row.crap ?? null,
      measured: crap,
    });
  }

  const scored = {
    ...identity,
    cyclomatic: row.cyclomatic,
    statements: { total: statements.total, covered: statements.covered },
    coverage: statements.coverage,
    crap,
  };

  if (crap >= maxCrap) {
    failures.push({ kind: "crap", ...scored, threshold: maxCrap });
  }

  return {
    ...scored,
    reported: { coverage: row.coverage_pct ?? null, crap: row.crap, source: row.coverage_source },
  };
}

// Every production function scored in path, line and column order, with
// the gate's rows and the count of rows the policy does not reach.
function measure(report, population, policy) {
  const production = new Set(population.production);
  const [productionRows, otherRows] = [[], []];

  for (const row of report.findings) {
    (production.has(row.path) ? productionRows : otherRows).push(row);
  }

  const failures = joinRows(productionRows, population);

  if (failures.length > 0) {
    throw new RiskError("The consumer's rows do not join the production population", failures);
  }

  const functions = [...population.anchors.values()]
    .sort(compareRows)
    .map((anchor) => scoreFunction(anchor, policy.maxCrap, failures));

  return {
    functions,
    failures,
    other: {
      rows: otherRows.length,
      estimated: otherRows.filter((row) => row.coverage_source !== "istanbul").length,
    },
  };
}

function riskReport(manifest, policy, population, measured) {
  const atOrAbove = measured.failures.filter((row) => row.kind === "crap").length;

  return {
    kind: REPORT_KIND,
    schemaVersion: REPORT_SCHEMA_VERSION,
    status: measured.failures.length === 0 ? "passed" : "failed",
    runId: manifest.runId,
    policy: { maxCrap: policy.maxCrap },
    consumer: policy.consumer,
    production: {
      files: population.production.length,
      functions: measured.functions.length,
      atOrAbove,
    },
    other: measured.other,
    functions: measured.functions,
    failures: measured.failures,
  };
}

// The whole gate: policy, accepted bundle, validation, anchors, consumer
// report, join and scores.
function riskVerdict(options) {
  const policy = readPolicy();
  const manifest = acceptedManifest(options.root);
  validateBundle(options.root);
  const run = openCaptureRun(
    path.join(options.root, RUNS_DIRECTORY, manifest.runId, "manifest.json"),
  );
  // The readback verifies the digest of the map at the public path constant;
  // the pointer the manifest records is not what selects the file.
  const mapPath = path.join(options.root, PUBLIC_ISTANBUL_PATH);
  const population = populationAnchors(options.root, run, readJson(mapPath));
  const report = consumerReport(options.root, mapPath, options.consumer);
  const identity = reportFailures(report, policy);

  if (identity.length > 0) {
    throw new RiskError("The consumer report is not the one the policy names", identity);
  }

  return riskReport(manifest, policy, population, measure(report, population, policy));
}

function summarize(report) {
  const top = report.functions.reduce(
    (best, fn) => (best !== undefined && best.crap >= fn.crap ? best : fn),
    undefined,
  );
  const peak =
    top === undefined
      ? "no production function"
      : `max CRAP ${top.crap.toFixed(2)} at ${top.path}:${top.line}:${top.column} (${top.name})`;
  process.stdout.write(
    `Coverage risk verified: ${report.runId}, ${report.production.functions} production function(s) in ${report.production.files} file(s) measured, ${peak}, policy < ${report.policy.maxCrap}; ${report.other.rows} other row(s) not gated\n`,
  );
}

function refuse(error) {
  if (!Array.isArray(error.failures)) {
    throw error;
  }

  const rows = error.failures.map((failure) => `  ${JSON.stringify(failure)}`).join("\n");
  process.stderr.write(`${error.message}:\n${rows}\n`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.report !== undefined) {
    rmSync(options.report, { force: true });
  }

  try {
    const report = riskVerdict(options);

    if (options.report !== undefined) {
      writeJsonAtomically(options.report, report);
    }

    if (report.failures.length > 0) {
      throw new RiskError("The coverage risk gate is refused", report.failures);
    }

    summarize(report);
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
