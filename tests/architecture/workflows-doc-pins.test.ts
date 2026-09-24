/**
 * tests/architecture/workflows-doc-pins.test.ts -- WDOC-01 / WDEP-04: the
 * checkable half of the workflows documentation claims.
 *
 * Most of what `docs/workflows-compatibility.md` asserts is prose a gate cannot
 * judge: whether a claim is honestly evidence-graded, whether the sandbox
 * description is fair, whether the two READMEs read equivalently in two
 * languages. Reviewer-read stays the ceiling for all of that.
 *
 * Four claims in that document are NOT prose, and each one rots silently:
 *
 *   1. The floor `>=0.86.1` the document attributes to this project is a copy
 *      of `package.json`. Bumping the peer range reddens
 *      `tests/architecture/peer-floor.test.ts` (FLOOR-01) and leaves the
 *      document stating a floor the package no longer declares.
 *   2. The counts `nine` and `six` are stated in prose AND enumerated a few
 *      lines below as a table and a bullet list. Editing one without the other
 *      is a self-contradiction inside a single section, and the document's own
 *      rule -- state only counts with an honest counting rule behind them --
 *      is what those two enumerations are for.
 *   3. Whether both READMEs carry the workflows entry at all. A one-language
 *      edit is the failure this pair has already had (WR-02).
 *   4. The classification table's `This bridge` and `Gate name` columns. The
 *      first is a closed three-valued set; the second names, on every `warn`
 *      row, the union `GATE_ORDER` declares in `domain/workflow-script.ts`
 *      (WGATE-05). The union lives in TypeScript and the rows live in
 *      markdown, so no single edit can satisfy both halves.
 *
 * What this gate deliberately does NOT claim: that `nine` and `six` are the
 * engine's real figures. Those are source-read at 3.10.1 and only a re-read of
 * the engine can confirm them (recorded as open debt against `WPIN-01`). This
 * gate pins the document's internal agreement, which is the part that can be
 * checked from inside this repository.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, stripComments } from "./source-scan.ts";

const COMPAT_DOC = "docs/workflows-compatibility.md";
const ANALYZER = "extensions/pi-claude-marketplace/domain/workflow-script.ts";
const ENGINE = "@quintinshaw/pi-dynamic-workflows";
const PEER = "@earendil-works/pi-coding-agent";

/** The closed set the classification table's `This bridge` column may hold. */
const BRIDGE_VALUES: readonly string[] = ["replicate", "warn", "neither"];

/** The `Gate name` cell of every row this bridge does not warn about. */
const GATE_NAME_PLACEHOLDER = "--";

/**
 * A `Gate name` cell, anchored at BOTH ends of the trimmed cell so a longer
 * name cannot satisfy a match on a shorter one. An unanchored search for a
 * known name is green for a superstring, which is how a rename greened a
 * sibling gate in this directory.
 */
const GATE_NAME_CELL = /^`([^`]+)`$/;

/**
 * `GATE_ORDER`'s declaration in the analyzer, read as source text.
 *
 * Anchored on the left by the line start and on the right by ` = [`, so a
 * rename to a name this one is a PREFIX of -- `GATE_ORDER_V2` -- fails to
 * match and reports a missing declaration rather than binding the document to
 * a tuple that no longer carries that name.
 */
const GATE_ORDER_DECLARATION = /^const GATE_ORDER = \[([^\]]*)\] as const;/m;

/** One parsed row of the refusal-check classification table. */
interface ClassificationRow {
  readonly number: number;
  readonly bridge: string;
  readonly gateName: string;
}

interface PackageJson {
  peerDependencies?: Record<string, string>;
}

async function readRepoFile(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * Split every numbered table row into its six cells.
 *
 * The row pattern is the same document-wide one the count case uses, which is
 * sound only while the classification table is the document's ONLY numbered
 * table -- the count case asserts exactly that, by requiring the numbers to be
 * `[1..9]`.
 */
function classificationRows(doc: string): ClassificationRow[] {
  return [...doc.matchAll(/^\| (\d+)\s+\|.*\|$/gm)].map((match) => {
    const cells = (match[0] ?? "")
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    assert.equal(
      cells.length,
      6,
      `WGATE-05: a row of ${COMPAT_DOC}'s classification table carries ${cells.length} cells, not the six this gate reads (number, check, engine message, this bridge, gate name, notes). An escaped pipe inside a cell also lands here: the columns are split on the delimiter.`,
    );

    return {
      number: Number(cells[0]),
      bridge: cells[3] ?? "",
      gateName: GATE_NAME_CELL.exec(cells[4] ?? "")?.[1] ?? cells[4] ?? "",
    };
  });
}

/** The gate union, read out of the analyzer's own source text. */
function gateOrderMembers(analyzerSource: string): string[] {
  const declaration = GATE_ORDER_DECLARATION.exec(stripComments(analyzerSource));
  assert.ok(
    declaration,
    `WGATE-05: no declaration matching ${String(GATE_ORDER_DECLARATION)} was found in ${ANALYZER}. This case binds ${COMPAT_DOC}'s warned rows to that tuple, so a rename leaves the document unbound; point the pattern at the new name.`,
  );

  return [...(declaration[1] ?? "").matchAll(/"([^"]+)"/g)].map((member) => member[1] ?? "");
}

test("WDEP-04: the compatibility doc states this project's peer floor as package.json declares it", async () => {
  // arrange
  const [doc, pkgRaw] = await Promise.all([readRepoFile(COMPAT_DOC), readRepoFile("package.json")]);
  const declared = (JSON.parse(pkgRaw) as PackageJson).peerDependencies?.[PEER];
  assert.ok(declared, `package.json declares no peerDependencies["${PEER}"]`);

  // act -- the document names both floors in one section, one bullet each, so
  // the two are matched by the package each bullet names rather than by a bare
  // version scan that could pair either number with either package.
  const ownFloor =
    /`pi-claude-marketplace` peers on `@earendil-works\/pi-coding-agent ([^`]+)`/.exec(doc);
  const engineFloor = new RegExp(
    `\`${ENGINE.replace("/", "\\/")}\` [0-9.]+ peers on \`@earendil-works\\/pi-coding-agent ([^\`]+)\``,
  ).exec(doc);

  // assert
  assert.ok(ownFloor, `${COMPAT_DOC} no longer states this project's own peer floor`);
  assert.ok(engineFloor, `${COMPAT_DOC} no longer states the host engine's peer floor`);
  assert.equal(
    ownFloor[1],
    declared,
    `${COMPAT_DOC} states this project's floor as "${ownFloor[1]}" while package.json declares "${declared}". The document is the operator-facing copy of the package's own range; move it with the bump.`,
  );
  assert.notEqual(
    engineFloor[1],
    ownFloor[1],
    `${COMPAT_DOC} now states the same floor for both packages. Criterion 5 is that the engine's floor is documented as DISTINCT from this project's; if they have genuinely converged, the surrounding "satisfies this extension's floor and not the engine's" paragraph is wrong too.`,
  );
});

test("WDOC-01: the refusal-check counts agree with the enumerations beneath them", async () => {
  // arrange
  const doc = await readRepoFile(COMPAT_DOC);

  // act -- the numbered rows of the classification table, and the bullets of
  // the `validateMeta` message list that follows it.
  const tableRows = [...doc.matchAll(/^\| (\d+)\s+\| /gm)].map((m) => Number(m[1]));
  // The bullet list is delimited by its own introduction rather than by a
  // shape the bullets share: they are the engine's verbatim strings, and
  // pattern-matching their wording would quietly drop the one that does not
  // start with `meta`.
  const listStart = doc.indexOf("**six distinct messages**");
  const listBody = doc.slice(listStart).split("\n\n")[1] ?? "";
  const messageBullets = [...listBody.matchAll(/^- "[^"]+"$/gm)];

  // assert -- the enumerations first, so a count that drifted reports as a
  // drift rather than as a missing section.
  assert.deepEqual(
    tableRows,
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    `${COMPAT_DOC}'s refusal-check table no longer holds exactly nine consecutively numbered rows.`,
  );
  assert.equal(
    messageBullets.length,
    6,
    `${COMPAT_DOC}'s validateMeta message list no longer holds exactly six bullets.`,
  );
  assert.match(
    doc,
    /\*\*nine distinct checks\*\*/,
    `${COMPAT_DOC} states a check count other than nine while its table enumerates nine rows.`,
  );
  assert.match(
    doc,
    /\*\*six distinct messages\*\*/,
    `${COMPAT_DOC} states a message count other than six while its list enumerates six bullets.`,
  );
  // The retired figure. It came from the archived requirement text and names a
  // count no enumeration in this document supports.
  assert.doesNotMatch(
    doc,
    /seven gates/i,
    `${COMPAT_DOC} carries the retired "seven gates" figure. The engine's admission path is documented as nine checks, two of them replicated here.`,
  );
});

test("WGATE-05: the classification column is closed and its warned rows name the source's gate union", async () => {
  // arrange
  const [doc, analyzer] = await Promise.all([readRepoFile(COMPAT_DOC), readRepoFile(ANALYZER)]);

  // act
  const rows = classificationRows(doc);
  const numbersValued = (value: string): number[] =>
    rows.filter((row) => row.bridge === value).map((row) => row.number);
  const warned = rows.filter((row) => row.bridge === "warn");
  const members = gateOrderMembers(analyzer);

  // assert -- the column is a closed set first, so a blank or invented value
  // reports as free text rather than as a partition that lost a row.
  assert.deepEqual(
    rows.filter((row) => !BRIDGE_VALUES.includes(row.bridge)).map((row) => row.number),
    [],
    `WGATE-05: ${COMPAT_DOC}'s \`This bridge\` column holds a value outside ${JSON.stringify(BRIDGE_VALUES)}. The column states what the bridge DOES with each engine check, and a fourth value is a claim nothing in this repository implements.`,
  );
  assert.deepEqual(
    {
      replicate: numbersValued("replicate"),
      warn: numbersValued("warn"),
      neither: numbersValued("neither"),
    },
    { replicate: [1, 2], warn: [3, 4, 5, 6, 8, 9], neither: [7] },
    `WGATE-05: ${COMPAT_DOC}'s classification partition moved. If the bridge's behavior genuinely changed, re-derive this expectation from a measurement against the engine -- do not edit it to match the document, which is the artifact under test.`,
  );
  assert.deepEqual(
    warned.map((row) => row.gateName),
    members,
    `WGATE-05: ${COMPAT_DOC}'s warned rows name a different gate set, or a different order, than \`GATE_ORDER\` declares in ${ANALYZER}. The union and the table are two artifacts one edit cannot move together; whichever side changed, the other has to follow.`,
  );
  assert.deepEqual(
    rows
      .filter((row) => row.bridge !== "warn" && row.gateName !== GATE_NAME_PLACEHOLDER)
      .map((row) => row.number),
    [],
    `WGATE-05: a row of ${COMPAT_DOC}'s classification table that the document does not call \`warn\` still names a gate. Every non-warned row's \`Gate name\` cell is \`${GATE_NAME_PLACEHOLDER}\`, so a gate cannot hide on a row the document says produces no warning.`,
  );
});

test("WDOC-01: both READMEs carry the workflows entry in Features and in Prerequisites", async () => {
  // arrange
  const readmes = ["README.md", "README.es.md"];

  // act
  const positions = await Promise.all(
    readmes.map(async (rel) => {
      const lines = (await readRepoFile(rel)).split("\n");
      const engineLines = lines
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => line.includes(ENGINE))
        .map(({ number }) => number);
      const docLinks = lines.filter((line) => line.includes(`(${COMPAT_DOC})`)).length;
      return { rel, engineLines, docLinks };
    }),
  );

  // assert -- one projection over both files, so a one-language edit reports as
  // the parity failure it is rather than as two unrelated rows.
  const [en, es] = positions;
  assert.ok(en !== undefined && es !== undefined);
  assert.deepEqual(
    positions.map(({ rel, engineLines, docLinks }) => ({
      rel,
      engineMentions: engineLines.length,
      docLinks,
    })),
    readmes.map((rel) => ({ rel, engineMentions: 2, docLinks: 1 })),
    `Each README names ${ENGINE} exactly twice -- once in the component list, once in the prerequisite list -- and links ${COMPAT_DOC} once. A count that moved in one language and not the other is the failure this pair has already had.`,
  );
  assert.deepEqual(
    es.engineLines,
    en.engineLines,
    `README.es.md carries the workflows entries on different lines than README.md. The two files are maintained line-for-line; a bullet added to one alone shifts them apart.`,
  );
});
