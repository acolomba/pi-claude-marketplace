/**
 * Host-keyed auth bundle factory (GAUTH-03, D-1-03, GHB-02).
 *
 * This module binds a git request to the host whose stored credential it
 * uses, and it holds no sign-in (D-SG-27). EVERY host gets a
 * `stored-credential` bundle from `buildStoredCredentialAuth`: git asks the
 * user's credential helpers itself, a helper miss fails as git failed, and a
 * credential the host refuses fails as `StoredCredentialRejectedError` and
 * stays stored as far as this extension is concerned (GAUTH-04, D-SG-28). No
 * command, load, or background pass shows a device code or waits for input.
 *
 * `authBundleFor` gives a clone address its bundle: the marketplace add,
 * update, and PUP-2 sync, fetch, and `info --fetch` call it, and the install,
 * dependency, and update probes still reach `buildCloneAuth`, which binds the
 * same host. A GitHub address binds the override host while
 * `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set and github.com otherwise
 * (GHB-02).
 *
 * Gate discipline: this module lives in the orchestrator tier but MUST NOT
 * name `gitOps` / `DEFAULT_GIT_OPS` or import `platform/git.ts` as a VALUE --
 * only `import type` from platform/git.ts is permitted -- so consumers
 * (install-outcome.ts) that import it stay clean under BLOCK F in
 * `eslint.config.js`. It imports the credential surface with the bundle type
 * (platform/git-credential.ts) and the GitHub base seam
 * (shared/github-base-url.ts).
 *
 * AUTH-09: no credential field is ever interpolated into an Error/notify here;
 * enforced by test/architecture/no-credential-leak.test.ts.
 */

import { NODE_CREDENTIAL_GIT, createCredentialOps } from "../platform/git-credential.ts";
import {
  GITHUB_HOST,
  gitHubAddressOf,
  gitHubOverrideHost,
  gitHubWireUrl,
} from "../shared/github-base-url.ts";

import type { GitBackedSource } from "../domain/source.ts";
import type { CredentialOps, GitAuthBundle } from "../platform/git-credential.ts";
import type { NotificationContext } from "../platform/pi-api.ts";
import type { NotificationRun } from "../shared/notification-run.ts";

// Re-export the credential type the network-gated plugin orchestrators still
// name: the clone and tag probes and the internal auth contexts type their
// `credentialOps` with it until the builders stop taking one (D-SG-27). Those
// files MUST NOT import from `platform/git.ts` or `platform/git-credential.ts`
// directly -- BLOCK F in `eslint.config.js` rejects any `platform/git` import,
// even type-only -- so this gate-clean module is their single sanctioned
// source for it (T-79-10).
export type { CredentialOps };

/** How long a `git credential` subprocess may run before its process tree is stopped. */
const CREDENTIAL_TIMEOUT_MS = 5_000;

/**
 * The production credential surface every verb defaults to: the platform
 * credential protocol bound to its production git process and the timeout
 * above.
 *
 * It is composed HERE rather than inside `platform/git-credential.ts` so that
 * module publishes only the protocol, its collaborators, and their production
 * bindings, and the one concrete composition lives with the other host-keyed
 * auth composition. This module reaches git only through
 * `NODE_CREDENTIAL_GIT`, which runs `git credential fill/approve/reject` and
 * nothing else, because only `platform/git.ts` and
 * `platform/git-credential.ts` may import `platform/git-process.ts` (D-SG-01,
 * WR-05).
 * The call builds three closures and launches nothing; the first subprocess
 * starts when a verb actually calls fill/approve/reject.
 */
export const DEFAULT_CREDENTIAL_OPS: CredentialOps = createCredentialOps({
  git: NODE_CREDENTIAL_GIT,
  timeoutMs: CREDENTIAL_TIMEOUT_MS,
});

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
export function hostFromCloneUrl(cloneUrl: string, kind: GitBackedSource["kind"]): string {
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
 * helper (D-1-01, GAUTH-04). The helper was consulted and produced no usable
 * credential, so the line names the host and the command that stores one.
 * AUTH-09: it interpolates the host and nothing else.
 *
 * The remedy is the whole pipeline because `git credential approve` reads the
 * git-credential wire format from stdin: run bare it waits for input and stores
 * nothing. It must also be fed the attribute set `buildAttributeBlock` uses --
 * `protocol=https` + `host=` + `username=` + `password=`, and NO `path=` line
 * (`platform/git-credential.ts`) -- or a later `fill` looks under a different
 * keychain key and misses the entry the user just stored.
 *
 * It says "obtained" rather than "stored" because `credentialFill` collapses
 * five outcomes to `null` (`platform/git-credential.ts`): a genuine helper
 * miss, `git` absent from PATH, the credential-subprocess timeout, a non-zero
 * helper exit, and an exit-0 helper that emitted no username/password pair. A
 * user whose credential IS stored behind a slow helper must not be told it is
 * not there. Which of the five occurred is diagnosable only through
 * `hookDebugLog`.
 */
export const NO_STORED_CREDENTIAL_CAUSE: (host: string) => string = (host) =>
  String.raw`no credential was obtained for ${host}; store one with: printf 'protocol=https\nhost=${host}\nusername=<user>\npassword=<token>\n\n' | git credential approve`;

/**
 * The auth bundle of a clone address: the `stored-credential` bundle bound to
 * the host `hostFromCloneUrl` reads from `cloneUrl` and `kind` (GAUTH-03,
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
  return {
    kind: "stored-credential",
    credentialOps: DEFAULT_CREDENTIAL_OPS,
    host: hostFromCloneUrl(cloneUrl, kind),
  };
}

/**
 * Build the `stored-credential` bundle for `host`: the user's git credential
 * helper is the only credential source, a helper miss fails as git failed, and
 * a credential the server rejects stays stored because it is the only copy
 * (GAUTH-04, D-1-01). It does no I/O.
 *
 * Every builder of this module returns it (D-SG-27). The autoupdate cascade
 * asks for it directly, because it has no notification context (D-3-04).
 */
export function buildStoredCredentialAuth(
  host: string,
  credentialOps: CredentialOps,
): GitAuthBundle {
  return { kind: "stored-credential", credentialOps, host };
}

/**
 * T-79-09 / D-81-05 / GAUTH-03: build the host-keyed auth bundle for a
 * resolved clone url, so a private source on any host authenticates from the
 * user's credential helper.
 *
 * Shared by the install, reinstall, dependency, and update probes, and by the
 * pinned and unpinned arms within each, so none of those call sites needs its
 * own copy of this logic. The autoupdate cascade has no
 * notification context, so its update probe calls `buildStoredCredentialAuth`
 * instead (D-3-04).
 *
 * The bundle binds the host `hostFromCloneUrl` reads, so a github source and
 * any GitHub spelling bind github.com or the override host (GHB-02, D-09).
 */
export function buildCloneAuth(
  cloneUrl: string,
  kind: GitBackedSource["kind"],
  auth: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
    readonly credentialOps: CredentialOps;
  },
): GitAuthBundle {
  return buildStoredCredentialAuth(hostFromCloneUrl(cloneUrl, kind), auth.credentialOps);
}
