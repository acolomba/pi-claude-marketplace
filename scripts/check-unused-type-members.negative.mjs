import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

/**
 * Offender and benign controls for the unused-type-member gate, driven through
 * the real command-line tool against the real repository.
 *
 * MEMBER-01: the offender is planted into the REAL `EdgeDeps` declaration, not
 * into a synthetic interface that merely looks like it. A lookalike proves the
 * analyzer can see a fixture; only the real declaration proves it can see this
 * tree. The plant is applied as a compiler read overlay, so no project file is
 * ever written, and the controls state the exact declaration identity the gate
 * must report rather than accepting any non-zero exit as detection.
 *
 * The live tree does not report zero. The gate's honest baseline carries the
 * members that really are unread, each recorded with an owner, so every control
 * here compares the offender run against THAT baseline instead of against a
 * clean run that does not exist.
 *
 * `--gate` names the executable under control. It exists so the controls can be
 * run against a deliberately defective gate and shown to reject it: a runner
 * that cannot fail proves nothing about the runner that can.
 */

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultGatePath = fileURLToPath(new URL("./check-unused-type-members.mjs", import.meta.url));

/** The declaration the offender is planted into, and the owner test that reads it. */
const edgeDepsPath = "extensions/pi-claude-marketplace/edge/types.ts";
const ownerTestPath = "tests/edge/types.test.ts";

const plantedOwner = "EdgeDeps";
const plantedKey = "neverReadAnywhere";
const plantedLine = `  readonly ${plantedKey}?: string;`;

/**
 * The benign read: a well-typed exported probe appended to the owner test's
 * compiler input. It reads the planted member through an optional chain, which
 * is one of the access forms the gate's help text claims to observe.
 */
const benignProbe = `
export function probeNeverReadAnywhere(deps: ${plantedOwner}): number {
  return deps.neverReadAnywhere?.length ?? 0;
}
`;

/** A gate report can name every member in the tree, so the pipe is bounded high. */
const outputBudget = 256 * 1024 * 1024;

class ControlFailure extends Error {
  constructor(label, detail) {
    super(`${label}: ${detail}`);
    this.name = "ControlFailure";
  }
}

function parseOptions(args) {
  const options = { root: defaultProjectRoot, gate: defaultGatePath, printPlant: false };
  let index = 0;

  while (index < args.length) {
    const name = args[index];

    if (name === "--print-plant") {
      options.printPlant = true;
      index += 1;
      continue;
    }

    const value = args[index + 1];

    if ((name !== "--root" && name !== "--gate") || value === undefined) {
      throw new Error(`Unknown or incomplete option: ${name}`);
    }

    options[name === "--root" ? "root" : "gate"] = path.resolve(value);
    index += 2;
  }

  return options;
}

/** The 1-based line and column `offset` sits at, counted from the text itself. */
function siteOf(text, offset) {
  const before = text.slice(0, offset);
  return { line: before.split("\n").length, column: offset - before.lastIndexOf("\n") };
}

/**
 * The real `EdgeDeps` interface declaration, resolved through the parser rather
 * than by matching source text, so the insertion point follows the declaration's
 * structure instead of its formatting.
 */
function edgeDepsDeclaration(sourceText) {
  const sourceFile = ts.createSourceFile(
    edgeDepsPath,
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === plantedOwner) {
      return statement;
    }
  }

  throw new Error(`${edgeDepsPath} declares no interface named ${plantedOwner}`);
}

/**
 * The offender overlay, the benign overlay and the exact facts the gate must
 * report for each.
 *
 * The expected declaration identity is counted out of the overlay text here, not
 * read back out of the analyzer: an expectation the analyzer supplied would
 * agree with the analyzer no matter what the analyzer did.
 */
function buildPlant(sourceText, ownerTestText) {
  if (sourceText.includes(plantedKey) || ownerTestText.includes(plantedKey)) {
    throw new Error(`${plantedKey} is already spelled in the tree, so planting it proves nothing`);
  }

  const declaration = edgeDepsDeclaration(sourceText);
  const members = declaration.members;

  if (members.length === 0) {
    throw new Error(`${plantedOwner} declares no member to plant beside`);
  }

  const insertAt = members[members.length - 1].end;
  const offenderText = `${sourceText.slice(0, insertAt)}\n${plantedLine}${sourceText.slice(insertAt)}`;
  const benignText = `${ownerTestText}${benignProbe}`;
  const memberSite = siteOf(offenderText, insertAt + 1 + plantedLine.indexOf("readonly"));
  const witnessSite = siteOf(benignText, benignText.indexOf(`deps.${plantedKey}`) + "deps.".length);

  return {
    offenderText,
    benignText,
    member: {
      id: `${edgeDepsPath}:${memberSite.line}:${memberSite.column}`,
      path: edgeDepsPath,
      line: memberSite.line,
      column: memberSite.column,
      owner: plantedOwner,
      key: plantedKey,
      optional: true,
      category: "interface-member",
      status: "unread",
      witnesses: [],
      reasons: [],
    },
    insertedLine: plantedLine,
    benignWitness: {
      path: ownerTestPath,
      line: witnessSite.line,
      column: witnessSite.column,
      kind: "value-read",
      origin: "test",
      syntax: "property-access",
    },
  };
}

function readPlant(root) {
  return buildPlant(
    readFileSync(path.join(root, edgeDepsPath), "utf8"),
    readFileSync(path.join(root, ownerTestPath), "utf8"),
  );
}

/** Run the gate under control with an argv array and no shell. */
function runGate(options, extra) {
  const args = [options.gate, "--root", options.root, "--json", ...extra];
  const completed = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: outputBudget,
  });
  return {
    error: completed.error,
    signal: completed.signal,
    status: completed.status,
    stdout: completed.stdout ?? "",
    stderr: completed.stderr ?? "",
  };
}

function reportFrom(label, run, expectedStatus) {
  if (run.status !== expectedStatus) {
    throw new ControlFailure(
      label,
      `the gate exited ${run.status} rather than ${expectedStatus}: ${run.stderr.trim()}`,
    );
  }

  return JSON.parse(run.stdout);
}

function findingIds(report) {
  return report.findings.map((finding) => finding.id);
}

function compareFindings(label, subject, expected, observed) {
  const missing = expected.filter((id) => !observed.includes(id));
  const gained = observed.filter((id) => !expected.includes(id));

  if (missing.length > 0) {
    throw new ControlFailure(label, `the ${subject} is missing ${missing.join(", ")}`);
  }

  if (gained.length > 0) {
    throw new ControlFailure(label, `the ${subject} gained ${gained.join(", ")}`);
  }
}

function requireMember(label, report, expected) {
  const observed = report.members.find((member) => member.id === expected.id);

  try {
    assert.deepStrictEqual(observed, expected);
  } catch {
    throw new ControlFailure(
      label,
      `the record for ${expected.id} is ${JSON.stringify(observed)} rather than ${JSON.stringify(expected)}`,
    );
  }
}

/** The report without the run's own measurements, which are a wall clock. */
function withoutWork(report) {
  const stripped = { ...report };
  delete stripped.work;
  return stripped;
}

/**
 * The contract engine's own census of the entries it validated, which every run
 * over a tree carrying a contract file emits. It is the ONLY diagnostic a
 * healthy run may write: a contract the engine refuses is a setup failure with
 * no report at all, so anything else on this list is a signal the analysis went
 * wrong and cannot be read as a member verdict.
 */
const contractCensus = /^contracts: \d+ validated from [\w./-]+$/;

function requireCensusOnly(label, report) {
  const unexpected = report.diagnostics.filter((line) => !contractCensus.test(line));

  if (unexpected.length > 0) {
    throw new ControlFailure(label, `the gate reported ${unexpected.join("; ")}`);
  }
}

function requireSameDiagnostics(label, report, baseline) {
  try {
    assert.deepStrictEqual(report.diagnostics, baseline.diagnostics);
  } catch {
    throw new ControlFailure(
      label,
      `the overlay changed the diagnostics to ${JSON.stringify(report.diagnostics)}`,
    );
  }
}

function baselineControl(options, plant) {
  const label = "baseline";
  const report = reportFrom(label, runGate(options, []), 1);
  requireCensusOnly(label, report);

  if (findingIds(report).includes(plant.member.id)) {
    throw new ControlFailure(label, `the tree already reports ${plant.member.id}`);
  }

  return report;
}

function offenderControl(options, plant, baseline, overlayPath) {
  const label = "offender-plant";
  const report = reportFrom(label, runGate(options, ["--overlay", overlayPath]), 1);
  requireSameDiagnostics(label, report, baseline);
  compareFindings(
    label,
    "overlay finding set",
    [...findingIds(baseline), plant.member.id],
    findingIds(report),
  );
  requireMember(label, report, plant.member);
}

function benignControl(options, plant, baseline, overlayPath) {
  const label = "benign-receiver-read";
  const report = reportFrom(label, runGate(options, ["--overlay", overlayPath]), 1);
  requireSameDiagnostics(label, report, baseline);
  compareFindings(label, "finding set", findingIds(baseline), findingIds(report));
  requireMember(label, report, {
    ...plant.member,
    status: "test-only-observed",
    witnesses: [plant.benignWitness],
  });
}

function removedControl(options, baseline) {
  const label = "plant-removed";
  const report = reportFrom(label, runGate(options, []), 1);

  try {
    assert.deepStrictEqual(withoutWork(report), withoutWork(baseline));
  } catch {
    throw new ControlFailure(
      label,
      "the report differs from the baseline once the overlay is gone",
    );
  }
}

/**
 * The bytes and the tracked status of exactly the two files the overlays stand
 * in for.
 *
 * The scope is those two paths and no others. A run takes minutes, and a wider
 * scope reports every unrelated edit anyone makes while it is in flight as this
 * run having escaped its overlay -- an accusation about the wrong files.
 */
function fingerprint(root, required) {
  const status = spawnSync("git", ["status", "--porcelain", "--", edgeDepsPath, ownerTestPath], {
    cwd: root,
    encoding: "utf8",
  });

  if (required && status.status !== 0) {
    throw new Error(`Cannot read the working-tree status of ${root}`);
  }

  return [
    readFileSync(path.join(root, edgeDepsPath), "utf8"),
    readFileSync(path.join(root, ownerTestPath), "utf8"),
    status.stdout ?? "",
  ].join(" ");
}

function writeOverlay(directory, name, replacements) {
  const overlayPath = path.join(directory, name);
  writeFileSync(overlayPath, JSON.stringify(replacements));
  return overlayPath;
}

function executeControls(options, plant) {
  const directory = mkdtempSync(path.join(tmpdir(), "unused-type-members-negative-"));

  try {
    const offenderPath = writeOverlay(directory, "offender.json", {
      [edgeDepsPath]: plant.offenderText,
    });
    const benignPath = writeOverlay(directory, "benign.json", {
      [edgeDepsPath]: plant.offenderText,
      [ownerTestPath]: plant.benignText,
    });
    const baseline = baselineControl(options, plant);
    process.stdout.write("baseline: ok\n");
    offenderControl(options, plant, baseline, offenderPath);
    process.stdout.write("offender-plant: ok\n");
    benignControl(options, plant, baseline, benignPath);
    process.stdout.write("benign-receiver-read: ok\n");
    removedControl(options, baseline);
    process.stdout.write("plant-removed: ok\n");
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

/**
 * Runs every control, then states what the controls did NOT do: the analysed
 * sources are read back after a pass and after a failure alike, because an
 * overlay that escaped onto disk would otherwise leave the tree edited by a run
 * that reported nothing wrong.
 */
function runControls(options) {
  const plant = readPlant(options.root);
  const before = fingerprint(options.root, true);
  let failure;

  try {
    executeControls(options, plant);
  } catch (error) {
    failure = error;
  }

  if (fingerprint(options.root, false) !== before) {
    throw new Error("The controls changed the analysed sources; the overlay was not contained");
  }

  if (failure !== undefined) {
    throw failure;
  }

  process.stdout.write("Unused type member negative controls passed (4 of 4).\n");
}

function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.printPlant) {
    const { member, insertedLine, benignWitness } = readPlant(options.root);
    process.stdout.write(`${JSON.stringify({ member, insertedLine, benignWitness })}\n`);
    return;
  }

  runControls(options);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
