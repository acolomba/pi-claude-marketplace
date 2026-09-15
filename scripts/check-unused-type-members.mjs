import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeProject } from "./check-unused-type-members.analysis.mjs";
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

const helpText = `Usage: node scripts/check-unused-type-members.mjs [options]

  --root <path>      Project root holding tsconfig.json. Defaults to this repository.
  --overlay <path>   JSON file mapping existing project-relative TypeScript paths to
                     replacement source text. Applied as a compiler read override; no
                     file on disk is modified.
  --json             Write the full report to stdout as JSON.
  --help             Print this text.

Exit status: 0 no findings, 1 unread or unsupported members, 2 setup failure.
`;

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

function readPathValue(args, index, name) {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new AnalysisSetupError(`Option ${name} needs a path`);
  }

  return path.resolve(value);
}

function parseOptions(args) {
  const options = { root: defaultProjectRoot, json: false, help: false, overlay: undefined };
  let index = 0;

  while (index < args.length) {
    const name = args[index];

    if (applySwitch(options, name)) {
      index += 1;
      continue;
    }

    if (name !== "--root" && name !== "--overlay") {
      throw new AnalysisSetupError(`Unknown option: ${name}`);
    }

    const value = readPathValue(args, index, name);

    if (name === "--root") {
      options.root = value;
    } else {
      options.overlay = value;
    }

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

function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(helpText);
    return;
  }

  const report = analyzeProject(options);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
  }

  if (report.findings.length === 0) {
    if (!options.json) {
      process.stdout.write("Unused type member gate passed.\n");
    }

    return;
  }

  reportFindings(report.findings);
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
