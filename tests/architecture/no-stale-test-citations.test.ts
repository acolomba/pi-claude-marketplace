/**
 * tests/architecture/no-stale-test-citations.test.ts -- every `tests/...` path
 * cited in policed content must resolve on disk.
 *
 * Comments in `extensions/**` and prose in `docs/**` name test files to tell a
 * reader where a guarantee is enforced ("asserted by X", "byte-locked by X").
 * Suites get renamed, merged, and deleted; the citations do not follow, so the
 * claim quietly starts pointing at nothing. A reader who follows one finds an
 * absent file and cannot tell whether the guard moved or the invariant was
 * dropped. This is the same failure mode `./source-scan.ts` names at WR-06 --
 * a gate that inspects a file that no longer exists -- arriving through prose
 * instead of through a target list.
 *
 * Policed: `docs/`, `extensions/`, `tests/` (`.md`, `.ts`, `.mjs`). `tests/`
 * is included because that tree is where citations are densest and where every
 * one of them is a present-tense claim about a sibling suite.
 *
 * NOT policed, because these are dated records rather than descriptions of
 * today's tree -- a citation in them is correct history, and "fixing" it would
 * falsify the record:
 *   - `docs/adr/`      accepted decisions, including the migration plans that
 *                      SCHEDULED the deletion of the suites they name
 *   - `docs/research/` pre-implementation research, which proposes files by
 *                      the path they would be written to
 *   - `docs/plans/`    date-stamped design documents, same proposal shape
 *
 * That scope split is the whole suppression story: with those three excluded
 * the gate needs NO per-citation allowlist, so there is no list to grow and no
 * pressure to disable the gate over legitimate historical prose.
 *
 * This gate deliberately does NOT use `assertNoForbiddenSurface` or
 * `stripComments` from `./source-scan.ts`. That helper answers "do these named
 * files contain a forbidden token", which is the inverse question: here the
 * file set is the whole tree and the matched text is not forbidden, it is
 * checked for existence. Comments are scanned rather than stripped for the
 * same reason -- in the extension tree the citations live ONLY in comments.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./source-scan.ts";

const POLICED_ROOTS = ["docs", "extensions", "tests"] as const;
const POLICED_EXTENSIONS = new Set([".md", ".mjs", ".ts"]);
const EXCLUDED_PREFIXES = [
  path.join("docs", "adr"),
  path.join("docs", "plans"),
  path.join("docs", "research"),
];

/**
 * A repository-relative test-file path. The character class excludes `*`, so a
 * glob (`tests/architecture/**\/*.test.ts`) never matches -- only a concrete
 * path does. A citation written relatively -- the target half of a markdown
 * link, which is spelled with a leading `../` -- matches from its `tests/`
 * segment, which is the repository-relative form this gate resolves.
 */
const CITATION = /tests\/[A-Za-z0-9_./-]*\.(?:ts|mjs)\b/g;

function isPoliced(rel: string): boolean {
  return (
    POLICED_EXTENSIONS.has(path.extname(rel)) &&
    !EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))
  );
}

async function policedFiles(): Promise<string[]> {
  const found: string[] = [];

  for (const root of POLICED_ROOTS) {
    const entries = await readdir(path.join(REPO_ROOT, root), { recursive: true });
    found.push(...entries.map((entry) => path.join(root, entry)).filter(isPoliced));
  }

  return found;
}

function deadCitations(rel: string, src: string): string[] {
  const dead: string[] = [];

  for (const match of src.matchAll(CITATION)) {
    if (existsSync(path.join(REPO_ROOT, match[0]))) {
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
    `Stale test-path citation. Each site below names a test file that does not exist, so the guarantee it claims points at nothing. Repoint it at the suite that enforces the claim TODAY; if no suite does, say so in the text instead of naming a file. Dated records (docs/adr, docs/plans, docs/research) are exempt and are not listed here.\n${offenders.join("\n")}`,
  );
});
