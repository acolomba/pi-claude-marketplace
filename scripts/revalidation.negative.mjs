import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { renderRevalidation, validateLedger } from "./revalidation.mjs";

const projectRoot = await mkdtemp(path.join(tmpdir(), "revalidation-negative-"));
try {
  const corpusPath = ".planning/reviews/unit-test-adversarial/control.md";
  await mkdir(path.dirname(path.join(projectRoot, corpusPath)), { recursive: true });
  await writeFile(path.join(projectRoot, corpusPath), "benign evidence\n");
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

  const canonical = renderRevalidation(benign);
  assert.notStrictEqual(`${canonical}tampered\n`, canonical);
  process.stdout.write("Revalidation negative controls passed.\n");
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
