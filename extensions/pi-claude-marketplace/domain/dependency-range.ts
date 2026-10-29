// domain/dependency-range.ts
//
// The version-constraint algebra a constrained dependency is resolved against
// (RESV-03). Two questions live here: what ONE range do the N ranges declared
// for a single dependency name come to (D-03-02.1), and does a RECORDED
// version satisfy a range (D-03-02.3).
//
// D-03-01 makes `semver` this package's own declared runtime dependency rather
// than an evaluator borrowed from a hoist. Both answers are computed with it,
// because a declared range carries prerelease precedence, x-ranges, unions and
// build metadata that a hand-rolled comparator gets wrong.
//
// Like `domain/dependencies.ts`, this module is pure: no I/O, no network, no
// clock, and no knowledge of the marketplace that declared a range. The caller
// accumulates the ranges, decides what a failure means for its cascade, and
// owns every lookup.

import { coerce, minVersion, satisfies, valid, validRange } from "semver";

/**
 * The total characters admitted across ALL declared ranges of one dependency,
 * measured before any range is parsed.
 *
 * A PROJECT-OWNED cap, not a number read off any upstream implementation. Only
 * the mechanism is borrowed: guard the size before doing the work it bounds,
 * so a pathological input fails closed instead of being parsed first.
 */
const MAX_RANGE_INPUT_CHARS = 4096;

/**
 * The conjuncts admitted in the intersected range.
 *
 * Also a PROJECT-OWNED cap. The intersection is a cross-product, so a handful
 * of union-bearing inputs multiply into a combinatorial explosion; the
 * projected product is compared to this cap before any product is allocated.
 */
const MAX_RANGE_CONJUNCTS = 1024;

/**
 * D-PL3-10: the characters Claude Code keeps of a range list, or of one range,
 * rendered into a refusal. A longer text is cut there, never inside a quoted
 * range, and ends with `… (+N chars)`.
 */
const MAX_RENDERED_RANGE_CHARS = 200;

/**
 * D-PL3-10: the UTF-16 code units Claude Code keeps of a range it quotes
 * because the range is not a valid printable semver range.
 */
const MAX_QUOTED_RANGE_CHARS = 64;

/** The curly quotes Claude Code puts around a range it cannot show as written. */
const OPEN_QUOTE = "\u201c";
const CLOSE_QUOTE = "\u201d";

/** The operator separating a range's alternative branches. */
const UNION = "||";

/** The range that admits every version, which is what no constraint means. */
const WILDCARD = "*";

/**
 * The effective constraint N declared ranges come to, or the named reason they
 * come to none.
 *
 * `reason` is the closed vocabulary of why an intersection produced no range.
 * `detail` is diagnostic text assembled from measurements and field positions
 * only. It never carries the raw text of a declared range, so one element's
 * content can never be reported against another element's failure.
 */
export type DependencyRangeIntersection =
  | { readonly ok: true; readonly range: string }
  | {
      readonly ok: false;
      readonly reason: "invalid" | "disjoint" | "too-complex";
      readonly detail: string;
    };

/** The failing arm alone, so the helpers below can return it early. */
type IntersectionFailure = Extract<DependencyRangeIntersection, { ok: false }>;

/**
 * Measures the whole input before anything is parsed, so an input too large to
 * process cheaply never reaches the parser that would make it expensive.
 */
function checkTotalInputSize(ranges: readonly string[]): IntersectionFailure | undefined {
  let total = 0;
  for (const range of ranges) {
    total += range.length;
  }

  if (total <= MAX_RANGE_INPUT_CHARS) {
    return undefined;
  }

  return {
    ok: false,
    reason: "too-complex",
    detail: `total input ${total} characters exceeds the ${MAX_RANGE_INPUT_CHARS} character cap`,
  };
}

/**
 * Splits a canonical range into its alternative branches.
 *
 * `validRange` renders a union as trimmed comparator sets joined by a bare
 * `||`, so splitting on that operator recovers exactly the branches it built.
 */
function splitUnionBranches(canonical: string): readonly string[] {
  return canonical
    .split(UNION)
    .map((branch) => branch.trim())
    .filter((branch) => branch.length > 0);
}

/**
 * Validates every declared range and reduces each to its branches.
 *
 * A rejection names the position of the offending input and the number of
 * inputs, never the text of any of them.
 */
function splitEveryInput(
  ranges: readonly string[],
): { readonly ok: true; readonly branches: readonly (readonly string[])[] } | IntersectionFailure {
  const branches: (readonly string[])[] = [];
  for (const [index, declared] of ranges.entries()) {
    const canonical = validRange(declared);
    if (canonical === null) {
      return {
        ok: false,
        reason: "invalid",
        detail: `input ${index + 1} of ${ranges.length} is not a valid version range`,
      };
    }

    branches.push(splitUnionBranches(canonical));
  }

  return { ok: true, branches };
}

/**
 * Compares the PROJECTED conjunct count against the cap at every fold step,
 * before a single product is allocated.
 *
 * The running product after the first input is that input's own branch count,
 * so the first input is bounded by the same walk rather than by a separate
 * check. A cap tested after the product is built would have to allocate the
 * very explosion it exists to refuse.
 */
function checkProjectedConjuncts(
  branches: readonly (readonly string[])[],
): IntersectionFailure | undefined {
  let projected = 1;
  for (const [index, next] of branches.entries()) {
    projected *= next.length;
    if (projected > MAX_RANGE_CONJUNCTS) {
      return {
        ok: false,
        reason: "too-complex",
        detail:
          `${projected} conjuncts after ${index + 1} of ${branches.length} inputs ` +
          `exceeds the ${MAX_RANGE_CONJUNCTS} conjunct cap`,
      };
    }
  }

  return undefined;
}

/** Joins every branch of one accumulator with every branch of the next. */
function crossProduct(left: readonly string[], right: readonly string[]): readonly string[] {
  const product: string[] = [];
  for (const one of left) {
    for (const other of right) {
      product.push(`${one} ${other}`);
    }
  }

  return product;
}

/**
 * Reports whether a conjunct admits any version at all.
 *
 * The minimum-version test IS the disjointness detection, and a range
 * validator cannot stand in for it: `validRange(">=2.0.0 <1.0.0")` succeeds
 * while `minVersion` of the same text returns null. Filtering on validity
 * alone would let a disjoint intersection through as a range that then matches
 * nothing, so the dependency would fail for having no matching version instead
 * of for the conflict that is actually true.
 */
function isSatisfiableConjunct(conjunct: string): boolean {
  return minVersion(conjunct) !== null;
}

/**
 * Folds the ranges declared for one dependency name into the single effective
 * range that admits exactly the versions all of them admit.
 *
 * An empty accumulator is no constraint and intersects to the wildcard. Both
 * size caps run before the work they bound. The result is canonical by
 * construction: every conjunct is a comparator set `validRange` produced (or
 * two of them concatenated, which is again a comparator set), and rejoining
 * them with a bare `||` is the exact form `validRange` renders a union in.
 */
export function intersectDependencyRanges(ranges: readonly string[]): DependencyRangeIntersection {
  if (ranges.length === 0) {
    return { ok: true, range: WILDCARD };
  }

  const oversized = checkTotalInputSize(ranges);
  if (oversized !== undefined) {
    return oversized;
  }

  const split = splitEveryInput(ranges);
  if (!split.ok) {
    return split;
  }

  const overCapacity = checkProjectedConjuncts(split.branches);
  if (overCapacity !== undefined) {
    return overCapacity;
  }

  const conjuncts = split.branches.reduce((accumulated, next) => crossProduct(accumulated, next));
  const survivors = conjuncts.filter(isSatisfiableConjunct);
  if (survivors.length === 0) {
    return {
      ok: false,
      reason: "disjoint",
      detail: `no version satisfies all ${ranges.length} declared ranges`,
    };
  }

  return { ok: true, range: survivors.join(UNION) };
}

/**
 * Reports whether a range constrains nothing, so no candidate search is owed
 * for it.
 *
 * The test is canonicalization, not string identity. `validRange` collapses
 * every unconstrained spelling onto the same wildcard -- `*`, `x`, `>=0.0.0`,
 * and a conjunction of them -- so an intersection of two separately declared
 * wildcards reads as no constraint rather than as a range some repository then
 * has to be searched for. It lives here because what a range MEANS is this
 * module's question; a caller deriving it would be a second evaluator.
 */
export function isUnconstrainedRange(range: string): boolean {
  return validRange(range) === WILDCARD;
}

/**
 * Reports whether the version RECORDED for an installed plugin satisfies a
 * range.
 *
 * D-03-04: a recorded version with no real semver form -- this project's
 * PI-7 content-hash (`hash-<12hex>`) or git commit (`<12hex>`, GV-01) fallback --
 * runs through the SAME normalization ladder as any other candidate, with no
 * guard for those forms. The accepted risk is plain: coercion on a hexadecimal
 * string can extract a misleading digit run and produce a version that
 * unpredictably satisfies or fails a range. A guard here would be a divergence
 * of its own, so the risk is taken rather than papered over.
 *
 * A recorded version that normalizes to nothing satisfies no range.
 */
export function recordedVersionSatisfies(recorded: string, range: string): boolean {
  const normalized = valid(recorded) ?? coerce(recorded)?.version;
  return normalized !== undefined && satisfies(normalized, range);
}

/**
 * WR-1: the range that admits every version but `version`, or `undefined`
 * when `version` has no semver form a range can name.
 */
export function excludingRange(version: string): string | undefined {
  const exact = valid(version);
  return exact === null ? undefined : `<${exact} || >${exact}`;
}

/**
 * Bounds a text for a refusal as Claude Code bounds a range list (D-PL3-10):
 * at most `MAX_RENDERED_RANGE_CHARS`, cut before a quoted range the bound
 * would split, followed by `… (+N chars)` naming what was dropped.
 */
export function boundRenderedText(text: string): string {
  if (text.length <= MAX_RENDERED_RANGE_CHARS) {
    return text;
  }

  const head = text.slice(0, MAX_RENDERED_RANGE_CHARS);
  const open = head.lastIndexOf(OPEN_QUOTE);
  const kept = open > head.lastIndexOf(CLOSE_QUOTE) ? head.slice(0, open) : head;
  return `${kept}… (+${text.length - kept.length} chars)`;
}

/**
 * D-PL3-10: one range as Claude Code quotes it in a refusal. A valid
 * printable semver range shows as written; any other text shows in curly
 * quotes, its whitespace collapsed and cut to `MAX_QUOTED_RANGE_CHARS`.
 */
function quoteRange(range: string): string {
  if (/^[\x20-\x7e]+$/.test(range) && validRange(range) !== null) {
    return range;
  }

  const collapsed = range.replace(/\s+/g, " ").trim();
  return `${OPEN_QUOTE}${truncateForRefusal(collapsed, MAX_QUOTED_RANGE_CHARS)}${CLOSE_QUOTE}`;
}

/**
 * D-PL3-12: the UTF-16 code units Claude Code keeps of a version it quotes in
 * a refusal.
 */
export const MAX_REFUSAL_VERSION_CHARS = 64;

/**
 * D-PL3-09: the UTF-16 code units Claude Code keeps of each field of the
 * plugin directory pin refusal: the plugin name, the listed version, the
 * joined declared ranges, and each requirer's name.
 */
export const MAX_DIRECTORY_PIN_FIELD_CHARS = 120;

/**
 * Cuts `text` for a refusal as Claude Code cuts it (D-PL3-09, D-PL3-12):
 * at most `limit` UTF-16 code units, never ending on the high half of a
 * surrogate pair, followed by a single `…` when anything was cut.
 */
export function truncateForRefusal(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const last = text.codePointAt(limit - 1);
  const splitsSurrogatePair =
    last !== undefined && (last > 0xffff || (last >= 0xd800 && last <= 0xdbff));
  const kept = splitsSurrogatePair ? text.slice(0, limit - 1) : text.slice(0, limit);
  return `${kept}…`;
}

/**
 * INR-05: a dependency's declared ranges as a cause line shows them, each
 * quoted as Claude Code quotes it, joined with `, ` as Claude Code joins
 * them, so a `||` range keeps its meaning, and bounded once (D-PL3-10).
 */
export function renderDeclaredRanges(ranges: readonly string[]): string {
  return boundRenderedText(ranges.map(quoteRange).join(", "));
}
