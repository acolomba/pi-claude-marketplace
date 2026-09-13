/**
 * tests/architecture/no-test-only-production-surface.test.ts -- the test-only
 * substitution-surface gate (MF-DEC-07 / D-05-01 / GGAT-04).
 *
 * The forbidden class:
 *   A production interface, type, or options object MUST NOT declare a
 *   `__`-prefixed member whose purpose is to let a test swap the module's
 *   collaborators. `MF-DEC-07` and `D-05-01` both say so in prose, and two live
 *   instances survived that prose anyway -- one named in the decisions, one found
 *   only when someone read the sibling file. A rule that depends on being
 *   remembered has already failed here, so it is a gate now.
 *
 * Why the targets are WALKED rather than named:
 *   The obligation is "nowhere under the extension tree", which a named list
 *   cannot express -- it would silently miss the next module somebody adds.
 *   D-07-05 covers a directory the same way it covers a file, so the walk is
 *   rooted at the registry's `EXTENSION_ROOT_REL` and composes no path of its
 *   own. A walk that stopped matching would enumerate nothing without raising,
 *   which is why the file count is asserted non-zero (D-07-03) and the scan's
 *   `visited` report is deep-compared against the walked list.
 *
 * The discriminator, which is the whole design:
 *   The pattern matches a DECLARED MEMBER NAME, not a double-underscore
 *   character sequence. Legitimate production code under `extensions/` carries
 *   the sequence in two forms that are none of this gate's business:
 *     - `bridges/mcp/safe-set.ts` compares a key against the literal string
 *       `"__proto__"`; that comparison IS the prototype-pollution defense, and a
 *       gate that flagged it would be worse than no gate at all.
 *     - the hooks payload and if-field family carries the MCP protocol's
 *       `mcp__<server>__<tool>` tool-naming convention, which is an upstream
 *       wire format rather than anything this repository chose.
 *   A string literal, a comparison operand, and a protocol-defined tool name are
 *   not member declarations, so the pattern keyed on member position leaves all
 *   three alone while still catching the exact shape both real offenders had.
 *
 * The one carve-out, and why it is structural:
 *   One member-shaped occurrence under the tree is legitimate: a nominal-type
 *   brand declared as `declare const … : unique symbol`. A brand is a
 *   type-system marker with no runtime value, so it cannot carry a collaborator
 *   and cannot be a substitution point. The carve-out therefore matches that
 *   FORM, and neither the module that declares the brand nor the brand's own
 *   identifier is named anywhere in this file. Excluding the module would stop
 *   covering that module's real members; excluding the identifier would let the
 *   same name reappear as an interface member; both would keep claiming to
 *   exclude a brand after the brand was renamed or removed. Matching the form
 *   survives a rename and still fires when that identifier is declared as a
 *   member, which is what the two carve-out cases below prove.
 *
 * No allow-list:
 *   D-07-18 forecloses one. An allow-list forgives its named entries silently and
 *   forever, which is how the two offenders this gate exists for stayed alive
 *   under a rule that already forbade them.
 */

import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  EXTENSION_ROOT_REL,
  MARKETPLACE_LEDGER_TARGETS,
  NETWORK_FREE_TARGETS,
} from "./gate-targets.ts";
import { assertNoForbiddenSurface, REPO_ROOT, stripComments } from "./source-scan.ts";
import {
  materializeTargets,
  plantBenignNearMiss,
  plantOffender,
  withTempRoot,
} from "./temp-root-control.ts";

/**
 * A member declaration's left-hand side: start of line or a separator, then an
 * optional `readonly`. The separator set deliberately excludes `[` and `"`, so a
 * computed property key (`{ readonly [__brand]: never }`) and a string literal
 * (`key === "__proto__"`) are outside member position and do not match.
 */
const MEMBER_POSITION = String.raw`(?:^|[\s{;,(])(?:readonly\s+)?`;

/** A `__`-prefixed identifier followed by an optional `?` and a type annotation. */
const MEMBER_NAME = String.raw`__[A-Za-z][A-Za-z0-9_]*\s*\??\s*:`;

/** The brand carve-out's first half: the declaration keyword is absent. */
const NOT_BRAND_DECLARATION = String.raw`(?<!\bdeclare\s+const\s+)`;

/** The brand carve-out's second half: the annotated type is not `unique symbol`. */
const NOT_UNIQUE_SYMBOL = String.raw`(?!\s*unique\s+symbol\b)`;

/**
 * A `__`-prefixed member declaration, excluding the `declare const … : unique
 * symbol` brand form.
 *
 * The carve-out is a CONJUNCTION -- the declaration keyword AND the `unique
 * symbol` type -- and a regular expression negates one condition at a time, so it
 * is written as its De Morgan equivalent: match when the keyword is absent, OR
 * when the type is not `unique symbol`. Negating either half alone would be wider
 * than the brand form and would stop catching real surface:
 * `declare const __deps: Bag` and `readonly __brand: unique symbol` must both
 * still fail, and under this alternation they do.
 *
 * Non-global on purpose -- a `/g` regex carries `lastIndex` across `.test()`
 * calls and would skip every second file of a 200-file walk, which
 * `import-boundaries.test.ts` already records for the same reason.
 */
const TEST_ONLY_MEMBER = new RegExp(
  `${MEMBER_POSITION}(?:${NOT_BRAND_DECLARATION}${MEMBER_NAME}|${MEMBER_NAME}${NOT_UNIQUE_SYMBOL})`,
  "m",
);

/**
 * The forbidden surfaces, all three scanned over the same walked list.
 *
 * The two retired spellings ride along with the member pattern rather than
 * living in a gate of their own: they are the same class reached by a different
 * door, and a returning `_setCloneCacheForTest` or `__test_` re-export should
 * fail the file that already owns this obligation instead of failing nothing.
 * Every current occurrence of either token is a comment recording that the
 * pattern was removed, and the scan strips comments before matching.
 */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "`__`-prefixed member declaration", pattern: TEST_ONLY_MEMBER },
  {
    name: "retired `_set…ForTest` module seam",
    pattern: /(?:^|[^A-Za-z0-9_])_set[A-Za-z][A-Za-z0-9_]*ForTest\b/m,
  },
  { name: "retired `__test_` re-export", pattern: /(?:^|[^A-Za-z0-9_])__test_[A-Za-z]/m },
];

function describeTestOnlySurfaceViolation(offenders: ReadonlyArray<string>): string {
  return `MF-DEC-07 / D-05-01 violation: test-only substitution surface declared on production module(s):\n  ${offenders.join("\n  ")}\n  (a production module must not carry a member whose only purpose is letting a test swap its collaborators. Give the capability a production owner instead: a named collaborator on the flow's own transaction, the form \`ReinstallTransaction.replaceOperations\` takes, or a single named typed optional member with its own type and its own doc line, the form \`cloneCacheSeam?\` takes. D-07-18 forecloses an allow-list entry, so there is no third option.)`;
}

/** Every repository-relative `.ts` module at or below `rel`, in a stable order. */
async function walkExtensionModules(rel: string): Promise<string[]> {
  const entries = await readdir(path.join(REPO_ROOT, rel), { withFileTypes: true });
  const modules: string[] = [];
  for (const entry of entries) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      modules.push(...(await walkExtensionModules(child)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      modules.push(child);
    }
  }

  return modules.sort();
}

/**
 * A production module and one collaborator member on it that is classified as
 * KEPT rather than forbidden.
 *
 * D-05-01 draws the line between the two by shape, not by spelling: a kept seam
 * is a SINGLE named capability with its own type and its own doc line, supplied
 * by a consumer that genuinely owns it, so a reader of the interface can see what
 * may be substituted and what it must satisfy. A forbidden bag is an anonymous
 * container of several capabilities hidden behind one `__`-prefixed member, where
 * the interface admits only that something may be swapped.
 *
 * These members are not matched by the patterns above, and silence is not
 * classification -- nothing in an unmatched file distinguishes a seam that was
 * deliberately kept from one the pattern happens to miss. Asserting them makes
 * the classification live: removing or renaming one fails this gate and forces a
 * conscious re-classification instead of leaving a stale claim behind.
 */
interface ClassifiedSeam {
  /** The member the classification covers. */
  readonly member: string;
  /** The module that declares or consumes it. */
  readonly target: string;
}

/*
 * The modules the classified seams live on, each annotated with the registry
 * group that already names it. The annotation is the membership check: assigning
 * a path the group does not name stops compiling, so these references cannot
 * drift away from the registry (D-07-05). `NETWORK_FREE_TARGETS` and
 * `MARKETPLACE_LEDGER_TARGETS` carry every module needed here.
 */
const INSTALL_FLOW_REL: (typeof NETWORK_FREE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
const FETCH_REL: (typeof NETWORK_FREE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
const PLUGIN_INFO_REL: (typeof NETWORK_FREE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
const REINSTALL_FLOW_REL: (typeof NETWORK_FREE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts";
const MARKETPLACE_ADD_REL: (typeof MARKETPLACE_LEDGER_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
const MARKETPLACE_UPDATE_REL: (typeof MARKETPLACE_LEDGER_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";

/**
 * Every optional collaborator seam under `extensions/` that is kept by
 * classification rather than by the pattern missing it.
 *
 * `cloneCacheSeam` is the authorized typed-optional port form, shared across the
 * install, fetch, info, and reinstall owners. `stateTransaction`,
 * `removeDataDir`, and `replaceOperations` are the promoted reinstall
 * collaborators that replaced the two `__`-prefixed bags. `credentialOps` and
 * `deviceFlowHttp` are the marketplace ledgers' auth ports.
 */
const CLASSIFIED_SEAMS: ReadonlyArray<ClassifiedSeam> = [
  { member: "cloneCacheSeam", target: INSTALL_FLOW_REL },
  { member: "cloneCacheSeam", target: FETCH_REL },
  { member: "cloneCacheSeam", target: PLUGIN_INFO_REL },
  { member: "cloneCacheSeam", target: REINSTALL_FLOW_REL },
  { member: "stateTransaction", target: REINSTALL_FLOW_REL },
  { member: "removeDataDir", target: REINSTALL_FLOW_REL },
  { member: "replaceOperations", target: REINSTALL_FLOW_REL },
  { member: "credentialOps", target: MARKETPLACE_ADD_REL },
  { member: "deviceFlowHttp", target: MARKETPLACE_ADD_REL },
  { member: "credentialOps", target: MARKETPLACE_UPDATE_REL },
  { member: "deviceFlowHttp", target: MARKETPLACE_UPDATE_REL },
];

/**
 * The subset of real modules the temp-root controls copy and mutate.
 *
 * A control materializes a handful of real files rather than the whole walk: the
 * offender has to be DERIVED from a real target so it cannot drift away from the
 * shape it represents (D-07-01), and copying 229 modules per case buys nothing
 * beyond that. The subset is the classified-seam modules because they are the
 * production surface this gate is really about.
 */
const CONTROL_TARGETS: ReadonlyArray<string> = [
  ...new Set(CLASSIFIED_SEAMS.map((seam) => seam.target)),
];

/** The control module whose copy each temp-root case mutates. */
const CONTROL_CARRIER: (typeof NETWORK_FREE_TARGETS)[number] = FETCH_REL;

/** The classified seam the rename control removes from its module's copy. */
const RENAME_CONTROL_SEAM: ClassifiedSeam = {
  member: "replaceOperations",
  target: REINSTALL_FLOW_REL,
};

function labelSeam(seam: ClassifiedSeam): string {
  return `${seam.target}: ${seam.member}`;
}

/** The `seams` whose member still occurs in its module's comment-stripped source under `root`. */
async function presentSeams(root: string, seams: ReadonlyArray<ClassifiedSeam>): Promise<string[]> {
  const present: string[] = [];
  for (const seam of seams) {
    const stripped = stripComments(await readFile(path.join(root, seam.target), "utf8"));
    if (new RegExp(String.raw`\b${seam.member}\b`).test(stripped)) {
      present.push(labelSeam(seam));
    }
  }

  return present;
}

/** Rewrite `seam.target`'s copy under `root` with every `seam.member` occurrence renamed away. */
async function renameSeamInCopy(root: string, seam: ClassifiedSeam): Promise<void> {
  const copyPath = path.join(root, seam.target);
  const source = await readFile(copyPath, "utf8");

  await writeFile(copyPath, source.replaceAll(seam.member, `${seam.member}RenamedAway`), "utf8");
}

test("MF-DEC-07 + D-05-01: no test-only substitution member survives under the extension tree", async () => {
  // arrange
  const modules = await walkExtensionModules(EXTENSION_ROOT_REL);

  // act
  const report = await assertNoForbiddenSurface(
    modules,
    FORBIDDEN_PATTERNS,
    describeTestOnlySurfaceViolation,
  );

  // assert
  assert.ok(
    modules.length > 0,
    `D-07-03: walking ${EXTENSION_ROOT_REL} found no .ts modules, so the scan above reported success over zero files. A walk that stopped matching must fail, not pass over nothing.`,
  );
  assert.deepEqual(
    report.visited,
    modules,
    "D-07-03: the scan must have opened every walked module. A module that stopped resolving drops out of `visited`, so this comparison is what turns an uncovered gate into a failure instead of a pass.",
  );
  assert.deepEqual(report.waived, []);
});

test("the gate fires on a `__`-prefixed member planted in a copy of a real module", async () => {
  await withTempRoot("test-only-surface-offender-", async (root) => {
    // arrange
    await materializeTargets(root, CONTROL_TARGETS);
    await plantOffender(
      root,
      CONTROL_CARRIER,
      "export interface ProbeOptions { readonly __probeMember?: string; }",
    );

    // act & assert
    await assert.rejects(
      () =>
        assertNoForbiddenSurface(
          CONTROL_TARGETS,
          FORBIDDEN_PATTERNS,
          describeTestOnlySurfaceViolation,
          { root },
        ),
      /test-only substitution surface declared on production module/,
    );
  });
});

test("unmutated copies of the same real modules pass and report every path opened", async () => {
  await withTempRoot("test-only-surface-benign-", async (root) => {
    // arrange
    await materializeTargets(root, CONTROL_TARGETS);

    // act
    const report = await assertNoForbiddenSurface(
      CONTROL_TARGETS,
      FORBIDDEN_PATTERNS,
      describeTestOnlySurfaceViolation,
      { root },
    );

    // assert
    assert.deepEqual(report.visited, [...CONTROL_TARGETS]);
    assert.deepEqual(report.waived, []);
  });
});

test("a `__`-prefixed member inside a line comment passes, so the gate still strips comments", async () => {
  await withTempRoot("test-only-surface-near-miss-", async (root) => {
    // arrange
    await materializeTargets(root, CONTROL_TARGETS);
    await plantBenignNearMiss(root, CONTROL_CARRIER, "readonly __probeMember?: string;");

    // act
    const report = await assertNoForbiddenSurface(
      CONTROL_TARGETS,
      FORBIDDEN_PATTERNS,
      describeTestOnlySurfaceViolation,
      { root },
    );

    // assert
    assert.deepEqual(report.visited, [...CONTROL_TARGETS]);
  });
});

test("a `declare const … : unique symbol` brand passes, so the nominal-type form stays legal", async () => {
  await withTempRoot("test-only-surface-brand-", async (root) => {
    // arrange
    // plantOffender appends a line of real code; here that line is the legal
    // brand form, planted under an identifier this file never names so the
    // carve-out is proven against the form rather than against the one brand
    // that happens to exist today.
    await materializeTargets(root, CONTROL_TARGETS);
    await plantOffender(root, CONTROL_CARRIER, "declare const __probeBrand: unique symbol;");

    // act
    const report = await assertNoForbiddenSurface(
      CONTROL_TARGETS,
      FORBIDDEN_PATTERNS,
      describeTestOnlySurfaceViolation,
      { root },
    );

    // assert
    assert.deepEqual(report.visited, [...CONTROL_TARGETS]);
  });
});

test("the same brand identifier declared as an interface member fails, so the carve-out is structural", async () => {
  await withTempRoot("test-only-surface-brand-member-", async (root) => {
    // arrange
    await materializeTargets(root, CONTROL_TARGETS);
    await plantOffender(
      root,
      CONTROL_CARRIER,
      "interface ProbeBrandHolder { readonly __probeBrand: unique symbol; }",
    );

    // act & assert
    await assert.rejects(
      () =>
        assertNoForbiddenSurface(
          CONTROL_TARGETS,
          FORBIDDEN_PATTERNS,
          describeTestOnlySurfaceViolation,
          { root },
        ),
      /test-only substitution surface declared on production module/,
    );
  });
});

test("the gate fires on a returning `_set…ForTest` module seam", async () => {
  await withTempRoot("test-only-surface-set-for-test-", async (root) => {
    // arrange
    await materializeTargets(root, CONTROL_TARGETS);
    await plantOffender(
      root,
      CONTROL_CARRIER,
      "export function _setCloneCacheForTest(seam: unknown): void { void seam; }",
    );

    // act & assert
    await assert.rejects(
      () =>
        assertNoForbiddenSurface(
          CONTROL_TARGETS,
          FORBIDDEN_PATTERNS,
          describeTestOnlySurfaceViolation,
          { root },
        ),
      /test-only substitution surface declared on production module/,
    );
  });
});

test("the gate fires on a returning `__test_` re-export", async () => {
  await withTempRoot("test-only-surface-test-re-export-", async (root) => {
    // arrange
    await materializeTargets(root, CONTROL_TARGETS);
    await plantOffender(root, CONTROL_CARRIER, "export const __test_cloneCache = 1;");

    // act & assert
    await assert.rejects(
      () =>
        assertNoForbiddenSurface(
          CONTROL_TARGETS,
          FORBIDDEN_PATTERNS,
          describeTestOnlySurfaceViolation,
          { root },
        ),
      /test-only substitution surface declared on production module/,
    );
  });
});

test("D-05-01: every classified-and-kept collaborator seam still exists in its module", async () => {
  // arrange
  const expectedSeams = CLASSIFIED_SEAMS.map(labelSeam);

  // act
  const present = await presentSeams(REPO_ROOT, CLASSIFIED_SEAMS);

  // assert
  assert.ok(
    CLASSIFIED_SEAMS.length > 0,
    "D-05-01: an empty classification set makes the comparison below succeed over nothing.",
  );
  assert.deepEqual(
    present,
    expectedSeams,
    "D-05-01: these seams are classified as kept typed optional ports rather than forbidden bags, and the classification is only worth something while they exist. A missing entry means the seam was renamed or removed without the classification being revisited -- update this set in the same change, or reclassify.",
  );
});

test("D-05-01: renaming a classified-and-kept seam drops it from the classification", async () => {
  await withTempRoot("classified-seam-rename-", async (root) => {
    // arrange
    await materializeTargets(root, CONTROL_TARGETS);
    await renameSeamInCopy(root, RENAME_CONTROL_SEAM);

    // act
    const present = await presentSeams(root, CLASSIFIED_SEAMS);

    // assert
    assert.deepEqual(
      present,
      CLASSIFIED_SEAMS.filter(
        (seam) =>
          seam.target !== RENAME_CONTROL_SEAM.target || seam.member !== RENAME_CONTROL_SEAM.member,
      ).map(labelSeam),
    );
  });
});
