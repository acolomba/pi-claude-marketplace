import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

interface PlantFacts {
  readonly member: Record<string, unknown>;
  readonly insertedLine: string;
  readonly benignWitness: Record<string, unknown>;
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
    diagnostics: [],
  };
  return {
    status: findings.length === 0 ? 0 : 1,
    stdout: `${JSON.stringify(report, undefined, 2)}\n`,
    stderr: "",
  };
}

/**
 * The four answers a faithful gate gives, in the runner's control order:
 * baseline, the offender overlay, the benign receiver read, and the plant
 * removed again. The last answer deliberately reports a different
 * `work.transferMs` than the first: a runner comparing whole reports would
 * assert a wall clock, so the restored report must still be accepted.
 */
function faithfulAnswers(plant: PlantFacts): GateAnswer[] {
  const observed = {
    ...plant.member,
    status: "test-only-observed",
    witnesses: [plant.benignWitness],
  };
  return [
    gateReport([baselineMember], 52_100),
    gateReport([baselineMember, plant.member], 52_400),
    gateReport([baselineMember, observed], 52_600),
    gateReport([baselineMember], 68_900),
  ];
}

test("derives the plant from the real EdgeDeps declaration", () => {
  // act
  const facts = plantFacts();

  // assert
  assert.deepStrictEqual(facts.member, {
    id: `${edgeDepsPath}:31:3`,
    path: edgeDepsPath,
    line: 31,
    column: 3,
    owner: "EdgeDeps",
    key: "neverReadAnywhere",
    optional: true,
    category: "interface-member",
    status: "unread",
    witnesses: [],
    reasons: [],
  });
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
  const owner = await readFile(path.join(repoRoot, edgeDepsTestPath), "utf8");
  // The probe is appended as a blank line, a signature line and the reading
  // line, so it reads two lines past the file's final line.
  const expectedLine = owner.split("\n").length + 2;

  // act
  const facts = plantFacts();

  // assert
  assert.deepStrictEqual(facts.benignWitness, {
    path: edgeDepsTestPath,
    line: expectedLine,
    column: 15,
    kind: "value-read",
    origin: "test",
    syntax: "property-access",
  });
});

test("names every control it ran when a faithful gate answers", async (t) => {
  // arrange
  const gatePath = await writeStandInGate(t, faithfulAnswers(plantFacts()));

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.stderr, "");
  assert.strictEqual(
    run.stdout,
    [
      "baseline: ok",
      "offender-plant: ok",
      "benign-receiver-read: ok",
      "plant-removed: ok",
      "Unused type member negative controls passed (4 of 4).",
      "",
    ].join("\n"),
  );
  assert.strictEqual(run.status, 0);
});

test("rejects a gate that reports the plant before it was planted", async (t) => {
  // arrange
  const plant = plantFacts();
  const answers = faithfulAnswers(plant);
  answers[0] = gateReport([baselineMember, plant.member], 52_100);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /baseline: the tree already reports .*edge\/types\.ts:31:3/);
});

test("rejects a gate that reports the plant as read", async (t) => {
  // arrange
  const plant = plantFacts();
  const answers = faithfulAnswers(plant);
  answers[1] = gateReport([baselineMember], 52_400);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /offender-plant: the overlay finding set is missing/);
});

test("rejects a gate that keeps the plant a finding after a real receiver read", async (t) => {
  // arrange
  const plant = plantFacts();
  const answers = faithfulAnswers(plant);
  answers[2] = gateReport([baselineMember, plant.member], 52_600);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /benign-receiver-read: the finding set gained/);
});

test("rejects a gate whose report does not return to the baseline", async (t) => {
  // arrange
  const plant = plantFacts();
  const answers = faithfulAnswers(plant);
  answers[3] = gateReport([baselineMember, plant.member], 68_900);
  const gatePath = await writeStandInGate(t, answers);

  // act
  const run = runRunner(["--gate", gatePath]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /plant-removed: the report differs from the baseline/);
});

test("leaves the analysed sources byte-identical after a control fails", async (t) => {
  // arrange
  const plant = plantFacts();
  const answers = faithfulAnswers(plant);
  answers[1] = gateReport([baselineMember], 52_400);
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
