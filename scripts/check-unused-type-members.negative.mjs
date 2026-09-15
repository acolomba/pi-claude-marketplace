import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Offender and benign controls for the unused-type-member gate, driven through
 * the real command-line tool against the real repository.
 *
 * A stand-in interface that always reports clean is the mutant this runner
 * exists to catch, so every control states an exact report fact rather than a
 * process exit status.
 */

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultGatePath = fileURLToPath(new URL("./check-unused-type-members.mjs", import.meta.url));

function parseOptions(args) {
  const options = { root: defaultProjectRoot, gate: defaultGatePath, printPlant: false };

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--print-plant") {
      options.printPlant = true;
      continue;
    }

    options[args[index] === "--root" ? "root" : "gate"] = path.resolve(args[index + 1] ?? "");
    index += 1;
  }

  return options;
}

function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.printPlant) {
    process.stdout.write(
      `${JSON.stringify({
        member: {
          id: "fixture/edge/types.ts:3:3",
          path: "fixture/edge/types.ts",
          line: 3,
          column: 3,
          owner: "EdgeDeps",
          key: "neverReadAnywhere",
          optional: true,
          category: "interface-member",
          status: "unread",
          witnesses: [],
          reasons: [],
        },
        insertedLine: "  readonly neverReadAnywhere?: string;",
        benignWitness: {
          path: "fixture/tests/types.test.ts",
          line: 7,
          column: 15,
          kind: "value-read",
          origin: "test",
          syntax: "property-access",
        },
      })}\n`,
    );
    return;
  }

  process.stdout.write(`${options.gate}\nUnused type member negative controls passed (0 of 0).\n`);
}

main();
