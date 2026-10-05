import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const reporterPath = fileURLToPath(new URL("./test-reporter.mjs", import.meta.url));
const productionRoot = "extensions/pi-claude-marketplace";
const testRoot = "tests";

function toProjectPath(inputPath, selectedProjectRoot = projectRoot) {
  const absolutePath = path.resolve(selectedProjectRoot, inputPath);
  const projectPath = path.relative(selectedProjectRoot, absolutePath);

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
 * The source-test pair a path names, resolved inside the selected repository.
 *
 * `selectedProjectRoot` governs BOTH halves of the answer: the path is made repository-relative
 * against it and both pair members are checked for existence under it. A root that reached only one
 * of the two would report a pair that exists in the selected repository as missing, which is a wrong
 * answer shaped like a refusal.
 */
function pairForPath(inputPath, selectedProjectRoot = projectRoot) {
  const projectPath = toProjectPath(inputPath, selectedProjectRoot);
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
    if (!existsSync(path.join(selectedProjectRoot, pairPath))) {
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
function gitLines(args, selectedProjectRoot = projectRoot) {
  const run = spawnSync("git", args, {
    cwd: selectedProjectRoot,
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

// The one base candidate whose name comes from git output rather than from a literal. Anything
// outside this character set is refused rather than passed to a later invocation, so a ref name is
// never able to become an argument the selector did not intend.
// A leading `-` is excluded so a value like `--git-dir=x` cannot reach `git rev-parse` as an
// option-shaped argument. There is no shell and no injection here -- `spawnSync` takes an argument
// array and the value comes from a developer's command line or from package.json -- so this closes a
// confusing refusal, not a vulnerability.
const baseCandidateName = /^[A-Za-z0-9._/][A-Za-z0-9._/-]*$/;

function upstreamCandidate(selectedProjectRoot) {
  const resolved = gitLines(["rev-parse", "--abbrev-ref", "@{upstream}"], selectedProjectRoot);

  if (!resolved.ok) {
    return { label: "@{upstream}", reason: resolved.reason };
  }

  const name = resolved.lines[0];

  if (name === undefined) {
    return { label: "@{upstream}", reason: "git named no upstream ref" };
  }

  if (!baseCandidateName.test(name)) {
    return { label: "@{upstream}", reason: `upstream ref name is not a plain ref name: ${name}` };
  }

  return { label: "@{upstream}", name };
}

/**
 * The base a caller named, resolved exactly or refused.
 *
 * An explicitly named base is never replaced by a fallback (`D-08-A07`). The candidate chain answers
 * "what is the newest thing this checkout can diff against"; a caller that names a ref is asking a
 * different question, so falling through to the chain would report a verdict over a change set
 * nobody asked for. The name is tested against `baseCandidateName` before it reaches git, so a value
 * carrying whitespace or a shell metacharacter is refused without git being invoked on it at all.
 */
function explicitBaseSelection(explicitBase, selectedProjectRoot) {
  const refuse = (reason) => ({
    ok: false,
    attempted: [{ candidate: explicitBase, reason }],
    reason: `Explicit base ${explicitBase} did not resolve: ${reason}. An explicitly named base is never replaced by a fallback.`,
  });

  if (!baseCandidateName.test(explicitBase)) {
    return refuse("the value is not a plain ref name");
  }

  const resolved = gitLines(
    ["rev-parse", "--verify", `${explicitBase}^{commit}`],
    selectedProjectRoot,
  );

  if (resolved.ok && resolved.lines[0] !== undefined) {
    return { ok: true, candidate: explicitBase, commit: resolved.lines[0], attempted: [] };
  }

  return refuse(resolved.ok ? "resolved to no commit" : resolved.reason);
}

/**
 * The base commit the changed-pair selection diffs against: the one the caller named, or the first
 * that resolves from an ordered candidate chain.
 *
 * The returned candidate is what a failing run names (`D-07-13`): a reader of a failed gate run has
 * to be able to tell which of `origin/main`, `main`, the upstream tracking ref, or `HEAD~1` the
 * answer rests on, because the four disagree about what counts as changed. `attempted` carries
 * the reason every earlier candidate was rejected and is present on both outcomes, so a selection
 * that succeeded still records what it passed over rather than reporting only its winner.
 *
 * `explicitBase` is what lets one implementation serve two named scopes at one strictness -- a
 * branch-scoped change set for a pull request, a commit-scoped one for a hook -- and it never falls
 * through to the chain.
 */
function selectBase(selectedProjectRoot = projectRoot, explicitBase = undefined) {
  if (explicitBase !== undefined) {
    return explicitBaseSelection(explicitBase, selectedProjectRoot);
  }

  const attempted = [];
  const candidates = [
    { label: "origin/main", name: "origin/main" },
    { label: "main", name: "main" },
    upstreamCandidate(selectedProjectRoot),
    { label: "HEAD~1", name: "HEAD~1" },
  ];

  for (const candidate of candidates) {
    if (candidate.name === undefined) {
      attempted.push({ candidate: candidate.label, reason: candidate.reason });
      continue;
    }

    const resolved = gitLines(
      ["rev-parse", "--verify", `${candidate.name}^{commit}`],
      selectedProjectRoot,
    );

    if (resolved.ok && resolved.lines[0] !== undefined) {
      return { ok: true, candidate: candidate.name, commit: resolved.lines[0], attempted };
    }

    attempted.push({
      candidate: candidate.label,
      reason: resolved.ok ? "resolved to no commit" : resolved.reason,
    });
  }

  const detail = attempted.map((entry) => `${entry.candidate}: ${entry.reason}`).join("; ");
  return { ok: false, attempted, reason: `No base candidate resolved -- ${detail}` };
}

/**
 * Every path the working tree reports as changed against the selected base.
 *
 * The result is discriminated because zero pairs has two causes that `D-07-14` requires the gate to
 * tell apart: a change set that resolved and simply held nothing pairable, and a change set that is
 * empty because base selection or a git invocation failed. Propagating the first failing invocation
 * rather than folding it into an empty list is what keeps those two apart.
 */
function changedPaths(selectedProjectRoot = projectRoot, explicitBase = undefined) {
  const base = selectBase(selectedProjectRoot, explicitBase);

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
    const run = gitLines(args, selectedProjectRoot);

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
 *
 * Both companions are looked for under `selectedProjectRoot`, because the classification has to be
 * made in the repository the change set came from: judged against another tree, a supplement reads
 * as a pair member and the run aborts on a module that was never meant to exist.
 */
function isStructuralSupplement(projectPath, selectedProjectRoot) {
  const match = /^tests\/(?:domain|platform)\/(?<name>.+)-fake\.test\.ts$/.exec(projectPath);

  if (match === null) {
    return false;
  }

  const prefix = projectPath.slice(0, -".test.ts".length);
  return (
    existsSync(path.join(selectedProjectRoot, `${prefix}.ts`)) &&
    existsSync(path.join(selectedProjectRoot, `${prefix.slice(0, -"-fake".length)}-contract.ts`))
  );
}

/**
 * Why a changed path names no member of a source-test pair, or `undefined` when it names one.
 *
 * Both halves have to be tight, because `pairForPath` throws rather than skips: a path admitted here
 * that cannot be mapped aborts the whole run. On the production side that means requiring `.ts`, so
 * a changed README or JSON fixture under the production root is passed over instead of refused. On
 * the test side it means excluding the non-corresponding roots and the structural supplements, so
 * the suites that have no pair by design do not compose a module path that does not exist.
 */
function pairabilityRefusal(projectPath, selectedProjectRoot) {
  if (projectPath.startsWith(`${productionRoot}/`)) {
    return projectPath.endsWith(".ts")
      ? undefined
      : "under the production root but not a TypeScript module";
  }

  if (!projectPath.startsWith(`${testRoot}/`)) {
    return "outside both the production root and the test root";
  }

  if (!projectPath.endsWith(".test.ts")) {
    return "under the test root but not a corresponding test path";
  }

  const firstSegment = projectPath.slice(`${testRoot}/`.length).split("/", 1)[0];

  if (nonCorrespondingRoots.has(firstSegment)) {
    return `under the non-corresponding test root ${firstSegment}`;
  }

  return isStructuralSupplement(projectPath, selectedProjectRoot)
    ? "a structural supplement suite"
    : undefined;
}

function isPairablePath(projectPath, selectedProjectRoot) {
  return pairabilityRefusal(projectPath, selectedProjectRoot) === undefined;
}

function pairsForPaths(projectPaths, selectedProjectRoot) {
  const pairs = new Map();

  for (const projectPath of projectPaths.filter((changedPath) =>
    isPairablePath(changedPath, selectedProjectRoot),
  )) {
    const pair = pairForPath(projectPath, selectedProjectRoot);
    pairs.set(pair.sourcePath, pair);
  }

  return { pairs: [...pairs.values()] };
}

/**
 * The source-test pairs the selected change set names, carrying the base that produced it.
 */
function pairsForChangedPaths(selectedProjectRoot = projectRoot, explicitBase = undefined) {
  const changed = changedPaths(selectedProjectRoot, explicitBase);

  if (!changed.ok) {
    return changed;
  }

  return { ok: true, base: changed.base, ...pairsForPaths(changed.paths, selectedProjectRoot) };
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

/**
 * Resolve one LCOV record's source field against the given root, or answer `undefined` when it
 * lands outside that root.
 *
 * Deliberately separate from `toProjectPath`, which throws. A path the user typed on the command
 * line that names something outside the project is a mistake worth refusing; a coverage record for
 * an out-of-tree module -- an out-of-tree peer dependency, a symlinked `node_modules`, a
 * globally-resolved companion extension -- is simply not the record being selected. Filtering asks
 * one question about one record, so a non-match has to answer "not this one" rather than take the
 * whole gate down.
 */
function recordProjectPath(selectedProjectRoot, inputPath) {
  const projectPath = path.relative(
    selectedProjectRoot,
    path.resolve(selectedProjectRoot, inputPath),
  );

  if (projectPath.startsWith("..") || path.isAbsolute(projectPath)) {
    return undefined;
  }

  return projectPath.split(path.sep).join("/");
}

/**
 * The verdict for one source-test pair's coverage, read out of the LCOV the focused run wrote.
 *
 * `selectedProjectRoot` governs BOTH halves of the answer -- which records belong to the module and
 * where the type-only probe reads the module from. A root that reached only one of the two would be
 * a trap: a caller passing a fixture root and a matching fixture LCOV would select no records and
 * fall through to the type-only escape, which is a wrong answer wearing the shape of a pass.
 */
function assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot) {
  const records = parseLcov(lcovText);
  const foreign = records.find(
    (record) => recordProjectPath(selectedProjectRoot, record.get("SF")) !== sourcePath,
  );

  if (foreign !== undefined) {
    throw new Error(`Unexpected LCOV record for ${foreign.get("SF")} in the run for ${sourcePath}`);
  }

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
// The caller decides what "the run's rows" means, and only one of the two answers can catch a
// skipped row. `runAllPairs` reads the rows back OUT of the retained report, so a lost append, a
// truncated write or a report another process clobbered mid-run fails here. Handed the in-memory
// array the same loop just built, the check cannot fail at all -- that array has one entry per
// enumerated module by construction -- so a report-less run degrades this to a structural invariant
// over the loop's own output rather than a guard over the run.
//
// A row is recorded for a refused pair too, rather than the refusal ending the loop: `enforcePairs`
// fails the run only after every pair is measured. The check below therefore still sees one row per
// enumerated module on a run that measured a shortfall, and the reading that shortfall produced is in
// the retained report where a later reader can diff it.
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
  const startedAt = process.hrtime.bigint();

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

    return {
      sourcePath,
      testPath,
      coverage: summary,
      typeOnly: summary === "type-only",
      runtime: process.version,
      elapsedMs: Number((process.hrtime.bigint() - startedAt) / 1000000n),
      lcov,
    };
  } finally {
    await rm(coverageDirectory, { force: true, recursive: true });
  }
}

/**
 * Measures independent pairs with bounded concurrency. Results retain input order;
 * onRecord sees completion order so interrupted reports keep every finished pair.
 * A failed worker stops new work. Started workers drain before the failure escapes.
 */
async function runPairs(pairs, run, options = {}) {
  const concurrency =
    options.concurrency ?? (process.env.TEST_CONCURRENCY || availableParallelism());
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
        const record = await run(pairs[index]);
        records[index] = record;
        options.onRecord?.(record);
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
 * A refused pair still answers a record of the same shape `runPair` returns, so the caller retaining
 * a report keeps one row per pair whatever the verdict was.
 */
async function measurePair(pair, observed, run) {
  const startedAt = process.hrtime.bigint();

  try {
    return await run(pair);
  } catch (error) {
    const reading = shortfallReadingOf(error, pair.sourcePath);

    if (reading === undefined) {
      throw error;
    }

    observed.push({ sourcePath: pair.sourcePath, reading });
    // This line shows a shortfall as soon as it lands, before the run fails.
    process.stdout.write(`Direct coverage shortfall recorded: ${pair.sourcePath} (${reading})\n`);

    return {
      sourcePath: pair.sourcePath,
      testPath: pair.testPath,
      coverage: reading,
      // The retained artifact says which rows were refused. Without it a shortfall row and a
      // complete row differ only by `hit !== found` inside a formatted string, which a later reader
      // has to notice rather than read.
      verdict: "shortfall",
      typeOnly: false,
      runtime: process.version,
      elapsedMs: Number((process.hrtime.bigint() - startedAt) / 1000000n),
    };
  }
}

/**
 * Measure every pair, then fail on any shortfall. This is the gate's entire enforcement edge, and
 * every arm reaches it.
 *
 * `measurePair` records a shortfall and continues, so every selected pair runs and the all-pair
 * report holds a row for each pair before the run fails.
 *
 * The two hooks serve the all-pair arm: `onRecord` writes its report row by row (an interrupted run
 * still leaves a readable partial result), and `beforeVerdict` runs its completeness check first,
 * because a run that skipped rows can hold no shortfall and would pass otherwise.
 */
async function enforcePairs(pairs, run = runPair, hooks = {}) {
  const observed = [];
  const records = await runPairs(pairs, (pair) => measurePair(pair, observed, run), hooks);

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

async function runAllPairs({ reportPath, lcovPath } = {}) {
  const modulePaths = productionPaths();
  const pairs = modulePaths.map((modulePath) => pairForPath(modulePath));

  // Line-oriented and written as each pair lands, so an interrupted run still leaves a readable
  // partial result and a later reader can diff two runs line by line.
  if (reportPath !== undefined) {
    writeFileSync(reportPath, "");
  }

  const records = await enforcePairs(pairs, runPair, {
    onRecord: (record) => {
      if (reportPath !== undefined) {
        const { lcov: _lcov, ...row } = record;
        appendFileSync(reportPath, `${JSON.stringify(row)}\n`);
      }
    },
    // Read the retained report back instead of trusting the array the loop just appended to, so the
    // completeness check has a witness the loop did not produce. See the note on
    // `assertReportComplete` for why the report-less arm cannot fail.
    //
    // Unconditional: a report is how the result is retained, not what makes the run a gate.
    beforeVerdict: (measured) => {
      assertReportComplete(
        reportPath === undefined
          ? measured
          : readFileSync(reportPath, "utf8")
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line)),
        modulePaths,
      );
    },
  });

  if (lcovPath !== undefined) {
    writeMergedLcov(lcovPath, records);
  }
}

function writeMergedLcov(lcovPath, records) {
  const measured = records.filter((record) => !record.typeOnly);
  writeFileSync(lcovPath, measured.map((record) => record.lcov).join(""));
  process.stdout.write(`Merged LCOV: ${lcovPath} (${measured.length} records)\n`);
}

// A passing run prints nothing. A failing run writes the selected base candidate to stderr, which
// keeps a failing answer auditable (`D-07-13`). A selection that failed still sets a non-zero exit
// code and names the git invocation that failed (`D-07-14`).
async function runChangedPairs(explicitBase) {
  const selected = pairsForChangedPaths(projectRoot, explicitBase);

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

  const selected = pairsForPaths(stagedPaths, projectRoot);
  await enforcePairs(selected.pairs);
}

const usage =
  "Pass source or test paths, --all [--report <path>] [--lcov <path>], --base <ref>, --staged, or no arguments";

const allPairOptionKeys = new Map([
  ["--report", "reportPath"],
  ["--lcov", "lcovPath"],
]);

function parseAllPairOptions(options) {
  const parsed = {};

  for (let index = 0; index < options.length; index += 2) {
    const key = allPairOptionKeys.get(options[index]);
    const value = options[index + 1];

    if (key === undefined || value === undefined || Object.hasOwn(parsed, key)) {
      throw new Error(usage);
    }

    parsed[key] = value;
  }

  return parsed;
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

  if (args.length !== 0) {
    throw new Error(usage);
  }

  await runChangedPairs(undefined);
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
