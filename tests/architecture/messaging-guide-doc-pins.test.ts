/**
 * tests/architecture/messaging-guide-doc-pins.test.ts -- MSGDOC-01: the
 * checkable half of `docs/messaging-style-guide.md`'s type-model claims.
 *
 * The guide is a present-tense normative document: it states what the notify
 * type model in `extensions/pi-claude-marketplace/shared/notification-types.ts`
 * IS, not what it once was. Most of the guide is prose no gate can judge -- whether a
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
 * The status-by-field table is the guide's other checkable claim, and it is
 * bound at both ends. Its status column is compared against the declared
 * `PluginStatus` declaration, so appending a status reddens the case without any
 * reader re-checking the document. Its cells are compared against
 * `FIELD_DISCIPLINE`, whose value type is computed from the union's own
 * interfaces, so moving a field between required, optional and absent is a
 * `npm run typecheck` error at that literal. Every figure the guide states
 * ABOUT the table -- the reason-bearing count, the `reasons` partition sum, the
 * no-scope carve-out family -- is derived from the table's rows rather than
 * matched against a number written here: a count with nothing to check it
 * against is precisely the defect this gate closes.
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
 * `tests/architecture/catalog-uat/catalog-contract.test.ts`; closed-set lengths are tripwired by
 * `tests/architecture/notify-closed-set-locks.test.ts`.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, stripComments } from "./source-scan.ts";

import type {
  PluginNotificationMessage,
  PluginStatus,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

const GUIDE = "docs/messaging-style-guide.md";
const NOTIFY = "extensions/pi-claude-marketplace/shared/notification-types.ts";

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

/**
 * The paragraph that introduces the status-by-field table, used to delimit it.
 *
 * The table is located by this marker rather than by a row shape shared with
 * every other table in the document: the guide carries a second table whose
 * first cell is also backticked, and a shape-only scan would silently read
 * whichever one came first.
 */
const TABLE_ANCHOR = "**Field discipline per status.**";

/** The four fields the table has a column for, in column order. */
const DISCIPLINE_FIELDS = ["reasons", "dependencies", "version", "scope"] as const;

type DisciplineField = (typeof DISCIPLINE_FIELDS)[number];

/** The closed vocabulary a discipline cell may hold. */
const DISCIPLINE_VALUES: readonly string[] = ["required", "optional", "absent"];

/** The table's header cells, in column order. */
const TABLE_HEADER: readonly string[] = [
  "Status",
  "`reasons`",
  "`dependencies`",
  "`version`",
  "`scope`",
];

/** The union arm carrying one status discriminator. */
type ArmFor<S extends PluginStatus> = Extract<PluginNotificationMessage, { status: S }>;

/**
 * What one arm declares for one field, computed from the union itself.
 *
 * `{} extends Pick<Arm, F>` is the optionality test: an interface whose only
 * property is optional accepts the empty object, one whose property is required
 * does not. The field is intersected with `keyof` because the true branch of a
 * conditional type does not narrow the checked type parameter for `Pick`.
 */
type Discipline<S extends PluginStatus, F extends string> = F extends keyof ArmFor<S>
  ? Record<string, never> extends Pick<ArmFor<S>, F & keyof ArmFor<S>>
    ? "optional"
    : "required"
  : "absent";

/**
 * The whole table as a type: total over the status union, and total over the
 * four columns, with every cell's legal value computed from the interfaces.
 *
 * Totality in both directions is what makes the literal below a gate rather
 * than a transcription. Appending a status to `PluginStatus` adds a key the
 * literal does not supply, and moving a field between required, optional and
 * absent narrows a cell's type away from the literal's value. Either one is a
 * `npm run typecheck` error at the literal, before any case runs.
 */
type FieldDiscipline = {
  readonly [S in PluginStatus]: { readonly [F in DisciplineField]: Discipline<S, F> };
};

const FIELD_DISCIPLINE: FieldDiscipline = {
  installed: {
    reasons: "optional",
    dependencies: "required",
    version: "optional",
    scope: "optional",
  },
  updated: { reasons: "optional", dependencies: "required", version: "absent", scope: "optional" },
  reinstalled: {
    reasons: "optional",
    dependencies: "required",
    version: "optional",
    scope: "optional",
  },
  uninstalled: {
    reasons: "optional",
    dependencies: "absent",
    version: "optional",
    scope: "optional",
  },
  available: { reasons: "optional", dependencies: "absent", version: "optional", scope: "absent" },
  unavailable: {
    reasons: "required",
    dependencies: "absent",
    version: "optional",
    scope: "absent",
  },
  upgradable: {
    reasons: "required",
    dependencies: "absent",
    version: "optional",
    scope: "optional",
  },
  failed: { reasons: "required", dependencies: "absent", version: "optional", scope: "optional" },
  skipped: { reasons: "required", dependencies: "absent", version: "optional", scope: "optional" },
  "manual recovery": {
    reasons: "required",
    dependencies: "absent",
    version: "optional",
    scope: "optional",
  },
  "will install": {
    reasons: "absent",
    dependencies: "absent",
    version: "absent",
    scope: "optional",
  },
  "will uninstall": {
    reasons: "optional",
    dependencies: "absent",
    version: "absent",
    scope: "optional",
  },
  "will enable": {
    reasons: "absent",
    dependencies: "absent",
    version: "absent",
    scope: "optional",
  },
  "will disable": {
    reasons: "absent",
    dependencies: "absent",
    version: "absent",
    scope: "optional",
  },
  disabled: { reasons: "optional", dependencies: "absent", version: "optional", scope: "optional" },
  "partially-installed": {
    reasons: "required",
    dependencies: "optional",
    version: "optional",
    scope: "optional",
  },
  "partially-upgradable": {
    reasons: "required",
    dependencies: "absent",
    version: "optional",
    scope: "optional",
  },
  "partially-available": {
    reasons: "required",
    dependencies: "absent",
    version: "optional",
    scope: "absent",
  },
  remote: { reasons: "optional", dependencies: "absent", version: "optional", scope: "absent" },
};

/** One parsed data row of the status-by-field table. */
interface DisciplineRow {
  readonly status: string;
  readonly cells: Record<DisciplineField, string>;
}

async function readRepoFile(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), "utf8");
}

/** Split one markdown table line into its trimmed cells. */
function tableCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/**
 * The status-by-field table's data rows, read out of the guide.
 *
 * The header is asserted rather than skipped: a reordered column would
 * otherwise be compared against the wrong field and report as a discipline
 * drift, which says nothing about the column swap that caused it.
 */
function disciplineRows(doc: string): DisciplineRow[] {
  const anchor = doc.indexOf(TABLE_ANCHOR);
  assert.notEqual(
    anchor,
    -1,
    `MSGDOC-01: ${GUIDE} no longer carries the "${TABLE_ANCHOR}" paragraph. This case reads the table that follows it; if the section was renamed, move this marker with it rather than falling back to a shape-only scan.`,
  );

  const block = doc.slice(anchor).split("\n\n")[1] ?? "";
  const lines = block.split("\n").filter((line) => line.startsWith("|"));
  assert.deepEqual(
    tableCells(lines[0] ?? ""),
    TABLE_HEADER,
    `MSGDOC-01: ${GUIDE}'s status-by-field table no longer carries the columns this case reads, in this order.`,
  );

  return lines.slice(2).map((line) => {
    const cells = tableCells(line);
    assert.equal(
      cells.length,
      TABLE_HEADER.length,
      `MSGDOC-01: a row of ${GUIDE}'s status-by-field table carries ${cells.length} cells, not the ${TABLE_HEADER.length} this case reads. An escaped pipe inside a cell also lands here: the columns are split on the delimiter.`,
    );

    return {
      status: /^`([^`]+)`$/.exec(cells[0] ?? "")?.[1] ?? cells[0] ?? "",
      // fromEntries widens to a string index; DISCIPLINE_FIELDS supplies exactly
      // this record's key set, one entry per field, so the narrowing is safe.
      cells: Object.fromEntries(
        DISCIPLINE_FIELDS.map((field, index) => [field, cells[index + 1] ?? ""]),
      ) as Record<DisciplineField, string>,
    };
  });
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

/**
 * The members of one closed vocabulary `notification-types.ts` declares, in
 * declaration order. A union carries membership and not order, so the
 * declaration text is the only place the order exists; reading it as data is
 * what lets the table's row order be asserted rather than transcribed.
 */
function declaredVocabulary(src: string, name: string): readonly string[] {
  const opening = `export type ${name} =`;
  const start = src.indexOf(opening);
  assert.notStrictEqual(
    start,
    -1,
    `MSGDOC-01: ${NOTIFY} declares no ${name} vocabulary, so this case inspected nothing.`,
  );

  const end = src.indexOf(";", start);
  assert.notStrictEqual(
    end,
    -1,
    `MSGDOC-01: the ${name} declaration in ${NOTIFY} is unterminated, so its members could not be read.`,
  );

  return [...src.slice(start + opening.length, end).matchAll(/"([^"]*)"/g)].map(
    (match) => match[1] ?? "",
  );
}

test("MSGDOC-01: the status-by-field table's status column is PluginStatus in declaration order", async () => {
  // arrange
  const [guide, notify] = await Promise.all([readRepoFile(GUIDE), readRepoFile(NOTIFY)]);
  const declaredStatuses = declaredVocabulary(stripComments(notify), "PluginStatus");

  // act
  const rows = disciplineRows(guide);

  // assert -- against the declaration read as data, not a transcription of it,
  // so a status appended to the closed set reddens this case with no reader
  // re-checking the guide.
  assert.deepEqual(
    rows.map((row) => row.status),
    declaredStatuses,
    `MSGDOC-01: ${GUIDE}'s status-by-field table does not carry exactly the PluginStatus members, in declaration order. The table states the per-arm field discipline once, so a missing row is a variant whose discipline the guide no longer states at all.`,
  );
});

test("MSGDOC-01: every discipline cell is inside the closed three-value vocabulary", async () => {
  // arrange
  const guide = await readRepoFile(GUIDE);

  // act
  const rows = disciplineRows(guide);
  const offenders = rows.flatMap((row) =>
    DISCIPLINE_FIELDS.filter((field) => !DISCIPLINE_VALUES.includes(row.cells[field])).map(
      (field) => `${row.status}.${field} = "${row.cells[field]}"`,
    ),
  );

  // assert -- the vocabulary is checked before the values are compared, so free
  // text in a cell reports as free text rather than as a discipline that drifted.
  assert.deepEqual(
    offenders,
    [],
    `MSGDOC-01: a cell of ${GUIDE}'s status-by-field table holds a value outside ${JSON.stringify(DISCIPLINE_VALUES)}. The three values are the whole vocabulary an interface can express for a field; a fourth is a claim the type model cannot make.`,
  );
});

test("MSGDOC-01: the status-by-field table matches what each variant interface declares", async () => {
  // arrange
  const guide = await readRepoFile(GUIDE);

  // act
  const documented = Object.fromEntries(
    disciplineRows(guide).map((row) => [row.status, row.cells]),
  );

  // assert -- FIELD_DISCIPLINE is type-checked against the union itself, so a
  // source drift is a typecheck error at its literal and this comparison stays
  // a plain deep-equal between the document and the compiler's answer.
  assert.deepEqual(
    documented,
    FIELD_DISCIPLINE,
    `MSGDOC-01: ${GUIDE}'s status-by-field table disagrees with the interfaces in ${NOTIFY}. If the source moved, fix the table; if the table is right and the compiler disagrees, the expectation in this file is what changed and it is the artifact bound to the source.`,
  );
});

test("MSGDOC-01: the figures the guide states about the table agree with the table", async () => {
  // arrange
  const guide = await readRepoFile(GUIDE);

  // act
  const rows = disciplineRows(guide);
  const reasonBearing = rows.filter((row) => row.cells.reasons !== "absent").length;
  const partition = DISCIPLINE_VALUES.map(
    (value) => rows.filter((row) => row.cells.reasons === value).length,
  );
  const noScopeFamily = `\`${rows
    .filter((row) => row.cells.scope === "absent")
    .map((row) => row.status)
    .join(" | ")}\``;

  const statedReasonBearing = [...guide.matchAll(/the (\d+) reason-bearing plugin variants/g)].map(
    (match) => Number(match[1]),
  );
  const statedPartition = /(\d+) `required` plus (\d+) `optional` plus (\d+) `absent`/.exec(guide);

  // assert -- every figure the guide states about this table is derived from the
  // table beneath it. A number restated for the reader's convenience, with
  // nothing to check it against, is the defect this gate exists to close.
  assert.deepEqual(
    statedReasonBearing,
    [reasonBearing, reasonBearing],
    `MSGDOC-01: ${GUIDE} states the reason-bearing variant count in two places and the table counts ${reasonBearing} rows whose \`reasons\` cell is not "absent". Both statements move with the table or neither does.`,
  );
  assert.ok(
    statedPartition,
    `MSGDOC-01: ${GUIDE} no longer states the \`reasons\` partition as a sum. The sum is what makes the three groups checkable against the table; a bare count of one group is not.`,
  );
  assert.deepEqual(
    [Number(statedPartition[1]), Number(statedPartition[2]), Number(statedPartition[3])],
    partition,
    `MSGDOC-01: ${GUIDE}'s \`reasons\` partition sum disagrees with the table. The sum has to account for every row, so a group that grew without the sum moving means a row changed discipline unnoticed.`,
  );
  assert.equal(
    guide.split(noScopeFamily).length - 1,
    2,
    `MSGDOC-01: ${GUIDE} names the no-scope carve-out family in two places -- the table's rationale and the scope-bracket grammar rule -- and both must read "${noScopeFamily}", the statuses whose \`scope\` cell is "absent", in tuple order.`,
  );
});
