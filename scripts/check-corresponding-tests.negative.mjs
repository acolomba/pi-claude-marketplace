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
const fakePath = path.join(testDirectory, "answer-fake.ts");
const contractPath = path.join(testDirectory, "answer-contract.ts");
const fakeTestPath = path.join(testDirectory, "answer-fake.test.ts");
const supplementalTest = `import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnswerFake } from "./answer-fake.ts";
import { registerAnswerContract } from "./answer-contract.ts";

test("connects the concern-local fake and contract", () => {
  // arrange
  const answer = createAnswerFake();

  // act
  const registered = registerAnswerContract(answer);

  // assert
  assert.strictEqual(registered, 42);
});
`;
const missingContractImportTest = `import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnswerFake } from "./answer-fake.ts";

test("looks like supplemental evidence without a contract import", () => {
  // arrange
  const answer = createAnswerFake();

  // act
  const calculatedAnswer = answer;

  // assert
  assert.strictEqual(calculatedAnswer, 42);
});
`;

try {
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(testDirectory, { recursive: true });
  await writeFile(sourcePath, "export const answer = 42;\n");
  await writeFile(
    testPath,
    'import { answer } from "../../extensions/pi-claude-marketplace/domain/answer.ts";\nvoid answer;\n',
  );
  await writeFile(fakePath, "export const createAnswerFake = () => 42;\n");
  await writeFile(contractPath, "export const registerAnswerContract = (answer) => answer;\n");
  await writeFile(fakeTestPath, supplementalTest);

  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), []);

  await unlink(contractPath);
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "unexpected-test", path: "tests/domain/answer-fake.test.ts" },
  ]);
  await writeFile(contractPath, "export const registerAnswerContract = (answer) => answer;\n");

  await unlink(fakePath);
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "unexpected-test", path: "tests/domain/answer-fake.test.ts" },
  ]);
  await writeFile(fakePath, "export const createAnswerFake = () => 42;\n");

  await writeFile(fakeTestPath, missingContractImportTest);
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "unexpected-test", path: "tests/domain/answer-fake.test.ts" },
  ]);
  await writeFile(fakeTestPath, supplementalTest);

  const lookalikePath = path.join(testDirectory, "answer-fakes.test.ts");
  await writeFile(lookalikePath, "export {};\n");
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "unexpected-test", path: "tests/domain/answer-fakes.test.ts" },
  ]);
  await unlink(lookalikePath);

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
