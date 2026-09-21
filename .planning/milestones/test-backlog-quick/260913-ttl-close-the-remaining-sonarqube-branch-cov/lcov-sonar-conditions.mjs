// Reproduces SonarQube's uncovered-condition reading from local lcov reports.
//
// Sonar merges several lcov reports by taking, for each (file, line), the
// maximum condition total and the maximum covered count across the reports,
// then sums total - covered. This script models that rule so the reading can
// be checked locally, and it attributes every offending line back to the
// reports that mention it -- a line only one report mentions has nothing to be
// maxed against, which is how partial-surface reports manufacture conditions
// that do not exist in the source.
//
// Usage:
//   node lcov-sonar-conditions.mjs                      # all three reports
//   node lcov-sonar-conditions.mjs coverage/unit.lcov   # one report
//
// Exits non-zero when any uncovered condition remains.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const DEFAULT_REPORTS = ["coverage/unit.lcov", "coverage/integration.lcov", "coverage/e2e.lcov"];
const ANALYZED_PREFIX = "extensions/";

/** Parses one lcov report into file -> line -> { total, covered }. */
function parseReport(path) {
  const files = new Map();
  let currentFile = null;

  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const record = raw.trim();

    if (record.startsWith("SF:")) {
      const sourceFile = record.slice(3);
      currentFile = sourceFile.startsWith(ANALYZED_PREFIX) ? sourceFile : null;

      if (currentFile !== null && !files.has(currentFile)) {
        files.set(currentFile, new Map());
      }

      continue;
    }

    if (record === "end_of_record") {
      currentFile = null;
      continue;
    }

    if (currentFile === null || !record.startsWith("BRDA:")) {
      continue;
    }

    const [line, , , taken] = record.slice("BRDA:".length).split(",");
    const lines = files.get(currentFile);
    const counts = lines.get(line) ?? { total: 0, covered: 0 };

    counts.total += 1;

    if (taken !== "-" && Number(taken) > 0) {
      counts.covered += 1;
    }

    lines.set(line, counts);
  }

  return files;
}

/** Merges parsed reports with Sonar's per-line maximum of both counts. */
function mergeReports(reports) {
  const merged = new Map();

  for (const { files } of reports) {
    for (const [file, lines] of files) {
      const target = merged.get(file) ?? new Map();

      for (const [line, counts] of lines) {
        const current = target.get(line) ?? { total: 0, covered: 0 };

        target.set(line, {
          total: Math.max(current.total, counts.total),
          covered: Math.max(current.covered, counts.covered),
        });
      }

      merged.set(file, target);
    }
  }

  return merged;
}

/** Renders one report's counts at a line, or `-` when it has no record there. */
function attribute(report, file, line) {
  const counts = report.files.get(file)?.get(line);

  return `${report.label}=${counts === undefined ? "-" : `${counts.covered}/${counts.total}`}`;
}

const reportPaths = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_REPORTS;
const reports = reportPaths.map((path) => ({
  label: basename(path).replace(/\.lcov$/, ""),
  files: parseReport(path),
}));

const merged = mergeReports(reports);
let uncoveredConditions = 0;
let offendingFiles = 0;

for (const file of [...merged.keys()].sort()) {
  const offending = [...merged.get(file).entries()]
    .filter(([, counts]) => counts.covered < counts.total)
    .sort(([a], [b]) => Number(a) - Number(b));

  if (offending.length === 0) {
    continue;
  }

  offendingFiles += 1;
  const fileTotal = offending.reduce((sum, [, c]) => sum + (c.total - c.covered), 0);
  uncoveredConditions += fileTotal;
  console.log(`${file}  ${fileTotal} uncovered`);

  for (const [line, counts] of offending) {
    console.log(`  ${line}:${counts.covered}/${counts.total}`);
    console.log(`    ${reports.map((report) => attribute(report, file, line)).join("  ")}`);
  }
}

console.log(`\nreports: ${reportPaths.join(", ")}`);
console.log(`TOTAL: ${uncoveredConditions} uncovered conditions across ${offendingFiles} files`);
process.exitCode = uncoveredConditions === 0 ? 0 : 1;
