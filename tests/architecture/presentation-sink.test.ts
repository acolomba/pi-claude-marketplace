import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PRESENTATION_SINK_TARGETS } from "./gate-targets.ts";
import { assertNoForbiddenSurface, REPO_ROOT, stripComments } from "./source-scan.ts";
import {
  assertPlantedCopyRejects,
  materializeTargets,
  plantBenignNearMiss,
  withTempRoot,
} from "./temp-root-control.ts";

import type { ScanReport } from "./source-scan.ts";

/**
 * D-16 / SC-5 / IL-2 presentation-sink gate.
 *
 * Forbidden surface:
 *   In the dispatch module named by `PRESENTATION_SINK_TARGETS`, every notify
 *   argument comes from the text strategy's output. A `ui.notify(` call may
 *   pass only `args[0]` or `args[0], args[1]`, and a `deliver` call may pass
 *   only a direct `formatEnvelopeArguments(` or `formatRawSurface(` call. A
 *   pre-composed tuple or a variable reaching the sink is a violation.
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
 * What the gate proves, and how:
 *   - It VISITED the module. The scan reports the paths it opened, and this file
 *     deep-compares them with the registry group (D-07-03). The placement clause
 *     requires positive counts, so a module with no sink fails instead of
 *     passing over nothing.
 *   - It FIRES. Temp-root copies of the real module with one planted offender
 *     reject (D-07-01). The third offender uses the sanctioned spelling outside
 *     `deliver`, so only the placement clause can reject it.
 *   - It is not failing everything. An unmutated copy passes, and a composed
 *     notify inside a line comment passes (D-07-04).
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
    pattern:
      /\bdeliver\(\s*[A-Za-z_$][\w$.]*\s*,(?!\s*(?:formatEnvelopeArguments|formatRawSurface)\()/,
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
async function assertSinkLiterals(root: string): Promise<void> {
  const stripped = stripComments(await readFile(path.join(root, SINK_FILE), "utf8"));
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
 * reaches `deliver` at least once.
 */
async function assertSinkPlacement(root: string): Promise<void> {
  const stripped = stripComments(await readFile(path.join(root, SINK_FILE), "utf8"));
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
    /\bdeliver\(\s*[A-Za-z_$][\w$]*\s*,\s*formatRawSurface\(/,
    `D-16: no deliver call in ${SINK_FILE} passes formatRawSurface output, so the raw-surface path never reaches the sink.`,
  );
}

/** Every part of the gate under `root`: the pattern scan, placement, then literals. */
async function scanPresentationSink(root: string): Promise<ScanReport> {
  const report = await assertNoForbiddenSurface(
    PRESENTATION_SINK_TARGETS,
    SINK_PATTERNS,
    describeSinkViolation,
    { root },
  );
  await assertSinkPlacement(root);
  await assertSinkLiterals(root);
  return report;
}

test("D-16 / SC-5: every notify argument in the dispatch module comes from the text strategy", async () => {
  // act
  const report = await scanPresentationSink(REPO_ROOT);

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

const SINK_OFFENDERS: ReadonlyArray<{ readonly name: string; readonly line: string }> = [
  {
    name: "a direct notify with a composed template",
    line: 'export function leak(ctx: NotificationContext): void { ctx.ui.notify(`x`, "info"); }',
  },
  {
    name: "the sink handed a pre-composed tuple",
    line: 'deliver(ctx, [`pre-composed`, "info"]);',
  },
  {
    name: "a third sanctioned-spelling notify outside the sink",
    line: "function relay(ctx: NotificationContext, args: NotifyArguments): void { ctx.ui.notify(args[0], args[1]); }",
  },
  {
    name: "a composed template handed to the structured formatter",
    line: "deliver(ctx, formatEnvelopeArguments(envelope, `x`));",
  },
  {
    name: "a composed sentence handed to the structured path through a variable",
    line: 'const sentence = "Nothing to prune."; emitWithSummary(ctx, envelope, sentence);',
  },
  {
    name: "a member-chain context handed a variable",
    line: "deliver(this.ctx, composed);",
  },
  {
    name: "a bracket-access notify",
    line: 'ctx.ui["notify"](args[0]);',
  },
];

for (const { name, line } of SINK_OFFENDERS) {
  test(`D-16 / SC-5: the presentation-sink gate rejects ${name}`, async () => {
    // act & assert
    await assertPlantedCopyRejects({
      prefix: "presentation-sink-offender-",
      targets: PRESENTATION_SINK_TARGETS,
      target: SINK_FILE,
      line,
      scan: scanPresentationSink,
      rejection: /D-16/,
    });
  });
}

test("D-16 / SC-5: an unmutated copy of the dispatch module passes and reports it opened", async () => {
  await withTempRoot("presentation-sink-benign-", async (root) => {
    // arrange
    await materializeTargets(root, PRESENTATION_SINK_TARGETS);

    // act
    const report = await scanPresentationSink(root);

    // assert
    assert.deepStrictEqual(report.visited, [...PRESENTATION_SINK_TARGETS]);
    assert.deepStrictEqual(report.waived, []);
  });
});

test("D-16 / SC-5: a composed notify inside a line comment passes, so the gate strips comments", async () => {
  await withTempRoot("presentation-sink-near-miss-", async (root) => {
    // arrange
    await materializeTargets(root, PRESENTATION_SINK_TARGETS);
    await plantBenignNearMiss(root, SINK_FILE, 'ctx.ui.notify(`x`, "info");');

    // act
    const report = await scanPresentationSink(root);

    // assert
    assert.deepStrictEqual(report.visited, [...PRESENTATION_SINK_TARGETS]);
  });
});
