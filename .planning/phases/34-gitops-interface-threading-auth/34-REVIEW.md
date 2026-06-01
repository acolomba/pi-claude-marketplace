---
phase: 34-gitops-interface-threading-auth
reviewed: 2026-06-01T00:00:00Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - tests/orchestrators/marketplace/shared.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** deep
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 34 widens the `GitOps` interface with `auth?: GitAuthBundle` on `clone`
and `fetch`, exports the `GitAuthBundle` named type, and extends
`refreshGitHubClone` with an optional 5th `auth?` parameter forwarded via
conditional spread into `gitOps.fetch`. The implementation is architecturally
sound: `import type` preserves the D-13 orchestrator/platform boundary, the
conditional spread correctly omits the key when auth is absent (no
`exactOptionalPropertyTypes` violation), and AUTH-09 is respected with no
token interpolation anywhere in the production code.

`npm run check` exits 0 (1304 tests passing, typecheck clean, ESLint clean,
Prettier clean). No critical bugs found.

One warning: `GitAuthBundle` in the orchestrator tier duplicates the field
shape of `BuildAuthCallbacksOpts` in the platform tier without a shared
reference, creating a silent drift risk. Two info items: a test coverage gap
(no auth-threading test for the `storedRef === undefined` code path) and an
awkward positional parameter ordering on `refreshGitHubClone` that forces
`undefined` placeholders at call sites that only want to pass `auth`.

---

## Warnings

### WR-01: `GitAuthBundle` duplicates `BuildAuthCallbacksOpts` without a shared reference

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:75`

**Issue:** `GitAuthBundle` (orchestrator tier) and `BuildAuthCallbacksOpts`
(platform tier, `platform/git.ts:278`) are structurally identical modulo
`readonly` modifiers, but they share no declaration link. Neither is defined
as `Readonly<BuildAuthCallbacksOpts>` nor as an alias. If the auth bundle gains
a new field in a future phase (e.g., `tokenKind`, `repoUrl`) the two interfaces
must be updated independently; a reviewer who updates only one produces a silent
type divergence. The D-13 boundary comment explains why `GitAuthBundle` cannot
be `import type`'d from `platform/git.ts` as `BuildAuthCallbacksOpts` directly
(acceptable), but does not explain why `BuildAuthCallbacksOpts` is not reused
as the named exported type from `platform/git.ts`.

The `CloneOptions.auth?` and `FetchOptions.auth?` fields in `platform/git.ts`
(lines 59 and 68) also use anonymous inline types for the same shape rather
than referencing `BuildAuthCallbacksOpts`, so the duplication is three-way.
Any field addition requires touching four declarations: `GitAuthBundle`,
`BuildAuthCallbacksOpts`, `CloneOptions.auth`, and `FetchOptions.auth`.

**Fix:** In `platform/git.ts`, replace the inline anonymous auth types in
`CloneOptions.auth?` and `FetchOptions.auth?` with the existing
`BuildAuthCallbacksOpts` interface:

```typescript
// platform/git.ts
export interface CloneOptions {
  ...
  auth?: BuildAuthCallbacksOpts;  // was anonymous inline type
}

export interface FetchOptions {
  ...
  auth?: BuildAuthCallbacksOpts;  // was anonymous inline type
}
```

Then in `orchestrators/marketplace/shared.ts`, define `GitAuthBundle` as a
`Readonly` projection so both tiers stay in sync automatically:

```typescript
// orchestrators/marketplace/shared.ts
import type { BuildAuthCallbacksOpts } from "../../platform/git.ts";

export type GitAuthBundle = Readonly<BuildAuthCallbacksOpts>;
```

This is a Phase 35 prerequisite fix rather than an emergency; the current code
is type-safe at runtime. The risk is future-phase drift, not present-day
breakage.

---

## Info

### IN-01: Auth-threading test coverage gap -- `storedRef === undefined` path not exercised with auth

**File:** `tests/orchestrators/marketplace/shared.test.ts:145`

**Issue:** All three new auth-threading tests pass `storedRef = "main"` to
`refreshGitHubClone`. None tests the `storedRef === undefined` path (default-
branch tracking). The auth conditional spread
`...(auth !== undefined && { auth })` is called at line 186 of `shared.ts`
before the `if (storedRef === undefined)` branch, so the forwarding logic is
shared by all paths -- functionally, the existing tests do cover the
forwarding. However, future readers may not see a test that exercises the
combination of default-branch tracking + auth, making it harder to verify
behavior if the fetch call is ever refactored to branch-before-fetch.

**Fix:** Add one test:

```typescript
test("refreshGitHubClone: with auth bundle, storedRef=undefined forwards auth to fetch", async () => {
  const sha = "4444444444444444444444444444444444444444";
  const { gitOps, log } = makeStubGitOps({ resolveRefReturns: sha });

  const { credOps: credentialOps } = makeMockCredentialOps();
  const onAuthRequired = async (): Promise<AuthAttemptResult> =>
    Promise.resolve({ ok: false, reason: "not invoked", authAttempted: true });
  const auth: GitAuthBundle = { credentialOps, host: "github.com", onAuthRequired };

  // storedRef=undefined -> default-branch tracking path
  await refreshGitHubClone("/tmp/clone-dir", undefined, gitOps, undefined, auth);

  assert.equal(log.fetch.length, 1);
  // Auth must be forwarded on the default-branch path too.
  assert.strictEqual(log.fetch[0]?.auth, auth);
  // ref is not set on the fetch call when storedRef is undefined.
  assert.equal(log.fetch[0]?.ref, undefined);
});
```

### IN-02: `refreshGitHubClone` positional parameter ordering requires `undefined` placeholder at call sites

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:179`

**Issue:** The `onFetchSucceeded?` callback (4th parameter) precedes `auth?`
(5th parameter). Any Phase 35 call site that needs to pass `auth` but not
`onFetchSucceeded` must write `refreshGitHubClone(dir, ref, gitOps, undefined,
auth)`, as already seen in the test at line 174. This is already locked by the
key design decision and must not be changed unilaterally, but it is worth
documenting as technical debt for Phase 35 to consider when it wires the call
sites -- an options-bag overload or parameter reorder at that point would
eliminate the placeholder.

**Fix (Phase 35 consideration):** Replace the positional tail with an options
bag:

```typescript
export async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
  opts?: { onFetchSucceeded?: () => void; auth?: GitAuthBundle },
): Promise<void>
```

This is not actionable in Phase 34 since Phase 35 owns the call sites. No
source change needed now.

---

## Summary Table

| ID    | Severity | File                                      | Lines   | Issue                                                          |
|-------|----------|-------------------------------------------|---------|----------------------------------------------------------------|
| WR-01 | WARNING  | orchestrators/marketplace/shared.ts       | 75-79   | `GitAuthBundle` duplicates `BuildAuthCallbacksOpts` without shared reference -- silent drift risk |
| IN-01 | INFO     | tests/orchestrators/marketplace/shared.test.ts | 143+ | No auth-threading test for `storedRef === undefined` path      |
| IN-02 | INFO     | orchestrators/marketplace/shared.ts       | 179-185 | Positional `onFetchSucceeded` before `auth` forces `undefined` placeholder |

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
