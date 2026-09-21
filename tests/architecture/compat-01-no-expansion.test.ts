/**
 * tests/architecture/compat-01-no-expansion.test.ts -- the COMPAT-01
 * no-expansion contract gate.
 *
 * COMPAT-01 promises that the manifest-independent lifecycle work introduced NO
 * manifest snapshot, NO orphan field on the persisted record, NO state-schema
 * migration, NO status token, NO reason token, NO glyph, and NO new network
 * path. This one file holds every structural clause of that promise, so a
 * reviewer reads this file and knows the whole contract.
 *
 * Clause by clause:
 *
 *   Closed sets (COMPAT-01 / D-98-08) -- `Reason`, `StatusToken`,
 *   `PluginStatus`, and `MarketplaceStatus` each equal a hand-written literal
 *   member list, in the vocabulary's own declared order. ENUMERATION equality,
 *   not a count: a count pin catches a member ADDED, but not a member renamed or
 *   swapped for another. Adding, removing, or renaming any member fails here and
 *   forces a deliberate amendment. Each set is stated twice, because the two
 *   halves see different things: the order comes from the declaration read as
 *   data, and the membership from a bidirectional proof against the union the
 *   renderer is actually written against.
 *
 *   Glyphs (COMPAT-01) -- each of the seven glyphs equals its exact code point,
 *   written as an escape so the pin states the code point rather than relying on
 *   the reader to identify a character by eye. Five are exported and pinned
 *   directly; the two that are module-private are pinned through the three rows
 *   that carry them -- their own row renderer each, plus the `info` plugin row,
 *   which reaches both through `pluginInfoStatusGlyph`. There is no COLLECTION
 *   of glyphs, so an EIGHTH glyph cannot be
 *   caught by comparing a tuple; the notification grammar owner's
 *   declaration count is the only way to catch one, and it is one of the two
 *   clauses here that scan source.
 *
 *   Persistence (COMPAT-01) -- the persisted install record's key set is exactly
 *   its pinned eleven fields, and neither a manifest-snapshot-shaped key nor an
 *   orphan-shaped key appears. The public state's version type admits exactly
 *   the three versions the record has had, and the frozen default state
 *   declares the current one. A key joins the record only by one of the two
 *   sanctioned routes (optional with no bump, or required with a bump and a
 *   pre-validation fill, per D-04-03), and a version joins the union only with
 *   such a fill behind it; either lands here deliberately.
 *
 *   Network (COMPAT-01 / D-98-09) -- DELEGATED, not duplicated. The NFR-5
 *   orchestrator-network gate already proves both info surfaces carry zero
 *   gitOps surface; this file asserts those two surfaces are still among that
 *   gate's targets, so the clause is documented here and proven there. The
 *   delegation is mechanical: both gates share the scanning helper in
 *   `tests/architecture/source-scan.ts`. This file MUST NOT import
 *   `no-orchestrator-network.test.ts` -- under `node:test`, importing a module
 *   that registers cases at its top level runs those cases a SECOND time and
 *   misreports the count.
 *
 * Rationale -- reading source through the filesystem API (D-98-10):
 *   The two scanning clauses read their targets with `readFile(..., "utf8")`
 *   through the shared helper, never through a `grep`-style subprocess. A
 *   subprocess line tool that classifies a file as binary reports nothing and
 *   exits cleanly, which would green the clause on a file it never inspected.
 *   This guard is general rather than tied to any single file: the plugin
 *   info orchestrator's hook-dedup separator is written
 *   as a `\u0000` ESCAPE with an inline comment saying why, so that file is
 *   ordinary text, and a line tool would read it fine. The RULE stands
 *   regardless -- it is about what a scanner can silently skip, not about one
 *   file -- and it is recorded here so the point is not re-litigated.
 *
 * MUST NOT be added to this file:
 *   - Length pins for the four closed sets. `notify-closed-set-locks.test.ts`
 *     owns those; duplicating them here creates two places to bump.
 *   - Any expected member list DERIVED from the constant under test. A derived
 *     list makes the assertion a tautology that can never fail, which is worse
 *     than no gate: it reports assurance it does not provide.
 *   - Any filesystem write, any subprocess spawn, or any mutation of
 *     process-global state such as the working directory or the environment.
 *     The gate must be safe to run concurrently with every other suite, and
 *     each of those surfaces is negative-grepped in the acceptance criteria --
 *     so this paragraph names them descriptively rather than by their API
 *     spelling, which would defeat the grep it exists to explain.
 *   - An import of any `*.test.ts` module (see the network clause above).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { DEFAULT_STATE } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  ICON_AVAILABLE,
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_PARTIALLY_INSTALLED,
  ICON_UNINSTALLABLE,
  renderPartiallyAvailableRow,
  renderPluginInfo,
  renderRemoteRow,
} from "../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";

import {
  COMPAT_NO_EXPANSION_TARGETS,
  NETWORK_FREE_TARGETS,
  SCOPE_FENCE_TARGETS,
} from "./gate-targets.ts";
import { REPO_ROOT, stripComments } from "./source-scan.ts";

import type { LedgerDegradationSignals } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import type { InstallPluginOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  MarketplaceStatus,
  PluginInfoMessage,
  PluginStatus,
  Reason,
  StatusToken,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

/**
 * The two files this gate reads as data, taken from the registry (D-07-05) so
 * the paths are named once for every gate rather than once per gate. The tuple
 * order is the group's own: grammar owner first, then the catalog it must not
 * outgrow.
 */
const NOTIFICATION_GRAMMAR_REL = COMPAT_NO_EXPANSION_TARGETS[0];
const OUTPUT_CATALOG_REL = COMPAT_NO_EXPANSION_TARGETS[1];

/**
 * The registry module the delegation clause below reads. A test path, not a
 * production one, so D-07-05 does not cover it and it is spelled here.
 */
const NETWORK_GATE_REL = "tests/architecture/gate-targets.ts";

/**
 * The vocabulary owner the closed-set clauses read as data.
 *
 * D-07-05: the annotation is the membership check -- the literal has to be a
 * member of a registry group or it stops compiling, so this reference cannot
 * drift away from the registry even though the group it belongs to was declared
 * for the scope fence.
 */
const NOTIFICATION_TYPES_REL: (typeof SCOPE_FENCE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/shared/notification-types.ts";

/**
 * The two glyphs whose constants are module-private, written as escapes for the
 * reason the code-point clause gives. Each has two public carriers -- its own
 * row renderer, and the `info` plugin row via `pluginInfoStatusGlyph` -- and the
 * row clause below pins the exact bytes all three emit.
 */
const REMOTE_GLYPH = "\u25CC";
const PARTIALLY_AVAILABLE_GLYPH = "\u2296";

/** A soft-dep probe with both companions loaded, so no marker joins a row. */
const BOTH_COMPANIONS_LOADED = { piSubagentsLoaded: true, piMcpAdapterLoaded: true };

/**
 * The members one closed vocabulary declares, in declaration order.
 *
 * A union carries membership and not order, so the declaration is the only place
 * the ORDER exists. Reading the owner as data is what keeps the order clause
 * below a real assertion rather than a claim about something no caller can
 * obtain.
 *
 * Anchored on the `export type <NAME> =` ... `;` declaration so a mention of the
 * name anywhere else in the module cannot be mistaken for it, and both anchors
 * are asserted present so a renamed or reshaped declaration fails here instead
 * of yielding an empty list that would compare equal to nothing.
 */
function declaredVocabulary(src: string, name: string): readonly string[] {
  const opening = `export type ${name} =`;
  const start = src.indexOf(opening);
  assert.notStrictEqual(
    start,
    -1,
    `COMPAT-01: ${NOTIFICATION_TYPES_REL} declares no ${name} vocabulary, so this clause inspected nothing.`,
  );

  const end = src.indexOf(";", start);
  assert.notStrictEqual(
    end,
    -1,
    `COMPAT-01: the ${name} declaration in ${NOTIFICATION_TYPES_REL} is unterminated, so its members could not be read.`,
  );

  return [...src.slice(start + opening.length, end).matchAll(/"([^"]*)"/g)].map(
    (match) => match[1]!,
  );
}

/** Read the vocabulary owner once per clause, comments stripped. */
async function readVocabulary(name: string): Promise<readonly string[]> {
  return declaredVocabulary(await readStrippedSource(NOTIFICATION_TYPES_REL), name);
}

/**
 * WR-07: one glyph-declaration pattern in two flavours -- `GLYPH_DECLARATIONS`
 * counts them across the module, `GLYPH_DECLARATION` tests a single spelling.
 * Built from ONE source string so the counting clause and the clause that pins
 * what the pattern must see can never drift apart, and split by flag because a
 * `/g/` regex carries `lastIndex` across `.test()` calls.
 */
const GLYPH_DECLARATION_SOURCE = String.raw`\bconst ICON_[A-Z_]+\b`;
const GLYPH_DECLARATIONS = new RegExp(GLYPH_DECLARATION_SOURCE, "g");
const GLYPH_DECLARATION = new RegExp(GLYPH_DECLARATION_SOURCE);

async function readStrippedSource(rel: string): Promise<string> {
  return stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
}

/**
 * The four closed vocabularies, hand-written here, in the tuple's own declared
 * order. Independent literals: nothing below derives them from the owner, which
 * is what lets both the declaration scan and the union proof compare against
 * them and mean something.
 */
const EXPECTED_REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  "not installed",
  "not in manifest",
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  "unsupported component",
  "unsupported hooks",
  "lsp",
  "requires pi-subagents",
  "requires pi-mcp",
  "rollback partial",
  "unreadable",
  "unparseable",
  "unreadable manifest",
  "source mismatch",
  "plugins remain",
  "concurrently uninstalled",
  "concurrently updated",
  "stale clone",
  "duplicate name",
  "lock held",
  "already autoupdate",
  "already no autoupdate",
  "already enabled",
  "already disabled",
  "permission denied",
  "source missing",
  "network unreachable",
  "marketplace not added",
  "marketplace not added to user scope",
  "marketplace not added to project scope",
  "orphan rewake",
  "authentication required",
  "dangling reference",
  "malformed mcp",
  "malformed skill",
  "malformed command",
  "installs disabled",
  "marketplace in user scope",
  "marketplace in project scope",
  "workflows",
  // DATA-01 / WR-06: uninstall's data-disposition marker, appended at the
  // tail with its catalog row, its renderer arm and its fixture.
  "data kept",
  // RESV-03: no release tag of the dependency's source falls inside the
  // effective constraint.
  "no matching version",
  // RESV-03 / RESV-05: the effective constraint cannot be satisfied, either by
  // the declarations against each other or by the copy already on disk.
  "version conflict",
  // RESV-03: the declared constraints pass one of the two combination caps.
  "constraint too complex",
  // RESV-03: a declared constraint is not a readable version range.
  "invalid version constraint",
  // RESV-02 / D-03-08: the dependency's marketplace is not added in the target
  // scope. A CONTENT reason -- its subject is the dependency row, not the
  // standalone marketplace row the three structural markers above belong to.
  "dependency marketplace not added",
  // RESV-04: the dependency graph closes on itself.
  "dependency cycle",
  // RESV-06: the requesting plugin's own row, when a dependency is what failed.
  "dependency failed",
  // D-04-07: a recorded dependency the user then installed by name. The
  // record's provenance changed and nothing was materialized, so it rides an
  // `installed` row beside `already installed`.
  "dependency promoted",
  // D-05-11: uninstall's prune marker -- a dependency record nothing
  // installed declared any more, swept out by `--prune` after the named
  // plugin. It rides an ordinary `uninstalled` row.
  "dependency pruned",
  "dependency unsatisfied",
  "dependency version unsatisfied",
  // D-06-06: uninstall's consequence marker for a removal that went through
  // while other installed plugins still declared the target. It rides the
  // success row; the dependents ride the cause line, never the token.
  "dependents unsatisfied",
  // TAGS-02 / D-07-03: no marketplace tag satisfied a path-source
  // dependency's constraint, so the marketplace's current copy installed
  // instead of failing. Rides an `installed` row -- the install succeeded --
  // and is neither idempotent nor a failure reason.
  "dependency current copy",
  // D-08-02: install's already-installed arm and enable's own cascade
  // member row turn on an already-installed, disabled dependency through
  // its record. It rides an `installed` row -- the state changed and
  // nothing was refused, so `already installed` alone cannot carry it.
  "dependency enabled",
  // EDEP-02: disable's refusal marker for an installed and ENABLED plugin
  // in the same scope that still declares the target. It rides a `failed`
  // row -- the command was NOT carried out, unlike its `dependents
  // unsatisfied` neighbour, whose subject is a removal that went through.
  "dependents remain",
] as const;

const EXPECTED_STATUS_TOKENS = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "added",
  "removed",
  "available",
  "unavailable",
  "upgradable",
  "skipped",
  "failed",
  "rollback failed",
  "manual recovery",
  "no marketplaces",
  "no plugins",
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  "partially-installed",
  "partially-upgradable",
  "partially-available",
  "remote",
] as const;

const EXPECTED_PLUGIN_STATUSES = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "available",
  "unavailable",
  "upgradable",
  "failed",
  "skipped",
  "manual recovery",
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  "partially-installed",
  "partially-upgradable",
  "partially-available",
  "remote",
] as const;

const EXPECTED_MARKETPLACE_STATUSES = [
  "added",
  "removed",
  "updated",
  "failed",
  "autoupdate enabled",
  "autoupdate disabled",
  "skipped",
] as const;

/**
 * WR-11: the ledger degradation signals the `installed` outcome arm actually
 * inherits, computed FROM the production type rather than by restating its
 * exclusion list. Both halves are live: widen the arm (drop an exclusion) or
 * widen the shared shape (add a signal) and this key set grows.
 */
type InstalledOutcome = Extract<InstallPluginOutcome, { status: "installed" }>;
type InstallSignalKey = keyof InstalledOutcome & keyof LedgerDegradationSignals;

test("COMPAT-01: the reason vocabulary holds exactly its inherited members, in order", async () => {
  // arrange
  const expected = [...EXPECTED_REASONS];

  // act
  const declaredReasons = await readVocabulary("Reason");

  // assert
  assert.deepStrictEqual(
    declaredReasons,
    expected,
    "COMPAT-01: no reason token may be added, removed, or renamed. The order is catalog-stable: a new token appends at the tail and arrives with its catalog row, renderer arm, and fixture in the same change.",
  );
});

// The clause above states the declared order; this one states that the public
// union the renderer is written against holds exactly the same members. Both
// halves are needed: the scan cannot see a union that stopped deriving from the
// tuple, and the union cannot see order.
void (true satisfies IsExact<Reason, (typeof EXPECTED_REASONS)[number]>);

test("COMPAT-01: the status-token vocabulary holds exactly its inherited members, in order", async () => {
  // arrange
  const expected = [...EXPECTED_STATUS_TOKENS];

  // act
  const declaredStatusTokens = await readVocabulary("StatusToken");

  // assert
  assert.deepStrictEqual(
    declaredStatusTokens,
    expected,
    "COMPAT-01: no status token may be added, removed, or renamed. The four head-of-tuple state-change tokens drive the reload hint, so their positions are contractual.",
  );
});

void (true satisfies IsExact<StatusToken, (typeof EXPECTED_STATUS_TOKENS)[number]>);

test("COMPAT-01: the plugin-status vocabulary holds exactly its inherited members, in order", async () => {
  // arrange
  const expected = [...EXPECTED_PLUGIN_STATUSES];

  // act
  const declaredPluginStatuses = await readVocabulary("PluginStatus");

  // assert
  assert.deepStrictEqual(
    declaredPluginStatuses,
    expected,
    "COMPAT-01: no plugin status may be added, removed, or renamed. Row composers derive their status field from this tuple via Extract<PluginStatus, ...>.",
  );
});

void (true satisfies IsExact<PluginStatus, (typeof EXPECTED_PLUGIN_STATUSES)[number]>);

test("COMPAT-01: the marketplace-status vocabulary holds exactly its inherited members, in order", async () => {
  // arrange
  const expected = [...EXPECTED_MARKETPLACE_STATUSES];

  // act
  const declaredMarketplaceStatuses = await readVocabulary("MarketplaceStatus");

  // assert
  assert.deepStrictEqual(
    declaredMarketplaceStatuses,
    expected,
    "COMPAT-01: no marketplace status may be added, removed, or renamed.",
  );
});

void (true satisfies IsExact<MarketplaceStatus, (typeof EXPECTED_MARKETPLACE_STATUSES)[number]>);

test("COMPAT-01: every exported glyph constant holds its inherited code point", () => {
  // arrange
  // Escapes rather than the characters themselves: the pin IS the code point,
  // and several of these render near-identically at a glance.
  const expected = {
    ICON_AVAILABLE: "\u25CB",
    ICON_DISABLED: "\u25CD",
    ICON_INSTALLED: "\u25CF",
    ICON_PARTIALLY_INSTALLED: "\u25C9",
    ICON_UNINSTALLABLE: "\u2298",
  };

  // act
  const glyphs = {
    ICON_AVAILABLE,
    ICON_DISABLED,
    ICON_INSTALLED,
    ICON_PARTIALLY_INSTALLED,
    ICON_UNINSTALLABLE,
  };

  // assert
  assert.deepStrictEqual(
    glyphs,
    expected,
    "COMPAT-01: every exported glyph keeps its named code point",
  );
});

/** The unresolved `info` message one status renders, with no optional field set. */
function infoMessageFor(status: "remote" | "partially-available"): PluginInfoMessage {
  return {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status, name: "alpha", componentsResolved: false },
  };
}

test("COMPAT-01: the two module-private glyphs reach the output on their own rows", () => {
  // arrange
  // `◌` and `⊖` are each carried by one dedicated row renderer, so the rendered
  // row IS the pin: the glyph is the row's first token, and the whole line is
  // stated so a glyph swap and a spacing change both fail here.
  const expected = [
    `${REMOTE_GLYPH} alpha v1.0.0 (remote)`,
    `${PARTIALLY_AVAILABLE_GLYPH} alpha v1.0.0 (partially-available) {lsp}`,
  ];

  // act
  const rows = [
    renderRemoteRow(
      { status: "remote", name: "alpha", version: "1.0.0" },
      BOTH_COMPANIONS_LOADED,
      "user",
      undefined,
    ),
    renderPartiallyAvailableRow(
      { status: "partially-available", name: "alpha", version: "1.0.0", reasons: ["lsp"] },
      BOTH_COMPANIONS_LOADED,
      "user",
    ),
  ];

  // assert
  assert.deepStrictEqual(
    rows,
    expected,
    "COMPAT-01: the remote and partially-available rows keep their named code points and their spacing.",
  );
});

test("COMPAT-01: the two module-private glyphs reach the info row through their second carrier", () => {
  // arrange
  // `pluginInfoStatusGlyph` carries both glyphs to the `info` plugin row, so
  // the rows above are not the whole public contract. This pins that carrier in
  // its own right: an edit that gives the info arm its own literal leaves the
  // two row renderers green and fails here.
  const expected = [
    `  ${REMOTE_GLYPH} alpha (remote)`,
    `  ${PARTIALLY_AVAILABLE_GLYPH} alpha (partially-available)`,
  ];

  // act
  const infoRows = (["remote", "partially-available"] as const).map(
    (status) => renderPluginInfo(infoMessageFor(status), BOTH_COMPANIONS_LOADED).split("\n")[1],
  );

  // assert
  assert.deepStrictEqual(
    infoRows,
    expected,
    "COMPAT-01: the info plugin row keeps the named code points of the two module-private glyphs.",
  );
});

test("COMPAT-01: the catalog names each glyph the way the code-point pins above name it", async () => {
  // arrange
  // WR-08: the catalog called `◉` "bullseye" (BULLSEYE is U+25CE, a character
  // the codebase does not use) and gave `◉`'s real name, fisheye, to `◍` two
  // rows below -- while the pins above named both correctly. A reader
  // reconciling the two documents had no way to tell which was wrong. The
  // catalog keeps its descriptive register; what is pinned is the pairing.
  const expected: ReadonlyArray<readonly [string, string]> = [
    [ICON_INSTALLED, "filled circle"],
    [ICON_AVAILABLE, "empty circle"],
    [ICON_UNINSTALLABLE, "prohibited symbol"],
    [PARTIALLY_AVAILABLE_GLYPH, "circled minus"],
    [ICON_PARTIALLY_INSTALLED, "fisheye"],
    [REMOTE_GLYPH, "dotted circle"],
    [ICON_DISABLED, "circle with vertical fill"],
  ];

  // act
  const catalog = await readFile(path.join(REPO_ROOT, OUTPUT_CATALOG_REL), "utf8");
  const mismatches = expected
    .filter(([glyph, name]) => !catalog.includes(`- \`${glyph}\` -- ${name}`))
    .map(([glyph, name]) => `${glyph} is not named "${name}" in the catalog's Glyphs section`);

  // assert
  assert.deepStrictEqual(
    mismatches,
    [],
    "COMPAT-01: the catalog's glyph names must agree with the code-point pins. Renaming one is a documentation change that belongs in the same commit as the pin it describes.",
  );
});

test("COMPAT-01: the notification grammar owner declares no eighth glyph", async () => {
  // arrange
  // An eighth glyph cannot be caught by comparing runtime constants, because the
  // glyphs are seven separate declarations with no collection to compare
  // against, and two of them are module-private.
  //
  // The pattern counts the DECLARATION regardless of visibility, so a private
  // eighth glyph is caught exactly like an exported one -- which is what keeps
  // the vocabulary closed at seven rather than closed at "seven exports".
  //
  // WR-07: the pattern anchors on the declaration, not on the spelling that
  // follows the name. Requiring ` = ` immediately after the name and a line
  // start would let an eighth glyph written
  // `const ICON_EIGHTH: string = "..."` -- or pushed off the line start
  // by comment stripping -- slip past the one clause this file calls
  // load-bearing.
  const expectedCount = 7;

  // act
  const declarations = (await readStrippedSource(NOTIFICATION_GRAMMAR_REL)).match(
    GLYPH_DECLARATIONS,
  );

  // assert
  assert.ok(
    COMPAT_NO_EXPANSION_TARGETS.length > 0,
    "D-07-03: an empty target group leaves this clause and the catalog clause reading nothing and reporting success over zero files.",
  );
  assert.strictEqual(
    declarations?.length,
    expectedCount,
    "COMPAT-01: the glyph vocabulary is closed at seven. A new glyph is a rendered-vocabulary expansion and needs its catalog row and renderer arm in the same change.",
  );
});

test("COMPAT-01: the glyph-declaration pattern recognises every spelling a glyph export can take", () => {
  // arrange
  // WR-07: the clause above asserts an ABSENCE, so a pattern that matched
  // nothing would pass it just as quietly as a correct one. Pin what the pattern
  // is required to see, including the two spellings a simpler pattern would miss.
  const spellings = [
    'export const ICON_EIGHTH = "◎";',
    'export const ICON_EIGHTH: string = "◎";',
    '/** doc */ export const ICON_EIGHTH = "◎";',
    'const ICON_EIGHTH = "◎";',
    'const ICON_EIGHTH: string = "◎";',
  ];
  // And what it must NOT see: a reference is not a declaration.
  const reference = "return `${ICON_EIGHTH} ${name}`;";

  // act
  const declarationMatches = spellings.map((spelling) => GLYPH_DECLARATION.test(spelling));
  const referenceMatches = GLYPH_DECLARATION.test(reference);

  // assert
  assert.deepStrictEqual(declarationMatches, [true, true, true, true, true]);
  assert.strictEqual(referenceMatches, false, "a glyph USE must not count as a declaration");
});

test("COMPAT-01: the vocabulary reader sees a declared tuple's members and nothing else", () => {
  // arrange
  // The four order clauses assert an EQUALITY against a reader, so a reader that
  // returned the wrong slice would fail them loudly -- but one that matched a
  // DIFFERENT declaration of the same shape would not. Plant both confusions: a
  // same-prefixed neighbour declared first, and a mention of the real name after
  // the declaration terminates.
  const planted = [
    'export type ReasonGroup = "decoy one" | "decoy two";',
    "",
    "export type Reason =",
    '  | "first"',
    '  | "second";',
    "",
    'export type ContentReason = Exclude<Reason, "not a member">;',
  ].join("\n");
  const expected = ["first", "second"];

  // act
  const parsedMembers = declaredVocabulary(planted, "Reason");

  // assert
  assert.deepStrictEqual(
    parsedMembers,
    expected,
    "COMPAT-01: the reader must anchor on the named vocabulary's own declaration.",
  );
});

type IsExact<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

// The pinned key set of the persisted install record. A key may join it in one
// of exactly two ways: as an OPTIONAL additive field that needs no schemaVersion
// bump and no migrate fill (the resolvedSha / hookEntries / dependencyDisabled
// precedent), or as a REQUIRED field that arrives WITH a schemaVersion bump and
// a migrate fill that runs before validation, so every earlier document loads
// with a truthful default (the enabled / ENBL-02 and provenance / D-04-03
// precedent). Removing one is a migration.
void (true satisfies IsExact<
  keyof PluginInstallRecord,
  | "compatibility"
  | "dependencyDisabled"
  | "enabled"
  | "hookEntries"
  | "installedAt"
  | "provenance"
  | "resolvedSha"
  | "resolvedSource"
  | "resources"
  | "updatedAt"
  | "version"
>);

test("COMPAT-01: the install outcome inherits exactly the signals installPlugin populates", () => {
  // arrange
  // WR-11: the `installed` arm inherits the shared ledger-signal shape MINUS the
  // two staged-count verdicts. `Omit` is an EXCLUSION, so a sixth signal added
  // to that shape widens this arm AUTOMATICALLY with a field `installPlugin`
  // never writes -- and a consumer reads the absent field as "none" and believes
  // it. (`Pick` would drift the other way, silently dropping the new signal.)
  //
  // `Record<InstallSignalKey, true>` is bidirectional: a signal added to the
  // shared shape fails to compile here as a MISSING property, and one removed
  // fails as an EXCESS one. Either direction lands the author in this clause,
  // where the choice is explicit -- populate the signal at `installPlugin`'s
  // return, or exclude it in the `Omit`.
  const populated: Record<InstallSignalKey, true> = {
    unsupported: true,
    orphanRewake: true,
    degradedKinds: true,
  };
  const expectedCount = 3;

  // act
  // The gate is the object literal's TYPE; this runtime clause reports it. The
  // member names are deliberately not restated as string literals: the D-75-01
  // vocabulary guard forbids the quoted dropped-component key anywhere under
  // tests/architecture, and a derived expected list would be a tautology.
  const actualCount = Object.keys(populated).length;

  // assert
  assert.strictEqual(
    actualCount,
    expectedCount,
    "COMPAT-01 / WR-11: the install outcome carries exactly the three ledger signals installPlugin writes.",
  );
});

void (true satisfies IsExact<
  Extract<
    keyof PluginInstallRecord,
    | "manifestSnapshot"
    | "manifest"
    | "manifestEntry"
    | "entry"
    | "orphan"
    | "orphanRewake"
    | "orphaned"
  >,
  never
>);

// D-04-03: schemaVersion 3 IS an on-disk migration, and it is the whole of it:
// a required `provenance` field that `ensurePluginProvenance` fills with its
// truthful default ("explicit") on every record that lacks it, before
// validation runs. A fourth member means another such migration and lands
// here deliberately, with its own fill and its own default stated.
void (true satisfies IsExact<ExtensionState["schemaVersion"], 1 | 2 | 3>);

test("COMPAT-01: the default state declares the current schema version", () => {
  // arrange
  const expected = 3;

  // act
  const declaredSchemaVersion = DEFAULT_STATE.schemaVersion;

  // assert
  assert.strictEqual(
    declaredSchemaVersion,
    expected,
    "COMPAT-01 / D-04-03: a first-load state.json is written at schemaVersion 3, the version the provenance migration introduced.",
  );
});

test("COMPAT-01: the network clause is covered by the orchestrator-network gate", async () => {
  // arrange
  // DELEGATION (D-98-09): the NFR-5 gate runs the actual assertion. This clause
  // only proves the two info surfaces are still in its target list, which
  // D-07-05 keeps in the registry module, so removing one there fails here
  // rather than silently uncovering the clause. WR-06: that
  // the named files still EXIST is the shared scanner's job -- it fails on a
  // missing target rather than skipping it, so a rename cannot leave both gates
  // green over a file neither read.
  //
  // The annotation is the load-bearing half: `(typeof NETWORK_FREE_TARGETS)[number]`
  // is the union of the group's own entries, so dropping either surface from the
  // registry stops this file compiling. The scrape below stays as the runtime
  // half, and covers the case where the registry module itself moves.
  const requiredTargets: ReadonlyArray<(typeof NETWORK_FREE_TARGETS)[number]> = [
    "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts",
    "extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts",
  ];

  // act
  const src = await readStrippedSource(NETWORK_GATE_REL);
  const missing = requiredTargets.filter((rel) => !src.includes(`"${rel}"`));

  // assert
  assert.deepStrictEqual(
    missing,
    [],
    `COMPAT-01: the info surfaces must stay gated for zero gitOps surface by ${NETWORK_GATE_REL}. Removing a target there would silently drop this clause.`,
  );
});
