/**
 * tests/architecture/messaging-guide-doc-pins.test.ts -- MSGDOC-01: the
 * checkable half of `docs/messaging-style-guide.md`'s type-model claims.
 *
 * The guide is a present-tense normative document: it states what the notify
 * type model in `extensions/pi-claude-marketplace/shared/notify.ts` IS, not
 * what it once was. Most of the guide is prose no gate can judge -- whether a
 * rationale is sound, whether an example is well chosen, whether a carve-out is
 * fairly described. Reviewer-read stays the ceiling for all of that.
 *
 * The message-variant names are not prose. Each one is a claim that a type of
 * that name exists right now, and the claim rots in silence: renaming or
 * retiring a variant is a single edit in TypeScript that no compiler, linter or
 * reviewer connects to a sentence in markdown. A reader who greps for a name
 * the guide carries and finds nothing cannot tell whether the variant moved or
 * whether the guarantee was dropped. So the allowed set is read out of
 * `notify.ts` on every run and the guide is compared against it.
 *
 * The allowed set is DERIVED, never transcribed. A hand-maintained list of
 * accepted or banned names would be a second enumeration of the union with the
 * same failure mode as the one this gate exists to remove.
 *
 * Scope is the guide ALONE. `docs/adr/v2-001-structured-notify.md` carries an
 * older copy of the same material and is deliberately NOT pinned: an ADR is a
 * dated record of what was decided, so a name it carries that has since been
 * retired is correct history, and "fixing" it would falsify the record.
 * `tests/architecture/no-stale-test-citations.test.ts` states that same scope
 * split for its own citations and is the precedent followed here.
 *
 * What this gate deliberately does NOT claim: that the guide's prose is
 * accurate, that its rendered examples are byte-correct, or that any closed set
 * it describes is the right size. Rendered output bytes belong to
 * `docs/output-catalog.md` and are gated by
 * `tests/architecture/catalog-uat.test.ts`; closed-set lengths are tripwired by
 * `tests/architecture/notify-closed-set-locks.test.ts`.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, stripComments } from "./source-scan.ts";

const GUIDE = "docs/messaging-style-guide.md";
const NOTIFY = "extensions/pi-claude-marketplace/shared/notify.ts";

/**
 * An exported message type as `notify.ts` declares it.
 *
 * Anchored on the left by the line start, so a name mentioned inside a
 * declaration's body or in surrounding prose cannot widen the allowed set, and
 * on the right by the name's own word boundary, so a longer name is not
 * admitted by a match on a shorter one.
 */
const MESSAGE_DECLARATION = /^export (?:interface|type) ([A-Z][A-Za-z0-9]*Message)\b/gm;

/** A message-type name as the guide writes it, backticked or bare. */
const MESSAGE_MENTION = /\b[A-Z][A-Za-z0-9]*Message\b/g;

async function readRepoFile(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), "utf8");
}

test("MSGDOC-01: every message type the messaging guide names is one notify.ts declares", async () => {
  // arrange
  const [guide, notify] = await Promise.all([readRepoFile(GUIDE), readRepoFile(NOTIFY)]);

  // act -- comments are stripped from the source side because the declarations'
  // own docstrings name sibling variants in prose, which would admit a retired
  // name the moment any comment still mentioned it.
  const declared = new Set(
    [...stripComments(notify).matchAll(MESSAGE_DECLARATION)].map((match) => match[1] ?? ""),
  );
  const mentioned = [
    ...new Set([...guide.matchAll(MESSAGE_MENTION)].map((match) => match[0])),
  ].sort((left, right) => left.localeCompare(right));

  // assert -- both sides are proven non-empty first, so a rename or a deleted
  // section reports as an unbound gate rather than as a green run over nothing.
  assert.ok(
    declared.size > 0,
    `MSGDOC-01: no declaration matching ${String(MESSAGE_DECLARATION)} was found in ${NOTIFY}. This case reads its allowed set out of that file on every run; if the declarations moved or changed shape, point the pattern at them rather than listing the names here.`,
  );
  assert.ok(
    mentioned.length > 0,
    `MSGDOC-01: ${GUIDE} names no message type at all. The guide's Type Model Reference section points at the union by naming its types, so an empty set means that section is gone -- not that every name in it is valid.`,
  );
  assert.deepEqual(
    mentioned.filter((name) => !declared.has(name)),
    [],
    `MSGDOC-01: ${GUIDE} names a message type ${NOTIFY} does not declare. The guide is present-tense, so a name it carries asserts that the type exists now. A retired name belongs in the ADR that recorded its retirement, not in the guide.`,
  );
});
