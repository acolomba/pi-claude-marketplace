// domain/dependency-closure.ts
//
// The dependency closure walk: given a root `plugin@marketplace` key, produce
// the post-ordered list of plugins that must be materialized to satisfy it, or
// the first reason the graph cannot be satisfied (RESV-02, RESV-04, RESV-05,
// D-03-08).
//
// The walk lives in `domain/` because it is pure: no I/O, no clock, no
// filesystem and no network. The catalog read arrives as a PARAMETER
// (`ClosureLookup`), so a caller decides where a plugin's declared
// `dependencies` come from and the walk itself stays trivially testable
// against a synthetic graph.
//
// D-03-11: the walk carries TWO structures with two different jobs, and
// conflating them is a correctness defect, not a style choice.
//
//   - `path` (an array) is the current recursion chain. It is pushed before
//     recursing into a member's children and popped only on the SUCCESS
//     return, so a failure abandons it mid-walk and the reported chain is the
//     full path. `path.includes(key)` is the ONLY cycle test.
//   - `visited` (a Set) is a memo. A key is added on first entry and never
//     removed, and a hit is a SUCCESS short-circuit that returns without
//     re-walking.
//
// A single set cannot tell "this key is its own ancestor" (a cycle) from "this
// key was already fully resolved on a sibling branch" (a legal diamond), so a
// one-set walk misreports every diamond as a cycle. Dropping the memo instead
// makes a layered graph re-walk exponentially.
//
// The post-order accumulator IS the install order -- a member is appended only
// after all of its children have been appended -- so no separate sort pass
// exists or is needed.
//
// D-03-10: the per-key range accumulator is seeded empty and fed ONLY by
// declarations encountered during THIS walk. It never scans unrelated
// installed plugins, so a constraint declared outside the graph being resolved
// cannot fail an install.
//
// The root is exempt from four guards: already-installed, install permission,
// marketplace-known, and catalog-absent. These are preconditions of the REQUESTED plugin, and
// the caller's materialization path owns them -- it resolves a marketplace
// across scopes in ways a pure walk over one snapshot cannot see, and it
// reports each miss against the right subject (the marketplace for an unadded
// one, the plugin row for a plugin its manifest does not declare). Enforcing
// them here would pre-empt that with a dependency-shaped verdict on a plugin
// that is nobody's dependency: an absent root would report `not-found` with no
// `requiredBy`, which is not a statement the arm can carry.

import {
  isRenderableDependencyToken,
  type DeclaredDependency,
  type parseDeclaredDependencies,
} from "./dependencies.ts";

/**
 * What a catalog read says about one `plugin@marketplace` key.
 *
 * `absent` means the key's marketplace was readable and does not declare the
 * plugin. `unusable` means the declaration was found but its `dependencies`
 * value could not be parsed; `detail` carries a field path, never untrusted
 * manifest text.
 */
export type ClosureLookupResult =
  | { readonly kind: "found"; readonly dependencies: readonly DeclaredDependency[] }
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly detail: string };

/**
 * A catalog read over a declaration already in hand. The `absent` arm names a
 * plugin its marketplace does not declare, which a reader that starts from the
 * plugin's own entry can never observe, so the arm is excluded from its type
 * rather than carried as a branch no test can reach.
 */
export type DeclarationLookupResult = Exclude<ClosureLookupResult, { readonly kind: "absent" }>;

/**
 * The plugin a catalog read is about.
 *
 * The two halves arrive already split and already allowlist-checked. A lookup
 * therefore never re-parses the key, and no reader has to carry a guard for a
 * shape the walk cannot produce.
 */
export interface ClosureSubject {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
}

/** Reads one plugin's declared dependencies. */
export type ClosureLookup = (subject: ClosureSubject) => Promise<ClosureLookupResult>;

/**
 * Maps a `parseDeclaredDependencies` result onto a catalog read result.
 *
 * It lives here rather than in each lookup implementation so the parse-failure
 * arm has ONE definition, and so a reader whose own source can never produce a
 * failure does not carry an arm its own tests cannot reach.
 */
export function toClosureLookupResult(
  parsed: ReturnType<typeof parseDeclaredDependencies>,
): DeclarationLookupResult {
  return parsed.ok
    ? { kind: "found", dependencies: parsed.dependencies }
    : { kind: "unusable", detail: parsed.reason };
}

/**
 * One plugin in the resolved graph.
 *
 * `requiredBy` is the key of the plugin whose declaration FIRST introduced this
 * member, and is `undefined` for the root. `ranges` carries every version range
 * declared for this member across the whole walk, in encounter order -- a
 * diamond's shared member therefore carries one entry per declaring branch.
 */
export interface ClosureMember {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly requiredBy: string | undefined;
  readonly ranges: readonly string[];
}

/** Root marketplace permission and target-scope records for an install walk. */
export interface DependencyInstallPolicy {
  readonly allowedMarketplaces: ReadonlySet<string>;
  readonly recordedKeys: ReadonlySet<string>;
}

/** Inputs of one closure resolution. */
export interface ResolveDependencyClosureOptions {
  readonly rootKey: string;
  readonly lookup: ClosureLookup;
  /** Keys already recorded in the target scope; a hit is skipped (RESV-05). */
  readonly installedKeys: ReadonlySet<string>;
  /** Marketplace names already added to the target scope (D-03-08). */
  readonly knownMarketplaces: ReadonlySet<string>;
  /** Omitted only for a traversal that cannot install new plugins. */
  readonly installPolicy?: DependencyInstallPolicy;
}

/**
 * The walk's outcome.
 *
 * `closure` is the install order, dependencies first and the root last.
 * `alreadyInstalled` names the members RESV-05 skipped; they carry their
 * accumulated ranges so a caller can still check them against a constraint,
 * and they are deliberately NOT part of `closure` -- nothing installs them and
 * nothing may roll them back.
 */
export type DependencyClosureResult =
  | {
      readonly ok: true;
      readonly closure: readonly ClosureMember[];
      readonly alreadyInstalled: readonly ClosureMember[];
    }
  | { readonly ok: false; readonly reason: "cycle"; readonly chain: readonly string[] }
  | {
      readonly ok: false;
      readonly reason: "marketplace-not-added";
      readonly key: string;
      readonly marketplace: string;
      readonly requiredBy: string;
    }
  | {
      readonly ok: false;
      readonly reason: "cross-marketplace";
      readonly key: string;
      readonly requiredBy: string;
      readonly marketplace: string;
      readonly rootMarketplace: string;
    }
  | {
      readonly ok: false;
      readonly reason: "not-found";
      readonly key: string;
      readonly requiredBy: string;
    }
  | {
      readonly ok: false;
      readonly reason: "unusable-declaration";
      readonly key: string;
      readonly detail: string;
    };

type ClosureFailure = Extract<DependencyClosureResult, { readonly ok: false }>;

/** The two halves of a `<plugin>@<marketplace>` key, each allowlist-checked. */
interface KeyParts {
  readonly name: string;
  readonly marketplace: string;
}

/**
 * The accumulating member record. `ranges` is mutated in place after the member
 * is appended to the post-order accumulator, which is what lets a diamond's
 * second edge contribute its constraint to a member the memo already resolved.
 */
interface MutableMember {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly requiredBy: string | undefined;
  readonly ranges: string[];
}

/**
 * One edge into a key: the key itself plus what the declaring side said. The
 * root's own entry has no declaring side.
 */
interface WalkEdge {
  readonly key: string;
  readonly parts: KeyParts;
  readonly requiredBy?: string;
  readonly range?: string;
}

/** An edge a declaration produced, so the declaring key is always known. */
interface DependencyEdge extends WalkEdge {
  readonly requiredBy: string;
}

/** Mutable walk state, allocated once per `resolveDependencyClosure` call. */
interface WalkContext {
  readonly options: ResolveDependencyClosureOptions;
  readonly rootMarketplace: string;
  readonly members: Map<string, MutableMember>;
  readonly path: string[];
  readonly visited: Set<string>;
  readonly order: MutableMember[];
  readonly skipped: MutableMember[];
}

/** A child edge, or the failure its declaration produced. */
type ChildEdge =
  | { readonly kind: "edge"; readonly edge: DependencyEdge }
  | { readonly kind: "failed"; readonly failure: ClosureFailure };

/**
 * Splits a key on its FIRST `@`. The dependency token alphabet admits no `@`, so
 * the split is unambiguous and both halves must still pass the allowlist --
 * every key reaching this module renders verbatim into a line-oriented row.
 */
function splitKey(key: string): KeyParts | undefined {
  const at = key.indexOf("@");
  if (at === -1) {
    return undefined;
  }

  const name = key.slice(0, at);
  const marketplace = key.slice(at + 1);
  if (!isRenderableDependencyToken(name)) {
    return undefined;
  }

  return isRenderableDependencyToken(marketplace) ? { name, marketplace } : undefined;
}

/**
 * Records the edge against its member, creating the member on first sight, and
 * appends the declared range.
 *
 * D-03-10: this runs BEFORE every guard, so a diamond's second edge still
 * contributes its constraint even though the memo short-circuits the walk.
 */
function recordEdge(ctx: WalkContext, edge: WalkEdge): MutableMember {
  const existing = ctx.members.get(edge.key);
  const member: MutableMember = existing ?? {
    key: edge.key,
    name: edge.parts.name,
    marketplace: edge.parts.marketplace,
    requiredBy: edge.requiredBy,
    ranges: [],
  };
  if (existing === undefined) {
    ctx.members.set(edge.key, member);
  }

  if (edge.range !== undefined) {
    member.ranges.push(edge.range);
  }

  return member;
}

/**
 * Builds the edge one declared dependency points at.
 *
 * RESV-02: a declaration that names no marketplace resolves in the DECLARING
 * plugin's marketplace; one that names a marketplace resolves there. The
 * filled-in value is re-checked against the token allowlist before it becomes
 * part of a key, so a caller-supplied declaring marketplace cannot smuggle an
 * unrenderable token into a row through the fill-in path.
 *
 * D-03-36: a declared `sha` is REFUSED rather than ignored. RESV-03 resolves a
 * dependency by version range only, so this walk has no way to honor a commit
 * pin -- and carrying the element through as if it declared no constraint would
 * install whatever ref the marketplace entry names while the declaring author
 * believes the dependency is pinned. That is the failure `domain/dependencies.ts`
 * refuses a half-parsed element to prevent: a constraint that disappears quietly
 * is worse than a declaration that is refused.
 */
function buildChildEdge(args: {
  readonly declaringKey: string;
  readonly declaringMarketplace: string;
  readonly index: number;
  readonly dependency: DeclaredDependency;
}): ChildEdge {
  if (args.dependency.sha !== undefined) {
    return {
      kind: "failed",
      failure: {
        ok: false,
        reason: "unusable-declaration",
        key: args.declaringKey,
        detail: `dependencies.${args.index}: sha pinning is not supported`,
      },
    };
  }

  const marketplace = args.dependency.marketplace ?? args.declaringMarketplace;
  if (!isRenderableDependencyToken(marketplace)) {
    return {
      kind: "failed",
      failure: {
        ok: false,
        reason: "unusable-declaration",
        key: args.declaringKey,
        detail: `dependencies.${args.index}: unrenderable marketplace`,
      },
    };
  }

  return {
    kind: "edge",
    edge: {
      key: `${args.dependency.name}@${marketplace}`,
      parts: { name: args.dependency.name, marketplace },
      requiredBy: args.declaringKey,
      ...(args.dependency.version === undefined ? {} : { range: args.dependency.version }),
    },
  };
}

/** Walks one plugin's declared dependencies in declaration order. */
async function walkChildren(
  ctx: WalkContext,
  declaringKey: string,
  declaringMarketplace: string,
  dependencies: readonly DeclaredDependency[],
): Promise<ClosureFailure | undefined> {
  for (const [index, dependency] of dependencies.entries()) {
    const child = buildChildEdge({ declaringKey, declaringMarketplace, index, dependency });
    if (child.kind === "failed") {
      return child.failure;
    }

    const failure = await walkDependencyEdge(ctx, child.edge);
    if (failure !== undefined) {
      return failure;
    }
  }

  return undefined;
}

/**
 * Records a declared edge, then applies dependency-only guards before walking
 * it. With `walkEdge`'s pair this is the guard chain, in load-bearing order:
 * already-installed -> root permission -> marketplace-known -> cycle -> memo.
 *
 * RESV-05 precedes D-03-08 deliberately: a dependency that is already
 * installed is skipped BEFORE its marketplace is checked, which is what keeps a
 * previously-installed plugin whose marketplace has since been removed from
 * failing the cascade.
 *
 * An edge back to the root is exempt from both, exactly as the root's own
 * entry is; `walkEdge` then reports it as the cycle it is.
 */
async function walkDependencyEdge(
  ctx: WalkContext,
  edge: DependencyEdge,
): Promise<ClosureFailure | undefined> {
  const member = recordEdge(ctx, edge);
  const isRoot = edge.key === ctx.options.rootKey;
  if (!isRoot && ctx.options.installedKeys.has(edge.key)) {
    if (!ctx.skipped.includes(member)) {
      ctx.skipped.push(member);
    }

    return undefined;
  }

  const policy = ctx.options.installPolicy;
  if (
    !isRoot &&
    policy !== undefined &&
    !policy.recordedKeys.has(edge.key) &&
    edge.parts.marketplace !== ctx.rootMarketplace &&
    !policy.allowedMarketplaces.has(edge.parts.marketplace)
  ) {
    return {
      ok: false,
      reason: "cross-marketplace",
      key: edge.key,
      requiredBy: edge.requiredBy,
      marketplace: edge.parts.marketplace,
      rootMarketplace: ctx.rootMarketplace,
    };
  }

  if (!isRoot && !ctx.options.knownMarketplaces.has(edge.parts.marketplace)) {
    return {
      ok: false,
      reason: "marketplace-not-added",
      key: edge.key,
      marketplace: edge.parts.marketplace,
      requiredBy: edge.requiredBy,
    };
  }

  return walkEdge(ctx, edge, member);
}

/**
 * Walks one edge -- the recursive step -- and returns the first failure, or
 * `undefined` once this key and everything below it is resolved.
 *
 * The two guards here apply to the root and to a declared dependency alike:
 * cycle, then memo. `path.includes` is the ONLY cycle test and `visited` the
 * ONLY memo (D-03-11), and the cycle test runs first because a key on its own
 * ancestor chain is in the memo too.
 *
 * `path.pop()` runs on the success return only: a failure abandons the stack
 * mid-walk, which is what lets the cycle arm report the whole chain.
 */
async function walkEdge(
  ctx: WalkContext,
  edge: WalkEdge,
  member: MutableMember,
): Promise<ClosureFailure | undefined> {
  if (ctx.path.includes(edge.key)) {
    return { ok: false, reason: "cycle", chain: [...ctx.path, edge.key] };
  }

  if (ctx.visited.has(edge.key)) {
    return undefined;
  }

  ctx.visited.add(edge.key);
  const looked = await ctx.options.lookup({
    key: edge.key,
    name: edge.parts.name,
    marketplace: edge.parts.marketplace,
  });
  if (looked.kind === "unusable") {
    return { ok: false, reason: "unusable-declaration", key: edge.key, detail: looked.detail };
  }

  // The root's entry is the only edge with no declaring side, and an edge back
  // to the root never reaches this point (the cycle guard reports it first), so
  // this is the root's catalog-absent exemption.
  if (looked.kind === "absent" && edge.requiredBy !== undefined) {
    return { ok: false, reason: "not-found", key: edge.key, requiredBy: edge.requiredBy };
  }

  ctx.path.push(edge.key);
  const dependencies = looked.kind === "found" ? looked.dependencies : [];
  const failure = await walkChildren(ctx, edge.key, edge.parts.marketplace, dependencies);
  if (failure !== undefined) {
    return failure;
  }

  ctx.path.pop();
  ctx.order.push(member);
  return undefined;
}

/**
 * Resolves the closure of `rootKey`, or reports the first reason it cannot be
 * resolved.
 *
 * Pure and network-free: every catalog read goes through `options.lookup`, and
 * the walk mutates nothing the caller handed in.
 */
export async function resolveDependencyClosure(
  options: ResolveDependencyClosureOptions,
): Promise<DependencyClosureResult> {
  const rootParts = splitKey(options.rootKey);
  if (rootParts === undefined) {
    return {
      ok: false,
      reason: "unusable-declaration",
      key: options.rootKey,
      detail: "root: expected <plugin>@<marketplace>",
    };
  }

  const ctx: WalkContext = {
    options,
    rootMarketplace: rootParts.marketplace,
    members: new Map(),
    path: [],
    visited: new Set(),
    order: [],
    skipped: [],
  };

  const root: WalkEdge = { key: options.rootKey, parts: rootParts };
  const failure = await walkEdge(ctx, root, recordEdge(ctx, root));

  return failure ?? { ok: true, closure: ctx.order, alreadyInstalled: ctx.skipped };
}
