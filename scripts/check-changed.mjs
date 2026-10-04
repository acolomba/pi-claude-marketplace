import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import ts from "typescript";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const productionRoot = "extensions/pi-claude-marketplace/";
const npm = (script) => ["npm", "run", script];
const fullChecks = (files) => [
  npm("check"),
  ...(files.some((file) => file.startsWith("tests/e2e/")) ? [npm("test:e2e")] : []),
];
const testRun = ["node", "--test", "--test-concurrency=4"];
const prettierCheck = [
  "node",
  "node_modules/prettier/bin/prettier.cjs",
  "--check",
  "--cache",
  "--cache-strategy",
  "content",
];

/**
 * Inputs that tests read as data. Each runs only its reader tests. Every other
 * `.planning/` path and skill Markdown file is exempt, so the negative control's
 * real-tree guard fails when a test reads a `.planning` path missing here.
 */
export const DATA_READERS = new Map([
  [".planning/config.json", ["tests/scripts/gsd-discuss-integration.test.ts"]],
  [
    ".planning/milestones/refine-unit-tests-phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md",
    [
      "tests/architecture/gate-targets.test.ts",
      "tests/architecture/unowned-exports-census.test.ts",
    ],
  ],
  [
    "skills/claude-code-compat-research/SKILL.md",
    ["tests/scripts/gsd-discuss-integration.test.ts"],
  ],
]);

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
export function changedFiles(root, base = "HEAD") {
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
    throw new Error("Computed module imports require full verification");
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

function isInstruction(file) {
  return (
    file.startsWith(".planning/") ||
    (file.startsWith("skills/") && file.endsWith(".md")) ||
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

/** First match wins; `full` is also the fallback for unrecognized inputs. */
const rules = [
  [(file) => DATA_READERS.has(file), "reader"],
  [isInstruction, "none"],
  [isDocumentation, "documentation"],
  [(file, root) => !existsSync(path.join(root, file)), "full"],
  [isPair, "pair"],
  [(file) => /^tests\/(e2e|live-uat)\//.test(file), "full"],
  [(file) => file.startsWith("tests/") && file.endsWith(".test.ts"), "unpairedTest"],
  [(file) => file.startsWith("tests/") && file.endsWith(".ts"), "support"],
  [(file) => file.startsWith("tests/"), "fixture"],
  [(file) => typeMemberData.has(file), "typeMembers"],
  [(file, root) => analyzerTest(file, root) !== undefined, "analyzer"],
];

function classify(file, root) {
  return rules.find(([matches]) => matches(file, root))?.[1] ?? "full";
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
    controls: new Set(),
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

/** Commit-time checks never run e2e tests, so the walk drops e2e files as the full path does. */
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

function selectReaders(context, file, selection) {
  const readers = DATA_READERS.get(file);
  if (readers.some((reader) => !existsSync(path.join(context.root, reader)))) {
    return true;
  }

  for (const reader of readers) {
    selection.tests.add(reader);
  }

  selection.reasons.add("Data read by tests");
  return false;
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
  const name = file.slice("scripts/".length, -".mjs".length);
  const control = `scripts/${name}.negative.mjs`;
  selection.format.add(file);
  selection.lint.add(file);
  selection.lint.add(analyzerTest(file, context.root));
  selection.fallow = true;
  selection.suites.add("test:analyzers");
  if (existsSync(path.join(context.root, control))) {
    selection.controls.add(control);
  } else if (name.endsWith(".negative")) {
    selection.controls.add(file);
  }

  selection.reasons.add("Analyzer scripts and their tests");
  return false;
}

const selectors = {
  reader: selectReaders,
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

/** Assembles commands in one fixed order; suites already cover their own test files. */
function assembleCommands(selection) {
  const format = [...selection.format].filter(isFormatted).sort();
  const tests = [...selection.tests]
    .filter((file) => !selection.suites.has(containingSuite(file)))
    .sort();
  return [
    ...(format.length > 0 ? [[...prettierCheck, ...format]] : []),
    ...(selection.typecheck ? [npm("typecheck")] : []),
    ...(selection.lint.size > 0
      ? [["node", "node_modules/eslint/bin/eslint.js", ...[...selection.lint].sort()]]
      : []),
    ...(selection.fallow ? [npm("fallow")] : []),
    ...(selection.corresponding ? [npm("test:corresponding")] : []),
    ...(selection.coverage.size > 0
      ? [["node", "scripts/test-coverage-direct.mjs", ...[...selection.coverage].sort()]]
      : []),
    ...(selection.typeMembers ? [npm("lint:type-members")] : []),
    ...suiteCommands(selection),
    ...[...selection.controls].sort().map((control) => ["node", control]),
    ...(tests.length > 0 ? [[...testRun, ...tests]] : []),
  ];
}

function fullPlan(changed, triggers) {
  const more = triggers.length > 5 ? ` and ${triggers.length - 5} more` : "";
  return {
    scope: "full",
    reason: `Full check required by ${triggers.slice(0, 5).join(", ")}${more}`,
    commands: fullChecks(changed),
  };
}

function selectChecks(root, changed) {
  const inputs = changed
    .map((file) => [file, classify(file, root)])
    .filter(([, kind]) => kind !== "none");
  if (inputs.length === 0) {
    return { scope: "none", reason: "No executable inputs changed", commands: [] };
  }

  const triggers = inputs.filter(([, kind]) => kind === "full").map(([file]) => file);
  if (triggers.length > 0) {
    return fullPlan(changed, triggers);
  }

  const selection = emptySelection();
  const pairs = inputs.filter(([, kind]) => kind === "pair").map(([file]) => file);
  if (pairs.length > 0) {
    selectPairs(root, pairs, selection);
  }

  const context = { root, tree: undefined };
  for (const [file, kind] of inputs) {
    if (kind !== "pair" && selectors[kind](context, file, selection)) {
      triggers.push(file);
    }
  }

  if (triggers.length > 0) {
    return fullPlan(changed, triggers);
  }

  return {
    scope: "focused",
    reason: [...selection.reasons].join("; "),
    commands: assembleCommands(selection),
  };
}

/** Plans feedback checks. Unknown inputs broaden; a focused pass is never a full verdict. */
export function planChecks(root, changed) {
  try {
    return selectChecks(root, changed);
  } catch (error) {
    return { scope: "full", reason: error.message, commands: fullChecks(changed) };
  }
}

/** Runs sequential checks and propagates process failures, including signals. */
export function runChecks(root, commands) {
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

function main() {
  const { values } = parseArgs({
    options: { base: { type: "string", default: "HEAD" }, list: { type: "boolean" } },
  });
  const files = changedFiles(projectRoot, values.base);
  const plan = planChecks(projectRoot, files);
  process.stdout.write(`${JSON.stringify({ base: values.base, files, ...plan }, null, 2)}\n`);
  if (!values.list) {
    runChecks(projectRoot, plan.commands);
    process.stdout.write(
      plan.scope === "focused"
        ? "Focused checks passed; full completion verification is still required.\n"
        : "Checks passed.\n",
    );
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
