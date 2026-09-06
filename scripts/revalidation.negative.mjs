import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  main,
  publishRevalidation,
  renderRevalidation,
  validateLedger,
  validateShard,
} from "./revalidation.mjs";

const phaseRoot = ".planning/phases/01-live-evidence-revalidation";
const ledgerPath = `${phaseRoot}/01-REVALIDATION.json`;
const markdownPath = `${phaseRoot}/01-REVALIDATION.md`;
const assignmentPath = `${phaseRoot}/01-CORPUS-ASSIGNMENT.md`;
const shardRoot = `${phaseRoot}/shards`;

function invokeCli(projectRoot, args) {
  const stdout = [];
  const stderr = [];
  const runtime = {
    stdout: { write: (value) => void stdout.push(value) },
    stderr: { write: (value) => void stderr.push(value) },
    exitCode: 0,
  };
  main([...args, "--root", projectRoot], runtime);
  return { status: runtime.exitCode, stdout: stdout.join(""), stderr: stderr.join("") };
}

function evidenceLedger(corpusPath) {
  const claimId = `${corpusPath}#CLAIM-1`;
  return {
    version: 1,
    inventoryMode: "fixture",
    files: [
      {
        path: corpusPath,
        category: "control",
        assignedPlan: "01-02",
        claimIds: [claimId],
        reviewStatus: "complete",
        outcome: "live findings",
      },
    ],
    sourceClaims: [{ id: claimId, filePath: corpusPath, label: "CLAIM-1", findingId: "FINDING-1" }],
    findings: [
      {
        id: "FINDING-1",
        claimIds: [claimId],
        evidenceStatus: "confirmed",
        route: "Phase 2",
        sourceRefs: [{ path: "N/A", reason: "negative fixture" }],
        testRefs: [{ path: "N/A", reason: "negative fixture" }],
        validation: {
          method: "behavioral-probe",
          command: "node fixture.test.mjs",
          exitCode: 1,
          observed: "defect reproduced",
        },
        rationale: "The probe confirms the finding.",
        destination: "Phase 2",
        duplicateOf: null,
      },
    ],
    decisions: [],
    scopeChanges: [],
  };
}

const projectRoot = await mkdtemp(path.join(tmpdir(), "revalidation-negative-"));
const outsideRoot = await mkdtemp(path.join(tmpdir(), "revalidation-negative-outside-"));
try {
  const corpusPath = ".planning/reviews/unit-test-adversarial/control.md";
  await mkdir(path.dirname(path.join(projectRoot, corpusPath)), { recursive: true });
  await mkdir(path.join(projectRoot, shardRoot), { recursive: true });
  await writeFile(path.join(projectRoot, corpusPath), "benign evidence\n");
  await writeFile(
    path.join(projectRoot, assignmentPath),
    `| 001 | 01-02 | 1 | \`${corpusPath}\` |\n`,
  );
  const benign = {
    version: 1,
    inventoryMode: "fixture",
    files: [
      {
        path: corpusPath,
        category: "control",
        assignedPlan: "01-02",
        claimIds: [],
        reviewStatus: "complete",
        outcome: "control document",
      },
    ],
    sourceClaims: [],
    findings: [],
    decisions: [],
    scopeChanges: [],
  };
  assert.deepStrictEqual(validateLedger(benign, { projectRoot, expectedPaths: [corpusPath] }), []);

  await writeFile(path.join(projectRoot, ledgerPath), `${JSON.stringify(benign, null, 2)}\n`);
  await writeFile(path.join(projectRoot, markdownPath), `${renderRevalidation(benign)}tampered\n`);
  assert.deepStrictEqual(invokeCli(projectRoot, ["validate", "--assignment", assignmentPath]), {
    status: 1,
    stdout: "",
    stderr: `markdown-drift: ${markdownPath}: generated Markdown differs from canonical JSON\n`,
  });

  const victimPath = "victim.txt";
  const journalPath = path.join(projectRoot, phaseRoot, ".publish-journal.json");
  await writeFile(path.join(projectRoot, victimPath), "keep me\n");
  await writeFile(
    journalPath,
    `${JSON.stringify({
      status: "staged",
      records: [
        {
          destination: victimPath,
          staged: `${victimPath}.stage-1-1-a`,
          backup: `${victimPath}.backup-1-1-a`,
          hadDestination: false,
        },
        {
          destination: markdownPath,
          staged: `${markdownPath}.stage-1-1-a`,
          backup: `${markdownPath}.backup-1-1-a`,
          hadDestination: true,
        },
      ],
    })}\n`,
  );
  assert.throws(() => {
    publishRevalidation(projectRoot, "{}\n", "markdown\n");
  }, /publish journal is malformed/);
  assert.strictEqual(await readFile(path.join(projectRoot, victimPath), "utf8"), "keep me\n");
  await rm(journalPath);

  const outsideShard = path.join(outsideRoot, "outside.json");
  await writeFile(outsideShard, JSON.stringify({ ...benign, plan: "01-02" }));
  await symlink(outsideShard, path.join(projectRoot, shardRoot, "01-02.json"));
  assert.throws(() => {
    invokeCli(projectRoot, [
      "merge-shards",
      "--assignment",
      assignmentPath,
      "--shard-dir",
      shardRoot,
      "--check",
    ]);
  }, /shard member must be a regular file/);

  const misplacedClaim = { ...evidenceLedger(corpusPath), plan: "01-02" };
  misplacedClaim.sourceClaims[0].filePath = ".planning/reviews/unit-test-adversarial/foreign.md";
  const shardViolations = validateShard(misplacedClaim, [
    { ordinal: 1, plan: "01-02", bytes: 1, path: corpusPath },
  ]);
  assert.ok(shardViolations.some((item) => item.code === "shard-claim-owner"));

  const malformedEvidence = evidenceLedger(corpusPath);
  malformedEvidence.files[0].claimIds = "";
  malformedEvidence.findings[0].validation.command = "";
  malformedEvidence.findings[0].validation.observed = "";
  malformedEvidence.findings[0].validation.exitCode = 256;
  malformedEvidence.scopeChanges = [
    {
      id: "SCOPE-1",
      requirementId: "REQ-1",
      action: "keep",
      findingIds: ["FINDING-1"],
      decisionIds: [],
      rationale: "",
    },
  ];
  const structuralCodes = validateLedger(malformedEvidence, {
    projectRoot,
    expectedPaths: [corpusPath],
  }).map((item) => item.code);
  for (const code of [
    "invalid-file-claim-ids",
    "incomplete-validation",
    "incomplete-scope-change",
  ]) {
    assert.ok(structuralCodes.includes(code), code);
  }

  const invalidDecision = evidenceLedger(corpusPath);
  invalidDecision.decisions = [
    {
      id: "MF-DEC-01",
      status: "resolved",
      premiseFindingIds: ["FINDING-1"],
      proof: "The premise is terminal.",
      options: ["remove", ""],
      selectedOption: "remove",
      rejectedOptions: [""],
      affectedIds: ["FINDING-1"],
      recommendation: "Remove the surface.",
      downstreamConsequences: "Phase 2 removes it.",
    },
  ];
  const decisionCodes = validateLedger(invalidDecision, {
    projectRoot,
    expectedPaths: [corpusPath],
  }).map((item) => item.code);
  assert.ok(decisionCodes.includes("invalid-decision-option"));
  assert.ok(decisionCodes.includes("invalid-rejected-option"));

  const missing = structuredClone(benign);
  missing.files = [];
  assert.deepStrictEqual(validateLedger(missing, { projectRoot, expectedPaths: [corpusPath] }), [
    { code: "missing-files", target: "files", message: corpusPath },
  ]);

  const reordered = structuredClone(benign);
  const secondPath = ".planning/reviews/unit-test-adversarial/a.md";
  await writeFile(path.join(projectRoot, secondPath), "second\n");
  reordered.files.push({ ...reordered.files[0], path: secondPath });
  assert.ok(
    validateLedger(reordered, { projectRoot, expectedPaths: [secondPath, corpusPath] }).some(
      (item) => item.code === "file-order",
    ),
  );

  process.stdout.write("Revalidation negative controls passed.\n");
} finally {
  await rm(projectRoot, { recursive: true, force: true });
  await rm(outsideRoot, { recursive: true, force: true });
}
