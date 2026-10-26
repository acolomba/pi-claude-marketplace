---
phase: 22-install-failure-reasons
reviewed: 2026-10-23T15:21:51Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - features/plugin/git-source.feature
  - features/plugin/install-dependencies.feature
  - features/step_definitions/plugin/git-source.steps.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/shared/errors.test.ts
  - test/shared/git-failure-classifiers.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-10-23T15:21:51Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

I reviewed the uncommitted phase 22 diff (INR-01..04) and the code it reaches: every
`appendLeakToError` caller, every `classifyGitHostFailure` / `classifyGitTransportFailure`
caller, the `classifyOrchestratorThrow` callers in `reconcile/apply.ts` and `backfill.ts`, the
install-flow routing between `handleCascadeThrow` and `handleInstallThrow`, and the isomorphic-git
clone and fetch defaults.

What I ran:

- `tsc --noEmit`: clean.
- ESLint on the changed `.ts` files: clean.
- `scripts/check-features.mjs`: clean.
- Cucumber on `git-source.feature` and `install-dependencies.feature`: 29/29 scenarios pass.
- Direct coverage for the 7 changed source pairs: 100% lines, branches, and functions.
- The whole unit suite (`test/{architecture,...}/**`): 12366/12368 at first. The two failures were
  `MA-14` tests in `test/orchestrators/marketplace/add.test.ts`. They compared the leak-wrapped
  error with `deepStrictEqual` against `new Error(...)`, and that broke once `appendLeakToError`
  started returning `CleanupLeakError`. Another process fixed `add.test.ts` while this review ran
  (see IN-01). I re-ran it: 126/126 pass. The commit must include that file.

Answers to the specific questions:

- **`appendLeakToError` callers / name checks.** No production code checks `name === "Error"` or the
  wrapper's prototype. `clone-cache.ts:72-78` matches isomorphic-git names on the raw error, which it
  did before the change too. `marketplace/add.ts::unwrapAddError` unwraps one `cause` level, as it
  did before. The only behavior change outside the intended ones was the `add.test.ts` break.
- **`classifyOrchestratorThrow`'s git arm.** It does not misclassify a non-git throw. The arms key on
  `code === "HttpError"`, `UserCanceledError`, the two typed auth errors, `PinnedCommitMissingError`,
  and the DNS/socket errno codes. None of them overlaps `narrowProbeError`'s
  `SyntaxError`/manifest/`EACCES`/`ENOENT` arms. The only reclassification on the uninstall and
  marketplace-remove rows is an `ETIMEDOUT`/`ECONNRESET` raised by the filesystem, which now reads
  `network unreachable` instead of `unreadable`. That is rare and acceptable. One gap remains: the
  arm misses `InstallMarketplaceAddError` (WR-02).
- **`PinnedCommitMissingError` for a local condition.** It is raised only inside
  `materializePluginClone`, after a cold staging clone, so a damaged warm mirror can never raise it.
  That clone does not fetch every object the host holds, though, so the "host does not have it"
  claim can be false (WR-03).
- **Cucumber rules.** The scenarios follow the layout, wording, Outline, and table rules, and
  `check-features` passes. One step-assertion rule is broken (WR-05).
- **Coverage.** Direct coverage is 100%. Two new behaviors are not pinned by a test (IN-05).

## Warnings

### WR-01: INR-02 holds only for the host ladder; the transport ladder still loses the reason behind a leak

**File:** `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts:65`, `:97`, `:149`
**Issue:** `withoutCleanupLeaks` runs only in `classifyGitHostFailure` and
`classifyGitSourceAccessFailure`. The base ladder `classifyGitTransportFailure` and `hostHttpStatus`
still read the outer `CleanupLeakError`, which has no `code` and no `data`. Several verbs call those
two directly, on errors that come from `materializePluginClone` / `materializeOrRefreshPluginMirror`,
and both of those wrap a leak with `appendLeakToError`. The affected verbs:
`plugin fetch` (`fetch.ts:570`, where a leak-wrapped 401 or `ENOTFOUND` falls to the `source missing`
fold), `info --fetch` (`info.ts:2128`, where it falls to `unreadable`), update preflight
(`update-preflight.ts:425`, where it gets no skipped-row transport reason), `update-flow.ts:833`, and
`marketplace/shared.ts:405`. REQUIREMENTS.md INR-02 reads "A staging cleanup leak keeps the original
failure's reason", with no verb restriction. The module header also promises that the SAME
underlying failure maps onto the SAME reason on every verb.
**Fix:** Unwrap at the base of the ladder so every layer inherits it:
```ts
export function classifyGitTransportFailure(error: unknown) {
  const original = withoutCleanupLeaks(error);
  if (!(original instanceof Error)) {
    return undefined;
  }
  // ... rest unchanged, reading `original`
}

export function hostHttpStatus(error: unknown): number | undefined {
  const original = withoutCleanupLeaks(error);
  // ... rest unchanged, reading `original`
}
```
Then drop the now-redundant unwrap in `classifyGitHostFailure`, keeping only its
`PinnedCommitMissingError` check on the unwrapped value. Add one leak-wrapped case per ladder to
`git-failure-classifiers.test.ts`.

### WR-02: A dependency's refused marketplace clone still renders an empty brace (and `{unreadable}` on /reload)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:443-452`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:631-653`
**Issue:** `installCatalog`'s lookup (`install-flow.ts:796-808`) records a `member` subject when a
dependency's target-scope marketplace add fails. `recordAsInstallFailure`
(`install-outcome.ts:503-513`) rethrows an auth failure raw, but it wraps a 404, a 503, or a network
failure in `InstallMarketplaceAddError` and puts the reason in `.reason`. `memberReasons` runs only
`classifyGitHostFailure`, which returns `undefined` for `InstallMarketplaceAddError`. So the same
subject reads `{authentication required}` on a 401 and an empty brace on a 404. A direct install
reads `{source missing}` for the same 404 through `classifyEntityError`
(`install.messaging.ts:364-372`), so this breaks INR-01's "as a direct install does". On `/reload`,
`classifyOrchestratorThrow` has no arm for it either, so a declared plugin whose marketplace add the
host refuses still reads `{unreadable}`.
**Fix:**
```ts
// install-cascade.messaging.ts::memberReasons, after the rollback-partial arm
if (subject.error instanceof InstallMarketplaceAddError) {
  return [subject.error.reason];
}

// apply-outcomes.ts::classifyOrchestratorThrow, before the git ladder
if (err instanceof InstallMarketplaceAddError) {
  return err.reason;
}
```
Add a unit case to each paired test.

### WR-03: `PinnedCommitMissingError` claims the host lacks a commit it may hold

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:155-173`; `extensions/pi-claude-marketplace/shared/errors.ts:1178-1185`
**Issue:** The row says `{source missing}` and the cause says "The git host does not have the commit
<sha>". The clone does not prove that:
1. On the ref-hint path, the recovery `gitOps.fetch` (`platform/git.ts:476-500`) passes no `tags`
   option, and isomorphic-git's `_fetch` defaults to `tags = false`. It fetches every head and no
   tag. A pin reachable only from a tag outside the hinted branch, such as a release commit that was
   tagged but never pushed to a branch, raises the error even though the host has the commit.
2. On both paths, a commit that no advertised head or tag reaches (a branch that was force-pushed
   away, or a PR ref) is never fetched. Claude Code fetches the sha itself (`git fetch origin <sha>`,
   CONTEXT D-02), which GitHub serves, so upstream installs such a pin.

Before this change the failure surfaced isomorphic-git's neutral "not available locally". Now the
user gets a definite and sometimes wrong diagnosis, and that steers them toward the marketplace
author instead of the actual limitation.
**Fix:** Make the claim match what was checked, and close the tag gap:
```ts
// errors.ts
super(`No branch or tag of the git repository holds the commit ${sha}`, options);

// clone-cache.ts::checkoutPinWithRefetch -- add a `tags` option to FetchOptions in platform/git.ts
await gitOps.fetch({ dir: stagingDir, remote: "origin", auth: args.auth, tags: true });
```
Alternatively, record the reachability limit as a known divergence from upstream next to D-09.

### WR-04: `withoutCleanupLeaks` adds a second, unbounded cause-chain walk

**File:** `extensions/pi-claude-marketplace/shared/errors.ts:298-305`
**Issue:** `errors.ts:62-72` declares `causeChain` "the SOLE traversal primitive: the depth bound and
the self-reference cycle guard live here once" (T-13-04). The new `while (original instanceof
CleanupLeakError)` loop skips both guards. `cause` is `readonly` only at compile time, so a reassigned
or self-referencing `cause` would loop forever inside every git classifier.
**Fix:** Build it on the primitive:
```ts
export function withoutCleanupLeaks(err: unknown): unknown {
  for (const link of causeChain(err)) {
    if (!(link instanceof CleanupLeakError)) {
      return link;
    }
  }
  return err;
}
```

### WR-05: New step guards with `assert.ok(x.includes(...))`

**File:** `features/step_definitions/plugin/git-source.steps.ts:69`
**Issue:** `.agents/skills/cucumber/rules/steps.md` requires whole-value comparison and says "No
`assert.ok(x.includes(...))`". This line breaks that rule. It also has no message, so a collision
would fail with no hint of which precondition broke.
**Fix:**
```ts
assert.deepStrictEqual(
  this.gitRepositoryServing(plugin).revisions.filter((sha) => sha === ABSENT_COMMIT),
  [],
);
```

## Info

### IN-01: `add.test.ts` broke on the `CleanupLeakError` change (resolved during review)

**File:** `test/orchestrators/marketplace/add.test.ts:1192-1270`
**Issue:** In the snapshot under review, both `MA-14: orchestrated mode ...` tests failed. They
`deepStrictEqual` the outcome's `error` against `new Error(cause, { cause })`, which differs from
`CleanupLeakError` in prototype and `name`. `npm run check` (`test:coverage:direct:all` for the
`add.ts` pair) would have gone red, and the summary did not mention it. Another process edited the
file during the review to expect `new CleanupLeakError(...)`, and it now passes 126/126.
**Fix:** None needed beyond committing the `add.test.ts` change with the phase. List it in
`22-01-SUMMARY.md` as a deviation.

### IN-02: Stale flow comment in `materializePluginClone`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:190`
**Issue:** "A genuinely unreachable pin throws the same class on the retry" is no longer true. It now
throws `PinnedCommitMissingError`.
**Fix:** Reword it to match the `checkoutPinWithRefetch` doc comment.

### IN-03: `classifyOrchestratorThrow` and import's ladder now diverge, while import's comment says they mirror

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1773-1775`
**Issue:** `dispatchFailedOutcome`'s comment says it mirrors `classifyOrchestratorThrow`'s ladder.
The git arm this phase added makes that false. The divergence is deliberate (D-06, phase 24), but
the comment does not say so.
**Fix:** Note the deferred git arm in the comment, or leave a BACKLOG pointer for phase 24.

### IN-04: The space-joined declared ranges misread when a range contains `||`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:875` (and `:554`)
**Issue:** `member.ranges.join(" ")` turns `["^1.0.0 || ^2.0.0", "^3.0.0"]` into
`"^1.0.0 || ^2.0.0 ^3.0.0"`. As semver that means `^1.0.0 || (^2.0.0 ^3.0.0)`, not the intersection
that was actually checked. D-10 kept the space join as a cosmetic difference, but this case changes
the meaning, not only the look.
**Fix:** Use upstream's `", "` join for both arms (Claude Code `Vfn`, D-01), or quote each range
on its own.

### IN-05: Two new behaviors have coverage but no pinning test

**File:** `test/orchestrators/plugin/clone-cache.test.ts`; `test/orchestrators/plugin/install-cascade.messaging.test.ts`
**Issue:** (a) Nothing asserts that a non-`CommitNotFetchedError` from the retry checkout passes
through unwrapped. The pass-through branch of `asPinnedCommitMissing` is covered only on the
first-checkout path. (b) Nothing asserts the git reason on a root-keyed `member` subject, which
`installCatalog` can record when the root's own marketplace add fails, so the `isRoot` row with a
git reason is untested.
**Fix:** Add one case for each.

---

_Reviewed: 2026-10-23T15:21:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
