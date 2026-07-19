/**
 * Host-keyed auth bundle factory (D-79-05).
 *
 * `buildAuthForHost` is the single seam that turns a bare host into a
 * `GitAuthBundle` bound to that host's registered provider. The marketplace
 * clone path (add.ts / update.ts) and the plugin clone-cache path (install.ts)
 * both call it instead of hardcoding `github.com` + `initiateDeviceFlow`.
 *
 * PROV-02/03/04 contract:
 *   - Provider found  -> a bundle whose `onAuthRequired` runs that provider's
 *     Device Flow, host-keyed (PROV-03).
 *   - No provider     -> `undefined`. NEVER build a bundle for a host with no
 *     registered provider: a bundle carries `credentialOps` keyed on the host,
 *     and constructing one for an unrelated host would risk leaking a
 *     credential cross-host (T-79-04). A public clone on such a host simply
 *     carries no auth bundle (PROV-02); a private one fails clean (PROV-04).
 *
 * Gate discipline: this module lives in the orchestrator tier but MUST NOT
 * name `gitOps` / `DEFAULT_GIT_OPS` or import `platform/git.ts` as a VALUE --
 * only `import type` from platform/git.ts is permitted -- so consumers
 * (install.ts) that import it stay clean under the no-orchestrator-network
 * gate. It imports the provider registry (domain), the Device Flow engine
 * (domain), the raw notify seam (shared), and credential/auth types, and
 * re-exports the `DEFAULT_CREDENTIAL_OPS` value (platform/git-credential.ts).
 *
 * AUTH-09: no credential field is ever interpolated into an Error/notify here;
 * enforced by tests/architecture/no-credential-leak.test.ts (PROV-05).
 */

import { findProviderForHost } from "../domain/auth-registry.ts";
import { initiateDeviceFlow } from "../domain/github-auth.ts";
import { makeRawNotifyFn } from "../shared/notify.ts";

import type { DeviceFlowHttp } from "../domain/github-auth.ts";
import type { CredentialOps } from "../platform/git-credential.ts";
import type { AuthAttemptResult, OnAuthRequiredFn } from "../platform/git.ts";
import type { ExtensionContext } from "../platform/pi-api.ts";
import type { GitAuthBundle } from "./marketplace/shared.ts";

// Re-export the credential/auth surface the network-gated plugin orchestrators
// (install.ts / reinstall.ts) need. Those files MUST NOT import from
// `platform/git.ts` or `platform/git-credential.ts` directly -- the
// no-orchestrator-network gate greps for any `platform/git` import, even
// type-only -- so this gate-clean module is their single sanctioned re-export
// point for the auth bundle inputs (T-79-10).
export { DEFAULT_CREDENTIAL_OPS } from "../platform/git-credential.ts";
export type { AuthAttemptResult, CredentialOps, DeviceFlowHttp };

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

/** The single no-provider cause line (D-79-03). No supported-hosts list. */
export const NO_PROVIDER_CAUSE = (host: string): string =>
  `no auth provider is registered for ${host}`;

/**
 * Build a `GitAuthBundle` for `host`, or `undefined` when no provider claims
 * the host (PROV-04). When a provider is found, the returned bundle's
 * `onAuthRequired` runs that provider's Device Flow (D-79-05) and, if an
 * `authMemo` is supplied, records the result so the flow runs AT MOST ONCE per
 * host across a single command invocation (D-79-02).
 */
export function buildAuthForHost(args: {
  host: string;
  credentialOps: CredentialOps;
  ctx: ExtensionContext;
  deviceFlowHttp?: DeviceFlowHttp;
  authMemo?: Map<string, AuthAttemptResult>;
}): GitAuthBundle | undefined {
  const { host, credentialOps, ctx, deviceFlowHttp, authMemo } = args;

  const provider = findProviderForHost(host);
  if (provider === undefined) {
    // PROV-04: no bundle for a no-provider host (T-79-04 cross-host leak guard).
    return undefined;
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

  return { credentialOps, host, onAuthRequired } satisfies GitAuthBundle;
}
