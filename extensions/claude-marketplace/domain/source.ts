// domain/source.ts
//
// Hand-written character-level source-string parser (D-06: TypeBox is not
// appropriate for character-level work). Discriminated `ParsedSource`
// union with literal-tagged variants -- TypeScript narrows automatically
// on `if (s.kind === 'path')` checks. Per D-08 / NFR-12, the `unknown`
// variant is the forward-compat tail: future source kinds become new
// branches; consumers that switch on `kind` get a static-exhaustiveness
// miss they can address.
//
// SP-7: PathSource.raw preserves the verbatim user input unchanged --
// tilde expansion happens at access time (Phase 4, location/index.ts).
//
// ST-6: pathSource() / githubSource() factories are the SAME funnel used
// by both parse-time and state-load-time validation. Persistence layer
// calls these to revalidate stored records.
//
// SECURITY (T-02-03): the path branch deliberately accepts ANY string
// starting with `./`, `../`, `/`, or `~/` as a path. NFR-10 path-traversal
// containment is the responsibility of Phase 3 bridges + Phase 1's
// `assertPathInside`. This parser is the syntactic gate; downstream
// containment checks are the semantic gate.

export interface PathSource {
  readonly kind: "path";
  readonly raw: string; // SP-7: verbatim user input, never mutated
  readonly logical: string; // currently equal to raw; reserved for future canonicalization
}

export interface GitHubSource {
  readonly kind: "github";
  readonly raw: string;
  readonly owner: string;
  readonly repo: string;
  readonly ref?: string; // optional, populated from `#<ref>` fragment
}

export interface UnknownSource {
  readonly kind: "unknown";
  readonly raw: string;
  readonly reason: string; // human-readable; D-08 forward-compat tail
}

export type ParsedSource = PathSource | GitHubSource | UnknownSource;

/** Per-user tilde reject message (SP-4). */
const TILDE_USER_HINT = "per-user tilde (~user/...) is not supported; use ~/...";

/** SSH/other-URL reject message (SP-3). */
function unsupportedUrlReason(raw: string): string {
  return `${raw} is not supported; only github URLs and local paths are accepted`;
}

/** owner/repo@<ref> reject message (SP-2). */
function ownerRepoAtRefReason(raw: string, atIdx: number): string {
  const owner = raw.slice(0, atIdx);
  const ref = raw.slice(atIdx + 1);
  return `${raw} uses unsupported owner/repo@<ref> form; use https://github.com/${owner}#${ref}`;
}

/** MM-4: non-relative string sources -- the "fallthrough" reason. */
function nonRelativeReason(raw: string): string {
  return `non-relative string source ${raw} cannot be classified`;
}

export function parsePluginSource(raw: string): ParsedSource {
  // path forms (SP-1, SP-7)
  if (raw === "~" || raw.startsWith("~/")) {
    return { kind: "path", raw, logical: raw };
  }

  // SP-4: ~user/foo (any other tilde form)
  if (raw.startsWith("~")) {
    return { kind: "unknown", raw, reason: TILDE_USER_HINT };
  }

  if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/")) {
    return { kind: "path", raw, logical: raw };
  }

  // GitHub HTTPS URL
  if (raw.startsWith("https://github.com/")) {
    return parseGitHubUrl(raw);
  }

  // SP-3: SSH and arbitrary URL schemes
  if (raw.startsWith("git@") || raw.includes("://")) {
    return { kind: "unknown", raw, reason: unsupportedUrlReason(raw) };
  }

  // SP-2: owner/repo@<ref> reject with hint
  const atIdx = raw.indexOf("@");
  if (atIdx !== -1) {
    return { kind: "unknown", raw, reason: ownerRepoAtRefReason(raw, atIdx) };
  }

  // SP-5: owner/repo -- exactly one slash, both halves non-empty
  const slashCount = (raw.match(/\//g) ?? []).length;
  if (slashCount === 1) {
    const [owner, repo] = raw.split("/");
    if (!owner || !repo) {
      return { kind: "unknown", raw, reason: `${raw} owner/repo halves must be non-empty` };
    }

    return { kind: "github", raw, owner, repo };
  }

  // MM-4: anything else (foo/bar/baz, foo, "", whitespace-only, etc.) is unknown
  return { kind: "unknown", raw, reason: nonRelativeReason(raw) };
}

function parseGitHubUrl(raw: string): ParsedSource {
  // strip prefix
  let rest = raw.slice("https://github.com/".length);

  // SP-3: browser-paste /tree/<ref> URL
  const treeIdx = rest.indexOf("/tree/");
  if (treeIdx !== -1) {
    const ownerRepo = rest.slice(0, treeIdx);
    const ref = rest.slice(treeIdx + "/tree/".length).replace(/\/$/, "");
    return {
      kind: "unknown",
      raw,
      reason: `${raw} is a browser URL; use https://github.com/${ownerRepo}#${ref} instead`,
    };
  }

  // strip trailing slash
  while (rest.endsWith("/")) {
    rest = rest.slice(0, -1);
  }

  // optional #<ref> fragment (SP-5: empty fragment dropped)
  let ref: string | undefined;
  const hashIdx = rest.indexOf("#");
  if (hashIdx !== -1) {
    const frag = rest.slice(hashIdx + 1);
    rest = rest.slice(0, hashIdx);
    if (frag.length > 0) {
      ref = frag;
    }
  }

  // strip optional .git suffix
  if (rest.endsWith(".git")) {
    rest = rest.slice(0, -".git".length);
  }

  // validate exactly owner/repo
  const parts = rest.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      kind: "unknown",
      raw,
      reason: `${raw} must be https://github.com/<owner>/<repo>[.git][#<ref>]`,
    };
  }

  const [owner, repo] = parts;
  return ref === undefined
    ? { kind: "github", raw, owner, repo }
    : { kind: "github", raw, owner, repo, ref };
}

/**
 * SP-6 / ST-6 factory: validate-or-throw for path sources (used at state-load
 * to revalidate stored records).
 */
export function pathSource(raw: string): PathSource {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Path source must be a non-empty string.");
  }

  return { kind: "path", raw, logical: raw };
}

/**
 * SP-6 / ST-6 factory: validate-or-throw for github sources (used at state-load).
 */
export function githubSource(raw: string): GitHubSource {
  const parsed = parsePluginSource(raw);
  if (parsed.kind !== "github") {
    const detail = parsed.kind === "unknown" ? parsed.reason : `wrong kind: ${parsed.kind}`;
    throw new Error(`Not a github source: ${raw} -- ${detail}`);
  }

  return parsed;
}

/**
 * ML-2 / list-format helper. Returns the user-visible logical source label
 * for the `marketplace list` renderer.
 *
 * - PathSource: returns `source.logical` (the verbatim user-typed path with
 *   `~` preserved per ST-6 / MA-4).
 * - GitHubSource: synthesizes the canonical `https://github.com/<owner>/<repo>[#<ref>]`
 *   URL; this matches PRD §5.1.3 ML-2 "logical" semantics for github sources.
 * - UnknownSource: falls back to `source.raw` so forward-compat source kinds
 *   list verbatim (the renderer's tolerance matches NFR-12).
 */
export function sourceLogical(source: ParsedSource): string {
  switch (source.kind) {
    case "path":
      return source.logical;

    case "github": {
      const refSuffix = source.ref === undefined ? "" : `#${source.ref}`;
      return `https://github.com/${source.owner}/${source.repo}${refSuffix}`;
    }

    case "unknown":
      return source.raw;
  }
}
