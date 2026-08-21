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
 *   Closed sets (COMPAT-01 / D-98-08) -- `REASONS`, `STATUS_TOKENS`,
 *   `PLUGIN_STATUSES`, and `MARKETPLACE_STATUSES` each equal a hand-written
 *   literal member list, in the tuple's own declared order. ENUMERATION
 *   equality, not a count: a count pin catches a member ADDED, but not a member
 *   renamed or swapped for another. Adding, removing, or renaming any member
 *   fails here and forces a deliberate amendment.
 *
 *   Glyphs (COMPAT-01) -- each of the seven exported glyph constants equals its
 *   exact code point, written as an escape so the pin states the code point
 *   rather than relying on the reader to identify a character by eye. There is
 *   no exported COLLECTION of glyphs, so an EIGHTH glyph export cannot be caught
 *   by comparing a tuple; the export-declaration count in the notify module is
 *   the only way to catch one, and it is the one clause here that scans source.
 *
 *   Persistence (COMPAT-01) -- the persisted install record's key set is exactly
 *   the eight fields it already had, and neither a manifest-snapshot-shaped key
 *   nor an orphan-shaped key appears. The state schema's version property still
 *   enumerates exactly the two versions it already enumerated and the frozen
 *   default state still declares the current one, which together prove no
 *   migration and no version bump was introduced.
 *
 *   Network (COMPAT-01 / D-98-09) -- DELEGATED, not duplicated. The NFR-5
 *   orchestrator-network gate already proves both info surfaces carry zero
 *   gitOps surface; this file asserts those two surfaces are still among that
 *   gate's targets, so the clause is documented here and proven there. The
 *   delegation is mechanical: both gates share the scanning helper in
 *   `tests/helpers/source-scan.ts`. This file MUST NOT import
 *   `no-orchestrator-network.test.ts` -- under `node:test`, importing a module
 *   that registers cases at its top level runs those cases a SECOND time and
 *   misreports the count.
 *
 * Rationale -- reading source through the filesystem API (D-98-10):
 *   The two scanning clauses read their targets with `readFile(..., "utf8")`
 *   through the shared helper, never through a `grep`-style subprocess. A
 *   subprocess line tool that classifies a file as binary reports nothing and
 *   exits cleanly, which would green the clause on a file it never inspected.
 *   The historical justification for this rule no longer applies on its own
 *   terms: the hook-dedup separator in the plugin info orchestrator is written
 *   as a `\u0000` ESCAPE with an inline comment saying why, so that file is
 *   ordinary text today and a line tool would in fact read it. The RULE stands
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

import {
  DEFAULT_STATE,
  PLUGIN_INSTALL_RECORD_SCHEMA,
  STATE_SCHEMA,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  ICON_AVAILABLE,
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_PARTIALLY_AVAILABLE,
  ICON_PARTIALLY_INSTALLED,
  ICON_REMOTE,
  ICON_UNINSTALLABLE,
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  REASONS,
  STATUS_TOKENS,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";
import { REPO_ROOT, stripComments } from "../helpers/source-scan.ts";

import type { LedgerDegradationSignals } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import type { InstallPluginOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";

const NOTIFY_REL = "extensions/pi-claude-marketplace/shared/notify.ts";
const NETWORK_GATE_REL = "tests/architecture/no-orchestrator-network.test.ts";

/**
 * WR-07: one glyph-declaration pattern in two flavours -- `GLYPH_DECLARATIONS`
 * counts them across the module, `GLYPH_DECLARATION` tests a single spelling.
 * Built from ONE source string so the counting clause and the clause that pins
 * what the pattern must see can never drift apart, and split by flag because a
 * `/g/` regex carries `lastIndex` across `.test()` calls.
 */
const GLYPH_DECLARATION_SOURCE = String.raw`\bexport const ICON_[A-Z_]+\b`;
const GLYPH_DECLARATIONS = new RegExp(GLYPH_DECLARATION_SOURCE, "g");
const GLYPH_DECLARATION = new RegExp(GLYPH_DECLARATION_SOURCE);

async function readStrippedSource(rel: string): Promise<string> {
  return stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
}

/**
 * WR-11: the ledger degradation signals the `installed` outcome arm actually
 * inherits, computed FROM the production type rather than by restating its
 * exclusion list. Both halves are live: widen the arm (drop an exclusion) or
 * widen the shared shape (add a signal) and this key set grows.
 */
type InstalledOutcome = Extract<InstallPluginOutcome, { status: "installed" }>;
type InstallSignalKey = keyof InstalledOutcome & keyof LedgerDegradationSignals;

test("COMPAT-01: REASONS holds exactly its inherited members, in order", () => {
  assert.deepEqual(
    [...REASONS],
    [
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
      "not added",
      "orphan rewake",
      "authentication required",
      "dangling reference",
      "malformed mcp",
      "malformed skill",
      "malformed command",
      "installs disabled",
    ],
    "COMPAT-01: no reason token may be added, removed, or renamed. The order is catalog-stable: a new token appends at the tail and arrives with its catalog row, renderer arm, and fixture in the same change.",
  );
});

test("COMPAT-01: STATUS_TOKENS holds exactly its inherited members, in order", () => {
  assert.deepEqual(
    [...STATUS_TOKENS],
    [
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
    ],
    "COMPAT-01: no status token may be added, removed, or renamed. The four head-of-tuple state-change tokens drive the reload hint, so their positions are contractual.",
  );
});

test("COMPAT-01: PLUGIN_STATUSES holds exactly its inherited members, in order", () => {
  assert.deepEqual(
    [...PLUGIN_STATUSES],
    [
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
    ],
    "COMPAT-01: no plugin status may be added, removed, or renamed. Row composers derive their status field from this tuple via Extract<PluginStatus, ...>.",
  );
});

test("COMPAT-01: MARKETPLACE_STATUSES holds exactly its inherited members, in order", () => {
  assert.deepEqual(
    [...MARKETPLACE_STATUSES],
    [
      "added",
      "removed",
      "updated",
      "failed",
      "autoupdate enabled",
      "autoupdate disabled",
      "skipped",
    ],
    "COMPAT-01: no marketplace status may be added, removed, or renamed.",
  );
});

test("COMPAT-01: every glyph constant holds its inherited code point", () => {
  // Escapes rather than the characters themselves: the pin IS the code point,
  // and several of these render near-identically at a glance.
  assert.equal(ICON_INSTALLED, "\u25CF", "COMPAT-01: ICON_INSTALLED is BLACK CIRCLE");
  assert.equal(ICON_AVAILABLE, "\u25CB", "COMPAT-01: ICON_AVAILABLE is WHITE CIRCLE");
  assert.equal(
    ICON_UNINSTALLABLE,
    "\u2298",
    "COMPAT-01: ICON_UNINSTALLABLE is CIRCLED DIVISION SLASH",
  );
  assert.equal(ICON_DISABLED, "\u25CD", "COMPAT-01: ICON_DISABLED is CIRCLE WITH VERTICAL FILL");
  assert.equal(ICON_REMOTE, "\u25CC", "COMPAT-01: ICON_REMOTE is DOTTED CIRCLE");
  assert.equal(
    ICON_PARTIALLY_INSTALLED,
    "\u25C9",
    "COMPAT-01: ICON_PARTIALLY_INSTALLED is FISHEYE",
  );
  assert.equal(
    ICON_PARTIALLY_AVAILABLE,
    "\u2296",
    "COMPAT-01: ICON_PARTIALLY_AVAILABLE is CIRCLED MINUS",
  );
});

test("COMPAT-01: the catalog names each glyph the way the code-point pins above name it", async () => {
  // WR-08: the catalog called `◉` "bullseye" (BULLSEYE is U+25CE, a character
  // the codebase does not use) and gave `◉`'s real name, fisheye, to `◍` two
  // rows below -- while the pins above named both correctly. A reader
  // reconciling the two documents had no way to tell which was wrong. The
  // catalog keeps its descriptive register; what is pinned is the pairing.
  const catalog = await readFile(path.join(REPO_ROOT, "docs/output-catalog.md"), "utf8");
  const expected: ReadonlyArray<readonly [string, string]> = [
    [ICON_INSTALLED, "filled circle"],
    [ICON_AVAILABLE, "empty circle"],
    [ICON_UNINSTALLABLE, "prohibited symbol"],
    [ICON_PARTIALLY_AVAILABLE, "circled minus"],
    [ICON_PARTIALLY_INSTALLED, "fisheye"],
    [ICON_REMOTE, "dotted circle"],
    [ICON_DISABLED, "circle with vertical fill"],
  ];
  const mismatches = expected
    .filter(([glyph, name]) => !catalog.includes(`- \`${glyph}\` -- ${name}`))
    .map(([glyph, name]) => `${glyph} is not named "${name}" in the catalog's Glyphs section`);

  assert.deepEqual(
    mismatches,
    [],
    "COMPAT-01: the catalog's glyph names must agree with the code-point pins. Renaming one is a documentation change that belongs in the same commit as the pin it describes.",
  );
});

test("COMPAT-01: the notify module declares no eighth glyph export", async () => {
  // The one clause here that scans source: an eighth glyph export cannot be
  // caught by comparing runtime constants, because the glyphs are seven
  // separate exports with no collection to compare against.
  //
  // WR-07: the pattern anchors on the DECLARATION, not on the spelling that
  // follows the name. The former `/^export const ICON_[A-Z_]+ = /gm` required
  // ` = ` immediately after the name and a line start, so an eighth glyph
  // written `export const ICON_EIGHTH: string = "..."` -- or pushed off the line
  // start by comment stripping -- slipped past the one clause this file calls
  // load-bearing.
  const declarations = (await readStrippedSource(NOTIFY_REL)).match(GLYPH_DECLARATIONS);

  assert.equal(
    declarations?.length,
    7,
    "COMPAT-01: the glyph vocabulary is closed at seven. A new glyph is a rendered-vocabulary expansion and needs its catalog row and renderer arm in the same change.",
  );
});

test("COMPAT-01: the glyph-declaration pattern recognises every spelling a glyph export can take", () => {
  // WR-07: the clause above asserts an ABSENCE, so a pattern that matched
  // nothing would pass it just as quietly as a correct one. Pin what the pattern
  // is required to see, including the two spellings that used to slip past.
  const spellings = [
    'export const ICON_EIGHTH = "◎";',
    'export const ICON_EIGHTH: string = "◎";',
    '/** doc */ export const ICON_EIGHTH = "◎";',
  ];
  for (const spelling of spellings) {
    assert.match(spelling, GLYPH_DECLARATION, `the pattern must match: ${spelling}`);
  }

  // And what it must NOT see: a reference is not a declaration.
  assert.equal(
    GLYPH_DECLARATION.test("return `${ICON_EIGHTH} ${name}`;"),
    false,
    "a glyph USE must not count as a declaration",
  );
});

test("COMPAT-01: the persisted install record holds exactly its inherited key set", () => {
  assert.deepEqual(
    Object.keys(PLUGIN_INSTALL_RECORD_SCHEMA.properties).sort((a, b) => a.localeCompare(b)),
    [
      "compatibility",
      "enabled",
      "hookEntries",
      "installedAt",
      "resolvedSha",
      "resolvedSource",
      "resources",
      "updatedAt",
      "version",
    ],
    "COMPAT-01: this is the pinned key set of the persisted install record. A key may join it only as an OPTIONAL additive field that needs no schemaVersion bump and no migrate fill (the resolvedSha / hookEntries precedent); removing one is a migration. Either way the change lands here deliberately, alongside the sibling clause that forbids manifest-snapshot and orphan fields outright.",
  );
});

test("COMPAT-01: the install outcome inherits exactly the signals installPlugin populates", () => {
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

  // The gate is the object literal's TYPE; this runtime clause reports it. The
  // member names are deliberately not restated as string literals: the D-75-01
  // vocabulary guard forbids the quoted dropped-component key anywhere under
  // tests/architecture, and a derived expected list would be a tautology.
  assert.equal(
    Object.keys(populated).length,
    3,
    "COMPAT-01 / WR-11: the install outcome carries exactly the three ledger signals installPlugin writes.",
  );
});

test("COMPAT-01: no manifest-snapshot or orphan field reached the install record", () => {
  // Named explicitly rather than left to the key-set clause: these are the two
  // shapes the manifest-independent work could plausibly have persisted, and a
  // reader looking for that promise should find it stated, not inferred.
  const shapes = [
    "manifestSnapshot",
    "manifest",
    "manifestEntry",
    "entry",
    "orphan",
    "orphanRewake",
    "orphaned",
  ];
  const present = shapes.filter((key) =>
    Object.hasOwn(PLUGIN_INSTALL_RECORD_SCHEMA.properties, key),
  );

  assert.deepEqual(
    present,
    [],
    "COMPAT-01: the install record caches no manifest material and records no orphan marker. Plugin lifecycle reads the manifest live or does not read it at all.",
  );
});

test("COMPAT-01: the state schema version union is unchanged", () => {
  assert.deepEqual(
    STATE_SCHEMA.properties.schemaVersion.anyOf.map((member) => member.const),
    [1, 2],
    "COMPAT-01: no state-schema migration was introduced. A third version means an on-disk migration, which this work promised not to require.",
  );
});

test("COMPAT-01: the default state still declares the current schema version", () => {
  assert.equal(
    DEFAULT_STATE.schemaVersion,
    2,
    "COMPAT-01: a first-load state.json is written at the version this work inherited -- no bump.",
  );
});

test("COMPAT-01: the network clause is covered by the orchestrator-network gate", async () => {
  // DELEGATION (D-98-09): the NFR-5 gate runs the actual assertion. This clause
  // only proves the two info surfaces are still in its target list, so removing
  // one there fails here rather than silently uncovering the clause. WR-06: that
  // the named files still EXIST is the shared scanner's job -- it fails on a
  // missing target rather than skipping it, so a rename cannot leave both gates
  // green over a file neither read.
  const src = await readStrippedSource(NETWORK_GATE_REL);
  const missing = [
    "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts",
    "extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts",
  ].filter((rel) => !src.includes(`"${rel}"`));

  assert.deepEqual(
    missing,
    [],
    `COMPAT-01: the info surfaces must stay gated for zero gitOps surface by ${NETWORK_GATE_REL}. Removing a target there would silently drop this clause.`,
  );
});
