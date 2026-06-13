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
// tilde expansion happens at access time (location/index.ts).
//
// ST-6: pathSource() / githubSource() factories are the SAME funnel used
// by both parse-time and state-load-time validation. Persistence layer
// calls these to revalidate stored records.
//
// SECURITY (T-02-03): the path branch deliberately accepts ANY string
// starting with `./`, `../`, `/`, or `~/` as a path. NFR-10 path-traversal
// containment is the responsibility of the bridges + `assertPathInside`.
// This parser is the syntactic gate; downstream containment checks are the
// semantic gate.

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
  readonly sha?: string;
}

export interface UrlSource {
  readonly kind: "url";
  readonly raw: string;
  readonly url: string;
  readonly ref?: string;
  readonly sha?: string;
}

export interface GitSubdirSource {
  readonly kind: "git-subdir";
  readonly raw: string;
  readonly url: string;
  readonly path: string;
  readonly ref?: string;
  readonly sha?: string;
}

export interface NpmSource {
  readonly kind: "npm";
  readonly raw: string;
  readonly package: string;
  readonly version?: string;
  readonly registry?: string;
}

export interface UnknownSource {
  readonly kind: "unknown";
  readonly raw: string;
  readonly reason: string; // human-readable; D-08 forward-compat tail
}

export type ParsedSource =
  | PathSource
  | GitHubSource
  | UrlSource
  | GitSubdirSource
  | NpmSource
  | UnknownSource;

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

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  return typeof obj[key] === "string" ? obj[key] : undefined;
}

function withOptionalSourceFields<T extends ParsedSource>(
  source: T,
  obj: Record<string, unknown>,
): T {
  const ref = optionalString(obj, "ref");
  const sha = optionalString(obj, "sha");
  return {
    ...source,
    ...(ref !== undefined && { ref }),
    ...(sha !== undefined && { sha }),
  };
}

function githubObjectSource(repo: string, obj: Record<string, unknown>): ParsedSource {
  const parsed = parsePluginSource(repo);
  if (parsed.kind !== "github") {
    return {
      kind: "unknown",
      raw: repo,
      reason: parsed.kind === "unknown" ? parsed.reason : `github source repo is not owner/repo`,
    };
  }

  return withOptionalSourceFields(parsed, obj);
}

function objectRaw(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

function unknownObjectSource(obj: Record<string, unknown>, reason: string): UnknownSource {
  return { kind: "unknown", raw: objectRaw(obj), reason };
}

function urlObjectSource(obj: Record<string, unknown>): ParsedSource {
  const url = optionalString(obj, "url");
  return url === undefined
    ? unknownObjectSource(obj, "url source is missing url")
    : withOptionalSourceFields({ kind: "url", raw: url, url }, obj);
}

function gitSubdirObjectSource(obj: Record<string, unknown>): ParsedSource {
  const url = optionalString(obj, "url");
  const subPath = optionalString(obj, "path");
  if (url === undefined || subPath === undefined) {
    return unknownObjectSource(obj, "git-subdir source is missing url or path");
  }

  return withOptionalSourceFields({ kind: "git-subdir", raw: url, url, path: subPath }, obj);
}

function npmObjectSource(obj: Record<string, unknown>): ParsedSource {
  const pkg = optionalString(obj, "package");
  if (pkg === undefined) {
    return unknownObjectSource(obj, "npm source is missing package");
  }

  const version = optionalString(obj, "version");
  const registry = optionalString(obj, "registry");
  return {
    kind: "npm",
    raw: pkg,
    package: pkg,
    ...(version !== undefined && { version }),
    ...(registry !== undefined && { registry }),
  };
}

function parseKindObjectSource(raw: Record<string, unknown>, kind: string): ParsedSource {
  switch (kind) {
    case "path": {
      const value = optionalString(raw, "raw") ?? optionalString(raw, "logical");
      return value === undefined
        ? unknownObjectSource(raw, "path source is missing raw")
        : pathSource(value);
    }

    case "github": {
      const value = optionalString(raw, "raw");
      return value === undefined
        ? unknownObjectSource(raw, "github source is missing raw")
        : githubObjectSource(value, raw);
    }

    case "url":
      return urlObjectSource(raw);

    case "git-subdir":
      return gitSubdirObjectSource(raw);

    case "npm":
      return npmObjectSource(raw);

    case "unknown":
      return {
        kind: "unknown",
        raw: typeof raw.raw === "string" ? raw.raw : JSON.stringify(raw),
        reason: typeof raw.reason === "string" ? raw.reason : "unknown source missing reason",
      };

    default:
      return unknownObjectSource(raw, `unrecognized source kind: ${kind}`);
  }
}

function parseDiscriminatorObjectSource(
  raw: Record<string, unknown>,
  discriminator: string,
): ParsedSource {
  switch (discriminator) {
    case "github": {
      const repo = optionalString(raw, "repo");
      return repo === undefined
        ? unknownObjectSource(raw, "github source is missing repo")
        : githubObjectSource(repo, raw);
    }

    case "url":
      return urlObjectSource(raw);

    case "git-subdir":
      return gitSubdirObjectSource(raw);

    case "npm":
      return npmObjectSource(raw);

    default:
      return unknownObjectSource(raw, `unrecognized source kind: ${discriminator}`);
  }
}

function parseObjectPluginSource(raw: Record<string, unknown>): ParsedSource {
  if (typeof raw.kind === "string") {
    return parseKindObjectSource(raw, raw.kind);
  }

  const discriminator = raw.source;
  if (typeof discriminator !== "string") {
    return unknownObjectSource(raw, "object source is missing source discriminator");
  }

  return parseDiscriminatorObjectSource(raw, discriminator);
}

export function parsePluginSource(raw: unknown): ParsedSource {
  if (typeof raw !== "string") {
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      return parseObjectPluginSource(raw as Record<string, unknown>);
    }

    return { kind: "unknown", raw: String(raw), reason: "source must be a string or object" };
  }

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
 * Compare a stored source record against a planned raw source string for
 * semantic equality.
 *
 * Both inputs are funnelled through `parsePluginSource` so the comparison
 * happens on the discriminated `ParsedSource` shape, not on raw strings.
 * Callers receive one of three tri-state results:
 *
 *   - `"same"` -- planned and stored describe the same source.
 *   - `"different"` -- recognised stored source, but different from the
 *     plan.
 *   - `"unknown-stored"` -- stored record is in an unrecognised format
 *     (e.g. manually edited `state.json`). The discriminant lets callers
 *     emit a meaningful diagnostic ("verify state.json or remove and
 *     re-add") rather than misclassifying the situation as a
 *     source-mismatch.
 *
 * The tri-state union (vs `boolean | "unknown-stored"`) closes a
 * truthy-coercion footgun: under the prior shape a bare
 * `if (samePlannedSource(...))` silently treated `"unknown-stored"` (a
 * corrupt record) as a source match. With the literal union the compiler
 * forces every caller to switch on the discriminant explicitly.
 *
 * Used by `orchestrators/import/execute.ts` (existing import path) and
 * `orchestrators/reconcile/plan.ts` (the pure planner foundation).
 * Lives in `domain/source.ts` so both callers import a leaf-pure helper
 * without pulling in either orchestrator's effectful transitive closure.
 */
export type SamePlannedSourceResult = "same" | "different" | "unknown-stored";

export function samePlannedSource(stored: unknown, plannedRaw: string): SamePlannedSourceResult {
  const planned = parsePluginSource(plannedRaw);
  const current = parsePluginSource(stored);

  // Treat unrecognized stored source as a special discriminant so callers
  // can emit a meaningful diagnostic rather than a generic source-mismatch.
  if (current.kind === "unknown") {
    return "unknown-stored";
  }

  if (planned.kind !== current.kind) {
    return "different";
  }

  switch (planned.kind) {
    case "github":
      return current.kind === "github" &&
        planned.owner === current.owner &&
        planned.repo === current.repo &&
        planned.ref === current.ref
        ? "same"
        : "different";
    case "path":
      return current.kind === "path" && planned.logical === current.logical ? "same" : "different";
    /* c8 ignore next 3 -- callers only generate path/github sources today */
    case "url":
    case "git-subdir":
    case "npm":
      return sourceLogical(planned) === sourceLogical(current) ? "same" : "different";
  }
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

    case "url": {
      const refSuffix = source.ref === undefined ? "" : `#${source.ref}`;
      return `${source.url}${refSuffix}`;
    }

    case "git-subdir": {
      const refSuffix = source.ref === undefined ? "" : `#${source.ref}`;
      return `${source.url}${refSuffix}/${source.path}`;
    }

    case "npm": {
      const versionSuffix = source.version === undefined ? "" : `@${source.version}`;
      return `npm:${source.package}${versionSuffix}`;
    }

    case "unknown":
      return source.raw;
  }
}
