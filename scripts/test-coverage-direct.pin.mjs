/**
 * The committed pin of direct-coverage shortfalls, and the comparison the gate arms run against it
 * (`D-08-05`, `D-08-07`, `RCOV-02`).
 *
 * JSON carries no comment, so what the pin is -- and what it is not -- is stated here, in the
 * module that reads it.
 *
 * WHAT THIS PIN IS. `scripts/test-coverage-direct.pin.json` is the complete measured set of
 * source-test pairs whose direct coverage falls short, each row carrying the gate's own reading
 * string, the finding ids that authorize it, and one recorded reason per uncovered site. Every row
 * is a fact about the tree as it stands, produced by running the gate, never by copying a figure
 * out of a document.
 *
 * WHAT THIS PIN IS NOT. It is not an allow-list, and nothing in it is forgiven. An allow-list names
 * entries it will keep excusing, silently and forever; this set fails on an ADDITION, fails on a
 * REMOVAL, and fails on a SWAP. A module that falls short and is absent fails. A pinned module
 * whose reading changed -- better or worse -- fails. A pinned module that now reads complete fails
 * as a stale row. A row naming a module the tree no longer enumerates fails with no test run at
 * all. So any change to the tree's coverage surface has to be written down in the same commit that
 * causes it. Both directions are proved by planting them in
 * `scripts/test-coverage-direct.negative.mjs`, not assumed.
 *
 * The rows are sorted by `sourcePath`, and that order is part of the pin: the comparator sorts what
 * it measured the same way, so a reordering can never be mistaken for a change and a change can
 * never hide inside a reordering.
 *
 * The two halves are kept apart on purpose. `loadCoveragePin` is thin I/O and takes the repository
 * root as its last parameter, matching every other root-aware function in the gate, so a harness
 * can plant more than one pin in one process. `assertPinnedReadings` is pure: it reads no disk,
 * which is what lets every divergence class be planted as an in-memory array with no fixture tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pinProjectPath = "scripts/test-coverage-direct.pin.json";

// Repeated in every refusal, because the failure has to say what to do about it at the point it
// fires rather than in a document the reader has to go and find.
const updateInstruction = [
  `  Update ${pinProjectPath} in this same change and record why the tree's`,
  "  coverage surface moved. The record is a measurement, not an allow-list:",
  "  it forgives nothing, in either direction.",
].join("\n");

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/** Why one parsed row is not a pin row, or `undefined` when it is one. */
function rowRefusal(row) {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return "a row is not an object";
  }

  if (!isNonEmptyString(row.sourcePath)) {
    return "a row has no sourcePath string";
  }

  if (!isNonEmptyString(row.reading)) {
    return `row ${row.sourcePath} has no reading string`;
  }

  if (!isNonEmptyStringArray(row.findingIds)) {
    return `row ${row.sourcePath} has no findingIds array of non-empty strings`;
  }

  if (!isNonEmptyStringArray(row.reasons)) {
    return `row ${row.sourcePath} has no reasons array of non-empty strings`;
  }

  return undefined;
}

/** Why the parsed pin is not a pin, or `undefined` when it is one. */
function pinRefusal(pin) {
  if (typeof pin !== "object" || pin === null || Array.isArray(pin)) {
    return "the pin is not an object";
  }

  if (pin.version !== 1) {
    return `the pin declares version ${JSON.stringify(pin.version)}, not 1`;
  }

  if (!Array.isArray(pin.rows)) {
    return "the pin has no rows array";
  }

  const seen = new Set();

  for (const row of pin.rows) {
    const refusal = rowRefusal(row);

    if (refusal !== undefined) {
      return refusal;
    }

    if (seen.has(row.sourcePath)) {
      return `two rows carry the same sourcePath: ${row.sourcePath}`;
    }

    seen.add(row.sourcePath);
  }

  return undefined;
}

/**
 * The pin's rows, read from the selected repository and refused rather than coerced when the shape
 * is not the one the comparator expects.
 *
 * The file is read and parsed rather than imported as a JSON module: a static import is hoisted and
 * module-cached, so it could not be pointed at an injected root and a second planted pin would read
 * the first.
 */
export function loadCoveragePin(selectedProjectRoot = projectRoot) {
  const pinPath = path.join(selectedProjectRoot, pinProjectPath);
  let pin;

  try {
    pin = JSON.parse(readFileSync(pinPath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Coverage pin ${pinPath} could not be read: ${detail}\n` +
        `  The gate compares every measured shortfall against ${pinProjectPath},\n` +
        "  so a pin it cannot read is a refusal rather than an empty set.",
      { cause: error },
    );
  }

  const refusal = pinRefusal(pin);

  if (refusal !== undefined) {
    throw new Error(
      `Coverage pin ${pinPath} is malformed: ${refusal}\n` +
        "  Each row carries a sourcePath, the gate's own reading string, a non-empty\n" +
        "  findingIds array, and one reason per uncovered site.",
    );
  }

  return pin.rows;
}

function comparePinPath(left, right) {
  if (left.sourcePath === right.sourcePath) {
    return 0;
  }

  return left.sourcePath < right.sourcePath ? -1 : 1;
}

/**
 * A pinned module the tree no longer enumerates is refused before anything is measured.
 *
 * This is the only refusal that needs no test run at all, and it is what stops a deleted module
 * leaving behind a row nothing can ever contradict -- the precise hole a pin exists to close.
 */
function assertPinnedModulesEnumerated(rows, enumeratedModules) {
  const enumerated = new Set(enumeratedModules);
  const unknown = rows
    .filter((row) => !enumerated.has(row.sourcePath))
    .map((row) => row.sourcePath);

  if (unknown.length > 0) {
    throw new Error(
      [
        `Coverage pin rows name ${unknown.length.toString()} module(s) the tree no longer enumerates:`,
        `  ${unknown.join(", ")}`,
        updateInstruction,
      ].join("\n"),
    );
  }
}

/**
 * An emptied pin with a shortfall present is its own refusal, and a different direction from an
 * unpinned addition: a record that measured nothing must not read as success.
 */
function assertPinPopulated(rows, readings) {
  if (rows.length === 0 && readings.length > 0) {
    throw new Error(
      [
        `The coverage pin holds no rows, but ${readings.length.toString()} module(s) fell short:`,
        `  ${readings.map((reading) => reading.sourcePath).join(", ")}`,
        updateInstruction,
      ].join("\n"),
    );
  }
}

/** Both drift directions in one message, so a failure reads as a diff rather than as one half. */
function assertPinMembership(rows, readings) {
  const pinned = new Set(rows.map((row) => row.sourcePath));
  const measured = new Set(readings.map((reading) => reading.sourcePath));
  const appeared = [...measured].filter((sourcePath) => !pinned.has(sourcePath));
  const vanished = [...pinned].filter((sourcePath) => !measured.has(sourcePath));

  if (appeared.length === 0 && vanished.length === 0) {
    return;
  }

  throw new Error(
    [
      `D-08-05: the measured direct-coverage shortfalls no longer match ${pinProjectPath}`,
      `  fell short but is not pinned (${appeared.length.toString()}): ${appeared.join(", ") || "none"}`,
      `  pinned but no longer falls short (${vanished.length.toString()}): ${vanished.join(", ") || "none"}`,
      updateInstruction,
    ].join("\n"),
  );
}

/** The whole reading string is compared, so a reading that improved fails exactly as one that fell. */
function assertPinnedReadingsUnmoved(rows, readings) {
  const pinnedReadings = new Map(rows.map((row) => [row.sourcePath, row.reading]));

  for (const reading of readings) {
    const pinnedReading = pinnedReadings.get(reading.sourcePath);

    if (pinnedReading !== undefined && pinnedReading !== reading.reading) {
      throw new Error(
        [
          `Pinned direct-coverage reading moved for ${reading.sourcePath}`,
          `  pinned: ${pinnedReading}`,
          `  measured: ${reading.reading}`,
          updateInstruction,
        ].join("\n"),
      );
    }
  }
}

/**
 * Compare what a gate arm measured against the committed pin, exactly and in both directions.
 *
 * `enumeratedModules` is supplied by the caller rather than read here, because
 * `scripts/test-coverage-direct.mjs` imports this module and importing its enumeration back would
 * close a cycle.
 *
 * The structural check runs first: it is the one refusal that needs nothing measured, so a pin row
 * naming a module that is gone is refused even on a run that measured no shortfall at all.
 */
export function assertPinnedReadings(observed, pinRows, enumeratedModules) {
  const rows = [...pinRows].sort(comparePinPath);
  const readings = [...observed].sort(comparePinPath);

  assertPinnedModulesEnumerated(rows, enumeratedModules);
  assertPinPopulated(rows, readings);
  assertPinMembership(rows, readings);
  assertPinnedReadingsUnmoved(rows, readings);
}
