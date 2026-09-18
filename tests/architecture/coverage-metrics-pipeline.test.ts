/**
 * The coverage-risk pipeline's wiring gate (D-10, METRIC-01, METRIC-02).
 *
 * The pipeline itself is proved by the controls under `tests/scripts/`: the
 * capture, the producer, the validators and the CRAP consumer each refuse the
 * offenders planted against them. What those controls cannot see is whether
 * the ordinary check order runs the pipeline at all, in the order its contract
 * needs, and only once:
 *
 *   - `npm run check` must fulfil its one unit execution through the verified
 *     capture and consume the risk metrics after it, with every gate it ran
 *     before still present;
 *   - `npm test` and the capture must select the unit suite from one
 *     definition, so the two cannot drift apart;
 *   - the pre-commit hooks must run the producer, which may reuse a bundle the
 *     current tree still validates, before the consumer, which never may;
 *   - a consumer handed a missing or stale bundle must refuse without
 *     regenerating it or falling back to a coverage file at an inherited path.
 *
 * Each structural predicate is also run against a planted violation, so a
 * green case means the predicate fires and not only that the file was read.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CLASSIFY_PATH,
  classifyFixture,
  riskFixtureFiles,
} from "../scripts/check-coverage-risk-fixtures.ts";
import { captureCliPath, createRoot, refusalRows, run } from "../scripts/coverage-run-support.ts";
import { populationFiles } from "../scripts/coverage-unit-fixtures.ts";

import { PACKAGE_JSON_REL } from "./gate-targets.ts";
import { readLocalHooks } from "./pre-commit-hooks.ts";
import { REPO_ROOT } from "./source-scan.ts";

import type { ProcessRun } from "../scripts/coverage-run-support.ts";
import type { TestContext } from "node:test";

const PRE_COMMIT_REL = ".pre-commit-config.yaml";
const PUBLIC_MANIFEST = "coverage/unit.manifest.json";
const PUBLIC_LCOV = "coverage/unit.lcov";
const RUNS_DIRECTORY = "coverage/runs";

const scriptsUrl = new URL("../../scripts/", import.meta.url);
const unitCliPath = fileURLToPath(new URL("coverage-unit.mjs", scriptsUrl));
const riskCliPath = fileURLToPath(new URL("check-coverage-risk.mjs", scriptsUrl));

/** The check members that ran before the pipeline was wired in; none may disappear. */
const RETAINED_MEMBERS = [
  "npm run typecheck",
  "npm run lint",
  "npm run lint:workflows",
  "npm run lint:workflows:negative",
  "npm run fallow",
  "npm run format:check",
  "npm run test:corresponding",
  "npm run test:corresponding:negative",
  "npm run test:coverage:direct:negative",
  "npm run test:integration",
  "npm run lint:type-members",
  "npm run lint:type-members:negative",
];

/** Every script that launches the unit selection; the chain may run exactly one, the verified capture. */
const UNIT_LAUNCHERS = [
  "npm test",
  "npm run test:coverage:unit",
  "npm run coverage:unit:verified",
  "npm run coverage:unit:current",
  "npm run coverage:capture",
];
const VERIFIED_CAPTURE = "npm run test:coverage:unit";
const CONSUMER = "npm run coverage:risk";
const NEGATIVE_RUNNERS = ["npm run coverage:unit:negative", "npm run coverage:risk:negative"];

const UNIT_HOOK_ID = "npm-coverage-unit";
const RISK_HOOK_ID = "npm-coverage-risk";

interface PackageScripts {
  readonly scripts: Readonly<Record<string, string>>;
}

/** What the spec reporter counted, read from the summary lines it prints. */
interface SpecSummary {
  readonly status: number;
  readonly tests: number;
  readonly pass: number;
  readonly fail: number;
}

async function readRepoFile(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), "utf8");
}

async function readScripts(): Promise<Readonly<Record<string, string>>> {
  return (JSON.parse(await readRepoFile(PACKAGE_JSON_REL)) as PackageScripts).scripts;
}

/**
 * Everything wrong with a check chain as the pipeline's contract reads it:
 * a retained gate gone, more or fewer than one unit launch, the wrong
 * launcher, a consumer missing or running before its producer, a negative
 * runner missing. An empty answer is the only acceptable one.
 */
function chainFindings(chain: string): string[] {
  const members = chain.split(" && ");
  const findings = RETAINED_MEMBERS.filter((member) => !members.includes(member)).map(
    (member) => `missing: ${member}`,
  );
  const launches = members.filter((member) => UNIT_LAUNCHERS.includes(member));

  if (launches.length !== 1 || launches[0] !== VERIFIED_CAPTURE) {
    findings.push(`unit launches: ${JSON.stringify(launches)}`);
  }

  if (!members.includes(CONSUMER)) {
    findings.push(`missing: ${CONSUMER}`);
  } else if (members.indexOf(CONSUMER) < members.indexOf(VERIFIED_CAPTURE)) {
    findings.push(`${CONSUMER} runs before ${VERIFIED_CAPTURE}`);
  }

  findings.push(
    ...NEGATIVE_RUNNERS.filter((runner) => !members.includes(runner)).map(
      (runner) => `missing: ${runner}`,
    ),
  );
  return findings;
}

function specSummary(completed: ProcessRun): SpecSummary {
  const count = (label: string): number => {
    const match = new RegExp(`^ℹ ${label} (\\d+)$`, "mu").exec(completed.stdout);
    return match === null ? -1 : Number(match[1]);
  };

  return {
    status: completed.status,
    tests: count("tests"),
    pass: count("pass"),
    fail: count("fail"),
  };
}

function plain(root: string, ...forwarded: string[]): ProcessRun {
  return run([captureCliPath, "--plain", "--root", root, ...forwarded]);
}

function reuseCurrent(root: string): ProcessRun {
  return run([unitCliPath, "--reuse-current", "--root", root]);
}

function risk(root: string): ProcessRun {
  return run([riskCliPath, "--root", root]);
}

/** The first line of a producer's report: its verb and the run it names. */
function reported(completed: ProcessRun): { verb: string; runId: string } {
  const match = /^Coverage unit (?<verb>verified|reused): (?<runId>\S+):/u.exec(completed.stdout);
  assert.ok(match?.groups, `${completed.stdout}\n${completed.stderr}`);
  return { verb: match.groups.verb ?? "", runId: match.groups.runId ?? "" };
}

async function runDirectories(root: string): Promise<string[]> {
  const runsPath = path.join(root, RUNS_DIRECTORY);
  return existsSync(runsPath) ? (await readdir(runsPath)).sort() : [];
}

async function publishedRunId(root: string): Promise<string | undefined> {
  const manifestPath = path.join(root, PUBLIC_MANIFEST);

  if (!existsSync(manifestPath)) {
    return undefined;
  }

  return (JSON.parse(await readFile(manifestPath, "utf8")) as { runId: string }).runId;
}

async function acceptedClassifyRoot(t: TestContext): Promise<string> {
  const root = await createRoot(t, riskFixtureFiles(classifyFixture(true)));
  const first = reuseCurrent(root);
  assert.strictEqual(first.status, 0, first.stderr);
  return root;
}

test("the check chain launches the unit suite once through the verified capture and consumes its risk after it", async () => {
  // arrange
  const scripts = await readScripts();

  // act
  const findings = chainFindings(scripts.check ?? "");

  // assert
  assert.deepStrictEqual(findings, []);
});

for (const { plant, chain, expectedFindings } of [
  {
    plant: "a second unit launch through npm test",
    chain: [...RETAINED_MEMBERS, "npm test", VERIFIED_CAPTURE, CONSUMER, ...NEGATIVE_RUNNERS].join(
      " && ",
    ),
    expectedFindings: ['unit launches: ["npm test","npm run test:coverage:unit"]'],
  },
  {
    plant: "the consumer ahead of its producer",
    chain: [...RETAINED_MEMBERS, CONSUMER, VERIFIED_CAPTURE, ...NEGATIVE_RUNNERS].join(" && "),
    expectedFindings: ["npm run coverage:risk runs before npm run test:coverage:unit"],
  },
  {
    plant: "the unit suite run without the capture",
    chain: [...RETAINED_MEMBERS, "npm test", CONSUMER, ...NEGATIVE_RUNNERS].join(" && "),
    expectedFindings: ['unit launches: ["npm test"]'],
  },
  {
    plant: "a retired gate",
    chain: [
      ...RETAINED_MEMBERS.filter((member) => member !== "npm run fallow"),
      VERIFIED_CAPTURE,
      CONSUMER,
      ...NEGATIVE_RUNNERS,
    ].join(" && "),
    expectedFindings: ["missing: npm run fallow"],
  },
  {
    plant: "a missing negative runner",
    chain: [...RETAINED_MEMBERS, VERIFIED_CAPTURE, CONSUMER, "npm run coverage:unit:negative"].join(
      " && ",
    ),
    expectedFindings: ["missing: npm run coverage:risk:negative"],
  },
]) {
  test(`the chain predicate reports ${plant}`, () => {
    // arrange
    const planted = chain;

    // act
    const findings = chainFindings(planted);

    // assert
    assert.deepStrictEqual(findings, expectedFindings);
  });
}

test("the unit scripts run one authoritative selection through the capture module", async () => {
  // arrange
  const scripts = await readScripts();

  // act
  const wiring = {
    test: scripts.test,
    "test:coverage:unit": scripts["test:coverage:unit"],
    "coverage:unit:verified": scripts["coverage:unit:verified"],
    "coverage:unit:current": scripts["coverage:unit:current"],
    "coverage:risk": scripts["coverage:risk"],
  };

  // assert
  assert.deepStrictEqual(wiring, {
    test: "node scripts/coverage-capture.mjs --plain",
    "test:coverage:unit": "npm run coverage:unit:verified",
    "coverage:unit:verified": "node scripts/coverage-unit.mjs",
    "coverage:unit:current": "node scripts/coverage-unit.mjs --reuse-current",
    "coverage:risk": "node scripts/check-coverage-risk.mjs",
  });
});

test("the pre-commit hooks run the reusable producer before the consumer over the whole project", async () => {
  // arrange
  const hooks = readLocalHooks(await readRepoFile(PRE_COMMIT_REL));
  const order = [...hooks.keys()];

  // act
  const unit = hooks.get(UNIT_HOOK_ID);
  const risk = hooks.get(RISK_HOOK_ID);

  // assert
  assert.deepStrictEqual(
    {
      unit: { entry: unit?.entry, passFilenames: unit?.passFilenames },
      risk: { entry: risk?.entry, passFilenames: risk?.passFilenames },
      sameTrigger: unit?.files === risk?.files && unit?.files !== "",
      unitFirst: order.indexOf(UNIT_HOOK_ID) < order.indexOf(RISK_HOOK_ID),
    },
    {
      unit: { entry: "npm run coverage:unit:current", passFilenames: "false" },
      risk: { entry: "npm run coverage:risk", passFilenames: "false" },
      sameTrigger: true,
      unitFirst: true,
    },
  );
});

test("the coverage hooks trigger on every input an accepted bundle binds and on nothing else", async () => {
  // arrange
  const hooks = readLocalHooks(await readRepoFile(PRE_COMMIT_REL));
  const trigger = new RegExp(hooks.get(UNIT_HOOK_ID)?.files ?? "(?!)");
  const inputs = [
    // Production sources and the resources beside them.
    "extensions/pi-claude-marketplace/domain/source.ts",
    "extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts",
    // The unit test tree and its support files, fixtures included.
    "tests/domain/source.test.ts",
    "tests/scripts/coverage-run-support.ts",
    "tests/bridges/_fixtures/plugin/hooks/hooks.json",
    // The tooling: the pipeline, the policy and the other gates.
    "scripts/coverage-unit.mjs",
    "scripts/coverage-risk-policy.json",
    "scripts/check-unused-type-members.mjs",
    // The vendored producer and its patch.
    "vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz",
    "vendor/coverage/ast-v8-to-istanbul-1.0.6.patch",
    // The configuration files the inventory binds.
    ".fallowrc.json",
    ".pre-commit-config.yaml",
    ".prettierignore",
    ".prettierrc.json",
    "eslint.config.js",
    "package.json",
    "package-lock.json",
    "sonar-project.properties",
    "tsconfig.json",
  ];
  const nonInputs = [
    "README.md",
    "docs/coverage-metrics.md",
    "tests/e2e/pinned.test.ts",
    "tests/integration/skill-path-resolution.test.ts",
    "tests/live-uat/stop-canary.mjs",
    ".github/workflows/ci.yml",
    ".planning/STATE.md",
    "zizmor.yml",
  ];

  // act
  const missed = inputs.filter((one) => !trigger.test(one));
  const overreach = nonInputs.filter((one) => trigger.test(one));

  // assert
  assert.deepStrictEqual({ missed, overreach }, { missed: [], overreach: [] });
});

test("the plain mode runs the whole unit selection without capturing anything", async (t) => {
  // arrange
  const root = await createRoot(t, populationFiles());

  // act
  const tested = plain(root);

  // assert
  assert.deepStrictEqual(
    { ...specSummary(tested), captured: existsSync(path.join(root, "coverage")) },
    { status: 0, tests: 3, pass: 3, fail: 0, captured: false },
  );
});

test("the plain mode forwards a runner option to the selection", async (t) => {
  // arrange
  const root = await createRoot(t, populationFiles());

  // act
  const tested = plain(root, "--test-name-pattern=doubles");

  // assert
  assert.deepStrictEqual(specSummary(tested), { status: 0, tests: 1, pass: 1, fail: 0 });
});

test("the plain mode reports a failing test through its exit status", async (t) => {
  // arrange
  const root = await createRoot(t, {
    ...populationFiles(),
    "tests/domain/failing.test.ts": `import assert from "node:assert/strict";
import test from "node:test";

test("fails on purpose", () => {
  assert.equal(1, 2);
});
`,
  });

  // act
  const tested = plain(root);

  // assert
  assert.deepStrictEqual(specSummary(tested), { status: 1, tests: 4, pass: 3, fail: 1 });
});

test("the plain mode exits 2 on an argument that is not a runner option", async (t) => {
  // arrange
  const root = await createRoot(t, populationFiles());

  // act
  const refused = plain(root, "--verbose");

  // assert
  assert.deepStrictEqual(
    { status: refused.status, stderr: refused.stderr, tests: specSummary(refused).tests },
    {
      status: 2,
      stderr:
        "Unknown option: --verbose. Pass --root <dir> and/or --verify, or --plain with --test-* runner options.\n",
      tests: -1,
    },
  );
});

test("the reusable producer captures once and reuses the accepted bundle of an unchanged tree", async (t) => {
  // arrange
  const root = await createRoot(t, riskFixtureFiles(classifyFixture(true)));

  // act
  const first = reuseCurrent(root);
  const second = reuseCurrent(root);

  // assert
  const firstReport = reported(first);
  assert.deepStrictEqual(
    {
      first: { status: first.status, verb: firstReport.verb },
      second: { status: second.status, ...reported(second) },
      runs: await runDirectories(root),
    },
    {
      first: { status: 0, verb: "verified" },
      second: { status: 0, verb: "reused", runId: firstReport.runId },
      runs: [firstReport.runId],
    },
  );
});

test("the reusable producer captures again once a production source changed", async (t) => {
  // arrange
  const root = await acceptedClassifyRoot(t);
  const previousRunId = await publishedRunId(root);
  await appendFile(path.join(root, CLASSIFY_PATH), "// later\n");

  // act
  const refreshed = reuseCurrent(root);

  // assert
  const report = reported(refreshed);
  assert.deepStrictEqual(
    {
      status: refreshed.status,
      verb: report.verb,
      replaced: report.runId !== previousRunId,
      published: await publishedRunId(root),
      runs: (await runDirectories(root)).length,
    },
    { status: 0, verb: "verified", replaced: true, published: report.runId, runs: 2 },
  );
});

test("the reusable producer captures again once a bound configuration file changed", async (t) => {
  // arrange
  const root = await acceptedClassifyRoot(t);
  const previousRunId = await publishedRunId(root);
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", type: "module", version: "2.0.0" }, undefined, 2)}\n`,
  );

  // act
  const refreshed = reuseCurrent(root);

  // assert
  const report = reported(refreshed);
  assert.deepStrictEqual(
    { status: refreshed.status, verb: report.verb, replaced: report.runId !== previousRunId },
    { status: 0, verb: "verified", replaced: true },
  );
});

test("the reusable producer does not reuse a captured bundle nobody accepted", async (t) => {
  // arrange
  const root = await createRoot(t, riskFixtureFiles(classifyFixture(true)));
  const captured = run([captureCliPath, "--root", root]);
  assert.strictEqual(captured.status, 0, captured.stderr);
  const capturedRunId = await publishedRunId(root);

  // act
  const accepted = reuseCurrent(root);

  // assert
  const report = reported(accepted);
  assert.deepStrictEqual(
    { status: accepted.status, verb: report.verb, replaced: report.runId !== capturedRunId },
    { status: 0, verb: "verified", replaced: true },
  );
});

test("the consumer refuses a stale bundle without regenerating it", async (t) => {
  // arrange
  const root = await acceptedClassifyRoot(t);
  const publishedBefore = await publishedRunId(root);
  await appendFile(path.join(root, CLASSIFY_PATH), "// later\n");

  // act
  const refused = risk(root);

  // assert
  assert.deepStrictEqual(
    {
      status: refused.status,
      kinds: refusalRows(refused.stderr).map((row) => row.kind),
      published: await publishedRunId(root),
      runs: await runDirectories(root),
    },
    { status: 1, kinds: ["validation"], published: publishedBefore, runs: [publishedBefore] },
  );
});

test("the consumer reads no coverage file at the inherited public path when the bundle is missing", async (t) => {
  // arrange
  const lcov =
    "TN:\nSF:extensions/pi-claude-marketplace/domain/classify.ts\nDA:1,1\nend_of_record\n";
  const root = await createRoot(t, {
    ...riskFixtureFiles(classifyFixture(true)),
    [PUBLIC_LCOV]: lcov,
  });
  await mkdir(path.join(root, RUNS_DIRECTORY), { recursive: true });

  // act
  const refused = risk(root);

  // assert
  assert.deepStrictEqual(
    {
      status: refused.status,
      rows: refusalRows(refused.stderr),
      lcov: await readFile(path.join(root, PUBLIC_LCOV), "utf8"),
      runs: await runDirectories(root),
    },
    {
      status: 1,
      rows: [{ kind: "missing-manifest", path: PUBLIC_MANIFEST }],
      lcov,
      runs: [],
    },
  );
});
