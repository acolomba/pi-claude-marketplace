---
phase: 10-github-source-kind-and-suite-close
fixed_at: 2026-10-21T16:30:37Z
review_path: .planning/phases/10-github-source-kind-and-suite-close/10-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-21T16:30:37Z
**Source review:** .planning/phases/10-github-source-kind-and-suite-close/10-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 4 (fix scope: critical_warning, so IN-01..IN-05 were not attempted)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: A github update whose stored credential the host rejects is told no credential was obtained

**Status:** fixed: requires human verification (logic change to the auth seam)
**Files modified:** `extensions/pi-claude-marketplace/shared/errors.ts`, `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`, `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `features/marketplace/git-source.feature`, `CHANGELOG.md`, `tests/shared/errors.test.ts`, `tests/shared/git-failure-classifiers.test.ts`, `tests/platform/git-auth-callbacks.test.ts`, `tests/orchestrators/auth-host.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `tests/orchestrators/marketplace/update.test.ts`
**Commit:** 51a1937a
**Applied fix:** Followed the reviewer's first option. A new `StoredCredentialRejectedError(host)` (message `<host> rejected the stored credential`, AUTH-09: host only) is thrown by the `stored-credential` arm of `onAuthFailure` in place of the bare `{ cancel: true }`. The credential is still kept. `classifyGitTransportFailure` maps it to `authentication required`. Both GAUTH-04 cause-line sites (the github arm in `update.ts` and `refreshUrlClone` in `shared.ts`) leave it out. A helper miss still cancels in `onAuth` and still gets the "no credential was obtained" line. The tests came first and failed before the fix. They add a unit case per arm with a rejected credential and update the callback and auth-host cases that expected a cancel. A new `git-source.feature` Outline stores the password "expired" against an armed "s3cret". Its url and two github rows check the rejection chain and the 401, 401 request log. CHANGELOG has a new sub-bullet under the GitHub base override entry. `docs/output-catalog.md` does not document this cause line, so it is unchanged.

**Reviewer check:** the typed throw applies to every verb that uses a `stored-credential` bundle (add, install, fetch, and update; url and github-under-override). For a rejected credential, depth 0 of the cause chain was `The operation was canceled.` and is now `<host> rejected the stored credential`. The 401 path is fixed. One gap remains: a host that sends **403** after accepting the challenge raises `HttpError 403` straight from isomorphic-git, without calling `onAuthFailure`, so that case still gets the "no credential was obtained" line. The existing GAUTH-04 test keeps 403 on purpose: "A 403 never invokes onAuth at all". Telling a 403-after-credential apart would mean tracking whether `fill` returned a credential. That changes the bundle identity, which about 11 existing tests compare with `deepStrictEqual`/`strictEqual`, so I left it out.

### WR-02: The GAUTH-04 stored-credential predicate is now kept in two places

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `tests/orchestrators/marketplace/shared.test.ts`
**Commit:** 7e0c0dae
**Applied fix:** `shared.ts` now exports `lacksStoredCredential(err, auth): err is Error`, which holds the WR-01 rule. Both sites call it, and each still places the line itself: the github arm inserts it before the fetched-URL link, and the url arm adds it as the tail only when `err.cause === undefined`. The private copy in `update.ts` and its now-unused imports are gone. `shared.test.ts` owns the new export through a six-row table.

### WR-03: An early `BeforeAll` failure still leaks the run root, and the new comment says it cannot

**Files modified:** `features/support/pi-process.ts`
**Commit:** 4d21d34c
**Applied fix:** Every step after `mkdtemp` (sandbox mkdir, `HttpsGitHost.start`, `PiProcess.start`, assigning `piRun`) now runs in one `try`. The catch closes a started host and removes the root through `settleInOrder`, then rethrows, or throws an `AggregateError` if cleanup also failed. That makes the `AfterAll` comment true. I checked it by hand: a fake `openssl` that exits 1 was put first on `PATH`, with `TMPDIR` set to a scratch dir. The run failed in `BeforeAll`, and no `pi-cm-features-*` root was left behind.

### WR-04: The `git-source.feature` description no longer covers what the file protects

**Files modified:** `features/marketplace/git-source.feature`
**Commit:** b25d84c6
**Applied fix:** The description now says the marketplace is cloned when added and fetched when updated, with the stored credential if the host asks for one, and that it fails without it. To stay within three lines, it drops the trailing "and read its request log".

## Verification

- Each commit went through the pre-commit hook (`npm run check:commit` passed every time) with no `--no-verify`.
- The fixes were made and committed in an isolated worktree (`.claude/worktrees/rf-10-*`, with `node_modules` symlinked from the main checkout). `features/cucumber-behavioral-tests` was then fast-forwarded to b25d84c6, and the worktree, temp branch, and recovery sentinel were removed.
- `npm run check` then ran **in the main checkout** at b25d84c6 and exited 0: static checks, unpaired tests, integration tests, the full cucumber suite (432 scenarios, 432 passed), and direct coverage for all pairs.
- Targeted runs during the work: the affected unit suites (698 and 622 cases, all passing), and `features/marketplace/git-source.feature` (29 scenarios) and `features/marketplace/remove.feature` (49 scenarios) under `--parallel 1`.

---

_Fixed: 2026-10-21T16:30:37Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
