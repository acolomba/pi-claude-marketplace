import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Offender and benign controls for the verified unit coverage bundle, driven
 * through the shipping pipeline (`coverage-unit.mjs`) and the shipping
 * consumer readback (`coverage-validate.mjs`) against tiny fixture roots
 * (D-02, D-09).
 *
 * Every offender mutates one property of an accepted bundle, requires the
 * readback to refuse with the exact `{ kind, ... }` rows that property owns,
 * restores the property and requires the readback to pass again. A failed
 * test run and an interrupted worker drive the pipeline itself and must leave
 * no public artifact while keeping the run directory as evidence. Nothing here
 * is a permissive fixture configuration: the roots follow the repository
 * layout and the tools run with their defaults.
 *
 * `--pipeline` and `--validator` name the executables under control. They
 * exist so the controls can be run against deliberately defective tools and
 * shown to reject them: a runner that cannot fail proves nothing about the
 * runner that can.
 */

const scriptsUrl = new URL("./", import.meta.url);
const defaultPipelinePath = fileURLToPath(new URL("coverage-unit.mjs", scriptsUrl));
const defaultValidatorPath = fileURLToPath(new URL("coverage-validate.mjs", scriptsUrl));

const PUBLIC = {
  manifest: "coverage/unit.manifest.json",
  lcov: "coverage/unit.lcov",
  istanbul: "coverage/unit.istanbul.json",
  validation: "coverage/unit.validation.json",
};

const PAIR_PATH = "extensions/pi-claude-marketplace/domain/pair.ts";
const UNIMPORTED_PATH = "extensions/pi-claude-marketplace/domain/unimported.ts";
const TYPES_PATH = "extensions/pi-claude-marketplace/domain/types.ts";
const EXTRA_PATH = "extensions/pi-claude-marketplace/domain/extra.ts";
const PAIR_TEST_PATH = "tests/domain/pair-first.test.ts";

// A stderr can hold the runner's warnings for every worker of the fixture.
const OUTPUT_BUDGET = 64 * 1024 * 1024;

const pairSource = `export function first(items: string[]): number {
  return items.length;
}

export function second(items: string[]): number {
  return items.length * 2;
}
`;

const unimportedSource = `export function unimported(flag: boolean): number {
  if (flag) {
    return 1;
  }

  return 0;
}
`;

function pairTest(name, call) {
  return `import assert from "node:assert/strict";
import test from "node:test";

import { ${name} } from "../../extensions/pi-claude-marketplace/domain/pair.ts";

test("calls ${name}", () => {
  ${call}
});
`;
}

// The fixture: one module loaded by two workers, one executable module no test
// loads, one type-only module, and an integration test outside the unit
// selection whose native report stands in for a substituted LCOV.
const fixtureFiles = {
  "package.json": `${JSON.stringify({ name: "fixture", type: "module" }, undefined, 2)}\n`,
  "package-lock.json": `${JSON.stringify({ name: "fixture", lockfileVersion: 3 }, undefined, 2)}\n`,
  [PAIR_PATH]: pairSource,
  [UNIMPORTED_PATH]: unimportedSource,
  [TYPES_PATH]: "export interface Thing {\n  readonly name: string;\n}\n",
  [PAIR_TEST_PATH]: pairTest("first", 'assert.equal(first(["x"]), 1);'),
  "tests/domain/pair-second.test.ts": pairTest("second", 'assert.equal(second(["x"]), 2);'),
  "tests/integration/pair.integration.test.ts": pairTest(
    "second",
    'assert.equal(second(["x", "y"]), 4);',
  ),
};

const failingTest = `import assert from "node:assert/strict";
import test from "node:test";

test("fails on purpose", () => {
  assert.equal(1, 2);
});
`;

// A process that signals itself still flushes its own coverage; only an
// external SIGKILL leaves the worker without an exit record, so the fixture
// has a child kill its parent.
const killedTest = `import { spawnSync } from "node:child_process";

spawnSync(process.execPath, ["-e", 'process.kill(process.ppid, "SIGKILL");']);
`;

class ControlFailure extends Error {
  constructor(label, detail) {
    super(`${label}: ${detail}`);
    this.name = "ControlFailure";
  }
}

function parseOptions(args) {
  const options = { pipeline: defaultPipelinePath, validator: defaultValidatorPath };
  let index = 0;

  while (index < args.length) {
    const name = args[index];
    const value = args[index + 1];

    if ((name !== "--pipeline" && name !== "--validator") || value === undefined) {
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

// The 1-based line and 0-based UTF-16 column of `offset`, counted from the
// source text itself.
function positionAt(source, offset) {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return { line: source.slice(0, lineStart).split("\n").length, column: offset - lineStart };
}

// The span from the first character of the unique snippet `from` to the last
// character of the unique snippet `to`, in the source text. Every expected
// coordinate is counted out of the fixture text here, not read back from the
// tools under control.
function spanOf(source, from, to = from) {
  const start = source.indexOf(from);
  const end = source.indexOf(to) + to.length;

  if (start === -1 || source.indexOf(from, start + 1) !== -1 || end <= start) {
    throw new Error(`the snippet must occur exactly once in the fixture: ${from}`);
  }

  return { start: positionAt(source, start), end: positionAt(source, end) };
}

// Runs a tool under this Node with the outer runner's worker markers shed and
// no inherited coverage destination, so a nested run never reports into a run
// that hosts these controls.
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

// The `{ kind, ... }` rows a tool prints one per line after its refusal
// message; a line shaped like a row that does not parse fails the control.
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

function publicState(root) {
  const manifestPath = path.join(root, PUBLIC.manifest);
  return existsSync(manifestPath) ? readJson(manifestPath).state : undefined;
}

function publishedFiles(root) {
  return Object.values(PUBLIC).filter((relativePath) => existsSync(path.join(root, relativePath)));
}

// The pipeline must accept the root: exit 0 and an accepted public bundle.
function requireAccepted(label, options, root) {
  const run = runTool(options.pipeline, ["--root", root]);
  requireVerdict(label, "pipeline", run);

  if (run.status !== 0) {
    throw new ControlFailure(label, `the pipeline exited ${run.status}: ${firstLine(run.stderr)}`);
  }

  if (publicState(root) !== "accepted") {
    throw new ControlFailure(label, "the pipeline exited 0 without publishing an accepted bundle");
  }

  return readJson(path.join(root, PUBLIC.manifest));
}

// The validator must pass: exit 0, no row, the verified line on stdout.
function requirePass(label, options, root, environment) {
  const run = runTool(options.validator, ["--root", root], environment);
  requireVerdict(label, "validator", run);
  const rows = rowsOf(label, "validator", run.stderr);

  if (run.status !== 0 || rows.length > 0) {
    throw new ControlFailure(
      label,
      `the validator refused the benign bundle (exit ${run.status}): ${firstLine(run.stderr)}`,
    );
  }

  if (!run.stdout.startsWith("Coverage bundle verified: ")) {
    throw new ControlFailure(
      label,
      `the validator passed without its verdict: ${firstLine(run.stdout)}`,
    );
  }
}

function sameRows(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// The validator must refuse with exactly `expected`: exit 1 and those rows,
// in that order. Any other status, a bare exit 1, a different kind or a
// different detail fails the control. `expected` may instead be a function
// judging the rows itself.
function requireRefusal(label, options, root, expected, environment) {
  const run = runTool(options.validator, ["--root", root], environment);
  requireVerdict(label, "validator", run);
  const rows = rowsOf(label, "validator", run.stderr);

  if (run.status !== 1) {
    throw new ControlFailure(label, `the validator exited ${run.status} rather than refusing`);
  }

  if (typeof expected === "function") {
    expected(label, rows);
  } else if (!sameRows(rows, expected)) {
    throw new ControlFailure(
      label,
      `the validator reported ${JSON.stringify(rows)} rather than ${JSON.stringify(expected)}`,
    );
  }
}

// Mutates one property of the accepted root, requires the exact refusal, then
// restores the root from a snapshot and requires the pass. Both halves are
// one control.
function offender(control, options, root, environment) {
  const { label, expected, mutate } = control;
  const snapshot = mkdtempSync(path.join(path.dirname(root), "snapshot-"));
  cpSync(root, snapshot, { recursive: true });

  try {
    mutate(root);
    requireRefusal(label, options, root, expected, environment);
    rmSync(root, { recursive: true, force: true });
    cpSync(snapshot, root, { recursive: true });
    requirePass(label, options, root, environment);
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }

  process.stdout.write(`${label}: ok\n`);
}

function staleInput(difference) {
  return [{ kind: "stale-input", added: [], removed: [], changed: [], ...difference }];
}

// Rewrites both copies of the accepted manifest through `edit`.
function editManifests(root, manifest, edit) {
  for (const manifestPath of [
    path.join(root, PUBLIC.manifest),
    path.join(root, "coverage", "runs", manifest.runId, "accepted.json"),
  ]) {
    const document = readJson(manifestPath);
    edit(document);
    writeJson(manifestPath, document);
  }
}

// Republishes the accepted map with `edit` applied to one file record, both
// copies of the map and both manifests agreeing on the new digest: the state
// a consumer trusting digests alone would accept.
function republish(root, manifest, modulePath, edit) {
  const runMapPath = path.join(root, manifest.acceptance.artifacts.istanbul.path);
  const map = readJson(runMapPath);
  edit(map[path.join(root, modulePath)]);
  const text = `${JSON.stringify(map, undefined, 2)}\n`;
  writeFileSync(runMapPath, text);
  writeFileSync(path.join(root, PUBLIC.istanbul), text);
  const digest = createHash("sha256").update(text).digest("hex");
  editManifests(root, manifest, (document) => {
    document.acceptance.artifacts.istanbul.digest = digest;
  });
}

// The native LCOV of the fixture's integration test, a report the unit
// bundle must not accept in place of its own. The runner writes its own raw
// coverage, so no destination may be inherited: an empty `NODE_V8_COVERAGE`
// makes the native run exit 1 after printing its report.
function integrationLcov(root, workspace) {
  const lcovPath = path.join(workspace, "integration.lcov");
  const {
    NODE_TEST_CONTEXT: _context,
    NODE_TEST_WORKER_ID: _worker,
    NODE_V8_COVERAGE: _destination,
    ...env
  } = process.env;
  const completed = spawnSync(
    process.execPath,
    [
      "--test",
      "--experimental-test-coverage",
      "--test-coverage-include=extensions/**",
      "--test-reporter=lcov",
      `--test-reporter-destination=${lcovPath}`,
      "tests/integration/**/*.test.ts",
    ],
    { cwd: root, encoding: "utf8", env },
  );

  if (completed.status !== 0 || !existsSync(lcovPath)) {
    throw new Error(
      `The integration reference run failed (exit ${completed.status}): ${firstLine(completed.stderr)}`,
    );
  }

  return readFileSync(lcovPath);
}

function runRoot(workspace, name, extraFiles = {}) {
  const root = path.join(workspace, name);
  writeFiles(root, { ...fixtureFiles, ...extraFiles });
  return root;
}

// Inputs the run bound: sources, tests, configuration, the lockfile, the
// capture and acceptance tooling and the producer identity.
function inputControls(root, manifest) {
  const zeros = "0".repeat(64);

  return [
    {
      label: "source-added",
      expected: staleInput({ added: [EXTRA_PATH] }),
      mutate: () => writeFiles(root, { [EXTRA_PATH]: "export const extra = 1;\n" }),
    },
    {
      label: "source-removed",
      expected: staleInput({ removed: [TYPES_PATH] }),
      mutate: () => rmSync(path.join(root, TYPES_PATH)),
    },
    {
      label: "source-changed",
      expected: staleInput({ changed: [PAIR_PATH] }),
      mutate: () => appendFileSync(path.join(root, PAIR_PATH), "// later\n"),
    },
    {
      label: "test-changed",
      expected: staleInput({ changed: [PAIR_TEST_PATH] }),
      mutate: () => appendFileSync(path.join(root, PAIR_TEST_PATH), "// later\n"),
    },
    {
      label: "config-changed",
      expected: staleInput({ changed: ["package.json"] }),
      mutate: () => appendFileSync(path.join(root, "package.json"), "\n"),
    },
    {
      label: "lock-changed",
      expected: staleInput({ changed: ["package-lock.json"] }),
      mutate: () => appendFileSync(path.join(root, "package-lock.json"), "\n"),
    },
    {
      label: "capture-tool-changed",
      expected: [{ kind: "tool-changed" }],
      mutate: () =>
        editManifests(root, manifest, (document) => {
          document.tooling["coverage-capture.mjs"] = zeros;
        }),
    },
    {
      label: "acceptance-tool-changed",
      expected: [{ kind: "tool-changed", stage: "acceptance" }],
      mutate: () =>
        editManifests(root, manifest, (document) => {
          document.acceptance.tooling["coverage-unit.mjs"] = zeros;
        }),
    },
    {
      label: "producer-changed",
      expected: [{ kind: "producer-changed", fields: ["producer"] }],
      mutate: () =>
        editManifests(root, manifest, (document) => {
          document.acceptance.producer.identity.producer.payloadDigest = zeros;
        }),
    },
  ];
}

// Artifacts of the bundle: each one missing and each one emptied or changed.
function artifactControls(root, manifest) {
  const rawPath = manifest.raw[0].path;
  const removed = (label, relativePath, kind) => ({
    label,
    expected: [{ kind, path: relativePath }],
    mutate: () => rmSync(path.join(root, relativePath)),
  });
  const rewritten = (label, relativePath, text) => ({
    label,
    expected: [{ kind: "artifact-digest", path: relativePath }],
    mutate: () => writeFileSync(path.join(root, relativePath), text, { flag: "a" }),
  });

  return [
    removed("raw-missing", rawPath, "missing-artifact"),
    rewritten("raw-changed", rawPath, "\n"),
    removed("lcov-missing", PUBLIC.lcov, "missing-artifact"),
    rewritten("lcov-changed", PUBLIC.lcov, "TN:\n"),
    removed("istanbul-missing", PUBLIC.istanbul, "missing-artifact"),
    rewritten("istanbul-changed", PUBLIC.istanbul, "\n"),
    removed("receipt-missing", PUBLIC.validation, "missing-artifact"),
    rewritten("receipt-changed", PUBLIC.validation, "\n"),
    removed("manifest-missing", PUBLIC.manifest, "missing-manifest"),
    {
      label: "manifest-empty",
      expected: [{ kind: "malformed-manifest", path: PUBLIC.manifest }],
      mutate: () => writeFileSync(path.join(root, PUBLIC.manifest), ""),
    },
    {
      label: "unloaded-record-dropped",
      expected: [{ kind: "unrepresented-source", path: UNIMPORTED_PATH }],
      mutate: () =>
        editManifests(root, manifest, (document) => {
          document.unloaded = document.unloaded.filter((record) => record.path !== UNIMPORTED_PATH);
        }),
    },
  ];
}

// The map's content, republished with every digest agreeing: only the
// re-validation of the map itself can refuse these.
function contentControls(root, manifest) {
  const firstReturn = spanOf(pairSource, "return items.length;");
  const ifStatement = spanOf(unimportedSource, "if (flag) {", "return 1;\n  }");
  const declaration = {
    decl: spanOf(unimportedSource, "unimported"),
    loc: spanOf(unimportedSource, "{\n  if (flag)", "return 0;\n}"),
  };

  return [
    {
      label: "malformed-coordinate",
      expected: [
        {
          kind: "position",
          part: "statementMap[0]",
          location: { start: { line: firstReturn.start.line, column: -1 }, end: firstReturn.end },
          path: PAIR_PATH,
        },
      ],
      mutate: () =>
        republish(root, manifest, PAIR_PATH, (file) => {
          file.statementMap[0].start.column = -1;
        }),
    },
    {
      label: "function-missing",
      expected: [{ kind: "function-missing", ...declaration, path: UNIMPORTED_PATH }],
      mutate: () =>
        republish(root, manifest, UNIMPORTED_PATH, (file) => {
          file.fnMap = {};
          file.f = {};
        }),
    },
    {
      label: "statement-missing",
      expected: [{ kind: "statement-missing", loc: ifStatement, path: UNIMPORTED_PATH }],
      mutate: () =>
        republish(root, manifest, UNIMPORTED_PATH, (file) => {
          delete file.statementMap[0];
          delete file.s[0];
        }),
    },
    {
      label: "unloaded-hits",
      expected: [{ kind: "unloaded-hits", part: "f[0]", hits: 1, path: UNIMPORTED_PATH }],
      mutate: () =>
        republish(root, manifest, UNIMPORTED_PATH, (file) => {
          file.f[0] = 1;
        }),
    },
  ];
}

// A refusal whose first row is `primary` and whose remaining rows are all
// `missing-artifact` under the foreign run: the copied pointer names a run
// this root never had.
function foreignRunRows(primary, runPrefix) {
  return (label, rows) => {
    const [first, ...rest] = rows;

    if (!sameRows(first, primary)) {
      throw new ControlFailure(
        label,
        `the validator reported ${JSON.stringify(first)} first rather than ${JSON.stringify(primary)}`,
      );
    }

    const stray = rest.find(
      (row) => row.kind !== "missing-artifact" || !String(row.path).startsWith(runPrefix),
    );

    if (stray !== undefined) {
      throw new ControlFailure(label, `the validator reported ${JSON.stringify(stray)}`);
    }
  };
}

// Reports from elsewhere: another run's map, another run's whole bundle, and
// the native report of a test outside the unit selection.
function substitutionControls(root, workspace, foreign) {
  const runPrefix = `coverage/runs/${foreign.manifest.runId}/`;

  return [
    {
      label: "foreign-run-report",
      expected: [{ kind: "artifact-digest", path: PUBLIC.istanbul }],
      mutate: () =>
        cpSync(path.join(foreign.root, PUBLIC.istanbul), path.join(root, PUBLIC.istanbul)),
    },
    {
      label: "foreign-run-bundle",
      expected: foreignRunRows(
        { kind: "manifest-mismatch", path: `${runPrefix}accepted.json` },
        runPrefix,
      ),
      mutate: () => {
        for (const relativePath of Object.values(PUBLIC)) {
          cpSync(path.join(foreign.root, relativePath), path.join(root, relativePath));
        }
      },
    },
    {
      label: "integration-substitution",
      expected: [{ kind: "artifact-digest", path: PUBLIC.lcov }],
      mutate: () => writeFileSync(path.join(root, PUBLIC.lcov), integrationLcov(root, workspace)),
    },
  ];
}

// An inherited coverage destination or run directory must not select another
// run's report: the readback reads only the root's own bundle, so with the
// pointer gone it refuses, and with the pointer intact it passes, override or
// not.
function environmentControl(root, foreign) {
  const foreignRun = path.join(foreign.root, "coverage", "runs", foreign.manifest.runId);

  return {
    control: {
      label: "environment-override",
      expected: [{ kind: "missing-manifest", path: PUBLIC.manifest }],
      mutate: () => rmSync(path.join(root, PUBLIC.manifest)),
    },
    environment: {
      NODE_V8_COVERAGE: path.join(foreignRun, "raw"),
      PI_CM_COVERAGE_RUN_DIR: foreignRun,
      PI_CM_COVERAGE_RUN_ID: foreign.manifest.runId,
      PI_CM_COVERAGE_ROOT: foreign.root,
    },
  };
}

// The pipeline must refuse the root, publish nothing and keep the failed run.
function pipelineRefusal(label, options, root, expectedKinds) {
  const run = runTool(options.pipeline, ["--root", root]);
  requireVerdict(label, "pipeline", run);
  const rows = rowsOf(label, "pipeline", run.stderr);

  if (run.status !== 1) {
    throw new ControlFailure(label, `the pipeline exited ${run.status} rather than refusing`);
  }

  const kinds = rows.map(
    (row) => `${row.kind}:${(row.failures ?? []).map((failure) => failure.kind).join(",")}`,
  );

  if (!sameRows(kinds, expectedKinds)) {
    throw new ControlFailure(label, `the pipeline reported ${JSON.stringify(rows)}`);
  }

  const published = publishedFiles(root);

  if (published.length > 0) {
    throw new ControlFailure(label, `the pipeline left a public artifact: ${published.join(", ")}`);
  }

  const runsDirectory = path.join(root, "coverage", "runs");
  const runs = existsSync(runsDirectory) ? readdirSync(runsDirectory) : [];
  const failed = runs.filter(
    (runId) => readJson(path.join(runsDirectory, runId, "manifest.json")).status === "failed",
  );

  if (runs.length !== 1 || failed.length !== 1) {
    throw new ControlFailure(
      label,
      `the pipeline kept ${failed.length} failed run(s) of ${runs.length}`,
    );
  }

  process.stdout.write(`${label}: ok\n`);
}

function executeControls(options, workspace) {
  const root = runRoot(workspace, "accepted");
  const manifest = requireAccepted("accepted", options, root);
  requirePass("accepted", options, root);
  process.stdout.write("accepted: ok\n");
  const foreign = { root: runRoot(workspace, "foreign"), manifest: undefined };
  foreign.manifest = requireAccepted("foreign", options, foreign.root);
  process.stdout.write("foreign: ok\n");
  const controls = [
    ...inputControls(root, manifest),
    ...artifactControls(root, manifest),
    ...contentControls(root, manifest),
    ...substitutionControls(root, workspace, foreign),
  ];

  for (const control of controls) {
    offender(control, options, root);
  }

  const override = environmentControl(root, foreign);
  offender(override.control, options, root, override.environment);
  pipelineRefusal(
    "tests-failed",
    options,
    runRoot(workspace, "failing", { "tests/domain/failing.test.ts": failingTest }),
    ["capture:tests-failed"],
  );
  pipelineRefusal(
    "worker-interrupted",
    options,
    runRoot(workspace, "killed", { "tests/domain/killed.test.ts": killedTest }),
    ["capture:tests-failed,interrupted-worker,missing-capture"],
  );
  return controls.length + 5;
}

// Runs every control under one temporary workspace and removes it whether
// the controls passed or failed: evidence of a refusal lives in the report,
// never in a directory left behind.
function runControls(options) {
  const workspace = mkdtempSync(path.join(tmpdir(), "coverage-unit-negative-"));
  let count;

  try {
    count = executeControls(options, workspace);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }

  process.stdout.write(`Verified unit coverage negative controls passed (${count} of ${count}).\n`);
}

try {
  runControls(parseOptions(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
