import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const productionRoot = "extensions/pi-claude-marketplace";
const testRoot = "tests";
const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);

function toProjectPath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function filesBelow(projectRoot, relativeRoot, predicate) {
  const absoluteRoot = path.join(projectRoot, relativeRoot);

  if (!existsSync(absoluteRoot)) {
    throw new Error(`Required directory does not exist: ${relativeRoot}`);
  }

  return readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => toProjectPath(projectRoot, path.join(entry.parentPath, entry.name)))
    .sort();
}

function expectedTestPath(sourcePath) {
  const relativePath = sourcePath.slice(`${productionRoot}/`.length, -3);
  return `${testRoot}/${relativePath}.test.ts`;
}

function expectedSourcePath(testPath) {
  const relativePath = testPath.slice(`${testRoot}/`.length, -".test.ts".length);
  return `${productionRoot}/${relativePath}.ts`;
}

function isCorrespondingTestCandidate(testPath) {
  const relativePath = testPath.slice(`${testRoot}/`.length);
  const firstSegment = relativePath.split("/", 1)[0];
  return !nonCorrespondingRoots.has(firstSegment);
}

function supplementalCompanions(testPath) {
  const match = testPath.match(/^tests\/(domain|platform)\/(.+)-fake\.test\.ts$/);
  if (match === null) {
    return undefined;
  }

  const [, concern, relativeName] = match;
  const prefix = `tests/${concern}/${relativeName}`;
  return {
    contractPath: `${prefix}-contract.ts`,
    fakePath: `${prefix}-fake.ts`,
  };
}

function importedPaths(projectRoot, testPath) {
  const absoluteTestPath = path.join(projectRoot, testPath);
  const sourceFile = ts.createSourceFile(
    testPath,
    readFileSync(absoluteTestPath, "utf8"),
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS,
  );
  const paths = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) {
      continue;
    }

    if (statement.moduleSpecifier === undefined || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const specifier = statement.moduleSpecifier.text;

    if (!specifier.startsWith(".")) {
      continue;
    }

    const resolvedPath = path.resolve(path.dirname(absoluteTestPath), specifier);
    paths.push(toProjectPath(projectRoot, resolvedPath).replace(/\.js$/, ".ts"));
  }

  return paths;
}

function isStructuralSupplement(projectRoot, testPath) {
  const companions = supplementalCompanions(testPath);
  if (companions === undefined) {
    return false;
  }

  if (
    !existsSync(path.join(projectRoot, companions.fakePath)) ||
    !existsSync(path.join(projectRoot, companions.contractPath))
  ) {
    return false;
  }

  const imports = importedPaths(projectRoot, testPath);
  return imports.includes(companions.fakePath) && imports.includes(companions.contractPath);
}

export function checkCorrespondingTests(projectRoot = defaultProjectRoot) {
  const sourcePaths = filesBelow(projectRoot, productionRoot, (name) => name.endsWith(".ts"));
  const testPaths = filesBelow(projectRoot, testRoot, (name) => name.endsWith(".test.ts"));
  const sourceSet = new Set(sourcePaths);
  const testSet = new Set(testPaths);
  const violations = [];

  for (const sourcePath of sourcePaths) {
    const testPath = expectedTestPath(sourcePath);

    if (!testSet.has(testPath)) {
      violations.push({ kind: "missing-test", path: testPath });
      continue;
    }

    if (!importedPaths(projectRoot, testPath).includes(sourcePath)) {
      violations.push({ kind: "wrong-import", path: testPath });
    }
  }

  for (const testPath of testPaths.filter(isCorrespondingTestCandidate)) {
    if (isStructuralSupplement(projectRoot, testPath)) {
      continue;
    }

    const sourcePath = expectedSourcePath(testPath);

    if (!sourceSet.has(sourcePath)) {
      violations.push({ kind: "unexpected-test", path: testPath });
    }
  }

  return violations;
}

function parseProjectRoot(args) {
  if (args.length === 0) {
    return defaultProjectRoot;
  }

  if (args.length === 2 && args[0] === "--root") {
    return path.resolve(args[1]);
  }

  throw new Error("Pass no arguments or --root <project-path>");
}

function main() {
  const projectRoot = parseProjectRoot(process.argv.slice(2));
  const violations = checkCorrespondingTests(projectRoot);

  if (violations.length === 0) {
    process.stdout.write("Corresponding-test gate passed.\n");
    return;
  }

  for (const violation of violations) {
    process.stderr.write(`${violation.kind}: ${violation.path}\n`);
  }

  process.stderr.write(`Corresponding-test gate failed with ${violations.length} violation(s).\n`);
  process.exitCode = 1;
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
