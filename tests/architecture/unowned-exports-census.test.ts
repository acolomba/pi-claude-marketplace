/**
 * Exact production finding census.
 * Every category is pinned by identity, so additions, removals, and equal-count
 * swaps require review.
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertFindingCensus,
  readAnalyzerReport,
  type AnalyzerReport,
  type FindingGroups,
} from "./fallow-report.ts";
import { PRODUCTION_FINDING_CENSUS, UNOWNED_EXPORT_CENSUS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const ANALYZER = path.join(REPO_ROOT, "node_modules", "fallow", "bin", "fallow");

/** Complete production findings, with test readers excluded. */
const CENSUS_ARGS = [
  "dead-code",
  "--production",
  "--no-cache",
  "--format",
  "json",
  "--fail-on-issues",
];

/**
 * The shipping command, with no forced production flag.
 *
 * The `fallow` npm script invokes `dead-code` exactly this way, so this argv is
 * what the quality gate actually runs. Production reachability reaches it only
 * through the committed config, which is the point: if that config stops
 * requesting it, this command answers a different question than `CENSUS_ARGS`
 * and the equality clause below says so.
 */
const SHIPPING_ARGS = ["dead-code", "--no-cache", "--format", "json", "--fail-on-issues"];

/** Every finding category, so a clean report is asserted collection by collection. */
const EMPTY_FINDINGS: FindingGroups = {
  unused_exports: [],
  unused_types: [],
  unused_files: [],
  unused_class_members: [],
  duplicate_exports: [],
};

/** The measured census, keyed by publishing file exactly as the pin is. */
type Census = Record<string, string[]>;

/** Read the real analyzer's dead-code report over the repository. */
function readDeadCodeReport(args: readonly string[]): AnalyzerReport {
  return readAnalyzerReport(process.execPath, [ANALYZER, ...args], REPO_ROOT);
}

/** Project one report onto the census shape, with each file's names sorted. */
function censusFrom(report: AnalyzerReport): Census {
  const census: Census = {};
  for (const finding of report.findings.unused_exports) {
    (census[finding.path] ??= []).push(finding.export_name);
  }

  for (const names of Object.values(census)) {
    names.sort();
  }

  return census;
}

/** `path#exportName` for every member, so two censuses can be differenced. */
function keysOf(census: Readonly<Record<string, readonly string[]>>): Set<string> {
  const keys = new Set<string>();
  for (const [filePath, names] of Object.entries(census)) {
    for (const name of names) {
      keys.add(`${filePath}#${name}`);
    }
  }

  return keys;
}

/** Name what drifted in each direction, so a failure reads as a diff. */
function describeCensusDrift(measured: Census): string {
  const pinnedKeys = keysOf(UNOWNED_EXPORT_CENSUS);
  const measuredKeys = keysOf(measured);
  const appeared = [...measuredKeys].filter((key) => !pinnedKeys.has(key));
  const vanished = [...pinnedKeys].filter((key) => !measuredKeys.has(key));

  return [
    "D-07-19: the production-unowned-export census no longer matches UNOWNED_EXPORT_CENSUS",
    `  now unowned but not pinned (${appeared.length.toString()}): ${appeared.join(", ") || "none"}`,
    `  pinned but no longer unowned (${vanished.length.toString()}): ${vanished.join(", ") || "none"}`,
    "  Update the census in tests/architecture/gate-targets.ts in this same change",
    "  and record why the tree's export surface moved. The record is a measurement,",
    "  not an allow-list: it forgives nothing, in either direction.",
  ].join("\n");
}

test("D-07-19 / GGAT-04: the production-unowned-export census equals its committed pin", () => {
  const measured = censusFrom(readDeadCodeReport(CENSUS_ARGS));

  assert.deepStrictEqual(measured, UNOWNED_EXPORT_CENSUS, describeCensusDrift(measured));
});

test("The complete production finding census equals its committed identities", () => {
  // arrange
  const pinned = PRODUCTION_FINDING_CENSUS;

  // act
  const report = readDeadCodeReport(CENSUS_ARGS);
  const measured = report.findings;

  // assert
  assertFindingCensus(measured, pinned);
});

test("D-07-20: the shipping command and the explicit production command agree", () => {
  // arrange
  const production = readDeadCodeReport(CENSUS_ARGS);

  // act
  const shipping = readDeadCodeReport(SHIPPING_ARGS);

  // assert
  assert.deepStrictEqual(
    shipping,
    production,
    "D-07-20: the command the quality gate runs and the command this census runs no longer measure the same thing, so a finding can exist in one and not the other. Production reachability belongs in the committed config, not in a flag only the gate passes.",
  );
});

test("D-07-20: the shipping report is complete and entirely clean", () => {
  // arrange
  const shipping = readDeadCodeReport(SHIPPING_ARGS);

  // act
  const measured = {
    findings: shipping.findings,
    totalIssues: shipping.totalIssues,
    exitStatus: shipping.exitStatus,
  };

  // assert
  assert.ok(
    shipping.entryPointCount > 0,
    "D-07-20: the analyzer discovered no production entry point, so it reached no code and its empty report means nothing",
  );
  assert.deepStrictEqual(
    measured,
    { findings: EMPTY_FINDINGS, totalIssues: 0, exitStatus: 0 },
    "D-07-20 / EXPORT-02: the shipping dead-code report is no longer empty. Answer the finding with a real production consumer, a private declaration, a retirement, or an exact adjacent annotation -- never by pinning the identity here.",
  );
});
