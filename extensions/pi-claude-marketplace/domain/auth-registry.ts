/**
 * Git auth provider registry (D-79-04).
 *
 * A `GitAuthProvider` descriptor carries everything the RFC-8628 Device Flow
 * engine (domain/github-auth.ts) needs to authenticate against a given host:
 * the two OAuth endpoints, the public OAuth App client_id, the requested
 * scope, a host-match predicate, and a pure `credentialFrom` mapping from an
 * access token to the isomorphic-git credential shape.
 *
 * Descriptors are COMPILE-TIME constants; there is no runtime provider
 * configuration in v1 (PROV-07 per-source declarations deferred to v2). The
 * GitHub descriptor supplies today's exact literals so github.com behavior is
 * byte-identical when the engine defaults to GITHUB_PROVIDER.
 *
 * AUTH-09 discipline: no credential field is ever interpolated into an
 * Error/notify here; enforced by tests/architecture/no-credential-leak.test.ts
 * (PROV-05).
 */

import type { GitCredentials } from "../platform/git.ts";

export interface GitAuthProvider {
  /** Stable descriptor id (e.g. "github"). */
  readonly id: string;
  /** True when this provider authenticates the given bare hostname. */
  hostMatch(host: string): boolean;
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

/**
 * GitHub descriptor carrying today's exact literals (byte-identity source for
 * the engine's default path). deviceCodeUrl/tokenUrl/clientId/scope and the
 * `x-access-token` credential mapping mirror the values previously hardcoded in
 * domain/github-auth.ts.
 */
export const GITHUB_PROVIDER: GitAuthProvider = {
  id: "github",
  hostMatch: (host) => host === "github.com",
  deviceCodeUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  clientId: "Ov23liNcyK08uGdU0mMl",
  scope: "repo",
  credentialFrom: (accessToken) => ({ username: "x-access-token", password: accessToken }),
};

const PROVIDERS: readonly GitAuthProvider[] = [GITHUB_PROVIDER];

/**
 * PROV-01: return the provider whose hostMatch accepts `host`, or undefined
 * when no descriptor claims the host.
 */
export function findProviderForHost(host: string): GitAuthProvider | undefined {
  return PROVIDERS.find((p) => p.hostMatch(host));
}
