import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  REPO_ROOT,
  assertNoForbiddenSurface,
  filesMatching,
  stripComments,
} from "./source-scan.ts";

/**
 * tests/architecture/workflows-single-parse.test.ts -- the workflow script
 * analyzer parses once and evaluates never.
 *
 * The invariant (WGATE-02):
 *   Every admission gate the bridge reports is decided from the ONE acorn parse
 *   `domain/workflow-script.ts` already performs. A second parse would let a
 *   gate be read off a tree the verdict was not built from, so the two could
 *   disagree about the same file -- a warning naming a rule the installed script
 *   does not break, or silence about one it does. The count is therefore the
 *   assertion, not the absence of a particular spelling.
 *
 *   And nothing in the analyzer or in the workflows bridge may reach for an
 *   evaluator. The scripts under analysis are untrusted third-party JavaScript
 *   read out of a plugin tree, so a gate decided by RUNNING one would be wrong
 *   by construction: it would hand arbitrary code the extension's own
 *   privileges to answer a question that is entirely a property of the parsed
 *   tree (D-115-03 -- nothing in the engine's unreplicated checks needs
 *   evaluation, so nothing here may reach for it).
 *
 * The WGATE-03 containment (third case):
 *   `readEngineGate` wraps its walk in `try`/`catch` so a throw inside gate
 *   reading can never fail an install. That behavior is pinned by unit tests,
 *   but the CONSTRUCT was not: an editor who deletes the wrapper reddens the
 *   depth-budget case only because that one input reaches it, and a later
 *   refactor that removes the budget too would leave the absolute -- no gate
 *   reading can ever block an install -- resting on nothing. The third case
 *   makes the construct itself a property of the source.
 *
 *   `parseScript`'s own `catch` needs no such case, and the disanalogy is the
 *   reason this one exists: an unparseable script is NATURAL input, so every
 *   suite that feeds one exercises that catch. `readEngineGate`'s catch is
 *   reachable only through the walk's deliberate depth budget, because every
 *   predicate under it is a property test over a tree already in hand.
 *
 * Why this gate reads with `readFile` and strips comments:
 *   `readFile(..., "utf8")` rather than a `grep` subprocess (D-98-10): a
 *   subprocess that classifies a file as binary reports nothing and greens a
 *   gate over zero inspected bytes. `stripComments` before every match, because
 *   the module's own header states the security rule in prose and legally names
 *   `parse`, the evaluator, the function constructor and the vm module -- an
 *   unstripped scan would fail on its own subject's documentation.
 *
 * Why this gate is NOT replaceable by a fallow boundary rule:
 *   Fallow's `boundaries.calls.forbidden` is per-ZONE and per-callee-name. It
 *   can bar a named call from a directory; it cannot count call sites, which is
 *   what WGATE-02 is about -- one `parse` is required, two is the violation, and
 *   no zone rule expresses a cardinality. Nor can it assert that a construct is
 *   PRESENT, which is the third case's whole shape.
 *
 * This file registers no case that imports a `*.test.ts` module (D-98-09).
 */
/** The analyzer whose single parse and evaluator-free surface this gate pins. */
const ANALYZER = "extensions/pi-claude-marketplace/domain/workflow-script.ts";

/** The bridge directory whose every code-carrying module is screened too. */
const WORKFLOWS_BRIDGE_DIR = "extensions/pi-claude-marketplace/bridges/workflows";

/**
 * A bare `parse(` call: not `parseScript(`, not `parseWorkflowScript(`, and not
 * a method call like `JSON.parse(`. The lookbehind is what makes the count a
 * count of acorn entries rather than of every identifier ending in `parse`.
 *
 * Global on purpose -- this one is used with `String.prototype.match` to COUNT,
 * never with the stateful `RegExp.prototype.test`.
 */
const BARE_PARSE_CALL = /(?<![\w.$])parse\s*\(/g;

/**
 * The gate reader's declaration, line-initial and closed on the RIGHT by `\b`.
 *
 * The trailing boundary is load-bearing and was measured: a plain
 * `indexOf("function readEngineGate")` also matches `readEngineGateRenamed`,
 * because the sought text is a PREFIX of the renamed one -- so the slice would
 * land on the renamed function's body and the case would stay green over a
 * declaration that no longer exists under the name it pins. Not global: this is
 * used with `exec`, and a retained `lastIndex` would make a second call miss.
 */
const GATE_READER_DECLARATION = /^function readEngineGate\b/m;

/**
 * The evaluator surfaces the analyzer's header rules out. Each is a distinct
 * route to the same capability, so refusing one spelling and allowing the
 * others would screen a name rather than the capability (WR-03).
 */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: "direct evaluator call", pattern: /\beval\s*\(/ },
  // Covers `new Function(...)` and the bare `Function(...)` call alike; both
  // compile a string into executable code.
  { name: "function constructor call", pattern: /\bFunction\s*\(/ },
  { name: "vm module import", pattern: /from\s*["'](?:node:)?vm["']/ },
  { name: "vm module require", pattern: /require\s*\(\s*["'](?:node:)?vm["']\s*\)/ },
  // A dynamic `import(...)` loads and RUNS a module. `import type ... from` and
  // `import.meta` carry no parenthesis and so are unaffected.
  { name: "dynamic module import", pattern: /\bimport\s*\(/ },
];

/**
 * Every code-carrying module in the workflows bridge, repo-relative and sorted.
 *
 * Derived from the tree rather than listed, so a bridge module added tomorrow is
 * screened on the day it lands. `/\S/` selects every module whose
 * comment-stripped source carries anything at all; a module that strips to pure
 * whitespace is comments only and so has no surface a pattern could match.
 *
 * `filesMatching` is the shared read-and-strip mechanic, reused rather than
 * re-implemented here so this gate and its siblings cannot drift on how a
 * target is read (D-98-10).
 */
async function bridgeModules(): Promise<string[]> {
  return filesMatching(WORKFLOWS_BRIDGE_DIR, /\S/);
}

/** The analyzer's source with comments stripped -- what every case matches on. */
async function strippedAnalyzerSource(): Promise<string> {
  return stripComments(await readFile(path.join(REPO_ROOT, ANALYZER), "utf8"));
}

test("WGATE-02: the workflow script analyzer carries exactly one parse call site", async () => {
  // arrange
  const stripped = await strippedAnalyzerSource();

  // act
  const callSites = stripped.match(BARE_PARSE_CALL) ?? [];

  // assert
  assert.deepStrictEqual(
    callSites,
    ["parse("],
    `WGATE-02 violation: ${ANALYZER} has ${String(callSites.length)} bare parse call sites, not one. Every gate this module reports must be decided from the ONE tree the verdict was built from. A second parse lets the gate reader and the verdict disagree about the same script -- naming a rule the installed script does not break, or staying silent about one it does. Reuse the existing parse products instead of adding a call.`,
  );
});

test("WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface", async () => {
  // arrange -- the analyzer plus the derived bridge roster, so a renamed or
  // deleted target fails loudly (WR-06) instead of uncovering the gate.
  const targets = [ANALYZER, ...(await bridgeModules())];

  // act & assert
  await assertNoForbiddenSurface(
    targets,
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `WGATE-02 violation: evaluator surface detected in the workflow script analyzer or its bridge:\n  ${offenders.join("\n  ")}\n  (these modules statically analyze untrusted third-party JavaScript out of a plugin tree. A gate decided by running the script would hand that code the extension's own privileges to answer a question the parsed tree already answers, which is why the analyzer's header rules the whole capability out rather than one spelling of it.)`,
  );
});

test("WGATE-03: readEngineGate still wraps its walk in try/catch", async () => {
  // arrange
  const stripped = await strippedAnalyzerSource();
  const declaration = GATE_READER_DECLARATION.exec(stripped);

  // The START boundary is mandatory. A rename must fail this case loudly rather
  // than green it over a slice of the wrong function -- the same failure mode
  // WR-06 exists to prevent, arriving through a slice instead of through a
  // missing file.
  assert.ok(
    declaration !== null,
    `WGATE-03: no declaration matching ${String(GATE_READER_DECLARATION)} was found in ${ANALYZER}. This case pins that function's throw containment, so a rename leaves the containment unchecked; point the pattern at the new name.`,
  );

  // act -- slice by DECLARATION BOUNDARY. Every module-level declaration in this
  // file starts at column zero, so the next line-initial declaration keyword is
  // a structural end marker rather than an indentation guess. When none follows,
  // the function is last in the file and the slice runs to its end.
  const after = stripped.slice(declaration.index + declaration[0].length);
  const nextDeclaration = after.search(
    /\n(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s/,
  );
  const body = nextDeclaration === -1 ? after : after.slice(0, nextDeclaration);

  // assert -- WORD tokens, so brace style, line breaks, a bound error parameter
  // and an optional-catch-binding `catch {` all pass unchanged. The case must
  // fail when the construct is gone, not when the code is reformatted. The
  // catch's CONTENTS are deliberately not asserted: what it returns is behavior,
  // and behavior is pinned by the depth-budget case in
  // tests/domain/workflow-script.test.ts.
  //
  // Residual limitation, stated rather than overclaimed: `stripComments` removes
  // block comments and LINE-INITIAL `//` comments only, so a trailing `// ...`
  // comment inside this function survives the strip and could in principle carry
  // the matched words. This is a presence pin backed by a planted-removal
  // control, not a proof that the words appear nowhere else.
  assert.ok(
    body.trim().length > 0,
    `WGATE-03: the slice of \`${declaration[0]}\` in ${ANALYZER} is empty, so the tokens below would match vacuously.`,
  );
  assert.match(
    body,
    /\btry\b/,
    `WGATE-03 violation: \`${declaration[0]}\` no longer opens a \`try\`. A gate reading may never block an install: it walks untrusted third-party AST through mutually recursive predicates, and its only caller does not guard it, so a throw escaping this function fails a whole plugin install rather than costing one script its warning.`,
  );
  assert.match(
    body,
    /\bcatch\b/,
    `WGATE-03 violation: \`${declaration[0]}\` no longer carries a \`catch\`. An unforeseen node shape must cost the author a missing warning and nothing more.`,
  );
});
