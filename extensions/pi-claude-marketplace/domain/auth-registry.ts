/**
 * Git auth provider registry (D-79-04).
 *
 * A `DeviceFlowProvider` descriptor carries everything the RFC-8628 Device
 * Flow engine (domain/github-auth.ts) needs to authenticate against a given
 * host: the two OAuth endpoints, the public OAuth App client_id, the requested
 * scope, a host-match predicate, and a pure `credentialFrom` mapping from an
 * access token to the isomorphic-git credential shape.
 *
 * A `StoredCredentialProvider` descriptor claims a host with no RFC-8628
 * Device Authorization Grant. Authentication there rides the git credential
 * helper's stored entry (AUTH-02 silent reuse): platform/git.ts's
 * `buildAuthCallbacks` consults `credentialOps.fill(host)` before any flow,
 * so a stored PAT authenticates with no interaction, and a fill miss fails
 * clean instead of prompting.
 *
 * Descriptors are COMPILE-TIME constants; there is no runtime provider
 * configuration in v1 (PROV-07 per-source declarations deferred to v2). The
 * GitHub descriptor supplies today's exact literals so github.com behavior is
 * byte-identical when the engine defaults to GITHUB_PROVIDER.
 *
 * The registry carries three descriptors: GITHUB_PROVIDER and GITLAB_PROVIDER
 * (GAUTH-02) as device-flow providers, GITEA_PROVIDER (GAUTH-03) as a
 * stored-credential provider. GitLab's Device Authorization Grant matches
 * GitHub's on field names, error codes and request bodies, so both hosts share
 * one engine.
 *
 * AUTH-09 discipline: no credential field is ever interpolated into an
 * Error/notify here; enforced by tests/architecture/no-credential-leak.test.ts
 * (PROV-05).
 */

import type { GitCredentials } from "../platform/git.ts";

export interface DeviceFlowProvider {
  /** Stable descriptor id (e.g. "github"). */
  readonly id: string;
  /** True when this provider authenticates the given bare hostname. */
  hostMatch(host: string): boolean;
  readonly kind: "device-flow";
  /** RFC-8628 device-code endpoint. */
  readonly deviceCodeUrl: string;
  /** RFC-8628 access-token (poll) endpoint. */
  readonly tokenUrl: string;
  /**
   * D-32-03: PUBLIC OAuth App client_id. Device Flow has no client_secret, so
   * the client_id is safe to commit (RFC 8628 §3.1).
   */
  readonly clientId: string;
  /** Requested OAuth scope. */
  readonly scope: string;
  /** Pure mapping from an access token to the git credential shape. */
  credentialFrom(accessToken: string): GitCredentials;
}

export interface StoredCredentialProvider {
  /** Stable descriptor id (e.g. "gitea"). */
  readonly id: string;
  /** True when this provider authenticates the given bare hostname. */
  hostMatch(host: string): boolean;
  readonly kind: "stored-credential";
}

export type GitAuthProvider = DeviceFlowProvider | StoredCredentialProvider;

/**
 * GitHub descriptor carrying today's exact literals (byte-identity source for
 * the engine's default path). deviceCodeUrl/tokenUrl/clientId/scope and the
 * `x-access-token` credential mapping are GitHub's real Device Flow values,
 * injected into the generic engine in domain/github-auth.ts.
 */
export const GITHUB_PROVIDER: DeviceFlowProvider = {
  id: "github",
  kind: "device-flow",
  hostMatch: (host) => host === "github.com",
  deviceCodeUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  clientId: "Ov23liNcyK08uGdU0mMl",
  scope: "repo",
  credentialFrom: (accessToken) => ({ username: "x-access-token", password: accessToken }),
};

/**
 * GitLab descriptor (GAUTH-02). Four things about it are deliberate:
 *
 * 1. `hostMatch` claims the SaaS host ONLY, never a self-managed instance. A
 *    self-managed GitLab older than 17.9 may not implement the Device
 *    Authorization Grant at all, and the descriptor must not promise support
 *    it cannot verify. Exact equality also keeps lookalike hosts such as
 *    `evil-gitlab.com` from binding a real token to a hostile remote.
 * 2. The `clientId` is the PUBLIC Application ID of a registered
 *    non-confidential GitLab OAuth Application. Device Flow has no
 *    client_secret, so committing it as a literal is safe under the same
 *    D-32-03 rationale already stated for GITHUB_PROVIDER.
 * 3. `read_repository` is a deliberate least-privilege narrowing versus
 *    GitHub's broader `repo`: this project only ever clones read-only. It is
 *    correct as written and must NOT be widened to match GitHub.
 * 4. A GitLab device-flow access token expires in 7200 seconds and the
 *    response issues NO refresh_token, unlike GitHub's classic OAuth App
 *    tokens which do not expire by default. A GitLab user therefore
 *    re-authenticates occasionally. AUTH-07 / D-32-05's `onAuthFailure` (in
 *    `platform/git-auth-callbacks.ts::buildAuthCallbacks`) evicts the
 *    expired credential and always cancels the in-flight operation (CP-9);
 *    it does not itself retrigger Device Flow. Recovery happens on the NEXT
 *    auth attempt: with the credential evicted, `onAuth`'s
 *    `credentialOps.fill(host)` call
 *    misses and falls through to `onAuthRequired`, so the following
 *    `marketplace update`/`install`/etc. invocation re-runs Device Flow.
 *    There is no refresh or expiry-tracking logic here by design.
 */
const GITLAB_PROVIDER: DeviceFlowProvider = {
  id: "gitlab",
  kind: "device-flow",
  hostMatch: (host) => host === "gitlab.com",
  deviceCodeUrl: "https://gitlab.com/oauth/authorize_device",
  tokenUrl: "https://gitlab.com/oauth/token",
  clientId: "bb5b5605c21f02f3b41991e3d5f713488b4f0c5cf969de8f7d82f2811f99192d",
  scope: "read_repository",
  credentialFrom: (accessToken) => ({ username: "oauth2", password: accessToken }),
};

/**
 * Gitea descriptor (GAUTH-03). Two things about it are deliberate:
 *
 * 1. `kind: "stored-credential"` -- Gitea's OAuth2 server offers only the
 *    `authorization_code` and `refresh_token` grants (its discovery document
 *    lists no RFC-8628 Device Authorization Grant), so there is no Device
 *    Flow to run. Authentication instead rides the git credential helper's
 *    stored entry: `platform/git.ts::buildAuthCallbacks` consults
 *    `credentialOps.fill(host)` before any interactive step, so a stored PAT
 *    authenticates silently and a fill miss fails clean with
 *    NO_STORED_CREDENTIAL_CAUSE. Registering the host at all is what threads
 *    the auth bundle (PROV-02 otherwise drops it entirely and the clone runs
 *    authless against a private repo).
 * 2. `hostMatch` claims the bare self-managed host with exact equality, the
 *    same lookalike-host discipline as GITLAB_PROVIDER. Gitea instances are
 *    self-hosted and detectable only by their known hostname; add another
 *    descriptor per instance rather than loosening this to a suffix match.
 */
const GITEA_PROVIDER: StoredCredentialProvider = {
  id: "gitea",
  kind: "stored-credential",
  hostMatch: (host) => host === "gitea.nucleix.io",
};

const PROVIDERS: readonly GitAuthProvider[] = [GITHUB_PROVIDER, GITLAB_PROVIDER, GITEA_PROVIDER];

/**
 * PROV-01: return the provider whose hostMatch accepts `host`, or undefined
 * when no descriptor claims the host.
 */
export function findProviderForHost(host: string): GitAuthProvider | undefined {
  return PROVIDERS.find((p) => p.hostMatch(host));
}
