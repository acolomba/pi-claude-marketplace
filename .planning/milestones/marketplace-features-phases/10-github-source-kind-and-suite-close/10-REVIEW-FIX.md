---
phase: 10-github-source-kind-and-suite-close
fixed_at: 2026-10-21T17:04:53Z
review_path: .planning/phases/10-github-source-kind-and-suite-close/10-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-21T17:04:53Z
**Source review:** .planning/phases/10-github-source-kind-and-suite-close/10-REVIEW.md (IN-08, IN-09). Iteration 2 used IN-06 and IN-07 from the previous 10-REVIEW.md and IN-01..IN-05 from 10-REVIEW.iter2.md.
**Iteration:** 3

**Summary:**

- Iteration 3 (fix scope: all, limited by the dispatch to IN-08 and IN-09): 2 Info findings in scope. Fixed: 2. Skipped: 0.
- Iteration 2 (fix scope: all): 7 Info findings in scope (IN-01..IN-07). Fixed: 7. Skipped: 0. One part of IN-04 was deliberately not applied (see IN-04).
- Iteration 1 (fix scope: critical_warning): 4 Warning findings in scope (WR-01..WR-04). Fixed: 4. Skipped: 0.

## Fixed Issues (iteration 3)

### IN-08: The rejected-credential CHANGELOG line says "any git host" and "the cause reads", but github.com and two verbs do not behave that way

**Files modified:** `CHANGELOG.md`
**Commit:** efdf6fa0
**Applied fix:** I checked each claim against the code first.

- Only the `stored-credential` arm of `onAuthFailure` throws `StoredCredentialRejectedError` (`platform/git-auth-callbacks.ts:236-247`). The device-flow arm rejects the credential and cancels (`:249-265`).
- `buildAuthForHost` gives the stored-credential bundle only to a host that `findProviderForHost` does not claim. `buildGitHubAuth` gives it to the `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` host, and the autoupdate cascade asks for it on every host (`orchestrators/auth-host.ts`). The registry covers github.com and gitlab.com (README: Device Flow also covers `gitlab.com`).
- The cause line renders on `marketplace update` (child row, `update.test.ts:1137`, `:5409`), on plugin `fetch` (`failedRow` keeps the error as `cause`), and on an add whose URL the override rewrote (`failedAddRow` in `add.ts`). Plugin `install` shows the bare `(failed) {authentication required}` row (`install.messaging.ts`, amended D-79-03), and so does a plain url add.
- The "store one with" hint is added only on the update refresh paths (`marketplace/shared.ts` `refreshUrlClone` and `update.ts`), so "no longer asks you to store one" is true for update only.

The changelog skill allows one top-level bullet per PR and forbids splitting a PR across several top-level entries. So the line stays a sub-bullet of the git marketplace entry, the best fit among the git failure lines. The new sub-bullet:

> When a host with no Device Flow rejects your stored credential, `marketplace update` and plugin `fetch` say `<host> rejected the stored credential`. So does a GitHub-source add under `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, and `marketplace update` no longer asks you to store one.

It has 39 words, and each sentence has 25 or fewer. "Device Flow" is the term that the README and the earlier CHANGELOG entries use. To keep the parent true, its top line now reads "…and a failed add, update, or fetch reports its git failure more clearly." It no longer says only "a failed add gives a clearer reason and JSON row". The sub-bullet does not list install or the plain url add, because the skill says not to list what stays unchanged. Those two cases are recorded here and in the commit body.

### IN-09: The `transportReason` ladder comment still leaves out a refused device-flow credential as a source of `UserCanceledError`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
**Commit:** 9d21b5e8
**Applied fix:** Comment only. The parenthetical now reads "(a helper miss, a declined or failed Device Flow, or a device-flow credential the host refused)", matching `git-failure-classifiers.ts`, `fetch.ts`, and `install.messaging.ts`. I confirmed the case in `git-auth-callbacks.ts:249-265`: the device-flow arm of `onAuthFailure` rejects the token and returns `{ cancel: true }`, and isomorphic-git throws that as `UserCanceledError`.

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
**Applied fix:** The line moved out from under the `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` entry. It is now a sub-bullet of the git marketplace entry, next to the other git failure lines: "When any git host rejects your stored credential, the cause reads `<host> rejected the stored credential`, and `marketplace update` no longer asks you to store one." No new top-level bullet was added. One caveat: the top line of that entry still reads "a failed add gives a clearer reason", and the sub-bullet covers more than add. (Iteration 3 rewrote this line and the top line, see IN-08.)

### IN-07: Doc comments still say a rejected credential reaches the classifiers as an `HttpError`

**Files modified:** `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`
**Commit:** 175d590c
**Applied fix:** Comments only.

- Classifier: the `HttpError` bullet now reads "a 401/403 that no auth callback answered, such as a 403, or a 401 with no bundle". The `UserCanceledError` bullet now names the helper miss, the failed device flow, and a refused device-flow credential. It also points at `platform/git-auth-callbacks.ts` and no longer at `platform/git.ts`.
- `transportReason` in update.ts: the ladder now lists `StoredCredentialRejectedError`, and the `UserCanceledError` note reads "a helper miss or a declined or failed Device Flow". (Iteration 3 added the refused device-flow credential, see IN-09.)
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

- Iteration 3 ran **in the main checkout** (`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`, branch `features/cucumber-behavioral-tests`). No worktree was used, as the dispatch directed.
- Both commits went through the hooks with a plain `git commit -F <msgfile> -- <path>` (no `--no-verify`). `SKIP=npm-check pre-commit run --files ...` ran clean before each commit (mdformat and markdownlint for `CHANGELOG.md`). The `CHANGELOG.md` commit stages no build input, so the hook skipped `check:commit`. For the `update.ts` commit (9d21b5e8), the hook's `npm run check:commit` passed.
- Both changes are text only (a CHANGELOG line and a comment), so no cucumber run or full `npm run check` ran in iteration 3. The last full `npm run check` is the iteration 2 run at 175d590c (exit 0).
- Iteration 2 ran in the main checkout. Every commit went through the hooks with explicit-path staging, and `npm run check:commit` passed for 4a4f70b9 and 175d590c. Targeted cucumber runs: `url-source.feature` (9/9), then git-source + info + github-source (50/50) and update + url-source-update (96/96). `npm run check` ran once after 175d590c in the main checkout and **exited 0** (433 scenarios, 433 passed).
- Iteration 1 ran in an isolated worktree, and its `npm run check` ran in the main checkout at b25d84c6 (exit 0, 432 scenarios).

---

_Fixed: 2026-10-21T17:04:53Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
