/**
 * The whole-tree direct-coverage report: every source-test pair measured, one JSON object per line,
 * no verdict filed.
 *
 * It reads no record of which shortfalls are accepted, which is what keeps it independent of the
 * gate it generates the coverage pin for. `shortfallReadingOf` does not weaken that: it parses the
 * gate's own refusal message and consults nothing, so what this tool knows is still exactly what the
 * gate answered for the pair in front of it.
 */

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertReportComplete,
  pairForPath,
  productionPaths,
  runPair,
  shortfallReadingOf,
} from "./test-coverage-direct.mjs";

const usage = `Usage: node scripts/test-coverage-direct.report.mjs <report-path>

Records the direct-coverage gate's verdict for every source-test pair, one JSON
object per line.

This is a reporting tool, not a gate. It files no verdict, and its exit code is
not a coverage verdict: a zero says the report was written, nothing more.

The gate arms are \`npm run test:coverage:direct\`,
\`npm run test:coverage:direct:commit\` and \`npm run test:coverage:direct:all\`.
They measure every pair they select and compare every reading they took against
\`scripts/test-coverage-direct.pin.json\`, refusing any divergence in either
direction. This tool compares against nothing, which is why it survives a pin
mismatch and they do not.
`;

/**
 * The verdict for one pair, given what the gate answered for it: the coverage summary it returned,
 * or the error it threw.
 *
 * A shortfall is recorded because recording it is the whole point -- this tool files no verdict, so
 * a refused row is a reading like any other and belongs in the report beside the complete ones.
 * Every other refusal propagates. A focused test that failed, or an LCOV that could not be read, is
 * not a coverage verdict, and a report that filed it as one would be reporting on a tree it never
 * measured. The message has to name THIS pair's source for the same reason.
 *
 * `accepted-shortfall` is the retained artifact's vocabulary for a refused row, not a claim this
 * report can make on its own: it does not read the broken-windows ledger and so cannot tell an
 * accepted shortfall from a new one. Compare the rows it emits against
 * `scripts/test-coverage-direct.pin.json`, which is the machine-readable record; CONTRIBUTING.md's
 * table is a rendering of it.
 */
export function verdictFor(sourcePath, answer) {
  if (typeof answer === "string") {
    return {
      verdict: answer === "type-only" ? "type-only" : "complete",
      coverage: answer,
      exitCode: 0,
    };
  }

  const reading = shortfallReadingOf(answer, sourcePath);

  if (reading === undefined) {
    throw answer;
  }

  return { verdict: "accepted-shortfall", coverage: reading, exitCode: 1 };
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

  // The callback passes exactly one argument. `pairForPath` takes a repository root as its second
  // parameter, and `Array.prototype.map` supplies the element index there, which resolves a path
  // against a number.
  for (const pair of modulePaths.map((modulePath) => pairForPath(modulePath))) {
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
