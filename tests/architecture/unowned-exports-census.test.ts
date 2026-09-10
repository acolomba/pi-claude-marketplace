/**
 * tests/architecture/unowned-exports-census.test.ts -- the pinned census of
 * exports that no production consumer reads (D-07-19 / GGAT-04).
 *
 * WHAT THIS PIN IS. `UNOWNED_EXPORT_CENSUS` (`gate-targets.ts`) is the complete
 * measured set of exports whose only readers are tests. This gate re-measures it
 * with the repository's own analyzer and asserts EXACT set equality.
 *
 * WHAT THIS PIN IS NOT. It is not an allow-list, and nothing in it is forgiven.
 * An allow-list names entries it will keep excusing, silently and forever; this
 * set fails on an ADDITION, fails on a REMOVAL, and fails on a SWAP -- so any
 * change to the shape of the tree has to be written down here in the same commit
 * that causes it. That is the whole point: the deep comparison is what makes a
 * one-in-one-out exchange impossible to absorb, which a bare count would do
 * quietly. Both directions are proved by planting them, not assumed.
 *
 * WHY THE ANALYZER NEEDS `--production`. Under the committed configuration every
 * test file is an entry point, so a test import counts as a consumer and an
 * export read only by its own test looks alive. `--production` narrows the entry
 * points to the ones the published package declares, and the gap between the two
 * runs IS the blind spot: the benign control below runs the same command without
 * the flag and gets a clean report over the very same tree. `--production` is a
 * per-invocation flag, so `.fallowrc.json` is never written -- the deliberate
 * `production: false` setting stays exactly as it is, and this obligation lives
 * in a test rather than in a configuration file.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { UNOWNED_EXPORT_CENSUS } from "./gate-targets.ts";

import type { UnownedExport } from "./gate-targets.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ANALYZER = path.join(REPO_ROOT, "node_modules", "fallow", "bin", "fallow");

/** The census run: production entry points only, unused exports only. */
const CENSUS_ARGS = ["dead-code", "--production", "--unused-exports", "--format", "json"];

/** The same question asked with the committed entry-point set. */
const CONTROL_ARGS = ["dead-code", "--unused-exports", "--format", "json"];

/** The subset of the analyzer's JSON report this gate reads. */
interface DeadCodeReport {
  readonly total_issues: number;
  readonly entry_points: { readonly total: number };
  readonly unused_exports: readonly { readonly path: string; readonly export_name: string }[];
}

/**
 * Run the analyzer with a fixed argument vector and no shell, so no flag or path
 * can be word-split or reinterpreted, and surface its own stderr when the
 * invocation itself fails. A run that never produced a report must fail this
 * gate rather than hand an empty payload to the comparison below.
 */
function readDeadCodeReport(args: readonly string[]): DeadCodeReport {
  const execution = spawnSync(process.execPath, [ANALYZER, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (execution.error !== undefined) {
    throw execution.error;
  }

  assert.strictEqual(
    execution.signal,
    null,
    `GGAT-04: the analyzer was terminated by ${String(execution.signal)}, so the census was never measured`,
  );
  assert.ok(
    execution.status === 0 || execution.status === 1,
    `GGAT-04: the analyzer exited ${String(execution.status)} rather than reporting findings:\n${execution.stderr}`,
  );

  return JSON.parse(execution.stdout) as DeadCodeReport;
}

/** Path first, then export name -- the order the committed census is written in. */
function byPathThenExportName(left: UnownedExport, right: UnownedExport): number {
  if (left.path !== right.path) {
    return left.path < right.path ? -1 : 1;
  }

  if (left.exportName === right.exportName) {
    return 0;
  }

  return left.exportName < right.exportName ? -1 : 1;
}

/** Project one report onto the census shape, in the census order. */
function censusFrom(report: DeadCodeReport): UnownedExport[] {
  return report.unused_exports
    .map((finding) => ({ exportName: finding.export_name, path: finding.path }))
    .sort(byPathThenExportName);
}

/** `path#exportName` -- the identity a census entry is compared by. */
function entryKey(entry: UnownedExport): string {
  return `${entry.path}#${entry.exportName}`;
}

/** Name what drifted in each direction, so a failure reads as a diff. */
function describeCensusDrift(measured: readonly UnownedExport[]): string {
  const pinnedKeys = new Set(UNOWNED_EXPORT_CENSUS.map(entryKey));
  const measuredKeys = new Set(measured.map(entryKey));
  const appeared = measured.filter((entry) => !pinnedKeys.has(entryKey(entry))).map(entryKey);
  const vanished = UNOWNED_EXPORT_CENSUS.filter((entry) => !measuredKeys.has(entryKey(entry))).map(
    entryKey,
  );

  return [
    `D-07-19: the production-unowned-export census no longer matches UNOWNED_EXPORT_CENSUS`,
    `  now unowned but not pinned (${appeared.length.toString()}): ${appeared.join(", ") || "none"}`,
    `  pinned but no longer unowned (${vanished.length.toString()}): ${vanished.join(", ") || "none"}`,
    `  Update the census in tests/architecture/gate-targets.ts in this same change`,
    `  and record why the tree's export surface moved. The list is a measurement,`,
    `  not an allow-list: it forgives nothing, in either direction.`,
  ].join("\n");
}

test("D-07-19 / GGAT-04: the production-unowned-export census equals its committed pin", () => {
  const measured = censusFrom(readDeadCodeReport(CENSUS_ARGS));

  // A run that produced nothing must not deep-equal an accidentally-empty pin
  // and report success. The tree has unowned exports; measuring none means the
  // instrument, not the tree, changed.
  assert.ok(
    measured.length > 0,
    "GGAT-04: the analyzer reported zero unowned exports, so the census measured nothing",
  );
  assert.deepStrictEqual(measured, UNOWNED_EXPORT_CENSUS, describeCensusDrift(measured));
});

test("D-07-20: the same question over the committed entry points reports nothing, which is the blind spot", () => {
  const control = readDeadCodeReport(CONTROL_ARGS);
  const census = readDeadCodeReport(CENSUS_ARGS);

  // Same command, same tree, one flag apart. Every test file is an entry point
  // here, so a test import counts as a consumer and every export in the pinned
  // census reads as alive. This contrast is the reason the census gate exists,
  // and it is also why the obligation cannot be met by reading configuration:
  // the clean report is what the committed configuration honestly produces.
  assert.strictEqual(
    control.total_issues,
    0,
    "D-07-20: the committed entry-point set now reports findings of its own, so this run no longer isolates the entry-point blind spot",
  );
  assert.deepStrictEqual(control.unused_exports, []);
  assert.ok(
    control.entry_points.total > census.entry_points.total,
    `D-07-20: the committed run resolved ${control.entry_points.total.toString()} entry points and the production run ${census.entry_points.total.toString()}; the blind spot is that difference, and it has closed`,
  );
});
