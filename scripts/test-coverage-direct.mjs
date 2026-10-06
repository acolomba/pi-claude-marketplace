import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const reporterPath = fileURLToPath(new URL("./test-reporter.mjs", import.meta.url));
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

/**
 * The source-test pair a path names, resolved inside the repository.
 */
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

  const productionModules = readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => {
      const absolutePath = path.join(entry.parentPath, entry.name);
      return toProjectPath(absolutePath);
    })
    .sort();

  return productionModules;
}

/**
 * One git invocation's outcome, kept discriminated so that a command which failed and a command
 * which legitimately produced no lines are never the same value.
 *
 * `D-07-14` turns on this distinction: an empty line list that came back because `git` exited
 * non-zero has to reach the caller as a failure, because otherwise a broken selector and a
 * docs-only commit are byte-identical outcomes. The exit status and stderr are therefore both read
 * and carried, and `args` is always an argument array so no ref name is ever word-split by a shell.
 */
function gitLines(args) {
  const run = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (run.error !== undefined) {
    return { ok: false, reason: `git ${args.join(" ")} could not run: ${run.error.message}` };
  }

  if (run.status !== 0) {
    const stderr = typeof run.stderr === "string" ? run.stderr.trim() : "";
    return { ok: false, reason: `git ${args.join(" ")} exited ${run.status}: ${stderr}` };
  }

  return {
    ok: true,
    lines: run.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

// The value of `--base`. Anything outside this character set is refused rather than passed to git,
// so a ref name is never able to become an argument the selector did not intend.
// A leading `-` is excluded so a value like `--git-dir=x` cannot reach `git rev-parse` as an
// option-shaped argument. There is no shell and no injection here -- `spawnSync` takes an argument
// array and the value comes from a developer's command line or from package.json -- so this closes a
// confusing refusal, not a vulnerability.
const baseCandidateName = /^[A-Za-z0-9._/][A-Za-z0-9._/-]*$/;

/**
 * The base a caller named, resolved exactly or refused.
 *
 * A named base that does not resolve is refused, with nothing in its place (`D-08-A07`): a verdict
 * over another change set would answer a question nobody asked. The name is tested against
 * `baseCandidateName` before it reaches git, so a value carrying whitespace or a shell metacharacter
 * is refused without git being invoked on it at all.
 */
function explicitBaseSelection(explicitBase) {
  const refuse = (reason) => ({
    ok: false,
    reason: `Explicit base ${explicitBase} did not resolve: ${reason}.`,
  });

  if (!baseCandidateName.test(explicitBase)) {
    return refuse("the value is not a plain ref name");
  }

  const resolved = gitLines(["rev-parse", "--verify", `${explicitBase}^{commit}`]);

  if (resolved.ok && resolved.lines[0] !== undefined) {
    return { ok: true, candidate: explicitBase, commit: resolved.lines[0] };
  }

  return refuse(resolved.ok ? "resolved to no commit" : resolved.reason);
}

/**
 * Every path the working tree reports as changed against the named base.
 *
 * The result is discriminated because zero pairs has two causes that `D-07-14` requires the gate to
 * tell apart: a change set that resolved and simply held nothing pairable, and a change set that is
 * empty because the base did not resolve or a git invocation failed. Propagating the first failing invocation
 * rather than folding it into an empty list is what keeps those two apart.
 */
function changedPaths(explicitBase) {
  const base = explicitBaseSelection(explicitBase);

  if (!base.ok) {
    return { ok: false, reason: base.reason };
  }

  const paths = new Set();

  for (const args of [
    ["diff", "--name-only", "--diff-filter=ACMR", `${base.commit}...HEAD`],
    ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"],
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    const run = gitLines(args);

    if (!run.ok) {
      return { ok: false, reason: run.reason };
    }

    for (const projectPath of run.lines) {
      paths.add(projectPath);
    }
  }

  return { ok: true, paths: [...paths].sort(), base: base.candidate };
}

// The test roots that hold no corresponding tests, mirroring the correspondence gate's set of the
// same name. A test under one of these has no production pair by design, so mapping it would name a
// module that was never meant to exist.
const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);

/**
 * Whether the path is a structural supplement -- a suite owning a contract and its fake rather than
 * a production module -- mirroring the exemption of the same name in the correspondence gate. Both
 * companions have to be present, so a suite that merely happens to be named `*-fake.test.ts` is
 * still treated as a pair member and still has to map.
 */
function isStructuralSupplement(projectPath) {
  const match = /^tests\/(?:domain|platform)\/(?<name>.+)-fake\.test\.ts$/.exec(projectPath);

  if (match === null) {
    return false;
  }

  const prefix = projectPath.slice(0, -".test.ts".length);
  return (
    existsSync(path.join(projectRoot, `${prefix}.ts`)) &&
    existsSync(path.join(projectRoot, `${prefix.slice(0, -"-fake".length)}-contract.ts`))
  );
}

/**
 * Whether a changed path names a member of a source-test pair.
 *
 * Both halves have to be tight, because `pairForPath` throws rather than skips: a path admitted here
 * that cannot be mapped aborts the whole run. On the production side that means requiring `.ts`, so
 * a changed README or JSON fixture under the production root is passed over instead of refused. On
 * the test side it means excluding the non-corresponding roots and the structural supplements, so
 * the suites that have no pair by design do not compose a module path that does not exist.
 */
function isPairablePath(projectPath) {
  if (projectPath.startsWith(`${productionRoot}/`)) {
    return projectPath.endsWith(".ts");
  }

  if (!projectPath.startsWith(`${testRoot}/`) || !projectPath.endsWith(".test.ts")) {
    return false;
  }

  const firstSegment = projectPath.slice(`${testRoot}/`.length).split("/", 1)[0];

  return !nonCorrespondingRoots.has(firstSegment) && !isStructuralSupplement(projectPath);
}

function pairsForPaths(projectPaths) {
  const pairs = new Map();

  for (const projectPath of projectPaths.filter((changedPath) => isPairablePath(changedPath))) {
    const pair = pairForPath(projectPath);
    pairs.set(pair.sourcePath, pair);
  }

  return { pairs: [...pairs.values()] };
}

/**
 * The source-test pairs the selected change set names, carrying the base that produced it.
 */
function pairsForChangedPaths(explicitBase) {
  const changed = changedPaths(explicitBase);

  if (!changed.ok) {
    return changed;
  }

  return { ok: true, base: changed.base, ...pairsForPaths(changed.paths) };
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

function isTypeOnlyModule(sourcePath) {
  const sourceText = readFileSync(path.join(projectRoot, sourcePath), "utf8");
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

/**
 * Resolve one LCOV record's source field against the project root, or answer `undefined` when it
 * lands outside that root.
 *
 * Deliberately separate from `toProjectPath`, which throws. A path the user typed on the command
 * line that names something outside the project is a mistake worth refusing; a coverage record for
 * an out-of-tree module -- an out-of-tree peer dependency, a symlinked `node_modules`, a
 * globally-resolved companion extension -- is simply not the record being selected. Filtering asks
 * one question about one record, so a non-match has to answer "not this one" rather than take the
 * whole gate down.
 */
function recordProjectPath(inputPath) {
  const projectPath = path.relative(projectRoot, path.resolve(projectRoot, inputPath));

  if (projectPath.startsWith("..") || path.isAbsolute(projectPath)) {
    return undefined;
  }

  return projectPath.split(path.sep).join("/");
}

/**
 * The verdict for one source-test pair's coverage, read out of the LCOV the focused run wrote.
 */
function assertCompleteCoverage(sourcePath, lcovText) {
  const records = parseLcov(lcovText);
  const foreign = records.find((record) => recordProjectPath(record.get("SF")) !== sourcePath);

  if (foreign !== undefined) {
    throw new Error(`Unexpected LCOV record for ${foreign.get("SF")} in the run for ${sourcePath}`);
  }

  if (records.length === 0 && isTypeOnlyModule(sourcePath)) {
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

// How the gate states a shortfall. `assertCompleteCoverage` and `enforcePairs` write it, and
// `shortfallReadingOf` reads it back.
const shortfallPattern = /^Incomplete direct coverage for (?<sourcePath>[^:]+): (?<counts>.+)$/;

/**
 * The reading inside a shortfall refusal for THIS pair, or `undefined` for anything else.
 *
 * The answer is `undefined` rather than a throw for every other error, because the caller is what
 * decides whether a non-coverage failure is fatal. `measurePair` rethrows on `undefined`: a focused
 * test that failed, or an LCOV that could not be read, is not a coverage verdict, and recording it as
 * one would answer for a pair nothing measured. The message has to name this pair's source for the
 * same reason -- one module's reading filed against another still looks right.
 */
function shortfallReadingOf(error, sourcePath) {
  const message = error instanceof Error ? error.message : String(error);
  const match = shortfallPattern.exec(message);

  if (match === null || match.groups.sourcePath !== sourcePath) {
    return undefined;
  }

  return match.groups.counts;
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
// The rows are the records the loop built, so this checks a structural invariant of that output: one
// record per enumerated module, each mapping to its test and back. A record is built for a refused
// pair too, rather than the refusal ending the loop: `enforcePairs` fails the run only after every
// pair is measured, so the check still sees one record per enumerated module on a run that measured
// a shortfall.
//
// The round-trip check is also the honest answer to COV-02's remaining half. Path-level ambiguity --
// two production modules claiming one test, or one test claiming two modules -- is UNREACHABLE under
// the current one-to-one name mapping, so a check written to catch it could never fire and would
// prove nothing. What is assertable is the invariant that makes it unreachable: every row maps to its
// test and back to itself, and no two rows share either member.
function assertReportComplete(records, modulePaths) {
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
    throw new Error(`Expected ${modulePaths.length} all-pair records, found ${records.length}`);
  }
}

async function runPair({ sourcePath, testPath }) {
  const coverageDirectory = await mkdtemp(path.join(tmpdir(), "pi-claude-direct-"));
  const lcovPath = path.join(coverageDirectory, "pair.lcov");

  try {
    const outputPath = path.join(coverageDirectory, "test.log");
    const output = await open(outputPath, "w");
    let exitCode;

    try {
      const testRun = spawn(
        process.execPath,
        [
          "--test",
          "--experimental-test-coverage",
          `--test-coverage-include=${sourcePath}`,
          `--test-reporter=${reporterPath}`,
          "--test-reporter-destination=stdout",
          "--test-reporter=lcov",
          `--test-reporter-destination=${lcovPath}`,
          testPath,
        ],
        { cwd: projectRoot, stdio: ["ignore", output.fd, output.fd] },
      );
      [exitCode] = await once(testRun, "close");
    } finally {
      await output.close();
    }

    // Keep each pair's output together, including diagnostics from failed tests.
    process.stdout.write(readFileSync(outputPath, "utf8"));

    if (exitCode !== 0) {
      throw new Error(`Focused test failed: ${testPath}`);
    }

    const lcov = readFileSync(lcovPath, "utf8");
    const summary = assertCompleteCoverage(sourcePath, lcov);

    if (process.env.CI) {
      process.stdout.write(`Direct coverage passed: ${sourcePath} (${summary})\n`);
    }

    return { sourcePath, testPath, typeOnly: summary === "type-only", lcov };
  } finally {
    await rm(coverageDirectory, { force: true, recursive: true });
  }
}

/**
 * Measures independent pairs with bounded concurrency. Results retain input order.
 * A failed worker stops new work. Started workers drain before the failure escapes.
 */
async function runPairs(pairs, run) {
  const concurrency = process.env.TEST_CONCURRENCY || availableParallelism();
  const limit = Number(concurrency);

  if (!/^[1-9][0-9]*$/.test(String(concurrency)) || !Number.isSafeInteger(limit)) {
    throw new Error("TEST_CONCURRENCY must be a positive safe integer");
  }

  const records = new Array(pairs.length);
  let next = 0;
  let stopped = false;

  async function worker() {
    while (!stopped && next < pairs.length) {
      const index = next++;

      try {
        records[index] = await run(pairs[index]);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  }

  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(limit, pairs.length) }, () => worker()),
  );
  const failed = workers.find((worker) => worker.status === "rejected");

  if (failed !== undefined) {
    throw failed.reason;
  }

  return records;
}

/**
 * Run one pair, recording a coverage shortfall on `observed` instead of ending the run.
 *
 * Only a coverage verdict is recorded. `shortfallReadingOf` answers `undefined` for every other
 * failure and this rethrows it, because a focused test that failed or an LCOV that could not be read
 * says nothing about coverage.
 *
 * A refused pair still answers a record with its source and test, so the all-pair completeness check
 * sees one record per pair whatever the verdict was.
 */
async function measurePair(pair, observed) {
  try {
    return await runPair(pair);
  } catch (error) {
    const reading = shortfallReadingOf(error, pair.sourcePath);

    if (reading === undefined) {
      throw error;
    }

    observed.push({ sourcePath: pair.sourcePath, reading });
    // This line shows a shortfall as soon as it lands, before the run fails.
    process.stdout.write(`Direct coverage shortfall recorded: ${pair.sourcePath} (${reading})\n`);

    return { sourcePath: pair.sourcePath, testPath: pair.testPath };
  }
}

/**
 * Measure every pair, then fail on any shortfall. This is the gate's entire enforcement edge, and
 * every arm reaches it.
 *
 * `measurePair` records a shortfall and continues, so every selected pair runs and has a record
 * before the run fails.
 *
 * The `beforeVerdict` hook serves the all-pair arm: it runs the completeness check first, because a
 * run that skipped rows can hold no shortfall and would pass otherwise.
 */
async function enforcePairs(pairs, hooks = {}) {
  const observed = [];
  const records = await runPairs(pairs, (pair) => measurePair(pair, observed));

  hooks.beforeVerdict?.(records);

  if (observed.length > 0) {
    throw new Error(
      observed
        .map(
          ({ sourcePath, reading }) => `Incomplete direct coverage for ${sourcePath}: ${reading}`,
        )
        .sort()
        .join("\n"),
    );
  }

  return records;
}

async function runAllPairs({ lcovPath } = {}) {
  const modulePaths = productionPaths();
  const pairs = modulePaths.map((modulePath) => pairForPath(modulePath));
  const startedAt = process.hrtime.bigint();

  const records = await enforcePairs(pairs, {
    beforeVerdict: (measured) => assertReportComplete(measured, modulePaths),
  });

  if (process.env.CI) {
    const elapsedMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
    process.stdout.write(
      `All-pair run complete: ${records.length} pairs in ${(elapsedMs / 1000).toFixed(1)}s (${elapsedMs}ms) on ${process.version}\n`,
    );
  }

  if (lcovPath !== undefined) {
    writeMergedLcov(lcovPath, records);
  }
}

function writeMergedLcov(lcovPath, records) {
  const measured = records.filter((record) => !record.typeOnly);
  writeFileSync(lcovPath, measured.map((record) => record.lcov).join(""));
  process.stdout.write(`Merged LCOV: ${lcovPath} (${measured.length} records)\n`);
}

// Locally, a passing run prints nothing, and in CI each pair prints its result line. A failing run
// writes the named base to stderr, which keeps a failing answer auditable (`D-07-13`).
// A selection that failed still sets a non-zero exit code and names the git invocation that failed
// (`D-07-14`).
async function runChangedPairs(explicitBase) {
  const selected = pairsForChangedPaths(explicitBase);

  if (!selected.ok) {
    process.stderr.write(`Changed-pair selection failed: ${selected.reason}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    await enforcePairs(selected.pairs);
  } catch (error) {
    process.stderr.write(`Changed-pair base: ${selected.base}\n`);
    throw error;
  }
}

// A pair test can import support files from any `tests/` root, the two scripts run every pair, and
// the three remaining files decide the dependencies and compiler settings.
const everyPairInputs = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "scripts/test-coverage-direct.mjs",
  "scripts/test-reporter.mjs",
]);

function affectsEveryPair(projectPath) {
  return (
    everyPairInputs.has(projectPath) ||
    (projectPath.startsWith(`${testRoot}/`) && !projectPath.endsWith(".test.ts"))
  );
}

async function runStagedPairs() {
  const staged = gitLines(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);

  if (!staged.ok) {
    process.stderr.write(`Staged-pair selection failed: ${staged.reason}\n`);
    process.exitCode = 1;
    return;
  }

  const stagedPaths = [...staged.lines].sort();
  const escalation = stagedPaths.find(affectsEveryPair);

  if (escalation !== undefined) {
    try {
      await runAllPairs();
    } catch (error) {
      process.stderr.write(`Staged ${escalation} affects every pair, so every pair ran.\n`);
      throw error;
    }

    return;
  }

  const selected = pairsForPaths(stagedPaths);
  await enforcePairs(selected.pairs);
}

const usage = "Pass source or test paths, --all [--lcov <path>], --base <ref>, or --staged";

function parseAllPairOptions(options) {
  if (options.length === 0) {
    return {};
  }

  if (options.length === 2 && options[0] === "--lcov") {
    return { lcovPath: options[1] };
  }

  throw new Error(usage);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--all") {
    await runAllPairs(parseAllPairOptions(args.slice(1)));
    return;
  }

  if (args.length === 1 && args[0] === "--staged") {
    await runStagedPairs();
    return;
  }

  // Ahead of the single-path form, so a ref name is never read as a path.
  if (args.length === 2 && args[0] === "--base") {
    await runChangedPairs(args[1]);
    return;
  }

  if (args.length === 1 && args[0] === "--base") {
    throw new Error("--base takes one ref name: --base <ref>");
  }

  if (args.length > 0 && args.every((arg) => !arg.startsWith("--"))) {
    // Explicit paths get the same verdict as the other arms.
    const pairs = new Map(
      args.map((arg) => {
        const pair = pairForPath(arg);
        return [pair.sourcePath, pair];
      }),
    );

    await enforcePairs([...pairs.values()]);
    return;
  }

  throw new Error(usage);
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
