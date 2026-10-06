import path from "node:path";
import { Readable } from "node:stream";
import { spec } from "node:test/reporters";

/**
 * A node:test reporter with a quiet local mode and a full CI mode. Locally, a
 * passing run prints nothing beyond what the tests themselves write and Node's
 * diagnostics. The built-in reporters either print every test (`spec`, `tap`,
 * `junit`) or drop the summary and the coverage-threshold message (`dot`).
 * Failures still go through Node's `spec` reporter, so they keep Node's own
 * diffs, causes, and locations. The count line follows a failed or cancelled
 * test or an unmet coverage threshold. Skipped and todo counts alone print
 * nothing locally: they track the environment. In CI, when the `CI`
 * environment variable is not empty (GitHub Actions sets it), every event goes
 * to `spec`, so passes, skips, todo tests, coverage tables, and the counts all
 * print.
 */

const countPrefixes = [
  "tests ",
  "suites ",
  "pass ",
  "fail ",
  "cancelled ",
  "skipped ",
  "todo ",
  "duration_ms ",
];
const thresholdPattern = /(line|branch|function) coverage does not meet threshold of ([\d.]+)%/;
const failedCountPattern = /^(?:fail|cancelled) [1-9]/;
const percentKeys = {
  line: "coveredLinePercent",
  branch: "coveredBranchPercent",
  function: "coveredFunctionPercent",
};

// `test:start` is dropped together with `test:pass`, so spec's start/finish
// pairing stays valid.
const forwarded = new Set(["test:fail", "test:stdout", "test:stderr", "test:diagnostic"]);

function isCount(event) {
  return (
    event.type === "test:diagnostic" &&
    event.data.nesting === 0 &&
    countPrefixes.some((prefix) => event.data.message.startsWith(prefix))
  );
}

function recordThreshold(message, unmet) {
  const match = thresholdPattern.exec(message);
  if (match) {
    unmet.set(match[1], Number(match[2]));
  }
}

async function* forwardedEvents(source, state) {
  for await (const event of source) {
    if (isCount(event)) {
      state.counts.push(event.data.message);
    } else if (event.type === "test:coverage") {
      state.coverage = event.data.summary;
    } else if (forwarded.has(event.type)) {
      if (event.type === "test:diagnostic") {
        recordThreshold(event.data.message, state.unmet);
      }

      yield event;
    }
  }
}

/** One line per file below the threshold of each metric that the run reported as unmet. */
function shortfallLines({ coverage, unmet }) {
  if (coverage === undefined || unmet.size === 0) {
    return [];
  }

  return coverage.files.flatMap((file) => {
    const metrics = [...unmet]
      .filter(([metric, threshold]) => file[percentKeys[metric]] < threshold)
      .map(([metric]) => `${metric} ${file[percentKeys[metric]].toFixed(2)}%`);
    const relative = path.relative(coverage.workingDirectory, file.path);
    return metrics.length > 0
      ? [`coverage below threshold: ${relative} (${metrics.join(", ")})\n`]
      : [];
  });
}

function runFailed(state) {
  return state.unmet.size > 0 || state.counts.some((count) => failedCountPattern.test(count));
}

// fallow-ignore-next-line unused-export -- `node --test --test-reporter` loads this default.
export default async function* failureReporter(source) {
  if (process.env.CI) {
    yield* Readable.from(source).pipe(new spec());
    return;
  }

  const state = { counts: [], coverage: undefined, unmet: new Map() };
  yield* Readable.from(forwardedEvents(source, state)).pipe(new spec());
  yield* shortfallLines(state);
  if (state.counts.length > 0 && runFailed(state)) {
    yield `${state.counts.join(", ")}\n`;
  }
}
