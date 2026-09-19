import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Offender and benign controls for the production CRAP gate, driven through
 * the shipping wrapper (`check-coverage-risk.mjs`) and its shipped policy
 * file against tiny fixture roots that each hold an accepted unit coverage
 * bundle (D-06, D-08, D-09).
 *
 * Every offender mutates one property of an accepted root or of the
 * consumer's answer, requires the wrapper to refuse with the exact
 * `{ kind, ... }` rows that property owns, restores the property and
 * requires the wrapper to pass again. The threshold controls pair the exact
 * offender (an uncovered complexity-5 function at 30) with the benign case
 * (a partially covered complexity-8 function at 29.952). The denominator
 * controls put a test-file function of complexity 21 beside the production
 * population: the wrapper never gates it, the whole-tree health gate still
 * rejects it, and a production offender beside it is still the only row.
 * Nothing here is a permissive configuration: the roots follow the
 * repository layout, the policy is the shipped file and the consumer runs
 * with the wrapper's own flags.
 *
 * Consumer offenders are stand-ins that run the installed consumer and edit
 * one row of its report, as a consumer joining by name or estimating a
 * missing function would. `--wrapper` and `--pipeline` name the executables
 * under control so the controls can be run against deliberately defective
 * tools and shown to reject them.
 */

const scriptsUrl = new URL("./", import.meta.url);
const defaultWrapperPath = fileURLToPath(new URL("check-coverage-risk.mjs", scriptsUrl));
const defaultPipelinePath = fileURLToPath(new URL("coverage-unit.mjs", scriptsUrl));
const consumerPath = fileURLToPath(new URL("../node_modules/fallow/bin/fallow", scriptsUrl));
const repositoryConfigPath = fileURLToPath(new URL("../.fallowrc.json", scriptsUrl));

const PUBLIC_MANIFEST = "coverage/unit.manifest.json";
const PUBLIC_ISTANBUL = "coverage/unit.istanbul.json";
const CLASSIFY_PATH = "extensions/pi-claude-marketplace/domain/classify.ts";
const GRADE_PATH = "extensions/pi-claude-marketplace/domain/grade.ts";
const BELOW_PATH = "extensions/pi-claude-marketplace/domain/below.ts";
const TWINS_PATH = "extensions/pi-claude-marketplace/domain/twins.ts";
const COMPLEX_TEST_PATH = "tests/domain/complex.test.ts";
const THRESHOLD = 30;
const OUTPUT_BUDGET = 64 * 1024 * 1024;

// Five `if`s: cyclomatic 6 and eleven statements. Uncovered it scores 42.
const classifySource = `export function classify(n: number): string {
  if (n === 1) {
    return "one";
  }
  if (n === 2) {
    return "two";
  }
  if (n === 3) {
    return "three";
  }
  if (n === 4) {
    return "four";
  }
  if (n === 5) {
    return "five";
  }
  return "many";
}
`;

// Four `if`s: cyclomatic 5 and nine statements, never called: exactly 30.
const gradeSource = `export function grade(n: number): string {
  if (n === 1) {
    return "one";
  }
  if (n === 2) {
    return "two";
  }
  if (n === 3) {
    return "three";
  }
  if (n === 4) {
    return "four";
  }
  return "many";
}
`;

// One `if` over six `&&`: cyclomatic 8, ten statements, three executed
// when the block is skipped: 64 * 0.7 ** 3 + 8 = 29.952.
const belowSource = `export function below(flag: boolean, items: number[]): number {
  let total = 0;
  if (flag && items.length > 0 && items[0] > 1 && items[1] > 2 && items[2] > 3 && items[3] > 4 && items[4] > 5) {
    total += 1;
    total += 2;
    total += 3;
    total += 4;
    total += 5;
    total += 6;
    total += 7;
  }
  return total;
}
`;

// Two methods named `count` with opposite coverage and a callback nested in
// `outer` whose body is partly executed.
const twinsSource = `export class Left {
  count(items: string[]): number {
    return items.length;
  }
}

export class Right {
  count(items: string[]): number {
    return items.length * 2;
  }
}

export function outer(values: number[]): number[] {
  return values.map((value) => {
    if (value > 10) {
      return value;
    }
    return value * 2;
  });
}
`;

// A test-file function of cyclomatic 21 and cognitive 20: twenty `if`s the
// whole-tree health gate (cyclomatic 20, cognitive 15) rejects and the
// production policy never reads.
const complexTest = `import assert from "node:assert/strict";
import test from "node:test";

export function ladder(n: number): number {
${Array.from({ length: 20 }, (_, index) => `  if (n === ${index}) return ${index};`).join("\n")}
  return -1;
}

test("climbs the ladder", () => {
  assert.equal(ladder(3), 3);
});
`;

function importingTest(modulePath, names, body) {
  return `import assert from "node:assert/strict";
import test from "node:test";

import { ${names.join(", ")} } from "../../${modulePath}";

test("exercises the module", () => {
${body}
});
`;
}

const packageJson = `${JSON.stringify({ name: "fixture", type: "module" }, undefined, 2)}\n`;

function classifyFiles(exercised) {
  const body = exercised
    ? `  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => classify(n)), ["one", "two", "three", "four", "five", "many"]);`
    : `  assert.equal(typeof classify, "function");`;

  return {
    "package.json": packageJson,
    [CLASSIFY_PATH]: classifySource,
    "tests/domain/classify.test.ts": importingTest(CLASSIFY_PATH, ["classify"], body),
  };
}

const gradeFiles = {
  "package.json": packageJson,
  [GRADE_PATH]: gradeSource,
  "tests/domain/grade.test.ts": importingTest(
    GRADE_PATH,
    ["grade"],
    `  assert.equal(typeof grade, "function");`,
  ),
};

const belowFiles = {
  "package.json": packageJson,
  [BELOW_PATH]: belowSource,
  "tests/domain/below.test.ts": importingTest(
    BELOW_PATH,
    ["below"],
    `  assert.equal(below(false, []), 0);`,
  ),
};

const twinsFiles = {
  "package.json": packageJson,
  [TWINS_PATH]: twinsSource,
  "tests/domain/twins.test.ts": importingTest(
    TWINS_PATH,
    ["Left", "outer"],
    `  assert.equal(new Left().count(["a"]), 1);
  assert.deepEqual(outer([1]), [2]);`,
  ),
};

// The rows the wrapper owns for the classify function, from the source
// text: anchor 1:7, eleven statements, none or all executed.
function classifyRow(covered) {
  return {
    path: CLASSIFY_PATH,
    line: 1,
    column: 7,
    name: "classify",
    cyclomatic: 6,
    statements: { total: 11, covered },
    coverage: covered / 11,
    crap: 36 * (1 - covered / 11) ** 3 + 6,
  };
}

const gradeRow = {
  path: GRADE_PATH,
  line: 1,
  column: 7,
  name: "grade",
  cyclomatic: 5,
  statements: { total: 9, covered: 0 },
  coverage: 0,
  crap: 30,
};

// The twins' anchors: the parameter list of each `count`, `outer`'s
// `function` keyword and the callback's `(value)`.
const TWINS = {
  left: { path: TWINS_PATH, line: 2, col: 7 },
  right: { path: TWINS_PATH, line: 8, col: 7 },
  outer: { path: TWINS_PATH, line: 13, col: 7 },
  nested: { path: TWINS_PATH, line: 14, col: 20 },
};

class ControlFailure extends Error {
  constructor(label, detail) {
    super(`${label}: ${detail}`);
    this.name = "ControlFailure";
  }
}

function parseOptions(args) {
  const options = { wrapper: defaultWrapperPath, pipeline: defaultPipelinePath };
  let index = 0;

  while (index < args.length) {
    const name = args[index];
    const value = args[index + 1];

    if ((name !== "--wrapper" && name !== "--pipeline") || value === undefined) {
      throw new Error(`Unknown or incomplete option: ${name}`);
    }

    options[name.slice(2)] = path.resolve(value);
    index += 2;
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, undefined, 2)}\n`);
}

function writeFiles(root, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, text);
  }
}

// Runs a tool under this Node with the outer runner's worker markers shed
// and no inherited coverage destination.
function runTool(executable, args, environment = {}) {
  const { NODE_TEST_CONTEXT: _context, NODE_TEST_WORKER_ID: _worker, ...env } = process.env;
  const completed = spawnSync(process.execPath, [executable, ...args], {
    encoding: "utf8",
    env: { ...env, NODE_V8_COVERAGE: "", ...environment },
    maxBuffer: OUTPUT_BUDGET,
  });

  return {
    error: completed.error,
    signal: completed.signal,
    status: completed.status,
    stdout: completed.stdout ?? "",
    stderr: completed.stderr ?? "",
  };
}

function firstLine(text) {
  return text.split("\n", 1)[0].slice(0, 200);
}

// A tool that never reached a verdict is a harness failure, never a finding.
function requireVerdict(label, tool, run) {
  if (run.error !== undefined) {
    throw new ControlFailure(label, `the ${tool} did not launch: ${run.error.message}`);
  }

  if (run.signal !== null && run.signal !== undefined) {
    throw new ControlFailure(label, `the ${tool} was ended by signal ${run.signal}`);
  }
}

// The `{ kind, ... }` rows a tool prints one per line after its message; a
// line shaped like a row that does not parse fails the control.
function rowsOf(label, tool, stderr) {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("  {"))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new ControlFailure(label, `the ${tool} wrote an unparsable row: ${firstLine(line)}`);
      }
    });
}

function sameRows(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// The pipeline must accept the root: exit 0 and an accepted public bundle.
function acceptedRoot(label, options, workspace, files) {
  const root = path.join(workspace, label);
  writeFiles(root, files);
  const run = runTool(options.pipeline, ["--root", root]);
  requireVerdict(label, "pipeline", run);
  const manifestPath = path.join(root, PUBLIC_MANIFEST);

  if (
    run.status !== 0 ||
    !existsSync(manifestPath) ||
    readJson(manifestPath).state !== "accepted"
  ) {
    throw new ControlFailure(
      label,
      `the pipeline did not publish an accepted bundle (exit ${run.status}): ${firstLine(run.stderr)}`,
    );
  }

  return { root, manifest: readJson(manifestPath) };
}

function wrapperArguments(root, consumer) {
  return ["--root", root, ...(consumer === undefined ? [] : ["--consumer", consumer])];
}

// The wrapper must pass: exit 0, no row, the verified line on stdout.
function requirePass(label, options, root, environment, consumer) {
  const run = runTool(options.wrapper, wrapperArguments(root, consumer), environment);
  requireVerdict(label, "wrapper", run);
  const rows = rowsOf(label, "wrapper", run.stderr);

  if (run.status !== 0 || rows.length > 0) {
    throw new ControlFailure(
      label,
      `the wrapper refused the benign root (exit ${run.status}): ${firstLine(run.stderr)}`,
    );
  }

  if (!run.stdout.startsWith("Coverage risk verified: ")) {
    throw new ControlFailure(
      label,
      `the wrapper passed without its verdict: ${firstLine(run.stdout)}`,
    );
  }

  return run.stdout;
}

// The wrapper must refuse with exactly `expected`: exit 1 and those rows in
// that order.
function requireRefusal(label, options, root, expected, environment, consumer) {
  const run = runTool(options.wrapper, wrapperArguments(root, consumer), environment);
  requireVerdict(label, "wrapper", run);
  const rows = rowsOf(label, "wrapper", run.stderr);

  if (run.status !== 1) {
    throw new ControlFailure(label, `the wrapper exited ${run.status} rather than refusing`);
  }

  if (!sameRows(rows, expected)) {
    throw new ControlFailure(
      label,
      `the wrapper reported ${JSON.stringify(rows)} rather than ${JSON.stringify(expected)}`,
    );
  }
}

// Mutates one property of an accepted root, requires the exact refusal,
// restores the root from a snapshot and requires the pass.
function offender(control, options, root) {
  const { label, expected, mutate } = control;
  const snapshot = mkdtempSync(path.join(path.dirname(root), "snapshot-"));
  cpSync(root, snapshot, { recursive: true });

  try {
    mutate(root);
    requireRefusal(label, options, root, expected);
    rmSync(root, { recursive: true, force: true });
    cpSync(snapshot, root, { recursive: true });
    requirePass(label, options, root);
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }

  process.stdout.write(`${label}: ok\n`);
}

function editManifests(root, manifest, edit) {
  for (const manifestPath of [
    path.join(root, PUBLIC_MANIFEST),
    path.join(root, "coverage", "runs", manifest.runId, "accepted.json"),
  ]) {
    const document = readJson(manifestPath);
    edit(document);
    writeJson(manifestPath, document);
  }
}

// Republishes the accepted map with `edit` applied to one file record, both
// copies of the map and both manifests agreeing on the new digest: the
// state a consumer trusting digests alone would accept.
function republish(root, manifest, modulePath, edit) {
  const runMapPath = path.join(root, manifest.acceptance.artifacts.istanbul.path);
  const map = readJson(runMapPath);
  edit(map[path.join(root, modulePath)]);
  const text = `${JSON.stringify(map, undefined, 2)}\n`;
  writeFileSync(runMapPath, text);
  writeFileSync(path.join(root, PUBLIC_ISTANBUL), text);
  const digest = createHash("sha256").update(text).digest("hex");
  editManifests(root, manifest, (document) => {
    document.acceptance.artifacts.istanbul.digest = digest;
  });
}

function validation(failures) {
  return [{ kind: "validation", status: 1, failures }];
}

// The bundle's freshness and shape, refused before any consumer runs.
function bundleControls(root, manifest) {
  const zeros = "0".repeat(64);

  return [
    {
      label: "missing-manifest",
      expected: [{ kind: "missing-manifest", path: PUBLIC_MANIFEST }],
      mutate: () => rmSync(path.join(root, PUBLIC_MANIFEST)),
    },
    {
      label: "not-accepted",
      expected: [{ kind: "not-accepted", state: "captured" }],
      mutate: () => {
        const document = readJson(path.join(root, PUBLIC_MANIFEST));
        document.state = "captured";
        writeJson(path.join(root, PUBLIC_MANIFEST), document);
      },
    },
    {
      label: "source-changed",
      expected: validation([
        { kind: "stale-input", added: [], removed: [], changed: [CLASSIFY_PATH] },
      ]),
      mutate: () => appendFileSync(path.join(root, CLASSIFY_PATH), "// later\n"),
    },
    {
      label: "acceptance-tool-changed",
      expected: validation([{ kind: "tool-changed", stage: "acceptance" }]),
      mutate: () =>
        editManifests(root, manifest, (document) => {
          document.acceptance.tooling["coverage-validate.mjs"] = zeros;
        }),
    },
    {
      label: "schema-changed",
      expected: validation([
        {
          kind: "schema-key",
          part: "file",
          missing: ["branchMap"],
          unknown: [],
          path: CLASSIFY_PATH,
        },
      ]),
      mutate: () =>
        republish(root, manifest, CLASSIFY_PATH, (file) => {
          delete file.branchMap;
        }),
    },
    {
      label: "map-malformed",
      expected: validation([
        {
          kind: "position",
          part: "statementMap[0]",
          location: { start: { line: 2, column: -1 }, end: { line: 4, column: 3 } },
          path: CLASSIFY_PATH,
        },
      ]),
      mutate: () =>
        republish(root, manifest, CLASSIFY_PATH, (file) => {
          file.statementMap[0].start.column = -1;
        }),
    },
  ];
}

// The nested callback's record removed from the accepted map with every
// digest agreeing: the validator names the exact function, and the wrapper
// never reaches the consumer.
function deletedNestedControl(root, manifest) {
  const decl = { start: { line: 14, column: 20 }, end: { line: 14, column: 21 } };
  const loc = { start: { line: 14, column: 31 }, end: { line: 19, column: 3 } };

  return {
    label: "nested-function-deleted",
    expected: validation([{ kind: "function-missing", decl, loc, path: TWINS_PATH }]),
    mutate: () =>
      republish(root, manifest, TWINS_PATH, (file) => {
        const kept = Object.entries(file.fnMap).filter(
          ([, fn]) => JSON.stringify(fn.decl) !== JSON.stringify(decl),
        );
        file.fnMap = Object.fromEntries(kept);
        file.f = Object.fromEntries(kept.map(([id]) => [id, file.f[id]]));
      }),
  };
}

// A consumer that runs the installed one and applies `edit` to its report;
// the summary counts follow a dropped or doubled row as a consumer that
// lost or repeated the function would report them.
function writeConsumer(workspace, label, edit) {
  const standInPath = path.join(workspace, `${label}.consumer.mjs`);
  writeFileSync(
    standInPath,
    `import { spawnSync } from "node:child_process";

const edit = ${JSON.stringify(edit)};
const real = spawnSync(process.execPath, [${JSON.stringify(consumerPath)}, ...process.argv.slice(2)], {
  encoding: "utf8",
  maxBuffer: ${OUTPUT_BUDGET},
});
const report = JSON.parse(real.stdout);
const matches = (row, anchor) => row.path === anchor.path && row.line === anchor.line && row.col === anchor.col;
const rowAt = (anchor) => report.findings.find((row) => matches(row, anchor));
const recount = (delta) => {
  report.summary.functions_analyzed += delta;
  report.summary.functions_above_threshold += delta;
  report.summary.istanbul_matched += delta;
};

if (edit.kind === "swap") {
  const [first, second] = [rowAt(edit.at), rowAt(edit.with)];
  [first.coverage_pct, second.coverage_pct] = [second.coverage_pct, first.coverage_pct];
  [first.crap, second.crap] = [second.crap, first.crap];
} else if (edit.kind === "estimate") {
  const row = rowAt(edit.at);
  delete row.coverage_pct;
  row.coverage_source = "estimated";
} else if (edit.kind === "drop") {
  report.findings = report.findings.filter((row) => !matches(row, edit.at));
  recount(-1);
} else if (edit.kind === "duplicate") {
  report.findings.push({ ...rowAt(edit.at) });
  recount(1);
} else if (edit.kind === "shift") {
  rowAt(edit.at).col += edit.by;
} else if (edit.kind === "version") {
  report.version = edit.version;
}

process.stdout.write(JSON.stringify(report));
process.exitCode = real.status;
`,
  );
  return standInPath;
}

function twinsIdentity(anchor, name) {
  return { path: anchor.path, line: anchor.line, column: anchor.col, name };
}

// The consumer's rows against the twins root: each edit is what a consumer
// joining by name, by proximity or by estimate would answer.
function consumerControls(workspace) {
  return [
    {
      label: "counter-swap",
      edit: { kind: "swap", at: TWINS.left, with: TWINS.right },
      expected: [
        {
          kind: "coverage-mismatch",
          ...twinsIdentity(TWINS.left, "count"),
          reported: 0,
          measured: 100,
        },
        {
          kind: "coverage-mismatch",
          ...twinsIdentity(TWINS.right, "count"),
          reported: 100,
          measured: 0,
        },
      ],
    },
    {
      label: "estimated-row",
      edit: { kind: "estimate", at: TWINS.nested },
      expected: [
        {
          kind: "coverage-source",
          ...twinsIdentity(TWINS.nested, "(anonymous)"),
          source: "estimated",
        },
      ],
    },
    {
      label: "row-omitted",
      edit: { kind: "drop", at: TWINS.nested },
      expected: [{ kind: "function-unreported", ...twinsIdentity(TWINS.nested, "(anonymous)") }],
    },
    {
      label: "row-duplicated",
      edit: { kind: "duplicate", at: TWINS.outer },
      expected: [
        {
          kind: "row-duplicate",
          path: TWINS_PATH,
          line: TWINS.outer.line,
          column: TWINS.outer.col,
          names: ["outer", "outer"],
        },
      ],
    },
    {
      label: "wrong-join",
      edit: { kind: "shift", at: TWINS.outer, by: 1 },
      expected: [
        { kind: "row-unjoined", path: TWINS_PATH, line: 13, column: 8, col: 8, name: "outer" },
        { kind: "function-unreported", ...twinsIdentity(TWINS.outer, "outer") },
      ],
    },
    {
      label: "consumer-version",
      edit: { kind: "version", version: "0.0.0" },
      expected: [
        { kind: "consumer-identity", field: "version", expected: "3.23.0", actual: "0.0.0" },
      ],
    },
  ].map((control) => ({
    ...control,
    consumer: writeConsumer(workspace, control.label, control.edit),
  }));
}

// The consumer stand-in refuses; the installed consumer passes the same root.
function consumerOffender(control, options, root) {
  requireRefusal(control.label, options, root, control.expected, undefined, control.consumer);
  requirePass(control.label, options, root);
  process.stdout.write(`${control.label}: ok\n`);
}

// The whole-tree health gate with the repository's own thresholds over a
// fixture root, as `npm run fallow` runs it: exit 1 on any finding.
function healthGate(root) {
  const { health } = readJson(repositoryConfigPath);
  writeJson(path.join(root, ".fallowrc.json"), { health });
  const completed = spawnSync(
    process.execPath,
    [consumerPath, "health", "--root", root, "--format", "json", "--no-cache", "--quiet"],
    { cwd: root, encoding: "utf8", maxBuffer: OUTPUT_BUDGET },
  );
  rmSync(path.join(root, ".fallowrc.json"));
  const report = JSON.parse(completed.stdout);

  return {
    status: completed.status,
    findings: report.findings.map((row) => [row.path, row.name, row.exceeded, row.cyclomatic]),
  };
}

// A complexity-21 test function beside the production population: the
// wrapper counts it among the rows it does not gate, and the existing
// whole-tree health gate rejects it on its own.
function denominatorControl(options, root) {
  const label = "all-tree-denominator";
  const stdout = requirePass(label, options, root);
  const trailer = "; 4 other row(s) not gated\n";

  if (!stdout.endsWith(trailer)) {
    throw new ControlFailure(label, `the wrapper counted other rows as ${firstLine(stdout)}`);
  }

  const gate = healthGate(root);
  const expected = { status: 1, findings: [[COMPLEX_TEST_PATH, "ladder", "both", 21]] };

  if (!sameRows(gate, expected)) {
    throw new ControlFailure(label, `the health gate answered ${JSON.stringify(gate)}`);
  }

  process.stdout.write(`${label}: ok\n`);
}

// An inherited coverage override must not select another root's report.
function environmentControls(options, benign, offending) {
  const foreignMap = (root) => ({ FALLOW_COVERAGE: path.join(root, PUBLIC_ISTANBUL) });
  requirePass("environment-override", options, benign, foreignMap(offending));
  requireRefusal(
    "environment-override",
    options,
    offending,
    [{ kind: "crap", ...classifyRow(0), threshold: THRESHOLD }],
    foreignMap(benign),
  );
  process.stdout.write("environment-override: ok\n");
}

function executeControls(options, workspace) {
  const benign = acceptedRoot("benign", options, workspace, classifyFiles(true));
  requirePass("benign", options, benign.root);
  process.stdout.write("benign: ok\n");
  const offending = acceptedRoot("offender", options, workspace, classifyFiles(false));
  requireRefusal("offender", options, offending.root, [
    { kind: "crap", ...classifyRow(0), threshold: THRESHOLD },
  ]);
  process.stdout.write("offender: ok\n");
  const exactly = acceptedRoot("exactly-thirty", options, workspace, gradeFiles);
  requireRefusal("exactly-thirty", options, exactly.root, [
    { kind: "crap", ...gradeRow, threshold: THRESHOLD },
  ]);
  process.stdout.write("exactly-thirty: ok\n");
  const below = acceptedRoot("below-thirty", options, workspace, belowFiles);
  requirePass("below-thirty", options, below.root);
  process.stdout.write("below-thirty: ok\n");
  const bundle = bundleControls(benign.root, benign.manifest);

  for (const control of bundle) {
    offender(control, options, benign.root);
  }

  const twins = acceptedRoot("twins", options, workspace, twinsFiles);
  offender(deletedNestedControl(twins.root, twins.manifest), options, twins.root);
  const consumers = consumerControls(workspace);

  for (const control of consumers) {
    consumerOffender(control, options, twins.root);
  }

  const denominator = acceptedRoot("denominator", options, workspace, {
    ...classifyFiles(true),
    [COMPLEX_TEST_PATH]: complexTest,
  });
  denominatorControl(options, denominator.root);
  const mixed = acceptedRoot("mixed-violation", options, workspace, {
    ...classifyFiles(false),
    [COMPLEX_TEST_PATH]: complexTest,
  });
  requireRefusal("mixed-violation", options, mixed.root, [
    { kind: "crap", ...classifyRow(0), threshold: THRESHOLD },
  ]);
  process.stdout.write("mixed-violation: ok\n");
  environmentControls(options, benign.root, offending.root);
  return 4 + bundle.length + 1 + consumers.length + 3;
}

// Runs every control under one temporary workspace and removes it whether
// the controls passed or failed.
function runControls(options) {
  const workspace = mkdtempSync(path.join(tmpdir(), "coverage-risk-negative-"));
  let count;

  try {
    count = executeControls(options, workspace);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }

  process.stdout.write(`Coverage risk negative controls passed (${count} of ${count}).\n`);
}

try {
  runControls(parseOptions(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
