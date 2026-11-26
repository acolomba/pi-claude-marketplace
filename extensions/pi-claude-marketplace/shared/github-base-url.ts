// shared/github-base-url.ts
//
// GHB-01 / D-MF-01: when PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL is set, every
// `https://github.com/` URL the extension sends goes to the base instead, like
// `git config url.<base>.insteadOf https://github.com/`. Nothing recorded
// changes: clone identity, cache keys, recorded origins, and output stay in
// github.com terms. Only the URL on the wire follows the base.
//
// GHB-03: the module reads the environment on every call and holds no state.
// An empty value counts as unset. A set value must be an https URL with no
// user name, password, query, fragment, or `=`, or the read throws
// `InvalidGitHubBaseUrlError`.
//
// D-SG-16: system git gets the base as the config pair
// `url.<base>/.insteadOf=https://github.com/` on every remote command. git
// splits a `-c` pair at its first `=`, so a base holding one would build a
// different key, the rewrite would not apply, and the request would go to the
// real github.com. That is why `=` is refused.
//
// D-SG-21: the base also covers every other spelling of a GitHub repository,
// SSH forms included, and git's `ssh+git://` alias, which the identity fold
// below leaves out. Such an address gets its own pair, whose prefix is the
// address's text before `owner/repo`, because git's insteadOf is a
// case-sensitive prefix match.
//
// D-SG-23: `gitHubAddressOf` folds every spelling of a GitHub repository to
// one lower-cased `owner/repo`, as Claude Code does. It lives here, beside the
// only github.com literals, because the pairs above need it and `shared/` and
// `platform/` import only each other. Identity comparisons in the domain read
// it; cache keys never do.

import { InvalidGitHubBaseUrlError } from "./errors.ts";

const GITHUB_BASE_URL_VARIABLE = "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL";

/**
 * The host of every GitHub source while the variable is unset. The github.com
 * host literal lives in this module only, so the D-06 literal rule has one
 * exempt module.
 */
export const GITHUB_HOST = "github.com";

/**
 * The canonical origin of every GitHub source. `canonicalCloneUrl` builds
 * clone identities from it and `gitHubWireUrl` matches it, so the identity and
 * the rewrite prefix cannot drift apart.
 */
export const GITHUB_ORIGIN = `https://${GITHUB_HOST}`;

/**
 * The base with every trailing slash removed, and its WHATWG `host` (with a
 * non-default port), or undefined when the variable is unset or empty.
 */
function readGitHubBase(): { url: string; host: string } | undefined {
  const value = process.env[GITHUB_BASE_URL_VARIABLE];
  if (value === undefined || value === "") {
    return undefined;
  }

  if (!URL.canParse(value)) {
    throw new InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, "not-a-url");
  }

  const base = new URL(value);
  if (base.protocol !== "https:") {
    throw new InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, "scheme");
  }

  if (base.username !== "" || base.password !== "") {
    throw new InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, "userinfo");
  }

  // `href` and not `hash` or `search`: WHATWG reports both as empty for a bare
  // trailing `#` or `?`, which the base must still refuse.
  if (base.href.includes("#")) {
    throw new InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, "fragment");
  }

  if (base.href.includes("?")) {
    throw new InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, "query");
  }

  let pathname = base.pathname;
  while (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  const url = `${base.origin}${pathname}`;
  if (url.includes("=")) {
    throw new InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, "equals-sign");
  }

  return { url, host: base.host };
}

/** The span of an address that holds its repository path. */
interface PathSpan {
  readonly start: number;
  readonly end: number;
}

const SCHEME_SEPARATOR = "://";

/** The protocols whose addresses fold, as Claude Code lists them; `ssh+git:` is not one. */
const FOLDING_PROTOCOLS: ReadonlySet<string> = new Set([
  "https:",
  "http:",
  "git:",
  "git+https:",
  "git+http:",
  "git+ssh:",
  "ssh:",
]);

/** The protocols whose GitHub host may also be GitHub's SSH host. */
const SSH_HOST_PROTOCOLS: ReadonlySet<string> = new Set(["ssh:", "git+ssh:"]);

/** GitHub's SSH host on port 443. */
const GITHUB_SSH_HOST = `ssh.${GITHUB_HOST}`;

const WWW_LABEL = "www.";

/** Claude Code's `owner/repo` pattern. */
const OWNER_REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;

const GIT_SUFFIX = ".git";

const FIRST_PRINTABLE_ASCII = 0x20;

const LAST_PRINTABLE_ASCII = 0x7e;

/**
 * T-04-09: whether `address` holds a character that can make two readers see
 * two hosts: a control or non-ASCII character, `%00`, a square bracket, or a
 * backslash. Claude Code refuses these where they can mislead a parser. A
 * GitHub address never needs one, so the fold refuses them anywhere.
 */
function hasMisleadingCharacter(address: string): boolean {
  for (let index = 0; index < address.length; index++) {
    const code = address.charCodeAt(index);
    if (code < FIRST_PRINTABLE_ASCII || code > LAST_PRINTABLE_ASCII) {
      return true;
    }
  }

  return ["%00", "[", "]", "\\"].some((text) => address.includes(text));
}

/** `host` lower-cased, with its trailing dots and every leading `www.` removed. */
function normalizedHost(host: string): string {
  let normalized = host.toLowerCase();
  while (normalized.endsWith(".")) {
    normalized = normalized.slice(0, -1);
  }

  while (normalized.startsWith(WWW_LABEL)) {
    normalized = normalized.slice(WWW_LABEL.length);
  }

  return normalized;
}

/** Whether `host` is github.com, or GitHub's SSH host when `allowSshHost` is set. */
function isGitHubHost(host: string, allowSshHost: boolean): boolean {
  const normalized = normalizedHost(host);
  return normalized === GITHUB_HOST || (allowSshHost && normalized === GITHUB_SSH_HOST);
}

/** The index of the first of `characters` in `text` at or after `from`, or -1. */
function indexOfAny(text: string, characters: string, from: number): number {
  for (let index = from; index < text.length; index++) {
    if (characters.includes(text.charAt(index))) {
      return index;
    }
  }

  return -1;
}

/**
 * The repository path of a `scheme://` address with a GitHub host: what
 * follows the `/` after the authority, up to a `?` or `#`. A `%` in the
 * written host is refused, because WHATWG decodes it and git does not.
 */
function urlPathSpan(address: string, separator: number): PathSpan | undefined {
  if (!URL.canParse(address)) {
    return undefined;
  }

  const url = new URL(address);
  if (
    !FOLDING_PROTOCOLS.has(url.protocol) ||
    !isGitHubHost(url.hostname, SSH_HOST_PROTOCOLS.has(url.protocol))
  ) {
    return undefined;
  }

  const authorityStart = separator + SCHEME_SEPARATOR.length;
  const authorityEnd = indexOfAny(address, "/?#", authorityStart);
  const authority = address.slice(authorityStart, authorityEnd);
  const writtenHost = authority.slice(authority.lastIndexOf("@") + 1);
  if (address.charAt(authorityEnd) !== "/" || writtenHost.includes("%")) {
    return undefined;
  }

  const queryStart = indexOfAny(address, "?#", authorityEnd + 1);
  return { start: authorityEnd + 1, end: queryStart === -1 ? address.length : queryStart };
}

/**
 * The repository path of an scp address `[user@]host:path` with a GitHub
 * host: what follows the `:`, less one leading `/`. The text before the `:`
 * holds no `/`, and an `@` after the `:` is refused.
 */
function scpPathSpan(address: string): PathSpan | undefined {
  const colon = address.indexOf(":");
  const at = address.indexOf("@");
  const head = address.slice(0, colon);
  const host = head.slice(at + 1);
  if (colon === -1 || at > colon || head.includes("/") || host.includes("%")) {
    return undefined;
  }

  if (!isGitHubHost(host, true)) {
    return undefined;
  }

  const start = address.charAt(colon + 1) === "/" ? colon + 2 : colon + 1;
  return { start, end: address.length };
}

/** `path` less one trailing `/` and then one `.git` in any case. */
function repositoryPath(path: string): string {
  const unslashed = path.endsWith("/") ? path.slice(0, -1) : path;
  return unslashed.toLowerCase().endsWith(GIT_SUFFIX)
    ? unslashed.slice(0, -GIT_SUFFIX.length)
    : unslashed;
}

/**
 * D-SG-23: the GitHub repository `address` names, a port of Claude Code's
 * fold. A `scheme://` address folds when its protocol is one of
 * `FOLDING_PROTOCOLS`, its host is github.com (also ssh.github.com for `ssh:`
 * and `git+ssh:`) in any case, with every leading `www.` and trailing dot
 * removed, and a `/` follows its authority. An scp address
 * `[user@]host:path` folds when its host is github.com or ssh.github.com. The
 * path, less one trailing `/` and one `.git`, must be an `owner/repo` that
 * does not end in `/.` or `/..`. Anything else, a bare `owner/repo` included,
 * is undefined.
 *
 * `repository` is that `owner/repo` lower-cased, and `prefix` is the exact
 * address text before its first character.
 */
export function gitHubAddressOf(
  address: string,
): { readonly prefix: string; readonly repository: string } | undefined {
  if (hasMisleadingCharacter(address)) {
    return undefined;
  }

  const separator = address.indexOf(SCHEME_SEPARATOR);
  const span = separator === -1 ? scpPathSpan(address) : urlPathSpan(address, separator);
  if (span === undefined) {
    return undefined;
  }

  const path = repositoryPath(address.slice(span.start, span.end));
  if (!OWNER_REPOSITORY.test(path) || path.endsWith("/.") || path.endsWith("/..")) {
    return undefined;
  }

  return { prefix: address.slice(0, span.start), repository: path.toLowerCase() };
}

/** git's `ssh+git:` alias of `ssh:`, which Claude Code's fold leaves out. */
const SSH_GIT_ALIAS = /^ssh\+git:/i;

const SSH_PROTOCOL = "ssh:";

/**
 * D-SG-21: the rewrite prefix of an `ssh+git://` address of a GitHub
 * repository. git reaches it over ssh, as it reaches the `ssh://` address
 * that the same text with `ssh:` names, so it reaches the base too. The
 * identity fold keeps `ssh+git:` out at parity with Claude Code; only the
 * rewrite reads it.
 */
function sshGitAliasPrefix(url: string): string | undefined {
  const alias = SSH_GIT_ALIAS.exec(url)?.[0];
  if (alias === undefined) {
    return undefined;
  }

  const folded = gitHubAddressOf(`${SSH_PROTOCOL}${url.slice(alias.length)}`);
  return folded === undefined
    ? undefined
    : url.slice(0, folded.prefix.length - SSH_PROTOCOL.length + alias.length);
}

/**
 * The text a base rewrite replaces in `url`: the exact prefix
 * `https://github.com/`, the prefix of any other GitHub spelling that
 * `gitHubAddressOf` folds, or that of an `ssh+git://` GitHub address
 * (D-SG-21). Undefined for every other URL.
 */
function gitHubRewritePrefix(url: string): string | undefined {
  const canonicalPrefix = `${GITHUB_ORIGIN}/`;
  if (url.startsWith(canonicalPrefix)) {
    return canonicalPrefix;
  }

  return gitHubAddressOf(url)?.prefix ?? sshGitAliasPrefix(url);
}

/**
 * Returns the URL to send for `url`. A GitHub URL, one with the exact prefix
 * `https://github.com/` or any spelling `gitHubAddressOf` folds, goes to the
 * configured base when the variable is set: its rewrite prefix becomes
 * `<base>/`, so `git@github.com:<owner>/<repo>.git` becomes
 * `<base>/<owner>/<repo>.git`. Any other URL, and every URL while the
 * variable is unset, is returned unchanged.
 *
 * The variable is read only after the URL matched, so a URL outside GitHub
 * never reads or validates it.
 */
export function gitHubWireUrl(url: string): string {
  const prefix = gitHubRewritePrefix(url);
  if (prefix === undefined) {
    return url;
  }

  const base = readGitHubBase();
  return base === undefined ? url : `${base.url}/${url.slice(prefix.length)}`;
}

/**
 * D-SG-16, D-SG-21: the `-c` pairs a git remote command needs to reach `url`:
 * the one pair `url.<base>/.insteadOf=<prefix>` when `url` is a GitHub URL
 * and the variable is set, else none. The prefix is `url`'s own rewrite
 * prefix: `https://github.com/` for the canonical form, and for instance
 * `git@github.com:` for an scp address, so it may hold `:`. git then sends
 * the request to the base and keys its credential by the base's host
 * (GHB-02), while the recorded origin stays the URL as written.
 *
 * Like `gitHubWireUrl`, the variable is read only after the URL matched, so a
 * URL outside GitHub never reads or validates it (GHB-04).
 */
export function gitHubInsteadOfPairs(url: string): readonly string[] {
  const prefix = gitHubRewritePrefix(url);
  if (prefix === undefined) {
    return [];
  }

  const base = readGitHubBase();
  return base === undefined ? [] : [`url.${base.url}/.insteadOf=${prefix}`];
}

/**
 * GHB-02: returns the base's `host[:port]`, the host a GitHub credential is
 * bound to while the variable is set, or undefined when it is unset or empty.
 * WHATWG drops a default port and keeps IPv6 brackets, which is the form a
 * stored credential's host takes. Like `gitHubWireUrl`, it reads the
 * variable on every call
 * and throws `InvalidGitHubBaseUrlError` for an invalid value.
 */
export function gitHubOverrideHost(): string | undefined {
  return readGitHubBase()?.host;
}
