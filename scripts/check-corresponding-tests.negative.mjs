import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkCorrespondingTests } from "./check-corresponding-tests.mjs";

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "corresponding-tests-gate-"));
const sourceDirectory = path.join(fixtureRoot, "extensions/pi-claude-marketplace/domain");
const testDirectory = path.join(fixtureRoot, "tests/domain");
const sourcePath = path.join(sourceDirectory, "answer.ts");
const testPath = path.join(testDirectory, "answer.test.ts");

try {
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(testDirectory, { recursive: true });
  await writeFile(sourcePath, "export const answer = 42;\n");
  await writeFile(
    testPath,
    'import { answer } from "../../extensions/pi-claude-marketplace/domain/answer.ts";\nvoid answer;\n',
  );

  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), []);

  await unlink(testPath);
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "missing-test", path: "tests/domain/answer.test.ts" },
  ]);

  await writeFile(testPath, 'import assert from "node:assert/strict";\nvoid assert;\n');
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "wrong-import", path: "tests/domain/answer.test.ts" },
  ]);

  await writeFile(
    testPath,
    'import { answer } from "../../extensions/pi-claude-marketplace/domain/answer.ts";\nvoid answer;\n',
  );
  await writeFile(path.join(testDirectory, "extra.test.ts"), "export {};\n");
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "unexpected-test", path: "tests/domain/extra.test.ts" },
  ]);

  process.stdout.write("Corresponding-test negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
