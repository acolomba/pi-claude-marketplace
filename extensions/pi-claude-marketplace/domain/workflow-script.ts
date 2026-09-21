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
import type {
  Comment,
  Program,
  Property,
  SpreadElement,
  Token,
  VariableDeclaration,
  VariableDeclarator,
} from "acorn";

/**
 * WGATE-01: the host engine's structural admission checks, in the order
 * `parseWorkflowScript` reaches them -- checks 3, 4, 5, 6, 8 and 9 of
 * `@quintinshaw/pi-dynamic-workflows` 3.10.1, `src/workflow.ts:1504-1626`.
 *
 * Index order IS report order (D-115-04). The engine stops at its first
 * failure, so a script failing an early check never reaches a later one, and
 * naming a later gate would describe an object the engine never evaluates.
 *
 * The engine's first two checks are absent because this module REFUSES them:
 * the determinism screen and the parse are the two gates it replicates. Its
 * "the declarator has an initializer" check is absent because no parseable
 * script reaches it (D-115-02): `export const meta;` is a `SyntaxError` acorn
 * rejects, and every non-`const` form fails the `const` check first.
 *
 * None of this is an exported engine contract, so the set must be re-checked on
 * an engine upgrade -- the same standing caveat the vendored determinism
 * literal carries. An engine gate missing from this tuple costs an author a
 * warning; it can never cost anyone an install (WGATE-03).
 */
const GATE_ORDER = [
  "meta-not-first-export",
  "meta-not-const-export",
  "meta-not-sole-declarator",
  "meta-not-named-meta",
  "meta-not-pure-literal",
  "meta-fields-invalid",
] as const;

/**
 * WGATE-01: the closed set of engine gates a script can be warned about.
 *
 * Derived FROM `GATE_ORDER` rather than written beside it, so the order and the
 * union cannot disagree: a new gate is added to the tuple alone, and the total
 * `GATE_PREDICATES` map then refuses to compile until it has a predicate.
 */
export type WorkflowGate = (typeof GATE_ORDER)[number];

/** WNAM-01: the script declared a string-literal `meta.name`. */
export interface NamedWorkflow {
  readonly outcome: "named";
  readonly fileName: string;
  readonly metaName: string;
  readonly generatedName: string;
  readonly description?: string; // WBRG-01 envelope input; unused by the verdict
  /**
   * WGATE-01: the engine gate this script would be refused at, absent when the
   * engine would load it. Advisory only -- it rides the two ADMITTED arms
   * precisely because a gate reading may never turn into a refusal (WGATE-03).
   */
  readonly gate?: WorkflowGate;
}

/** WNAM-02: no readable `meta.name`, so the file stem names the command. */
export interface StemFallbackWorkflow {
  readonly outcome: "stem-fallback";
  readonly fileName: string;
  readonly generatedName: string;
  readonly description?: string;
  /** WGATE-01: as on `NamedWorkflow` -- the gate, or absent. */
  readonly gate?: WorkflowGate;
}

/** WNAM-03: nothing to install -- the script declares no usable metadata. */
export type SkippedCause =
  "no-meta" | "meta-not-object-literal" | "meta-spread" | "meta-computed-key";

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
    return skippedVerdict(fileName, metaName.cause);
  }

  const violation = findDeterminismViolation(fileName, source, parsed);

  if (violation !== undefined) {
    return { outcome: "refused", fileName, reason: violation.reason, cause: violation.cause };
  }

  const read = readMetaString(meta.elements, "description");
  const description = read.kind === "literal" ? read.value : undefined;
  // WGATE-01: read the gate AFTER both refusal arms have been settled and
  // BEFORE either admitted verdict is built. Earlier would mean reading gates
  // off a script that is about to be refused, and a refusal carries no gate by
  // type (WGATE-03/WGATE-04).
  const gate = readEngineGate(parsed.ast, meta.elements);

  if (metaName.kind === "no-literal") {
    return stemFallbackVerdict(pluginName, fileName, description, gate);
  }

  return namedVerdict(pluginName, fileName, metaName.value, description, gate);
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
 * WNAM-03: the four unreadable-`meta` shapes carry distinct causes because they
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
  "meta-computed-key": metaComputedKeyReason,
};

function namedVerdict(
  pluginName: string,
  fileName: string,
  metaName: string,
  description: string | undefined,
  gate: WorkflowGate | undefined,
): NamedWorkflow | RefusedWorkflow {
  const generated = generateOrRefuse(pluginName, fileName, metaName);

  if (!("generatedName" in generated)) {
    return generated;
  }

  return {
    outcome: "named",
    fileName,
    metaName,
    generatedName: generated.generatedName,
    ...(description === undefined ? {} : { description }),
    ...(gate === undefined ? {} : { gate }),
  };
}

/**
 * WNAM-02: `meta` is a readable object literal, but its `name` is absent or is
 * not statically known text -- an identifier, a substituted template, a member
 * expression, a call, a number. That value is classified by node type and never
 * resolved, so the file stem names the command instead.
 *
 * A stem-named command is installable but not necessarily RUNNABLE. The engine's
 * `validateMeta` demands a `meta.name` AND a `meta.description` that both
 * resolve to non-empty strings, and every shape reaching this arm fails at least
 * the name half -- so the command this registers reports a validation error the
 * first time anyone runs it. Narrowing the fallback to the shapes the engine can
 * load would mean replicating its structural rules here, which the module header
 * declines for the good reason that an engine upgrade may drop them; and the
 * `description` half cannot be judged from `meta.name` alone anyway. Telling the
 * user belongs to the bridge that writes the envelope, and it does:
 * `bridges/workflows/discover.ts::unrunnableWarning` composes one `warnings[]`
 * line for every script reaching this arm, in the caller's tense, and names the
 * engine gate inside that same line when the verdict's `gate` field carries one
 * (WGATE-01). So the arm reports itself rather than registering a dead command
 * in silence.
 */
function stemFallbackVerdict(
  pluginName: string,
  fileName: string,
  description: string | undefined,
  gate: WorkflowGate | undefined,
): StemFallbackWorkflow | RefusedWorkflow {
  const generated = generateOrRefuse(pluginName, fileName, fileStem(fileName));

  if (!("generatedName" in generated)) {
    return generated;
  }

  return {
    outcome: "stem-fallback",
    fileName,
    generatedName: generated.generatedName,
    ...(description === undefined ? {} : { description }),
    ...(gate === undefined ? {} : { gate }),
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
 */
function fileStem(fileName: string): string {
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
): { readonly generatedName: string } | RefusedWorkflow {
  try {
    return { generatedName: generatedWorkflowName(pluginName, declaredName) };
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
 * and silently skip an early match on the second invocation. The literal is
 * never matched against directly -- every scan goes through the per-call clone
 * `determinismScanner` builds, so no call can leave state behind for the next.
 *
 * This is ONE of the two engine gates replicated; the parse is the other, and
 * `docs/workflows-compatibility.md` carries the count. `parseWorkflowScript`
 * holds further structural rules, and at 3.10.1 they are unexported internals
 * with no exported contract of any kind -- which is why this module WARNS on the
 * ones it can name (`readEngineGate`) instead of refusing on them. A spurious
 * warning is something a reader can ignore; a spurious refusal is a blocked
 * install that only an extension release can clear (WGATE-03).
 */
const DETERMINISM_BLOCKLIST = /\bDate\s*\.\s*now\b|\bMath\s*\.\s*random\b|\bnew\s+Date\s*\(\s*\)/;

/**
 * WVAL-01: the ONE matcher for the vendored pattern -- the same literal with `g`
 * added, carrying whatever other flags the literal carries rather than a flag
 * string of its own. Every flag arrives here, because the literal is re-checked
 * against upstream on every engine upgrade and a flag may arrive with it.
 *
 * Fresh per call, so `lastIndex` can never survive one scan into the next. That
 * matters in one direction only: a retained position makes a later scan miss an
 * earlier match and ADMIT a script the engine refuses, which is the failure this
 * module must not have.
 *
 * Whether a script matches at all is decided from this clone's matches too, not
 * by a second `.test()` against the bare literal. Two matchers can disagree; one
 * cannot.
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

/**
 * The `meta` declarator the evaluated module would end up with -- in order, LAST
 * WINS, the same rule `readMetaString` applies one level down to the properties
 * inside it.
 *
 * `var meta = ...` twice at the top level is legal in a module and the second
 * binding is the one that survives, so stopping at the first would report a name
 * the evaluated script never carries. That is the argument `readMetaString`
 * already makes for properties, and it does not stop being true one level up.
 *
 * LAST WINS is a rule about REBINDING, not about textual position: only a
 * declarator carrying an initializer supersedes an earlier one, because
 * `var meta = {...}; var meta;` leaves `meta` holding the object.
 */
function findMetaObject(ast: Program): MetaLookup {
  let found: MetaLookup = { kind: "no-meta" };

  for (const node of ast.body) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;

    if (decl?.type !== "VariableDeclaration") {
      continue;
    }

    for (const declarator of decl.declarations) {
      if (declarator.id.type === "Identifier" && declarator.id.name === "meta") {
        found = bindMeta(found, declarator);
      }
    }
  }

  return found;
}

/**
 * What one `meta` declarator leaves the binding holding, given what the
 * declarators before it left.
 *
 * A declarator with no initializer re-declares without REBINDING, so it cannot
 * supersede an earlier one: `var meta = {...}; var meta;` leaves `meta` holding
 * the object, exactly as `var x = 1; var x;` leaves `x === 1`. It does still
 * ESTABLISH the binding when nothing else has, and an established-but-unset
 * binding holds `undefined`, which is not an object literal.
 */
function bindMeta(found: MetaLookup, declarator: VariableDeclarator): MetaLookup {
  if (declarator.init === undefined || declarator.init === null) {
    return found.kind === "no-meta" ? { kind: "meta-not-object-literal" } : found;
  }

  return declarator.init.type === "ObjectExpression"
    ? { kind: "object-literal", elements: declarator.init.properties }
    : { kind: "meta-not-object-literal" };
}

/**
 * The property key as written, for a property whose key IS written -- the bare
 * identifier form, the quoted-string form and the numeric form, which are the
 * three the engine's own `propertyKey` reads, and it reads them to the same
 * text. A computed key never reaches here: `readMetaString` settles it before
 * asking, because a key that is not statically knowable is not a missing key but
 * an unknowable one.
 *
 * `undefined` answers for a key node the engine refuses outright rather than
 * reads. A BigInt literal is the reachable one, and it is why the answer is not
 * simply "the key text": a numeric key resolves to text the engine accepts,
 * while a BigInt key of the same node type does not.
 */
function metaPropertyKey(p: Property): string | undefined {
  if (p.key.type === "Identifier") {
    return p.key.name;
  }

  if (
    p.key.type === "Literal" &&
    (typeof p.key.value === "string" || typeof p.key.value === "number")
  ) {
    return String(p.key.value);
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
  | { readonly kind: "opaque"; readonly cause: "meta-spread" | "meta-computed-key" };

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
 *
 * A computed key does the same thing on the same terms -- `{ name: "x",
 * ["na" + "me"]: "y" }` leaves `meta.name` as "y" -- so it gets the same
 * `opaque` disposition, under its own cause because it is a different fact
 * about the script. Reading past it as though the property were not there
 * would let the element with the STRONGEST claim on the key be the one form
 * the scan ignores, and mint a name the evaluated object never carries.
 */
function readMetaString(elements: readonly MetaElement[], key: string): MetaRead {
  let read: MetaRead = { kind: "no-literal" };

  for (const element of elements) {
    if (element.type === "SpreadElement") {
      read = { kind: "opaque", cause: "meta-spread" };
      continue;
    }

    if (element.computed) {
      read = { kind: "opaque", cause: "meta-computed-key" };
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

/**
 * WGATE-01: the FIRST engine gate this script would be refused at, or
 * `undefined` when the engine would load it.
 *
 * WGATE-03: the walk is contained HERE, in its own body. It reads untrusted
 * third-party AST through three mutually-recursive predicates, and
 * `admitWorkflowScript`'s only external caller does not guard it -- so a throw
 * escaping this function would fail a whole plugin install rather than cost one
 * script its warning. One broken file in a twenty-script plugin must not block
 * the other nineteen, and a gate reading may never block anything at all, so an
 * unforeseen node shape costs the author a missing warning and nothing more.
 *
 * Acorn's own `RangeError` on a pathologically deep literal is already contained
 * by `parseScript`, so what reaches this catch is the walk's own depth budget or
 * a node shape the predicates were not written for.
 */
function readEngineGate(ast: Program, elements: readonly MetaElement[]): WorkflowGate | undefined {
  try {
    const ctx = gateContext(ast, elements);

    return GATE_ORDER.find((gate) => GATE_PREDICATES[gate](ctx));
  } catch {
    return undefined;
  }
}

/**
 * WGATE-01: what every gate predicate reads, derived once per script.
 *
 * The structural fields are narrowed HERE rather than inside each predicate, so
 * a predicate stays one comparison and the narrowing runs over every admitted
 * script -- the malformed ones included, which is what exercises each of its
 * arms.
 *
 * `elements` are the `meta` object literal's own, as `findMetaObject` returned
 * them. Nothing deeper is needed: a top-level `const meta` is the only `meta`
 * binding a parseable module can carry, because a second one is a redeclaration
 * `SyntaxError`. So once the four structural checks pass, those elements ARE the
 * first statement's declarator init, and the literal and field checks may read
 * them without a second lookup (D-115-04).
 */
interface GateContext {
  readonly first: Program["body"][number] | undefined;
  readonly declaration: VariableDeclaration | undefined;
  readonly declaratorName: string | undefined;
  readonly elements: readonly MetaElement[];
}

function gateContext(ast: Program, elements: readonly MetaElement[]): GateContext {
  const first = ast.body[0];
  const exported = first?.type === "ExportNamedDeclaration" ? first.declaration : undefined;
  const declaration = exported?.type === "VariableDeclaration" ? exported : undefined;
  const id = declaration?.declarations[0]?.id;

  return {
    first,
    declaration,
    declaratorName: id?.type === "Identifier" ? id.name : undefined,
    elements,
  };
}

/**
 * WGATE-01: one predicate per gate, each answering "would the engine refuse
 * HERE?".
 *
 * The explicit `Record<WorkflowGate, ...>` annotation is the totality lock: a
 * seventh member of `GATE_ORDER` cannot compile without an entry here. It is
 * annotated rather than inferred, and keyed by the union rather than by `string`,
 * because either of those weakenings would make the map accept an incomplete
 * set.
 */
const GATE_PREDICATES: Record<WorkflowGate, (ctx: GateContext) => boolean> = {
  "meta-not-first-export": (ctx) => ctx.first?.type !== "ExportNamedDeclaration",
  "meta-not-const-export": (ctx) => ctx.declaration?.kind !== "const",
  "meta-not-sole-declarator": (ctx) => ctx.declaration?.declarations.length !== 1,
  "meta-not-named-meta": (ctx) => ctx.declaratorName !== "meta",
  "meta-not-pure-literal": (ctx) => !isLiteralObject(ctx.elements, 0),
  "meta-fields-invalid": (ctx) => metaFieldsFailValidation(ctx.elements),
};

/**
 * WGATE-01: how deep into a `meta` literal the gate walk goes before it stops
 * deciding. A real `meta` nests three levels (`meta.phases[0].title`), so a
 * literal deeper than this budget is pathological, and declining to judge it
 * costs the author a warning rather than an install (WGATE-03).
 *
 * The budget is enforced by a throw so that the containment catch in
 * `readEngineGate` is exercised by a real script rather than only inspected.
 */
const GATE_WALK_MAX_DEPTH = 32;

/**
 * The `meta` key names the engine refuses outright, read from its own
 * `evaluateLiteral` at 3.10.1. An unmeasured reserved name would cost a missing
 * warning, never a false one, which is the direction WGATE-03 chose -- and like
 * every other engine figure here, the set must be re-checked on an upgrade.
 */
const RESERVED_META_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * WGATE-01: does the engine's `evaluateLiteral` resolve every value in this
 * object literal?
 *
 * An ALLOW-list, stated in the engine's own terms. The refusal side is a long
 * list of separate throws, and a deny-list of that shape is the enumeration a
 * reader like this gets wrong; naming the forms that ARE resolvable makes an
 * unforeseen node type fire the gate rather than slip past it.
 *
 * No total is stated, for the reason `docs/workflows-compatibility.md` gives
 * for stating none: a count of an unexported engine internal that nothing here
 * enumerates is a number with no counting rule behind it, and a reader takes it
 * as measured.
 */
function isLiteralObject(elements: readonly MetaElement[], depth: number): boolean {
  return elements.every((element) => isLiteralProperty(element, depth));
}

/**
 * One `meta` property the engine resolves: a plain, non-computed, non-method,
 * `init`-kind property whose key name is not reserved and whose value is itself
 * resolvable.
 *
 * The KEY NODE is a rule of its own. The engine's `propertyKey` reads an
 * identifier and a string- or number-valued literal and refuses every other key
 * node, so `{ 1n: "x" }` is refused on its key alone while `{ 1: "x" }` is
 * admitted. A reader testing only the node type, `computed`, `kind` and `method`
 * would decide most of the engine's refusals and read the key-node one
 * backwards.
 */
function isLiteralProperty(element: MetaElement, depth: number): boolean {
  if (
    element.type === "SpreadElement" ||
    element.computed ||
    element.kind !== "init" ||
    element.method
  ) {
    return false;
  }

  const key = metaPropertyKey(element);

  if (key === undefined || RESERVED_META_KEYS.has(key)) {
    return false;
  }

  return isLiteralValue(element.value, depth);
}

/**
 * The value forms the engine resolves: ANY `Literal` -- its `Literal` arm
 * returns the value with no type test at all, so a regular expression and a
 * BigInt are both resolvable -- a substitution-free `TemplateLiteral`, an object
 * or array of resolvable values, and a negative-number unary.
 */
function isLiteralValue(node: Property["value"], depth: number): boolean {
  if (depth > GATE_WALK_MAX_DEPTH) {
    throw new Error("meta literal nesting exceeds the gate walk budget");
  }

  if (node.type === "Literal") {
    return true;
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.length === 0;
  }

  if (node.type === "ObjectExpression") {
    return isLiteralObject(node.properties, depth + 1);
  }

  if (node.type === "ArrayExpression") {
    return isLiteralArray(node.elements, depth + 1);
  }

  return isNegativeNumber(node);
}

/** The one non-literal expression the engine resolves: minus a number literal. */
function isNegativeNumber(node: Property["value"]): boolean {
  return (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "Literal" &&
    typeof node.argument.value === "number"
  );
}

/** An array the engine resolves: no hole, no spread, every element resolvable. */
function isLiteralArray(
  elements: readonly (Property["value"] | SpreadElement | null)[],
  depth: number,
): boolean {
  return elements.every(
    (element) =>
      element !== null && element.type !== "SpreadElement" && isLiteralValue(element, depth),
  );
}

/**
 * WGATE-01: do the `meta` fields the engine's `validateMeta` inspects fail it?
 *
 * The `description`, `model` and `phases` arms only. "meta must be an object" is
 * already a `meta-not-object-literal` skip and an empty `meta.name` an
 * `unsafe-name` refusal, neither of which reaches a gate reading; a `meta` with
 * no readable name at all is reported by the bridge's own stem-fallback caveat.
 *
 * `model` and `phases` are judged only when DECLARED, because the engine admits
 * a `meta` that declares neither.
 */
function metaFieldsFailValidation(elements: readonly MetaElement[]): boolean {
  const description = readMetaString(elements, "description");

  if (description.kind !== "literal" || description.value.trim() === "") {
    return true;
  }

  return (
    !isEngineModel(metaValue(elements, "model")) || !isEnginePhases(metaValue(elements, "phases"))
  );
}

/** `meta.model` must resolve to a string when declared. */
function isEngineModel(node: Property["value"] | undefined): boolean {
  return node === undefined || literalString(node) !== undefined;
}

/** `meta.phases` must be an array of objects, each carrying a string `title`. */
function isEnginePhases(node: Property["value"] | undefined): boolean {
  if (node === undefined) {
    return true;
  }

  if (node.type !== "ArrayExpression") {
    return false;
  }

  return node.elements.every(isEnginePhase);
}

function isEnginePhase(element: Property["value"] | SpreadElement | null): boolean {
  return (
    element?.type === "ObjectExpression" &&
    readMetaString(element.properties, "title").kind === "literal"
  );
}

/**
 * The raw node one `meta` key ends up holding -- in order, LAST WINS, the rule
 * `readMetaString` applies to the same elements.
 *
 * Raw rather than resolved to text, because `validateMeta` asks about a value's
 * TYPE: a reader that resolved first could not tell an absent key from one
 * holding a number.
 */
function metaValue(elements: readonly MetaElement[], key: string): Property["value"] | undefined {
  let found: Property["value"] | undefined;

  for (const element of elements) {
    if (element.type !== "SpreadElement" && metaPropertyKey(element) === key) {
      found = element.value;
    }
  }

  return found;
}

/**
 * Render untrusted plugin text safely inside a one-line notification.
 *
 * Exported because the workflows bridge composes the SAME rendered line around
 * the reasons this module returns, from the same untrusted tree, so it must
 * escape by the same rule. A second escaping scheme one layer up would defend
 * the same text twice under two definitions of "safe", and the one they
 * disagreed about is the one that would get through.
 *
 * Three things reach a `reason` from third-party content: the file NAME, the
 * blocklist text that MATCHED, and the detail of a name refusal, which quotes
 * the declared `meta.name` back. Each carries a distinct hazard. A POSIX file
 * name may contain a newline, so a plugin can forge what looks like an extra
 * output line inside a refusal block. `\s` in the vendored blocklist matches a
 * newline too, so `matched` can be long multi-line text. And a `meta.name` may
 * carry U+202E RIGHT-TO-LEFT OVERRIDE, which visually reverses the remainder of
 * the line and which `assertSafeName` does not screen -- it stops at 0x7F -- yet
 * which reaches the message precisely BECAUSE the name was rejected.
 *
 * `shared/notify.ts` renders what it is handed without inspecting it, so the
 * escaping belongs where the untrusted text enters the string.
 *
 * `\p{Cc}` and `\p{Cf}` are the two classes that carry all of this: every ASCII
 * control including newline, and every Unicode format character including the
 * bidi overrides and the zero-width spaces. They are the same two classes the
 * engine's own `isSafeSavedWorkflowName` screens a saved name for. The output
 * spelling is `\u{...}`, so a reader sees what the text actually holds.
 *
 * `Number` folds `codePointAt`'s out-of-range `undefined` -- impossible for a
 * matched character -- without adding a branch no input can take.
 */
export function forMessage(text: string): string {
  return text.replaceAll(
    /[\p{Cc}\p{Cf}]/gu,
    (character) => `\\u{${Number(character.codePointAt(0)).toString(16)}}`,
  );
}

function unparseableReason(fileName: string): string {
  return `${forMessage(fileName)} is not parseable JavaScript, so no name can be read from it`;
}

function noMetaReason(fileName: string): string {
  return `${forMessage(fileName)} declares no \`meta\`, so there is nothing to install`;
}

function metaNotObjectLiteralReason(fileName: string): string {
  return `${forMessage(fileName)} declares \`meta\` as something other than an object literal, so its name cannot be read without running the script`;
}

function metaSpreadReason(fileName: string): string {
  return `${forMessage(fileName)} declares \`meta\` with a spread that can supply or overwrite its \`name\`, so the name cannot be read without running the script`;
}

function metaComputedKeyReason(fileName: string): string {
  return `${forMessage(fileName)} declares \`meta\` with a computed key that can supply or overwrite its \`name\`, so the name cannot be read without running the script`;
}

function unsafeNameReason(fileName: string, message: string): string {
  return `${forMessage(fileName)} resolves to an unusable command name: ${forMessage(message)}`;
}

function determinismCodeReason(fileName: string, matched: string): string {
  return `${forMessage(fileName)} calls \`${forMessage(matched)}\`, which the workflow engine refuses as nondeterministic`;
}

function determinismCommentReason(fileName: string, matched: string): string {
  return `${forMessage(fileName)} mentions \`${forMessage(matched)}\` in a comment; the engine screens raw text and refuses the script anyway, so reword the comment to make it load`;
}

function determinismStringReason(fileName: string, matched: string): string {
  return `${forMessage(fileName)} mentions \`${forMessage(matched)}\` inside a string, template or regular-expression literal; the engine screens raw text and refuses the script anyway`;
}

function determinismSplitReason(fileName: string, matched: string): string {
  return `${forMessage(fileName)} matches \`${forMessage(matched)}\` across the boundary between quoted-or-commented text and code, so nothing is invoked; the engine screens raw text and refuses the script anyway, so the matching text must change to make it load`;
}
