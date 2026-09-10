import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCompleteCoverage,
  assertReportComplete,
  changedPaths,
  pairsForChangedPaths,
  selectBase,
} from "./test-coverage-direct.mjs";
import { verdictFor } from "./test-coverage-direct.report.mjs";

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "direct-coverage-gate-"));
const sourceDirectory = path.join(fixtureRoot, "extensions/pi-claude-marketplace/domain");
const sourcePath = "extensions/pi-claude-marketplace/domain/types.ts";
// The git fixtures live under the same temporary root as every other fixture here, so the top-level
// `finally` disposes them with the single `rm` it already performs on the `mkdtemp` return value.
const gitFixtureRoot = path.join(fixtureRoot, "git");

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const gatePath = fileURLToPath(new URL("./test-coverage-direct.mjs", import.meta.url));
// A real production module, and deliberately not a type-only one: a source that could take the
// type-only escape would let a malformed state pass without ever reaching a verdict.
const realSourcePath = "extensions/pi-claude-marketplace/shared/atomic-json.ts";
// A real file under the test root that is not a corresponding test, so the mapping refusal is
// planted against a path that exists and still cannot be mapped.
const unmappablePath = "tests/edge/notification-boundary.ts";

/** The absolute path a real coverage run would write for an in-repo module. */
function inRepo(relativePath) {
  return path.join(projectRoot, relativePath);
}

// One LCOV record. The caller states the source field as an absolute path, because which root a
// record resolves against is one of the things being planted here: a record under the injected root
// has to be selected, and a record outside every root has to be passed over rather than refused.
// Concatenating two calls states the same source twice.
function lcovRecord(recordSourcePath, counts) {
  const lines = [
    `SF:${recordSourcePath}`,
    `BRF:${counts.branches.found}`,
    `BRH:${counts.branches.hit}`,
    `FNF:${counts.functions.found}`,
    `FNH:${counts.functions.hit}`,
    `LF:${counts.lines.found}`,
    `LH:${counts.lines.hit}`,
    "end_of_record",
  ];

  return `${lines.join("\n")}\n`;
}

// Every fixture git call is checked, because a fixture that failed to build would otherwise plant a
// state nobody asked for and the assertion below it would pass or fail for the wrong reason.
function fixtureGit(cwd, args) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });

  // A launch failure leaves `status`, `stdout` and `stderr` all null, so reading stderr first would
  // report a TypeError from this helper instead of the reason git never ran.
  if (run.error !== undefined) {
    throw new Error(`Fixture git ${args.join(" ")} could not run in ${cwd}: ${run.error.message}`);
  }

  if (run.status !== 0) {
    const stderr = typeof run.stderr === "string" ? run.stderr.trim() : "";
    throw new Error(`Fixture git ${args.join(" ")} exited ${run.status} in ${cwd}: ${stderr}`);
  }

  return run.stdout.trim();
}

/**
 * A git repository under the harness's temporary root, carrying one commit per requested change set.
 *
 * Identity is configured on the repository itself rather than inherited, so no fixture reads or
 * writes the developer's global git configuration, and signing is turned off so a globally-signed
 * setup does not turn a fixture build into an unrelated failure.
 */
async function buildFixtureRepository(name, branch, commits) {
  const root = path.join(gitFixtureRoot, name);

  await mkdir(root, { recursive: true });
  fixtureGit(root, ["init", "-q", "-b", branch]);
  fixtureGit(root, ["config", "user.email", "fixture@example.invalid"]);
  fixtureGit(root, ["config", "user.name", "Direct coverage fixture"]);
  fixtureGit(root, ["config", "commit.gpgsign", "false"]);

  for (const commit of commits) {
    for (const [filePath, contents] of Object.entries(commit.files)) {
      await mkdir(path.dirname(path.join(root, filePath)), { recursive: true });
      await writeFile(path.join(root, filePath), contents);
    }

    fixtureGit(root, ["add", "--all"]);
    fixtureGit(root, ["commit", "-q", "-m", commit.message]);
  }

  return root;
}

/** A depth-1 clone of a fixture repository, reached over `file://` so the clone is really shallow. */
function cloneShallow(sourceRepository, name) {
  const root = path.join(gitFixtureRoot, name);

  fixtureGit(gitFixtureRoot, [
    "clone",
    "-q",
    "--depth",
    "1",
    "--no-local",
    `file://${sourceRepository}`,
    root,
  ]);

  return root;
}

const completeCounts = {
  branches: { found: 4, hit: 4 },
  functions: { found: 3, hit: 3 },
  lines: { found: 12, hit: 12 },
};
const shortfallCounts = {
  branches: { found: 4, hit: 3 },
  functions: { found: 3, hit: 3 },
  lines: { found: 12, hit: 12 },
};

try {
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(
    path.join(fixtureRoot, sourcePath),
    "export interface Answer { value: number; }\n",
  );

  assert.equal(assertCompleteCoverage(sourcePath, "", fixtureRoot), "type-only");

  await writeFile(path.join(fixtureRoot, sourcePath), "export const answer = 42;\n");
  assert.throws(
    () => assertCompleteCoverage(sourcePath, "", fixtureRoot),
    /Expected one LCOV record.*found 0/,
  );

  // The complete state comes first and is not decoration: a malformed synthetic text parses to zero
  // records, which would make both throwing states below fire on the zero-record arm and measure
  // nothing.
  assert.equal(
    assertCompleteCoverage(realSourcePath, lcovRecord(inRepo(realSourcePath), completeCounts)),
    "branches 4/4, functions 3/3, lines 12/12",
  );

  // Shortfall. Pin the verdict's SHAPE -- it names the source and reports the deficient counter as
  // hit over found, and reports only that counter -- without pinning an absolute branch pair.
  assert.throws(
    () =>
      assertCompleteCoverage(realSourcePath, lcovRecord(inRepo(realSourcePath), shortfallCounts)),
    /Incomplete direct coverage for extensions\/.+atomic-json\.ts: branches \d+\/\d+$/,
  );

  // Ambiguity. Two records claiming one source is a refusal, not a choice between them.
  assert.throws(
    () =>
      assertCompleteCoverage(
        realSourcePath,
        lcovRecord(inRepo(realSourcePath), completeCounts) +
          lcovRecord(inRepo(realSourcePath), completeCounts),
      ),
    /Expected one LCOV record for extensions\/.+atomic-json\.ts, found 2$/,
  );

  // The injected root governs record selection, not just the type-only probe. A fixture LCOV naming
  // a fixture path reaches a verdict; a root threaded only halfway would select nothing here and
  // answer through the type-only escape instead, which is a wrong answer shaped like a pass.
  assert.equal(
    assertCompleteCoverage(
      sourcePath,
      lcovRecord(path.join(fixtureRoot, sourcePath), completeCounts),
      fixtureRoot,
    ),
    "branches 4/4, functions 3/3, lines 12/12",
  );

  // A record from outside every root is a non-match, not an abort. An LCOV carrying an out-of-tree
  // peer dependency or a symlinked node_modules must leave the gate able to answer. The fixture
  // source is not type-only at this point, so the answer is the zero-record refusal rather than a
  // pass -- which is what distinguishes "passed over" from "silently accepted".
  assert.throws(
    () =>
      assertCompleteCoverage(
        sourcePath,
        lcovRecord(path.resolve(fixtureRoot, "..", "outside-every-root/peer.ts"), completeCounts),
        fixtureRoot,
      ),
    /Expected one LCOV record.*found 0/,
  );

  // The two mapping refusals no exported assertion can reach, driven through the command instead.
  const outsideProject = spawnSync(process.execPath, [gatePath, "../outside-the-project.ts"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.notEqual(outsideProject.status, 0);
  assert.match(outsideProject.stderr, /Path is outside the project: \.\.\/outside-the-project\.ts/);

  const unmappableInTree = spawnSync(process.execPath, [gatePath, unmappablePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.notEqual(unmappableInTree.status, 0);
  assert.match(
    unmappableInTree.stderr,
    /Not a corresponding test path: tests\/edge\/notification-boundary\.ts/,
  );

  // The all-pair completeness assertion. These records are string pairs only -- the assertion never
  // reads the disk -- so the fixture names deliberately do not exist in the tree.
  const enumeratedModules = [
    "extensions/pi-claude-marketplace/domain/alpha.ts",
    "extensions/pi-claude-marketplace/domain/beta.ts",
    "extensions/pi-claude-marketplace/shared/gamma.ts",
  ];
  const completeRecords = [
    { sourcePath: enumeratedModules[0], testPath: "tests/domain/alpha.test.ts" },
    { sourcePath: enumeratedModules[1], testPath: "tests/domain/beta.test.ts" },
    { sourcePath: enumeratedModules[2], testPath: "tests/shared/gamma.test.ts" },
  ];

  // The passing state comes first and is not decoration: without it the three refusals below could
  // all be firing on a malformed record list rather than on the property each one claims.
  assert.doesNotThrow(() => assertReportComplete(completeRecords, enumeratedModules));

  // A run that quietly visited one row fewer. Whole-value comparison: the verdict names the module.
  assert.throws(
    () => assertReportComplete([completeRecords[0], completeRecords[2]], enumeratedModules),
    {
      message: "Missing from the all-pair result: extensions/pi-claude-marketplace/domain/beta.ts",
    },
  );

  // A row counted twice. The repeat is reported ahead of the row it displaced, because the repeat is
  // the cause and the absence is the symptom.
  assert.throws(
    () =>
      assertReportComplete(
        [completeRecords[0], completeRecords[1], completeRecords[1]],
        enumeratedModules,
      ),
    {
      message:
        "Repeated sourcePath in the all-pair result: extensions/pi-claude-marketplace/domain/beta.ts",
    },
  );

  // Two rows claiming one test. The source paths are distinct, so only the test-path half of the
  // repeat check can refuse this -- without this state that half is never exercised.
  assert.throws(
    () =>
      assertReportComplete(
        [
          completeRecords[0],
          { sourcePath: enumeratedModules[1], testPath: completeRecords[0].testPath },
          completeRecords[2],
        ],
        enumeratedModules,
      ),
    {
      message: "Repeated testPath in the all-pair result: tests/domain/alpha.test.ts",
    },
  );

  // A row whose test path is well-formed and unique but does not map back to its own source.
  assert.throws(
    () =>
      assertReportComplete(
        [
          completeRecords[0],
          completeRecords[1],
          { sourcePath: enumeratedModules[2], testPath: "tests/shared/delta.test.ts" },
        ],
        enumeratedModules,
      ),
    {
      message:
        "Mapping does not round-trip in the all-pair result: extensions/pi-claude-marketplace/shared/gamma.ts <-> tests/shared/delta.test.ts",
    },
  );

  // A row for a module the run never enumerated. Nothing repeats, everything round-trips and no
  // enumerated module is absent, so only the count check can refuse it. Without this state the count
  // check would ship unplanted.
  assert.throws(
    () =>
      assertReportComplete(
        [
          ...completeRecords,
          {
            sourcePath: "extensions/pi-claude-marketplace/shared/delta.ts",
            testPath: "tests/shared/delta.test.ts",
          },
        ],
        enumeratedModules,
      ),
    {
      message: "Expected 3 all-pair records, found 4",
    },
  );

  // The report's verdict rule. It is the one place a refusal is recorded instead of propagated, so
  // what it records and what it still refuses to record both have to be planted.
  //
  // The two accepting states come first and are not decoration: without them the three refusals
  // below could all be firing on an answer the rule never understood rather than on the property
  // each one claims.
  assert.deepEqual(verdictFor(realSourcePath, "branches 4/4, functions 3/3, lines 12/12"), {
    verdict: "complete",
    coverage: "branches 4/4, functions 3/3, lines 12/12",
    exitCode: 0,
  });

  assert.deepEqual(verdictFor(sourcePath, "type-only"), {
    verdict: "type-only",
    coverage: "type-only",
    exitCode: 0,
  });

  // A shortfall becomes a row carrying the deficient counters, rather than ending the run.
  assert.deepEqual(
    verdictFor(
      realSourcePath,
      new Error(`Incomplete direct coverage for ${realSourcePath}: branches 28/29, lines 86/89`),
    ),
    {
      verdict: "accepted-shortfall",
      coverage: "branches 28/29, lines 86/89",
      exitCode: 1,
    },
  );

  // A shortfall message naming some other module is not this row's verdict. Without this state the
  // rule could file one module's reading against another and still look right.
  assert.throws(
    () =>
      verdictFor(
        realSourcePath,
        new Error("Incomplete direct coverage for extensions/elsewhere.ts: branches 1/2"),
      ),
    { message: "Incomplete direct coverage for extensions/elsewhere.ts: branches 1/2" },
  );

  // A focused test that failed is not a coverage verdict. Recording it as one would be the report
  // answering for a pair it never measured.
  assert.throws(
    () => verdictFor(realSourcePath, new Error(`Focused test failed: ${unmappablePath}`)),
    { message: `Focused test failed: ${unmappablePath}` },
  );

  process.stdout.write("Direct-coverage negative controls passed.\n");

  // The base-selection states, planted against real git repositories built under this harness's own
  // temporary root. Every one calls the exported selector directly rather than spawning the gate, so
  // the selected candidate is a return value to assert on rather than stdout to scrape.
  await mkdir(gitFixtureRoot, { recursive: true });

  // The head of the chain, and the passing state of this group. It comes first and is not
  // decoration: without it the refusals below could all be firing on a fixture git never built
  // rather than on the property each one claims.
  const noRemoteRepository = await buildFixtureRepository("no-remote", "main", [
    { files: { "README.md": "base\n" }, message: "base" },
    { files: { "README.md": "second\n" }, message: "second" },
  ]);
  const noRemoteBase = selectBase(noRemoteRepository);

  assert.equal(noRemoteBase.ok, true);
  assert.equal(noRemoteBase.candidate, "main");
  assert.deepEqual(
    noRemoteBase.attempted.map((entry) => entry.candidate),
    ["origin/main"],
  );
  assert.match(noRemoteBase.attempted[0].reason, /origin\/main/);

  // A repository with no `origin/main` still selects a base rather than falling through to an empty
  // change set, and the chain records that `origin/main` was tried before `main` was taken.
  const noRemoteChangedPaths = changedPaths(noRemoteRepository);

  assert.equal(noRemoteChangedPaths.ok, true);
  assert.equal(noRemoteChangedPaths.base, "main");

  // The tail of the chain. A depth-1 clone still resolves `origin/main` and still merge-bases
  // against it, so the candidate a shallow checkout actually breaks is the last one, `HEAD~1`. One
  // fixture asked to prove both ends would prove neither, which is why the head is planted above in
  // a repository that has no remote at all.
  const shallowRepository = cloneShallow(noRemoteRepository, "shallow");
  const shallowBase = selectBase(shallowRepository);

  assert.equal(shallowBase.ok, true);
  assert.equal(shallowBase.candidate, "origin/main");
  assert.notEqual(
    spawnSync("git", ["rev-parse", "--verify", "HEAD~1"], {
      cwd: shallowRepository,
      encoding: "utf8",
    }).status,
    0,
  );

  // With `origin/main`, `main`, and an upstream ref all absent, the chain falls through to its last
  // candidate instead of giving up.
  const fallthroughRepository = await buildFixtureRepository("fallthrough", "work", [
    { files: { "README.md": "base\n" }, message: "base" },
    { files: { "README.md": "second\n" }, message: "second" },
  ]);
  const fallthroughBase = selectBase(fallthroughRepository);

  assert.equal(fallthroughBase.ok, true);
  assert.equal(fallthroughBase.candidate, "HEAD~1");

  // Every candidate failing is the only state that may refuse. Dropping the remote from a shallow
  // clone of the fall-through repository is what removes the upstream candidate as well, leaving the
  // shallow `HEAD~1` as the last to fail.
  const exhaustedRepository = cloneShallow(fallthroughRepository, "exhausted");

  fixtureGit(exhaustedRepository, ["remote", "remove", "origin"]);

  const exhaustedBase = selectBase(exhaustedRepository);

  assert.equal(exhaustedBase.ok, false);
  assert.deepEqual(
    exhaustedBase.attempted.map((entry) => entry.candidate),
    ["origin/main", "main", "@{upstream}", "HEAD~1"],
  );

  for (const entry of exhaustedBase.attempted) {
    assert.notEqual(entry.reason, undefined);
    assert.notEqual(entry.reason, "");
  }

  // A change set that resolved and simply held nothing pairable is a pass that still says what it
  // looked at. Committing the docs file on a branch off `main` is what leaves `main` selectable as
  // the base while the only change against it is unpairable.
  const docsOnlyRepository = await buildFixtureRepository("docs-only", "main", [
    { files: { "README.md": "base\n" }, message: "base" },
  ]);

  fixtureGit(docsOnlyRepository, ["checkout", "-q", "-b", "feature"]);
  await mkdir(path.join(docsOnlyRepository, "docs"), { recursive: true });
  await writeFile(path.join(docsOnlyRepository, "docs/guide.md"), "guidance\n");
  fixtureGit(docsOnlyRepository, ["add", "--all"]);
  fixtureGit(docsOnlyRepository, ["commit", "-q", "-m", "document the thing"]);

  const docsOnlyChangedPaths = changedPaths(docsOnlyRepository);

  assert.equal(docsOnlyChangedPaths.ok, true);
  assert.equal(docsOnlyChangedPaths.base, "main");
  assert.deepEqual(docsOnlyChangedPaths.paths, ["docs/guide.md"]);
  assert.deepEqual(docsOnlyChangedPaths.skipped, [
    { path: "docs/guide.md", reason: "outside both the production root and the test root" },
  ]);

  const docsOnlyPairs = pairsForChangedPaths(docsOnlyRepository);

  assert.equal(docsOnlyPairs.ok, true);
  assert.deepEqual(docsOnlyPairs.pairs, []);
  assert.deepEqual(docsOnlyPairs.skipped, docsOnlyChangedPaths.skipped);

  // The pairing state, and the one that decides whether the injected root reached BOTH halves of the
  // answer. The fixture carries a real source-test pair and a real structural supplement, so a root
  // threaded only as far as the change-set query would check the repository this harness runs in for
  // both of them: the pair member would come back missing though it exists here, and the supplement
  // would be classified as a pair member and abort the run on a module nobody wrote.
  const pairedSource = "extensions/pi-claude-marketplace/domain/probe.ts";
  const pairedTest = "tests/domain/probe.test.ts";
  const supplementSuite = "tests/domain/probe-fake.test.ts";
  const pairedRepository = await buildFixtureRepository("paired", "main", [
    {
      files: {
        "README.md": "base\n",
        [pairedSource]: "export const probe = 1;\n",
        [pairedTest]: "export const probeTest = 1;\n",
        "tests/domain/probe-fake.ts": "export const probeFake = 1;\n",
        "tests/domain/probe-contract.ts": "export const probeContract = 1;\n",
        [supplementSuite]: "export const probeFakeTest = 1;\n",
      },
      message: "base",
    },
  ]);

  fixtureGit(pairedRepository, ["checkout", "-q", "-b", "feature"]);
  await writeFile(path.join(pairedRepository, pairedSource), "export const probe = 2;\n");
  await writeFile(
    path.join(pairedRepository, supplementSuite),
    "export const probeFakeTest = 2;\n",
  );
  fixtureGit(pairedRepository, ["add", "--all"]);
  fixtureGit(pairedRepository, ["commit", "-q", "-m", "change the pair and the supplement"]);

  const pairedPairs = pairsForChangedPaths(pairedRepository);

  assert.equal(pairedPairs.ok, true);
  assert.equal(pairedPairs.base, "main");
  assert.deepEqual(pairedPairs.pairs, [{ sourcePath: pairedSource, testPath: pairedTest }]);
  assert.deepEqual(pairedPairs.skipped, [
    { path: supplementSuite, reason: "a structural supplement suite" },
  ]);

  // A git invocation that failed is a refusal, not an empty change set. This is the state that a
  // selector swallowing git's exit status cannot tell apart from the docs-only pass above.
  const notARepository = path.join(gitFixtureRoot, "not-a-repository");

  await mkdir(notARepository, { recursive: true });

  const notARepositoryChangedPaths = changedPaths(notARepository);

  assert.equal(notARepositoryChangedPaths.ok, false);
  assert.match(notARepositoryChangedPaths.reason, /rev-parse/);
  assert.match(notARepositoryChangedPaths.reason, /not a git repository/);
  assert.equal(pairsForChangedPaths(notARepository).ok, false);

  process.stdout.write(
    "Base-selection negative controls passed: chain head with no origin/main, chain tail in a shallow clone, resolved-but-empty docs-only change set, a fixture pair and supplement resolved under the injected root, failed selection outside a repository.\n",
  );
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
