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
  PathSource | GitHubSource | UrlSource | GitSubdirSource | NpmSource | UnknownSource;

/**
 * The git-clonable source kinds (url / git-subdir / github): the sources that
 * materialize a plugin from a remote clone. One shared alias so consumers
 * (presence/materialize probes, clone seams, row builders) reference a single
 * name instead of re-declaring the three-member union.
 */
export type GitBackedSource = UrlSource | GitSubdirSource | GitHubSource;

/** Per-user tilde reject message (SP-4). */
const TILDE_USER_HINT = "per-user tilde (~user/...) is not supported; use ~/...";

/**
 * D-76-01: reject message for non-https URL schemes. Only `https://` URLs and
 * local paths are accepted; `http://`, `ssh://`, and `git@host:` scp-form each
 * name themselves so the diagnostic tells the user which scheme was rejected.
 */
function unsupportedUrlReason(raw: string): string {
  const scheme = rejectedScheme(raw);
  return `${raw} is not supported; ${scheme} URLs are rejected -- only https:// URLs and local paths are accepted`;
}

function rejectedScheme(raw: string): string {
  if (raw.startsWith("git@")) {
    return "git@host: scp-form";
  }

  if (raw.startsWith("http://")) {
    return "http://";
  }

  if (raw.startsWith("ssh://")) {
    return "ssh://";
  }

  return "this URL scheme";
}

/** MM-4: non-relative string sources -- the "fallthrough" reason. */
function nonRelativeReason(raw: string): string {
  return `non-relative string source ${raw} cannot be classified`;
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  return typeof obj[key] === "string" ? obj[key] : undefined;
}

/**
 * Clone-key / sha-version invariant (domain/clone-key.ts, domain/version.ts):
 * a git source's `sha` must be the FULL 40-hex commit sha -- `pluginCloneKey`
 * and `shaVersion` slice its first 12 chars unchecked.
 */
const FULL_SHA_RE = /^[0-9a-f]{40}$/i;

/**
 * Spread the manifest object's optional `ref` / `sha` onto a git-backed source
 * (the only kinds that carry them -- the constraint keeps path/npm/unknown
 * sources from smuggling the fields through the spread). `ref` is freeform (any
 * branch/tag name); `sha` must satisfy FULL_SHA_RE or it is DROPPED so the
 * source degrades to unpinned rather than mis-keying the clone cache or
 * emitting a `sha-<12hex>` version that fails SHA_VERSION_RE. A valid sha is
 * lowercased for the same reason (SHA_VERSION_RE is lowercase-only).
 */
function withOptionalSourceFields<T extends GitHubSource | UrlSource | GitSubdirSource>(
  source: T,
  obj: Record<string, unknown>,
): T {
  const ref = optionalString(obj, "ref");
  const rawSha = optionalString(obj, "sha");
  const sha = rawSha !== undefined && FULL_SHA_RE.test(rawSha) ? rawSha.toLowerCase() : undefined;
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

/**
 * D-76-01: put one field of a manifest-supplied url object through the same
 * syntactic gate the string form uses, so `http://`, `ssh://`, `git@host:`, a
 * relative path and a github browser URL are rejected whichever field carries
 * them. `PLUGIN_ENTRY_SCHEMA` types an entry's source as `unknown`, so a
 * third-party marketplace manifest controls every field of the object, and the
 * two fields `urlObjectSource` reads reach different consumers: `url` becomes
 * the cache identity `canonicalCloneUrl` returns, and `raw` becomes the wire url
 * `networkCloneUrl` hands to `gitOps`. Each one is gated on its own.
 * `urlObjectSource` then admits `raw` only when its parse-time identity equals
 * `url`'s (T-2-10).
 *
 * D-76-02: the gate's first arm sends a github.com url through the github
 * parser, so it normalizes to `github` kind (one canonical identity per repo;
 * Device Flow auth stays applicable) and a github url the parser rejects is
 * rejected here rather than falling through to a clonable `url` source.
 */
function gatedUrlField(
  obj: Record<string, unknown>,
  field: string,
): GitHubSource | UrlSource | UnknownSource {
  return parseUrlSourceForm(field) ?? unknownObjectSource(obj, nonRelativeReason(field));
}

function urlObjectSource(obj: Record<string, unknown>): ParsedSource {
  // D-76-01 / D-2-03: the identity derives from `url`, the parse-time
  // `.git`-stripped form that `canonicalCloneUrl` returns and `pluginCloneKey`
  // hashes, so a re-parse of a persisted source names the same
  // `plugin-clones/<hash>` directory as the parse that stored it.
  const url = optionalString(obj, "url");
  if (url === undefined) {
    return unknownObjectSource(obj, "url source is missing url");
  }

  const identity = gatedUrlField(obj, url);
  if (identity.kind === "unknown") {
    return identity;
  }

  // D-2-01 / D-2-03: `networkCloneUrl`'s `url` arm reads `raw`, so a stored
  // `raw` is carried onto the parsed source verbatim and keeps the `.git`
  // decision the user typed -- a decision `url` has already stripped. The
  // `github` arm builds its wire url from owner/repo and never reads `raw`, so
  // that kind keeps the `raw` its own parse produced.
  const raw = optionalString(obj, "raw");
  if (identity.kind !== "url" || raw === undefined) {
    return withOptionalSourceFields(identity, obj);
  }

  const gatedRaw = gatedUrlField(obj, raw);
  if (gatedRaw.kind === "unknown") {
    return gatedRaw;
  }

  // T-2-10: `url` picks the auth host and the shared clone directory and `raw`
  // picks what is fetched, so `raw` must parse to the identity `url` names.
  // D-2-05's decorations strip to that identity. The ref stays out because a
  // persisted record keeps it in its own field.
  if (gatedRaw.kind !== "url" || gatedRaw.url !== identity.url) {
    return unknownObjectSource(
      obj,
      `url source raw ${raw} does not name the same repository as url ${url}`,
    );
  }

  // The gate above decides only whether `raw` is admissible; the value carried
  // over is the manifest's own string, because the wire form is verbatim.
  return withOptionalSourceFields({ ...identity, raw }, obj);
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

/**
 * Local-path forms (SP-1, SP-4, SP-7). Returns undefined when `raw` is not a
 * path form, so the caller falls through to the URL and shorthand arms.
 */
function parsePathSourceForm(raw: string): ParsedSource | undefined {
  if (raw === "~" || raw.startsWith("~/")) {
    return { kind: "path", raw, logical: raw };
  }

  // SP-4: `~user/foo` and every other tilde form is rejected with a hint.
  if (raw.startsWith("~")) {
    return { kind: "unknown", raw, reason: TILDE_USER_HINT };
  }

  if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/")) {
    return { kind: "path", raw, logical: raw };
  }

  return undefined;
}

/**
 * URL forms. Returns undefined when `raw` carries no scheme, so the caller
 * falls through to the `owner/repo` shorthand arms.
 *
 * D-76-02: the github-host check MUST run BEFORE the generic-https arm so
 * github.com always normalizes to the `github` kind -- one canonical identity
 * per repo, and Device Flow auth stays applicable. The check folds the host the
 * way Claude Code recognizes github.com (`gitHubUrlPath`), so
 * `https://GitHub.com/o/r`, `https://www.github.com/o/r` and
 * `https://github.com:443/o/r` name the same repo as `https://github.com/o/r`.
 *
 * D-76-01: `http://`, `ssh://` and the `git@host:` scp form stay rejected.
 * Only `https://` URLs and local paths are accepted, so the reject must sit
 * AFTER both https arms.
 */
function parseUrlSourceForm(raw: string): GitHubSource | UrlSource | UnknownSource | undefined {
  const gitHubPath = gitHubUrlPath(raw);
  if (gitHubPath !== undefined) {
    return parseGitHubUrl(raw, gitHubPath);
  }

  // MURL-01 / D-76-01: any other https host is a generic `url` source.
  if (raw.startsWith("https://")) {
    return parseUrlSource(raw);
  }

  if (raw.startsWith("git@") || raw.includes("://")) {
    return { kind: "unknown", raw, reason: unsupportedUrlReason(raw) };
  }

  return undefined;
}

/**
 * The scheme-less `owner/repo` shorthands.
 *
 * D-76-04: `owner/repo@<ref>` folds into `github` plus a ref. The split is on
 * the LAST `@`, and the fold only happens when the left side is a valid
 * `owner/repo`. SP-5: a bare `owner/repo` is exactly one slash with both
 * halves non-empty. MM-4: anything else (`foo/bar/baz`, `foo`, the empty
 * string, whitespace) is unknown.
 */
function parseShorthandSourceForm(raw: string): ParsedSource {
  const atIdx = raw.lastIndexOf("@");
  if (atIdx !== -1) {
    const github = parseOwnerRepo(raw.slice(0, atIdx), raw);
    const ref = raw.slice(atIdx + 1);
    if (github.kind === "github" && ref.length > 0) {
      return { ...github, ref };
    }

    return { kind: "unknown", raw, reason: nonRelativeReason(raw) };
  }

  const slashCount = (raw.match(/\//g) ?? []).length;
  if (slashCount === 1) {
    return parseOwnerRepo(raw, raw);
  }

  return { kind: "unknown", raw, reason: nonRelativeReason(raw) };
}

export function parsePluginSource(raw: unknown): ParsedSource {
  if (typeof raw !== "string") {
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      return parseObjectPluginSource(raw as Record<string, unknown>);
    }

    return { kind: "unknown", raw: String(raw), reason: "source must be a string or object" };
  }

  // Arm order is load-bearing: paths, then URL schemes, then the scheme-less
  // shorthands as the catch-all.
  return parsePathSourceForm(raw) ?? parseUrlSourceForm(raw) ?? parseShorthandSourceForm(raw);
}

/**
 * D-76-04: parse a bare `owner/repo` candidate into a `GitHubSource`, echoing
 * `raw` (which may carry an `@ref` suffix the caller strips) as the verbatim
 * input. Returns `unknown` when the candidate is not exactly one non-empty
 * slash-separated pair.
 */
function parseOwnerRepo(candidate: string, raw: string): ParsedSource {
  const slashCount = (candidate.match(/\//g) ?? []).length;
  if (slashCount !== 1) {
    return { kind: "unknown", raw, reason: nonRelativeReason(raw) };
  }

  const [owner, repo] = candidate.split("/");
  if (!owner || !repo) {
    return { kind: "unknown", raw, reason: `${raw} owner/repo halves must be non-empty` };
  }

  return { kind: "github", raw, owner, repo };
}

/** Strip every trailing `/` from a URL or from a `#<ref>` fragment. */
function stripTrailingSlashes(input: string): string {
  let rest = input;
  while (rest.endsWith("/")) {
    rest = rest.slice(0, -1);
  }

  return rest;
}

/**
 * D-76-01: strip one trailing `.git` from a URL path. Shared by the two
 * parse-time identity compositions below, so `https://host/o/r.git` and
 * `https://host/o/r` name one source; the wire form does not call it, because it
 * keeps the suffix decision the user's own input made (D-2-01). Also shared
 * by the marketplace add guard's same-source recognition (D-3-01), which
 * strips a leftover clone's recorded origin before comparing it against
 * `canonicalCloneUrl`.
 */
export function stripGitSuffix(path: string): string {
  return path.endsWith(".git") ? path.slice(0, -".git".length) : path;
}

/**
 * Split an optional `#<ref>` fragment off a URL. SP-5: a fragment that is empty
 * once its own trailing slashes are stripped is dropped. The path half is
 * returned untouched, because whether a path's trailing slashes come off before
 * or after the split is the one point on which the three compositions below
 * differ, and each of them settles it for itself.
 */
function splitUrlFragment(input: string): { path: string; ref: string | undefined } {
  const hashIdx = input.indexOf("#");
  if (hashIdx === -1) {
    return { path: input, ref: undefined };
  }

  const frag = stripTrailingSlashes(input.slice(hashIdx + 1));
  return { path: input.slice(0, hashIdx), ref: frag.length > 0 ? frag : undefined };
}

/**
 * D-2-01 / D-2-03: the WIRE form of a `url` or `git-subdir` source, read by
 * `domain/clone-key.ts::networkCloneUrl`. Splits the `#<ref>` fragment off and
 * then strips the path's trailing slashes, so `https://host/o/r/#main` is sent
 * as `https://host/o/r`. A trailing `.git` is left alone, so the wire request
 * carries whatever suffix decision the user's own input made.
 */
export function stripSlashAndFragment(input: string): { base: string; ref: string | undefined } {
  const { path, ref } = splitUrlFragment(input);
  return { base: stripTrailingSlashes(path), ref };
}

/**
 * D-76-01 / D-2-05: the parse-time IDENTITY form of a generic `url` source.
 * Splits the `#<ref>` fragment off, strips the path's trailing slashes, then
 * strips one trailing `.git`. A slash sitting in front of a fragment carries no
 * meaning in a clone url, so it comes off and the identity of
 * `https://host/o/r/#main` is `https://host/o/r` -- the same value a re-parse of
 * the persisted source computes, which makes the identity a fixed point and
 * keeps the add and every later operation on one `plugin-clones/<hash>`
 * directory (D-2-05).
 *
 * D-2-03: this string is what `pluginCloneKey` and `pluginMirrorKey` hash, so
 * its composition order is pinned by `tests/domain/source.test.ts`'s identity
 * table. `stripSlashAndFragment` composes the same two steps in the same order
 * for the wire form and differs only in keeping `.git`; the two share no
 * composition, so a correction to the wire form cannot move the cache identity.
 */
function stripUrlDecorations(input: string): { base: string; ref: string | undefined } {
  const { path, ref } = splitUrlFragment(input);
  return { base: stripGitSuffix(stripTrailingSlashes(path)), ref };
}

/**
 * D-76-01: the parse-time IDENTITY form of a `https://github.com/<owner>/<repo>`
 * url, applied to the path that follows the host. Strips the whole input's
 * trailing slashes, then splits the `#<ref>` fragment, then strips one trailing
 * `.git`. Stripping before the split keeps a path slash that sits in front of a
 * fragment, so `o/r/#main` reaches `parseGitHubUrl`'s owner/repo validation as
 * the three-part `o/r/` and is rejected with the canonical-form diagnostic.
 *
 * D-2-03 / D-2-05: the slash normalization D-2-05 grants the `url` kind stops
 * here. A github source's identity is its `owner`/`repo` pair rather than a url
 * string, `canonicalCloneUrl` rebuilds that pair into one canonical url, and
 * widening what the owner/repo validation admits would move the accepted parse
 * surface rather than the identity of an accepted source.
 */
function stripGitHubUrlDecorations(input: string): { base: string; ref: string | undefined } {
  const { path, ref } = splitUrlFragment(stripTrailingSlashes(input));
  return { base: stripGitSuffix(path), ref };
}

/**
 * D-76-06: append the conventional `.git` suffix to a url that lacks one.
 *
 * `domain/clone-key.ts::networkCloneUrl` calls this only for the `github` arm,
 * appending `.git` where Claude Code appends it -- a `github.com` `owner/repo`
 * path -- and nowhere else. A `url` source's wire form preserves whatever
 * suffix decision the user's own input made (D-2-01).
 *
 * Accepted trade-off (D-2-02): a suffix-less URL does not resolve against a
 * host that serves ONLY the `.git`-suffixed smart-HTTP path. Verbatim means
 * verbatim in both directions, and the failure names the URL that was sent.
 */
export function ensureGitSuffix(url: string): string {
  return url.endsWith(".git") ? url : `${url}.git`;
}

/**
 * MURL-01 / D-76-01: parse a generic non-github `https://` source into a
 * `UrlSource`. Splits off an optional `#<ref>` fragment (empty fragment
 * dropped), strips the path's trailing slashes, then strips a single trailing
 * `.git`. Normalizing the `.git` suffix at parse time is the identity rule that
 * lets `sourceLogical` / `samePlannedSource` compare `https://host/repo.git` and
 * `https://host/repo` as the same source (D-76-01); normalizing the slash is
 * what makes that identity a fixed point across a persist-and-reload round trip
 * (D-2-05).
 */
function parseUrlSource(raw: string): UrlSource {
  const { base, ref } = stripUrlDecorations(raw);
  return ref === undefined ? { kind: "url", raw, url: base } : { kind: "url", raw, url: base, ref };
}

/**
 * D-76-02: the path after the host when `raw` is an `https://` url on
 * github.com, else undefined. The authority is the text between `https://` and
 * the first `/`, and a url with no `/` after it is not a github url. The
 * authority is folded the way Claude Code recognizes a github host: lowercased,
 * an explicit default `:443` port dropped, and every leading `www.` label
 * stripped. The scheme match stays case-sensitive, as Claude Code's does.
 *
 * A non-default port and userinfo (`user@`) are not folded, so an authority
 * carrying either never equals `github.com` and the url stays a generic `url`
 * source. The `github` kind rebuilds its wire url as
 * `https://github.com/<owner>/<repo>.git` from owner/repo, so it has nowhere to
 * keep a port or userinfo, and folding either would change where the clone goes.
 */
function gitHubUrlPath(raw: string): string | undefined {
  if (!raw.startsWith("https://")) {
    return undefined;
  }

  const rest = raw.slice("https://".length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) {
    return undefined;
  }

  let host = rest.slice(0, slashIdx).toLowerCase();
  if (host.endsWith(":443")) {
    host = host.slice(0, -":443".length);
  }

  while (host.startsWith("www.")) {
    host = host.slice("www.".length);
  }

  return host === "github.com" ? rest.slice(slashIdx + 1) : undefined;
}

/**
 * Parse a github.com url. `raw` is the verbatim input, echoed on the source and
 * in every diagnostic; `rest` is the path after the host (`gitHubUrlPath`).
 */
function parseGitHubUrl(raw: string, rest: string): GitHubSource | UnknownSource {
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

  // strip trailing slash, optional #<ref> fragment (SP-5: empty fragment
  // dropped), and optional .git suffix
  const { base, ref } = stripGitHubUrlDecorations(rest);

  // validate exactly owner/repo
  const parts = base.split("/");
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
    // MURL-06: url identity is `sourceLogical` equality, which is ref-aware
    // (the `#ref` suffix is appended) and .git-canonical (D-76-01 strips it at
    // parse time), so a config-declared url reconciles against its stored form
    // without a spurious remove-then-re-add. git-subdir/npm share the arm.
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
