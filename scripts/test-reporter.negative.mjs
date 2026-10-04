import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import failureReporter from "./test-reporter.mjs";

const reporterPath = fileURLToPath(new URL("./test-reporter.mjs", import.meta.url));
const counts = (tests, pass, fail) =>
  [
    `tests ${tests}`,
    "suites 0",
    `pass ${pass}`,
    `fail ${fail}`,
    "cancelled 0",
    "skipped 0",
    "todo 0",
    "duration_ms 1.5",
  ].map((message) => ({ type: "test:diagnostic", data: { nesting: 0, message } }));

async function report(events) {
  let output = "";
  for await (const chunk of failureReporter(events)) {
    output += chunk;
  }

  return output;
}

// A passing run prints only the summary line.
assert.equal(
  await report([
    { type: "test:pass", data: { nesting: 0, name: "passes", details: { duration_ms: 1 } } },
    ...counts(1, 1, 0),
  ]),
  "tests 1, suites 0, pass 1, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 1.5\n",
);

// A coverage shortfall keeps Node's threshold message and names each short file.
const coverageOutput = await report([
  {
    type: "test:diagnostic",
    data: {
      nesting: 0,
      level: "error",
      message: "Error: 83.33% line coverage does not meet threshold of 100%.",
    },
  },
  {
    type: "test:coverage",
    data: {
      nesting: 0,
      summary: {
        workingDirectory: "/work",
        files: [
          {
            path: "/work/src/short.js",
            coveredLinePercent: 83.333,
            coveredBranchPercent: 100,
            coveredFunctionPercent: 100,
          },
          {
            path: "/work/src/full.js",
            coveredLinePercent: 100,
            coveredBranchPercent: 100,
            coveredFunctionPercent: 100,
          },
        ],
      },
    },
  },
  ...counts(1, 1, 0),
]);
assert.match(coverageOutput, /83\.33% line coverage does not meet threshold of 100%/);
assert.deepEqual(
  coverageOutput.split("\n").filter((line) => line.startsWith("coverage below threshold:")),
  ["coverage below threshold: src/short.js (line 83.33%)"],
);

const root = mkdtempSync(path.join(tmpdir(), "pi-cm-reporter-"));

function runTests(...args) {
  const child = spawnSync(
    process.execPath,
    ["--test", `--test-reporter=${reporterPath}`, ...args],
    { cwd: root, encoding: "utf8" },
  );
  return { status: child.status, output: `${child.stdout}${child.stderr}` };
}

try {
  writeFileSync(
    path.join(root, "pass.test.mjs"),
    'import { test } from "node:test";\ntest("first", () => {});\ntest("second", () => {});\n',
  );
  writeFileSync(
    path.join(root, "fail.test.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { describe, it } from "node:test";',
      'describe("group", () => {',
      '  it("compares lists", () => assert.deepEqual([1, 2], [1, 3]));',
      '  it("distinctive passing name", () => {});',
      "});",
      "",
    ].join("\n"),
  );
  writeFileSync(path.join(root, "broken.test.mjs"), 'import "./missing-module.mjs";\n');
  writeFileSync(
    path.join(root, "module.mjs"),
    'export function pick(flag) {\n  if (flag) {\n    return "yes";\n  }\n\n  return "no";\n}\n',
  );
  writeFileSync(
    path.join(root, "cover.test.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { test } from "node:test";',
      'import { pick } from "./module.mjs";',
      'test("covers one branch", () => assert.equal(pick(true), "yes"));',
      "",
    ].join("\n"),
  );

  const passing = runTests("pass.test.mjs");
  assert.equal(passing.status, 0, passing.output);
  assert.match(
    passing.output,
    /^tests 2, suites 0, pass 2, fail 0, cancelled 0, skipped 0, todo 0, duration_ms [\d.]+\n$/,
  );

  // A failure keeps Node's full report and still omits passing tests.
  const failing = runTests("fail.test.mjs");
  assert.equal(failing.status, 1, failing.output);
  for (const expected of [
    "failing tests:",
    "test at fail.test.mjs",
    "compares lists",
    "AssertionError",
    "+ actual - expected",
  ]) {
    assert.ok(failing.output.includes(expected), `missing ${expected}:\n${failing.output}`);
  }

  assert.equal(failing.output.includes("distinctive passing name"), false, failing.output);
  assert.match(failing.output.trimEnd().split("\n").at(-1), /pass 1, fail 1/);

  const broken = runTests("broken.test.mjs");
  assert.equal(broken.status, 1, broken.output);
  assert.ok(broken.output.includes("ERR_MODULE_NOT_FOUND"), broken.output);

  const lcovPath = path.join(root, "unit.lcov");
  const coverage = runTests(
    "--experimental-test-coverage",
    "--test-coverage-include=module.mjs",
    "--test-coverage-lines=100",
    "--test-coverage-branches=100",
    "--test-coverage-functions=100",
    "--test-reporter-destination=stdout",
    "--test-reporter=lcov",
    `--test-reporter-destination=${lcovPath}`,
    "cover.test.mjs",
  );
  assert.equal(coverage.status, 1, coverage.output);
  assert.ok(coverage.output.includes("coverage does not meet threshold of 100%"), coverage.output);
  assert.match(
    coverage.output,
    /^coverage below threshold: module\.mjs \(line [\d.]+%, branch [\d.]+%\)$/m,
  );
  assert.ok(readFileSync(lcovPath, "utf8").includes("SF:"));
  process.stdout.write(
    "Test reporter controls passed: summary line, failure report, load error, and coverage shortfall.\n",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
