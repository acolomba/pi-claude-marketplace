import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fails any workflow that installs npm packages without `--ignore-scripts`. Without the flag,
 * a dependency's install script runs arbitrary code inside the workflow job, with whatever
 * permissions and secrets that job holds.
 *
 * No off-the-shelf workflow linter carries this check, which is why this is a local script
 * rather than another hook. Its companion `.negative.mjs` plants a violation and proves the
 * gate flags it.
 */

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workflowRoot = ".github/workflows";
const ignoreScriptsFlag = "--ignore-scripts";
// A leading `-` would make this the tail of some longer token rather than an install call.
const installCallPattern = /(^|[^-])\bnpm\s+(ci|install|i)\b/;

function toProjectPath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function workflowPaths(projectRoot) {
  const absoluteRoot = path.join(projectRoot, workflowRoot);

  if (!existsSync(absoluteRoot)) {
    throw new Error(`Required directory does not exist: ${workflowRoot}`);
  }

  return readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => toProjectPath(projectRoot, path.join(entry.parentPath, entry.name)))
    .sort();
}

export function checkWorkflowInstallScripts(projectRoot = defaultProjectRoot) {
  const violations = [];

  for (const workflowPath of workflowPaths(projectRoot)) {
    const lines = readFileSync(path.join(projectRoot, workflowPath), "utf8").split("\n");

    lines.forEach((text, index) => {
      if (!installCallPattern.test(text) || text.includes(ignoreScriptsFlag)) {
        return;
      }

      violations.push({ path: workflowPath, line: index + 1, text: text.trim() });
    });
  }

  return violations;
}

function parseProjectRoot(args) {
  if (args.length === 0) {
    return defaultProjectRoot;
  }

  if (args.length === 2 && args[0] === "--root") {
    return path.resolve(args[1]);
  }

  throw new Error("Pass no arguments or --root <project-path>");
}

function main() {
  const projectRoot = parseProjectRoot(process.argv.slice(2));
  const violations = checkWorkflowInstallScripts(projectRoot);

  if (violations.length === 0) {
    process.stdout.write("Workflow install-scripts gate passed.\n");
    return;
  }

  for (const violation of violations) {
    process.stderr.write(
      `missing ${ignoreScriptsFlag}: ${violation.path}:${violation.line}: ${violation.text}\n`,
    );
  }

  process.stderr.write(
    `Workflow install-scripts gate failed with ${violations.length} violation(s).\n`,
  );
  process.exitCode = 1;
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
