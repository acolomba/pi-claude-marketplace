// domain/workflow-script.ts
//
// WNAM-01: a workflow script's command name comes from the `meta.name` the
// script itself declares, read off an acorn AST -- never from the file stem and
// never from a regex over the raw text. Real plugins name their files
// `<name>.workflow.js`, so stem naming misnames every command such a plugin
// ships, and it does so silently: a dot passes every name validator in the
// chain.
//
// The answer is a literal-tagged discriminated union in the shape of
// `domain/source.ts`. Consumers narrow on `outcome`, so a new arm surfaces as a
// static-exhaustiveness miss rather than as a silent fallthrough.
//
// WVAL-01 / WVAL-03: one `parse()` call yields the AST, the comment ranges and
// the literal token ranges together. A raw-text pre-validation match can
// therefore be attributed to code, to a comment, to a literal, or to the
// boundary between them, from evidence already in hand, instead of by a second
// scan that can drift from the first.
//
// SECURITY: this module statically analyzes untrusted third-party JavaScript.
// It parses; it never evaluates. There is no evaluator call, no function
// constructor, no vm module, and no dynamic module load anywhere in it. A
// `meta.name` that is not a string literal is never resolved to a value -- it is
// denied a name instead.

import { parse, tokTypes } from "acorn";

import { errorMessage, WorkflowNameCollisionError } from "../shared/errors.ts";

import { assertSafeName, generatedWorkflowName } from "./name.ts";

import type { WorkflowNameCollision } from "../shared/errors.ts";
import type { Comment, Program, Property, SpreadElement, Token } from "acorn";

/** WNAM-01: the script declared a string-literal `meta.name`. */
export interface NamedWorkflow {
  readonly outcome: "named";
  readonly fileName: string;
  readonly metaName: string;
  readonly generatedName: string;
  readonly description?: string; // WBRG-01 envelope input; unused by the verdict
}

/** WNAM-02: no readable `meta.name`, so the file stem names the command. */
export interface StemFallbackWorkflow {
  readonly outcome: "stem-fallback";
  readonly fileName: string;
  readonly generatedName: string;
  readonly description?: string;
}

/** WNAM-03: nothing to install -- the script declares no usable metadata. */
export type SkippedCause = "no-meta" | "meta-not-object-literal" | "meta-spread";

/** WNAM-04 / WVAL-01: the script is installable-shaped but must not be admitted. */
export type RefusedCause =
  | "unparseable"
  | "determinism-code"
  | "determinism-comment"
  | "determinism-string"
  | "determinism-split"
  | "unsafe-name";

export interface SkippedWorkflow {
  readonly outcome: "skipped";
  readonly fileName: string;
  readonly reason: string; // human-readable
  readonly cause: SkippedCause;
}

export interface RefusedWorkflow {
  readonly outcome: "refused";
  readonly fileName: string;
  readonly reason: string; // human-readable
  readonly cause: RefusedCause;
}

export type WorkflowVerdict =
  NamedWorkflow | StemFallbackWorkflow | SkippedWorkflow | RefusedWorkflow;

/** The two arms that carry a `generatedName`, and so the two a collision can involve. */
export type AdmittedWorkflow = NamedWorkflow | StemFallbackWorkflow;

interface ParsedScript {
  readonly ast: Program;
  readonly comments: readonly Comment[];
  /** String, template and regex token ranges -- the text a script quotes rather than runs. */
  readonly literalRanges: readonly Range[];
}

/**
 * WNAM-01: decide one script's fate from `(pluginName, fileName, source)` alone.
 *
 * The caller passes the file NAME, never a pre-computed stem, so "the name this
 * command would otherwise get" is derived in exactly one place.
 *
 * The PLUGIN name is checked before anything else, and it throws rather than
 * refusing. It is a defect of the SET, like the WNAM-05 collision: it
 * disqualifies every script in the plugin at once and no file is at fault, so
 * rendering it as a per-file refusal would blame each well-formed file in turn
 * for a fact about the plugin. WNAM-06's per-file refusal covers the name the
 * FILE declares, which is the name one file alone can get wrong.
 *
 * The decision order is fixed and load-bearing: unparseable is settled FIRST,
 * because acorn pushes into the comment and token arrays as it scans and only
 * then throws -- on a parse failure those arrays are partially filled, so any
 * classification built on them would be unsound. The `meta` walk over the AST
 * already in hand comes next, then raw-text pre-validation, then name safety,
 * which needs the name the walk produced.
 *
 * `meta` before determinism is deliberate. Detection is convention-based over
 * `<pluginRoot>/workflows/**`, so every `.js` file under that tree arrives here,
 * shared helper modules included. A helper that formats dates declares no
 * readable `meta`, so it was never going to become a command; refusing it for
 * the engine's blocklist would emit a user-facing refusal naming a file nobody
 * asked to install. WNAM-03's silent skip is the truthful verdict, and the
 * engine's opinion of a file it will never be handed is moot.
 *
 * Both of those orders deliberately differ from the engine's, which screens its
 * blocklist before parsing: for a script that is both unparseable and carries a
 * blocklist token, the engine reports a determinism error and we report
 * "unparseable". Ours is the truthful one.
 */
export function admitWorkflowScript(
  pluginName: string,
  fileName: string,
  source: string,
): WorkflowVerdict {
  assertSafeName(pluginName, "plugin name");

  const parsed = parseScript(source);

  if (parsed === undefined) {
    return {
      outcome: "refused",
      fileName,
      reason: unparseableReason(fileName),
      cause: "unparseable",
    };
  }

  const meta = findMetaObject(parsed.ast);

  if (meta.kind !== "object-literal") {
    return skippedVerdict(fileName, meta.kind);
  }

  const metaName = readMetaString(meta.elements, "name");

  if (metaName.kind === "opaque") {
    return skippedVerdict(fileName, "meta-spread");
  }

  const violation = findDeterminismViolation(fileName, source, parsed);

  if (violation !== undefined) {
    return { outcome: "refused", fileName, reason: violation.reason, cause: violation.cause };
  }

  const read = readMetaString(meta.elements, "description");
  const description = read.kind === "literal" ? read.value : undefined;

  if (metaName.kind === "no-literal") {
    return stemFallbackVerdict(pluginName, fileName, description);
  }

  return namedVerdict(pluginName, fileName, metaName.value, description);
}

/**
 * WNAM-05: detect two workflow scripts in one plugin whose `meta.name` resolves
 * to the same generated command name. Both FILE names are listed, because the
 * clash lives in the declared names and neither file name reveals it.
 *
 * Single-collision message:
 *   `Generated workflow name collision detected. Rename the meta.name of one of the source scripts:
 *      "acme:deploy" <- ["deploy.workflow.js", "ship.workflow.js"]`
 *
 * Multi-collision messages join each line on a fresh `\n  ` separator.
 *
 * Takes the FULL verdict array and narrows internally, which leaves the caller
 * no opportunity to dedup first. That is the deliberate divergence from
 * `bridges/commands/stage.ts::assertNoCommandCollisions`: the commands discover
 * path first-wins-dedups by generated name (D-07) before its assert ever runs,
 * which makes that assert unreachable in practice. For commands a clash can only
 * arise from prefix elision, which the two file names make legible; for
 * workflows it arises from `meta.name`, so keeping the first silently would be
 * the misnaming WNAM-05 exists to prevent.
 */
export function assertNoWorkflowNameCollisions(verdicts: readonly WorkflowVerdict[]): void {
  const groups = new Map<string, string[]>();

  for (const admitted of verdicts.filter(isAdmitted)) {
    const claimants = groups.get(admitted.generatedName) ?? [];

    claimants.push(admitted.fileName);
    groups.set(admitted.generatedName, claimants);
  }

  const collisions: WorkflowNameCollision[] = [];

  for (const [generatedName, fileNames] of groups) {
    if (fileNames.length > 1) {
      collisions.push({ generatedName, fileNames });
    }
  }

  if (collisions.length > 0) {
    throw new WorkflowNameCollisionError(collisions);
  }
}

/** Only the two arms that carry a `generatedName` can take part in a collision. */
function isAdmitted(verdict: WorkflowVerdict): verdict is AdmittedWorkflow {
  return verdict.outcome === "named" || verdict.outcome === "stem-fallback";
}

/**
 * WNAM-03: the three unreadable-`meta` shapes carry distinct causes because they
 * are distinct facts about the script, but they share one argument for skipping
 * rather than stem-naming: the declared name cannot be read, and a stem fallback
 * would install a possibly-wrong command name -- the precise failure WNAM-01
 * exists to prevent. The stem fallback is reserved for a `meta` whose KEY SET is
 * readable and which simply declares no literal name.
 */
function skippedVerdict(fileName: string, kind: SkippedCause): SkippedWorkflow {
  return {
    outcome: "skipped",
    fileName,
    reason: SKIPPED_REASONS[kind](fileName),
    cause: kind,
  };
}

const SKIPPED_REASONS: Readonly<Record<SkippedCause, (fileName: string) => string>> = {
  "no-meta": noMetaReason,
  "meta-not-object-literal": metaNotObjectLiteralReason,
  "meta-spread": metaSpreadReason,
};

function namedVerdict(
  pluginName: string,
  fileName: string,
  metaName: string,
  description: string | undefined,
): NamedWorkflow | RefusedWorkflow {
  const generated = generateOrRefuse(pluginName, fileName, metaName);

  if (typeof generated !== "string") {
    return generated;
  }

  return {
    outcome: "named",
    fileName,
    metaName,
    generatedName: generated,
    ...(description === undefined ? {} : { description }),
  };
}

/**
 * WNAM-02: `meta` is a readable object literal, but its `name` is absent or is
 * not a string literal -- an identifier, a template literal, a member
 * expression, a call. That value is classified by node type and never resolved,
 * so the file stem names the command instead.
 */
function stemFallbackVerdict(
  pluginName: string,
  fileName: string,
  description: string | undefined,
): StemFallbackWorkflow | RefusedWorkflow {
  const generated = generateOrRefuse(pluginName, fileName, fileStem(fileName));

  if (typeof generated !== "string") {
    return generated;
  }

  return {
    outcome: "stem-fallback",
    fileName,
    generatedName: generated,
    ...(description === undefined ? {} : { description }),
  };
}

/**
 * WNAM-02: the suffixes a workflow script may carry, and so the suffixes the
 * stem drops. Exported because the stem rule and the discovery filter must admit
 * the same set: a file the filter admits but this list does not know keeps its
 * suffix inside the command name.
 */
export const WORKFLOW_SCRIPT_EXTENSIONS = [".js", ".mjs", ".cjs"] as const;

/**
 * The name a workflow gets when its own `meta` does not supply one: the file
 * name with its script suffix removed and nothing else stripped. `.workflow` is
 * part of the stem, which is exactly why WNAM-01 prefers the declared name --
 * `drafter.workflow.js` stem-names to `<plugin>:drafter.workflow`.
 *
 * The suffix is matched without regard to case. A case-insensitive filesystem
 * reports the name as it was stored, so a `Thing.JS` that the discovery filter
 * admits would otherwise carry `.JS` into the command name.
 *
 * Derived here, from the file NAME the caller passes, so the fallback name is
 * computed in one place rather than by each caller.
 *
 * Exported for the same reason `WORKFLOW_SCRIPT_EXTENSIONS` is: the read-only
 * `info` surface renders the stem for every script whose name it could not
 * resolve, and a second case-insensitive suffix strip would agree with this one
 * on `.js` and diverge on exactly the `.mjs` / `.cjs` / mixed-case cases this
 * one exists to handle.
 */
export function fileStem(fileName: string): string {
  const lowered = fileName.toLowerCase();
  const suffix = WORKFLOW_SCRIPT_EXTENSIONS.find((ext) => lowered.endsWith(ext));

  return suffix === undefined ? fileName : fileName.slice(0, -suffix.length);
}

/**
 * WNAM-06 / WVAL-02: `generatedWorkflowName` throws on a name RN-2 or the
 * engine-parity gate rejects. That throw must not escape `admitWorkflowScript`:
 * one broken file in a twenty-script plugin must not block the other nineteen,
 * so an unsafe name becomes this file's own `refused` verdict.
 *
 * The collision (WNAM-05) stays a throw because it is a defect of the SET, not
 * of one file, and refusing one arbitrary member would be silent misnaming. The
 * plugin name is screened by `admitWorkflowScript` before this runs, for the
 * same reason, so what reaches this catch is always a defect of the name the
 * FILE supplies.
 *
 * `declaredName` is the text the name is BUILT FROM -- the declared `meta.name`
 * or, for a stem fallback, the file stem. Everywhere else in this module
 * `source` is the untrusted script TEXT, and both are `string`, so a swap would
 * compile. In a module whose contract is that script text never becomes a name,
 * the two must not share one parameter name.
 */
function generateOrRefuse(
  pluginName: string,
  fileName: string,
  declaredName: string,
): string | RefusedWorkflow {
  try {
    return generatedWorkflowName(pluginName, declaredName);
  } catch (err) {
    return {
      outcome: "refused",
      fileName,
      reason: unsafeNameReason(fileName, errorMessage(err)),
      cause: "unsafe-name",
    };
  }
}

/**
 * WVAL-01: byte-identical copy of the private `DETERMINISM_BLOCKLIST` in
 * `@quintinshaw/pi-dynamic-workflows` 3.10.1 (`dist/workflow.js:37`), where the
 * literal was re-verified unchanged from the version first vendored. The engine
 * runs it as a raw-text `.test()` over the WHOLE script before acorn parses, so
 * it cannot tell a call from a mention -- which is why WVAL-03 classifies the
 * match here rather than repeating the engine's message. There is no exported
 * contract for this value, so it must be re-checked on an engine upgrade.
 *
 * Declared with NO flags on purpose: the literal stays diffable against
 * upstream, and a module-level `g` regex would retain `lastIndex` between calls
 * and silently skip an early match on the second invocation. Match positions
 * come from a per-call `g` clone of this same pattern text -- one pattern, two
 * uses.
 *
 * This is the ONLY engine gate replicated. `parseWorkflowScript` carries further
 * structural rules, but they are unexported internals of a 0.x package, and
 * copying them would make our install refuse scripts for reasons an engine
 * upgrade may drop.
 */
const DETERMINISM_BLOCKLIST = /\bDate\s*\.\s*now\b|\bMath\s*\.\s*random\b|\bnew\s+Date\s*\(\s*\)/;

/**
 * WVAL-01: the position-scanning half of the ONE vendored pattern -- the same
 * literal with `g` added, never a flag string of its own. `.test()` runs the
 * literal itself, so any flag the literal carries applies there; a clone that
 * hard-coded `"g"` would drop that flag here, and the two halves would then
 * disagree about whether a script matched. The disagreement admits rather than
 * refuses, so it must be impossible by construction: the literal is re-checked
 * against upstream on every engine upgrade, and a flag may arrive with it.
 */
function determinismScanner(): RegExp {
  return new RegExp(DETERMINISM_BLOCKLIST, `${DETERMINISM_BLOCKLIST.flags.replaceAll("g", "")}g`);
}

interface DeterminismViolation {
  readonly cause: Exclude<RefusedCause, "unparseable" | "unsafe-name">;
  readonly reason: string;
}

type Range = readonly [number, number];

/**
 * WVAL-03: the engine answers "this script is nondeterministic"; we answer where
 * the match actually sits. Containment is tested against acorn's own comment
 * ranges and literal token ranges -- evidence from the one parse already
 * performed, not a second hand-written scanner that could disagree with it.
 *
 * A match in executable code decides the whole script, so the first such match
 * returns immediately. Otherwise the first non-executable match classifies it: a
 * mention confined to a comment or a literal is still refused, because the
 * engine rejects the script wholesale either way and installing it would
 * register a command that cannot run. The classification changes the message,
 * not the verdict.
 */
function findDeterminismViolation(
  fileName: string,
  source: string,
  parsed: ParsedScript,
): DeterminismViolation | undefined {
  if (!DETERMINISM_BLOCKLIST.test(source)) {
    return undefined;
  }

  const commentRanges: Range[] = parsed.comments.map((c) => [c.start, c.end]);
  let nonExecutable: DeterminismViolation | undefined;

  for (const match of source.matchAll(determinismScanner())) {
    const matched = match[0];
    const span: Range = [match.index, match.index + matched.length];
    const region = classifySpan(span, commentRanges, parsed.literalRanges);

    if (region === "code") {
      return { cause: "determinism-code", reason: determinismCodeReason(fileName, matched) };
    }

    nonExecutable ??= {
      cause: REGION_CAUSES[region],
      reason: REGION_REASONS[region](fileName, matched),
    };
  }

  return nonExecutable;
}

/** Where one blocklist match sits relative to the script's non-executable text. */
type MatchRegion = "comment" | "literal" | "split" | "code";

const REGION_CAUSES: Readonly<Record<Exclude<MatchRegion, "code">, DeterminismViolation["cause"]>> =
  {
    comment: "determinism-comment",
    literal: "determinism-string",
    split: "determinism-split",
  };

const REGION_REASONS: Readonly<
  Record<Exclude<MatchRegion, "code">, (fileName: string, matched: string) => string>
> = {
  comment: determinismCommentReason,
  literal: determinismStringReason,
  split: determinismSplitReason,
};

/**
 * WVAL-03: the WHOLE match span is tested, not just its start. The blocklist's
 * `\s` matches a newline, so `// beware new` followed by `Date();` matches
 * across the comment's end -- a start-only test calls that a comment mention,
 * which claims a containment the match does not have. Such a match is not a call
 * either, so it gets its own classification rather than being forced into an arm
 * whose message would be false.
 *
 * A `string` token's range INCLUDES its quote characters and a `template`
 * token's range EXCLUDES its backticks, so a match that opens a template sits
 * exactly at the range start -- which is why the lower bound is inclusive.
 */
function classifySpan(
  span: Range,
  comments: readonly Range[],
  literals: readonly Range[],
): MatchRegion {
  if (containsSpan(comments, span)) {
    return "comment";
  }

  if (containsSpan(literals, span)) {
    return "literal";
  }

  if (overlapsSpan(comments, span) || overlapsSpan(literals, span)) {
    return "split";
  }

  return "code";
}

function containsSpan(ranges: readonly Range[], [from, to]: Range): boolean {
  return ranges.some(([start, end]) => from >= start && to <= end);
}

function overlapsSpan(ranges: readonly Range[], [from, to]: Range): boolean {
  return ranges.some(([start, end]) => from < end && to > start);
}

/**
 * One `parse()` call fills all three products: the AST, the comment ranges, and
 * -- by filtering the token stream on the literal token types -- the ranges of
 * text that is quoted rather than executed. That is why no AST-walker package is
 * needed.
 *
 * A regex literal is its own token type and belongs in that filter: `/Date.now/`
 * is a pattern, and reporting it as a call would be as false as reporting a
 * quoted mention as one.
 *
 * Returns `undefined` rather than rethrowing: WNAM-04 makes an unparseable
 * script a per-file refusal, never a name scavenged from a broken tree.
 */
function parseScript(source: string): ParsedScript | undefined {
  const comments: Comment[] = [];
  const tokens: Token[] = [];

  let ast: Program;

  try {
    ast = parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      onComment: comments,
      onToken: tokens,
    });
  } catch {
    return undefined;
  }

  const literalRanges = tokens
    .filter(
      (t) =>
        t.type === tokTypes.string || t.type === tokTypes.template || t.type === tokTypes.regexp,
    )
    .map((t): Range => [t.start, t.end]);

  return { ast, comments, literalRanges };
}

/**
 * The `meta` lookup keeps "no `meta` declarator at all" and "`meta` declared as
 * something other than an object literal" apart, because WNAM-03 reports them as
 * distinct causes even though both end in `skipped`. The two are also the only
 * shapes that must NOT reach the stem fallback -- see `skippedVerdict`.
 */
type MetaLookup =
  | { readonly kind: "object-literal"; readonly elements: readonly MetaElement[] }
  | { readonly kind: "no-meta" }
  | { readonly kind: "meta-not-object-literal" };

/**
 * A `meta` object literal's contents as written: named properties AND spreads.
 * The spreads are carried rather than filtered out because their POSITION is
 * what decides whether a property they follow survives evaluation.
 */
type MetaElement = Property | SpreadElement;

function findMetaObject(ast: Program): MetaLookup {
  for (const node of ast.body) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;

    if (decl?.type !== "VariableDeclaration") {
      continue;
    }

    for (const d of decl.declarations) {
      if (d.id.type !== "Identifier" || d.id.name !== "meta") {
        continue;
      }

      if (d.init?.type !== "ObjectExpression") {
        return { kind: "meta-not-object-literal" };
      }

      return { kind: "object-literal", elements: d.init.properties };
    }
  }

  return { kind: "no-meta" };
}

/**
 * The property key as written. A computed key (`{ [k]: v }`) is not statically
 * knowable, so it is no key at all here; the bare identifier form and the
 * quoted-string form are the same key.
 */
function metaPropertyKey(p: Property): string | undefined {
  if (p.computed) {
    return undefined;
  }

  if (p.key.type === "Identifier") {
    return p.key.name;
  }

  if (p.key.type === "Literal" && typeof p.key.value === "string") {
    return p.key.value;
  }

  return undefined;
}

/**
 * WNAM-01 / WNAM-02: what one `meta` key resolves to, decided by the same rules
 * the evaluated object obeys.
 *
 * `literal` and `no-literal` differ only in the message they produce downstream;
 * `opaque` is the arm that separates a stem fallback from a skip.
 */
type MetaRead =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "no-literal" }
  | { readonly kind: "opaque" };

/**
 * WNAM-01: read one `meta` key the way JavaScript reads it -- in order, LAST
 * WINS. Duplicate property names are legal in a module object literal (the ES5
 * strict-mode restriction was dropped in ES6; only a duplicate `__proto__` is an
 * error), so stopping at the first match reports a name the evaluated object
 * never carries. A non-literal occurrence poisons only itself: a readable
 * literal that FOLLOWS it is the value the object ends up with.
 *
 * A spread makes every key that follows it unknowable -- it can introduce a key
 * that was never written and overwrite one that was. That is why the scan
 * carries spreads instead of filtering them out, and why the answer is `opaque`
 * rather than a guess. WNAM-02's stem fallback is not the right answer there:
 * the fallback exists for a `meta` whose key set IS readable and simply carries
 * no literal name, whereas a spread hides the key set itself -- the same
 * unknown-shape situation as `meta = someFactory()`, which WNAM-03 skips. A
 * spread BEFORE the last literal occurrence is harmless, because last-wins means
 * the literal overwrites whatever the spread contributed.
 */
function readMetaString(elements: readonly MetaElement[], key: string): MetaRead {
  let read: MetaRead = { kind: "no-literal" };

  for (const element of elements) {
    if (element.type === "SpreadElement") {
      read = { kind: "opaque" };
      continue;
    }

    if (metaPropertyKey(element) !== key) {
      continue;
    }

    const value = literalString(element.value);

    read = value === undefined ? { kind: "no-literal" } : { kind: "literal", value };
  }

  return read;
}

/**
 * The statically-known text of one `meta` value, or `undefined` when the value
 * is not statically known.
 *
 * These are exactly the two forms the engine's own `evaluateLiteral`
 * (`@quintinshaw/pi-dynamic-workflows` 3.10.1, `dist/workflow.js`) resolves to a
 * string without running anything: a string `Literal`, and a `TemplateLiteral`
 * carrying no substitutions, whose text it joins off the quasis. Both are reads
 * of text acorn has already parsed, so neither costs this module its security
 * property -- no value of a non-literal node is resolved, and a template with
 * even one substitution is refused a name rather than evaluated.
 *
 * Leaving the template form out is not the safe direction. The engine reads
 * `` name: `deploy` `` as "deploy", so treating it as unreadable would stem-name
 * the command after its file -- silently, and exactly the misnaming WNAM-01
 * exists to prevent.
 *
 * `cooked` and not `raw`: they differ the moment the text carries an escape
 * (`a\nb` cooks to a newline), and `cooked` is the one the engine reads. Acorn
 * refuses a bad escape sequence in an UNTAGGED template outright, so such a
 * script is settled as `unparseable` long before this runs and `cooked` is
 * always present here; `String` folds the type's unreachable nullish arm without
 * adding a branch that no input can take.
 */
function literalString(node: Property["value"]): string | undefined {
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }

  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((quasi) => String(quasi.value.cooked)).join("");
  }

  return undefined;
}

function unparseableReason(fileName: string): string {
  return `${fileName} is not parseable JavaScript, so no name can be read from it`;
}

function noMetaReason(fileName: string): string {
  return `${fileName} declares no \`meta\`, so there is nothing to install`;
}

function metaNotObjectLiteralReason(fileName: string): string {
  return `${fileName} declares \`meta\` as something other than an object literal, so its name cannot be read without running the script`;
}

function metaSpreadReason(fileName: string): string {
  return `${fileName} declares \`meta\` with a spread that can supply or overwrite its \`name\`, so the name cannot be read without running the script`;
}

function unsafeNameReason(fileName: string, message: string): string {
  return `${fileName} resolves to an unusable command name: ${message}`;
}

function determinismCodeReason(fileName: string, matched: string): string {
  return `${fileName} calls \`${matched}\`, which the workflow engine refuses as nondeterministic`;
}

function determinismCommentReason(fileName: string, matched: string): string {
  return `${fileName} mentions \`${matched}\` in a comment; the engine screens raw text and refuses the script anyway, so reword the comment to make it load`;
}

function determinismStringReason(fileName: string, matched: string): string {
  return `${fileName} mentions \`${matched}\` inside a string, template or regular-expression literal; the engine screens raw text and refuses the script anyway`;
}

function determinismSplitReason(fileName: string, matched: string): string {
  return `${fileName} matches \`${matched}\` across the boundary between quoted-or-commented text and code, so nothing is invoked; the engine screens raw text and refuses the script anyway, so the matching text must change to make it load`;
}
