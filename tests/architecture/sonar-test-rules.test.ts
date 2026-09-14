import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { ESLint } from "eslint";

import { REPO_ROOT } from "./source-scan.ts";

const ASSERTION_RULES = [
  "sonarjs/assertions-in-tests",
  "sonarjs/no-empty-test-file",
  "sonarjs/no-trivial-assertions",
] as const;
const RUNTIME_OWNER = "tests/edge/args.test.ts";
const IMPORTS = 'import assert from "node:assert/strict";\nimport test from "node:test";\n';
const BENIGN_TEST = `${IMPORTS}test("compares a result", () => assert.strictEqual(process.env.VALUE, "expected"));\n`;

const OFFENDERS = [
  {
    rule: "sonarjs/assertions-in-tests",
    source: `${IMPORTS}test("missing assertion", () => { console.log("no assertion"); });\n`,
  },
  {
    rule: "sonarjs/no-empty-test-file",
    source: `${IMPORTS}export const marker = 1;\n`,
  },
  {
    rule: "sonarjs/no-trivial-assertions",
    source: `${IMPORTS}test("always succeeds", () => assert.strictEqual(true, true));\n`,
  },
] as const;

for (const { rule, source } of OFFENDERS) {
  test(`${rule} rejects its offender and accepts a real assertion`, async () => {
    // arrange
    const eslint = new ESLint({ overrideConfigFile: path.join(REPO_ROOT, "eslint.config.js") });

    // act
    const offender = await eslint.lintText(source, { filePath: RUNTIME_OWNER });
    const benign = await eslint.lintText(BENIGN_TEST, { filePath: RUNTIME_OWNER });

    // assert
    assert.deepStrictEqual(
      offender.flatMap((result) => result.messages.filter((m) => m.fatal)),
      [],
    );
    assert.deepStrictEqual(
      offender.flatMap((result) =>
        result.messages
          .filter((message) => ASSERTION_RULES.some((name) => name === message.ruleId))
          .map(({ ruleId, severity }) => ({ ruleId, severity })),
      ),
      [{ ruleId: rule, severity: 2 }],
    );
    assert.deepStrictEqual(
      benign.flatMap((result) =>
        result.messages.filter(
          (message) =>
            message.fatal === true || ASSERTION_RULES.some((name) => name === message.ruleId),
        ),
      ),
      [],
    );
  });

  test(`${rule} control detects a later override disabling the rule`, async () => {
    // arrange
    const eslint = new ESLint({
      overrideConfigFile: path.join(REPO_ROOT, "eslint.config.js"),
      overrideConfig: [{ files: ["tests/**/*.ts"], rules: { [rule]: "off" } }],
    });

    // act
    const results = await eslint.lintText(source, { filePath: RUNTIME_OWNER });

    // assert
    assert.deepStrictEqual(
      results.flatMap((result) => result.messages.filter((m) => m.fatal)),
      [],
    );
    assert.deepStrictEqual(
      results.flatMap((result) => result.messages.filter((message) => message.ruleId === rule)),
      [],
    );
  });
}

const TYPE_ONLY_OWNERS = [
  "tests/bridges/agents/types.test.ts",
  "tests/bridges/commands/types.test.ts",
  "tests/bridges/hooks/exec-result.test.ts",
  "tests/bridges/mcp/types.test.ts",
  "tests/bridges/skills/types.test.ts",
  "tests/domain/resolver-types.test.ts",
  "tests/edge/types.test.ts",
  "tests/orchestrators/import/types.test.ts",
  "tests/orchestrators/types.test.ts",
];

for (const filePath of TYPE_ONLY_OWNERS) {
  test(`${filePath} permits compile-time proofs without runtime cases`, async () => {
    // arrange
    const eslint = new ESLint({ overrideConfigFile: path.join(REPO_ROOT, "eslint.config.js") });
    const source = 'type Item = { value: string };\nvoid ({ value: "item" } satisfies Item);\n';
    const withoutException = new ESLint({
      overrideConfigFile: path.join(REPO_ROOT, "eslint.config.js"),
      overrideConfig: [{ files: [filePath], rules: { "sonarjs/no-empty-test-file": "error" } }],
    });

    // act
    const results = await eslint.lintText(source, { filePath });
    const control = await withoutException.lintText(source, { filePath });

    // assert
    assert.deepStrictEqual(
      results.flatMap((result) =>
        result.messages.filter(
          (message) => message.fatal === true || message.ruleId === "sonarjs/no-empty-test-file",
        ),
      ),
      [],
    );
    assert.deepStrictEqual(
      control.flatMap((result) =>
        result.messages
          .filter(
            (message) => message.fatal === true || message.ruleId === "sonarjs/no-empty-test-file",
          )
          .map(({ ruleId, severity }) => ({ ruleId, severity })),
      ),
      [{ ruleId: "sonarjs/no-empty-test-file", severity: 2 }],
    );
  });
}
