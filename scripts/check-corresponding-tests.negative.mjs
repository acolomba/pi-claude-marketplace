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
const barrelPath = path.join(sourceDirectory, "index.ts");
const barrelTestPath = path.join(testDirectory, "index.test.ts");
// One text, two meanings, decided by which test file holds it: it is a direct pair import for
// tests/domain/index.test.ts, and a proxy import for tests/domain/answer.test.ts.
const barrelImportTest = `import { answer } from "../../extensions/pi-claude-marketplace/domain/index.ts";
void answer;
`;
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
  const extraTestPath = path.join(testDirectory, "extra.test.ts");
  await writeFile(extraTestPath, "export {};\n");
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "unexpected-test", path: "tests/domain/extra.test.ts" },
  ]);
  await unlink(extraTestPath);

  // A barrel beside the pair, plus its own owner test, so the tree stays clean while the barrel
  // exists. The two plants below then separate an owner that reaches its pair through that barrel
  // from an owner that reaches it through nothing at all.
  await writeFile(barrelPath, 'export { answer } from "./answer.ts";\n');
  await writeFile(barrelTestPath, barrelImportTest);
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), []);

  await writeFile(testPath, barrelImportTest);
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "proxy-owned", path: "tests/domain/answer.test.ts" },
  ]);

  await writeFile(testPath, 'import assert from "node:assert/strict";\nvoid assert;\n');
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "wrong-import", path: "tests/domain/answer.test.ts" },
  ]);

  // The proxy lookup reads the modules the owner imports. An import that resolves to no file, and
  // one that resolves to a directory, must each yield a verdict rather than a read that throws.
  await writeFile(testPath, 'import { answer } from "./missing.ts";\nvoid answer;\n');
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "wrong-import", path: "tests/domain/answer.test.ts" },
  ]);

  await mkdir(path.join(testDirectory, "proxy.ts"));
  await writeFile(testPath, 'import { answer } from "./proxy.ts";\nvoid answer;\n');
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "wrong-import", path: "tests/domain/answer.test.ts" },
  ]);

  process.stdout.write("Corresponding-test negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
