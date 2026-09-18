import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BELOW_PATH,
  belowFixture,
  classifyFixture,
  CLASSIFY_PATH,
  crapOf,
  expectedRows,
  gradeFixture,
  riskFixtureFiles,
  twinsFixture,
  TWINS_PATH,
  UNICODE_PATH,
  unicodeFixture,
} from "./check-coverage-risk-fixtures.ts";
import {
  captureCliPath,
  createRoot,
  fallowBinPath,
  readJson,
  refusalRows,
  run,
} from "./coverage-run-support.ts";

import type { ExpectedRow, RiskFixture } from "./check-coverage-risk-fixtures.ts";
import type { FailureRow, ProcessRun } from "./coverage-run-support.ts";
import type { TestContext } from "node:test";

// `coverage:risk` is a `.mjs` command-line tool, so these cases drive it the
// way `npm run coverage:risk` does: as a child process against an isolated
// fixture root that holds an accepted unit coverage bundle. The shipped
// policy file is the one under test; nothing here lowers, raises or
// bypasses it. Every expected complexity, statement count and score is
// written from the fixture text (D-06, D-08, D-09).

const scriptsUrl = new URL("../../scripts/", import.meta.url);
const riskCliPath = fileURLToPath(new URL("check-coverage-risk.mjs", scriptsUrl));
const unitCliPath = fileURLToPath(new URL("coverage-unit.mjs", scriptsUrl));
const policyPath = fileURLToPath(new URL("coverage-risk-policy.json", scriptsUrl));
const repositoryUrl = new URL("../../", import.meta.url);

const PUBLIC_MANIFEST = "coverage/unit.manifest.json";
const POLICY = 30;

interface RiskReport {
  readonly status: string;
  readonly runId: string;
  readonly policy: { readonly maxCrap: number };
  readonly production: {
    readonly files: number;
    readonly functions: number;
    readonly atOrAbove: number;
  };
  readonly other: { readonly rows: number; readonly estimated: number };
  readonly functions: ReadonlyArray<
    ExpectedRow & {
      readonly reported: {
        readonly coverage: number;
        readonly crap: number;
        readonly source: string;
      };
    }
  >;
  readonly failures: readonly FailureRow[];
}

interface Verdict {
  readonly status: number;
  readonly rows: FailureRow[];
}

// One row of the installed consumer's report as the cases read it back:
// the anchor in its own units (a byte column), its labels and its
// provenance.
interface ConsumerRow {
  readonly path: string;
  readonly line: number;
  readonly col: number;
  readonly name: string;
  readonly coverage_pct: number | undefined;
  readonly crap: number;
  readonly coverage_source: string;
}

interface ConsumerAnchor {
  readonly path: string;
  readonly line: number;
  readonly col: number;
}

// One edit a stand-in consumer applies to the installed consumer's report.
type ConsumerEdit =
  | { readonly kind: "swap"; readonly at: ConsumerAnchor; readonly with: ConsumerAnchor }
  | { readonly kind: "drop"; readonly at: ConsumerAnchor }
  | { readonly kind: "shift"; readonly at: ConsumerAnchor; readonly by: number }
  | { readonly kind: "version"; readonly version: string };

function risk(root: string, reportPath?: string, consumerPath?: string): ProcessRun {
  const args = [riskCliPath, "--root", root];

  if (reportPath !== undefined) {
    args.push("--report", reportPath);
  }

  if (consumerPath !== undefined) {
    args.push("--consumer", consumerPath);
  }

  return run(args);
}

function verdict(completed: ProcessRun): Verdict {
  return { status: completed.status, rows: refusalRows(completed.stderr) };
}

// A fixture root taken through the shipping pipeline to an accepted bundle.
async function acceptedRoot(t: TestContext, fixture: RiskFixture): Promise<string> {
  const root = await createRoot(t, riskFixtureFiles(fixture));
  const verified = run([unitCliPath, "--root", root]);
  assert.strictEqual(verified.status, 0, verified.stderr);
  return root;
}

async function reportAt(root: string): Promise<RiskReport> {
  return readJson<RiskReport>(path.join(root, "coverage", "unit.risk.json"));
}

// The gate's rows for one function without the consumer's own labels, which
// are data the cases assert apart.
function measured(report: RiskReport): ExpectedRow[] {
  return report.functions.map(({ reported: _reported, ...row }) => row);
}

test("refuses an uncovered complexity-6 function at CRAP 42 under the shipped policy of 30", async (t) => {
  // arrange
  const fixture = classifyFixture(false);
  const root = await acceptedRoot(t, fixture);
  const [expected] = expectedRows(fixture);

  // act
  const refused = risk(root, "coverage/unit.risk.json");

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [{ kind: "crap", ...expected, threshold: POLICY }],
  });
  assert.deepStrictEqual(
    { crap: expected?.crap, coverage: expected?.coverage },
    { crap: 42, coverage: 0 },
  );
  const report = await reportAt(root);
  assert.deepStrictEqual(
    {
      status: report.status,
      production: report.production,
      failures: report.failures,
      source: report.functions.map((row) => row.reported.source),
    },
    {
      status: "failed",
      production: { files: 1, functions: 1, atOrAbove: 1 },
      failures: [{ kind: "crap", ...expected, threshold: POLICY }],
      source: ["istanbul"],
    },
  );
});

test("passes the same function fully exercised at CRAP 6 with measured provenance", async (t) => {
  // arrange
  const fixture = classifyFixture(true);
  const root = await acceptedRoot(t, fixture);
  const manifest = await readJson<{ runId: string }>(path.join(root, PUBLIC_MANIFEST));

  // act
  const passed = risk(root, "coverage/unit.risk.json");

  // assert
  // The test module declares two functions of its own: the case callback
  // and the arrow that maps over the inputs. Neither is production.
  assert.deepStrictEqual(passed, {
    status: 0,
    stdout: `Coverage risk verified: ${manifest.runId}, 1 production function(s) in 1 file(s) measured, max CRAP 6.00 at ${CLASSIFY_PATH}:1:7 (classify), policy < ${POLICY}; 2 other row(s) not gated\n`,
    stderr: "",
  });
  const report = await reportAt(root);
  assert.deepStrictEqual(measured(report), expectedRows(fixture));
  assert.deepStrictEqual(
    {
      status: report.status,
      runId: report.runId,
      policy: report.policy,
      production: report.production,
      other: report.other,
      reported: report.functions.map((row) => row.reported),
      failures: report.failures,
    },
    {
      status: "passed",
      runId: manifest.runId,
      policy: { maxCrap: POLICY },
      production: { files: 1, functions: 1, atOrAbove: 0 },
      other: { rows: 2, estimated: 2 },
      reported: [{ coverage: 100, crap: 6, source: "istanbul" }],
      failures: [],
    },
  );
});

test("ships the policy at 30 beside unchanged whole-tree health thresholds", async () => {
  // arrange
  const fallowConfigUrl = new URL(".fallowrc.json", repositoryUrl);
  const packageUrl = new URL("package.json", repositoryUrl);

  // act
  const policy: unknown = JSON.parse(await readFile(policyPath, "utf8"));
  const fallowConfig = JSON.parse(await readFile(fallowConfigUrl, "utf8")) as {
    health: unknown;
  };
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8")) as {
    scripts: Record<string, string>;
  };

  // assert
  assert.deepStrictEqual(policy, {
    kind: "pi-claude-marketplace-coverage-risk-policy",
    schemaVersion: 1,
    maxCrap: 30,
    consumer: {
      name: "fallow",
      version: "3.23.0",
      report: { kind: "health", schemaVersion: 11 },
    },
  });
  assert.deepStrictEqual(fallowConfig.health, {
    maxCyclomatic: 20,
    maxCognitive: 15,
    maxUnitSize: 60,
    maxCrap: 0,
  });
  assert.strictEqual(packageJson.scripts["coverage:risk"], "node scripts/check-coverage-risk.mjs");
});

test("refuses a root that holds no bundle", async (t) => {
  // arrange
  const root = await createRoot(t, riskFixtureFiles(classifyFixture(true)));

  // act
  const refused = risk(root);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [{ kind: "missing-manifest", path: PUBLIC_MANIFEST }],
  });
});

test("refuses a captured bundle that was never accepted", async (t) => {
  // arrange
  const root = await createRoot(t, riskFixtureFiles(classifyFixture(true)));
  const captured = run([captureCliPath, "--root", root]);
  assert.strictEqual(captured.status, 0, captured.stderr);

  // act
  const refused = risk(root);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [{ kind: "not-accepted", state: "captured" }],
  });
});

test("refuses an accepted bundle whose source changed since the run", async (t) => {
  // arrange
  const root = await acceptedRoot(t, classifyFixture(true));
  await appendFile(path.join(root, CLASSIFY_PATH), "// later\n");

  // act
  const refused = risk(root);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [
      {
        kind: "validation",
        status: 1,
        failures: [{ kind: "stale-input", added: [], removed: [], changed: [CLASSIFY_PATH] }],
      },
    ],
  });
});

// A consumer that answers like the installed one except for one edit to its
// report, written beside its counter so every invocation applies the edit.
// Row counts in the summary follow the edit, as a consumer that dropped or
// doubled a function would report them.
async function writeConsumer(t: TestContext, edit: ConsumerEdit): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "coverage-risk-consumer-"));

  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  const consumerPath = path.join(directory, "consumer.mjs");
  await writeFile(
    consumerPath,
    `import { spawnSync } from "node:child_process";

const edit = ${JSON.stringify(edit)};
const real = spawnSync(process.execPath, [${JSON.stringify(fallowBinPath)}, ...process.argv.slice(2)], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const report = JSON.parse(real.stdout);
const at = (row) => (anchor) => row.path === anchor.path && row.line === anchor.line && row.col === anchor.col;
const rowAt = (anchor) => report.findings.find((row) => at(row)(anchor));

if (edit.kind === "swap") {
  const [first, second] = [rowAt(edit.at), rowAt(edit.with)];
  [first.coverage_pct, second.coverage_pct] = [second.coverage_pct, first.coverage_pct];
  [first.crap, second.crap] = [second.crap, first.crap];
} else if (edit.kind === "drop") {
  report.findings = report.findings.filter((row) => !at(row)(edit.at));
  report.summary.functions_analyzed -= 1;
  report.summary.functions_above_threshold -= 1;
  report.summary.istanbul_matched -= 1;
} else if (edit.kind === "shift") {
  rowAt(edit.at).col += edit.by;
} else if (edit.kind === "version") {
  report.version = edit.version;
}

process.stdout.write(JSON.stringify(report));
process.exitCode = real.status;
`,
  );
  return consumerPath;
}

// The installed consumer's own report over `root`, in the diagnostic form
// the gate uses, or under its own threshold of 30 when `maxCrap` says so.
function consumerRows(root: string, maxCrap: number): { status: number; rows: ConsumerRow[] } {
  const health = run([
    fallowBinPath,
    "health",
    "--root",
    root,
    "--coverage",
    path.join(root, "coverage/unit.istanbul.json"),
    "--format",
    "json",
    "--no-cache",
    "--quiet",
    ...(maxCrap === 1 ? ["--report-only"] : []),
    "--max-crap",
    String(maxCrap),
  ]);
  const report = JSON.parse(health.stdout) as { findings: ConsumerRow[] };
  return {
    status: health.status,
    rows: report.findings
      .filter((row) => row.path.startsWith("extensions/"))
      .map(({ path: rowPath, line, col, name, coverage_pct, crap, coverage_source }) => ({
        path: rowPath,
        line,
        col,
        name,
        coverage_pct,
        crap,
        coverage_source,
      })),
  };
}

test("joins repeated-name, same-line and nested functions to their exact anchors with independent coverage", async (t) => {
  // arrange
  const fixture = twinsFixture();
  const root = await acceptedRoot(t, fixture);

  // act
  const passed = risk(root, "coverage/unit.risk.json");

  // assert
  assert.strictEqual(passed.status, 0, passed.stderr);
  const report = await reportAt(root);
  assert.deepStrictEqual(measured(report), expectedRows(fixture));
  assert.deepStrictEqual(
    report.functions.map((row) => row.reported),
    [
      { coverage: 100, crap: 1, source: "istanbul" },
      { coverage: 0, crap: 2, source: "istanbul" },
      { coverage: 100, crap: 1, source: "istanbul" },
      { coverage: 0, crap: 2, source: "istanbul" },
      { coverage: 75, crap: 1, source: "istanbul" },
      { coverage: (2 / 3) * 100, crap: 2.1, source: "istanbul" },
      { coverage: 100, crap: 1, source: "istanbul" },
      { coverage: 100, crap: 1, source: "istanbul" },
      { coverage: 100, crap: 1, source: "istanbul" },
      { coverage: 0, crap: 2, source: "istanbul" },
    ],
  );
});

test("refuses a consumer whose two count methods carry each other's coverage", async (t) => {
  // arrange
  const fixture = twinsFixture();
  const root = await acceptedRoot(t, fixture);
  const [left, right] = expectedRows(fixture);
  const consumer = await writeConsumer(t, {
    kind: "swap",
    at: { path: TWINS_PATH, line: left?.line ?? 0, col: left?.column ?? 0 },
    with: { path: TWINS_PATH, line: right?.line ?? 0, col: right?.column ?? 0 },
  });

  // act
  const refused = risk(root, undefined, consumer);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [
      {
        kind: "coverage-mismatch",
        path: TWINS_PATH,
        line: 2,
        column: 7,
        name: "count",
        reported: 0,
        measured: 100,
      },
      {
        kind: "coverage-mismatch",
        path: TWINS_PATH,
        line: 8,
        column: 7,
        name: "count",
        reported: 100,
        measured: 0,
      },
    ],
  });
});

test("refuses a consumer that drops the nested callback's row", async (t) => {
  // arrange
  const fixture = twinsFixture();
  const root = await acceptedRoot(t, fixture);
  const nested = expectedRows(fixture).find((row) => row.cyclomatic === 2);
  const consumer = await writeConsumer(t, {
    kind: "drop",
    at: { path: TWINS_PATH, line: nested?.line ?? 0, col: nested?.column ?? 0 },
  });

  // act
  const refused = risk(root, undefined, consumer);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [
      { kind: "function-unreported", path: TWINS_PATH, line: 16, column: 20, name: "(anonymous)" },
    ],
  });
});

test("refuses a consumer that reports a function one column away from its anchor", async (t) => {
  // arrange
  const fixture = twinsFixture();
  const root = await acceptedRoot(t, fixture);
  const [outer] = expectedRows(fixture).filter((row) => row.name === "outer");
  const consumer = await writeConsumer(t, {
    kind: "shift",
    at: { path: TWINS_PATH, line: outer?.line ?? 0, col: outer?.column ?? 0 },
    by: 1,
  });

  // act
  const refused = risk(root, undefined, consumer);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [
      { kind: "row-unjoined", path: TWINS_PATH, line: 15, column: 8, col: 8, name: "outer" },
      { kind: "function-unreported", path: TWINS_PATH, line: 15, column: 7, name: "outer" },
    ],
  });
});

test("refuses a consumer of another version than the policy names", async (t) => {
  // arrange
  const root = await acceptedRoot(t, classifyFixture(true));
  const consumer = await writeConsumer(t, { kind: "version", version: "9.9.9" });

  // act
  const refused = risk(root, undefined, consumer);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [{ kind: "consumer-identity", field: "version", expected: "3.23.0", actual: "9.9.9" }],
  });
});

test("refuses an uncovered complexity-5 function at exactly 30", async (t) => {
  // arrange
  const fixture = gradeFixture();
  const root = await acceptedRoot(t, fixture);
  const [expected] = expectedRows(fixture);

  // act
  const refused = risk(root);

  // assert
  assert.strictEqual(expected?.crap, 5 * 5 * (1 - 0) ** 3 + 5);
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [{ kind: "crap", ...expected, threshold: POLICY }],
  });
});

test("passes a true score of 29.952 that the consumer displays as 30", async (t) => {
  // arrange
  const fixture = belowFixture();
  const root = await acceptedRoot(t, fixture);
  const manifest = await readJson<{ runId: string }>(path.join(root, PUBLIC_MANIFEST));

  // act
  const passed = risk(root, "coverage/unit.risk.json");

  // assert
  assert.strictEqual(crapOf(8, 3 / 10), 8 * 8 * (1 - 3 / 10) ** 3 + 8);
  assert.deepStrictEqual(passed, {
    status: 0,
    stdout: `Coverage risk verified: ${manifest.runId}, 1 production function(s) in 1 file(s) measured, max CRAP 29.95 at ${BELOW_PATH}:1:7 (below), policy < ${POLICY}; 1 other row(s) not gated\n`,
    stderr: "",
  });
  const report = await reportAt(root);
  assert.deepStrictEqual(measured(report), expectedRows(fixture));
  assert.deepStrictEqual(
    report.functions.map((row) => row.reported),
    [{ coverage: 30, crap: 30, source: "istanbul" }],
  );
});

// The installed consumer gates its own rounded label: under `--max-crap 30`
// it reports the exact 30 and the 29.952 alike and exits 1 for both. The
// gate's threshold is its own arithmetic, so only the first is refused.
for (const { fixture, crap } of [
  { fixture: gradeFixture(), crap: 30 },
  { fixture: belowFixture(), crap: 30 },
]) {
  test(`meets the consumer's own threshold of 30 with ${fixture.name} labeled ${crap}`, async (t) => {
    // arrange
    const root = await acceptedRoot(t, fixture);
    const [expected] = expectedRows(fixture);

    // act
    const gated = consumerRows(root, 30);

    // assert
    assert.deepStrictEqual(gated, {
      status: 1,
      rows: [
        {
          path: fixture.sourcePath,
          line: expected?.line,
          col: expected?.column,
          name: expected?.name,
          coverage_pct: (expected?.coverage ?? 0) * 100,
          crap,
          coverage_source: "istanbul",
        },
      ],
    });
  });
}

test("converts the consumer's byte columns through the original source line", async (t) => {
  // arrange
  const fixture = unicodeFixture();
  const root = await acceptedRoot(t, fixture);
  const [width] = fixture.functions;
  const lineText = fixture.source.split("\n")[0] ?? "";
  const byteColumn = Buffer.byteLength(lineText.slice(0, width?.anchor.column));

  // act
  const passed = risk(root, "coverage/unit.risk.json");
  const listed = consumerRows(root, 1);

  // assert
  assert.strictEqual(passed.status, 0, passed.stderr);
  assert.deepStrictEqual(
    {
      column: width?.anchor.column,
      byteColumn,
      codePoints: lineText.slice(0, width?.anchor.column).match(/./gsu)?.length,
    },
    { column: 35, byteColumn: 38, codePoints: 34 },
  );
  assert.deepStrictEqual(
    listed.rows.map((row) => [row.line, row.col]),
    [[1, byteColumn]],
  );
  const report = await reportAt(root);
  assert.deepStrictEqual(measured(report), expectedRows(fixture));
});

test("refuses a consumer column that splits a character", async (t) => {
  // arrange
  const fixture = unicodeFixture();
  const root = await acceptedRoot(t, fixture);
  const consumer = await writeConsumer(t, {
    kind: "shift",
    at: { path: UNICODE_PATH, line: 1, col: 38 },
    by: -13,
  });

  // act
  const refused = risk(root, undefined, consumer);

  // assert
  assert.deepStrictEqual(verdict(refused), {
    status: 1,
    rows: [
      { kind: "anchor-unit", path: UNICODE_PATH, line: 1, col: 25 },
      { kind: "function-unreported", path: UNICODE_PATH, line: 1, column: 35, name: "width" },
    ],
  });
});
