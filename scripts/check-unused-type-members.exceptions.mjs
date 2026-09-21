import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { AnalysisSetupError } from "./check-unused-type-members.model.mjs";

/**
 * The recorded-decision list the gate's EXIT STATUS consults, and nothing else.
 *
 * MEMBER-02: the analyzer never excuses a member. It reports what it measured,
 * and `check-unused-type-members.audit.mjs` records that measurement unchanged,
 * so the live population keeps counting every unread member whether or not a
 * decision accepts it. This module is the separate, later step where a human
 * decision -- one per member, each naming where the decision is recorded and the
 * mechanism that was measured -- stops a known member from failing the build.
 *
 * Three properties are structural rather than conventional, because a residual
 * allowance that can be widened quietly is the failure this whole gate exists to
 * prevent:
 *
 *   - an entry names ONE member by exact path, line, column, owner and key. The
 *     identity pattern admits no glob character and no count, so "everything
 *     under platform/" and "at most six" cannot be written down at all;
 *   - an entry that matches no reported finding is a SETUP FAILURE, not a
 *     harmless leftover. A repaired member therefore takes its own allowance
 *     with it, and a coordinate that drifted refuses the run instead of
 *     excusing whatever now sits at those coordinates;
 *   - `unsupported` findings can never be excused. That status is the analyzer
 *     saying it could not decide, and excusing a non-decision is laundering.
 */

const exceptionsFileName = "check-unused-type-members.exceptions.json";

/**
 * `path:line:column`, where the path carries no glob metacharacter and no
 * whitespace. A pattern is refused by the shape of the field, so the list
 * cannot grow by widening one row.
 */
const identityPattern = /^[^\s:*?[\]{}]+:[1-9][0-9]*:[1-9][0-9]*$/;

const requiredFields = ["id", "owner", "key", "decision", "mechanism"];
const allowedFields = new Set(requiredFields);

/**
 * The shortest mechanism this file accepts. A measured mechanism states what was
 * tried and what was observed, which does not fit in a few words; a floor stops
 * `"intentional"` from passing for one. It is a minimum on ONE row's prose, not
 * a threshold on how many rows there may be.
 */
const minimumMechanismLength = 120;

function refuse(detail) {
  throw new AnalysisSetupError(`Invalid exception: ${detail}`);
}

function requireString(entry, field, where) {
  const value = entry[field];

  if (typeof value !== "string" || value.trim() === "") {
    refuse(`${where} needs a non-empty ${field}`);
  }

  return value;
}

function checkFields(entry, where) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    refuse(`${where} is not an object`);
  }

  for (const field of Object.keys(entry)) {
    if (!allowedFields.has(field)) {
      refuse(
        `${where} carries an unknown field ${field}; only ${requiredFields.join(", ")} are accepted, so a count, a threshold or a pattern cannot be written down`,
      );
    }
  }
}

function readEntry(entry, index) {
  const where = `entry ${index}`;
  checkFields(entry, where);

  const id = requireString(entry, "id", where);

  if (!identityPattern.test(id)) {
    refuse(
      `${where} names ${id}, which is not one exact member identity of the form path:line:column with no pattern character`,
    );
  }

  const mechanism = requireString(entry, "mechanism", where);

  if (mechanism.length < minimumMechanismLength) {
    refuse(
      `${id} states a ${mechanism.length}-character mechanism; a measured mechanism needs at least ${minimumMechanismLength} characters, so an unexplained allowance cannot be recorded as an explained one`,
    );
  }

  return {
    id,
    owner: requireString(entry, "owner", where),
    key: requireString(entry, "key", where),
    decision: requireString(entry, "decision", where),
    mechanism,
  };
}

function parseFile(text, filePath) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    refuse(`${filePath} is not parsable JSON: ${error instanceof Error ? error.message : error}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    refuse(`${filePath} does not hold an object`);
  }

  if (parsed.schemaVersion !== 1) {
    refuse(`${filePath} declares schemaVersion ${String(parsed.schemaVersion)} rather than 1`);
  }

  if (!Array.isArray(parsed.exceptions)) {
    refuse(`${filePath} declares no exceptions array`);
  }

  return parsed.exceptions;
}

/**
 * The validated list for the analysed root, or an empty list when that root
 * ships no such file. Empty is the safe absence: with no list, no member is
 * excused, so a missing file can never widen what the gate accepts.
 */
export function readExceptions(root) {
  const filePath = path.join(root, "scripts", exceptionsFileName);

  if (!existsSync(filePath)) {
    return [];
  }

  const entries = parseFile(readFileSync(filePath, "utf8"), `scripts/${exceptionsFileName}`);
  const accepted = [];
  const seen = new Set();

  for (const [index, entry] of entries.entries()) {
    const one = readEntry(entry, index);

    if (seen.has(one.id)) {
      refuse(`${one.id} is listed twice; one member carries one decision`);
    }

    seen.add(one.id);
    accepted.push(one);
  }

  return accepted;
}

function matchOf(finding, exception) {
  return (
    finding.id === exception.id &&
    finding.owner === exception.owner &&
    finding.key === exception.key
  );
}

function requireMatch(findings, exception) {
  const matched = findings.find((finding) => matchOf(finding, exception));

  if (matched === undefined) {
    refuse(
      `${exception.id} ${exception.owner}.${exception.key} is not reported by this run. Either the member was repaired, in which case delete the entry, or its coordinates moved, in which case re-derive them from the current source. An entry that matches nothing is refused rather than kept, so a repaired member cannot leave a silent allowance behind`,
    );
  }

  if (matched.status !== "unread") {
    refuse(
      `${exception.id} ${exception.owner}.${exception.key} is ${matched.status}, not unread. An unsupported finding is the analyzer reporting that it could not decide, and a decision cannot stand in for an analysis it did not make`,
    );
  }

  return matched;
}

/**
 * Splits this run's findings into the ones a recorded decision accepts and the
 * ones that still fail the gate. Every excused row is returned so the caller can
 * name it on every run, passing or failing alike: a residual nobody is shown is
 * a residual nobody revisits.
 */
export function applyExceptions(findings, exceptions) {
  const excused = [];
  const matchedFindings = new Set();

  for (const exception of exceptions) {
    const matched = requireMatch(findings, exception);
    matchedFindings.add(matched);
    excused.push({ ...exception, status: matched.status });
  }

  return {
    excused,
    outstanding: findings.filter((finding) => !matchedFindings.has(finding)),
  };
}
