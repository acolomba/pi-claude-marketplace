import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { TestContext } from "node:test";

// The negative runner drives the real gate against the real repository, which
// costs a full whole-program analysis per control. These cases therefore drive
// the RUNNER, not the analyzer: they hand it a stand-in gate executable whose
// every answer is scripted, so the question each case asks is "does the runner
// reject this answer" rather than "is the tree clean".
//
// The one live fact they do assert is the plant itself, because a plant derived
// from anything other than the real declaration is a synthetic lookalike and
// proves nothing about the real EdgeDeps.

const runnerPath = fileURLToPath(
  new URL("../../scripts/check-unused-type-members.negative.mjs", import.meta.url),
);
const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const edgeDepsPath = "extensions/pi-claude-marketplace/edge/types.ts";
const edgeDepsTestPath = "tests/edge/types.test.ts";

interface RunnerRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** One scripted answer from a stand-in gate, in invocation order. */
interface GateAnswer {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function runRunner(args: readonly string[]): RunnerRun {
  const completed = spawnSync(process.execPath, [runnerPath, ...args], { encoding: "utf8" });
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

/**
 * A gate executable that answers by invocation index, tracked in a counter file
 * beside it. Answering by position is what lets a case script a faithful gate
 * and a defective one with the same mechanism, and it pins the runner's control
 * order: a runner that drops or reorders a control gets the wrong answer.
 */
async function writeStandInGate(t: TestContext, answers: readonly GateAnswer[]): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "unused-type-members-stand-in-"));

  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  const gatePath = path.join(directory, "gate.mjs");
  const counterPath = path.join(directory, "counter");
  const source = `import { existsSync, readFileSync, writeFileSync } from "node:fs";

const answers = ${JSON.stringify(answers)};
const counterPath = ${JSON.stringify(counterPath)};
const index = existsSync(counterPath) ? Number(readFileSync(counterPath, "utf8")) : 0;
writeFileSync(counterPath, String(index + 1));
const answer = answers[index] ?? answers[answers.length - 1];
process.stdout.write(answer.stdout);
process.stderr.write(answer.stderr);
process.exitCode = answer.status;
`;
  await writeFile(gatePath, source);
  return gatePath;
}

/**
 * The runner's own temporary overlay directories that exist right now. A run
 * that leaves one behind wrote an overlay it never disposed of, which the
 * cleanup control compares across a failing run.
 */
async function overlayDirectories(): Promise<string[]> {
  const entries = await readdir(tmpdir());
  return entries.filter((entry) => entry.startsWith("unused-type-members-negative-")).sort();
}

interface PlantFacts {
  readonly member: Record<string, unknown>;
  readonly insertedLine: string;
  readonly benignWitness: Record<string, unknown>;
  readonly unrelatedMember: Record<string, unknown>;
}

function plantFacts(): PlantFacts {
  const run = runRunner(["--print-plant"]);
  assert.strictEqual(run.status, 0, `--print-plant failed: ${run.stderr}`);
  return JSON.parse(run.stdout) as PlantFacts;
}

/** A finding the runner never planted, standing in for the honest live baseline. */
const baselineMember = {
  id: "extensions/pi-claude-marketplace/shared/errors.ts:11:3",
  path: "extensions/pi-claude-marketplace/shared/errors.ts",
  line: 11,
  column: 3,
  owner: "CarriedBaseline",
  key: "carried",
  optional: true,
  category: "interface-member",
  status: "unread",
  witnesses: [],
  reasons: [],
};

function gateReport(
  members: ReadonlyArray<Record<string, unknown>>,
  transferMs: number,
  diagnostics: readonly string[] = [],
): GateAnswer {
  const findings = members.filter((member) => member.status === "unread");
  const report = {
    schemaVersion: 1,
    status: findings.length === 0 ? "clean" : "findings",
    root: repoRoot,
    counts: {
      productionFiles: 236,
      candidates: members.length,
      runtimeObserved: 0,
      testOnlyObserved: 0,
      explicitContract: 0,
      unread: findings.length,
      unsupportedAnalysis: 0,
    },
    work: {
      transferSteps: 3_001_672,
      transferEdges: 216_490,
      transferReads: 82_772,
      operationReads: 985_894,
      transferMs,
    },
    members,
    findings,
    diagnostics,
  };
  return {
    status: findings.length === 0 ? 0 : 1,
    stdout: `${JSON.stringify(report, undefined, 2)}\n`,
    stderr: "",
  };
}

/** A gate that refused to analyse: exit 2, no report at all, a named reason. */
function setupAnswer(reason: string): GateAnswer {
  return { status: 2, stdout: "", stderr: `${reason}\n` };
}

const syntaxRefusal = `Compiler input has a syntax error: ${edgeDepsPath}: '}' expected.`;
const budgetRefusal = "Option --budget needs a positive whole number, not 0";

/**
 * The exact record the gate must report for the plant, written out here rather
 * than taken from the runner. A stand-in gate answering with the runner's own
 * computation would agree with the runner whatever the runner computed.
 */
const expectedPlantMember = {
  id: `${edgeDepsPath}:37:3`,
  path: edgeDepsPath,
  line: 37,
  column: 3,
  owner: "EdgeDeps",
  key: "neverReadAnywhere",
  optional: true,
  category: "interface-member",
  status: "unread",
  witnesses: [],
  reasons: [],
};

/** The same-spelling member on an unrelated type, which production really reads. */
const expectedUnrelatedMember = {
  id: `${edgeDepsPath}:41:3`,
  path: edgeDepsPath,
  line: 41,
  column: 3,
  owner: "UnrelatedSameSpelling",
  key: "neverReadAnywhere",
  optional: true,
  category: "interface-member",
  status: "runtime-observed",
  witnesses: [
    {
      path: edgeDepsPath,
      line: 45,
      column: 20,
      kind: "value-read",
      origin: "production",
      syntax: "property-access",
    },
  ],
  reasons: [],
};

/**
 * The benign probe's reading site, counted out of the owner test on disk. The
 * probe is appended as a blank line, a signature line and the reading line, so
 * it reads two lines past the file's final line.
 */
async function expectedBenignWitness(): Promise<Record<string, unknown>> {
  const owner = await readFile(path.join(repoRoot, edgeDepsTestPath), "utf8");
  return {
    path: edgeDepsTestPath,
    line: owner.split("\n").length + 2,
    column: 15,
    kind: "value-read",
    origin: "test",
    syntax: "property-access",
  };
}

/**
 * The seven answers a faithful gate gives, in the runner's control order:
 * baseline, the offender overlay, the benign receiver read, the unrelated
 * same-spelling read, the plant removed again, and the two refusals.
 *
 * The restored answer deliberately reports a different `work.transferMs` than
 * the baseline: a runner comparing whole reports would assert a wall clock, so
 * the restored report must still be accepted.
 */
function faithfulAnswers(benignWitness: Record<string, unknown>): GateAnswer[] {
  const observed = {
    ...expectedPlantMember,
    status: "test-only-observed",
    witnesses: [benignWitness],
  };
  return [
    gateReport([baselineMember], 52_100),
    gateReport([baselineMember, expectedPlantMember], 52_400),
    gateReport([baselineMember, observed], 52_600),
    gateReport([baselineMember, expectedPlantMember, expectedUnrelatedMember], 52_800),
    gateReport([baselineMember], 68_900),
    setupAnswer(syntaxRefusal),
    setupAnswer(budgetRefusal),
  ];
}

const controlOrder = [
  "baseline",
  "offender-plant",
  "benign-receiver-read",
  "unrelated-same-spelling-read",
  "plant-removed",
  "compiler-failure",
  "option-failure",
] as const;

/** The answer position a control occupies, so a case names the control it defeats. */
function at(label: (typeof controlOrder)[number]): number {
  return controlOrder.indexOf(label);
}

test("derives the plant from the real EdgeDeps declaration", () => {
  // act
  const facts = plantFacts();

  // assert
  assert.deepStrictEqual(facts.member, expectedPlantMember);
  assert.strictEqual(facts.insertedLine, "  readonly neverReadAnywhere?: string;");
});

test("plants a key the real declaration does not already carry", async () => {
  // arrange
  const declared = await readFile(path.join(repoRoot, edgeDepsPath), "utf8");

  // act
  const facts = plantFacts();

  // assert
  assert.strictEqual(declared.includes(String(facts.member.key)), false);
});

test("expects the benign receiver read at the site the probe occupies", async () => {
  // arrange
  const expected = await expectedBenignWitness();

  // act
  const facts = plantFacts();

  // assert
  assert.deepStrictEqual(facts.benignWitness, expected);
});

test("names every control it ran when a faithful gate answers", async (t) => {
  // arrange
  const gatePath = await writeStandInGate(t, faithfulAnswers(await expectedBenignWitness()));

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.stderr, "");
  assert.strictEqual(
    run.stdout,
    [
      ...controlOrder.map((label) => `${label}: ok`),
      `Unused type member negative controls passed (${controlOrder.length} of ${controlOrder.length}).`,
      "",
    ].join("\n"),
  );
  assert.strictEqual(run.status, 0);
});

test("rejects a gate that reports the plant before it was planted", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("baseline")] = gateReport([baselineMember, expectedPlantMember], 52_100);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /baseline: the tree already reports .*edge\/types\.ts:37:3/);
});

test("rejects a gate that reports the plant as read", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("offender-plant")] = gateReport([baselineMember], 52_400);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /offender-plant: the overlay finding set is missing/);
});

test("rejects a gate that keeps the plant a finding after a real receiver read", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("benign-receiver-read")] = gateReport([baselineMember, expectedPlantMember], 52_600);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /benign-receiver-read: the finding set gained/);
});

test("rejects a gate whose report does not return to the baseline", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("plant-removed")] = gateReport([baselineMember, expectedPlantMember], 68_900);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /plant-removed: the report differs from the baseline/);
});

test("leaves the analysed sources byte-identical after a control fails", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("offender-plant")] = gateReport([baselineMember], 52_400);
  const gatePath = await writeStandInGate(t, answers);
  const declared = await readFile(path.join(repoRoot, edgeDepsPath), "utf8");
  const owner = await readFile(path.join(repoRoot, edgeDepsTestPath), "utf8");

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.strictEqual(await readFile(path.join(repoRoot, edgeDepsPath), "utf8"), declared);
  assert.strictEqual(await readFile(path.join(repoRoot, edgeDepsTestPath), "utf8"), owner);
});

test("derives the unrelated same-spelling declaration it reads from production", () => {
  // act
  const facts = plantFacts();

  // assert
  assert.deepStrictEqual(facts.unrelatedMember, expectedUnrelatedMember);
});

test("rejects a gate that always reports a clean tree", async (t) => {
  // arrange
  const gatePath = await writeStandInGate(t, [gateReport([], 52_100)]);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /offender-plant: the overlay finding set is missing .*:37:3/);
});

test("rejects a gate that always reports the same findings", async (t) => {
  // arrange
  const gatePath = await writeStandInGate(t, [
    gateReport([baselineMember, expectedPlantMember], 52_100),
  ]);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /baseline: the tree already reports .*:37:3/);
});

test("rejects a gate that describes a different member at the planted coordinates", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("offender-plant")] = gateReport(
    [baselineMember, { ...expectedPlantMember, owner: "SomethingElse", key: "somethingElse" }],
    52_400,
  );
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /offender-plant: the record for .*:37:3 is .*SomethingElse/);
});

test("rejects a gate whose report cannot be parsed", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("offender-plant")] = { status: 1, stdout: "{ not a report", stderr: "" };
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /offender-plant: the gate wrote no parsable report/);
});

test("rejects a gate executable that cannot be launched", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "unused-type-members-absent-"));
  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  // act
  const run = runRunner(["--gate", path.join(directory, "no-such-gate.mjs")]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /baseline: the gate produced no report \(exit 1\)/);
});

test("rejects a gate that answers a refusal where a member finding belongs", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("offender-plant")] = setupAnswer(syntaxRefusal);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /offender-plant: the gate produced no report \(exit 2\)/);
});

test("rejects a gate that answers a member finding where a refusal belongs", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("compiler-failure")] = gateReport([baselineMember, expectedPlantMember], 52_900);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /compiler-failure: the gate exited 1 rather than refusing/);
});

test("rejects a gate that refuses without naming what it could not read", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("option-failure")] = setupAnswer("something went wrong");
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /option-failure: the refusal does not name/);
});

test("rejects a gate that clears the offender when an unrelated type is read", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("unrelated-same-spelling-read")] = gateReport(
    [
      baselineMember,
      { ...expectedPlantMember, status: "runtime-observed" },
      expectedUnrelatedMember,
    ],
    52_800,
  );
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /unrelated-same-spelling-read: the overlay finding set is missing/);
});

test("rejects a gate whose diagnostics the contract census does not explain", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("baseline")] = gateReport([baselineMember], 52_100, ["internal: gave up on a file"]);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /baseline: the gate reported internal: gave up on a file/);
});

test("removes its temporary overlays after a control fails", async (t) => {
  // arrange
  const answers = faithfulAnswers(await expectedBenignWitness());
  answers[at("offender-plant")] = gateReport([baselineMember], 52_400);
  const gatePath = await writeStandInGate(t, answers);
  const before = await overlayDirectories();

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(await overlayDirectories(), before);
});
