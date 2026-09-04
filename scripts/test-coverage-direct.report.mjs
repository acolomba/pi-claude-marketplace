import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertReportComplete,
  pairForPath,
  productionPaths,
  runPair,
} from "./test-coverage-direct.mjs";

const usage = `Usage: node scripts/test-coverage-direct.report.mjs <report-path>

Records the direct-coverage gate's verdict for every source-test pair, one JSON
object per line.

This is a reporting tool, not a gate. It does not stop at a coverage shortfall,
and its exit code is not a coverage verdict: a zero says the report was written,
nothing more. The gate is \`npm run test:coverage:direct\` and
\`npm run test:coverage:direct:all\`, which still refuse a shortfall.
`;

// How the gate states a shortfall, and the only refusal this report records rather than propagates.
const shortfallPattern = /^Incomplete direct coverage for (?<sourcePath>[^:]+): (?<counts>.+)$/;

/**
 * The verdict for one pair, given what the gate answered for it: the coverage summary it returned,
 * or the error it threw.
 *
 * A shortfall is recorded because recording it is the whole point -- the gate stops at the first
 * one, so nothing downstream of it ever sees the rest of the tree. Every other refusal propagates.
 * A focused test that failed, or an LCOV that could not be read, is not a coverage verdict, and a
 * report that filed it as one would be reporting on a tree it never measured. The message has to
 * name THIS pair's source for the same reason.
 *
 * `accepted-shortfall` is the retained artifact's vocabulary for a refused row, not a claim this
 * report can make on its own: it does not read the broken-windows ledger and so cannot tell an
 * accepted shortfall from a new one. Compare the rows it emits against the readings documented in
 * CONTRIBUTING.md.
 */
export function verdictFor(sourcePath, answer) {
  if (typeof answer === "string") {
    return {
      verdict: answer === "type-only" ? "type-only" : "complete",
      coverage: answer,
      exitCode: 0,
    };
  }

  const match = shortfallPattern.exec(answer.message);

  if (match === null || match.groups.sourcePath !== sourcePath) {
    throw answer;
  }

  return { verdict: "accepted-shortfall", coverage: match.groups.counts, exitCode: 1 };
}

async function rowFor(pair) {
  const startedAt = process.hrtime.bigint();
  let answer;

  try {
    answer = (await runPair(pair)).coverage;
  } catch (error) {
    answer = error instanceof Error ? error : new Error(String(error));
  }

  return {
    sourcePath: pair.sourcePath,
    testPath: pair.testPath,
    ...verdictFor(pair.sourcePath, answer),
    runtime: process.version,
    elapsedMs: Number((process.hrtime.bigint() - startedAt) / 1000000n),
  };
}

function tallyOf(records) {
  const counts = new Map();

  for (const record of records) {
    counts.set(record.verdict, (counts.get(record.verdict) ?? 0) + 1);
  }

  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([verdict, count]) => `${verdict} ${count}`)
    .join(", ");
}

async function main() {
  const reportPath = process.argv[2];

  if (reportPath === "--help") {
    process.stdout.write(usage);
    return;
  }

  if (reportPath === undefined || process.argv.length > 3) {
    process.stderr.write(usage);
    process.exitCode = 1;
    return;
  }

  const modulePaths = productionPaths();
  const startedAt = process.hrtime.bigint();

  // Written as each row lands, for the reason the gate's own retained report is: an interrupted run
  // still leaves a readable partial result.
  writeFileSync(reportPath, "");

  for (const pair of modulePaths.map(pairForPath)) {
    const record = await rowFor(pair);
    appendFileSync(reportPath, `${JSON.stringify(record)}\n`);

    // The accepted rows already announced themselves through the gate. A refused row prints nothing
    // on its own, so it would otherwise be visible only after the run ended.
    if (record.exitCode !== 0) {
      process.stdout.write(
        `Direct coverage shortfall: ${record.sourcePath} (${record.coverage})\n`,
      );
    }
  }

  // Read the rows back out of the report rather than out of an in-memory array, so a lost append or
  // a clobbered file is caught. See `assertReportComplete` in the gate for why the witness matters.
  const written = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assertReportComplete(written, modulePaths);

  const elapsedSeconds = (Number((process.hrtime.bigint() - startedAt) / 1000000n) / 1000).toFixed(
    1,
  );

  process.stdout.write(
    `All-pair report written: ${written.length} rows in ${elapsedSeconds}s on ${process.version} to ${reportPath}\n`,
  );
  process.stdout.write(`Verdicts: ${tallyOf(written)}\n`);
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
