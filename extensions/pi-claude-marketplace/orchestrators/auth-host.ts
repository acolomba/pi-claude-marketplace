/**
 * Host-keyed auth bundle factory (GAUTH-03, D-1-03, GHB-02).
 *
 * This module binds a git request to the host whose stored credential it
 * uses, and it holds no sign-in and no credential code (D-SG-27, D-SG-28).
 * `authBundleFor` gives EVERY clone address the bundle of its host: git asks
 * the user's credential helpers itself, a helper miss fails as git failed,
 * and a credential the host refuses fails as `StoredCredentialRejectedError`
 * and stays stored as far as this extension is concerned (GAUTH-04). No
 * command, load, or background pass shows a device code or waits for input.
 *
 * The bundle depends only on the address, so no verb passes a notification
 * context to get one. A GitHub address binds the override host while
 * `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set and github.com otherwise
 * (GHB-02). `NO_STORED_CREDENTIAL_CAUSE` is the GAUTH-04 hint line for a host
 * that gave git no credential.
 *
 * Gate discipline: this module imports no `platform/git*` module and names no
 * git surface, so BLOCK F in `eslint.config.js` lints it like any other
 * orchestrator module. It takes the bundle type from the
 * `orchestrators/marketplace/shared.ts` re-export and the GitHub base seam
 * from shared/github-base-url.ts.
 *
 * AUTH-09: no credential field is ever interpolated into an Error/notify here;
 * enforced by test/architecture/no-credential-leak.test.ts.
 */

import {
  GITHUB_HOST,
  gitHubAddressOf,
  gitHubOverrideHost,
  gitHubWireUrl,
} from "../shared/github-base-url.ts";

import type { GitBackedSource } from "../domain/source.ts";
import type { GitAuthBundle } from "./marketplace/shared.ts";

/**
 * Extract the host a clone URL's credential is bound to, per source kind.
 *
 * A `github` source canonicalizes to `https://github.com/<owner>/<repo>` (see
 * domain/source.ts), so it resolves to the override host when
 * `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set and to `GITHUB_HOST`
 * otherwise, without a URL parse; `cloneUrl` is unread on that arm (GHB-02).
 * A url or git-subdir address that `gitHubAddressOf` folds, any spelling of a
 * GitHub repository such as `git@github.com:<owner>/<repo>.git`, binds the
 * same host, because the base receives it too (D-09, D-SG-21, D-SG-23).
 * Every other address parses the host of the URL actually sent, which
 * INCLUDES the port (e.g. `gitlab.example.com:8443`), and never reads the
 * variable unless it has the exact prefix `https://github.com/`.
 *
 * D-SG-17: an address the URL parser refuses, such as the scp form
 * `git@host:path`, binds the host between its user and its `:`, so the call
 * never throws. An SSH request never uses a bundle (`platform/git.ts` gives
 * the bundle to https requests only), so this host only names a bundle that
 * no request consults.
 */
function hostFromCloneUrl(cloneUrl: string, kind: GitBackedSource["kind"]): string {
  if (kind === "github" || gitHubAddressOf(cloneUrl) !== undefined) {
    return gitHubOverrideHost() ?? GITHUB_HOST;
  }

  const wireUrl = gitHubWireUrl(cloneUrl);
  return URL.canParse(wireUrl) ? new URL(wireUrl).host : scpHost(wireUrl);
}

/** The host of an scp address: a bracketed IPv6 literal, or the text up to the first `:`. */
function scpHost(address: string): string {
  const afterUser = address.slice(address.indexOf("@") + 1);
  const end = afterUser.startsWith("[") ? afterUser.indexOf("]") + 1 : afterUser.indexOf(":");
  return end <= 0 ? afterUser : afterUser.slice(0, end);
}

/**
 * The cause line for a host whose only auth path is the user's git credential
 * helper (D-1-01, GAUTH-04). git consulted the helpers and got no usable
 * credential, so the line names the host and the command that stores one.
 * AUTH-09: it interpolates the host and nothing else.
 *
 * The remedy is the whole pipeline because `git credential approve` reads the
 * git-credential wire format from stdin: run bare it waits for input and stores
 * nothing. It feeds `protocol=https` + `host=` + `username=` + `password=` and
 * NO `path=` line, the attributes git's own lookup for an https request to the
 * host uses, so the entry the user stores is the one git finds next time.
 *
 * It says "obtained" rather than "stored" because git reports a helper miss,
 * a helper that failed or timed out, and a helper that printed no
 * username/password pair the same way. A user whose credential IS stored
 * behind a slow helper must not be told it is not there.
 */
export const NO_STORED_CREDENTIAL_CAUSE: (host: string) => string = (host) =>
  String.raw`no credential was obtained for ${host}; store one with: printf 'protocol=https\nhost=${host}\nusername=<user>\npassword=<token>\n\n' | git credential approve`;

/**
 * The auth bundle of a clone address: the bundle bound to the host
 * `hostFromCloneUrl` reads from `cloneUrl` and `kind` (GAUTH-03,
 * D-1-03, GHB-02). The bundle depends only on the address, so every command,
 * load, and background pass gets the same bundle for the same address. It
 * does no I/O. Like `hostFromCloneUrl`, it throws `InvalidGitHubBaseUrlError`
 * when it reads an invalid `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`.
 *
 * git asks the user's credential helpers itself, a helper miss fails as git
 * failed, and `platform/git.ts` maps a refused credential to
 * `StoredCredentialRejectedError` only for a request to the bundle's host
 * (GAUTH-04, D-1-03).
 */
export function authBundleFor(cloneUrl: string, kind: GitBackedSource["kind"]): GitAuthBundle {
  return { host: hostFromCloneUrl(cloneUrl, kind) };
}
