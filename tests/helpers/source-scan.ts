/**
 * Shared source-scanning mechanic for the architecture gates.
 *
 * Two gates assert that a named set of repository files carries none of a named
 * set of forbidden textual surfaces: the NFR-5 orchestrator-network gate
 * (`tests/architecture/no-orchestrator-network.test.ts`) and the COMPAT-01
 * no-expansion gate (`tests/architecture/compat-01-no-expansion.test.ts`). The
 * mechanic lives here so the two share ONE implementation instead of
 * duplicating it, and so one gate can DELEGATE a clause to the other without
 * importing a `*.test.ts` module -- under `node:test`, importing a module that
 * registers cases at its top level registers those cases a SECOND time in the
 * importing file's run, doubling the work and misreporting the count (D-98-09).
 *
 * Every read goes through the `node:fs/promises` API rather than a subprocess
 * line tool (D-98-10). A `grep`-style subprocess treats a file it classifies as
 * binary as unprintable and reports nothing, which would green a gate on a file
 * it never actually inspected; `readFile(..., "utf8")` either yields the text or
 * throws, so no target can be silently skipped.
 *
 * Sibling of the other non-test modules under `tests/helpers/`
 * (`credential-mock.ts`, `git-mock.ts`): this file registers no case of its
 * own.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root, resolved from this module's own URL (`tests/helpers/`). */
export const REPO_ROOT: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Strip block and line comments ahead of pattern matching.
 *
 * Mandatory for every scanning clause: source files carry header docstrings
 * that legally NAME the forbidden symbols (e.g. "MUST NOT import platform/git"),
 * so an unstripped scan fails on its own subject's prose rather than on real
 * code.
 */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

/**
 * Read every repository-relative `targets` entry, strip its comments, and
 * accumulate one offender string per forbidden pattern match. Makes a SINGLE
 * deep-equality assertion against an empty array, so a failure reports every
 * offending file at once instead of only the first.
 *
 * `describeViolation` receives the accumulated offenders and returns the
 * requirement-anchored failure message, keeping each gate's own wording with
 * its own requirement IDs.
 *
 * A target that does not exist is skipped rather than failed: a gate may be
 * authored before the file it will guard, and its assertions fire as soon as
 * that file lands.
 */
export async function assertNoForbiddenSurface(
  targets: ReadonlyArray<string>,
  patterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }>,
  describeViolation: (offenders: ReadonlyArray<string>) => string,
): Promise<void> {
  const offenders: string[] = [];

  for (const rel of targets) {
    let src: string;
    try {
      src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        continue;
      }

      throw err;
    }

    const stripped = stripComments(src);
    for (const { name, pattern } of patterns) {
      if (pattern.test(stripped)) {
        offenders.push(`${rel} matches forbidden ${name}: ${String(pattern)}`);
      }
    }
  }

  assert.deepEqual(offenders, [], describeViolation(offenders));
}
