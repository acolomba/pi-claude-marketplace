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
 * GAUTH-03 contract: EVERY host gets a bundle, so `buildAuthCallbacks` runs
 * and its fill-first path consults `credentialOps.fill(host)` on every host.
 * The provider registry gates only the interactive half:
 *   - Provider found  -> a bundle whose `onAuthRequired` runs that provider's
 *     Device Flow, host-keyed (PROV-03).
 *   - No provider     -> a bundle whose `onAuthRequired` resolves
 *     `{ ok: false, reason: NO_STORED_CREDENTIAL_CAUSE(host) }`, so a
 *     credential already in the user's helper still authenticates and a miss
 *     surfaces a cause line instead of a bare structural 401 (GAUTH-04).
 *
 * Gate discipline: this module lives in the orchestrator tier but MUST NOT
 * name `gitOps` / `DEFAULT_GIT_OPS` or import `platform/git.ts` as a VALUE --
 * only `import type` from platform/git.ts and its auth-callback sibling is
 * permitted -- so consumers (install-outcome.ts) that import it stay clean
 * under the no-orchestrator-network gate. It imports the provider registry
 * (domain), the Device Flow engine (domain), the raw notify seam (shared), the
 * auth-callback seam types (platform/git-auth-callbacks.ts), and the credential
 * surface (platform/git-credential.ts).
 *
 * AUTH-09: no credential field is ever interpolated into an Error/notify here;
 * enforced by tests/architecture/no-credential-leak.test.ts (PROV-05).
 */

import { findProviderForHost } from "../domain/auth-registry.ts";
import { initiateDeviceFlow } from "../domain/github-auth.ts";
import { NODE_CREDENTIAL_SPAWN, createCredentialOps } from "../platform/git-credential.ts";
import { makeRawNotifyFn } from "../shared/notification-dispatch.ts";

import type { DeviceFlowHttp } from "../domain/github-auth.ts";
import type { AuthAttemptResult, OnAuthRequiredFn } from "../platform/git-auth-callbacks.ts";
import type { CredentialOps } from "../platform/git-credential.ts";
import type { NotificationContext } from "../platform/pi-api.ts";
import type { GitAuthBundle } from "./marketplace/shared.ts";

// Re-export the auth/credential types the network-gated plugin orchestrators
// (install-outcome.ts / reinstall.ts) need. Those files MUST NOT import from
// `platform/git.ts` or `platform/git-credential.ts` directly -- the
// no-orchestrator-network gate greps for any `platform/git` import, even
// type-only -- so this gate-clean module is their single sanctioned source for
// the auth bundle inputs (T-79-10).
export type { AuthAttemptResult, CredentialOps, DeviceFlowHttp };

/** How long a `git credential` subprocess may run before it is SIGTERMed. */
const CREDENTIAL_TIMEOUT_MS = 5_000;

/**
 * The production credential surface every verb defaults to: the platform
 * credential protocol bound to Node's process launcher and the timeout above.
 *
 * It is composed HERE rather than inside `platform/git-credential.ts` so that
 * module publishes only the protocol and its injected collaborators, and the
 * one concrete binding lives with the other host-keyed auth composition. The
 * call builds three closures and launches nothing; the first subprocess starts
 * when a verb actually calls fill/approve/reject.
 */
export const DEFAULT_CREDENTIAL_OPS: CredentialOps = createCredentialOps({
  spawn: NODE_CREDENTIAL_SPAWN,
  timeoutMs: CREDENTIAL_TIMEOUT_MS,
});

/**
 * Extract the bare host from a clone URL per source kind.
 *
 * A `github` source canonicalizes to `https://github.com/<owner>/<repo>` (see
 * domain/source.ts), so it always resolves to the literal `github.com` without
 * a URL parse. Every other kind parses `new URL(cloneUrl).host` -- which
 * INCLUDES the port (e.g. `gitlab.example.com:8443`) so a future
 * enterprise-host provider match stays forward-consistent.
 */
export function hostFromCloneUrl(cloneUrl: string, kind: "github" | "url" | "git-subdir"): string {
  if (kind === "github") {
    return "github.com";
  }

  return new URL(cloneUrl).host;
}

/**
 * The cause line for a host whose only auth path is the user's git credential
 * helper (D-1-01, GAUTH-04). The helper was consulted and produced no usable
 * credential, so the line names the host and the command that stores one.
 * AUTH-09: it interpolates the host and nothing else.
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
  `no credential was obtained for ${host}; add one with git credential approve`;

/**
 * Whether the provider registry claims `host` with a Device Flow.
 *
 * `orchestrators/marketplace/update.ts` consults it to decide whether the
 * stored-credential cause line applies, so the verb does not import the
 * registry itself (GAUTH-05).
 */
export function hasDeviceFlowProvider(host: string): boolean {
  return findProviderForHost(host) !== undefined;
}

/**
 * Build the `GitAuthBundle` for `host`. Every host gets one, so
 * `platform/git.ts` always builds auth callbacks and their fill-first path
 * consults `credentialOps.fill(host)` before anything else (GAUTH-03, D-1-01).
 *
 * A registry host's `onAuthRequired` runs that provider's Device Flow
 * (D-79-05) and, if an `authMemo` is supplied, records the result so the flow
 * runs AT MOST ONCE per host across a single command invocation (D-79-02). A
 * host the registry does not claim gets a pure closure that resolves
 * `NO_STORED_CREDENTIAL_CAUSE(host)`; it does no I/O and touches no memo.
 *
 * The same provider lookup decides `evictOnFailure`, which is the bundle's
 * answer to what `onAuthFailure` may destroy: a provider host re-mints on the
 * next fill miss, so eviction is recoverable there (AUTH-07); on every other
 * host the credential in the user's helper is the only copy, so the bundle
 * forbids the eviction (GAUTH-04).
 *
 * The memo caps Device Flow round-trips and cannot cap `git credential fill`:
 * `platform/git-auth-callbacks.ts::onAuth` reaches `onAuthRequired` only AFTER
 * `fill`, so `fill` runs once per auth challenge per operation. That is the
 * AUTH-02 silent-reuse contract.
 *
 * A host-keyed bundle on an unregistered host is safe at the transport level:
 * isomorphic-git invokes `onAuth` only from `discover`, with the caller's own
 * URL and never a redirect target (`node_modules/isomorphic-git/index.cjs`);
 * `simple-get` deletes `authorization` and `cookie` before following a
 * cross-host redirect; and `credentialFill` emits `protocol` + `host` and
 * never a `path` line (`platform/git-credential.ts`), so the lookup is
 * strictly host-keyed. What remains is a bundle whose bound `host` disagrees
 * with the URL being cloned, and `buildAuthCallbacks.onAuth` compares the two
 * directly (D-1-03, T-79-04).
 */
export function buildAuthForHost(args: {
  host: string;
  credentialOps: CredentialOps;
  ctx: NotificationContext;
  deviceFlowHttp?: DeviceFlowHttp;
  authMemo?: Map<string, AuthAttemptResult>;
}): GitAuthBundle {
  const { host, credentialOps, ctx, deviceFlowHttp, authMemo } = args;

  const provider = findProviderForHost(host);
  if (provider === undefined) {
    // D-1-02: a state producer, so no notification is raised from this seam --
    // the reason rides the caller's error cause chain instead.
    const onAuthRequired: OnAuthRequiredFn = () =>
      Promise.resolve<AuthAttemptResult>({
        ok: false,
        reason: NO_STORED_CREDENTIAL_CAUSE(host),
        authAttempted: true,
      });
    // AUTH-07 / GAUTH-04: this closure mints nothing, so evicting a
    // server-rejected credential here would destroy the host's only copy.
    return {
      credentialOps,
      host,
      onAuthRequired,
      evictOnFailure: false,
    } satisfies GitAuthBundle;
  }

  const notifyFn = makeRawNotifyFn(ctx);
  const onAuthRequired: OnAuthRequiredFn = async (): Promise<AuthAttemptResult> => {
    // D-79-02: once-per-host memo short-circuits a repeated flow.
    const memoized = authMemo?.get(host);
    if (memoized !== undefined) {
      return memoized;
    }

    const result = await initiateDeviceFlow({
      provider,
      host,
      credentialOps,
      notifyFn,
      ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
    });
    authMemo?.set(host, result);
    return result;
  };

  // AUTH-07: the provider's Device Flow re-mints on the next operation's fill
  // miss, so evicting a credential the server rejected is recoverable.
  return {
    credentialOps,
    host,
    onAuthRequired,
    evictOnFailure: true,
  } satisfies GitAuthBundle;
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
 * Shared by the install, reinstall, fetch, and `info --fetch` probes, and by
 * the pinned and unpinned arms within each, so none of those call sites needs
 * its own copy of this logic.
 * `update-preflight.ts` is the one git-plugin probe outside it: it keeps a local
 * `buildBundle` because its cascade path may run with no `ctx` at all and
 * returns undefined rather than a bundle in that case.
 */
export function buildCloneAuth(
  cloneUrl: string,
  kind: "url" | "git-subdir" | "github",
  auth: {
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  },
): GitAuthBundle {
  return buildAuthForHost({
    host: hostFromCloneUrl(cloneUrl, kind),
    credentialOps: auth.credentialOps,
    ctx: auth.ctx,
    ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
    ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
  });
}
