import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { changedFiles, planChecks, runChecks } from "./check-changed.mjs";

const root = mkdtempSync(path.join(tmpdir(), "pi-cm-changed-"));
const source = (name) => `extensions/pi-claude-marketplace/${name}.ts`;
const test = (name) => `tests/${name}.test.ts`;

function write(file, contents) {
  const absolute = path.join(root, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

function git(...args) {
  const child = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  return child.stdout.trim();
}

try {
  write(
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" } }),
  );
  write(source("leaf"), 'export type Mode = "a";');
  write(
    source("middle"),
    'export type { Mode } from "./leaf.ts"; import type { Extra } from "./top.ts";',
  );
  write(source("top"), 'import type { Mode } from "./middle.ts"; export type Extra = Mode;');
  write(source("other"), "export const other = 1;");
  for (const name of ["leaf", "middle", "top", "other"]) {
    write(test(name), "export {};");
  }

  // Re-exports, type-only consumers, and cycles must reach their owner tests.
  const focused = planChecks(root, [source("leaf")]);
  assert.equal(focused.scope, "focused");
  assert.deepEqual(focused.commands.at(-1), [
    "node",
    "--test",
    "--test-concurrency=4",
    test("middle"),
    test("top"),
  ]);
  assert.deepEqual(
    focused.commands.find((command) => command[1] === "node_modules/eslint/bin/eslint.js"),
    [
      "node",
      "node_modules/eslint/bin/eslint.js",
      source("leaf"),
      source("middle"),
      source("top"),
      test("leaf"),
      test("middle"),
      test("top"),
    ],
  );
  assert.deepEqual(
    focused.commands.find((command) => command[1] === "scripts/test-coverage-direct.mjs"),
    ["node", "scripts/test-coverage-direct.mjs", source("leaf")],
  );
  const testOnly = planChecks(root, [test("leaf")]);
  assert.equal(testOnly.scope, "focused");
  assert.equal(
    testOnly.commands.some((command) => command.includes(test("middle"))),
    false,
  );
  const paired = planChecks(root, [source("leaf"), test("leaf")]);
  assert.deepEqual(paired.commands.slice(1), focused.commands.slice(1));

  for (const file of [
    "tests/shared/fake.ts",
    "tests/domain/fixture.json",
    "tests/scripts/gate.test.ts",
    "package-lock.json",
    "tsconfig.json",
    "scripts/check-changed.mjs",
    "docs/output-catalog.md",
    "unclassified.txt",
    source("removed"),
  ]) {
    const broad = planChecks(root, [file]);
    assert.equal(broad.scope, "full", file);
    assert.deepEqual(broad.commands, [
      ["npm", "run", "check"],
      ["npm", "run", "test:coverage:direct:all"],
    ]);
  }

  assert.deepEqual(
    planChecks(root, [".planning/STATE.md", "skills/local-verification/SKILL.md"]).commands,
    [],
  );
  assert.equal(planChecks(root, [".planning/config.json"]).scope, "full");
  assert.deepEqual(planChecks(root, ["tests/e2e/changed.test.ts"]).commands.at(-1), [
    "npm",
    "run",
    "test:e2e",
  ]);
  assert.equal(planChecks(root, [source("leaf"), "package.json"]).scope, "full");

  write(source("other"), 'export const other = import("./missing.ts");');
  assert.equal(planChecks(root, [source("leaf")]).scope, "full");
  write(source("other"), 'const name = "./leaf.ts"; export const other = import(name);');
  assert.equal(planChecks(root, [source("leaf")]).scope, "full");
  write(source("other"), 'export const other = import("./leaf.ts");');
  assert.ok(
    planChecks(root, [source("leaf")])
      .commands.at(-1)
      .includes(test("other")),
  );
  write(source("other"), 'import { readFile } from "node:fs"; export const other = readFile;');
  assert.equal(planChecks(root, [source("leaf")]).scope, "focused");
  rmSync(path.join(root, test("top")));
  assert.equal(planChecks(root, [source("leaf")]).scope, "full");
  write(test("top"), "export {};");

  assert.throws(() => changedFiles(root), /git rev-parse failed/);
  git("init", "-b", "features/fixture");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("add", ".");
  git("commit", "-m", "test: seed fixture");
  const base = git("rev-parse", "HEAD");
  assert.deepEqual(changedFiles(root), []);
  write(source("leaf"), 'export type Mode = "a" | "b";');
  git("add", source("leaf"));
  // Include the index even if the worktree restores the old bytes.
  write(source("leaf"), 'export type Mode = "a";');
  git("mv", source("middle"), source("renamed middle"));
  rmSync(path.join(root, source("other")));
  write("untracked with spaces.txt", "untracked");
  write("untracked\nnewline.txt", "untracked");
  assert.deepEqual(
    changedFiles(root),
    [
      source("leaf"),
      source("middle"),
      source("other"),
      source("renamed middle"),
      "untracked\nnewline.txt",
      "untracked with spaces.txt",
    ].sort(),
  );
  assert.equal(planChecks(root, changedFiles(root)).scope, "full");
  git("add", ".");
  git("commit", "-m", "test: change fixture");
  assert.deepEqual(changedFiles(root), []);
  assert.ok(changedFiles(root, base).includes(source("other")));
  assert.throws(() => changedFiles(root, "missing-ref"), /git rev-parse failed/);
  assert.throws(() => changedFiles(root, "--help"), /git rev-parse failed/);

  runChecks(root, [["node", "-e", 'require("node:fs").writeFileSync("passed", "yes")']]);
  assert.equal(readFileSync(path.join(root, "passed"), "utf8"), "yes");
  assert.throws(
    () =>
      runChecks(root, [
        ["node", "-e", "process.exit(7)"],
        ["node", "-e", 'require("node:fs").writeFileSync("should-not-run", "no")'],
      ]),
    /exit 7/,
  );
  assert.equal(existsSync(path.join(root, "should-not-run")), false);
  assert.throws(
    () => runChecks(root, [["node", "-e", 'process.kill(process.pid, "SIGTERM")']]),
    /signal SIGTERM/,
  );
  process.stdout.write(
    "Changed-check controls passed: dependency selection, broad fallbacks, git paths, and child failures.\n",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
