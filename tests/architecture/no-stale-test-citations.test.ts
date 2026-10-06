/**
 * tests/architecture/no-stale-test-citations.test.ts -- every `tests/...` path
 * cited in policed content must resolve on disk.
 *
 * Comments and READMEs in `extensions/**` name test files to tell a reader
 * where a guarantee is enforced ("asserted by X", "byte-locked by X"). Suites
 * get renamed, merged, and deleted; the citations do not follow, so the claim
 * quietly starts pointing at nothing. A reader who follows one finds an absent
 * file and cannot tell whether the guard moved or the invariant was dropped.
 *
 * Policed: `extensions/` and `tests/` (`.md`, `.ts`, `.mjs`). `tests/` is
 * included because that tree is where citations are densest and where every
 * one of them is a present-tense claim about a sibling suite. `docs/` is not
 * policed, because documentation is not a build input.
 *
 * One shape is skipped by construction rather than by list: a `tests/...` path
 * that is the entire content of a single- or double-quoted string literal in a
 * `.ts` / `.mjs` file. That is a fixture path -- a file a test writes into a
 * temporary root -- and it describes that fixture tree, not this one. A
 * citation in code lives in a comment, where the backtick form is the
 * convention, and backticks are not exempt.
 *
 * This gate deliberately does NOT use `assertNoForbiddenSurface` or
 * `stripComments` from `./source-scan.ts`. That helper answers "do these named
 * files contain a forbidden token", which is the inverse question: here the
 * file set is the whole tree and the matched text is not forbidden, it is
 * checked for existence. Comments are scanned rather than stripped for the
 * same reason -- in extension code the citations live ONLY in comments.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./source-scan.ts";

const POLICED_ROOTS = ["extensions", "tests"] as const;
const POLICED_EXTENSIONS = new Set([".md", ".mjs", ".ts"]);

/**
 * A repository-relative test-file path. The character class excludes `*`, so a
 * glob (`tests/architecture/**\/*.test.ts`) never matches -- only a concrete
 * path does. A citation written relatively -- the target half of a markdown
 * link, which is spelled with a leading `../` -- matches from its `tests/`
 * segment, which is the repository-relative form this gate resolves.
 */
const CITATION = /tests\/[A-Za-z0-9_./-]*\.(?:ts|mjs)\b/g;

function isPoliced(rel: string): boolean {
  return POLICED_EXTENSIONS.has(path.extname(rel));
}

async function policedFiles(): Promise<string[]> {
  const found: string[] = [];

  for (const root of POLICED_ROOTS) {
    const entries = await readdir(path.join(REPO_ROOT, root), { recursive: true });
    found.push(...entries.map((entry) => path.join(root, entry)).filter(isPoliced));
  }

  return found;
}

/** A quote that opens a string literal; a backtick is prose, not a literal here. */
const STRING_DELIMITERS = new Set(['"', "'"]);

function isPlantedFixturePath(rel: string, src: string, match: RegExpExecArray): boolean {
  if (path.extname(rel) === ".md") {
    return false;
  }

  const before = src[match.index - 1];
  const after = src[match.index + match[0].length];

  return before !== undefined && STRING_DELIMITERS.has(before) && after === before;
}

function deadCitations(rel: string, src: string): string[] {
  const dead: string[] = [];

  for (const match of src.matchAll(CITATION)) {
    if (existsSync(path.join(REPO_ROOT, match[0])) || isPlantedFixturePath(rel, src, match)) {
      continue;
    }

    dead.push(`${rel}:${src.slice(0, match.index).split("\n").length} cites ${match[0]}`);
  }

  return dead;
}

test("every `tests/...` path cited in policed content resolves on disk", async () => {
  // arrange
  const files = await policedFiles();

  // act
  const offenders: string[] = [];
  for (const rel of files) {
    offenders.push(...deadCitations(rel, await readFile(path.join(REPO_ROOT, rel), "utf8")));
  }

  // assert
  assert.deepEqual(
    offenders,
    [],
    `Stale test-path citation. Each site below names a test file that does not exist, so the guarantee it claims points at nothing. Repoint it at the suite that enforces the claim TODAY; if no suite does, say so in the text instead of naming a file.\n${offenders.join("\n")}`,
  );
});
