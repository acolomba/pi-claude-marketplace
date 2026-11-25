/**
 * Host-keyed auth bundle factory (D-79-05).
 *
 * `buildAuthForHost` is the single seam that turns a bare host into a
 * `GitAuthBundle` bound to that host: the user's credential helper on every
 * host, plus that host's registered Device Flow when the provider registry
 * claims it. The marketplace clone path (add.ts / update.ts) calls it directly
 * and the plugin clone paths reach it through `buildCloneAuth`, instead of any
 * of them hardcoding `github.com` + `initiateDeviceFlow`.
 *
 * GAUTH-03 contract: EVERY host gets a bundle. git asks the user's credential
 * helpers itself on every host, and the bundle decides what an authentication
 * failure of the run leads to (D-SG-14). The provider registry gates only the
 * interactive half:
 *   - Provider found  -> a `device-flow` bundle whose `onAuthRequired` runs
 *     that provider's Device Flow, host-keyed (PROV-03). `platform/git.ts`
 *     calls it when no helper answered a request to that host, then runs the
 *     request once more.
 *   - No provider     -> a `stored-credential` bundle from
 *     `buildStoredCredentialAuth`, so a credential already in the user's
 *     helper still authenticates, a miss fails as git failed, and a refused
 *     credential stays stored (GAUTH-04).
 *
 * GitHub bundles come from `buildGitHubAuth`. While
 * `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set, it binds the override host
 * with a stored credential and no Device Flow (GHB-02); unset, it binds
 * github.com through `buildAuthForHost`.
 *
 * `buildAuthForHost` requires a notification context because the Device Flow
 * renders a user code through it. A caller with none -- the autoupdate cascade
 * -- asks for `buildStoredCredentialAuth` directly (D-3-04).
 *
 * Gate discipline: this module lives in the orchestrator tier but MUST NOT
 * name `gitOps` / `DEFAULT_GIT_OPS` or import `platform/git.ts` as a VALUE --
 * only `import type` from platform/git.ts is permitted -- so consumers
 * (install-outcome.ts) that import it stay clean under BLOCK F in
 * `eslint.config.js`. It imports the provider registry (domain), the Device
 * Flow engine (domain), the device-flow prompt helper (shared), the credential
 * surface with the bundle and sign-in types (platform/git-credential.ts), and
 * the GitHub base seam (shared/github-base-url.ts).
 *
 * AUTH-09: no credential field is ever interpolated into an Error/notify here;
 * enforced by test/architecture/no-credential-leak.test.ts (PROV-05).
 */

import { findProviderForHost } from "../domain/auth-registry.ts";
import { initiateDeviceFlow } from "../domain/github-auth.ts";
import { NODE_CREDENTIAL_GIT, createCredentialOps } from "../platform/git-credential.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { DeviceFlowUnavailableError } from "../shared/errors.ts";
import {
  GITHUB_HOST,
  gitHubAddressOf,
  gitHubOverrideHost,
  gitHubWireUrl,
} from "../shared/github-base-url.ts";
import { notifyDeviceFlowPrompt } from "../shared/notification-dispatch.ts";

import type { DeviceFlowHttp } from "../domain/github-auth.ts";
import type {
  AuthAttemptResult,
  CredentialOps,
  GitAuthBundle,
  OnAuthRequiredFn,
} from "../platform/git-credential.ts";
import type { NotificationContext } from "../platform/pi-api.ts";
import type { NotificationRun } from "../shared/notification-run.ts";

// Re-export the auth/credential types the network-gated plugin orchestrators
// (install-outcome.ts / reinstall-flow.ts) need. Those files MUST NOT import
// from `platform/git.ts` or `platform/git-credential.ts` directly -- BLOCK F in
// `eslint.config.js` rejects any `platform/git` import, even
// type-only -- so this gate-clean module is their single sanctioned source for
// the auth bundle inputs (T-79-10).
export type { AuthAttemptResult, CredentialOps, DeviceFlowHttp };

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
export function hostFromCloneUrl(cloneUrl: string, kind: "github" | "url" | "git-subdir"): string {
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
 * Build the `stored-credential` bundle for `host`: the user's git credential
 * helper is the only credential source, a helper miss fails as git failed, and
 * a credential the server rejects stays stored because it is the only copy
 * (GAUTH-04, D-1-01). It does no I/O.
 *
 * `buildAuthForHost` returns it for a host the provider registry does not
 * claim. The autoupdate cascade asks for it on every host, because it has no
 * notification context to render a Device Flow user code in (D-3-04).
 */
export function buildStoredCredentialAuth(
  host: string,
  credentialOps: CredentialOps,
): GitAuthBundle {
  return { kind: "stored-credential", credentialOps, host };
}

/**
 * Build the `GitAuthBundle` for `host`. Every host gets one, so an
 * authentication failure on any host maps by the bundle's kind (GAUTH-03,
 * D-1-01, D-SG-14).
 *
 * A registry host gets a `device-flow` bundle: its `onAuthRequired` runs that
 * provider's Device Flow (D-79-05) and, if an `authMemo` is supplied, records
 * the result so the flow runs AT MOST ONCE per host across a single command
 * invocation (D-79-02). A host the registry does not claim gets
 * `buildStoredCredentialAuth`'s bundle.
 *
 * The memo caps Device Flow round-trips, not git's own helper queries: git
 * asks the user's credential helpers on every run, and `platform/git.ts`
 * reaches `onAuthRequired` only after a run failed because no helper answered
 * (D-SG-14). That is the AUTH-02 silent-reuse contract.
 *
 * The bundle hands git no credential of its own: git makes every lookup in
 * the user's helpers itself, and a sign-in's token reaches git only through a
 * one-shot helper for the one retried run (`platform/git-one-shot-credential.ts`,
 * D-SG-14). `platform/git.ts` runs that retry only for a request to the
 * bundle's host and keys the helper to that host, so a request to another
 * host never gets the token (D-1-03, T-79-04).
 */
export function buildAuthForHost(args: {
  host: string;
  credentialOps: CredentialOps;
  ctx: NotificationContext;
  run: NotificationRun;
  deviceFlowHttp?: DeviceFlowHttp;
  authMemo?: Map<string, AuthAttemptResult>;
}): GitAuthBundle {
  const { host, credentialOps, ctx, run, deviceFlowHttp, authMemo } = args;

  const provider = findProviderForHost(host);
  // AAP-02 / D-13: a run no command opened, such as an autoapply load, gets no
  // interactive Device Flow, as the autoupdate cascade gets none (D-3-04). A
  // credential miss then fails that row instead of holding the load.
  if (provider === undefined || run.origin.kind !== "command") {
    return buildStoredCredentialAuth(host, credentialOps);
  }

  const onAuthRequired: OnAuthRequiredFn = async (): Promise<AuthAttemptResult> => {
    // D-79-02: once-per-host memo short-circuits a repeated flow.
    const memoized = authMemo?.get(host);
    if (memoized !== undefined) {
      // AUTH-09: the line names the host only, so a debug trace tells a
      // reused sign-in from a new one.
      hookDebugLog(`reusing the sign-in for ${host}`, "auth");
      return memoized;
    }

    if (ctx.mode === "print") {
      throw new DeviceFlowUnavailableError();
    }

    const result = await initiateDeviceFlow({
      provider,
      host,
      credentialOps,
      onDeviceCode: (prompt) => {
        notifyDeviceFlowPrompt(ctx, run, prompt);
      },
      ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
    });
    authMemo?.set(host, result);
    return result;
  };

  return { kind: "device-flow", credentialOps, host, onAuthRequired };
}

/**
 * GHB-02 / D-79-05: build the auth bundle for a GitHub source. While
 * `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set, it is a stored-credential
 * bundle bound to the override host, built without a provider lookup, so no
 * Device Flow runs even when that host is github.com or gitlab.com. Unset, it
 * is `buildAuthForHost`'s bundle for github.com. An invalid value throws
 * `InvalidGitHubBaseUrlError`.
 */
export function buildGitHubAuth(args: {
  credentialOps: CredentialOps;
  ctx: NotificationContext;
  run: NotificationRun;
  deviceFlowHttp?: DeviceFlowHttp;
  authMemo?: Map<string, AuthAttemptResult>;
}): GitAuthBundle {
  const overrideHost = gitHubOverrideHost();
  if (overrideHost !== undefined) {
    return buildStoredCredentialAuth(overrideHost, args.credentialOps);
  }

  return buildAuthForHost({ ...args, host: GITHUB_HOST });
}

/**
 * PROV-03 / T-79-09 / D-81-05 / GAUTH-03: build the host-keyed auth bundle for
 * a resolved clone url.
 *
 * Returns a bundle for every host, so a private source on any host
 * authenticates from the user's credential helper; a registry host adds that
 * provider's Device Flow on a helper miss. `buildAuthForHost` never
 * interpolates credentials into any surfaced string (AUTH-09). D-79-02: the
 * command-scope `authMemo` caps the device flow at once per host.
 *
 * Shared by the install, reinstall, fetch, `info --fetch`, and update probes,
 * and by the pinned and unpinned arms within each, so none of those call
 * sites needs its own copy of this logic. The autoupdate cascade has no
 * notification context, so its update probe calls `buildStoredCredentialAuth`
 * instead (D-3-04).
 *
 * A github source, and a git-subdir url the GitHub base rewrites, get
 * `buildGitHubAuth`'s bundle (GHB-02, D-09).
 */
export function buildCloneAuth(
  cloneUrl: string,
  kind: "url" | "git-subdir" | "github",
  auth: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  },
): GitAuthBundle {
  const authArgs = {
    credentialOps: auth.credentialOps,
    ctx: auth.ctx,
    run: auth.run,
    ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
    ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
  };
  if (kind === "github" || gitHubWireUrl(cloneUrl) !== cloneUrl) {
    return buildGitHubAuth(authArgs);
  }

  return buildAuthForHost({ ...authArgs, host: hostFromCloneUrl(cloneUrl, kind) });
}
