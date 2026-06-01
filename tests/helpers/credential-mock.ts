/**
 * tests/helpers/credential-mock.ts -- in-memory CredentialOps stub for Phase 31+ tests.
 *
 * Sibling of tests/helpers/git-mock.ts; mirrors the makeMockGitOps shape:
 * closure-scoped state, per-method call logs, optional throws overrides.
 * The mock is pure in-memory: no filesystem ops, no environment mutation,
 * no subprocess spawn (per RESEARCH.md Pitfall 9 -- credential mocks do
 * NOT need a real keychain backend; callers receive the GitCredentials
 * object directly).
 *
 * Phase 32+ buildAuthCallbacks tests will inject this mock the same way
 * Phase 4 add/update tests inject makeMockGitOps.
 *
 * Type-only import for CredentialOps so the helper file does not import
 * the production module at runtime (the platform import boundary in
 * eslint.config.js BLOCK C only constrains production code, but a
 * type-only import is the right discipline regardless).
 */

import type { CredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";

export interface MockCredentialState {
  /** Map: host -> stored credential. fill reads; approve writes; reject deletes. */
  store: Map<string, GitCredentials>;
  /** Per-method call logs for assertion. */
  fillCalls: { host: string }[];
  approveCalls: { host: string; cred: GitCredentials }[];
  rejectCalls: { host: string; cred: GitCredentials }[];
  /**
   * Optional override hooks. When set, the corresponding method throws the
   * supplied error instead of touching the store -- tests use this to
   * simulate subprocess errors (ENOENT, timeout) so callers can exercise
   * their own try/catch around the seam.
   */
  fillThrows?: Error;
  approveThrows?: Error;
  rejectThrows?: Error;
}

export interface MockCredentialOpsHandle {
  readonly credOps: CredentialOps;
  readonly state: MockCredentialState;
}

/**
 * Build a fresh mock CredentialOps + bookkeeping state. Tests pass `state`
 * to assertions and mutate it between credOps calls (e.g. pre-seed `store`
 * to simulate a stored credential, then call `fill` and assert on
 * `fillCalls`).
 *
 * `store` is REQUIRED in MockCredentialState but optional on the partial
 * initializer -- we always construct `new Map(initial?.store ?? [])` so
 * callers may pass an iterable of entries or nothing. The optional throws
 * fields use the conditional-spread pattern to satisfy
 * exactOptionalPropertyTypes.
 */
export function makeMockCredentialOps(
  initial?: Partial<MockCredentialState>,
): MockCredentialOpsHandle {
  const state: MockCredentialState = {
    store: new Map(initial?.store ?? []),
    fillCalls: [],
    approveCalls: [],
    rejectCalls: [],
    ...(initial?.fillThrows !== undefined && { fillThrows: initial.fillThrows }),
    ...(initial?.approveThrows !== undefined && { approveThrows: initial.approveThrows }),
    ...(initial?.rejectThrows !== undefined && { rejectThrows: initial.rejectThrows }),
  };

  const credOps: CredentialOps = {
    async fill(host: string): Promise<GitCredentials | null> {
      state.fillCalls.push({ host });
      if (state.fillThrows !== undefined) {
        throw state.fillThrows;
      }

      await Promise.resolve();
      return state.store.get(host) ?? null;
    },

    async approve(host: string, cred: GitCredentials): Promise<void> {
      state.approveCalls.push({ host, cred });
      if (state.approveThrows !== undefined) {
        throw state.approveThrows;
      }

      await Promise.resolve();
      state.store.set(host, cred);
    },

    async reject(host: string, cred: GitCredentials): Promise<void> {
      state.rejectCalls.push({ host, cred });
      if (state.rejectThrows !== undefined) {
        throw state.rejectThrows;
      }

      await Promise.resolve();
      state.store.delete(host);
    },
  };

  return { credOps, state };
}
