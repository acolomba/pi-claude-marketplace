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
// user name, password, query, or fragment, or the read throws
// `InvalidGitHubBaseUrlError`.

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

  return { url: `${base.origin}${pathname}`, host: base.host };
}

/**
 * Returns the URL to send for `url`. A URL that starts with the exact prefix
 * `https://github.com/` goes to the configured base when the variable is set:
 * `https://github.com/<owner>/<repo>.git` becomes `<base>/<owner>/<repo>.git`.
 * Any other URL, and every URL while the variable is unset, is returned
 * unchanged. The prefix match is case-sensitive and folds no host spelling,
 * like git's insteadOf.
 *
 * The variable is read only after the prefix matched, so a URL outside
 * github.com never reads or validates it.
 */
export function gitHubWireUrl(url: string): string {
  if (!url.startsWith(`${GITHUB_ORIGIN}/`)) {
    return url;
  }

  const base = readGitHubBase();
  return base === undefined ? url : `${base.url}${url.slice(GITHUB_ORIGIN.length)}`;
}

/**
 * GHB-02: returns the base's `host[:port]`, the host a GitHub credential is
 * bound to while the variable is set, or undefined when it is unset or empty.
 * WHATWG drops a default port and keeps IPv6 brackets, which is the form
 * `onAuth` compares. Like `gitHubWireUrl`, it reads the variable on every call
 * and throws `InvalidGitHubBaseUrlError` for an invalid value.
 */
export function gitHubOverrideHost(): string | undefined {
  return readGitHubBase()?.host;
}
