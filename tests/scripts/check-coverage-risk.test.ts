import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyFixture,
  CLASSIFY_PATH,
  expectedRows,
  riskFixtureFiles,
} from "./check-coverage-risk-fixtures.ts";
import { captureCliPath, createRoot, readJson, refusalRows, run } from "./coverage-run-support.ts";

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

function risk(root: string, reportPath?: string): ProcessRun {
  const args = [riskCliPath, "--root", root];

  if (reportPath !== undefined) {
    args.push("--report", reportPath);
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
