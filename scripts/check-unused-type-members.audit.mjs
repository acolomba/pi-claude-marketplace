import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeProject } from "./check-unused-type-members.analysis.mjs";
import { createContractEvaluator } from "./check-unused-type-members.contracts.mjs";
import { AnalysisSetupError } from "./check-unused-type-members.model.mjs";

/**
 * Inventory and closure audit for the unused-type-member gate.
 *
 * The two commands answer two different questions, and keeping them apart is
 * the whole point of this tool.
 *
 * `--inventory` asks "what is the complete current population?". It records
 * every candidate the analyzer found, including the ones it could not settle,
 * and it always succeeds. A complete inventory is not a clean verdict, so the
 * command says so out loud rather than letting a zero status imply otherwise.
 *
 * `--check` asks "is that population closed?". It re-runs the analysis, proves
 * the recorded evidence still describes the source on disk, and reconciles
 * every disposition against the fresh report. Unread members, members the
 * analysis could not settle, missing rows, duplicate rows, rows the report no
 * longer holds, unexplained rows and invalid rows all fail it.
 *
 * Neither command can change an analyzer verdict. This tool only ever reads the
 * report; the contract file is the sole place a member is ever excused, and the
 * gate owns that.
 *
 * Exit status: 0 recorded or satisfied, 1 audit problems, 2 setup failure.
 */

const schemaVersion = 1;
const productionRoot = "extensions/pi-claude-marketplace";
const testRoot = "tests";
const contractsFileName = "check-unused-type-members.contracts.json";

// The source set the recorded evidence is bound to. It is the two roots the
// analyzer reads plus the two files that decide what the analysis means: the
// compiler configuration that selects the inputs, and the contract file that
// can excuse a member. A change to any of them invalidates a recorded ledger.
const fingerprintExtras = ["tsconfig.json", `scripts/${contractsFileName}`];

// A member the analyzer settled with a production witness is explained by that
// witness. Every other status rests on something a reader has to agree with, so
// each one carries a recorded disposition.
const dispositionStatuses = new Set([
  "unread",
  "unsupported-analysis",
  "test-only-observed",
  "explicit-contract",
]);

const dispositionValues = new Set(["pending", "explained"]);

const statusFields = new Map([
  ["runtime-observed", "runtimeObserved"],
  ["test-only-observed", "testOnlyObserved"],
  ["explicit-contract", "explicitContract"],
  ["unread", "unread"],
  ["unsupported-analysis", "unsupportedAnalysis"],
]);

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultLedgerPath = ".planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md";

const helpText = `Usage: node scripts/check-unused-type-members.audit.mjs <command> [options]

Commands:
  --inventory        Record the complete current population in the triage
                     document. Always succeeds; an inventory is not a verdict.
  --check            Reconcile the triage document against a fresh analysis and
                     fail any unread, unsupported, missing, duplicate, stale,
                     unexplained or invalid evidence.

Options:
  --root <path>      Project root holding tsconfig.json. Defaults to this repository.
  --ledger <path>    Triage document holding the ledger. Defaults to
                     ${defaultLedgerPath} under the analysed root.
  --json             Write the audit result to stdout as JSON.
  --help             Print this text.

Exit status: 0 recorded or satisfied, 1 audit problems, 2 setup failure.

The ledger is the first fenced json block in the triage document. Regenerating
the inventory rewrites the prose and carries every recorded disposition and note
forward; nothing written outside that block survives. This tool reports the
analyzer's verdict and never changes it, and the gate itself never reads the
triage document -- ordinary mandatory analysis depends on no planning record.
`;

function fail(message) {
  throw new AnalysisSetupError(message);
}

function problemOf(category, id, message) {
  return { category, id, message };
}

/* -------------------------------------------------------------------------- */
/* Options                                                                     */
/* -------------------------------------------------------------------------- */

function readValue(args, index) {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    fail(`Option ${args[index]} needs a value`);
  }

  return value;
}

function applyArgument(options, args, index) {
  const name = args[index];

  switch (name) {
    case "--inventory":
    case "--check":
      options.command = name.slice(2);
      return 1;
    case "--json":
      options.json = true;
      return 1;
    case "--help":
      options.help = true;
      return 1;
    case "--root":
      options.root = path.resolve(readValue(args, index));
      return 2;
    case "--ledger":
      options.ledger = path.resolve(readValue(args, index));
      return 2;
    default:
      return fail(`Unknown option: ${name}`);
  }
}

function parseArguments(args) {
  const options = {
    root: defaultProjectRoot,
    ledger: undefined,
    command: undefined,
    json: false,
    help: false,
  };
  let index = 0;

  while (index < args.length) {
    index += applyArgument(options, args, index);
  }

  return {
    ...options,
    ledger: options.ledger ?? path.join(options.root, defaultLedgerPath),
  };
}

/* -------------------------------------------------------------------------- */
/* Source fingerprint                                                          */
/* -------------------------------------------------------------------------- */

function collectTypeScriptFiles(root, relativeDir, collected) {
  const absoluteDir = path.join(root, relativeDir);

  if (!existsSync(absoluteDir)) {
    return;
  }

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;

    if (entry.isDirectory()) {
      collectTypeScriptFiles(root, relativePath, collected);
      continue;
    }

    if (entry.isFile() && relativePath.endsWith(".ts")) {
      collected.push(relativePath);
    }
  }
}

/**
 * Hashes the exact source set the evidence is recorded against, derived from
 * disk rather than from the report. Recomputing it independently is what lets a
 * stale ledger be caught by something other than the report it describes.
 */
function fingerprintOf(root) {
  const files = [];

  for (const analysedRoot of [productionRoot, testRoot]) {
    collectTypeScriptFiles(root, analysedRoot, files);
  }

  for (const extra of fingerprintExtras) {
    if (existsSync(path.join(root, extra))) {
      files.push(extra);
    }
  }

  files.sort();
  const digest = createHash("sha256");

  for (const file of files) {
    const content = createHash("sha256")
      .update(readFileSync(path.join(root, file)))
      .digest("hex");
    digest.update(`${file}\0${content}\n`);
  }

  return { algorithm: "sha256", files: files.length, digest: digest.digest("hex") };
}

/**
 * The commit the recorded source sits on, for a reader who wants to find it
 * again. It is recorded but never compared: an uncommitted edit leaves the
 * revision untouched while moving the digest, so the digest is the authority.
 */
function revisionOf(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/* -------------------------------------------------------------------------- */
/* Analysis                                                                    */
/* -------------------------------------------------------------------------- */

function analyse(root) {
  const contractsPath = path.join(root, "scripts", contractsFileName);
  return analyzeProject({
    root,
    contractEvaluator: existsSync(contractsPath)
      ? createContractEvaluator({ contractsPath })
      : undefined,
  });
}

/**
 * Names the conceptual owner a declaration belongs to: the architectural layer
 * it lives in, with each bridge kind kept apart from its siblings because they
 * are separate owners rather than one.
 */
function ownerGroupOf(projectPath) {
  const segments = projectPath.slice(`${productionRoot}/`.length).split("/");

  if (segments.length <= 1) {
    return "entry";
  }

  if (segments[0] === "bridges" && segments.length > 2) {
    return `bridges/${segments[1]}`;
  }

  return segments[0];
}

function emptyOwner(owner) {
  return {
    owner,
    candidates: 0,
    runtimeObserved: 0,
    testOnlyObserved: 0,
    explicitContract: 0,
    unread: 0,
    unsupportedAnalysis: 0,
  };
}

function ownersOf(report) {
  const totals = new Map();

  for (const member of report.members) {
    const owner = ownerGroupOf(member.path);
    const entry = totals.get(owner) ?? emptyOwner(owner);
    entry.candidates += 1;
    entry[statusFields.get(member.status)] += 1;
    totals.set(owner, entry);
  }

  return [...totals.values()].sort((left, right) => left.owner.localeCompare(right.owner));
}

function membersWithStatus(report, statuses) {
  return report.members.filter((member) => statuses.has(member.status));
}

function groupByOwner(members) {
  const grouped = new Map();

  for (const member of members) {
    const owner = ownerGroupOf(member.path);
    const list = grouped.get(owner) ?? [];
    list.push(member);
    grouped.set(owner, list);
  }

  return [...grouped.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

/* -------------------------------------------------------------------------- */
/* Ledger                                                                      */
/* -------------------------------------------------------------------------- */

const ledgerBlock = /```json\n([\s\S]*?)\n```/u;

function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) {
    fail(`No triage document at ${ledgerPath}; record one with --inventory first`);
  }

  const block = ledgerBlock.exec(readFileSync(ledgerPath, "utf8"));

  if (block?.[1] === undefined) {
    fail(`The triage document at ${ledgerPath} carries no fenced json ledger block`);
  }

  let ledger;

  try {
    ledger = JSON.parse(block[1]);
  } catch (error) {
    fail(`The ledger in ${ledgerPath} is not valid JSON: ${String(error)}`);
  }

  if (!Array.isArray(ledger?.dispositions) || !Array.isArray(ledger.owners)) {
    fail(`The ledger in ${ledgerPath} carries no dispositions and owners arrays`);
  }

  return ledger;
}

function recordedDispositions(ledgerPath) {
  if (!existsSync(ledgerPath)) {
    return [];
  }

  try {
    return readLedger(ledgerPath).dispositions;
  } catch {
    return [];
  }
}

function dispositionRowsOf(report, recorded) {
  const kept = new Map();

  for (const row of recorded) {
    if (typeof row?.id === "string" && !kept.has(row.id)) {
      kept.set(row.id, row);
    }
  }

  return membersWithStatus(report, dispositionStatuses).map((member) => {
    const before = kept.get(member.id);
    return {
      id: member.id,
      path: member.path,
      owner: member.owner,
      key: member.key,
      status: member.status,
      disposition: typeof before?.disposition === "string" ? before.disposition : "pending",
      note: typeof before?.note === "string" ? before.note : "",
    };
  });
}

function buildLedger({ report, fingerprint, revision, recorded }) {
  return {
    schemaVersion,
    generated: new Date().toISOString(),
    revision,
    fingerprint,
    counts: report.counts,
    work: report.work,
    owners: ownersOf(report),
    dispositions: dispositionRowsOf(report, recorded),
  };
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                              */
/* -------------------------------------------------------------------------- */

function checkFingerprint(problems, ledger, fingerprint, report) {
  if (ledger.fingerprint?.digest !== fingerprint.digest) {
    problems.push(
      problemOf(
        "stale-source",
        "",
        `the analysed source has moved since the inventory was recorded: ` +
          `${String(ledger.fingerprint?.digest)} is now ${fingerprint.digest}`,
      ),
    );
    return;
  }

  for (const [key, value] of Object.entries(report.counts)) {
    if (ledger.counts?.[key] !== value) {
      problems.push(
        problemOf(
          "stale-source",
          "",
          `recorded ${key} is ${String(ledger.counts?.[key])}, now ${value}`,
        ),
      );
    }
  }
}

function checkOwners(problems, ledger) {
  const accounted = ledger.owners.reduce(
    (total, owner) => total + (typeof owner?.candidates === "number" ? owner.candidates : 0),
    0,
  );

  if (accounted !== ledger.counts?.candidates) {
    problems.push(
      problemOf(
        "incomplete",
        "",
        `the owner groups account for ${accounted} of ${String(ledger.counts?.candidates)} candidates`,
      ),
    );
  }
}

function isWellFormed(row) {
  return (
    typeof row.status === "string" &&
    typeof row.note === "string" &&
    dispositionValues.has(row.disposition)
  );
}

function checkRow(problems, row, needed) {
  if (!isWellFormed(row)) {
    problems.push(
      problemOf("invalid", row.id, "the recorded row is not a well-formed disposition"),
    );
    return;
  }

  const member = needed.get(row.id);

  if (member === undefined) {
    problems.push(problemOf("stale-record", row.id, "the current report holds no row to explain"));
    return;
  }

  if (member.status !== row.status) {
    problems.push(
      problemOf("stale-record", row.id, `recorded as ${row.status}, now ${member.status}`),
    );
    return;
  }

  if (row.disposition !== "explained" || row.note.trim() === "") {
    problems.push(problemOf("incomplete", row.id, "no evidence has been recorded for this row"));
  }
}

function checkDispositions(problems, ledger, report) {
  const needed = new Map(
    membersWithStatus(report, dispositionStatuses).map((member) => [member.id, member]),
  );
  const seen = new Set();

  for (const row of ledger.dispositions) {
    if (typeof row?.id !== "string" || row.id === "") {
      problems.push(problemOf("invalid", "", "a recorded row names no declaration"));
      continue;
    }

    if (seen.has(row.id)) {
      problems.push(problemOf("duplicate", row.id, "the ledger names this declaration twice"));
      continue;
    }

    seen.add(row.id);
    checkRow(problems, row, needed);
  }

  for (const [id, member] of needed) {
    if (!seen.has(id)) {
      problems.push(
        problemOf(
          "missing",
          id,
          `${member.owner}.${member.key} is ${member.status} with no record`,
        ),
      );
    }
  }
}

function checkVerdict(problems, report) {
  for (const finding of report.findings) {
    problems.push(
      problemOf(
        finding.status === "unread" ? "unread" : "unsupported",
        finding.id,
        `${finding.owner}.${finding.key} is ${finding.status}`,
      ),
    );
  }
}

function reconcile({ ledger, report, fingerprint }) {
  const problems = [];
  checkFingerprint(problems, ledger, fingerprint, report);
  checkOwners(problems, ledger);
  checkDispositions(problems, ledger, report);
  checkVerdict(problems, report);
  return problems;
}

/* -------------------------------------------------------------------------- */
/* Triage document                                                             */
/* -------------------------------------------------------------------------- */

function renderTable(header, rows) {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function renderOwnerTotals(ledger) {
  return renderTable(
    ["Owner", "Candidates", "Runtime", "Test-only", "Contract", "Unread", "Unsupported"],
    ledger.owners.map((owner) => [
      owner.owner,
      owner.candidates,
      owner.runtimeObserved,
      owner.testOnlyObserved,
      owner.explicitContract,
      owner.unread,
      owner.unsupportedAnalysis,
    ]),
  );
}

function witnessOf(member) {
  const [witness] = member.witnesses;
  return witness === undefined ? "none" : `${witness.path}:${witness.line}:${witness.column}`;
}

function noteOf(notes, member) {
  const note = notes.get(member.id);
  return note === undefined || note === "" ? "_pending_" : note;
}

function renderGroupedSection(title, empty, groups, header, rowOf) {
  if (groups.length === 0) {
    return `## ${title}\n\n${empty}\n`;
  }

  const sections = groups.map(
    ([owner, members]) => `### ${owner}\n\n${renderTable(header, members.map(rowOf))}\n`,
  );
  return `## ${title}\n\n${sections.join("\n")}`;
}

function renderUnresolved(report, notes) {
  const groups = groupByOwner(
    membersWithStatus(report, new Set(["unread", "unsupported-analysis"])),
  );
  return renderGroupedSection(
    "Unresolved members",
    "None. Every candidate carries an observation or a validated contract.",
    groups,
    ["Declaration", "Owner", "Member", "Status", "Reasons", "Disposition"],
    (member) => [
      member.id,
      member.owner,
      member.key,
      member.status,
      member.reasons.join(", ") || "-",
      noteOf(notes, member),
    ],
  );
}

function renderTestOnly(report, notes) {
  const groups = groupByOwner(membersWithStatus(report, new Set(["test-only-observed"])));
  return renderGroupedSection(
    "Members only tests read",
    "None.",
    groups,
    ["Declaration", "Owner", "Member", "First witness", "Disposition"],
    (member) => [member.id, member.owner, member.key, witnessOf(member), noteOf(notes, member)],
  );
}

function renderContracts(report, notes) {
  const groups = groupByOwner(membersWithStatus(report, new Set(["explicit-contract"])));
  return renderGroupedSection(
    "Members accepted by a validated contract",
    "None. The contract file excuses nothing on this tree.",
    groups,
    ["Declaration", "Owner", "Member", "Contract reason", "Disposition"],
    (member) => [
      member.id,
      member.owner,
      member.key,
      member.reasons.join(", ") || "-",
      noteOf(notes, member),
    ],
  );
}

function renderMeasurement(ledger) {
  return renderTable(
    ["Measurement", "Value"],
    [
      ["Recorded", ledger.generated],
      ["Revision", ledger.revision],
      ["Source digest", `\`${ledger.fingerprint.digest}\``],
      ["Source files hashed", ledger.fingerprint.files],
      ["Production files analysed", ledger.counts.productionFiles],
      ["Candidates", ledger.counts.candidates],
      ["Runtime-observed", ledger.counts.runtimeObserved],
      ["Test-only-observed", ledger.counts.testOnlyObserved],
      ["Explicit-contract", ledger.counts.explicitContract],
      ["Unread", ledger.counts.unread],
      ["Unsupported analysis", ledger.counts.unsupportedAnalysis],
      ["Transfer steps", ledger.work.transferSteps],
      ["Transfer walk milliseconds", ledger.work.transferMs],
    ],
  );
}

function renderDocument(ledger, report) {
  const notes = new Map(ledger.dispositions.map((row) => [row.id, row.note]));
  const unresolved = ledger.counts.unread + ledger.counts.unsupportedAnalysis;
  return `# Live triage: unused type members

Generated by \`node scripts/check-unused-type-members.audit.mjs --inventory\`.
Regenerating rewrites this prose and carries every recorded disposition and note
forward; nothing written outside the ledger block survives.

This is an inventory, not a clean-gate verdict. It records ${ledger.counts.candidates}
candidates, of which ${unresolved} are still unresolved and
${ledger.dispositions.length} need a recorded disposition. Closure is
\`--check\`, which fails every one of them until its evidence is recorded.

## Measurement

${renderMeasurement(ledger)}

## Population by owner

${renderOwnerTotals(ledger)}

${renderUnresolved(report, notes)}
${renderTestOnly(report, notes)}
${renderContracts(report, notes)}
## Ledger

The first fenced json block below is the machine-readable record \`--check\`
reconciles. Record evidence by setting a row's \`disposition\` to \`explained\`
and writing the evidence into its \`note\`.

\`\`\`json
${JSON.stringify(ledger, undefined, 2)}
\`\`\`
`;
}

/* -------------------------------------------------------------------------- */
/* Commands                                                                    */
/* -------------------------------------------------------------------------- */

function runInventory(options) {
  const report = analyse(options.root);
  const ledger = buildLedger({
    report,
    fingerprint: fingerprintOf(options.root),
    revision: revisionOf(options.root),
    recorded: recordedDispositions(options.ledger),
  });
  writeFileSync(options.ledger, renderDocument(ledger, report));

  const unresolved = report.counts.unread + report.counts.unsupportedAnalysis;
  process.stderr.write(
    `Recorded ${report.counts.candidates} candidates from ${report.counts.productionFiles} ` +
      `production files, ${unresolved} still unresolved, in ${options.ledger}\n` +
      `This is an inventory, not a clean-gate verdict. Run --check to close the population.\n`,
  );

  return {
    command: "inventory",
    status: "recorded",
    root: options.root,
    ledger: options.ledger,
    fingerprint: ledger.fingerprint,
    counts: report.counts,
    dispositionRows: ledger.dispositions.length,
    problems: [],
  };
}

function runCheck(options) {
  const ledger = readLedger(options.ledger);
  const fingerprint = fingerprintOf(options.root);
  const report = analyse(options.root);
  const problems = reconcile({ ledger, report, fingerprint });

  for (const problem of problems) {
    process.stderr.write(`${problem.category}: ${problem.id || "(ledger)"} ${problem.message}\n`);
  }

  process.stderr.write(
    problems.length === 0
      ? `Audit satisfied: ${report.counts.candidates} candidates, all explained.\n`
      : `Audit failed with ${problems.length} problem(s).\n`,
  );

  return {
    command: "check",
    status: problems.length === 0 ? "satisfied" : "problems",
    root: options.root,
    ledger: options.ledger,
    fingerprint,
    counts: report.counts,
    dispositionRows: ledger.dispositions.length,
    problems,
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(helpText);
    return;
  }

  if (options.command === undefined) {
    fail("Name one command: --inventory or --check");
  }

  const result = options.command === "inventory" ? runInventory(options) : runCheck(options);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
  }

  if (result.problems.length > 0) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
