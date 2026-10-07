import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PRESENTATION_SINK_TARGETS } from "./gate-targets.ts";
import { assertNoForbiddenSurface, REPO_ROOT, stripComments } from "./source-scan.ts";

import type { ScanReport } from "./source-scan.ts";

/**
 * D-16 / SC-5 / IL-2 presentation-sink gate.
 *
 * Forbidden surface:
 *   In the dispatch module named by `PRESENTATION_SINK_TARGETS`, every notify
 *   argument comes from the text strategy's output. A `ui.notify(` call may
 *   pass only `args[0]` or `args[0], args[1]`, and a `deliver` call may pass
 *   only direct `formatEnvelopeArguments(` output or the guarded raw formatter
 *   result. The raw result's exact provenance and sole use are pinned below.
 *
 * Literals:
 *   The formatters accept any string as the body, so the module may hold no
 *   sentence of its own to hand them. Outside imports, `kind:` discriminants,
 *   and `case` labels, its string and template literals must be exactly the
 *   `ALLOWED_SINK_MODULE_LITERALS` set: the block and line separators, the
 *   empty-cascade sentinel, and the advisory fold. A sentence composed in the
 *   module fails here even when it reaches the sink through a variable.
 *
 * Placement:
 *   The patterns accept the sanctioned `args[0], args[1]` spelling anywhere, so
 *   a placement clause pins where it may appear. Exactly two notify spellings
 *   exist, both inside `deliver`. Both formatters are imported from the text
 *   strategy module, and each one reaches `deliver` at least once.
 *
 * Mentions:
 *   A sink reached through `.call`, a destructured `notify`, or an alias of
 *   `deliver` matches none of the call patterns. So every mention of `ui` must
 *   be one of the two notify calls inside `deliver`, and every mention of
 *   `deliver` must be its declaration or a direct formatter call.
 *
 * Limit:
 *   A body variable's provenance is not checked. The literal clause bounds
 *   only what this module composes, so
 *   `deliver(ctx, formatEnvelopeArguments(envelope, body))` passes whatever
 *   `body` holds.
 *
 * What the gate proves, and how:
 *   - It VISITED the module. The scan reports the paths it opened, and this file
 *     deep-compares them with the registry group (D-07-03). The placement clause
 *     requires positive counts, so a module with no sink fails instead of
 *     passing over nothing.
 *
 * Comments are stripped before every check because the module's header and
 * JSDoc legally describe the notify call it guards.
 */

const [SINK_FILE] = PRESENTATION_SINK_TARGETS;

const SINK_PATTERNS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  {
    name: "notify argument not from the text strategy",
    pattern: /\bui\.notify\((?!args\[0\]\)|args\[0\], args\[1\]\))/,
  },
  // The whitespace sits inside the lookahead. With `,\s*(?!...)` the engine
  // backtracks onto the space before the call and matches the real module.
  // The context argument may be a member chain such as `this.ctx`; a colon
  // stops it, so the `deliver` declaration does not match.
  {
    name: "sink handed a value that is not a text-strategy call",
    pattern: /\bdeliver\(\s*[A-Za-z_$][\w$.]*\s*,(?!\s*(?:formatEnvelopeArguments\(|args\)))/,
  },
];

/**
 * Every string or template literal, with group 1 set when an import
 * specifier, a `kind:` discriminant, or a `case` label precedes it. A template
 * literal is matched whole, so a quoted string inside one of its
 * interpolations is part of it.
 */
const SINK_MODULE_LITERAL =
  /(\bfrom\s+|\bkind:\s*|\bcase\s+)?(`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g;

/**
 * D-16: the literals the dispatch module may hold, spelled as in source. This
 * is the exact set, not a ceiling: a member that stops appearing fails too, so
 * the list cannot outlive the code it describes.
 */
const ALLOWED_SINK_MODULE_LITERALS: ReadonlyArray<string> = [
  '"envelope"',
  '"claude-plugin"',
  '"(no marketplaces)"',
  '"\\n"',
  '"\\n\\n"',
  '`${body}\\n\\n${lines.join("\\n")}`',
];

/**
 * D-16: the literal half of the gate. Every unexempted literal in the
 * comment-stripped module must be in `ALLOWED_SINK_MODULE_LITERALS`, and every
 * member of that set must appear.
 */
async function assertSinkLiterals(): Promise<void> {
  const stripped = stripComments(await readFile(path.join(REPO_ROOT, SINK_FILE), "utf8"));
  const literals = [...stripped.matchAll(SINK_MODULE_LITERAL)]
    .filter((match) => match[1] === undefined)
    .map((match) => match[2] ?? "");
  const composed = literals.filter((literal) => !ALLOWED_SINK_MODULE_LITERALS.includes(literal));

  assert.deepStrictEqual(
    composed,
    [],
    `D-16 / SC-5 violation: ${SINK_FILE} composes text outside the text strategy:\n  ${composed.join("\n  ")}`,
  );
  assert.deepStrictEqual(
    [...new Set(literals)].sort(),
    [...ALLOWED_SINK_MODULE_LITERALS].sort(),
    `D-16: ${SINK_FILE} no longer holds every literal ALLOWED_SINK_MODULE_LITERALS names; remove the stale entry.`,
  );
}

function describeSinkViolation(offenders: ReadonlyArray<string>): string {
  return `D-16 / SC-5 violation: the dispatch module hands the notify sink a value the text strategy did not produce:\n  ${offenders.join("\n  ")}`;
}

/** The text strategy's import, bringing both formatters from the grammar module. */
const TEXT_STRATEGY_IMPORT =
  /import\s*\{(?=[^}]*\bformatEnvelopeArguments\b)(?=[^}]*\bformatRawSurface\b)[^}]*\}\s*from\s*"\.\/notification-grammar\.ts"/;

/**
 * D-16: the placement half of the gate. Exactly two notify spellings exist in
 * the comment-stripped module, both inside `deliver`, and each formatter
 * reaches `deliver` at least once. Every `ui` and `deliver` mention must be
 * one of those counted calls or the `deliver` declaration.
 */
async function assertSinkPlacement(): Promise<void> {
  const stripped = stripComments(await readFile(path.join(REPO_ROOT, SINK_FILE), "utf8"));
  const notifyCalls = [...stripped.matchAll(/\bui\.notify\(/g)].length;
  const deliverBody = /function deliver\([^\n]*\n[\s\S]*?\n\}\n/.exec(stripped)?.[0] ?? "";
  const sinkCalls = [...deliverBody.matchAll(/\bui\.notify\(/g)].length;

  assert.strictEqual(
    notifyCalls,
    2,
    `D-16: ${SINK_FILE} holds ${notifyCalls} notify call(s); exactly the two inside deliver may exist.`,
  );
  assert.strictEqual(
    sinkCalls,
    2,
    `D-16: deliver in ${SINK_FILE} holds ${sinkCalls} of the module's notify calls; it must hold both.`,
  );

  const uiMentions = [...stripped.matchAll(/\bui\b/g)].length;
  const deliverMentions = [...stripped.matchAll(/\bdeliver\b/g)].length;
  const formatterDeliverCalls = [
    ...stripped.matchAll(
      /\bdeliver\(\s*[A-Za-z_$][\w$.]*\s*,\s*(?:formatEnvelopeArguments\(|args\))/g,
    ),
  ].length;
  assert.strictEqual([...stripped.matchAll(/\bdeliver\(ctx, args\)/g)].length, 1);

  assert.strictEqual(
    uiMentions,
    sinkCalls,
    `D-16: ${SINK_FILE} names ui ${uiMentions} time(s); only the ${sinkCalls} notify calls inside deliver may.`,
  );
  assert.strictEqual(
    deliverMentions,
    1 + formatterDeliverCalls,
    `D-16: ${SINK_FILE} names deliver ${deliverMentions} time(s); only its declaration and ${formatterDeliverCalls} direct formatter call(s) may.`,
  );
  assert.match(
    stripped,
    TEXT_STRATEGY_IMPORT,
    `D-16: ${SINK_FILE} must import formatEnvelopeArguments and formatRawSurface from ./notification-grammar.ts.`,
  );
  assert.match(
    stripped,
    /\bdeliver\(\s*[A-Za-z_$][\w$]*\s*,\s*formatEnvelopeArguments\(/,
    `D-16: no deliver call in ${SINK_FILE} passes formatEnvelopeArguments output, so the structured path never reaches the sink.`,
  );
  assert.match(
    stripped,
    /function emitHookSurface\([^}]+emitPresentation\(ctx, run, resolveRawSurface\(surface\)\);\s+\}/,
    `D-16: hook raw surfaces must reach the shared presentation transport.`,
  );
  assert.match(stripped, /const args = formatRawSurface\(presentation\)!;\s+deliver\(ctx, args\);/);
}

/** Every part of the gate: the pattern scan, placement, then literals. */
async function scanPresentationSink(): Promise<ScanReport> {
  const report = await assertNoForbiddenSurface(
    PRESENTATION_SINK_TARGETS,
    SINK_PATTERNS,
    describeSinkViolation,
  );
  await assertSinkPlacement();
  await assertSinkLiterals();
  return report;
}

test("D-16 / SC-5: every notify argument in the dispatch module comes from the text strategy", async () => {
  // act
  const report = await scanPresentationSink();

  // assert
  assert.ok(
    PRESENTATION_SINK_TARGETS.length > 0,
    "D-07-03: an empty target group makes the scan report success over zero files.",
  );
  assert.deepStrictEqual(
    report.visited,
    [...PRESENTATION_SINK_TARGETS],
    "D-07-03: the scan must have opened every declared target; one that stopped resolving drops out of `visited`.",
  );
});
