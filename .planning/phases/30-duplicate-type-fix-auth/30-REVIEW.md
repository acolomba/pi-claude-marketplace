---
phase: 30-duplicate-type-fix-auth
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - extensions/pi-claude-marketplace/platform/git.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

`platform/git.ts` is the D-13 boundary wrapper over isomorphic-git. It is
structurally sound: every function delegates cleanly, the `??` normalization
on `currentBranch` is correct, and the `forceUpdateRef` / `force: true`
passthrough is correct.

Three meaningful issues were found:

1. `GitCredentials` is advertised as matching `GitAuth` but silently drops the
   `cancel` field, breaking the D-13 re-export contract for Phase 31+
   consumers that need cancellation semantics.
2. `pull` + `PullOptions` are exported and wired but constitute dead code that
   directly contradicts the D-14 design rule documented in shared.ts; the
   export is a latent misuse trap.
3. `fetch` returns `Promise<git.FetchResult>` while the `GitOps` interface
   (shared.ts) and every actual call site treat it as `Promise<void>` --
   the return type is misleading and structurally inconsistent with the rest
   of the abstraction.

---

## Warnings

### WR-01: `GitCredentials` missing `cancel` field -- breaks GitAuth parity

**File:** `extensions/pi-claude-marketplace/platform/git.ts:208-217`

**Issue:** The JSDoc comment at line 208 states the interface "Matches
isomorphic-git's `GitAuth`" and re-exports it for Phase 31+ consumers per
D-13. The real `GitAuth` type in `node_modules/isomorphic-git/index.d.ts:516`
has a fourth field:

```ts
cancel?: boolean | undefined;
// "Tells git to throw a UserCanceledError (instead of an HttpError)."
```

`GitCredentials` omits this field. Any Phase 31+ orchestrator that constructs
a `GitCredentials` object and attempts to set `cancel: true` (e.g. to
implement a user-interrupt path) will get a TypeScript compile error forcing
it to either cast around the boundary type or import `GitAuth` directly from
isomorphic-git, violating D-13.

**Fix:** Add the field to the interface:

```ts
export interface GitCredentials {
  username?: string;
  password?: string;
  headers?: Record<string, string>;
  /** Set true to throw UserCanceledError instead of HttpError. */
  cancel?: boolean;
}
```

---

### WR-02: `pull` / `PullOptions` are dead exports that contradict D-14

**File:** `extensions/pi-claude-marketplace/platform/git.ts:53-128`

**Issue:** `PullOptions` (lines 53-61) and `pull()` (lines 120-128) are
exported and fully wired to `git.pull`. However:

- `shared.ts` lines 7-9 and 73-75 explicitly document that `pull` MUST NOT be
  used because D-14's follow-upstream-blindly semantics require
  `fetch → forceUpdateRef → checkout`, a sequence that `pull --ff-only` cannot
  express when the local branch has diverged from the remote SHA.
- `GitOps` in shared.ts has no `pull` slot -- the D-13 injection interface
  intentionally excludes it.
- No caller anywhere in the codebase calls `pull()` or imports `PullOptions`.

The dead export is not merely unused: it advertises a usage path that the
design rules forbid. A Phase 4+ developer who reads the git module listing
without also reading the `shared.ts` comment will naturally reach for `pull`
and silently introduce incorrect update semantics.

**Fix:** Remove `PullOptions` and `pull` from the module. If there is a
theoretical future need, it can be re-added with the appropriate callsite;
keeping it dormant provides no benefit and has a concrete downside.

```ts
// Delete lines 53-128 (PullOptions interface + pull function).
```

---

### WR-03: `fetch` return type is `Promise<FetchResult>` but all callers
treat it as `Promise<void>`

**File:** `extensions/pi-claude-marketplace/platform/git.ts:110-118`

**Issue:** `fetch()` is declared:

```ts
export async function fetch(opts: FetchOptions): Promise<git.FetchResult>
```

But the `GitOps` interface in `shared.ts:81` declares:

```ts
fetch(opts: { dir: string; remote?: string; ref?: string }): Promise<void>;
```

The `DEFAULT_GIT_OPS.fetch` bridge wrapper (shared.ts lines 105-107) is an
explicit `async (o): Promise<void> => { await defaultGit.fetch(o); }` that
discards the result. The only concrete caller (`refreshGitHubClone` in
shared.ts) calls `await gitOps.fetch(...)` and ignores the return value.

`FetchResult` includes `fetchHead: string | null` -- the SHA of the fetched
HEAD commit. The current `refreshGitHubClone` performs a separate
`resolveRef('refs/remotes/origin/HEAD')` that could be replaced by
`fetchResult.fetchHead` when non-null, but that optimization is currently
unreachable because the return value is discarded.

This creates an inconsistency: the `platform/git.ts` signature advertises a
return value that the D-13 boundary explicitly prevents callers from
consuming. Any future test that mocks `GitOps.fetch` per the interface
signature returns void; any test that calls `platform/git.fetch` directly gets
a typed result object, creating asymmetric test behavior.

**Fix (pick one):**

Option A -- Align `platform/git.fetch` with the `GitOps` boundary (simpler,
matches actual usage):

```ts
export async function fetch(opts: FetchOptions): Promise<void> {
  await git.fetch({
    fs,
    http,
    dir: opts.dir,
    ...(opts.remote !== undefined && { remote: opts.remote }),
    ...(opts.ref !== undefined && { ref: opts.ref }),
  });
}
```

Option B -- Expose `FetchResult` through `GitOps` and consume `fetchHead` in
`refreshGitHubClone` (more expressive, eliminates a `resolveRef` round-trip):

```ts
// GitOps interface:
fetch(opts: { dir: string; remote?: string; ref?: string }): Promise<FetchResult>;

// DEFAULT_GIT_OPS:
fetch: defaultGit.fetch,
```

Option A is the minimal-risk fix; Option B improves correctness for the
default-branch tracking path.

---

## Info

### IN-01: `CheckoutOptions.noCheckout` JSDoc inverts the flag's semantics

**File:** `extensions/pi-claude-marketplace/platform/git.ts:67-68`

**Issue:** The JSDoc for `noCheckout` reads:

> "Set true to keep working-tree files at HEAD."

isomorphic-git's own documentation says:

> "If true, will update HEAD but won't update the working directory."

These are not the same thing: the wrapper's description says files stay at
HEAD (i.e. normal checkout behavior), while the actual meaning is that HEAD
advances but no files are written to disk. A developer reading only the
wrapper's comment would get the behavior exactly backwards: they would set
`noCheckout: true` expecting normal checkout, and get a detached HEAD with no
file changes.

**Fix:**

```ts
/** If true, advance HEAD but do NOT update working-tree files. Default false. */
noCheckout?: boolean;
```

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
