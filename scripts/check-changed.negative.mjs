import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  acquireFullLock,
  appendRunLog,
  changedFiles,
  planChecks,
  runChecks,
} from "./check-changed.mjs";

const root = mkdtempSync(path.join(tmpdir(), "pi-cm-changed-"));
const lockRoot = mkdtempSync(path.join(tmpdir(), "pi-cm-changed-lock-"));
const source = (name) => `extensions/pi-claude-marketplace/${name}.ts`;
const test = (name) => `tests/${name}.test.ts`;
const typeMemberData = [
  "scripts/check-unused-type-members.contracts.json",
  "scripts/check-unused-type-members.exceptions.json",
];
const run = (script) => ["npm", "run", script];
const testRun = (...files) => [
  "node",
  "--test",
  "--test-reporter=./scripts/test-reporter.mjs",
  "--test-concurrency=4",
  ...files,
];
const eslint = (...files) => [
  "node",
  "node_modules/eslint/bin/eslint.js",
  "--cache",
  "--cache-strategy",
  "content",
  "--cache-location",
  "node_modules/.cache/eslint/",
  ...files,
];
const prettier = (...files) => [
  "node",
  "node_modules/prettier/bin/prettier.cjs",
  "--check",
  "--cache",
  "--cache-strategy",
  "content",
  ...files,
];
const broad = [
  run("format:check"),
  run("typecheck"),
  run("lint"),
  run("lint:workflows"),
  run("fallow"),
  run("test:corresponding"),
];
const coverage = (...files) => ["node", "scripts/test-coverage-direct.mjs", ...files];
const gateControl = ["node", "scripts/gate.negative.mjs"];
const commandsFor = (files) => planChecks(root, files).commands;

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

  for (const file of [
    "tests/architecture/arch.test.ts",
    "tests/orphan.ts",
    "tests/scripts/gate.test.ts",
    "tests/scripts/gate.negative.test.ts",
    "tests/scripts/gate.helper.test.ts",
  ]) {
    write(file, "export {};");
  }

  write("tests/shared/fake.ts", "export const fake = 1;");
  write("tests/shared/chain.ts", 'export * from "./fake.ts";');
  write("tests/shared/consumer.test.ts", 'import { fake } from "./chain.ts"; void fake;');
  write("tests/e2e/flow.test.ts", 'import { fake } from "../shared/fake.ts"; void fake;');
  write("tests/integration/worker.ts", "export {};");
  write("tests/integration/spawner.test.ts", 'export const child = "worker.ts";');
  write("tests/integration/lonely.ts", "export {};");
  write("tests/domain/fixture.json", "{}");
  write("tests/fixtures/shared.json", "{}");
  write("tests/live-uat/canary.mjs", "export {};");
  for (const file of [
    "scripts/gate.mjs",
    "scripts/gate.negative.mjs",
    "scripts/gate.helper.mjs",
    "scripts/gate.pin.mjs",
    "scripts/tool.mjs",
    "scripts/check-changed.mjs",
    "eslint.config.js",
  ]) {
    write(file, "export {};");
  }

  for (const file of [
    ...typeMemberData,
    "package.json",
    "package-lock.json",
    ".fallowrc.json",
    ".prettierrc.json",
    "rule-packs/architecture.json",
    "tsconfig.build.json",
    "schema/settings.json",
  ]) {
    write(file, "{}");
  }

  for (const file of [".prettierignore", ".nvmrc", ".node-version"]) {
    write(file, "line\n");
  }

  write(".github/workflows/ci.yml", "on: push\n");
  write("unclassified.txt", "unclassified");

  // Re-exports, type-only consumers, and cycles must reach their owner tests.
  const focused = planChecks(root, [source("leaf")]);
  assert.equal(focused.scope, "focused");
  assert.deepEqual(focused.commands.at(-1), testRun(test("middle"), test("top")));
  assert.deepEqual(
    focused.commands.find((command) => command[1] === "node_modules/eslint/bin/eslint.js"),
    eslint(
      source("leaf"),
      source("middle"),
      source("top"),
      test("leaf"),
      test("middle"),
      test("top"),
    ),
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

  // `.planning` data and skill or instruction Markdown select no checks.
  const exempt = planChecks(root, [
    ".planning/state.json",
    ".planning/HANDOFF.json",
    ".planning/notify-corpus/run.jsonl",
    ".planning/STATE.md",
    "skills/local-verification/SKILL.md",
    ".agents/skills/babysit-pr/SKILL.md",
    ".claude/commands/merge-dependabot-prs.md",
    "AGENTS.md",
    ".planning/config.json",
    "skills/claude-code-compat-research/SKILL.md",
  ]);
  assert.equal(exempt.scope, "none");
  assert.deepEqual(exempt.commands, []);
  assert.equal(planChecks(root, [".claude/settings.json"]).scope, "broad");

  for (const file of [
    "docs/output-catalog.md",
    "docs/prd/spec.md",
    "README.md",
    "README.es.md",
    "CHANGELOG.md",
  ]) {
    assert.deepEqual(commandsFor([file]), [run("test:architecture")], file);
  }

  for (const file of typeMemberData) {
    assert.deepEqual(commandsFor([file]), [prettier(file), run("lint:type-members")], file);
  }

  const arch = "tests/architecture/arch.test.ts";
  assert.deepEqual(commandsFor([arch]), [
    prettier(arch),
    run("typecheck"),
    eslint(arch),
    run("fallow"),
    run("test:corresponding"),
    testRun(arch),
  ]);
  // Re-exports reach consumer tests; e2e consumers are dropped.
  assert.deepEqual(commandsFor(["tests/shared/fake.ts"]), [
    prettier("tests/shared/fake.ts"),
    run("typecheck"),
    eslint("tests/shared/chain.ts", "tests/shared/consumer.test.ts", "tests/shared/fake.ts"),
    run("fallow"),
    run("test:corresponding"),
    testRun("tests/shared/consumer.test.ts"),
  ]);
  // A helper named only by file name, as a spawned child is, reaches its spawner.
  assert.deepEqual(
    commandsFor(["tests/integration/worker.ts"]).at(-1),
    testRun("tests/integration/spawner.test.ts"),
  );
  assert.deepEqual(commandsFor(["tests/integration/lonely.ts"]), [
    prettier("tests/integration/lonely.ts"),
    run("typecheck"),
    eslint("tests/integration/lonely.ts"),
    run("fallow"),
    run("test:corresponding"),
    run("test:integration"),
  ]);
  assert.deepEqual(commandsFor(["tests/domain/fixture.json"]), [
    prettier("tests/domain/fixture.json"),
    run("typecheck"),
    run("test:architecture"),
    run("test:modules"),
  ]);
  assert.deepEqual(commandsFor(["scripts/gate.mjs"]), [
    prettier("scripts/gate.mjs"),
    eslint("scripts/gate.mjs", "tests/scripts/gate.test.ts"),
    run("fallow"),
    run("test:analyzers"),
    gateControl,
  ]);
  assert.deepEqual(commandsFor(["scripts/gate.negative.mjs"]), [
    prettier("scripts/gate.negative.mjs"),
    eslint("scripts/gate.negative.mjs", "tests/scripts/gate.negative.test.ts"),
    run("fallow"),
    run("test:analyzers"),
    gateControl,
  ]);

  // A checker's helper modules and its control select the checker's control,
  // once, in focused and broad plans alike.
  assert.deepEqual(commandsFor(["scripts/gate.helper.mjs"]), [
    prettier("scripts/gate.helper.mjs"),
    eslint("scripts/gate.helper.mjs", "tests/scripts/gate.helper.test.ts"),
    run("fallow"),
    run("test:analyzers"),
    gateControl,
  ]);
  assert.deepEqual(commandsFor(["scripts/gate.mjs", "scripts/gate.helper.mjs"]), [
    prettier("scripts/gate.helper.mjs", "scripts/gate.mjs"),
    eslint(
      "scripts/gate.helper.mjs",
      "scripts/gate.mjs",
      "tests/scripts/gate.helper.test.ts",
      "tests/scripts/gate.test.ts",
    ),
    run("fallow"),
    run("test:analyzers"),
    gateControl,
  ]);
  // A checker helper without its own test runs the narrow checks plus its control.
  const pin = planChecks(root, ["scripts/gate.pin.mjs"]);
  assert.equal(pin.scope, "focused");
  assert.deepEqual(pin.commands, [
    prettier("scripts/gate.pin.mjs"),
    eslint("scripts/gate.pin.mjs"),
    run("fallow"),
    gateControl,
  ]);
  const removedHelper = planChecks(root, ["scripts/gate.removed.mjs"]);
  assert.equal(removedHelper.scope, "broad");
  assert.deepEqual(removedHelper.commands, [...broad, gateControl]);
  assert.deepEqual(commandsFor(["package.json", "scripts/gate.pin.mjs"]), [
    ...broad,
    run("check:controls"),
  ]);
  assert.deepEqual(commandsFor(["tests/e2e/changed.test.ts", "scripts/gate.pin.mjs"]), [
    ...broad,
    gateControl,
  ]);

  // Rules union in fixed order; a test that a selected suite covers runs once, in the suite.
  const withArch = (command, prefix) => [
    ...command.slice(0, prefix),
    ...[...command.slice(prefix), arch].sort(),
  ];
  assert.deepEqual(commandsFor([source("leaf"), "docs/output-catalog.md", arch]), [
    withArch(focused.commands[0], prettier().length),
    focused.commands[1],
    withArch(focused.commands[2], eslint().length),
    ...focused.commands.slice(3, -1),
    run("test:architecture"),
    focused.commands.at(-1),
  ]);

  // A toolchain change runs every control after the broad check.
  const toolchainInputs = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "eslint.config.js",
    ".fallowrc.json",
    ".prettierrc.json",
    ".prettierignore",
    "rule-packs/architecture.json",
    ".nvmrc",
    ".node-version",
  ];
  for (const file of toolchainInputs) {
    assert.deepEqual(commandsFor([file]), [...broad, run("check:controls")], file);
  }

  const broadInputs = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "eslint.config.js",
    ".fallowrc.json",
    ".prettierrc.json",
    "rule-packs/architecture.json",
    ".github/workflows/ci.yml",
    "scripts/check-changed.mjs",
    "scripts/tool.mjs",
    "unclassified.txt",
    source("removed"),
    "tests/shared/removed.ts",
    "tests/orphan.ts",
    "tests/live-uat/canary.mjs",
    "tests/fixtures/shared.json",
  ];
  for (const file of broadInputs) {
    const plan = planChecks(root, [file]);
    assert.equal(plan.scope, "broad", file);
    assert.deepEqual(
      plan.commands,
      toolchainInputs.includes(file) ? [...broad, run("check:controls")] : broad,
      file,
    );
  }

  assert.equal(
    planChecks(root, broadInputs).reason,
    "Broad check required by package.json, package-lock.json, tsconfig.json, eslint.config.js, .fallowrc.json and 11 more",
  );
  assert.equal(planChecks(root, ["schema/settings.json"]).scope, "broad");
  assert.deepEqual(commandsFor(["schema/settings.json"]), broad);
  assert.deepEqual(commandsFor(["docs/output-catalog.md", "unclassified.txt"]), [
    ...broad,
    run("test:architecture"),
  ]);
  assert.deepEqual(commandsFor(["tests/e2e/changed.test.ts"]), broad);
  assert.deepEqual(commandsFor([source("leaf"), "package.json"]), [
    ...broad,
    coverage(source("leaf")),
    run("check:controls"),
    testRun(test("middle"), test("top")),
  ]);

  // The broad check never runs member analysis or the integration suite, even
  // when another rule selected them.
  assert.deepEqual(commandsFor([typeMemberData[0], "package.json"]), [
    ...broad,
    run("check:controls"),
  ]);
  assert.deepEqual(commandsFor(["tests/integration/lonely.ts", "schema/settings.json"]), broad);

  write(source("other"), 'export const other = import("./missing.ts");');
  assert.equal(planChecks(root, [source("leaf")]).scope, "broad");
  // The selection-error fallback keeps the family control.
  assert.deepEqual(commandsFor([source("leaf"), "scripts/gate.helper.mjs"]), [
    ...broad,
    gateControl,
  ]);
  write(source("other"), 'const name = "./leaf.ts"; export const other = import(name);');
  const computed = planChecks(root, [source("leaf")]);
  assert.equal(computed.scope, "broad");
  assert.equal(computed.reason, "Computed module imports require broad verification");
  write(source("other"), 'export const other = import("./leaf.ts");');
  assert.ok(
    planChecks(root, [source("leaf")])
      .commands.at(-1)
      .includes(test("other")),
  );
  write(source("other"), 'import { readFile } from "node:fs"; export const other = readFile;');
  assert.equal(planChecks(root, [source("leaf")]).scope, "focused");
  rmSync(path.join(root, test("top")));
  assert.equal(planChecks(root, [source("leaf")]).scope, "broad");
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
  // Each run appends one ordered nine-key record; a failed write only warns.
  const warnings = [];
  const warn = (message) => warnings.push(message);
  const record = {
    timestamp: new Date().toISOString(),
    scope: "focused",
    reason: "Unpaired tests",
    fileCount: 1,
    durationMs: 5,
    exitStatus: 0,
    lockWaitMs: 0,
  };
  appendRunLog(root, record, warn);
  appendRunLog(root, record, warn);
  const logFile = path.join(root, ".git", "check-changed.log");
  const logLines = readFileSync(logFile, "utf8").trimEnd().split("\n");
  assert.equal(logLines.length, 2);
  for (const line of logLines) {
    const entry = JSON.parse(line);
    assert.deepEqual(Object.keys(entry), [
      "timestamp",
      "worktree",
      "branch",
      "scope",
      "reason",
      "fileCount",
      "durationMs",
      "exitStatus",
      "lockWaitMs",
    ]);
    assert.equal(entry.branch, "features/fixture");
    assert.equal(entry.worktree, path.resolve(root));
  }

  assert.deepEqual(warnings, []);
  rmSync(logFile);
  mkdirSync(logFile);
  appendRunLog(root, record, warn);
  assert.equal(warnings.length, 1);
  appendRunLog(lockRoot, record, warn);
  assert.equal(warnings.length, 2);
  for (const warning of warnings) {
    assert.match(warning, /^check-changed: run log not written/);
  }

  rmSync(logFile, { recursive: true });

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
  assert.equal(planChecks(root, changedFiles(root)).scope, "broad");
  git("add", ".");
  git("commit", "-m", "test: change fixture");
  assert.deepEqual(changedFiles(root), []);
  assert.ok(changedFiles(root, base).includes(source("other")));
  assert.throws(() => changedFiles(root, "missing-ref"), /git rev-parse failed/);
  assert.throws(() => changedFiles(root, "--help"), /git rev-parse failed/);

  // The full-run lock: fresh acquire, recovery from dead, expired, and ownerless
  // holders, waiting on a live holder, and release that never frees another owner.
  const lockDir = path.join(lockRoot, "check-changed-full.lock");
  const ownerFile = path.join(lockDir, "owner.json");
  const readLockOwner = () => JSON.parse(readFileSync(ownerFile, "utf8"));
  const plantOwner = (owner) => {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(ownerFile, JSON.stringify({ worktree: "planted", ...owner }));
  };

  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

  const fresh = acquireFullLock(lockRoot);
  assert.equal(readLockOwner().pid, process.pid);
  fresh.release();
  assert.equal(existsSync(lockDir), false);

  const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
  assert.throws(() => process.kill(deadPid, 0));
  plantOwner({ pid: deadPid, startedAt: Date.now() });
  const afterDead = acquireFullLock(lockRoot);
  assert.equal(readLockOwner().pid, process.pid);
  afterDead.release();

  plantOwner({ pid: process.pid, startedAt: twoHoursAgo });
  const afterExpired = acquireFullLock(lockRoot);
  assert.equal(readLockOwner().pid, process.pid);
  afterExpired.release();

  mkdirSync(lockDir);
  utimesSync(lockDir, new Date(twoHoursAgo), new Date(twoHoursAgo));
  const afterOwnerless = acquireFullLock(lockRoot);
  assert.equal(readLockOwner().pid, process.pid);
  afterOwnerless.release();
  assert.equal(existsSync(lockDir), false);

  const holderCode = [
    `import { acquireFullLock } from ${JSON.stringify(new URL("./check-changed.mjs", import.meta.url).href)};`,
    "const lock = acquireFullLock(process.argv[1]);",
    "setTimeout(() => lock.release(), 1500);",
  ].join("\n");
  const holder = spawn(process.execPath, ["--input-type=module", "-e", holderCode, lockRoot], {
    stdio: "ignore",
  });
  const holderExit = once(holder, "exit");
  const deadline = Date.now() + 10_000;
  while (!existsSync(ownerFile)) {
    assert.ok(Date.now() < deadline, "the live holder never took the lock");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }

  const waiter = acquireFullLock(lockRoot, { pollMs: 20 });
  assert.ok(waiter.waitedMs >= 500, `waited only ${waiter.waitedMs} ms`);
  assert.equal(readLockOwner().pid, process.pid);
  waiter.release();
  await holderExit;

  const replaced = acquireFullLock(lockRoot);
  plantOwner({ pid: process.pid, startedAt: 0 });
  replaced.release();
  assert.equal(existsSync(lockDir), true);
  rmSync(lockDir, { recursive: true, force: true });

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
    "Changed-check controls passed: dependency selection, targeted rules and their union, broad plans with targeted tests and exclusions, checker and toolchain controls, git paths, child failures, the full-run lock, and the run log.\n",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
  rmSync(lockRoot, { recursive: true, force: true });
}
