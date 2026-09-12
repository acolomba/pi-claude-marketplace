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
const requirementsPath = ".planning/REQUIREMENTS.md";
const roadmapPath = ".planning/ROADMAP.md";

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

/**
 * The live traceability row for one requirement, matched whatever its column
 * padding and status spelling currently are.
 *
 * A control that plants its violation with a hard-coded row literal stops
 * planting anything the moment the document is reformatted or a status flips,
 * and `String.replace` reports that miss by returning the original document.
 * Matching the row and asserting the match turns the same drift into a failure.
 */
function traceabilityRow(markdown, requirementId) {
  const match = new RegExp(`^\\|[ \\t]*${requirementId}[ \\t]*\\|[^\\n]*\\|$`, "m").exec(markdown);
  assert.ok(match, `traceability row for ${requirementId} is absent`);
  return match[0];
}

/** The live active-definition line for one requirement, either checkbox state. */
function requirementDefinitionLine(markdown, requirementId) {
  const match = new RegExp(`^- \\[[ x]\\] \\*\\*${requirementId}\\*\\*`, "m").exec(markdown);
  assert.ok(match, `active definition for ${requirementId} is absent`);
  return match[0];
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

  const canonicalRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const scopeLedger = await readFile(path.join(canonicalRoot, ledgerPath), "utf8");
  const requirements = await readFile(path.join(canonicalRoot, requirementsPath), "utf8");
  const roadmap = await readFile(path.join(canonicalRoot, roadmapPath), "utf8");
  await writeFile(path.join(projectRoot, ledgerPath), scopeLedger);
  await writeFile(path.join(projectRoot, roadmapPath), roadmap);
  assert.throws(
    () => invokeCli(projectRoot, ["scope-impact", "--check"]),
    new RegExp(`path does not exist: ${requirementsPath.replace(".", "\\.")}`),
  );

  await writeFile(path.join(projectRoot, requirementsPath), requirements);

  const renamedLedger = JSON.parse(scopeLedger);
  const renamedRequirement = renamedLedger.scopeChanges.find(
    (change) => change.id === "SCOPE-REQ-AUTH-01",
  );
  assert.ok(renamedRequirement);
  renamedRequirement.id = "SCOPE-REQ-EVIL-99";
  renamedRequirement.requirementId = "EVIL-99";
  renamedRequirement.beforeAnchor = renamedRequirement.beforeAnchor.replaceAll(
    "AUTH-01",
    "EVIL-99",
  );
  renamedRequirement.afterAnchor = renamedRequirement.afterAnchor.replaceAll("AUTH-01", "EVIL-99");
  await writeFile(
    path.join(projectRoot, ledgerPath),
    `${JSON.stringify(renamedLedger, null, 2)}\n`,
  );
  const authDefinition = requirementDefinitionLine(requirements, "AUTH-01");
  const authRow = traceabilityRow(requirements, "AUTH-01");
  await writeFile(
    path.join(projectRoot, requirementsPath),
    requirements
      .replace(authDefinition, authDefinition.replace("AUTH-01", "EVIL-99"))
      .replace(authRow, authRow.replace("AUTH-01", "EVIL-99")),
  );
  await writeFile(
    path.join(projectRoot, roadmapPath),
    roadmap.replace(
      "**Requirements:** AUTH-01, TREF-01, TREF-02, TREF-03",
      "**Requirements:** EVIL-99, TREF-01, TREF-02, TREF-03",
    ),
  );
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 1,
    stdout: "",
    stderr:
      "missing-scope-requirement: AUTH-01: stable requirement row is absent\n" +
      "phase-requirements: PHASE-04: roadmap membership differs from sealed requirement routes\n" +
      "unexpected-requirement-definition: EVIL-99: scope row is absent\n" +
      "unexpected-requirement-route: EVIL-99: scope row is absent\n" +
      "unexpected-scope-requirement: EVIL-99: requirement is absent from sealed stable-ID set\n",
  });

  await writeFile(path.join(projectRoot, ledgerPath), scopeLedger);
  const pdefRow = traceabilityRow(requirements, "PDEF-01");
  assert.ok(pdefRow.includes("Phase 3"), "PDEF-01 is no longer routed to Phase 3");
  await writeFile(
    path.join(projectRoot, requirementsPath),
    requirements.replace(pdefRow, pdefRow.replace("Phase 3", "Phase 4")),
  );
  await writeFile(
    path.join(projectRoot, roadmapPath),
    roadmap
      .replace(
        "**Requirements:** PDEF-01, PDEF-05, PDEF-06, PDEF-07, PDEF-08",
        "**Requirements:** PDEF-05, PDEF-06, PDEF-07, PDEF-08",
      )
      .replace(
        "**Requirements:** AUTH-01, TREF-01, TREF-02, TREF-03",
        "**Requirements:** AUTH-01, PDEF-01, TREF-01, TREF-02, TREF-03",
      ),
  );
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 1,
    stdout: "",
    stderr:
      "phase-requirements: PHASE-03: roadmap membership differs from sealed requirement routes\n" +
      "phase-requirements: PHASE-04: roadmap membership differs from sealed requirement routes\n" +
      "requirement-route-contract: PDEF-01: traceability route/status differs from sealed requirement contract\n",
  });

  await writeFile(path.join(projectRoot, roadmapPath), roadmap);
  const ggatRow = traceabilityRow(requirements, "GGAT-02");
  assert.ok(ggatRow.includes("formerly Phase 7"), "GGAT-02 no longer records a former Phase 7");
  await writeFile(
    path.join(projectRoot, requirementsPath),
    requirements.replace(ggatRow, ggatRow.replace("formerly Phase 7", "formerly Phase 8")),
  );
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 1,
    stdout: "",
    stderr:
      "requirement-route-contract: GGAT-02: traceability route/status differs from sealed requirement contract\n",
  });

  const hiddenRow = traceabilityRow(requirements, "CLOSE-02");
  await writeFile(
    path.join(projectRoot, requirementsPath),
    requirements.replace(
      hiddenRow,
      ["```md", "hidden contract", "    ```", hiddenRow, "```"].join("\n"),
    ),
  );
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 1,
    stdout: "",
    stderr:
      "missing-requirement-route: CLOSE-02: traceability row is absent\n" +
      "phase-requirements: PHASE-09: roadmap membership differs from traceability\n",
  });

  await writeFile(path.join(projectRoot, requirementsPath), requirements);
  await writeFile(
    path.join(projectRoot, roadmapPath),
    roadmap.replace(
      "**Requirements:** GGAT-01, GGAT-03, GGAT-04",
      "**Requirements:** GGAT-01, GGAT-03",
    ),
  );
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 1,
    stdout: "",
    stderr:
      "phase-requirements: PHASE-07: roadmap membership differs from sealed requirement routes\n",
  });

  // A roadmap heading renamed together with the ledger anchor that is supposed
  // to attest it. The two mutable inputs still agree with each other, so only a
  // seal held outside both of them reports the rename (D-20, D-23).
  const titleDrift = JSON.parse(scopeLedger);
  const driftedRoute = titleDrift.scopeChanges.find(
    (change) => change.id === "SCOPE-ROUTE-PHASE-08",
  );
  assert.ok(driftedRoute);
  driftedRoute.beforeAnchor = driftedRoute.beforeAnchor.replace(
    "Phase 8 Direct Coverage",
    "Phase 8 Coverage Drift",
  );
  driftedRoute.afterAnchor = driftedRoute.afterAnchor.replace(
    "Phase 8 Direct Coverage",
    "Phase 8 Coverage Drift",
  );
  assert.ok(driftedRoute.afterAnchor.includes("Phase 8 Coverage Drift"), "route anchor unchanged");
  const driftedRoadmap = roadmap.replace(
    "### Phase 8: Direct Coverage",
    "### Phase 8: Coverage Drift",
  );
  assert.notStrictEqual(driftedRoadmap, roadmap, "roadmap heading unchanged");
  await writeFile(path.join(projectRoot, ledgerPath), `${JSON.stringify(titleDrift, null, 2)}\n`);
  await writeFile(path.join(projectRoot, roadmapPath), driftedRoadmap);
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 1,
    stdout: "",
    stderr:
      "phase-title-contract: PHASE-08: roadmap phase title differs from sealed phase contract\n" +
      "scope-after-anchor: SCOPE-ROUTE-PHASE-08: afterAnchor does not resolve to phase\n",
  });

  // A canonical action swapped for another legal member of the closed set, with
  // neither planning document touched (D-19, D-21).
  await writeFile(path.join(projectRoot, roadmapPath), roadmap);
  const actionDrift = JSON.parse(scopeLedger);
  const driftedRow = actionDrift.scopeChanges.find((change) => change.id === "SCOPE-REQ-PDEF-01");
  assert.ok(driftedRow);
  assert.strictEqual(driftedRow.action, "narrow/split");
  driftedRow.action = "keep";
  await writeFile(path.join(projectRoot, ledgerPath), `${JSON.stringify(actionDrift, null, 2)}\n`);
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 1,
    stdout: "",
    stderr:
      "scope-action-contract: SCOPE-REQ-PDEF-01: canonical action differs from sealed scope contract\n",
  });

  // The revert half of both plants: restoring the benign bytes returns the exact
  // success line, so the seals are what rejected the two plants above and not
  // some unrelated breakage in the copied contracts.
  await writeFile(path.join(projectRoot, ledgerPath), scopeLedger);
  assert.deepStrictEqual(invokeCli(projectRoot, ["scope-impact", "--check"]), {
    status: 0,
    stdout: "Scope impact valid: 40 records.\n",
    stderr: "",
  });

  process.stdout.write("Revalidation negative controls passed.\n");
} finally {
  await rm(projectRoot, { recursive: true, force: true });
  await rm(outsideRoot, { recursive: true, force: true });
}
