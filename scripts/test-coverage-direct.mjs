import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const productionRoot = "extensions/pi-claude-marketplace";
const testRoot = "tests";

function toProjectPath(inputPath) {
  const absolutePath = path.resolve(projectRoot, inputPath);
  const projectPath = path.relative(projectRoot, absolutePath);

  if (projectPath.startsWith("..") || path.isAbsolute(projectPath)) {
    throw new Error(`Path is outside the project: ${inputPath}`);
  }

  return projectPath.split(path.sep).join("/");
}

function sourceToTest(sourcePath) {
  const prefix = `${productionRoot}/`;

  if (!sourcePath.startsWith(prefix) || !sourcePath.endsWith(".ts")) {
    throw new Error(`Not a production TypeScript path: ${sourcePath}`);
  }

  const relativePath = sourcePath.slice(prefix.length, -3);
  return `${testRoot}/${relativePath}.test.ts`;
}

function testToSource(testPath) {
  const prefix = `${testRoot}/`;
  const suffix = ".test.ts";

  if (!testPath.startsWith(prefix) || !testPath.endsWith(suffix)) {
    throw new Error(`Not a corresponding test path: ${testPath}`);
  }

  const relativePath = testPath.slice(prefix.length, -suffix.length);
  return `${productionRoot}/${relativePath}.ts`;
}

function pairForPath(inputPath) {
  const projectPath = toProjectPath(inputPath);
  let sourcePath;
  let testPath;

  if (projectPath.startsWith(`${productionRoot}/`)) {
    sourcePath = projectPath;
    testPath = sourceToTest(projectPath);
  } else if (projectPath.startsWith(`${testRoot}/`)) {
    testPath = projectPath;
    sourcePath = testToSource(projectPath);
  } else {
    throw new Error(`Path is not a source-test pair member: ${projectPath}`);
  }

  for (const pairPath of [sourcePath, testPath]) {
    if (!existsSync(path.join(projectRoot, pairPath))) {
      throw new Error(`Missing source-test pair member: ${pairPath}`);
    }
  }

  return { sourcePath, testPath };
}

function productionPaths() {
  const absoluteRoot = path.join(projectRoot, productionRoot);

  return readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => {
      const absolutePath = path.join(entry.parentPath, entry.name);
      return toProjectPath(absolutePath);
    })
    .sort();
}

function gitLines(args) {
  try {
    return execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function changedPaths() {
  const paths = new Set();
  const mergeBase = gitLines(["merge-base", "HEAD", "origin/main"])[0];

  if (mergeBase !== undefined) {
    for (const projectPath of gitLines([
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      `${mergeBase}...HEAD`,
    ])) {
      paths.add(projectPath);
    }
  }

  for (const args of [
    ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"],
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    for (const projectPath of gitLines(args)) {
      paths.add(projectPath);
    }
  }

  return [...paths].sort();
}

function pairsForChangedPaths() {
  const pairs = new Map();

  for (const projectPath of changedPaths()) {
    if (
      !projectPath.startsWith(`${productionRoot}/`) &&
      !(projectPath.startsWith(`${testRoot}/`) && projectPath.endsWith(".test.ts"))
    ) {
      continue;
    }

    const pair = pairForPath(projectPath);
    pairs.set(pair.sourcePath, pair);
  }

  return [...pairs.values()];
}

function parseLcov(lcovText) {
  return lcovText
    .split("end_of_record")
    .map((recordText) => {
      const fields = new Map();

      for (const line of recordText.split("\n")) {
        const separator = line.indexOf(":");

        if (separator === -1) {
          continue;
        }

        fields.set(line.slice(0, separator), line.slice(separator + 1));
      }

      return fields;
    })
    .filter((fields) => fields.has("SF"));
}

function isEmptyExport(statement) {
  return (
    ts.isExportDeclaration(statement) &&
    statement.moduleSpecifier === undefined &&
    statement.exportClause !== undefined &&
    ts.isNamedExports(statement.exportClause) &&
    statement.exportClause.elements.length === 0
  );
}

function isTypeOnlyModule(sourcePath, selectedProjectRoot = projectRoot) {
  const sourceText = readFileSync(path.join(selectedProjectRoot, sourcePath), "utf8");
  const outputText = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      removeComments: true,
      target: ts.ScriptTarget.ESNext,
    },
    fileName: sourcePath,
  }).outputText;
  const outputFile = ts.createSourceFile(
    sourcePath.replace(/\.ts$/, ".js"),
    outputText,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.JS,
  );

  return outputFile.statements.every(isEmptyExport);
}

function coverageCounts(record) {
  const number = (field) => Number.parseInt(record.get(field) ?? "-1", 10);

  return {
    branches: { found: number("BRF"), hit: number("BRH") },
    functions: { found: number("FNF"), hit: number("FNH") },
    lines: { found: number("LF"), hit: number("LH") },
  };
}

export function assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot) {
  const records = parseLcov(lcovText).filter(
    (record) => toProjectPath(record.get("SF")) === sourcePath,
  );

  if (records.length === 0 && isTypeOnlyModule(sourcePath, selectedProjectRoot)) {
    return "type-only";
  }

  if (records.length !== 1) {
    throw new Error(`Expected one LCOV record for ${sourcePath}, found ${records.length}`);
  }

  const counts = coverageCounts(records[0]);
  const incomplete = Object.entries(counts).filter(
    ([, count]) => count.found < 0 || count.hit !== count.found,
  );

  if (incomplete.length > 0) {
    const details = incomplete
      .map(([name, count]) => `${name} ${count.hit}/${count.found}`)
      .join(", ");
    throw new Error(`Incomplete direct coverage for ${sourcePath}: ${details}`);
  }

  return Object.entries(counts)
    .map(([name, count]) => `${name} ${count.hit}/${count.found}`)
    .join(", ");
}

function repeatedValues(records, field) {
  const seen = new Set();
  const repeated = new Set();

  for (const record of records) {
    if (seen.has(record[field])) {
      repeated.add(record[field]);
    }

    seen.add(record[field]);
  }

  return [...repeated].sort();
}

// The all-pair run is only a gate if it can say it visited every row. A run that quietly skipped one
// module would otherwise report the same success as a run that covered all of them.
//
// The round-trip check is also the honest answer to COV-02's remaining half. Path-level ambiguity --
// two production modules claiming one test, or one test claiming two modules -- is UNREACHABLE under
// the current one-to-one name mapping, so a check written to catch it could never fire and would
// prove nothing. What is assertable is the invariant that makes it unreachable: every row maps to its
// test and back to itself, and no two rows share either member.
export function assertReportComplete(records, modulePaths) {
  for (const field of ["sourcePath", "testPath"]) {
    const repeated = repeatedValues(records, field);

    if (repeated.length > 0) {
      throw new Error(`Repeated ${field} in the all-pair result: ${repeated.join(", ")}`);
    }
  }

  for (const record of records) {
    if (
      sourceToTest(record.sourcePath) !== record.testPath ||
      testToSource(record.testPath) !== record.sourcePath
    ) {
      throw new Error(
        `Mapping does not round-trip in the all-pair result: ${record.sourcePath} <-> ${record.testPath}`,
      );
    }
  }

  const visited = new Set(records.map((record) => record.sourcePath));
  const missing = modulePaths.filter((modulePath) => !visited.has(modulePath));

  if (missing.length > 0) {
    throw new Error(`Missing from the all-pair result: ${missing.join(", ")}`);
  }

  if (records.length !== modulePaths.length) {
    throw new Error(
      `Expected ${modulePaths.length} all-pair records, found ${records.length}`,
    );
  }
}

async function runPair({ sourcePath, testPath }) {
  const coverageDirectory = await mkdtemp(path.join(tmpdir(), "pi-claude-direct-"));
  const lcovPath = path.join(coverageDirectory, "pair.lcov");
  const startedAt = process.hrtime.bigint();

  try {
    const testRun = spawnSync(
      process.execPath,
      [
        "--test",
        "--experimental-test-coverage",
        "--test-reporter=spec",
        "--test-reporter-destination=stdout",
        "--test-reporter=lcov",
        `--test-reporter-destination=${lcovPath}`,
        testPath,
      ],
      { cwd: projectRoot, stdio: "inherit" },
    );

    if (testRun.status !== 0) {
      throw new Error(`Focused test failed: ${testPath}`);
    }

    const summary = assertCompleteCoverage(sourcePath, readFileSync(lcovPath, "utf8"));
    process.stdout.write(`Direct coverage passed: ${sourcePath} (${summary})\n`);

    return {
      sourcePath,
      testPath,
      coverage: summary,
      typeOnly: summary === "type-only",
      runtime: process.version,
      elapsedMs: Number((process.hrtime.bigint() - startedAt) / 1000000n),
    };
  } finally {
    await rm(coverageDirectory, { force: true, recursive: true });
  }
}

async function runAllPairs(reportPath) {
  const modulePaths = productionPaths();
  const pairs = modulePaths.map(pairForPath);
  const records = [];
  const startedAt = process.hrtime.bigint();

  // Line-oriented and written as each pair lands, so an interrupted run still leaves a readable
  // partial result and a later reader can diff two runs line by line.
  if (reportPath !== undefined) {
    writeFileSync(reportPath, "");
  }

  for (const pair of pairs) {
    const record = await runPair(pair);
    records.push(record);

    if (reportPath !== undefined) {
      appendFileSync(reportPath, `${JSON.stringify(record)}\n`);
    }
  }

  // Unconditional: a report is how the result is retained, not what makes the run a gate.
  assertReportComplete(records, modulePaths);

  const elapsedMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);

  process.stdout.write(
    `All-pair run complete: ${records.length} pairs in ${elapsedSeconds}s (${elapsedMs}ms) on ${process.version}\n`,
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === "--all") {
    await runAllPairs(undefined);
    return;
  }

  if (args.length === 3 && args[0] === "--all" && args[1] === "--report") {
    await runAllPairs(args[2]);
    return;
  }

  let pairs;

  if (args.length === 1) {
    pairs = [pairForPath(args[0])];
  } else if (args.length === 0) {
    pairs = pairsForChangedPaths();
  } else {
    throw new Error(
      "Pass one source or test path, --all, --all --report <path>, or no arguments",
    );
  }

  if (pairs.length === 0) {
    process.stdout.write("No changed source-test pairs.\n");
    return;
  }

  for (const pair of pairs) {
    await runPair(pair);
  }
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
