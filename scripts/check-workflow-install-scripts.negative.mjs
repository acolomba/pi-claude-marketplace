import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkWorkflowInstallScripts } from "./check-workflow-install-scripts.mjs";

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "workflow-install-scripts-gate-"));
const workflowDirectory = path.join(fixtureRoot, ".github/workflows");
const workflowPath = path.join(workflowDirectory, "planted.yml");
const yamlWorkflowPath = path.join(workflowDirectory, "planted.yaml");

function workflow(installCommand) {
  return `name: planted
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Install dependencies
        run: ${installCommand}
      - name: Build
        run: npm run build
`;
}

try {
  await mkdir(workflowDirectory, { recursive: true });

  // The plant: an install call with no --ignore-scripts, which is the violation.
  await writeFile(workflowPath, workflow("npm ci"));
  assert.deepStrictEqual(checkWorkflowInstallScripts(fixtureRoot), [
    { path: ".github/workflows/planted.yml", line: 8, text: "run: npm ci" },
  ]);

  // The same line with the flag: the gate must go quiet, so a green run means something.
  await writeFile(workflowPath, workflow("npm ci --ignore-scripts"));
  assert.deepStrictEqual(checkWorkflowInstallScripts(fixtureRoot), []);

  // The other two install spellings the gate claims to cover.
  await writeFile(workflowPath, workflow("npm install"));
  assert.deepStrictEqual(checkWorkflowInstallScripts(fixtureRoot), [
    { path: ".github/workflows/planted.yml", line: 8, text: "run: npm install" },
  ]);

  await writeFile(workflowPath, workflow("npm i"));
  assert.deepStrictEqual(checkWorkflowInstallScripts(fixtureRoot), [
    { path: ".github/workflows/planted.yml", line: 8, text: "run: npm i" },
  ]);

  await unlink(workflowPath);

  // A .yaml workflow is discovered too, so the extension is not a hole to hide an install in.
  await writeFile(yamlWorkflowPath, workflow("npm ci"));
  assert.deepStrictEqual(checkWorkflowInstallScripts(fixtureRoot), [
    { path: ".github/workflows/planted.yaml", line: 8, text: "run: npm ci" },
  ]);

  process.stdout.write("Workflow install-scripts negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
