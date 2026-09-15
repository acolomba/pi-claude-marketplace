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

/**
 * A second declaration spelling the same key, read for real from production.
 *
 * A gate that matched members by property spelling would see this read and let
 * the offender go, so the offender has to survive it. The read is production, so
 * this member must come back `runtime-observed` -- a control that only checked
 * the offender would pass even if this read were never observed at all.
 */
const unrelatedOwner = "UnrelatedSameSpelling";
const unrelatedDeclaration = `
export interface ${unrelatedOwner} {
${plantedLine}
}

export function readUnrelatedSameSpelling(unrelated: ${unrelatedOwner}): number {
  return unrelated.neverReadAnywhere?.length ?? 0;
}
`;

/** An unclosed declaration: the compiler cannot parse it, so no verdict exists. */
const brokenDeclaration = "\nexport interface UnclosedShape {\n";

/** The reasons the gate must give for the two runs it cannot complete. */
const syntaxReason = `Compiler input has a syntax error: ${edgeDepsPath}`;
const budgetReason = "Option --budget needs a positive whole number, not 0";

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
 * The record the gate must report for the unrelated declaration: the same key,
 * a different owner, and one production witness of its own.
 */
function unrelatedMemberOf(unrelatedText, appendedAt) {
  const declaredAt = unrelatedText.indexOf(plantedLine, appendedAt);
  const readAt = unrelatedText.indexOf(`unrelated.${plantedKey}`) + "unrelated.".length;
  const declaredSite = siteOf(unrelatedText, declaredAt + plantedLine.indexOf("readonly"));
  const readSite = siteOf(unrelatedText, readAt);

  return {
    id: `${edgeDepsPath}:${declaredSite.line}:${declaredSite.column}`,
    path: edgeDepsPath,
    line: declaredSite.line,
    column: declaredSite.column,
    owner: unrelatedOwner,
    key: plantedKey,
    optional: true,
    category: "interface-member",
    status: "runtime-observed",
    witnesses: [
      {
        path: edgeDepsPath,
        line: readSite.line,
        column: readSite.column,
        kind: "value-read",
        origin: "production",
        syntax: "property-access",
      },
    ],
    reasons: [],
  };
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
  const unrelatedText = `${offenderText}${unrelatedDeclaration}`;
  const memberSite = siteOf(offenderText, insertAt + 1 + plantedLine.indexOf("readonly"));
  const witnessSite = siteOf(benignText, benignText.indexOf(`deps.${plantedKey}`) + "deps.".length);

  return {
    offenderText,
    benignText,
    unrelatedText,
    brokenText: `${sourceText}${brokenDeclaration}`,
    unrelatedMember: unrelatedMemberOf(unrelatedText, offenderText.length),
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

function firstLine(text) {
  return text.split("\n", 1)[0].slice(0, 200);
}

function parseReport(label, stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new ControlFailure(label, `the gate wrote no parsable report: ${firstLine(stdout)}`);
  }
}

/**
 * The report of a run that was expected to reach a verdict.
 *
 * The exit status is checked against what the report itself says rather than
 * against a number stated here: the contract is 0 for no findings and 1 for
 * findings, so a gate whose status and report disagree is caught without the
 * control having to guess which one to believe. A run that wrote no report at
 * all never reached a verdict, and saying so is what keeps "could not analyse"
 * from reading as "found nothing".
 */
function reportFrom(label, run) {
  if (run.error !== undefined) {
    throw new ControlFailure(label, `the gate did not launch: ${run.error.message}`);
  }

  if (run.signal !== null && run.signal !== undefined) {
    throw new ControlFailure(label, `the gate was ended by signal ${run.signal}`);
  }

  if (run.stdout.trim() === "") {
    throw new ControlFailure(
      label,
      `the gate produced no report (exit ${run.status}): ${firstLine(run.stderr)}`,
    );
  }

  const report = parseReport(label, run.stdout);
  const expected = report.findings.length === 0 ? 0 : 1;

  if (run.status !== expected) {
    throw new ControlFailure(
      label,
      `the gate exited ${run.status} with ${report.findings.length} finding(s)`,
    );
  }

  return report;
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
  const report = reportFrom(label, runGate(options, []));
  requireCensusOnly(label, report);

  if (findingIds(report).includes(plant.member.id)) {
    throw new ControlFailure(label, `the tree already reports ${plant.member.id}`);
  }

  return report;
}

function offenderControl(options, plant, baseline, overlayPath) {
  const label = "offender-plant";
  const report = reportFrom(label, runGate(options, ["--overlay", overlayPath]));
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
  const report = reportFrom(label, runGate(options, ["--overlay", overlayPath]));
  requireSameDiagnostics(label, report, baseline);
  compareFindings(label, "finding set", findingIds(baseline), findingIds(report));
  requireMember(label, report, {
    ...plant.member,
    status: "test-only-observed",
    witnesses: [plant.benignWitness],
  });
}

function unrelatedControl(options, plant, baseline, overlayPath) {
  const label = "unrelated-same-spelling-read";
  const report = reportFrom(label, runGate(options, ["--overlay", overlayPath]));
  requireSameDiagnostics(label, report, baseline);
  compareFindings(
    label,
    "overlay finding set",
    [...findingIds(baseline), plant.member.id],
    findingIds(report),
  );
  requireMember(label, report, plant.member);
  requireMember(label, report, plant.unrelatedMember);
}

/**
 * A run the gate cannot complete: exit 2, no report at all, and a reason naming
 * what it could not read. Keeping this separate from exit 1 is what stops a
 * broken launch or an unparsable input from being read as a clean tree, and
 * requiring the reason is what stops any refusal from standing in for this one.
 */
function refusalControl(label, options, extra, reason) {
  const run = runGate(options, extra);

  if (run.error !== undefined) {
    throw new ControlFailure(label, `the gate did not launch: ${run.error.message}`);
  }

  if (run.status !== 2) {
    throw new ControlFailure(
      label,
      `the gate exited ${run.status} rather than refusing, so a run it could not complete reads as a member verdict`,
    );
  }

  if (run.stdout !== "") {
    throw new ControlFailure(label, "the gate wrote a report for a run it could not complete");
  }

  if (!run.stderr.includes(reason)) {
    throw new ControlFailure(
      label,
      `the refusal does not name ${reason}: ${firstLine(run.stderr)}`,
    );
  }
}

function removedControl(options, baseline) {
  const label = "plant-removed";
  const report = reportFrom(label, runGate(options, []));

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
    const unrelatedPath = writeOverlay(directory, "unrelated.json", {
      [edgeDepsPath]: plant.unrelatedText,
    });
    const brokenPath = writeOverlay(directory, "broken.json", {
      [edgeDepsPath]: plant.brokenText,
    });
    const baseline = baselineControl(options, plant);
    process.stdout.write("baseline: ok\n");
    offenderControl(options, plant, baseline, offenderPath);
    process.stdout.write("offender-plant: ok\n");
    benignControl(options, plant, baseline, benignPath);
    process.stdout.write("benign-receiver-read: ok\n");
    unrelatedControl(options, plant, baseline, unrelatedPath);
    process.stdout.write("unrelated-same-spelling-read: ok\n");
    removedControl(options, baseline);
    process.stdout.write("plant-removed: ok\n");
    refusalControl("compiler-failure", options, ["--overlay", brokenPath], syntaxReason);
    process.stdout.write("compiler-failure: ok\n");
    refusalControl("option-failure", options, ["--budget", "0"], budgetReason);
    process.stdout.write("option-failure: ok\n");
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

  process.stdout.write("Unused type member negative controls passed (7 of 7).\n");
}

function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.printPlant) {
    const { member, insertedLine, benignWitness, unrelatedMember } = readPlant(options.root);
    process.stdout.write(
      `${JSON.stringify({ member, insertedLine, benignWitness, unrelatedMember })}\n`,
    );
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
