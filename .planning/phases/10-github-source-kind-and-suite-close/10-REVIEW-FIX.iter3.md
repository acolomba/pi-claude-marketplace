---
phase: 10-github-source-kind-and-suite-close
fixed_at: 2026-10-21T16:55:28Z
review_path: .planning/phases/10-github-source-kind-and-suite-close/10-REVIEW.md
iteration: 2
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-21T16:55:28Z
**Source review:** .planning/phases/10-github-source-kind-and-suite-close/10-REVIEW.md (IN-06, IN-07), with IN-01..IN-05 from 10-REVIEW.iter2.md
**Iteration:** 2

**Summary:**

- Iteration 2 (fix scope: all): 7 Info findings in scope (IN-01..IN-07). Fixed: 7. Skipped: 0. One part of IN-04 was deliberately not applied (see IN-04).
- Iteration 1 (fix scope: critical_warning): 4 Warning findings in scope (WR-01..WR-04). Fixed: 4. Skipped: 0.

## Fixed Issues (iteration 2)

### IN-01: The url kind's ref is echoed, never proven by content

**Files modified:** `features/marketplace/url-source.feature`
**Commit:** 442eb7c5
**Applied fix:** A new scenario, "Adding a url marketplace at a ref clones that ref", gives `main` the description "Tools for formatting" and `stable` the description "Stable tools" through `describeMarketplaceBranch`. It adds `https://{git host}/acme/tools.git#stable` and checks the whole `marketplace info` result, including `source ref | stable` and `description | Stable tools`. An implementation that checks the ref exists but clones the default branch now fails. Every publication still pushes `stable` (D-03), so `info.feature` is unchanged. `url-source.feature` passes (9 scenarios).

### IN-02: After a branch diverges, republishing leaves the host half-updated

**Files modified:** `features/lib/git-marketplace.ts`
**Commit:** 0df7e3fc
**Applied fix:** `pushGitRepository` now runs `git push -q --atomic origin main main:stable`, and its doc comment says a failed push leaves both branches as they were. The bare repository is reached over the local transport, whose receive-pack supports atomic pushes. I checked this in a scratch repo: after `stable` moved past `main`, the atomic push failed and the bare `main` did not move. The two single-ref pushes (`publishGitRepository`, `pushGitBranch`) need no change. The git-source, info, github-source, update, and url-source-update features pass.

### IN-03: A comment line in `answer()` overruns the line width and breaks mid-sentence

**Files modified:** `features/lib/https-git-host/server.ts`
**Commit:** 3a2610ed
**Applied fix:** The three comment lines were rewrapped. The longest is now 81 columns.

### IN-04: In the `@` arm, the repo half can still contain `#`

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`
**Commit:** 4a4f70b9
**Applied fix:** Partial. The doc comment of `parseShorthandSourceForm` now has a blank line between the SRC-03 paragraph and the D-76-04 paragraph, so the `@` arm no longer reads as if it took Claude Code's first-separator split.

**Not applied: rejecting `#` and `@` in `parseOwnerRepo`.** That tightening does not match upstream. I read the regex from the installed Claude Code 2.1.296 binary: `/^([^#@]+)(?:[#@](.+))?$/`. Upstream splits at the first `#` or `@`, and its ref takes the rest of the string. So upstream accepts `acme/tools@a@b` as repo `tools`, ref `a@b`, and `acme/tools@x#y@z` as repo `tools`, ref `x#y@z`. Pi's last-`@` split (D-76-04) gives repo `tools@a` / `tools@x#y`. The tightened parser would refuse both inputs, which moves Pi further from upstream. Only inputs with two or more `@` reach this case. The existing D-76-04 tests (`acme/tools@v1#x` gives ref `v1#x`, `acme/tools#x@y` gives ref `x@y`) pass either way. For true parity, the `@` arm needs the first-`@` split. That reverses the recorded decision D-76-04, so it is a user decision and not a fixer change.

### IN-05: The CHANGELOG does not mention the empty `#` ref divergence

**Files modified:** `CHANGELOG.md`
**Commit:** 9214555c
**Applied fix:** There is a new sub-bullet under the `#ref` shorthand entry: "An empty `#`, as in `owner/repo#`, adds `owner/repo` with no ref, where Claude Code refuses it." (D-MF-07)

### IN-06: The CHANGELOG puts the rejected-credential change under the GitHub base override

**Files modified:** `CHANGELOG.md`
**Commit:** 13fd212c
**Applied fix:** The line moved out from under the `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` entry. It is now a sub-bullet of the git marketplace entry, next to the other git failure lines: "When any git host rejects your stored credential, the cause reads `<host> rejected the stored credential`, and `marketplace update` no longer asks you to store one." No new top-level bullet was added. One caveat: the top line of that entry still reads "a failed add gives a clearer reason", and the sub-bullet covers more than add.

### IN-07: Doc comments still say a rejected credential reaches the classifiers as an `HttpError`

**Files modified:** `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`
**Commit:** 175d590c
**Applied fix:** Comments only.

- Classifier: the `HttpError` bullet now reads "a 401/403 that no auth callback answered, such as a 403, or a 401 with no bundle". The `UserCanceledError` bullet now names the helper miss, the failed device flow, and a refused device-flow credential. It also points at `platform/git-auth-callbacks.ts` and no longer at `platform/git.ts`.
- `transportReason` in update.ts: the ladder now lists `StoredCredentialRejectedError`, and the `UserCanceledError` note reads "a helper miss or a declined or failed Device Flow".
- install.messaging.ts and fetch.ts: both now say that a rejected stored credential throws `StoredCredentialRejectedError` and that a refused device-flow credential cancels. The `HttpError` stays for a 401/403 that no callback answered.

## Fixed Issues (iteration 1)

### WR-01: A github update whose stored credential the host rejects is told no credential was obtained

**Status:** fixed: requires human verification (logic change to the auth seam)
**Files modified:** `extensions/pi-claude-marketplace/shared/errors.ts`, `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`, `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `features/marketplace/git-source.feature`, `CHANGELOG.md`, `tests/shared/errors.test.ts`, `tests/shared/git-failure-classifiers.test.ts`, `tests/platform/git-auth-callbacks.test.ts`, `tests/orchestrators/auth-host.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `tests/orchestrators/marketplace/update.test.ts`
**Commit:** 51a1937a
**Applied fix:** The fix follows the reviewer's first option. The `stored-credential` arm of `onAuthFailure` now throws a new `StoredCredentialRejectedError(host)`, with the message `<host> rejected the stored credential` (AUTH-09: host only), and no longer returns a bare `{ cancel: true }`. The credential is still kept. `classifyGitTransportFailure` maps the error to `authentication required`, and both GAUTH-04 cause-line sites leave it out. A helper miss still cancels in `onAuth` and still gets the "no credential was obtained" line. The tests came first and failed before the fix. A new `git-source.feature` Outline stores the password "expired" against an armed "s3cret". Its rows check the rejection chain and the 401, 401 request log.

**Reviewer check:** one gap remains. A host that answers **403** after it accepts the challenge raises `HttpError 403` straight from isomorphic-git, so that case still gets the "no credential was obtained" line. Closing the gap needs a change to the bundle identity, which about 11 tests compare, so it was left out. The re-review in 10-REVIEW.md accepts this gap as a carry-over.

### WR-02: The GAUTH-04 stored-credential predicate is now kept in two places

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `tests/orchestrators/marketplace/shared.test.ts`
**Commit:** 7e0c0dae
**Applied fix:** `shared.ts` now exports one `lacksStoredCredential(err, auth): err is Error`, and both sites call it. `shared.test.ts` covers it with a six-row table.

### WR-03: An early `BeforeAll` failure still leaks the run root, and the new comment says it cannot

**Files modified:** `features/support/pi-process.ts`
**Commit:** 4d21d34c
**Applied fix:** Every step after `mkdtemp` now runs in one `try`. The catch closes a started host, removes the root through `settleInOrder`, and rethrows (or throws an `AggregateError`). I checked it by hand with a fake `openssl` that exits 1.

### WR-04: The `git-source.feature` description no longer covers what the file protects

**Files modified:** `features/marketplace/git-source.feature`
**Commit:** b25d84c6
**Applied fix:** The description now names the fetch on update, with the stored credential, and stays within three lines.

## Verification

- Iteration 2 ran **in the main checkout** (`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`, branch `features/cucumber-behavioral-tests`). No worktree was used, as the dispatch directed.
- Every commit went through the hooks with a plain `git commit` (no `--no-verify`), with explicit-path staging. `SKIP=npm-check pre-commit run --files ...` ran clean before each commit. For the commits that staged build inputs (4a4f70b9, 175d590c), the hook's `npm run check:commit` passed.
- Targeted cucumber runs: `url-source.feature` (9/9), then git-source + info + github-source (50/50) and update + url-source-update (96/96) after the `--atomic` change.
- `npm run check` ran once after the last commit (175d590c) in the main checkout. It was logged to `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-cucumber-behavioral-tests/e37b84b9-da30-433b-a2eb-65b65d26c976/scratchpad/npm-check.log` and **exited 0**: static checks, unpaired tests, integration tests, cucumber (433 scenarios, 433 passed), and direct coverage for all pairs.
- Iteration 1 ran in an isolated worktree, and its `npm run check` ran in the main checkout at b25d84c6 (exit 0, 432 scenarios).

---

_Fixed: 2026-10-21T16:55:28Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
