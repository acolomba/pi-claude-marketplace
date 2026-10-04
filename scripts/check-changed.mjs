import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import ts from "typescript";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const productionRoot = "extensions/pi-claude-marketplace/";
const npm = (script) => ["npm", "run", script];
/**
 * The broad check runs whole-repository static checks, each cached or
 * incremental; unit coverage, the integration suite, member analysis, and e2e
 * tests wait for `npm run check`.
 */
const broadChecks = [
  npm("format:check"),
  npm("typecheck"),
  npm("lint"),
  npm("lint:workflows"),
  npm("fallow"),
  npm("test:corresponding"),
];
const testRun = [
  "node",
  "--test",
  "--test-reporter=./scripts/test-reporter.mjs",
  "--test-concurrency=4",
];
const prettierCheck = [
  "node",
  "node_modules/prettier/bin/prettier.cjs",
  "--check",
  "--cache",
  "--cache-strategy",
  "content",
];
/**
 * Shares the cache of `npm run lint`. Typed rules can leave a stale cached
 * pass, so CI lints from an empty cache.
 */
const eslintCheck = [
  "node",
  "node_modules/eslint/bin/eslint.js",
  "--cache",
  "--cache-strategy",
  "content",
  "--cache-location",
  "node_modules/.cache/eslint/",
];

/** Only `npm run lint:type-members` reads these; the analyzer tests build their own copies. */
const typeMemberData = new Set([
  "scripts/check-unused-type-members.contracts.json",
  "scripts/check-unused-type-members.exceptions.json",
]);

/** Suite scripts in command order, with the test paths their package.json globs cover. */
const suites = [
  ["test:architecture", ["tests/architecture/"]],
  ["test:analyzers", ["tests/scripts/"]],
  [
    "test:modules",
    [
      "tests/bridges/",
      "tests/domain/",
      "tests/edge/",
      "tests/orchestrators/",
      "tests/persistence/",
      "tests/platform/",
      "tests/shared/",
      "tests/transaction/",
      "tests/index.test.ts",
    ],
  ],
  ["test:integration", ["tests/integration/"]],
];

function git(root, args) {
  const child = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (child.error) {
    throw child.error;
  }

  if (child.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${child.stderr.trim()}`);
  }

  return child.stdout;
}

/** Includes both sides of renames, deletions, index changes, and untracked paths. */
function changedFiles(root, base = "HEAD") {
  const commit = git(root, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${base}^{commit}`,
  ]).trim();
  const ancestor = git(root, ["merge-base", commit, "HEAD"]).trim();
  const paths = [
    git(root, ["diff", "--name-only", "--no-renames", "-z", ancestor, "--"]),
    git(root, ["diff", "--cached", "--name-only", "--no-renames", "-z", "--"]),
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ];
  return [...new Set(paths.flatMap((names) => names.split("\0").filter(Boolean)))].sort();
}

function ownerTest(source) {
  return `tests/${source.slice(productionRoot.length, -3)}.test.ts`;
}

function sourceForTest(testPath) {
  return `${productionRoot}${testPath.slice("tests/".length, -".test.ts".length)}.ts`;
}

function isPair(file, root) {
  const source = file.startsWith(productionRoot) ? file : sourceForTest(file);
  return (
    file.endsWith(".ts") &&
    (file.startsWith(productionRoot) || (file.startsWith("tests/") && file.endsWith(".test.ts"))) &&
    existsSync(path.join(root, source)) &&
    existsSync(path.join(root, ownerTest(source)))
  );
}

function hasComputedImport(node) {
  if (
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))
  ) {
    if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0])) {
      return true;
    }
  }

  return ts.forEachChild(node, hasComputedImport) === true;
}

function moduleDependencies(file, options) {
  const source = readFileSync(file, "utf8");
  if (hasComputedImport(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true))) {
    throw new Error("Computed module imports require broad verification");
  }

  return ts
    .preProcessFile(source, true, true)
    .importedFiles.filter((imported) => !isBuiltin(imported.fileName))
    .map((imported) => {
      const resolved = ts.resolveModuleName(
        imported.fileName,
        file,
        options,
        ts.sys,
      ).resolvedModule;
      if (!resolved) {
        throw new Error(`Cannot resolve ${imported.fileName} from ${file}`);
      }

      return path.resolve(resolved.resolvedFileName);
    });
}

/** Finds production consumers through imports, re-exports, and type references. */
function affectedSources(root, changed) {
  const absoluteRoot = path.join(root, productionRoot);
  const files = readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(entry.parentPath, entry.name));
  const compiler = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  if (compiler.error) {
    throw new Error("Cannot read TypeScript configuration");
  }

  const config = ts.parseJsonConfigFileContent(compiler.config, ts.sys, root);
  if (config.errors.length > 0) {
    throw new Error("Cannot resolve TypeScript configuration");
  }

  const consumers = new Map();
  for (const file of files) {
    for (const dependency of moduleDependencies(file, config.options)) {
      const readers = consumers.get(dependency) ?? new Set();
      readers.add(file);
      consumers.set(dependency, readers);
    }
  }

  const affected = new Set(changed.map((file) => path.join(root, file)));
  for (const file of affected) {
    for (const consumer of consumers.get(file) ?? []) {
      affected.add(consumer);
    }
  }

  return [...affected].map((file) => path.relative(root, file).split(path.sep).join("/")).sort();
}

/** Planning records and agent instruction Markdown select no checks: no test reads them. */
function isInstruction(file) {
  return (
    file.startsWith(".planning/") ||
    (/^(skills|\.agents|\.claude)\//.test(file) && file.endsWith(".md")) ||
    ["AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md"].includes(file)
  );
}

function isDocumentation(file) {
  return (
    (file.startsWith("docs/") && file.endsWith(".md")) ||
    /^README(\.[a-z]{2,3}(-[A-Za-z0-9]+)*)?\.md$/.test(file) ||
    file === "CHANGELOG.md"
  );
}

function isFormatted(file) {
  return /\.(js|json|ts)$/.test(file) || /^scripts\/.*\.mjs$/.test(file);
}

function containingSuite(file) {
  return suites.find(([, prefixes]) => prefixes.some((prefix) => file.startsWith(prefix)))?.[0];
}

/** Returns the `tests/scripts` test that owns an analyzer script, if one exists. */
function analyzerTest(file, root) {
  const match = /^scripts\/([^/]+)\.mjs$/.exec(file);
  const test = match && `tests/scripts/${match[1]}.test.ts`;
  return test && existsSync(path.join(root, test)) ? test : undefined;
}

/** First match wins; `broad` is also the fallback for unrecognized inputs. */
const rules = [
  [isInstruction, "none"],
  [isDocumentation, "documentation"],
  [(file, root) => !existsSync(path.join(root, file)), "broad"],
  [isPair, "pair"],
  [(file) => /^tests\/(e2e|live-uat)\//.test(file), "broad"],
  [(file) => file.startsWith("tests/") && file.endsWith(".test.ts"), "unpairedTest"],
  [(file) => file.startsWith("tests/") && file.endsWith(".ts"), "support"],
  [(file) => file.startsWith("tests/"), "fixture"],
  [(file) => typeMemberData.has(file), "typeMembers"],
  [(file, root) => analyzerTest(file, root) !== undefined, "analyzer"],
];

function classify(file, root) {
  return rules.find(([matches]) => matches(file, root))?.[1] ?? "broad";
}

function emptySelection() {
  return {
    format: new Set(),
    typecheck: false,
    lint: new Set(),
    fallow: false,
    corresponding: false,
    coverage: new Set(),
    typeMembers: false,
    suites: new Set(),
    tests: new Set(),
    reasons: new Set(),
  };
}

/** The checks every edited TypeScript test input needs before its tests run. */
function selectStatic(selection, file, lintFiles) {
  selection.format.add(file);
  selection.typecheck = true;
  for (const lintFile of lintFiles) {
    selection.lint.add(lintFile);
  }

  selection.fallow = true;
  selection.corresponding = true;
}

function selectPairs(root, files, selection) {
  const paired = [
    ...new Set(files.map((file) => (file.startsWith(productionRoot) ? file : sourceForTest(file)))),
  ].sort();
  const sourceEdits = files.filter((file) => file.startsWith(productionRoot));
  const affected = [
    ...new Set([...paired, ...(sourceEdits.length > 0 ? affectedSources(root, sourceEdits) : [])]),
  ].sort();
  const consumerTests = affected.filter((file) => !paired.includes(file)).map(ownerTest);
  if (consumerTests.some((file) => !existsSync(path.join(root, file)))) {
    throw new Error("A consumer has no owner test");
  }

  for (const file of files) {
    selectStatic(selection, file, []);
  }

  for (const file of [...affected, ...affected.map(ownerTest)]) {
    selection.lint.add(file);
  }

  for (const file of paired) {
    selection.coverage.add(file);
  }

  for (const file of consumerTests) {
    selection.tests.add(file);
  }

  selection.reasons.add("Changed pairs and their production consumers");
}

function toProjectPath(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

/** Reads every TypeScript file under `tests/` once, with its resolved relative imports. */
function readTestTree(root) {
  const testsRoot = path.join(root, "tests");
  const files = existsSync(testsRoot)
    ? readdirSync(testsRoot, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
        .map((entry) => toProjectPath(root, path.join(entry.parentPath, entry.name)))
    : [];
  return files.map((file) => {
    const text = readFileSync(path.join(root, file), "utf8");
    const imports = new Set(
      ts
        .preProcessFile(text, true, true)
        .importedFiles.map((imported) => imported.fileName)
        .filter((specifier) => specifier.startsWith("./") || specifier.startsWith("../"))
        .map((specifier) => path.posix.join(path.posix.dirname(file), specifier)),
    );
    return { file, text, imports };
  });
}

function namesFile(text, name) {
  for (let index = text.indexOf(name); index !== -1; index = text.indexOf(name, index + 1)) {
    if (index === 0 || !/[\w.-]/.test(text[index - 1])) {
      return true;
    }
  }

  return false;
}

/**
 * Consumers import the file or name it: integration children are spawned by
 * path, and some tests build import specifiers at run time.
 */
function consumersOf(tree, target) {
  const name = path.posix.basename(target);
  return tree
    .filter(
      ({ file, text, imports }) =>
        file !== target && (imports.has(target) || namesFile(text, name)),
    )
    .map(({ file }) => file);
}

/** Commit-time checks never run e2e tests, so the walk drops e2e files. */
function walkSupport(tree, start) {
  const reached = new Set();
  const queue = [start];
  for (const file of queue) {
    for (const consumer of consumersOf(tree, file)) {
      if (consumer === start || consumer.startsWith("tests/e2e/") || reached.has(consumer)) {
        continue;
      }

      reached.add(consumer);
      if (!consumer.endsWith(".test.ts")) {
        queue.push(consumer);
      }
    }
  }

  return [...reached].sort();
}

/** Documentation pins live in architecture tests only. */
function selectDocumentation(_context, _file, selection) {
  selection.suites.add("test:architecture");
  selection.reasons.add("Documentation");
  return false;
}

function selectUnpairedTest(_context, file, selection) {
  selectStatic(selection, file, [file]);
  selection.tests.add(file);
  selection.reasons.add("Unpaired tests");
  return false;
}

function selectSupport(context, file, selection) {
  context.tree ??= readTestTree(context.root);
  const reached = walkSupport(context.tree, file);
  const tests = reached.filter((reachedFile) => reachedFile.endsWith(".test.ts"));
  const suite = containingSuite(file);
  if (tests.length === 0 && suite === undefined) {
    return true;
  }

  selectStatic(selection, file, [file, ...reached]);
  for (const test of tests) {
    selection.tests.add(test);
  }

  if (tests.length === 0) {
    selection.suites.add(suite);
  }

  selection.reasons.add("Test support and its consumers");
  return false;
}

/** An architecture test reads a modules fixture, so fixtures also run that suite. */
function selectFixture(_context, file, selection) {
  const suite = containingSuite(file);
  if (suite === undefined) {
    return true;
  }

  selection.format.add(file);
  selection.typecheck = true;
  selection.suites.add(suite);
  selection.suites.add("test:architecture");
  selection.reasons.add("Test fixtures");
  return false;
}

function selectTypeMembers(_context, file, selection) {
  selection.format.add(file);
  selection.typeMembers = true;
  selection.reasons.add("Type-member contract data");
  return false;
}

/**
 * The analyzer tests load scripts through computed imports, so no static graph
 * names a script's other consumers; the whole analyzer suite runs instead.
 */
function selectAnalyzer(context, file, selection) {
  selection.format.add(file);
  selection.lint.add(file);
  selection.lint.add(analyzerTest(file, context.root));
  selection.fallow = true;
  selection.suites.add("test:analyzers");
  selection.reasons.add("Analyzer scripts and their tests");
  return false;
}

const selectors = {
  documentation: selectDocumentation,
  unpairedTest: selectUnpairedTest,
  support: selectSupport,
  fixture: selectFixture,
  typeMembers: selectTypeMembers,
  analyzer: selectAnalyzer,
};

function suiteCommands(selection) {
  return suites.filter(([suite]) => selection.suites.has(suite)).map(([suite]) => npm(suite));
}

/** Static checks in one fixed order. */
function staticCommands(selection) {
  const format = [...selection.format].filter(isFormatted).sort();
  return [
    ...(format.length > 0 ? [[...prettierCheck, ...format]] : []),
    ...(selection.typecheck ? [npm("typecheck")] : []),
    ...(selection.lint.size > 0 ? [[...eslintCheck, ...[...selection.lint].sort()]] : []),
    ...(selection.fallow ? [npm("fallow")] : []),
    ...(selection.corresponding ? [npm("test:corresponding")] : []),
  ];
}

/** Test commands in one fixed order; suites already cover their own test files. */
function testCommands(selection) {
  const tests = [...selection.tests]
    .filter((file) => !selection.suites.has(containingSuite(file)))
    .sort();
  return [
    ...(selection.coverage.size > 0
      ? [["node", "scripts/test-coverage-direct.mjs", ...[...selection.coverage].sort()]]
      : []),
    ...(selection.typeMembers ? [npm("lint:type-members")] : []),
    ...suiteCommands(selection),
    ...(tests.length > 0 ? [[...testRun, ...tests]] : []),
  ];
}

/**
 * The broad commands cover every static selection. The broad check never runs
 * member analysis or the integration suite, even when another rule selected them.
 */
function broadPlan(triggers, selection) {
  selection.typeMembers = false;
  selection.suites.delete("test:integration");
  const more = triggers.length > 5 ? ` and ${triggers.length - 5} more` : "";
  return {
    scope: "broad",
    reason: `Broad check required by ${triggers.slice(0, 5).join(", ")}${more}`,
    commands: [...broadChecks, ...testCommands(selection)],
  };
}

function selectChecks(root, changed) {
  const inputs = changed
    .map((file) => [file, classify(file, root)])
    .filter(([, kind]) => kind !== "none");
  if (inputs.length === 0) {
    return { scope: "none", reason: "No executable inputs changed", commands: [] };
  }

  const triggers = inputs.filter(([, kind]) => kind === "broad").map(([file]) => file);
  const selection = emptySelection();
  const pairs = inputs.filter(([, kind]) => kind === "pair").map(([file]) => file);
  if (pairs.length > 0) {
    selectPairs(root, pairs, selection);
  }

  const context = { root, tree: undefined };
  for (const [file, kind] of inputs) {
    if (kind !== "pair" && kind !== "broad" && selectors[kind](context, file, selection)) {
      triggers.push(file);
    }
  }

  if (triggers.length > 0) {
    return broadPlan(triggers, selection);
  }

  return {
    scope: "focused",
    reason: [...selection.reasons].join("; "),
    commands: [...staticCommands(selection), ...testCommands(selection)],
  };
}

/**
 * Plans commit-time checks. Unknown inputs broaden to the broad check; no plan
 * runs `npm run check`, and a focused or broad pass is never a full verdict.
 */
function planChecks(root, changed) {
  try {
    return selectChecks(root, changed);
  } catch (error) {
    return {
      scope: "broad",
      reason: error.message,
      commands: [...broadChecks],
    };
  }
}

/** Runs sequential checks and propagates process failures, including signals. */
function runChecks(root, commands) {
  for (const [executable, ...args] of commands) {
    process.stdout.write(
      `Checking: ${[executable, ...args].map((arg) => JSON.stringify(arg)).join(" ")}\n`,
    );
    const child = spawnSync(executable === "node" ? process.execPath : executable, args, {
      cwd: root,
      stdio: "inherit",
    });
    if (child.error) {
      throw child.error;
    }

    if (child.status !== 0) {
      throw new Error(
        `Check failed: ${executable} (exit ${child.status}, signal ${child.signal ?? "none"})`,
      );
    }
  }
}

const FULL_LOCK_STALE_MS = 60 * 60 * 1000;
const FULL_LOCK_POLL_MS = 2000;

function gitCommonDir(root) {
  return path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

/** Returns the new owner record, or undefined when another process holds the lock. */
function tryCreateLock(lockDir) {
  try {
    mkdirSync(lockDir);
  } catch (error) {
    if (error.code === "EEXIST") {
      return undefined;
    }

    throw error;
  }

  const owner = { pid: process.pid, startedAt: Date.now(), worktree: path.resolve(projectRoot) };
  writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify(owner));
  return owner;
}

function readOwner(lockDir) {
  try {
    const owner = JSON.parse(readFileSync(path.join(lockDir, "owner.json"), "utf8"));
    return typeof owner.startedAt === "number" ? owner : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A holder without a readable owner ages from the lock directory's mtime, so a
 * lock whose owner is still being written is never stolen. Returns undefined
 * when the lock vanished.
 */
function readHolder(lockDir) {
  const owner = readOwner(lockDir);
  if (owner !== undefined) {
    return owner;
  }

  try {
    return {
      pid: undefined,
      startedAt: statSync(lockDir).mtimeMs,
      worktree: "an unknown worktree",
    };
  } catch {
    return undefined;
  }
}

function isStale(holder, staleMs) {
  return (
    Date.now() - holder.startedAt > staleMs ||
    (typeof holder.pid === "number" && !isAlive(holder.pid))
  );
}

function releaseLock(lockDir, owner) {
  const current = readOwner(lockDir);
  if (current?.pid === owner.pid && current.startedAt === owner.startedAt) {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

/**
 * Serializes broad runs across worktrees with an mkdir lock on `node:fs`.
 * proper-lockfile has no dead-pid recovery, and it refreshes staleness from
 * timers that cannot fire while spawnSync blocks the event loop for a whole
 * broad check. A dead pid or an age past `staleMs` frees the lock, so waiting
 * needs no time limit.
 */
function acquireFullLock(
  parentDir,
  { staleMs = FULL_LOCK_STALE_MS, pollMs = FULL_LOCK_POLL_MS } = {},
) {
  const lockDir = path.join(parentDir, "check-changed-full.lock");
  const started = Date.now();
  let announced = false;
  for (;;) {
    const owner = tryCreateLock(lockDir);
    if (owner !== undefined) {
      return {
        waitedMs: Date.now() - started,
        release: () => {
          try {
            releaseLock(lockDir, owner);
          } catch {
            // Releasing must never fail a run; a leftover lock goes stale.
          }
        },
      };
    }

    const holder = readHolder(lockDir);
    if (holder === undefined || isStale(holder, staleMs)) {
      rmSync(lockDir, { recursive: true, force: true });
      continue;
    }

    if (!announced) {
      process.stdout.write(
        `Waiting for the broad check running in ${holder.worktree} (pid ${holder.pid ?? "unknown"})\n`,
      );
      announced = true;
    }

    sleepSync(pollMs);
  }
}

function currentBranch(root) {
  try {
    return git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  } catch {
    return null;
  }
}

/** Appends one JSON line per run to the shared log. Logging never fails a run. */
function appendRunLog(root, run, warn = (message) => process.stderr.write(`${message}\n`)) {
  try {
    const record = {
      timestamp: run.timestamp,
      worktree: path.resolve(root),
      branch: currentBranch(root),
      scope: run.scope,
      reason: run.reason,
      fileCount: run.fileCount,
      durationMs: run.durationMs,
      exitStatus: run.exitStatus,
      lockWaitMs: run.lockWaitMs,
    };
    appendFileSync(
      path.join(gitCommonDir(root), "check-changed.log"),
      `${JSON.stringify(record)}\n`,
    );
  } catch (error) {
    warn(
      `check-changed: run log not written: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const passMessages = {
  none: "Checks passed.\n",
  focused: "Focused checks passed; full completion verification is still required.\n",
  broad: "Broad checks passed; full completion verification is still required.\n",
};

function main() {
  const startedAt = Date.now();
  const { values } = parseArgs({
    options: { base: { type: "string", default: "HEAD" }, list: { type: "boolean" } },
  });
  const files = changedFiles(projectRoot, values.base);
  const plan = planChecks(projectRoot, files);
  process.stdout.write(`${JSON.stringify({ base: values.base, files, ...plan }, null, 2)}\n`);
  if (values.list) {
    return;
  }

  let exitStatus = 1;
  let lock;
  try {
    if (plan.scope === "broad") {
      lock = acquireFullLock(gitCommonDir(projectRoot));
    }

    runChecks(projectRoot, plan.commands);
    exitStatus = 0;
    process.stdout.write(passMessages[plan.scope]);
  } finally {
    lock?.release();
    appendRunLog(projectRoot, {
      timestamp: new Date(startedAt).toISOString(),
      scope: plan.scope,
      reason: plan.reason,
      fileCount: files.length,
      durationMs: Date.now() - startedAt,
      exitStatus,
      lockWaitMs: lock?.waitedMs ?? 0,
    });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
