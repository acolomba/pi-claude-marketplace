// domain/dependencies.ts
//
// The element parser for a plugin's `dependencies` field (DEPS-01, DEPS-02).
// The schema keeps that field `Type.Unknown()` on both the marketplace entry
// and the standalone manifest, so any shape can arrive and the parser accepts
// `unknown` at its boundary rather than a schema-derived type.
//
// Upstream declares two element shapes: a bare string (`name`,
// `name@marketplace`, either optionally suffixed `@^<range>`) and an object
// carrying `{name, marketplace?}` plus a `version` or `sha` read off the raw
// manifest (D-01-26, D-01-27). Both land in one `DeclaredDependency`, so a
// consumer renders or resolves a dependency without caring which shape
// declared it.
//
// D-01-20 puts the parse in `domain/` because it is pure: no I/O, no clock,
// and no knowledge of the marketplace that declared the array. Filling a
// missing marketplace in is the CALLER's concern -- `orchestrators/plugin/
// info.ts` fills in the declaring marketplace for display, and
// dependency-resolution work applies its own semantics to the same parsed
// shape.
//
// Every rendered field is matched against a positive allowlist before it
// leaves here (D-01-25, D-01-33). All four render verbatim into a
// line-oriented notification row, so admitting a newline or an escape would
// let manifest text forge a row. An element failing any allowlist is dropped
// whole -- never half-rendered with a constraint quietly removed (D-01-05).

/**
 * One usable element of a `dependencies` array.
 *
 * `marketplace` absent means the element declared no address; the caller
 * decides what that resolves to. `version` and `sha` are the two constraint
 * forms and may both be present.
 */
export interface DeclaredDependency {
  readonly name: string;
  readonly version?: string;
  readonly marketplace?: string;
  readonly sha?: string;
}

/**
 * Upstream's own dependency-token rule, verbatim (D-01-25). It admits no
 * control, bidi, ANSI, whitespace or quote character, and no `@`, which is
 * what makes the bare-string split below unambiguous.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9][-A-Za-z0-9._]*$/;

/**
 * Every semver range form upstream accepts -- `^1.0.0`, `~1.2`,
 * `>=1.0.0 <2.0.0`, `1.x`, `*`, `1.0.0-beta.1`, `1.0.0 || 2.0.0` (D-01-33).
 * The space and the pipe are admitted deliberately: rejecting them would
 * silently lose a compound range that upstream genuinely accepts.
 */
const VERSION_PATTERN = /^[A-Za-z0-9.\-+*~^<>=| ]+$/;

/** A git object name, at the widths D-01-30's short-form rendering assumes. */
const SHA_PATTERN = /^[0-9a-fA-F]{7,40}$/;

/** The `@^` that introduces a bare string's trailing range (D-01-27). */
const RANGE_MARKER = "@^";

/** The optional fields, each with the allowlist its value must match. */
const OPTIONAL_FIELDS = [
  ["marketplace", TOKEN_PATTERN],
  ["version", VERSION_PATTERN],
  ["sha", SHA_PATTERN],
] as const satisfies readonly (readonly [keyof DeclaredDependency, RegExp])[];

/** The four fields as they arrive, before any of them is known to be a string. */
interface RawFields {
  readonly name: unknown;
  readonly marketplace: unknown;
  readonly version: unknown;
  readonly sha: unknown;
}

/** The mutable shape assembled before it is returned as a `DeclaredDependency`. */
interface MutableDependency {
  name: string;
  marketplace?: string;
  version?: string;
  sha?: string;
}

/**
 * Copy the optional fields that were declared, and report whether the element
 * survives. Absent means not declared and is simply skipped; present but
 * unrenderable makes the whole element unusable (D-01-33).
 */
function applyOptionalFields(target: MutableDependency, fields: RawFields): boolean {
  for (const [key, pattern] of OPTIONAL_FIELDS) {
    const value = fields[key];
    if (value === undefined) {
      continue;
    }

    if (typeof value !== "string" || !pattern.test(value)) {
      return false;
    }

    target[key] = value;
  }

  return true;
}

/** Validate one element's four fields, or drop the element (D-01-05). */
function buildDependency(fields: RawFields): DeclaredDependency | undefined {
  if (typeof fields.name !== "string" || !TOKEN_PATTERN.test(fields.name)) {
    return undefined;
  }

  const dependency: MutableDependency = { name: fields.name };

  return applyOptionalFields(dependency, fields) ? dependency : undefined;
}

/**
 * The bare-string form, split in upstream's precedence order (D-01-27,
 * D-01-28): the optional trailing `@^<range>` first, then the optional
 * `@<marketplace>`, then whatever remains is the name. The caret stays part of
 * the range value.
 */
function parseStringElement(raw: string): DeclaredDependency | undefined {
  const rangeIdx = raw.indexOf(RANGE_MARKER);
  const address = rangeIdx === -1 ? raw : raw.slice(0, rangeIdx);
  const version = rangeIdx === -1 ? undefined : raw.slice(rangeIdx + 1);

  const atIdx = address.indexOf("@");
  if (atIdx === -1) {
    return buildDependency({ name: address, marketplace: undefined, version, sha: undefined });
  }

  return buildDependency({
    name: address.slice(0, atIdx),
    marketplace: address.slice(atIdx + 1),
    version,
    sha: undefined,
  });
}

/**
 * The object form. Four named keys are read off the widened record with
 * `=== undefined` absence tests; the record is never spread into the result,
 * so no crafted or inherited key can reach a `DeclaredDependency`.
 */
function parseObjectElement(raw: Record<string, unknown>): DeclaredDependency | undefined {
  return buildDependency({
    name: raw.name,
    marketplace: raw.marketplace,
    version: raw.version,
    sha: raw.sha,
  });
}

function parseElement(raw: unknown): DeclaredDependency | undefined {
  if (typeof raw === "string") {
    return parseStringElement(raw);
  }

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return parseObjectElement(raw as Record<string, unknown>);
  }

  return undefined;
}

/**
 * Parse a `dependencies` field into its usable elements, in declaration order.
 *
 * Anything that is not an array yields no entries. Unusable elements are
 * dropped silently -- this is a read-only surface and nothing here throws
 * (D-01-05). The result is neither sorted nor deduplicated: ordering (D-01-04)
 * and the last-wins collapse (D-01-31) are the caller's rules.
 */
export function parseDeclaredDependencies(raw: unknown): readonly DeclaredDependency[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: DeclaredDependency[] = [];
  for (const element of raw as readonly unknown[]) {
    const dependency = parseElement(element);
    if (dependency !== undefined) {
      parsed.push(dependency);
    }
  }

  return parsed;
}
