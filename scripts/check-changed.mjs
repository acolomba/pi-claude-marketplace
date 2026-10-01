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
  npm("test:coverage:direct:all"),
  ...(files.some((file) => file.startsWith("tests/e2e/")) ? [npm("test:e2e")] : []),
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
    file.endsWith(".md") &&
    (file.startsWith(".planning/") ||
      file.startsWith("skills/") ||
      ["AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md"].includes(file))
  );
}

/** Plans feedback checks. Unknown inputs broaden; a focused pass is never a full verdict. */
export function planChecks(root, changed) {
  const files = changed.filter((file) => !isInstruction(file));
  if (files.length === 0) {
    return { scope: "none", reason: "No executable inputs changed", commands: [] };
  }

  if (!files.every((file) => isPair(file, root))) {
    return {
      scope: "full",
      reason: "Shared, removed, configuration, or unclassified inputs",
      commands: fullChecks(files),
    };
  }

  const paired = [
    ...new Set(files.map((file) => (file.startsWith(productionRoot) ? file : sourceForTest(file)))),
  ].sort();
  let affected;
  try {
    const sourceEdits = files.filter((file) => file.startsWith(productionRoot));
    affected = [
      ...new Set([
        ...paired,
        ...(sourceEdits.length > 0 ? affectedSources(root, sourceEdits) : []),
      ]),
    ].sort();
  } catch (error) {
    return { scope: "full", reason: error.message, commands: fullChecks(files) };
  }

  const consumerTests = affected.filter((file) => !paired.includes(file)).map(ownerTest);
  if (consumerTests.some((file) => !existsSync(path.join(root, file)))) {
    return { scope: "full", reason: "A consumer has no owner test", commands: fullChecks(files) };
  }

  const lintFiles = [...new Set([...affected, ...affected.map(ownerTest)])].sort();
  const commands = [
    [
      "node",
      "node_modules/prettier/bin/prettier.cjs",
      "--check",
      "--cache",
      "--cache-strategy",
      "content",
      ...files,
    ],
    npm("typecheck"),
    ["node", "node_modules/eslint/bin/eslint.js", ...lintFiles],
    npm("fallow"),
    npm("test:corresponding"),
    ["node", "scripts/test-coverage-direct.mjs", ...paired],
  ];
  if (consumerTests.length > 0) {
    commands.push(["node", "--test", "--test-concurrency=4", ...consumerTests]);
  }

  return { scope: "focused", reason: "Changed pairs and their production consumers", commands };
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
