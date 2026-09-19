import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeProject } from "./check-unused-type-members.analysis.mjs";
import { createContractEvaluator } from "./check-unused-type-members.contracts.mjs";
import { applyExceptions, readExceptions } from "./check-unused-type-members.exceptions.mjs";
import { AnalysisSetupError } from "./check-unused-type-members.model.mjs";

/**
 * Fails any TypeScript interface or object-type member that no runtime read ever
 * observes. Declarations, type-only references and same-spelling members on
 * unrelated types are not reads, so none of them keeps a member alive here.
 *
 * Exit status is the contract: 0 clean, 1 member findings, 2 setup or internal
 * analysis failure. Keeping the third status separate is what stops a broken
 * launch from reading like a clean tree.
 */

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const contractsFileName = "check-unused-type-members.contracts.json";
const exceptionsFileName = "check-unused-type-members.exceptions.json";

const helpText = `Usage: node scripts/check-unused-type-members.mjs [options]

  --root <path>      Project root holding tsconfig.json. Defaults to this repository.
  --overlay <path>   JSON file mapping existing project-relative TypeScript paths to
                     replacement source text. Applied as a compiler read override; no
                     file on disk is modified.
  --budget <count>   Maximum syntax nodes the walk may visit. Running out fails the
                     run; it never reports a clean tree.
  --json             Write the full report to stdout as JSON.
  --help             Print this text.

Exit status: 0 no findings, 1 unread or unsupported members, 2 setup failure.

Contracts: scripts/${contractsFileName} under the analysed root, when it exists,
is the only source of evidence-backed exceptions. An invalid entry is a setup
failure, never a quiet allowance; with no such file no member is excused at all.

Recorded decisions: scripts/${exceptionsFileName} under the analysed
root, when it exists, lists individual unread members a recorded decision
accepts. Each entry names ONE member by exact path, line, column, owner and key,
and states where the decision is recorded and the mechanism that was measured.
There is no count, no threshold and no path pattern, and the identity field
admits no pattern character, so the list cannot be widened by one row. An entry
that matches no reported finding refuses the run, so a repaired member takes its
allowance with it and a drifted coordinate fails instead of excusing whatever now
sits there. An unsupported finding can never be excused: that status is the
analyzer saying it could not decide. Every excused member is named on every run,
and it stays in the report and in the recorded population -- only the exit status
changes.

Scope: this is a bounded may-observe analysis. It reports that some run-time
syntax could read a declared member: property and optional-chain access, element
access under a literal or finite literal-union key, binding and assignment
destructuring, compound and update expressions, and exact \`in\` presence tests.

Whole-object operations read a shape all at once and are settled by the
declaration the checker resolved, never by the callee's spelling: JSON
serialization, object spread and rest, Object.assign, Object.values and
Object.entries, and Node's deep comparisons. A local function earns the same
summary only by passing one of its own parameters into one of those. A
comparison credits only the operand whose value came out of production code, so
a fixture a test wrote for itself proves nothing.

It does not claim the reading branch ever executes, that the value influences
behaviour, or that an asserting test is a useful one. Coverage, dead-code
analysis and test review remain necessary. Declarations, type-only references
and key enumeration are not reads. A whole-object operation credits the members
it reaches on the operand's own declaration and traces the places that supplied
them only for the operand itself; own-property eligibility is refused where an
accessor or a class instance makes it unprovable, and a run-time replacer or a
toJSON member leaves the serialized keys unresolved.
`;

const valueOptionNames = new Set(["--root", "--overlay", "--budget"]);

function applySwitch(options, name) {
  if (name === "--json") {
    options.json = true;
    return true;
  }

  if (name === "--help") {
    options.help = true;
    return true;
  }

  return false;
}

function readValue(args, index, name) {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new AnalysisSetupError(`Option ${name} needs a value`);
  }

  return value;
}

function readBudget(value) {
  const budget = Number(value);

  if (!Number.isInteger(budget) || budget <= 0) {
    throw new AnalysisSetupError(`Option --budget needs a positive whole number, not ${value}`);
  }

  return budget;
}

function applyValueOption(options, name, value) {
  if (name === "--root") {
    options.root = path.resolve(value);
    return;
  }

  if (name === "--overlay") {
    options.overlay = path.resolve(value);
    return;
  }

  options.budget = readBudget(value);
}

function parseOptions(args) {
  const options = {
    root: defaultProjectRoot,
    json: false,
    help: false,
    overlay: undefined,
    budget: undefined,
  };
  let index = 0;

  while (index < args.length) {
    const name = args[index];

    if (applySwitch(options, name)) {
      index += 1;
      continue;
    }

    if (!valueOptionNames.has(name)) {
      throw new AnalysisSetupError(`Unknown option: ${name}`);
    }

    applyValueOption(options, name, readValue(args, index, name));
    index += 2;
  }

  return options;
}

function reportFindings(findings) {
  for (const finding of findings) {
    const location = `${finding.path}:${finding.line}:${finding.column}`;
    process.stderr.write(`${finding.status}: ${location} ${finding.owner}.${finding.key}\n`);
  }

  process.stderr.write(`Unused type member gate failed with ${findings.length} finding(s).\n`);
}

/**
 * Names every excused member on every run, passing or failing alike. A residual
 * nobody is shown is a residual nobody revisits, so the decision that accepted
 * each row is printed beside it rather than left in a file.
 */
function reportExceptions(excused) {
  for (const one of excused) {
    process.stderr.write(`excepted: ${one.id} ${one.owner}.${one.key} -- ${one.decision}\n`);
  }
}

/**
 * The contract validator for the analysed root, or nothing when that root ships
 * no contract file. Nothing is the safe absence: with no validator no member is
 * excused, so a missing file can never widen what the gate accepts.
 */
function contractEvaluatorFor(root) {
  const contractsPath = path.join(root, "scripts", contractsFileName);
  return existsSync(contractsPath) ? createContractEvaluator({ contractsPath }) : undefined;
}

function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(helpText);
    return;
  }

  // Validated before the analysis rather than after it: a malformed decision
  // list is cheap to refuse and a whole-program walk is not.
  const exceptions = readExceptions(options.root);
  const analyzed = analyzeProject({
    ...options,
    contractEvaluator: contractEvaluatorFor(options.root),
  });
  const { excused, outstanding } = applyExceptions(analyzed.findings, exceptions);
  // `members` and `counts` are left exactly as the analyzer measured them, so a
  // recorded decision never moves the population. Only `findings`, which is what
  // the exit status answers for, is narrowed.
  const report = { ...analyzed, findings: outstanding, exceptions: excused };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
  }

  reportExceptions(excused);

  if (outstanding.length === 0) {
    if (!options.json) {
      const accepted = excused.length === 0 ? "" : ` with ${excused.length} recorded exception(s)`;
      process.stdout.write(`Unused type member gate passed${accepted}.\n`);
    }

    return;
  }

  reportFindings(outstanding);
  process.exitCode = 1;
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
