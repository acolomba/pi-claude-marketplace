/**
 * tests/architecture/unowned-exports-census.test.ts -- the pinned census of
 * exports that no production consumer reads (D-07-19 / GGAT-04).
 *
 * WHAT THIS PIN IS. `UNOWNED_EXPORT_CENSUS` (`gate-targets.ts`) is the complete
 * measured set of exports whose only readers are tests. This gate re-measures it
 * with the repository's own analyzer and asserts EXACT equality.
 *
 * WHAT THIS PIN IS NOT. It is not an allow-list, and nothing in it is forgiven.
 * An allow-list names entries it will keep excusing, silently and forever; this
 * set fails on an ADDITION, fails on a REMOVAL, and fails on a SWAP -- so any
 * change to the export surface of the tree has to be written down in the same
 * commit that causes it. That is the whole point: the deep comparison is what
 * makes a one-in-one-out exchange impossible to absorb, which a bare count would
 * do quietly. Both directions are proved by planting them, not assumed.
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
 *
 * The dispositions record this file also gates is the other half of the same
 * obligation: `D-07-17` allows a finding to be recorded as already-closed, but
 * only against evidence measured this cycle, and a record nobody checks drifts
 * out of step with the ledger it summarizes exactly as a stale gate does.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FINDING_DISPOSITIONS_REL, UNOWNED_EXPORT_CENSUS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const ANALYZER = path.join(REPO_ROOT, "node_modules", "fallow", "bin", "fallow");

/** The census run: production entry points only, unused exports only. */
const CENSUS_ARGS = ["dead-code", "--production", "--unused-exports", "--format", "json"];

/** The same question asked with the committed entry-point set. */
const CONTROL_ARGS = ["dead-code", "--unused-exports", "--format", "json"];

/** The measured census, keyed by publishing file exactly as the pin is. */
type Census = Record<string, string[]>;

/** The subset of the analyzer's JSON report this gate reads. */
interface DeadCodeReport {
  readonly total_issues: number;
  readonly entry_points: { readonly total: number };
  readonly unused_exports: readonly { readonly path: string; readonly export_name: string }[];
}

/**
 * Every finding the live evidence ledger routed to this phase, plus the two
 * effective-config gaps and the deferred twin whose instance closed with them.
 *
 * The set is closed on purpose: the dispositions record answers for all of them
 * or it answers for none, because a record that quietly drops a row reads
 * exactly like a record whose findings were all resolved.
 */
const ROUTED_FINDINGS = [
  "OMR-F01",
  "OMRR-F004",
  "OPEF-F01",
  "OPIB-F07",
  "DCORE-030",
  "SCN-F025",
  "HHD-027",
  "HHD-028",
  "OPLU-A-F07",
  "OPLU-B-F15",
  "SHC-F046",
  "SHC-F047",
  "OPEFR-F007",
  "ABG-004",
  "AHG-014",
  "ORA-F32",
] as const;

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

/** Project one report onto the census shape, with each file's names sorted. */
function censusFrom(report: DeadCodeReport): Census {
  const census: Census = {};
  for (const finding of report.unused_exports) {
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

  // A run that produced nothing must not deep-equal an accidentally-empty pin
  // and report success. The tree has unowned exports; measuring none means the
  // instrument, not the tree, changed.
  assert.ok(
    keysOf(measured).size > 0,
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

/**
 * The record row that answers for one finding: its id in the leading cell, a
 * status naming a disposition, and a non-empty evidence cell.
 *
 * The row is what the check reads, not the bare id, because a record that
 * mentions an id in a heading, a footnote or a changelog line answers nothing
 * -- and an unanchored substring probe cannot tell those apart from a real
 * answer. Anchoring to the leading cell also removes the aliasing hazard
 * between ids that prefix one another (`OPEF-F01` and `OPEFR-F007` are one
 * character apart).
 */
function dispositionRow(finding: string): RegExp {
  // Every cell is spelled without `\s`, which would match a newline and let a
  // row with an empty cell borrow the next row's text to satisfy this.
  const cell = String.raw`[^|\n]*\S[^|\n]*`;
  const status = String.raw`[^|\n]*\b(?:closed|open|deferred)\b[^|\n]*`;
  const gap = String.raw`[^\S\n]*`;

  return new RegExp(
    String.raw`^\|${gap}\x60${finding}\x60${gap}\|${cell}\|${status}\|${cell}\|${cell}\|${gap}$`,
    "m",
  );
}

test("D-07-17: the dispositions record answers for every routed finding", async () => {
  // arrange
  const record = await readFile(path.join(REPO_ROOT, FINDING_DISPOSITIONS_REL), "utf8");

  // act
  const unanswered = ROUTED_FINDINGS.filter((finding) => !dispositionRow(finding).test(record));

  // assert
  assert.deepStrictEqual(
    unanswered,
    [],
    `D-07-17: ${FINDING_DISPOSITIONS_REL} carries no answering row for ${unanswered.join(", ")}. A finding routed here is answered by a record row naming it, a status of closed, open or deferred, the work that closed it, and evidence -- or it is not answered at all. A record that drops a row, or that only mentions an id in prose, reads exactly like a record whose findings were all resolved.`,
  );
});
