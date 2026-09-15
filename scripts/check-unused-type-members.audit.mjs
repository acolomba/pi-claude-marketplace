import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeProject } from "./check-unused-type-members.analysis.mjs";
import { AnalysisSetupError } from "./check-unused-type-members.model.mjs";

/**
 * RED stand-in for the unused-type-member closure audit.
 *
 * This deliberately non-discriminating version records a population and then
 * calls every population satisfied. It is the exact mutant the control suite
 * has to catch: an audit that reports an inventory as a clean verdict.
 */

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function parseOptions(args) {
  const options = { root: defaultProjectRoot, ledger: undefined, command: undefined, json: false };

  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];

    if (name === "--root" || name === "--ledger") {
      options[name.slice(2)] = path.resolve(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (name === "--json") {
      options.json = true;
      continue;
    }

    options.command = name.slice(2);
  }

  return options;
}

function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.command === undefined) {
    throw new AnalysisSetupError("Name one of --inventory or --check");
  }

  const report = analyzeProject({ root: options.root });
  const result = {
    command: options.command,
    status: options.command === "inventory" ? "recorded" : "satisfied",
    counts: report.counts,
    dispositionRows: 0,
    problems: [],
  };

  if (options.command === "inventory" && options.ledger !== undefined) {
    writeFileSync(
      options.ledger,
      `# Triage\n\n\`\`\`json\n${JSON.stringify({ dispositions: [] }, undefined, 2)}\n\`\`\`\n`,
    );
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
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
